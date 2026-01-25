// src/hooks/useRealtimeSubscriptions.ts
import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Hook principal - S'abonne à TOUTES les tables de l'application
 */
export function useRealtimeSubscriptions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // ============================================
    // CANAL 1: NOTIFICATIONS (prioritaire)
    // ============================================
    const notificationsChannel = supabase
      .channel('rt-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `technicien_id=eq.${CURRENT_USER_ID}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });

          if (payload.eventType === 'INSERT') {
            const notif = payload.new as any;
            if (notif.priority === 'urgent' || notif.priority === 'high') {
              toast(notif.titre, { icon: notif.icone || '🔔', duration: 5000 });
            }
          }
        }
      )
      .subscribe();
    channels.push(notificationsChannel);

    // ============================================
    // CANAL 2: TRAVAUX + PIÈCES + ÉTAPES
    // ============================================
    const travauxChannel = supabase
      .channel('rt-travaux')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['travaux'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['planning'] });
        queryClient.invalidateQueries({ queryKey: ['v_travaux_avancement'] });

        if (payload.eventType === 'INSERT') {
          toast.success('Nouveau travaux créé', { icon: '🔧' });
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          if (t.statut === 'termine') toast.success(`Travaux ${t.code} terminé`, { icon: '✅' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux_pieces' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['travaux-pieces'] });
        queryClient.invalidateQueries({ queryKey: ['v_travaux_avancement'] });
        
        if (payload.eventType === 'UPDATE') {
          const p = payload.new as any;
          if (p.statut === 'installe') toast.success('Pièce installée', { icon: '✅' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux_etapes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['travaux-etapes'] });
        queryClient.invalidateQueries({ queryKey: ['v_travaux_avancement'] });
        
        if (payload.eventType === 'UPDATE') {
          const e = payload.new as any;
          if (e.statut === 'termine') toast.success(`Étape "${e.titre}" terminée`, { icon: '✅' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux_temps' }, () => {
        queryClient.invalidateQueries({ queryKey: ['travaux-temps'] });
        queryClient.invalidateQueries({ queryKey: ['v_travaux_avancement'] });
      })
      .subscribe();
    channels.push(travauxChannel);

    // ============================================
    // CANAL 3: ASCENSEURS + PARC
    // ============================================
    const ascenseursChannel = supabase
      .channel('rt-ascenseurs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ascenseurs' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });

        if (payload.eventType === 'UPDATE') {
          const asc = payload.new as any;
          const old = payload.old as any;
          if (asc.statut === 'en_panne' && old.statut !== 'en_panne') {
            toast.error(`🚨 ${asc.code} en panne !`, { duration: 6000 });
          }
          if (asc.statut === 'en_service' && old.statut === 'en_panne') {
            toast.success(`✅ ${asc.code} remis en service`);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parc_ascenseurs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });
      })
      .subscribe();
    channels.push(ascenseursChannel);

    // ============================================
    // CANAL 4: STOCK COMPLET (dépôt + véhicules + mouvements)
    // ============================================
    const stockChannel = supabase
      .channel('rt-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_articles' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['articles'] });
        queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] });
        
        if (payload.eventType === 'UPDATE') {
          const art = payload.new as any;
          const old = payload.old as any;
          if (art.quantite_stock <= art.seuil_critique && old.quantite_stock > art.seuil_critique) {
            toast.error(`Stock critique: ${art.reference}`, { icon: '⚠️' });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_vehicule' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
        queryClient.invalidateQueries({ queryKey: ['alertes-stock-vehicule'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_mouvements' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transferts' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['transferts'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });

        if (payload.eventType === 'INSERT') {
          toast('Nouvelle demande de transfert', { icon: '📦' });
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          if (t.statut === 'valide') toast.success('Transfert validé', { icon: '✅' });
          if (t.statut === 'refuse') toast.error('Transfert refusé', { icon: '❌' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_demandes_reappro' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['demandes-reappro'] });
        
        if (payload.eventType === 'INSERT') {
          toast('Nouvelle demande de réappro', { icon: '🚚' });
        } else if (payload.eventType === 'UPDATE') {
          const d = payload.new as any;
          if (d.statut === 'validee') toast.success('Demande réappro validée');
          if (d.statut === 'livree') toast.success('Réappro livrée !', { icon: '📦' });
        }
      })
      .subscribe();
    channels.push(stockChannel);

    // ============================================
    // CANAL 5: MISE EN SERVICE
    // ============================================
    const mesChannel = supabase
      .channel('rt-mes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_en_service' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        if (payload.eventType === 'UPDATE') {
          const mes = payload.new as any;
          if (mes.statut === 'termine') toast.success(`MES ${mes.code} terminée !`, { icon: '🎉' });
        }
      })
      .subscribe();
    channels.push(mesChannel);

    // ============================================
    // CANAL 6: CHAT & MESSAGERIE
    // ============================================
    const chatChannel = supabase
      .channel('rt-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });

        const msg = payload.new as any;
        if (msg.sender_id !== CURRENT_USER_ID) {
          if (msg.mentions?.includes(CURRENT_USER_ID)) {
            toast('Vous avez été mentionné', { icon: '💬' });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      })
      .subscribe();
    channels.push(chatChannel);

    // ============================================
    // CANAL 7: NOTES
    // ============================================
    const notesChannel = supabase
      .channel('rt-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
        queryClient.invalidateQueries({ queryKey: ['context-notes'] });
        
        if (payload.eventType === 'INSERT') {
          const n = payload.new as any;
          if (n.partage && n.technicien_id !== CURRENT_USER_ID) {
            toast('Nouvelle note partagée', { icon: '📝' });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes_commentaires' }, () => {
        queryClient.invalidateQueries({ queryKey: ['note-commentaires'] });
      })
      .subscribe();
    channels.push(notesChannel);

    // ============================================
    // CANAL 8: DOCUMENTS / GED
    // ============================================
    const gedChannel = supabase
      .channel('rt-ged')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        queryClient.invalidateQueries({ queryKey: ['documents-lies'] });
        queryClient.invalidateQueries({ queryKey: ['ged'] });
        
        if (payload.eventType === 'INSERT') {
          toast('Nouveau document ajouté', { icon: '📄' });
        }
      })
      .subscribe();
    channels.push(gedChannel);

    // ============================================
    // CANAL 9: COMMANDES
    // ============================================
    const commandesChannel = supabase
      .channel('rt-commandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['commandes'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        if (payload.eventType === 'UPDATE') {
          const cmd = payload.new as any;
          if (cmd.statut === 'recue') toast.success(`Commande ${cmd.code} reçue !`, { icon: '📦' });
          if (cmd.statut === 'expediee') toast(`Commande ${cmd.code} expédiée`, { icon: '🚚' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commande_lignes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['commandes'] });
      })
      .subscribe();
    channels.push(commandesChannel);

    // ============================================
    // CANAL 10: DEMANDES
    // ============================================
    const demandesChannel = supabase
      .channel('rt-demandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demandes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['demandes'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        if (payload.eventType === 'INSERT') {
          toast('Nouvelle demande', { icon: '📋' });
        } else if (payload.eventType === 'UPDATE') {
          const d = payload.new as any;
          if (d.statut === 'validee') toast.success('Demande validée');
          if (d.statut === 'refusee') toast.error('Demande refusée');
        }
      })
      .subscribe();
    channels.push(demandesChannel);

    // ============================================
    // CANAL 11: PLANNING
    // ============================================
    const planningChannel = supabase
      .channel('rt-planning')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['planning'] });
        queryClient.invalidateQueries({ queryKey: ['planning-events'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .subscribe();
    channels.push(planningChannel);

    // ============================================
    // CANAL 12: VÉHICULES
    // ============================================
    const vehiculesChannel = supabase
      .channel('rt-vehicules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicules' }, () => {
        queryClient.invalidateQueries({ queryKey: ['vehicules'] });
        queryClient.invalidateQueries({ queryKey: ['vehicule'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .subscribe();
    channels.push(vehiculesChannel);

    // ============================================
    // CANAL 13: TOURNÉES
    // ============================================
    const tourneesChannel = supabase
      .channel('rt-tournees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournees' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tournees'] });
        queryClient.invalidateQueries({ queryKey: ['planning'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournee_ascenseurs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tournees'] });
      })
      .subscribe();
    channels.push(tourneesChannel);

    // ============================================
    // CANAL 14: NFC
    // ============================================
    const nfcChannel = supabase
      .channel('rt-nfc')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfc_tags' }, () => {
        queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
        queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nfc_scans' }, () => {
        queryClient.invalidateQueries({ queryKey: ['nfc-scans'] });
        queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
      })
      .subscribe();
    channels.push(nfcChannel);

    // ============================================
    // CANAL 15: FEUILLES D'HEURES
    // ============================================
    const heuresChannel = supabase
      .channel('rt-heures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'semaines' }, () => {
        queryClient.invalidateQueries({ queryKey: ['semaine'] });
        queryClient.invalidateQueries({ queryKey: ['feuille-heures'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jours' }, () => {
        queryClient.invalidateQueries({ queryKey: ['semaine'] });
        queryClient.invalidateQueries({ queryKey: ['jours'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['semaine'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'astreintes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['semaine'] });
        queryClient.invalidateQueries({ queryKey: ['astreintes'] });
      })
      .subscribe();
    channels.push(heuresChannel);

    // ============================================
    // CANAL 16: CLIENTS
    // ============================================
    const clientsChannel = supabase
      .channel('rt-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      })
      .subscribe();
    channels.push(clientsChannel);

    // ============================================
    // CANAL 17: TECHNICIENS
    // ============================================
    const techniciensChannel = supabase
      .channel('rt-techniciens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'techniciens' }, () => {
        queryClient.invalidateQueries({ queryKey: ['techniciens'] });
        queryClient.invalidateQueries({ queryKey: ['equipe'] });
      })
      .subscribe();
    channels.push(techniciensChannel);

    // ============================================
    // CANAL 18: DASHBOARD CONFIG
    // ============================================
    const dashboardChannel = supabase
      .channel('rt-dashboard')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'dashboard_configs',
        filter: `technicien_id=eq.${CURRENT_USER_ID}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      })
      .subscribe();
    channels.push(dashboardChannel);

    // Cleanup
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient]);
}

/**
 * Hook pour s'abonner à une table spécifique (usage ponctuel)
 */
export function useRealtimeTable<T = any>(
  table: string,
  options: {
    filter?: string;
    queryKeys: string[][];
    onInsert?: (data: T) => void;
    onUpdate?: (data: T, oldData: T) => void;
    onDelete?: (oldData: T) => void;
  }
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`rt-custom-${table}-${options.filter || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(options.filter && { filter: options.filter }),
        },
        (payload) => {
          options.queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });

          if (payload.eventType === 'INSERT' && options.onInsert) {
            options.onInsert(payload.new as T);
          }
          if (payload.eventType === 'UPDATE' && options.onUpdate) {
            options.onUpdate(payload.new as T, payload.old as T);
          }
          if (payload.eventType === 'DELETE' && options.onDelete) {
            options.onDelete(payload.old as T);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, options.filter, queryClient]);
}

/**
 * Hook pour le statut de connexion temps réel
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    
    const channel = supabase
      .channel('connection-status-check')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
          
          // Ping pour mesurer latence
          pingInterval = setInterval(async () => {
            const start = Date.now();
            try {
              await supabase.from('techniciens').select('id').limit(1).single();
              setLatency(Date.now() - start);
            } catch {
              setLatency(null);
            }
          }, 30000);
          
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected');
          setLatency(null);
        } else {
          setStatus('connecting');
        }
      });

    return () => {
      clearInterval(pingInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return { status, latency };
}

/**
 * Hook pour compter les connexions actives (Presence)
 */
export function useRealtimePresence(roomName: string = 'app-presence') {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    const channel = supabase.channel(roomName, {
      config: { presence: { key: CURRENT_USER_ID } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.keys(state);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: CURRENT_USER_ID, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName]);

  return onlineUsers;
}
