import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/stores/appStore';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Types pour les payloads
type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimePayload<T = any> {
  eventType: RealtimeEvent;
  new: T;
  old: T;
  schema: string;
  table: string;
}

// Configuration des canaux
interface ChannelConfig {
  name: string;
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  queryKeys: string[][];
  showToast?: boolean;
  toastConfig?: {
    insert?: { icon: string; message: (data: any) => string };
    update?: { icon: string; message: (data: any) => string };
  };
}

/**
 * Hook principal pour gérer toutes les subscriptions temps réel
 */
export function useRealtimeSubscriptions() {
  const queryClient = useQueryClient();
  const { theme } = useAppStore();

  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // ============================================
    // CANAL: NOTIFICATIONS
    // ============================================
    const notificationsChannel = supabase
      .channel('realtime-notifications')
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
          queryClient.invalidateQueries({ queryKey: ['notifications-widget'] });

          if (payload.eventType === 'INSERT') {
            const notif = payload.new as any;
            if (notif.priority === 'urgent' || notif.priority === 'high') {
              toast(notif.titre, {
                icon: notif.icone || '🔔',
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe();
    channels.push(notificationsChannel);

    // ============================================
    // CANAL: TRAVAUX
    // ============================================
    const travauxChannel = supabase
      .channel('realtime-travaux')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travaux' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['travaux'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['planning'] });

          if (payload.eventType === 'INSERT') {
            toast.success('Nouveau travaux créé', { icon: '🔧' });
          } else if (payload.eventType === 'UPDATE') {
            const travaux = payload.new as any;
            if (travaux.statut === 'termine') {
              toast.success(`Travaux ${travaux.code} terminé`, { icon: '✅' });
            }
          }
        }
      )
      .subscribe();
    channels.push(travauxChannel);

    // ============================================
    // CANAL: ASCENSEURS
    // ============================================
    const ascenseursChannel = supabase
      .channel('realtime-ascenseurs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ascenseurs' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          if (payload.eventType === 'UPDATE') {
            const asc = payload.new as any;
            const oldAsc = payload.old as any;
            
            // Notification si passage en panne
            if (asc.statut === 'en_panne' && oldAsc.statut !== 'en_panne') {
              toast.error(`🚨 ${asc.code} en panne !`, { duration: 6000 });
            }
            // Notification si remise en service
            if (asc.statut === 'en_service' && oldAsc.statut === 'en_panne') {
              toast.success(`✅ ${asc.code} remis en service`, { duration: 4000 });
            }
          }
        }
      )
      .subscribe();
    channels.push(ascenseursChannel);

    // ============================================
    // CANAL: MISE EN SERVICE
    // ============================================
    const mesChannel = supabase
      .channel('realtime-mise-en-service')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mise_en_service' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          if (payload.eventType === 'UPDATE') {
            const mes = payload.new as any;
            if (mes.statut === 'termine') {
              toast.success(`MES ${mes.code} terminée !`, { icon: '🎉' });
            }
          }
        }
      )
      .subscribe();
    channels.push(mesChannel);

    // ============================================
    // CANAL: STOCK - TRANSFERTS
    // ============================================
    const transfertsChannel = supabase
      .channel('realtime-transferts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_transferts' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['transferts'] });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          if (payload.eventType === 'INSERT') {
            toast('Nouvelle demande de transfert', { icon: '📦' });
          } else if (payload.eventType === 'UPDATE') {
            const transfert = payload.new as any;
            if (transfert.statut === 'valide') {
              toast.success('Transfert validé', { icon: '✅' });
            } else if (transfert.statut === 'refuse') {
              toast.error('Transfert refusé', { icon: '❌' });
            }
          }
        }
      )
      .subscribe();
    channels.push(transfertsChannel);

    // ============================================
    // CANAL: STOCK - ARTICLES
    // ============================================
    const stockChannel = supabase
      .channel('realtime-stock')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_vehicules' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['stock'] });
          queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_articles' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['articles'] });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
        }
      )
      .subscribe();
    channels.push(stockChannel);

    // ============================================
    // CANAL: CHAT - MESSAGES
    // ============================================
    const chatChannel = supabase
      .channel('realtime-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
          queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          const msg = payload.new as any;
          // Toast si mention ou message direct (pas de self-notification)
          if (msg.user_id !== CURRENT_USER_ID) {
            if (msg.contenu?.includes(`@${CURRENT_USER_ID}`) || msg.mentions?.includes(CURRENT_USER_ID)) {
              toast('Vous avez été mentionné', { icon: '💬' });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_channels' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        }
      )
      .subscribe();
    channels.push(chatChannel);

    // ============================================
    // CANAL: PLANNING - ÉVÉNEMENTS
    // ============================================
    const planningChannel = supabase
      .channel('realtime-planning')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evenements' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['evenements'] });
          queryClient.invalidateQueries({ queryKey: ['planning'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'astreintes' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['astreintes'] });
          queryClient.invalidateQueries({ queryKey: ['planning'] });
        }
      )
      .subscribe();
    channels.push(planningChannel);

    // ============================================
    // CANAL: NOTES
    // ============================================
    const notesChannel = supabase
      .channel('realtime-notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notes'] });
          queryClient.invalidateQueries({ queryKey: ['context-notes'] });
          queryClient.invalidateQueries({ queryKey: ['notes-widget'] });

          // Toast si note partagée par quelqu'un d'autre
          if (payload.eventType === 'INSERT') {
            const note = payload.new as any;
            if (note.partage && note.technicien_id !== CURRENT_USER_ID) {
              toast('Nouvelle note partagée', { icon: '📝' });
            }
          }
        }
      )
      .subscribe();
    channels.push(notesChannel);

    // ============================================
    // CANAL: DEMANDES
    // ============================================
    const demandesChannel = supabase
      .channel('realtime-demandes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandes' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['demandes'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          if (payload.eventType === 'INSERT') {
            toast('Nouvelle demande reçue', { icon: '📋' });
          }
        }
      )
      .subscribe();
    channels.push(demandesChannel);

    // ============================================
    // CANAL: COMMANDES
    // ============================================
    const commandesChannel = supabase
      .channel('realtime-commandes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['commandes'] });
          queryClient.invalidateQueries({ queryKey: ['archives'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });

          if (payload.eventType === 'UPDATE') {
            const cmd = payload.new as any;
            if (cmd.statut === 'recue') {
              toast.success(`Commande ${cmd.code} reçue !`, { icon: '📦' });
            } else if (cmd.statut === 'expediee') {
              toast(`Commande ${cmd.code} expédiée`, { icon: '🚚' });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commande_lignes' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['commandes'] });
        }
      )
      .subscribe();
    channels.push(commandesChannel);

    // ============================================
    // CANAL: NFC
    // ============================================
    const nfcChannel = supabase
      .channel('realtime-nfc')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nfc_tags' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['nfc-tags'] });
          queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'nfc_scans' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['nfc-scans'] });
          queryClient.invalidateQueries({ queryKey: ['nfc-stats'] });
        }
      )
      .subscribe();
    channels.push(nfcChannel);

    // ============================================
    // CANAL: TOURNÉES
    // ============================================
    const tourneesChannel = supabase
      .channel('realtime-tournees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournees' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['tournees'] });
          queryClient.invalidateQueries({ queryKey: ['planning'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournee_ascenseurs' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['tournees'] });
        }
      )
      .subscribe();
    channels.push(tourneesChannel);

    // ============================================
    // CANAL: VÉHICULES
    // ============================================
    const vehiculesChannel = supabase
      .channel('realtime-vehicules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicules' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['vehicules'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .subscribe();
    channels.push(vehiculesChannel);

    // ============================================
    // CANAL: FEUILLES D'HEURES
    // ============================================
    const heuresChannel = supabase
      .channel('realtime-heures')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'semaines' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['semaine'] });
          queryClient.invalidateQueries({ queryKey: ['feuille-heures'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jours' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['semaine'] });
          queryClient.invalidateQueries({ queryKey: ['jours'] });
        }
      )
      .subscribe();
    channels.push(heuresChannel);

    // ============================================
    // CANAL: GED - DOCUMENTS
    // ============================================
    const gedChannel = supabase
      .channel('realtime-ged')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          queryClient.invalidateQueries({ queryKey: ['ged'] });
        }
      )
      .subscribe();
    channels.push(gedChannel);

    // ============================================
    // CANAL: DASHBOARD CONFIGS
    // ============================================
    const dashboardChannel = supabase
      .channel('realtime-dashboard')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'dashboard_configs',
          filter: `technicien_id=eq.${CURRENT_USER_ID}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
        }
      )
      .subscribe();
    channels.push(dashboardChannel);

    // Cleanup: fermer tous les canaux
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient]);
}

/**
 * Hook pour s'abonner à une table spécifique
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
      .channel(`realtime-${table}-${options.filter || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(options.filter && { filter: options.filter }),
        },
        (payload) => {
          // Invalider les queries
          options.queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });

          // Callbacks
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

  useEffect(() => {
    const channel = supabase
      .channel('connection-status')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected');
        } else {
          setStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}

// Import manquant
import { useState } from 'react';
