// src/hooks/useGlobalRealtime.ts
// Abonnement global à toutes les tables de l'application
// À utiliser une seule fois au niveau App ou Layout

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

// ID utilisateur (à remplacer par auth context)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface GlobalRealtimeStatus {
  connected: boolean;
  channels: number;
  tables: string[];
  lastEvent: { table: string; type: string; time: Date } | null;
}

export function useGlobalRealtime() {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const [status, setStatus] = useState<GlobalRealtimeStatus>({
    connected: false,
    channels: 0,
    tables: [],
    lastEvent: null,
  });

  useEffect(() => {
    const tables: string[] = [];

    // ============================================
    // CANAL 1: PANNES (CRITIQUE)
    // ============================================
    const pannesChannel = supabase
      .channel('global-pannes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parc_pannes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['pannes'] });
        queryClient.invalidateQueries({ queryKey: ['pannes-actives'] });
        queryClient.invalidateQueries({ queryKey: ['pannes-actives-rt'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales-rt'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'parc_pannes', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'INSERT') {
          const p = payload.new as any;
          toast.error(`🚨 Nouvelle panne: ${p.code_appareil}`, { duration: 8000 });
          // Notification système
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 Nouvelle panne !', { body: `${p.code_appareil} - ${p.motif_panne}`, tag: p.id });
          }
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as any;
          const old = payload.old as any;
          if (p.date_fin_panne && !old.date_fin_panne) {
            toast.success(`✅ Panne ${p.code_appareil} résolue`);
          }
        }
      })
      .subscribe();
    channelsRef.current.push(pannesChannel);
    tables.push('parc_pannes');

    // ============================================
    // CANAL 2: ASCENSEURS (PARC)
    // ============================================
    const ascenseursChannel = supabase
      .channel('global-ascenseurs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parc_ascenseurs' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });
        queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
        queryClient.invalidateQueries({ queryKey: ['ascenseurs-rt'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'parc_ascenseurs', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'UPDATE') {
          const asc = payload.new as any;
          const old = payload.old as any;
          if (asc.en_arret && !old.en_arret) {
            toast.error(`🔴 ${asc.code_appareil} mis à l'arrêt`, { duration: 6000 });
          } else if (!asc.en_arret && old.en_arret) {
            toast.success(`🟢 ${asc.code_appareil} remis en service`);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parc_visites' }, () => {
        queryClient.invalidateQueries({ queryKey: ['visites'] });
        queryClient.invalidateQueries({ queryKey: ['visites-rt'] });
        queryClient.invalidateQueries({ queryKey: ['alertes-entretien'] });
      })
      .subscribe();
    channelsRef.current.push(ascenseursChannel);
    tables.push('parc_ascenseurs', 'parc_visites');

    // ============================================
    // CANAL 3: TRAVAUX
    // ============================================
    const travauxChannel = supabase
      .channel('global-travaux')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['travaux'] });
        queryClient.invalidateQueries({ queryKey: ['travaux-actifs'] });
        queryClient.invalidateQueries({ queryKey: ['travaux-rt'] });
        queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['chaine-approvisionnement'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'travaux', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'INSERT') {
          toast('🔧 Nouveau travaux créé');
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          const old = payload.old as any;
          if (t.statut === 'termine' && old.statut !== 'termine') {
            toast.success(`✅ Travaux ${t.code} terminé`);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux_pieces' }, () => {
        queryClient.invalidateQueries({ queryKey: ['travaux-pieces'] });
        queryClient.invalidateQueries({ queryKey: ['travaux'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travaux_etapes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['travaux-etapes'] });
        queryClient.invalidateQueries({ queryKey: ['travaux'] });
      })
      .subscribe();
    channelsRef.current.push(travauxChannel);
    tables.push('travaux', 'travaux_pieces', 'travaux_etapes');

    // ============================================
    // CANAL 4: STOCK
    // ============================================
    const stockChannel = supabase
      .channel('global-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_articles' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
        queryClient.invalidateQueries({ queryKey: ['stock-rt'] });
        queryClient.invalidateQueries({ queryKey: ['stock-alertes'] });
        queryClient.invalidateQueries({ queryKey: ['chaine-approvisionnement'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'stock_articles', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'UPDATE') {
          const art = payload.new as any;
          const old = payload.old as any;
          if (art.quantite_stock === 0 && old.quantite_stock > 0) {
            toast.error(`🚨 Rupture stock: ${art.designation}`, { duration: 8000 });
          } else if (art.quantite_stock <= (art.seuil_alerte || 5) && old.quantite_stock > (old.seuil_alerte || 5)) {
            toast(`⚠️ Stock bas: ${art.designation}`, { icon: '📦' });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_vehicule' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
        queryClient.invalidateQueries({ queryKey: ['alertes-stock-vehicule'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_mouvements' }, () => {
        queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transferts' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['transferts'] });
        if (payload.eventType === 'UPDATE') {
          const t = payload.new as any;
          if (t.statut === 'valide') toast.success('Transfert validé', { icon: '✅' });
        }
      })
      .subscribe();
    channelsRef.current.push(stockChannel);
    tables.push('stock_articles', 'stock_vehicule', 'stock_mouvements', 'stock_transferts');

    // ============================================
    // CANAL 5: COMMANDES
    // ============================================
    const commandesChannel = supabase
      .channel('global-commandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['commandes'] });
        queryClient.invalidateQueries({ queryKey: ['commandes-rt'] });
        queryClient.invalidateQueries({ queryKey: ['chaine-approvisionnement'] });
        queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'commandes', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'UPDATE') {
          const c = payload.new as any;
          const old = payload.old as any;
          if (c.statut === 'livree' && old.statut !== 'livree') {
            toast.success(`📦 Commande ${c.code} livrée !`);
          } else if (c.statut === 'en_transit' && old.statut !== 'en_transit') {
            toast(`🚚 Commande ${c.code} en transit`);
          }
        }
      })
      .subscribe();
    channelsRef.current.push(commandesChannel);
    tables.push('commandes');

    // ============================================
    // CANAL 6: PLANNING
    // ============================================
    const planningChannel = supabase
      .channel('global-planning')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_events' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['planning'] });
        queryClient.invalidateQueries({ queryKey: ['planning-events'] });
        queryClient.invalidateQueries({ queryKey: ['planning-rt'] });
        queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'planning_events', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'INSERT') {
          toast('📅 Nouvel événement planifié');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_conges' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conges'] });
        queryClient.invalidateQueries({ queryKey: ['planning'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_astreintes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['astreintes'] });
        queryClient.invalidateQueries({ queryKey: ['astreinte-actuelle'] });
      })
      .subscribe();
    channelsRef.current.push(planningChannel);
    tables.push('planning_events', 'planning_conges', 'planning_astreintes');

    // ============================================
    // CANAL 7: VÉHICULES
    // ============================================
    const vehiculesChannel = supabase
      .channel('global-vehicules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicules' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['vehicules'] });
        queryClient.invalidateQueries({ queryKey: ['vehicules-rt'] });
        queryClient.invalidateQueries({ queryKey: ['vehicule-alertes'] });
        queryClient.invalidateQueries({ queryKey: ['alertes-entretien'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'vehicules', type: payload.eventType, time: new Date() } }));
      })
      .subscribe();
    channelsRef.current.push(vehiculesChannel);
    tables.push('vehicules');

    // ============================================
    // CANAL 8: DOCUMENTS GED
    // ============================================
    const documentsChannel = supabase
      .channel('global-documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        queryClient.invalidateQueries({ queryKey: ['documents-rt'] });
        queryClient.invalidateQueries({ queryKey: ['documents-ascenseur'] });
        queryClient.invalidateQueries({ queryKey: ['documents-expiration'] });
        queryClient.invalidateQueries({ queryKey: ['ged-widget'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'documents', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'INSERT') {
          toast('📄 Nouveau document ajouté');
        }
      })
      .subscribe();
    channelsRef.current.push(documentsChannel);
    tables.push('documents');

    // ============================================
    // CANAL 9: NOTES
    // ============================================
    const notesChannel = supabase
      .channel('global-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notes'] });
        queryClient.invalidateQueries({ queryKey: ['notes-rt'] });
        queryClient.invalidateQueries({ queryKey: ['notes-contextuelles'] });
        
        setStatus(s => ({ ...s, lastEvent: { table: 'notes', type: payload.eventType, time: new Date() } }));

        if (payload.eventType === 'INSERT') {
          const n = payload.new as any;
          if (n.partage) toast('📝 Nouvelle note partagée');
        }
      })
      .subscribe();
    channelsRef.current.push(notesChannel);
    tables.push('notes');

    // ============================================
    // CANAL 10: NOTIFICATIONS
    // ============================================
    const notificationsChannel = supabase
      .channel('global-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `technicien_id=eq.${CURRENT_USER_ID}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-rt'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        
        const notif = payload.new as any;
        const icons: Record<string, string> = { urgent: '🚨', high: '⚠️', normal: '🔔', low: 'ℹ️' };
        toast(notif.titre, { icon: icons[notif.priority] || '🔔', duration: notif.priority === 'urgent' ? 10000 : 5000 });

        // Notification système
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notif.titre, { body: notif.message, icon: '/icon-192.png', tag: notif.id });
        }
      })
      .subscribe();
    channelsRef.current.push(notificationsChannel);
    tables.push('notifications');

    // ============================================
    // CANAL 11: TECHNICIENS
    // ============================================
    const techniciensChannel = supabase
      .channel('global-techniciens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'techniciens' }, () => {
        queryClient.invalidateQueries({ queryKey: ['techniciens'] });
        queryClient.invalidateQueries({ queryKey: ['charge-travail'] });
      })
      .subscribe();
    channelsRef.current.push(techniciensChannel);
    tables.push('techniciens');

    // ============================================
    // CANAL 12: MISE EN SERVICE
    // ============================================
    const mesChannel = supabase
      .channel('global-mes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_en_service' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        if (payload.eventType === 'UPDATE') {
          const mes = payload.new as any;
          if (mes.statut === 'termine') toast.success(`🎉 MES ${mes.code} terminée !`);
        }
      })
      .subscribe();
    channelsRef.current.push(mesChannel);
    tables.push('mise_en_service');

    // ============================================
    // CANAL 13: CHAT
    // ============================================
    const chatChannel = supabase
      .channel('global-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        
        const msg = payload.new as any;
        if (msg.sender_id !== CURRENT_USER_ID) {
          toast('💬 Nouveau message');
        }
      })
      .subscribe();
    channelsRef.current.push(chatChannel);
    tables.push('chat_messages');

    // ============================================
    // CANAL 14: INTERVENTIONS RAPIDES
    // ============================================
    const interventionsChannel = supabase
      .channel('global-interventions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions_rapides' }, () => {
        queryClient.invalidateQueries({ queryKey: ['interventions'] });
        queryClient.invalidateQueries({ queryKey: ['suivi-kilometrage'] });
      })
      .subscribe();
    channelsRef.current.push(interventionsChannel);
    tables.push('interventions_rapides');

    // Mettre à jour le statut
    setStatus({ connected: true, channels: channelsRef.current.length, tables, lastEvent: null });

    // Cleanup
    return () => {
      channelsRef.current.forEach(channel => supabase.removeChannel(channel));
      channelsRef.current = [];
      setStatus({ connected: false, channels: 0, tables: [], lastEvent: null });
    };
  }, [queryClient]);

  return status;
}

// =============================================
// COMPOSANT: Widget statut temps réel
// =============================================

export function RealtimeStatusWidget() {
  const status = useGlobalRealtime();

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-[var(--text-secondary)]">
          {status.connected ? 'Temps réel actif' : 'Déconnecté'}
        </span>
      </div>
      {status.connected && (
        <>
          <span className="text-[var(--text-muted)]">|</span>
          <span className="text-[var(--text-muted)]">{status.tables.length} tables</span>
          {status.lastEvent && (
            <>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="text-[var(--text-tertiary)]">
                {status.lastEvent.table} ({status.lastEvent.type})
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
