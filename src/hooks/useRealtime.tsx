// src/hooks/useRealtime.ts
// Système temps réel complet pour Auvergne Tech
// Combine React Query + Supabase Realtime pour des mises à jour instantanées

import { useEffect, useState, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

// =============================================
// TYPES
// =============================================

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeConfig {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
}

interface RealtimeStatus {
  connected: boolean;
  subscribedTables: string[];
  lastUpdate: Date | null;
  reconnecting: boolean;
}

interface RealtimeContextType {
  status: RealtimeStatus;
  subscribe: (config: RealtimeConfig, callback: (payload: any) => void) => () => void;
  unsubscribeAll: () => void;
}

// =============================================
// CONTEXT
// =============================================

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within RealtimeProvider');
  }
  return context;
}

// =============================================
// PROVIDER
// =============================================

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>({
    connected: false,
    subscribedTables: [],
    lastUpdate: null,
    reconnecting: false,
  });
  
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const callbacksRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  // Connexion initiale
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('techniciens').select('id').limit(1);
        setStatus(s => ({ ...s, connected: !error }));
      } catch {
        setStatus(s => ({ ...s, connected: false }));
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const subscribe = useCallback((config: RealtimeConfig, callback: (payload: any) => void) => {
    const key = `${config.schema || 'public'}.${config.table}`;
    
    // Ajouter le callback
    if (!callbacksRef.current.has(key)) {
      callbacksRef.current.set(key, new Set());
    }
    callbacksRef.current.get(key)!.add(callback);

    // Créer le channel s'il n'existe pas
    if (!channelsRef.current.has(key)) {
      const channel = supabase
        .channel(`rt-${config.table}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: config.event || '*',
            schema: config.schema || 'public',
            table: config.table,
            filter: config.filter,
          },
          (payload) => {
            setStatus(s => ({ ...s, lastUpdate: new Date() }));
            callbacksRef.current.get(key)?.forEach(cb => cb(payload));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setStatus(s => ({
              ...s,
              connected: true,
              subscribedTables: [...new Set([...s.subscribedTables, config.table])],
            }));
          }
        });

      channelsRef.current.set(key, channel);
    }

    // Cleanup
    return () => {
      callbacksRef.current.get(key)?.delete(callback);
      if (callbacksRef.current.get(key)?.size === 0) {
        const channel = channelsRef.current.get(key);
        if (channel) {
          supabase.removeChannel(channel);
          channelsRef.current.delete(key);
          setStatus(s => ({
            ...s,
            subscribedTables: s.subscribedTables.filter(t => t !== config.table),
          }));
        }
      }
    };
  }, []);

  const unsubscribeAll = useCallback(() => {
    channelsRef.current.forEach(channel => supabase.removeChannel(channel));
    channelsRef.current.clear();
    callbacksRef.current.clear();
    setStatus(s => ({ ...s, subscribedTables: [] }));
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, subscribe, unsubscribeAll }}>
      {children}
    </RealtimeContext.Provider>
  );
}

// =============================================
// HOOK: useRealtimeQuery
// Combine useQuery + Realtime subscription
// =============================================

interface UseRealtimeQueryOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  table: string;
  filter?: string;
  onInsert?: (data: any) => void;
  onUpdate?: (data: any, old: any) => void;
  onDelete?: (old: any) => void;
  showToasts?: boolean;
  toastMessages?: {
    insert?: string;
    update?: string;
    delete?: string;
  };
  enabled?: boolean;
  staleTime?: number;
}

export function useRealtimeQuery<T>({
  queryKey,
  queryFn,
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  showToasts = false,
  toastMessages,
  enabled = true,
  staleTime = 0,
}: UseRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();

  // Query standard
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
  });

  // Subscription realtime
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`rt-${table}-${queryKey.join('-')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          // Invalider la query
          queryClient.invalidateQueries({ queryKey });

          // Callbacks personnalisés
          if (payload.eventType === 'INSERT') {
            onInsert?.(payload.new);
            if (showToasts && toastMessages?.insert) {
              toast.success(toastMessages.insert, { icon: '✨' });
            }
          } else if (payload.eventType === 'UPDATE') {
            onUpdate?.(payload.new, payload.old);
            if (showToasts && toastMessages?.update) {
              toast.success(toastMessages.update, { icon: '✏️' });
            }
          } else if (payload.eventType === 'DELETE') {
            onDelete?.(payload.old);
            if (showToasts && toastMessages?.delete) {
              toast(toastMessages.delete, { icon: '🗑️' });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryKey.join(','), table, filter, enabled]);

  return query;
}

// =============================================
// HOOK: useRealtimeStatus
// Indicateur de connexion temps réel
// =============================================

export function useRealtimeStatus() {
  const [status, setStatus] = useState<{
    connected: boolean;
    latency: number | null;
    lastPing: Date | null;
  }>({
    connected: false,
    latency: null,
    lastPing: null,
  });

  useEffect(() => {
    const channel = supabase.channel('connection-test');
    
    const ping = async () => {
      const start = Date.now();
      try {
        await supabase.from('techniciens').select('id').limit(1);
        setStatus({
          connected: true,
          latency: Date.now() - start,
          lastPing: new Date(),
        });
      } catch {
        setStatus(s => ({ ...s, connected: false }));
      }
    };

    ping();
    const interval = setInterval(ping, 30000);

    channel.subscribe((status) => {
      setStatus(s => ({ ...s, connected: status === 'SUBSCRIBED' }));
    });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}

// =============================================
// HOOKS SPÉCIALISÉS TEMPS RÉEL
// =============================================

// Pannes en temps réel
export function useRealtimePannes() {
  const queryClient = useQueryClient();

  return useRealtimeQuery({
    queryKey: ['pannes-actives-rt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_pannes')
        .select('*, ascenseur:parc_ascenseurs!code_appareil(adresse, ville, secteur)')
        .is('date_fin_panne', null)
        .order('date_appel', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    table: 'parc_pannes',
    showToasts: true,
    toastMessages: {
      insert: '🚨 Nouvelle panne signalée !',
      update: 'Panne mise à jour',
    },
    onInsert: (panne) => {
      // Notification sonore pour panne urgente
      if (typeof window !== 'undefined' && 'Notification' in window) {
        new Notification('Nouvelle panne !', {
          body: `${panne.code_appareil} - ${panne.motif_panne}`,
          icon: '/icon-192.png',
        });
      }
    },
    onUpdate: (panne, old) => {
      if (panne.date_fin_panne && !old.date_fin_panne) {
        toast.success(`✅ Panne ${panne.code_appareil} résolue !`);
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
      }
    },
  });
}

// Travaux en temps réel
export function useRealtimeTravaux(options?: { technicienId?: string; codeAppareil?: string }) {
  const filter = options?.technicienId 
    ? `technicien_id=eq.${options.technicienId}`
    : options?.codeAppareil 
    ? `code_appareil=eq.${options.codeAppareil}`
    : undefined;

  return useRealtimeQuery({
    queryKey: ['travaux-rt', options?.technicienId || '', options?.codeAppareil || ''],
    queryFn: async () => {
      let query = supabase
        .from('travaux')
        .select('*, technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)')
        .in('statut', ['planifie', 'en_cours'])
        .order('created_at', { ascending: false });

      if (options?.technicienId) {
        query = query.eq('technicien_id', options.technicienId);
      }
      if (options?.codeAppareil) {
        query = query.eq('code_appareil', options.codeAppareil);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    table: 'travaux',
    filter,
    showToasts: true,
    toastMessages: {
      insert: 'Nouveau travaux créé',
      update: 'Travaux mis à jour',
    },
  });
}

// Stock en temps réel
export function useRealtimeStock() {
  return useRealtimeQuery({
    queryKey: ['stock-rt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_articles')
        .select('*')
        .order('designation');
      if (error) throw error;
      return data || [];
    },
    table: 'stock_articles',
    onUpdate: (article, old) => {
      // Alerte stock critique
      if (article.quantite_stock <= (article.seuil_alerte || 5) && old.quantite_stock > (old.seuil_alerte || 5)) {
        toast.error(`⚠️ Stock bas: ${article.designation}`, { duration: 5000 });
      }
      if (article.quantite_stock === 0 && old.quantite_stock > 0) {
        toast.error(`🚨 Rupture: ${article.designation}`, { duration: 8000 });
      }
    },
  });
}

// Planning en temps réel
export function useRealtimePlanning(dateDebut: string, dateFin: string) {
  return useRealtimeQuery({
    queryKey: ['planning-rt', dateDebut, dateFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_events')
        .select('*, technicien:techniciens(prenom, nom), travaux:travaux(code, titre)')
        .gte('date_debut', dateDebut)
        .lte('date_fin', dateFin)
        .order('date_debut');
      if (error) throw error;
      return data || [];
    },
    table: 'planning_events',
    showToasts: true,
    toastMessages: {
      insert: 'Nouvel événement planifié',
      update: 'Planning mis à jour',
      delete: 'Événement supprimé',
    },
  });
}

// Commandes en temps réel
export function useRealtimeCommandes() {
  return useRealtimeQuery({
    queryKey: ['commandes-rt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, fournisseur:fournisseurs(nom)')
        .in('statut', ['en_attente', 'commandee', 'en_transit'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    table: 'commandes',
    onUpdate: (cmd, old) => {
      if (cmd.statut === 'livree' && old.statut !== 'livree') {
        toast.success(`📦 Commande ${cmd.code} livrée !`);
      }
      if (cmd.statut === 'en_transit' && old.statut !== 'en_transit') {
        toast(`🚚 Commande ${cmd.code} en transit`);
      }
    },
  });
}

// Véhicules en temps réel
export function useRealtimeVehicules() {
  return useRealtimeQuery({
    queryKey: ['vehicules-rt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules')
        .select('*, technicien:techniciens(prenom, nom)')
        .order('immatriculation');
      if (error) throw error;
      return data || [];
    },
    table: 'vehicules',
  });
}

// Notes en temps réel
export function useRealtimeNotes(codeAppareil?: string) {
  return useRealtimeQuery({
    queryKey: ['notes-rt', codeAppareil || ''],
    queryFn: async () => {
      let query = supabase
        .from('notes')
        .select('*, technicien:technicien_id(prenom, nom)')
        .eq('partage', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (codeAppareil) {
        query = query.or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    table: 'notes',
    filter: codeAppareil ? `code_ascenseur=eq.${codeAppareil}` : undefined,
    showToasts: true,
    toastMessages: {
      insert: 'Nouvelle note ajoutée',
    },
  });
}

// Documents en temps réel
export function useRealtimeDocuments(codeAppareil?: string) {
  return useRealtimeQuery({
    queryKey: ['documents-rt', codeAppareil || ''],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .order('created_at', { ascending: false });

      if (codeAppareil) {
        query = query.eq('code_appareil', codeAppareil);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
    table: 'documents',
    filter: codeAppareil ? `code_appareil=eq.${codeAppareil}` : undefined,
  });
}

// Notifications en temps réel
export function useRealtimeNotifications(technicienId: string) {
  return useRealtimeQuery({
    queryKey: ['notifications-rt', technicienId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('technicien_id', technicienId)
        .eq('lu', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    table: 'notifications',
    filter: `technicien_id=eq.${technicienId}`,
    onInsert: (notif) => {
      // Toast pour nouvelle notification
      const icons: Record<string, string> = {
        urgent: '🚨',
        high: '⚠️',
        normal: '🔔',
        low: 'ℹ️',
      };
      toast(notif.titre, {
        icon: icons[notif.priority] || '🔔',
        duration: notif.priority === 'urgent' ? 10000 : 5000,
      });

      // Notification système
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(notif.titre, {
          body: notif.message,
          icon: '/icon-192.png',
          tag: notif.id,
        });
      }
    },
  });
}

// Ascenseurs en temps réel
export function useRealtimeAscenseurs(options?: { secteur?: number; enArretOnly?: boolean }) {
  return useRealtimeQuery({
    queryKey: ['ascenseurs-rt', options?.secteur || '', options?.enArretOnly || ''],
    queryFn: async () => {
      let query = supabase
        .from('parc_ascenseurs')
        .select('*')
        .order('code_appareil');

      if (options?.secteur) {
        query = query.eq('secteur', options.secteur);
      }
      if (options?.enArretOnly) {
        query = query.eq('en_arret', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    table: 'parc_ascenseurs',
    filter: options?.secteur ? `secteur=eq.${options.secteur}` : undefined,
    onUpdate: (asc, old) => {
      if (asc.en_arret && !old.en_arret) {
        toast.error(`🔴 ${asc.code_appareil} mis à l'arrêt`, { duration: 6000 });
      }
      if (!asc.en_arret && old.en_arret) {
        toast.success(`🟢 ${asc.code_appareil} remis en service`);
      }
    },
  });
}

// Visites en temps réel
export function useRealtimeVisites(codeAppareil?: string) {
  return useRealtimeQuery({
    queryKey: ['visites-rt', codeAppareil || ''],
    queryFn: async () => {
      let query = supabase
        .from('parc_visites')
        .select('*')
        .order('date_visite', { ascending: false });

      if (codeAppareil) {
        query = query.eq('code_appareil', codeAppareil);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
    table: 'parc_visites',
    filter: codeAppareil ? `code_appareil=eq.${codeAppareil}` : undefined,
  });
}

// Stats globales en temps réel
export function useRealtimeStats() {
  const queryClient = useQueryClient();

  // Subscription à plusieurs tables
  useEffect(() => {
    const tables = ['parc_ascenseurs', 'parc_pannes', 'travaux', 'stock_articles', 'commandes'];
    const channels: RealtimeChannel[] = [];

    tables.forEach(table => {
      const channel = supabase
        .channel(`rt-stats-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          queryClient.invalidateQueries({ queryKey: ['stats-globales-rt'] });
        })
        .subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['stats-globales-rt'],
    queryFn: async () => {
      const [
        { data: arrets },
        { data: pannes },
        { data: travaux },
        { data: stock },
        { data: commandes },
      ] = await Promise.all([
        supabase.from('parc_ascenseurs').select('id').eq('en_arret', true),
        supabase.from('parc_pannes').select('id').is('date_fin_panne', null),
        supabase.from('travaux').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('stock_articles').select('quantite_stock, seuil_alerte'),
        supabase.from('commandes').select('id').in('statut', ['en_attente', 'commandee', 'en_transit']),
      ]);

      return {
        ascenseursEnArret: arrets?.length || 0,
        pannesActives: pannes?.length || 0,
        travauxEnCours: travaux?.length || 0,
        stockAlertes: (stock || []).filter(a => a.quantite_stock <= (a.seuil_alerte || 5)).length,
        commandesEnCours: commandes?.length || 0,
        lastUpdate: new Date(),
      };
    },
    staleTime: 0,
    refetchInterval: 60000, // Backup polling
  });
}

// =============================================
// COMPOSANT: Indicateur de connexion
// =============================================

export function RealtimeIndicator() {
  const status = useRealtimeStatus();

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${status.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className="text-[var(--text-muted)]">
        {status.connected ? 'Temps réel' : 'Déconnecté'}
      </span>
      {status.latency && (
        <span className="text-[var(--text-tertiary)]">{status.latency}ms</span>
      )}
    </div>
  );
}
