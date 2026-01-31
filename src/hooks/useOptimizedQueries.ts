// src/hooks/useOptimizedQueries.ts
// Hooks centralisés et optimisés pour éviter les requêtes dupliquées

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useMemo, useCallback } from 'react';

// =============================================
// CONFIGURATION GLOBALE DU CACHE
// =============================================

export const CACHE_CONFIG = {
  // Données qui changent rarement
  STATIC: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (anciennement cacheTime)
  },
  // Données qui changent régulièrement
  DYNAMIC: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  // Données temps réel
  REALTIME: {
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute
  },
  // Données critiques (pannes, alertes)
  CRITICAL: {
    staleTime: 15 * 1000, // 15 secondes
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // 30 secondes
  },
};


// =============================================
// HOOK: PARC ASCENSEURS (Centralisé)
// =============================================

interface ParcAscenseur {
  id_wsoucont: string;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal: string;
  secteur: number;
  ordre2: number;
  type_planning: string;
  en_arret: boolean;
  date_arret: string | null;
  motif_arret: string | null;
  latitude: number | null;
  longitude: number | null;
  marque: string;
  type_machine: string;
  date_installation: string | null;
  client_nom: string;
}

export function useParcAscenseurs(options?: {
  secteur?: number;
  enArretOnly?: boolean;
  enabled?: boolean;
}) {
  const { secteur, enArretOnly, enabled = true } = options || {};

  return useQuery({
    queryKey: ['parc-ascenseurs', { secteur, enArretOnly }],
    queryFn: async () => {
      let query = supabase
        .from('parc_ascenseurs')
        .select('*')
        .order('code_appareil');

      if (secteur) {
        query = query.eq('secteur', secteur);
      }
      if (enArretOnly) {
        query = query.eq('en_arret', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ParcAscenseur[];
    },
    enabled,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

// Version légère pour les sélecteurs
export function useParcAscenseursLeger() {
  return useQuery({
    queryKey: ['parc-ascenseurs-leger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('id_wsoucont, code_appareil, adresse, ville, secteur, ordre2, type_planning')
        .not('type_planning', 'is', null)
        .order('code_appareil');

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

// Recherche avec debounce côté serveur
export function useSearchAscenseurs(search: string, enabled = true) {
  return useQuery({
    queryKey: ['search-ascenseurs', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('id_wsoucont, code_appareil, adresse, ville, secteur, ordre2, type_planning')
        .or(`code_appareil.ilike.%${search}%,adresse.ilike.%${search}%,ville.ilike.%${search}%`)
        .order('code_appareil')
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && search.length >= 2,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

// Ascenseur unique par code
export function useAscenseurByCode(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['ascenseur', codeAppareil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('*')
        .eq('code_appareil', codeAppareil)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: PANNES (Centralisé)
// =============================================

export function usePannesActives() {
  return useQuery({
    queryKey: ['pannes-actives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_pannes')
        .select(`
          *,
          ascenseur:parc_ascenseurs!code_appareil(adresse, ville, secteur)
        `)
        .is('date_fin_panne', null)
        .order('date_appel', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.CRITICAL,
  });
}

export function usePannesParAppareil(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['pannes-appareil', codeAppareil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_pannes')
        .select('*')
        .eq('code_appareil', codeAppareil)
        .order('date_appel', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: TRAVAUX (Centralisé)
// =============================================

export function useTravauxActifs() {
  return useQuery({
    queryKey: ['travaux-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travaux')
        .select(`
          *, code_appareil,
          technicien:techniciens!travaux_technicien_id_fkey(id, prenom, nom),
          client:clients(id, raison_sociale)
        `)
        .in('statut', ['planifie', 'en_cours'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useTravauxParAppareil(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['travaux-appareil', codeAppareil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travaux')
        .select(`
          *, 
          technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)
        `)
        .eq('code_appareil', codeAppareil)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useTravauxNonPlanifies() {
  return useQuery({
    queryKey: ['travaux-non-planifies'],
    queryFn: async () => {
      const [{ data: travaux }, { data: events }] = await Promise.all([
        supabase
          .from('travaux')
          .select('id, code, titre, code_appareil, priorite, statut, date_butoir, technicien_id')
          .in('statut', ['planifie', 'en_cours']),
        supabase
          .from('planning_events')
          .select('travaux_id')
          .not('travaux_id', 'is', null),
      ]);

      const planifiesIds = new Set(events?.map(e => e.travaux_id) || []);
      return (travaux || []).filter(t => !planifiesIds.has(t.id));
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: TECHNICIENS (Centralisé)
// =============================================

export function useTechniciens(actifOnly = true) {
  return useQuery({
    queryKey: ['techniciens', { actifOnly }],
    queryFn: async () => {
      let query = supabase
        .from('techniciens')
        .select('*, role:roles(*)')
        .order('nom');

      if (actifOnly) {
        query = query.eq('actif', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

export function useTechnicienById(id: string, enabled = true) {
  return useQuery({
    queryKey: ['technicien', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('techniciens')
        .select('*, role:roles(*), vehicule:vehicules(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!id,
    ...CACHE_CONFIG.STATIC,
  });
}

// Techniciens avec charge de travail
export function useTechniciensAvecCharge() {
  return useQuery({
    queryKey: ['techniciens-charge'],
    queryFn: async () => {
      const [{ data: techniciens }, { data: travaux }, { data: absences }] = await Promise.all([
        supabase.from('techniciens').select('id, prenom, nom').eq('actif', true),
        supabase.from('travaux').select('technicien_id, priorite').in('statut', ['planifie', 'en_cours']),
        supabase.from('planning_conges').select('technicien_id')
          .lte('date_debut', new Date().toISOString())
          .gte('date_fin', new Date().toISOString()),
      ]);

      const absentsIds = new Set(absences?.map(a => a.technicien_id) || []);

      return (techniciens || []).map(tech => {
        const mesTravaux = travaux?.filter(t => t.technicien_id === tech.id) || [];
        return {
          ...tech,
          travauxEnCours: mesTravaux.length,
          travauxUrgents: mesTravaux.filter(t => t.priorite === 'urgente' || t.priorite === 'haute').length,
          disponible: !absentsIds.has(tech.id),
        };
      });
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: STOCK (Centralisé)
// =============================================

export function useStockArticles() {
  return useQuery({
    queryKey: ['stock-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_articles')
        .select('*')
        .order('designation');

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useStockAlertes() {
  return useQuery({
    queryKey: ['stock-alertes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_articles')
        .select('*');

      if (error) throw error;
      
      const articles = data || [];
      return {
        ruptures: articles.filter(a => a.quantite_stock === 0),
        alertes: articles.filter(a => a.quantite_stock > 0 && a.quantite_stock <= (a.seuil_alerte || 5)),
        total: articles.filter(a => a.quantite_stock <= (a.seuil_alerte || 5)),
      };
    },
    ...CACHE_CONFIG.CRITICAL,
  });
}

export function useStockVehicule(vehiculeId: string, enabled = true) {
  return useQuery({
    queryKey: ['stock-vehicule', vehiculeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_vehicule')
        .select('*, article:stock_articles(*)')
        .eq('vehicule_id', vehiculeId);

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!vehiculeId,
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: VEHICULES (Centralisé)
// =============================================

export function useVehicules() {
  return useQuery({
    queryKey: ['vehicules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules')
        .select('*, technicien:techniciens(id, prenom, nom)')
        .order('immatriculation');

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

// Véhicules avec alertes entretien
export function useVehiculesAlertes() {
  return useQuery({
    queryKey: ['vehicules-alertes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules')
        .select('*, technicien:techniciens(id, prenom, nom)');

      if (error) throw error;

      const now = new Date();
      return (data || []).map(v => {
        const alertes: string[] = [];
        
        // Contrôle technique
        if (v.date_ct) {
          const dateCT = new Date(v.date_ct);
          const joursRestantsCT = Math.floor((dateCT.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (joursRestantsCT < 0) alertes.push('CT expiré');
          else if (joursRestantsCT < 30) alertes.push(`CT dans ${joursRestantsCT}j`);
        }

        // Entretien kilométrique
        if (v.prochain_entretien_km && v.kilometrage) {
          const kmRestants = v.prochain_entretien_km - v.kilometrage;
          if (kmRestants < 0) alertes.push('Entretien dépassé');
          else if (kmRestants < 500) alertes.push(`Entretien dans ${kmRestants}km`);
        }

        // Assurance
        if (v.date_assurance) {
          const dateAssurance = new Date(v.date_assurance);
          const joursRestantsAssurance = Math.floor((dateAssurance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (joursRestantsAssurance < 0) alertes.push('Assurance expirée');
          else if (joursRestantsAssurance < 30) alertes.push(`Assurance dans ${joursRestantsAssurance}j`);
        }

        return { ...v, alertes, hasAlertes: alertes.length > 0 };
      });
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: TOURNEES (Centralisé)
// =============================================

export function useTournees() {
  return useQuery({
    queryKey: ['tournees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournees')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

export function useTourneesParc() {
  return useQuery({
    queryKey: ['tournees-parc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('secteur, ordre2, en_arret, ville, type_planning')
        .not('ordre2', 'is', null)
        .gt('ordre2', 0)
        .not('type_planning', 'is', null);

      if (error) throw error;

      // Grouper par secteur + ordre2
      const tourneesMap: Record<string, any> = {};
      (data || []).forEach(asc => {
        const key = `${asc.secteur}-${asc.ordre2}`;
        if (!tourneesMap[key]) {
          tourneesMap[key] = {
            secteur: asc.secteur,
            ordre: asc.ordre2,
            nb_ascenseurs: 0,
            nb_en_arret: 0,
            villes: new Set(),
          };
        }
        tourneesMap[key].nb_ascenseurs++;
        if (asc.en_arret) tourneesMap[key].nb_en_arret++;
        if (asc.ville) tourneesMap[key].villes.add(asc.ville);
      });

      return Object.values(tourneesMap).map((t: any) => ({
        ...t,
        villes: Array.from(t.villes),
      }));
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: GED - DOCUMENTS (Centralisé)
// =============================================

export function useDocuments(options?: {
  type?: string;
  codeAppareil?: string;
  clientId?: string;
}) {
  const { type, codeAppareil, clientId } = options || {};

  return useQuery({
    queryKey: ['documents', { type, codeAppareil, clientId }],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (type) query = query.eq('type', type);
      if (codeAppareil) query = query.eq('code_appareil', codeAppareil);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useDocumentsParAppareil(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['documents-appareil', codeAppareil],
    queryFn: async () => {
      // Chercher par code_appareil direct
      const { data: docsDirect } = await supabase
        .from('documents')
        .select('*')
        .eq('code_appareil', codeAppareil);

      // Chercher dans le nom ou description
      const { data: docsNom } = await supabase
        .from('documents')
        .select('*')
        .or(`nom.ilike.%${codeAppareil}%,description.ilike.%${codeAppareil}%`);

      // Fusionner et dédupliquer
      const all = [...(docsDirect || []), ...(docsNom || [])];
      const unique = all.filter((doc, idx, self) => 
        idx === self.findIndex(d => d.id === doc.id)
      );

      return unique.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

// Documents avec alertes expiration
export function useDocumentsAlertes() {
  return useQuery({
    queryKey: ['documents-alertes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .not('date_expiration', 'is', null)
        .order('date_expiration');

      if (error) throw error;

      const now = new Date();
      const docs = (data || []).map(doc => {
        const dateExp = new Date(doc.date_expiration);
        const joursRestants = Math.floor((dateExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...doc,
          joursRestants,
          expire: joursRestants < 0,
          alerteProche: joursRestants >= 0 && joursRestants <= 30,
        };
      });

      return {
        expires: docs.filter(d => d.expire),
        proches: docs.filter(d => d.alerteProche),
        all: docs,
      };
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: NOTES (Centralisé)
// =============================================

export function useNotes(options?: {
  partageOnly?: boolean;
  technicienId?: string;
  codeAppareil?: string;
}) {
  const { partageOnly, technicienId, codeAppareil } = options || {};

  return useQuery({
    queryKey: ['notes', { partageOnly, technicienId, codeAppareil }],
    queryFn: async () => {
      let query = supabase
        .from('notes')
        .select('*, technicien:techniciens(prenom, nom)')
        .order('created_at', { ascending: false });

      if (partageOnly) query = query.eq('partage', true);
      if (technicienId) query = query.eq('technicien_id', technicienId);
      if (codeAppareil) {
        query = query.or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%,titre.ilike.%${codeAppareil}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useNotesParAppareil(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['notes-appareil', codeAppareil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, technicien:techniciens(prenom, nom)')
        .eq('partage', true)
        .or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%,titre.ilike.%${codeAppareil}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: COMMANDES (Centralisé)
// =============================================

export function useCommandes(options?: {
  statut?: string;
  fournisseurId?: string;
}) {
  const { statut, fournisseurId } = options || {};

  return useQuery({
    queryKey: ['commandes', { statut, fournisseurId }],
    queryFn: async () => {
      let query = supabase
        .from('commandes')
        .select('*, fournisseur:fournisseurs(nom)')
        .order('created_at', { ascending: false });

      if (statut) query = query.eq('statut', statut);
      if (fournisseurId) query = query.eq('fournisseur_id', fournisseurId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useCommandesEnCours() {
  return useQuery({
    queryKey: ['commandes-en-cours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, fournisseur:fournisseurs(nom), lignes')
        .in('statut', ['en_attente', 'commandee', 'en_transit'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}


// =============================================
// HOOK: PLANNING (Centralisé)
// =============================================

export function usePlanningEvents(dateDebut: string, dateFin: string) {
  return useQuery({
    queryKey: ['planning-events', dateDebut, dateFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_events')
        .select(`
          *,
          technicien:techniciens(id, prenom, nom),
          travaux:travaux(id, code, titre, code_appareil)
        `)
        .gte('date_debut', dateDebut)
        .lte('date_fin', dateFin)
        .order('date_debut');

      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

export function useAstreinteActuelle() {
  return useQuery({
    queryKey: ['astreinte-actuelle'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('planning_astreintes')
        .select('*, technicien:techniciens(id, prenom, nom, telephone)')
        .lte('date_debut', now)
        .gte('date_fin', now)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    ...CACHE_CONFIG.REALTIME,
  });
}


// =============================================
// HOOK: STATISTIQUES GLOBALES (Centralisé)
// =============================================

export function useStatsGlobales() {
  return useQuery({
    queryKey: ['stats-globales'],
    queryFn: async () => {
      const [
        { data: ascenseurs },
        { data: pannes },
        { data: travaux },
        { data: mes },
        { data: stock },
      ] = await Promise.all([
        supabase.from('parc_ascenseurs').select('en_arret').eq('en_arret', true),
        supabase.from('parc_pannes').select('id').is('date_fin_panne', null),
        supabase.from('travaux').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('mise_en_service').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('stock_articles').select('quantite_stock, seuil_alerte'),
      ]);

      const stockAlertes = (stock || []).filter(
        (a: any) => a.quantite_stock <= (a.seuil_alerte || 5)
      ).length;

      return {
        ascenseursEnArret: ascenseurs?.length || 0,
        pannesActives: pannes?.length || 0,
        travauxEnCours: travaux?.length || 0,
        mesEnCours: mes?.length || 0,
        stockAlertes,
      };
    },
    ...CACHE_CONFIG.REALTIME,
  });
}


// =============================================
// HOOK: PREFETCH INTELLIGENT
// =============================================

export function usePrefetchOnHover() {
  const queryClient = useQueryClient();

  const prefetchAscenseur = useCallback((codeAppareil: string) => {
    // Prefetch pannes
    queryClient.prefetchQuery({
      queryKey: ['pannes-appareil', codeAppareil],
      queryFn: async () => {
        const { data } = await supabase
          .from('parc_pannes')
          .select('*')
          .eq('code_appareil', codeAppareil)
          .order('date_appel', { ascending: false });
        return data || [];
      },
      ...CACHE_CONFIG.DYNAMIC,
    });

    // Prefetch travaux
    queryClient.prefetchQuery({
      queryKey: ['travaux-appareil', codeAppareil],
      queryFn: async () => {
        const { data } = await supabase
          .from('travaux')
          .select('*')
          .eq('code_appareil', codeAppareil);
        return data || [];
      },
      ...CACHE_CONFIG.DYNAMIC,
    });

    // Prefetch documents
    queryClient.prefetchQuery({
      queryKey: ['documents-appareil', codeAppareil],
      queryFn: async () => {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .eq('code_appareil', codeAppareil);
        return data || [];
      },
      ...CACHE_CONFIG.DYNAMIC,
    });

    // Prefetch notes
    queryClient.prefetchQuery({
      queryKey: ['notes-appareil', codeAppareil],
      queryFn: async () => {
        const { data } = await supabase
          .from('notes')
          .select('*')
          .eq('partage', true)
          .or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%`);
        return data || [];
      },
      ...CACHE_CONFIG.DYNAMIC,
    });
  }, [queryClient]);

  return { prefetchAscenseur };
}


// =============================================
// UTILITAIRES
// =============================================

// Hook pour invalider plusieurs caches en une fois
export function useInvalidateRelated() {
  const queryClient = useQueryClient();

  return {
    invalidateTravaux: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['travaux-actifs'] });
      queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] });
      queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
    }, [queryClient]),
    
    invalidateStock: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
    }, [queryClient]),
    
    invalidatePannes: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['pannes'] });
      queryClient.invalidateQueries({ queryKey: ['pannes-actives'] });
      queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
    }, [queryClient]),
    
    invalidatePlanning: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['planning-events'] });
    }, [queryClient]),

    invalidateDocuments: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents-alertes'] });
    }, [queryClient]),

    invalidateNotes: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }, [queryClient]),

    invalidateAll: useCallback(() => {
      queryClient.invalidateQueries();
    }, [queryClient]),
  };
}

