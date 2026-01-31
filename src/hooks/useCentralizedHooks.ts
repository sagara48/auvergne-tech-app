// src/hooks/useCentralizedHooks.ts
// Hooks centralisés et optimisés pour Auvergne Tech
// Évite les requêtes dupliquées et optimise le cache

import { useQuery, useQueryClient, useMutation, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useMemo, useCallback, useState, useEffect } from 'react';
import { differenceInDays, parseISO, subMonths, addDays } from 'date-fns';

// =============================================
// CONFIGURATION CACHE
// =============================================

export const CACHE_CONFIG = {
  STATIC: { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  DYNAMIC: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  REALTIME: { staleTime: 30 * 1000, gcTime: 5 * 60 * 1000, refetchInterval: 60 * 1000 },
  CRITICAL: { staleTime: 15 * 1000, gcTime: 2 * 60 * 1000, refetchInterval: 30 * 1000 },
};

// =============================================
// TYPES
// =============================================

export interface ParcAscenseur {
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

export interface Travaux {
  id: string;
  code: string;
  titre: string;
  description: string;
  code_appareil: string;
  priorite: string;
  statut: string;
  progression: number;
  date_butoir: string | null;
  technicien_id: string | null;
  pieces: any[];
}

export interface Document {
  id: string;
  nom: string;
  description: string;
  type: string;
  categorie: string;
  fichier_url: string;
  taille: number;
  code_appareil: string | null;
  date_expiration: string | null;
  created_at: string;
  technicien_id: string | null;
}

export interface Note {
  id: string;
  titre: string;
  contenu: string;
  code_ascenseur: string | null;
  travaux_id: string | null;
  partage: boolean;
  important: boolean;
  created_at: string;
  technicien_id: string | null;
}

export interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  kilometrage: number;
  date_prochain_ct: string | null;
  prochain_entretien_km: number | null;
  technicien_id: string | null;
}

export interface AlerteEntretien {
  id: string;
  type: 'vehicule' | 'ascenseur';
  code: string;
  nom: string;
  typeAlerte: 'ct' | 'vidange' | 'visite' | 'controle';
  dateEcheance?: string;
  kmRestant?: number;
  urgence: 'critique' | 'haute' | 'moyenne' | 'basse';
  details?: string;
}

// =============================================
// HOOK: PARC ASCENSEURS
// =============================================

export function useParcAscenseurs(options?: {
  secteur?: number;
  enArretOnly?: boolean;
  enabled?: boolean;
}) {
  const { secteur, enArretOnly, enabled = true } = options || {};

  return useQuery({
    queryKey: ['parc-ascenseurs', { secteur, enArretOnly }],
    queryFn: async () => {
      let query = supabase.from('parc_ascenseurs').select('*').order('code_appareil');
      if (secteur) query = query.eq('secteur', secteur);
      if (enArretOnly) query = query.eq('en_arret', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ParcAscenseur[];
    },
    enabled,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

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

export function useSearchAscenseurs(search: string, enabled = true) {
  return useQuery({
    queryKey: ['search-ascenseurs', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('id_wsoucont, code_appareil, adresse, ville, secteur, ordre2')
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

export function useAscenseurByCode(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['ascenseur', codeAppareil],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('*')
        .eq('code_appareil', codeAppareil)
        .single();
      if (error) throw error;
      return data as ParcAscenseur;
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

// =============================================
// HOOK: PANNES
// =============================================

export function usePannesActives() {
  return useQuery({
    queryKey: ['pannes-actives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_pannes')
        .select('*, ascenseur:parc_ascenseurs!code_appareil(adresse, ville, secteur)')
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
// HOOK: TRAVAUX
// =============================================

export function useTravauxActifs() {
  return useQuery({
    queryKey: ['travaux-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travaux')
        .select(`*, technicien:techniciens!travaux_technicien_id_fkey(id, prenom, nom)`)
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
        .select(`*, technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)`)
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
        supabase.from('travaux').select('*').in('statut', ['planifie', 'en_cours']),
        supabase.from('planning_events').select('travaux_id').not('travaux_id', 'is', null),
      ]);
      const planifiesIds = new Set(events?.map(e => e.travaux_id) || []);
      return (travaux || []).filter(t => !planifiesIds.has(t.id));
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

// =============================================
// HOOK: DOCUMENTS GED
// =============================================

export function useDocuments(options?: {
  codeAppareil?: string;
  categorie?: string;
  limit?: number;
}) {
  const { codeAppareil, categorie, limit = 100 } = options || {};

  return useQuery({
    queryKey: ['documents', { codeAppareil, categorie }],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (codeAppareil) {
        query = query.eq('code_appareil', codeAppareil);
      }
      if (categorie) {
        query = query.eq('categorie', categorie);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Document[];
    },
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useDocumentsAscenseur(codeAppareil: string, enabled = true) {
  return useQuery({
    queryKey: ['documents-ascenseur', codeAppareil],
    queryFn: async () => {
      // Documents liés directement
      const { data: docsDirect } = await supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .eq('code_appareil', codeAppareil)
        .order('created_at', { ascending: false });

      // Documents mentionnant le code
      const { data: docsIndirect } = await supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .or(`nom.ilike.%${codeAppareil}%,description.ilike.%${codeAppareil}%`)
        .order('created_at', { ascending: false });

      // Fusionner et dédupliquer
      const allDocs = [...(docsDirect || []), ...(docsIndirect || [])];
      return allDocs.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
      ) as Document[];
    },
    enabled: enabled && !!codeAppareil,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useDocumentsExpiration() {
  return useQuery({
    queryKey: ['documents-expiration'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in30Days = addDays(new Date(), 30).toISOString();

      const [{ data: expired }, { data: expiring }] = await Promise.all([
        supabase.from('documents').select('*').lt('date_expiration', now),
        supabase.from('documents').select('*').gte('date_expiration', now).lte('date_expiration', in30Days),
      ]);

      return {
        expired: expired || [],
        expiring: expiring || [],
        total: (expired?.length || 0) + (expiring?.length || 0),
      };
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

// =============================================
// HOOK: NOTES
// =============================================

export function useNotes(options?: {
  codeAppareil?: string;
  travauxId?: string;
  partageOnly?: boolean;
  limit?: number;
}) {
  const { codeAppareil, travauxId, partageOnly = true, limit = 50 } = options || {};

  return useQuery({
    queryKey: ['notes', { codeAppareil, travauxId, partageOnly }],
    queryFn: async () => {
      let allNotes: any[] = [];

      if (codeAppareil) {
        const { data } = await supabase
          .from('notes')
          .select('*, technicien:technicien_id(prenom, nom)')
          .eq('partage', partageOnly)
          .or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%,titre.ilike.%${codeAppareil}%`)
          .order('created_at', { ascending: false })
          .limit(limit);
        allNotes = [...allNotes, ...(data || [])];
      }

      if (travauxId) {
        const { data } = await supabase
          .from('notes')
          .select('*, technicien:technicien_id(prenom, nom)')
          .eq('travaux_id', travauxId)
          .order('created_at', { ascending: false });
        allNotes = [...allNotes, ...(data || [])];
      }

      // Dédupliquer
      return allNotes.filter((note, index, self) =>
        index === self.findIndex(n => n.id === note.id)
      ).slice(0, limit) as Note[];
    },
    enabled: !!codeAppareil || !!travauxId,
    ...CACHE_CONFIG.DYNAMIC,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note: Partial<Note>) => {
      const { data, error } = await supabase.from('notes').insert(note).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// =============================================
// HOOK: VEHICULES
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
      return (data || []) as Vehicule[];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

export function useVehiculeAlertes() {
  return useQuery({
    queryKey: ['vehicule-alertes'],
    queryFn: async () => {
      const { data: vehicules } = await supabase
        .from('vehicules')
        .select('*, technicien:techniciens(prenom, nom)');

      const alertes: AlerteEntretien[] = [];

      vehicules?.forEach(v => {
        // CT
        if (v.date_prochain_ct) {
          const jours = differenceInDays(parseISO(v.date_prochain_ct), new Date());
          if (jours <= 60) {
            alertes.push({
              id: `ct-${v.id}`,
              type: 'vehicule',
              code: v.immatriculation,
              nom: `${v.marque} ${v.modele}`,
              typeAlerte: 'ct',
              dateEcheance: v.date_prochain_ct,
              urgence: jours <= 0 ? 'critique' : jours <= 15 ? 'haute' : jours <= 30 ? 'moyenne' : 'basse',
              details: v.technicien ? `${v.technicien.prenom} ${v.technicien.nom}` : undefined,
            });
          }
        }
        // Vidange
        if (v.prochain_entretien_km && v.kilometrage) {
          const km = v.prochain_entretien_km - v.kilometrage;
          if (km <= 1000) {
            alertes.push({
              id: `vidange-${v.id}`,
              type: 'vehicule',
              code: v.immatriculation,
              nom: `${v.marque} ${v.modele}`,
              typeAlerte: 'vidange',
              kmRestant: km,
              urgence: km <= 0 ? 'critique' : km <= 200 ? 'haute' : km <= 500 ? 'moyenne' : 'basse',
              details: `${v.kilometrage?.toLocaleString()} km`,
            });
          }
        }
      });

      return alertes;
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

// =============================================
// HOOK: ALERTES ENTRETIEN (Combiné)
// =============================================

export function useAlertesEntretien() {
  return useQuery({
    queryKey: ['alertes-entretien'],
    queryFn: async () => {
      const alertes: AlerteEntretien[] = [];

      // Véhicules
      const { data: vehicules } = await supabase
        .from('vehicules')
        .select('*, technicien:techniciens(prenom, nom)');

      vehicules?.forEach(v => {
        if (v.date_prochain_ct) {
          const jours = differenceInDays(parseISO(v.date_prochain_ct), new Date());
          if (jours <= 60) {
            alertes.push({
              id: `ct-${v.id}`, type: 'vehicule', code: v.immatriculation,
              nom: `${v.marque} ${v.modele}`, typeAlerte: 'ct',
              dateEcheance: v.date_prochain_ct,
              urgence: jours <= 0 ? 'critique' : jours <= 15 ? 'haute' : jours <= 30 ? 'moyenne' : 'basse',
            });
          }
        }
        if (v.prochain_entretien_km && v.kilometrage) {
          const km = v.prochain_entretien_km - v.kilometrage;
          if (km <= 1000) {
            alertes.push({
              id: `vidange-${v.id}`, type: 'vehicule', code: v.immatriculation,
              nom: `${v.marque} ${v.modele}`, typeAlerte: 'vidange',
              kmRestant: km,
              urgence: km <= 0 ? 'critique' : km <= 200 ? 'haute' : km <= 500 ? 'moyenne' : 'basse',
            });
          }
        }
      });

      // Ascenseurs - visites en retard
      const { data: visites } = await supabase
        .from('parc_visites')
        .select('code_appareil, date_visite')
        .order('date_visite', { ascending: false });

      const dernieres = new Map<string, string>();
      visites?.forEach(v => {
        if (!dernieres.has(v.code_appareil)) dernieres.set(v.code_appareil, v.date_visite);
      });

      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville')
        .not('type_planning', 'is', null);

      ascenseurs?.forEach(asc => {
        const derniere = dernieres.get(asc.code_appareil);
        if (derniere) {
          const jours = differenceInDays(new Date(), parseISO(derniere));
          if (jours >= 45) {
            alertes.push({
              id: `visite-${asc.code_appareil}`, type: 'ascenseur',
              code: asc.code_appareil, nom: `${asc.adresse}, ${asc.ville}`,
              typeAlerte: 'visite', dateEcheance: derniere,
              urgence: jours >= 90 ? 'critique' : jours >= 60 ? 'haute' : 'moyenne',
            });
          }
        }
      });

      const order = { critique: 0, haute: 1, moyenne: 2, basse: 3 };
      return alertes.sort((a, b) => order[a.urgence] - order[b.urgence]);
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

// =============================================
// HOOK: STOCK & APPROVISIONNEMENT
// =============================================

export function useStockArticles() {
  return useQuery({
    queryKey: ['stock-articles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_articles').select('*').order('designation');
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
      const { data } = await supabase.from('stock_articles').select('*');
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

export function useChaineApprovisionnement() {
  return useQuery({
    queryKey: ['chaine-approvisionnement'],
    queryFn: async () => {
      const [{ data: articles }, { data: travaux }, { data: commandes }] = await Promise.all([
        supabase.from('stock_articles').select('*'),
        supabase.from('travaux').select('id, code, titre, code_appareil, pieces, statut')
          .in('statut', ['planifie', 'en_cours']).not('pieces', 'is', null),
        supabase.from('commandes').select('*, fournisseur:fournisseurs(nom)')
          .in('statut', ['en_attente', 'commandee', 'en_transit']),
      ]);

      const ruptures = articles?.filter(a => a.quantite_stock === 0) || [];
      const alertes = articles?.filter(a => a.quantite_stock > 0 && a.quantite_stock <= (a.seuil_alerte || 5)) || [];

      // Travaux bloqués par manque de stock
      const travauxBloques = travaux?.filter(t => {
        const pieces = t.pieces as any[];
        return pieces?.some(p => {
          const art = articles?.find(a => a.id === p.article_id);
          return art && art.quantite_stock < (p.quantite || 1);
        });
      }) || [];

      return {
        articles: articles || [],
        ruptures,
        alertes,
        travauxBloques,
        commandes: commandes || [],
        stats: {
          totalArticles: articles?.length || 0,
          ruptures: ruptures.length,
          alertes: alertes.length,
          travauxBloques: travauxBloques.length,
          commandesEnCours: commandes?.length || 0,
        },
      };
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

// =============================================
// HOOK: TECHNICIENS
// =============================================

export function useTechniciens(actifOnly = true) {
  return useQuery({
    queryKey: ['techniciens', { actifOnly }],
    queryFn: async () => {
      let query = supabase.from('techniciens').select('*').order('nom');
      if (actifOnly) query = query.eq('actif', true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...CACHE_CONFIG.STATIC,
  });
}

// =============================================
// HOOK: STATISTIQUES GLOBALES
// =============================================

export function useStatsGlobales() {
  return useQuery({
    queryKey: ['stats-globales'],
    queryFn: async () => {
      const [
        { data: arrets }, { data: pannes }, { data: travaux },
        { data: mes }, { data: stock },
      ] = await Promise.all([
        supabase.from('parc_ascenseurs').select('id').eq('en_arret', true),
        supabase.from('parc_pannes').select('id').is('date_fin_panne', null),
        supabase.from('travaux').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('mise_en_service').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('stock_articles').select('quantite_stock, seuil_alerte'),
      ]);

      return {
        ascenseursEnArret: arrets?.length || 0,
        pannesActives: pannes?.length || 0,
        travauxEnCours: travaux?.length || 0,
        mesEnCours: mes?.length || 0,
        stockAlertes: (stock || []).filter(a => a.quantite_stock <= (a.seuil_alerte || 5)).length,
      };
    },
    ...CACHE_CONFIG.REALTIME,
  });
}

// =============================================
// HOOK: INVALIDATION
// =============================================

export function useInvalidateAll() {
  const queryClient = useQueryClient();

  return {
    invalidateTravaux: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['travaux-actifs'] });
      queryClient.invalidateQueries({ queryKey: ['stats-globales'] });
    }, [queryClient]),

    invalidateStock: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['chaine-approvisionnement'] });
    }, [queryClient]),

    invalidatePannes: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['pannes'] });
      queryClient.invalidateQueries({ queryKey: ['pannes-actives'] });
    }, [queryClient]),

    invalidateDocuments: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }, [queryClient]),

    invalidateNotes: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }, [queryClient]),

    invalidateAll: useCallback(() => {
      queryClient.invalidateQueries();
    }, [queryClient]),
  };
}

// =============================================
// HOOK: PREFETCH
// =============================================

export function usePrefetch() {
  const queryClient = useQueryClient();

  return {
    prefetchAscenseur: useCallback((codeAppareil: string) => {
      queryClient.prefetchQuery({
        queryKey: ['pannes-appareil', codeAppareil],
        queryFn: async () => {
          const { data } = await supabase.from('parc_pannes').select('*')
            .eq('code_appareil', codeAppareil).order('date_appel', { ascending: false });
          return data || [];
        },
      });
      queryClient.prefetchQuery({
        queryKey: ['travaux-appareil', codeAppareil],
        queryFn: async () => {
          const { data } = await supabase.from('travaux').select('*').eq('code_appareil', codeAppareil);
          return data || [];
        },
      });
      queryClient.prefetchQuery({
        queryKey: ['documents-ascenseur', codeAppareil],
        queryFn: async () => {
          const { data } = await supabase.from('documents').select('*').eq('code_appareil', codeAppareil);
          return data || [];
        },
      });
    }, [queryClient]),
  };
}
