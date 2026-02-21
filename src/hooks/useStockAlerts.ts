import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { createNotification } from '@/services/api';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const CHECK_INTERVAL = 120000; // 2 minutes

/**
 * Hook qui surveille les événements stock et génère des notifications push :
 * - Article passant sous le seuil minimum
 * - Commande expédiée (statut → expediee)
 * - Transfert de stock validé
 */
export function useStockAlerts() {
  const queryClient = useQueryClient();
  const lastCheckRef = useRef<string[]>([]);
  const initialCheckDone = useRef(false);

  // Surveiller les articles sous le seuil
  const { data: articlesCritiques } = useQuery({
    queryKey: ['stock-alerts-critiques'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite, quantite_min')
        .not('quantite_min', 'is', null)
        .order('designation');
      if (!data) return [];
      return data.filter((a: any) => a.quantite <= a.quantite_min && a.quantite_min > 0);
    },
    refetchInterval: CHECK_INTERVAL,
    staleTime: CHECK_INTERVAL - 10000,
  });

  // Détecter les nouveaux articles critiques et créer des notifications
  useEffect(() => {
    if (!articlesCritiques || !initialCheckDone.current) {
      if (articlesCritiques) initialCheckDone.current = true;
      lastCheckRef.current = (articlesCritiques || []).map((a: any) => a.id);
      return;
    }

    const currentIds = articlesCritiques.map((a: any) => a.id);
    const newCritiques = articlesCritiques.filter((a: any) => !lastCheckRef.current.includes(a.id));

    newCritiques.forEach((article: any) => {
      const isRupture = article.quantite === 0;
      
      // Notification in-app
      createNotification({
        technicien_id: CURRENT_USER_ID,
        type: 'stock',
        priority: isRupture ? 'urgent' : 'high',
        titre: isRupture
          ? `🚨 Rupture de stock : ${article.designation}`
          : `⚠️ Stock bas : ${article.designation}`,
        message: isRupture
          ? `L'article ${article.reference || article.designation} est en rupture totale. Commandez immédiatement.`
          : `Quantité ${article.quantite} ≤ seuil min ${article.quantite_min}. Pensez à réapprovisionner.`,
        icone: isRupture ? '🚨' : '⚠️',
        lien_type: 'stock',
        lien_id: article.id,
        data: { article_id: article.id, quantite: article.quantite, seuil: article.quantite_min },
      }).catch(() => {});

      // Toast temps réel
      if (isRupture) {
        toast.error(`Rupture stock : ${article.designation}`, { duration: 5000 });
      } else {
        toast(`Stock bas : ${article.designation} (${article.quantite}/${article.quantite_min})`, {
          icon: '📦',
          duration: 4000,
        });
      }
    });

    lastCheckRef.current = currentIds;
  }, [articlesCritiques]);

  // Écouter les changements de commandes en temps réel (commande expédiée)
  useEffect(() => {
    const channel = supabase
      .channel('stock-alerts-commandes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'commandes',
      }, (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;

        // Commande passe à "expédiée"
        if (oldRow?.statut !== 'expediee' && newRow?.statut === 'expediee') {
          createNotification({
            technicien_id: CURRENT_USER_ID,
            type: 'stock',
            priority: 'normal',
            titre: `📦 Commande expédiée : ${newRow.code || 'CMD'}`,
            message: `La commande ${newRow.code} de ${newRow.fournisseur || 'fournisseur inconnu'} a été expédiée. Préparez la réception.`,
            icone: '🚚',
            lien_type: 'commande',
            lien_id: newRow.id,
          }).catch(() => {});

          toast.success(`Commande ${newRow.code} expédiée !`, { icon: '🚚', duration: 5000 });
          queryClient.invalidateQueries({ queryKey: ['commandes'] });
        }

        // Commande reçue
        if (oldRow?.statut !== 'recue' && newRow?.statut === 'recue') {
          toast.success(`Commande ${newRow.code} reçue ✅`, { duration: 3000 });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Écouter les transferts de stock validés
  useEffect(() => {
    const channel = supabase
      .channel('stock-alerts-transferts')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'stock_transferts',
      }, (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;

        if (oldRow?.statut !== 'valide' && newRow?.statut === 'valide') {
          toast.success(`Transfert stock validé`, { icon: '🔄', duration: 3000 });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { articlesCritiques: articlesCritiques || [] };
}
