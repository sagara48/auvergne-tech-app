import { supabase } from './supabase';

// Types pour la GED
export interface GEDDocument {
  id: string;
  nom: string;
  type: string;
  taille: number;
  url: string;
  categorie?: string;
  tags?: string[];
  contenu_texte?: string;  // Texte extrait pour recherche
  ascenseur_id?: string;
  ascenseur_code?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  document: GEDDocument;
  score: number;
  highlights: string[];
  matchedIn: ('nom' | 'contenu' | 'tags' | 'categorie')[];
}

// Configuration de la recherche
const SEARCH_CONFIG = {
  minQueryLength: 2,
  maxResults: 50,
  highlightLength: 100,
};

/**
 * Recherche full-text dans les documents GED
 */
export async function searchGEDDocuments(
  query: string,
  filters?: {
    categorie?: string;
    ascenseur_id?: string;
    dateFrom?: string;
    dateTo?: string;
    type?: string;
  }
): Promise<SearchResult[]> {
  if (!query || query.length < SEARCH_CONFIG.minQueryLength) {
    return [];
  }

  // Normaliser la requête
  const normalizedQuery = normalizeText(query);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);

  if (queryWords.length === 0) {
    return [];
  }

  try {
    // Construire la requête Supabase
    let supabaseQuery = supabase
      .from('documents')
      .select('*');

    // Appliquer les filtres
    if (filters?.categorie) {
      supabaseQuery = supabaseQuery.eq('categorie', filters.categorie);
    }
    if (filters?.ascenseur_id) {
      supabaseQuery = supabaseQuery.eq('ascenseur_id', filters.ascenseur_id);
    }
    if (filters?.type) {
      supabaseQuery = supabaseQuery.eq('type', filters.type);
    }
    if (filters?.dateFrom) {
      supabaseQuery = supabaseQuery.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      supabaseQuery = supabaseQuery.lte('created_at', filters.dateTo);
    }

    const { data: documents, error } = await supabaseQuery
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Erreur recherche GED:', error);
      return [];
    }

    // Scorer et filtrer les documents
    const results: SearchResult[] = [];

    (documents || []).forEach(doc => {
      const result = scoreDocument(doc, queryWords, normalizedQuery);
      if (result.score > 0) {
        results.push(result);
      }
    });

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, SEARCH_CONFIG.maxResults);
  } catch (error) {
    console.error('Erreur recherche GED:', error);
    return [];
  }
}

/**
 * Normaliser le texte pour la recherche
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Garder uniquement lettres et chiffres
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculer le score d'un document
 */
function scoreDocument(
  doc: GEDDocument,
  queryWords: string[],
  fullQuery: string
): SearchResult {
  let score = 0;
  const highlights: string[] = [];
  const matchedIn: ('nom' | 'contenu' | 'tags' | 'categorie')[] = [];

  // 1. Recherche dans le nom du fichier (poids x3)
  const normalizedNom = normalizeText(doc.nom || '');
  if (normalizedNom.includes(fullQuery)) {
    score += 30; // Match exact
    matchedIn.push('nom');
    highlights.push(highlightMatch(doc.nom, fullQuery));
  } else {
    const nomMatches = queryWords.filter(w => normalizedNom.includes(w));
    if (nomMatches.length > 0) {
      score += nomMatches.length * 10;
      if (!matchedIn.includes('nom')) matchedIn.push('nom');
    }
  }

  // 2. Recherche dans le contenu texte (poids x1)
  if (doc.contenu_texte) {
    const normalizedContenu = normalizeText(doc.contenu_texte);
    if (normalizedContenu.includes(fullQuery)) {
      score += 15;
      matchedIn.push('contenu');
      highlights.push(extractHighlight(doc.contenu_texte, fullQuery));
    } else {
      const contenuMatches = queryWords.filter(w => normalizedContenu.includes(w));
      if (contenuMatches.length > 0) {
        score += contenuMatches.length * 3;
        if (!matchedIn.includes('contenu')) matchedIn.push('contenu');
        highlights.push(extractHighlight(doc.contenu_texte, contenuMatches[0]));
      }
    }
  }

  // 3. Recherche dans les tags (poids x2)
  if (doc.tags && doc.tags.length > 0) {
    const normalizedTags = doc.tags.map(t => normalizeText(t));
    const tagMatches = queryWords.filter(w => 
      normalizedTags.some(t => t.includes(w))
    );
    if (tagMatches.length > 0) {
      score += tagMatches.length * 8;
      matchedIn.push('tags');
    }
  }

  // 4. Recherche dans la catégorie (poids x2)
  if (doc.categorie) {
    const normalizedCat = normalizeText(doc.categorie);
    if (normalizedCat.includes(fullQuery) || queryWords.some(w => normalizedCat.includes(w))) {
      score += 5;
      matchedIn.push('categorie');
    }
  }

  // 5. Recherche dans le code ascenseur
  if (doc.ascenseur_code) {
    const normalizedCode = normalizeText(doc.ascenseur_code);
    if (normalizedCode.includes(fullQuery) || queryWords.some(w => normalizedCode.includes(w))) {
      score += 5;
    }
  }

  return {
    document: doc,
    score,
    highlights,
    matchedIn
  };
}

/**
 * Mettre en évidence le match dans le texte
 */
function highlightMatch(text: string, query: string): string {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '**$1**');
}

/**
 * Extraire un extrait avec le match
 */
function extractHighlight(text: string, query: string): string {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return text.substring(0, SEARCH_CONFIG.highlightLength) + '...';
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);

  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  return highlightMatch(excerpt, query);
}

/**
 * Échapper les caractères spéciaux regex
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Obtenir les catégories disponibles
 */
export async function getGEDCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('categorie')
      .not('categorie', 'is', null);

    if (error) return [];

    const categories = [...new Set(data?.map(d => d.categorie).filter(Boolean))];
    return categories.sort();
  } catch {
    return [];
  }
}

/**
 * Obtenir les types de fichiers disponibles
 */
export async function getGEDTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('type')
      .not('type', 'is', null);

    if (error) return [];

    const types = [...new Set(data?.map(d => d.type).filter(Boolean))];
    return types.sort();
  } catch {
    return [];
  }
}

/**
 * Ajouter des tags à un document
 */
export async function addTagsToDocument(documentId: string, tags: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ tags })
      .eq('id', documentId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Extraire le texte d'un PDF (côté client - basique)
 * Note: Pour une vraie extraction OCR, utiliser un service externe
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Cette fonction est un placeholder
  // En production, utiliser pdf.js ou un service OCR comme Tesseract.js
  console.warn('Extraction PDF non implémentée - utiliser un service OCR');
  return '';
}

/**
 * Suggestions de recherche basées sur l'historique
 */
export function getSearchSuggestions(query: string, history: string[]): string[] {
  if (!query || query.length < 2) return [];
  
  const normalizedQuery = normalizeText(query);
  return history
    .filter(h => normalizeText(h).includes(normalizedQuery))
    .slice(0, 5);
}
