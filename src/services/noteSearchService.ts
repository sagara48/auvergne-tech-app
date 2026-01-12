/**
 * Service de Recherche Avancée pour les Notes
 * Recherche full-text, filtres combinés, suggestions
 */

import { supabase } from './supabase';
import type { Note } from '@/types';

// =============================================
// TYPES
// =============================================

export interface SearchFilters {
  query?: string;
  categorie?: string;
  priorite?: string;
  statut?: string;
  dossierId?: string;
  technicienId?: string;
  ascenseurId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasEcheance?: boolean;
  echeanceDepassee?: boolean;
  echeanceProche?: boolean; // Dans les 7 jours
  hasChecklist?: boolean;
  hasTags?: boolean;
  tags?: string[];
  epingle?: boolean;
  partage?: boolean;
  searchIn?: ('titre' | 'contenu' | 'tags' | 'commentaires' | 'checklist')[];
}

export interface SearchResult {
  note: Note;
  score: number;
  highlights: {
    titre?: string;
    contenu?: string;
    tags?: string[];
  };
  matchedIn: string[];
}

export interface SearchSuggestion {
  type: 'note' | 'tag' | 'ascenseur' | 'recent';
  value: string;
  label: string;
  noteId?: string;
}

// =============================================
// CONFIGURATION
// =============================================

const SEARCH_CONFIG = {
  minQueryLength: 2,
  maxResults: 100,
  weights: {
    titreExact: 100,
    titrePartiel: 50,
    contenu: 20,
    tags: 30,
    commentaires: 10,
    checklist: 15,
  },
  recentSearchesKey: 'notes_recent_searches',
  maxRecentSearches: 10,
};

// =============================================
// UTILITAIRES
// =============================================

/**
 * Normaliser le texte pour la recherche
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Garder que lettres et chiffres
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extraire un extrait avec le terme surligné
 */
function extractHighlight(text: string, query: string, contextLength: number = 50): string {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);
  
  if (index === -1) return text.substring(0, contextLength * 2) + '...';
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + query.length + contextLength);
  
  let extract = text.substring(start, end);
  if (start > 0) extract = '...' + extract;
  if (end < text.length) extract = extract + '...';
  
  return extract;
}

/**
 * Calculer le score de pertinence
 */
function calculateScore(note: Note, query: string, searchIn: string[]): { score: number; matchedIn: string[] } {
  if (!query) return { score: 0, matchedIn: [] };
  
  const normalizedQuery = normalizeText(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);
  
  let score = 0;
  const matchedIn: string[] = [];
  
  // Recherche dans le titre
  if (searchIn.includes('titre') && note.titre) {
    const normalizedTitre = normalizeText(note.titre);
    
    // Match exact du titre complet
    if (normalizedTitre === normalizedQuery) {
      score += SEARCH_CONFIG.weights.titreExact;
      matchedIn.push('titre');
    } 
    // Match partiel
    else if (normalizedTitre.includes(normalizedQuery)) {
      score += SEARCH_CONFIG.weights.titrePartiel;
      matchedIn.push('titre');
    }
    // Match par mots
    else {
      const matchingWords = queryWords.filter(w => normalizedTitre.includes(w));
      if (matchingWords.length > 0) {
        score += (matchingWords.length / queryWords.length) * SEARCH_CONFIG.weights.titrePartiel;
        matchedIn.push('titre');
      }
    }
  }
  
  // Recherche dans le contenu
  if (searchIn.includes('contenu') && note.contenu) {
    const normalizedContenu = normalizeText(note.contenu);
    
    if (normalizedContenu.includes(normalizedQuery)) {
      score += SEARCH_CONFIG.weights.contenu;
      matchedIn.push('contenu');
    } else {
      const matchingWords = queryWords.filter(w => normalizedContenu.includes(w));
      if (matchingWords.length > 0) {
        score += (matchingWords.length / queryWords.length) * SEARCH_CONFIG.weights.contenu;
        matchedIn.push('contenu');
      }
    }
  }
  
  // Recherche dans les tags
  if (searchIn.includes('tags') && note.tags && note.tags.length > 0) {
    const normalizedTags = note.tags.map(t => normalizeText(t));
    const matchingTags = normalizedTags.filter(t => 
      t.includes(normalizedQuery) || queryWords.some(w => t.includes(w))
    );
    if (matchingTags.length > 0) {
      score += matchingTags.length * SEARCH_CONFIG.weights.tags;
      matchedIn.push('tags');
    }
  }
  
  // Recherche dans la checklist
  if (searchIn.includes('checklist') && note.checklist && note.checklist.length > 0) {
    const checklistText = normalizeText(note.checklist.map((i: any) => i.texte).join(' '));
    if (checklistText.includes(normalizedQuery) || queryWords.some(w => checklistText.includes(w))) {
      score += SEARCH_CONFIG.weights.checklist;
      matchedIn.push('checklist');
    }
  }
  
  return { score, matchedIn };
}

// =============================================
// RECHERCHE PRINCIPALE
// =============================================

/**
 * Recherche avancée dans les notes
 */
export async function searchNotes(
  technicienId: string,
  filters: SearchFilters
): Promise<SearchResult[]> {
  try {
    // Construire la requête de base
    let query = supabase
      .from('notes')
      .select(`
        *,
        technicien:techniciens(id, nom, prenom, avatar_initiales),
        ascenseur:ascenseurs(id, code_appareil, adresse, ville),
        dossier:notes_dossiers(id, nom, couleur)
      `)
      .or(`technicien_id.eq.${technicienId},partage.eq.true`);
    
    // Filtres de base
    if (filters.categorie && filters.categorie !== 'all') {
      query = query.eq('categorie', filters.categorie);
    }
    if (filters.priorite && filters.priorite !== 'all') {
      query = query.eq('priorite', filters.priorite);
    }
    if (filters.statut && filters.statut !== 'all') {
      query = query.eq('statut', filters.statut);
    }
    if (filters.dossierId) {
      if (filters.dossierId === 'sans-dossier') {
        query = query.is('dossier_id', null);
      } else {
        query = query.eq('dossier_id', filters.dossierId);
      }
    }
    if (filters.ascenseurId) {
      query = query.eq('ascenseur_id', filters.ascenseurId);
    }
    if (filters.epingle !== undefined) {
      query = query.eq('epingle', filters.epingle);
    }
    if (filters.partage !== undefined) {
      query = query.eq('partage', filters.partage);
    }
    
    // Filtres de date
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }
    
    // Filtres d'échéance
    const now = new Date().toISOString();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    if (filters.hasEcheance) {
      query = query.not('echeance_date', 'is', null);
    }
    if (filters.echeanceDepassee) {
      query = query.lt('echeance_date', now).not('echeance_date', 'is', null);
    }
    if (filters.echeanceProche) {
      query = query.gte('echeance_date', now).lte('echeance_date', in7Days);
    }
    
    // Exécuter la requête
    const { data: notes, error } = await query.order('updated_at', { ascending: false });
    
    if (error) throw error;
    if (!notes) return [];
    
    // Filtres côté client (recherche texte, tags, checklist)
    let results: SearchResult[] = [];
    const searchIn = filters.searchIn || ['titre', 'contenu', 'tags', 'checklist'];
    
    for (const note of notes) {
      // Filtre tags
      if (filters.hasTags && (!note.tags || note.tags.length === 0)) continue;
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(t => 
          (note.tags || []).some((nt: string) => normalizeText(nt) === normalizeText(t))
        );
        if (!hasAllTags) continue;
      }
      
      // Filtre checklist
      if (filters.hasChecklist && (!note.checklist || note.checklist.length === 0)) continue;
      
      // Calcul du score de recherche
      const { score, matchedIn } = calculateScore(note, filters.query || '', searchIn);
      
      // Si une requête est spécifiée mais aucun match, ignorer
      if (filters.query && filters.query.length >= SEARCH_CONFIG.minQueryLength && score === 0) {
        continue;
      }
      
      // Construire les highlights
      const highlights: SearchResult['highlights'] = {};
      if (filters.query && matchedIn.includes('titre')) {
        highlights.titre = note.titre;
      }
      if (filters.query && matchedIn.includes('contenu') && note.contenu) {
        highlights.contenu = extractHighlight(note.contenu, filters.query);
      }
      if (filters.query && matchedIn.includes('tags') && note.tags) {
        highlights.tags = note.tags.filter((t: string) => 
          normalizeText(t).includes(normalizeText(filters.query!))
        );
      }
      
      results.push({
        note,
        score: filters.query ? score : 1,
        highlights,
        matchedIn,
      });
    }
    
    // Trier par score puis par date
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.note.updated_at).getTime() - new Date(a.note.updated_at).getTime();
    });
    
    // Épinglées en premier si pas de recherche
    if (!filters.query) {
      results = [
        ...results.filter(r => r.note.epingle),
        ...results.filter(r => !r.note.epingle),
      ];
    }
    
    return results.slice(0, SEARCH_CONFIG.maxResults);
  } catch (error) {
    console.error('Erreur recherche notes:', error);
    return [];
  }
}

// =============================================
// SUGGESTIONS
// =============================================

/**
 * Obtenir des suggestions de recherche
 */
export async function getSearchSuggestions(
  query: string,
  technicienId: string
): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return [];
  
  const suggestions: SearchSuggestion[] = [];
  const normalizedQuery = normalizeText(query);
  
  try {
    // Rechercher dans les titres de notes
    const { data: notes } = await supabase
      .from('notes')
      .select('id, titre')
      .or(`technicien_id.eq.${technicienId},partage.eq.true`)
      .ilike('titre', `%${query}%`)
      .limit(5);
    
    if (notes) {
      notes.forEach(n => {
        suggestions.push({
          type: 'note',
          value: n.titre,
          label: n.titre,
          noteId: n.id,
        });
      });
    }
    
    // Rechercher dans les tags uniques
    const { data: allNotes } = await supabase
      .from('notes')
      .select('tags')
      .or(`technicien_id.eq.${technicienId},partage.eq.true`)
      .not('tags', 'is', null);
    
    if (allNotes) {
      const allTags = new Set<string>();
      allNotes.forEach(n => {
        (n.tags || []).forEach((t: string) => allTags.add(t));
      });
      
      Array.from(allTags)
        .filter(t => normalizeText(t).includes(normalizedQuery))
        .slice(0, 5)
        .forEach(t => {
          suggestions.push({
            type: 'tag',
            value: t,
            label: `#${t}`,
          });
        });
    }
    
    // Ajouter les recherches récentes
    const recentSearches = getRecentSearches();
    recentSearches
      .filter(s => normalizeText(s).includes(normalizedQuery))
      .slice(0, 3)
      .forEach(s => {
        suggestions.push({
          type: 'recent',
          value: s,
          label: s,
        });
      });
    
  } catch (error) {
    console.error('Erreur suggestions:', error);
  }
  
  return suggestions;
}

// =============================================
// RECHERCHES RÉCENTES
// =============================================

/**
 * Sauvegarder une recherche récente
 */
export function saveRecentSearch(query: string): void {
  if (!query || query.length < SEARCH_CONFIG.minQueryLength) return;
  
  const recent = getRecentSearches();
  const filtered = recent.filter(s => s.toLowerCase() !== query.toLowerCase());
  const updated = [query, ...filtered].slice(0, SEARCH_CONFIG.maxRecentSearches);
  
  localStorage.setItem(SEARCH_CONFIG.recentSearchesKey, JSON.stringify(updated));
}

/**
 * Obtenir les recherches récentes
 */
export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_CONFIG.recentSearchesKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Effacer les recherches récentes
 */
export function clearRecentSearches(): void {
  localStorage.removeItem(SEARCH_CONFIG.recentSearchesKey);
}

// =============================================
// STATISTIQUES
// =============================================

/**
 * Obtenir les statistiques des notes
 */
export async function getNotesStats(technicienId: string): Promise<{
  total: number;
  parCategorie: Record<string, number>;
  parStatut: Record<string, number>;
  parPriorite: Record<string, number>;
  echeancesProches: number;
  echeancesDepassees: number;
  avecChecklist: number;
  checklistProgress: number;
  tagsPopulaires: Array<{ tag: string; count: number }>;
}> {
  try {
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .or(`technicien_id.eq.${technicienId},partage.eq.true`);
    
    if (!notes) {
      return {
        total: 0,
        parCategorie: {},
        parStatut: {},
        parPriorite: {},
        echeancesProches: 0,
        echeancesDepassees: 0,
        avecChecklist: 0,
        checklistProgress: 0,
        tagsPopulaires: [],
      };
    }
    
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const parCategorie: Record<string, number> = {};
    const parStatut: Record<string, number> = {};
    const parPriorite: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let echeancesProches = 0;
    let echeancesDepassees = 0;
    let avecChecklist = 0;
    let totalChecklistItems = 0;
    let completedChecklistItems = 0;
    
    notes.forEach(note => {
      // Par catégorie
      parCategorie[note.categorie] = (parCategorie[note.categorie] || 0) + 1;
      
      // Par statut
      parStatut[note.statut] = (parStatut[note.statut] || 0) + 1;
      
      // Par priorité
      parPriorite[note.priorite] = (parPriorite[note.priorite] || 0) + 1;
      
      // Échéances
      if (note.echeance_date) {
        const echeance = new Date(note.echeance_date);
        if (echeance < now) echeancesDepassees++;
        else if (echeance <= in7Days) echeancesProches++;
      }
      
      // Checklist
      if (note.checklist && note.checklist.length > 0) {
        avecChecklist++;
        totalChecklistItems += note.checklist.length;
        completedChecklistItems += note.checklist.filter((i: any) => i.fait).length;
      }
      
      // Tags
      (note.tags || []).forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const tagsPopulaires = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      total: notes.length,
      parCategorie,
      parStatut,
      parPriorite,
      echeancesProches,
      echeancesDepassees,
      avecChecklist,
      checklistProgress: totalChecklistItems > 0 
        ? Math.round((completedChecklistItems / totalChecklistItems) * 100) 
        : 0,
      tagsPopulaires,
    };
  } catch (error) {
    console.error('Erreur stats notes:', error);
    return {
      total: 0,
      parCategorie: {},
      parStatut: {},
      parPriorite: {},
      echeancesProches: 0,
      echeancesDepassees: 0,
      avecChecklist: 0,
      checklistProgress: 0,
      tagsPopulaires: [],
    };
  }
}
