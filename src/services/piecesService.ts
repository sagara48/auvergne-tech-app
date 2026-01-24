/**
 * Service de gestion des pièces détachées
 * Inclut l'analyse par photo avec Claude Vision
 */

import { supabase } from './supabase';

// Types
export interface Fournisseur {
  id: string;
  nom: string;
  code: string;
  site_web: string;
  url_recherche: string;
  telephone?: string;
  email?: string;
  logo_url?: string;
}

export interface CategoriePiece {
  id: string;
  nom: string;
  code: string;
  description?: string;
  icone?: string;
  couleur?: string;
}

export interface PieceCatalogue {
  id: string;
  reference: string;
  reference_fabricant?: string;
  designation: string;
  description?: string;
  fournisseur_id?: string;
  fournisseur_code?: string;
  categorie_id?: string;
  categorie_code?: string;
  sous_categorie?: string;
  marque_compatible?: string;
  modeles_compatibles?: string[];
  poids_grammes?: number;
  dimensions?: {
    profondeur?: number;
    hauteur?: number;
    largeur?: number;
    longueur?: number;
  };
  unite?: string;
  photo_url?: string;
  fiche_technique_url?: string;
  prix_ht?: number;
  devise?: string;
  mots_cles?: string[];
  source?: string;
  page_catalogue?: number;
  created_at: string;
}

export interface AnalysePhotoResult {
  type_piece: string;
  description: string;
  marque_detectee?: string;
  references_lues: string[];
  caracteristiques: string[];
  etat?: string;
  suggestions_recherche: string[];
  confiance: number;
  conseil_technique?: string;
}

export interface RecherchePhotoHistorique {
  id: string;
  photo_url?: string;
  analyse_ia: AnalysePhotoResult;
  code_ascenseur?: string;
  piece_trouvee_id?: string;
  created_at: string;
}

// ============================================
// FOURNISSEURS
// ============================================

export async function getFournisseurs(): Promise<Fournisseur[]> {
  const { data, error } = await supabase
    .from('fournisseurs_pieces')
    .select('*')
    .eq('actif', true)
    .order('nom');
  
  if (error) throw error;
  return data || [];
}

export async function getUrlRechercheFournisseur(fournisseurCode: string, query: string): Promise<string> {
  const { data } = await supabase
    .from('fournisseurs_pieces')
    .select('url_recherche')
    .eq('code', fournisseurCode)
    .single();
  
  if (data?.url_recherche) {
    return data.url_recherche.replace('{query}', encodeURIComponent(query));
  }
  
  // URLs par défaut
  const defaultUrls: Record<string, string> = {
    'SODIMAS': `https://www.sodimas.com/fr/recherche?search=${encodeURIComponent(query)}`,
    'HAUER': `https://www.hfrench.com/fr/recherche?q=${encodeURIComponent(query)}`,
    'MGTI': `https://www.mgti.fr/recherche?s=${encodeURIComponent(query)}`,
  };
  
  return defaultUrls[fournisseurCode] || `https://www.google.com/search?q=${encodeURIComponent(query)}+ascenseur+pièce`;
}

// ============================================
// CATÉGORIES
// ============================================

export async function getCategoriesPieces(): Promise<CategoriePiece[]> {
  const { data, error } = await supabase
    .from('categories_pieces')
    .select('*')
    .order('ordre');
  
  if (error) throw error;
  return data || [];
}

// ============================================
// CATALOGUE PIÈCES
// ============================================

export async function searchPieces(
  terme: string,
  options?: {
    fournisseur?: string;
    categorie?: string;
    marque?: string;
    limit?: number;
  }
): Promise<PieceCatalogue[]> {
  let query = supabase
    .from('pieces_catalogue')
    .select('*')
    .eq('actif', true);
  
  // Recherche textuelle
  if (terme) {
    query = query.or(`reference.ilike.%${terme}%,designation.ilike.%${terme}%,marque_compatible.ilike.%${terme}%`);
  }
  
  // Filtres
  if (options?.fournisseur) {
    query = query.eq('fournisseur_code', options.fournisseur);
  }
  if (options?.categorie) {
    query = query.eq('categorie_code', options.categorie);
  }
  if (options?.marque) {
    query = query.ilike('marque_compatible', `%${options.marque}%`);
  }
  
  query = query.limit(options?.limit || 50).order('reference');
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPieceById(id: string): Promise<PieceCatalogue | null> {
  const { data, error } = await supabase
    .from('pieces_catalogue')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data;
}

export async function getPieceByReference(reference: string, fournisseur?: string): Promise<PieceCatalogue | null> {
  let query = supabase
    .from('pieces_catalogue')
    .select('*')
    .eq('reference', reference);
  
  if (fournisseur) {
    query = query.eq('fournisseur_code', fournisseur);
  }
  
  const { data, error } = await query.limit(1).single();
  if (error) return null;
  return data;
}

// ============================================
// ANALYSE PHOTO AVEC CLAUDE VISION
// ============================================

/**
 * Analyse une photo de pièce avec Claude Vision
 * Retourne l'identification de la pièce et des suggestions
 */
export async function analyserPhotoPiece(
  imageBase64: string,
  contexte?: {
    marqueAscenseur?: string;
    typeAscenseur?: string;
    codeAscenseur?: string;
  }
): Promise<AnalysePhotoResult> {
  // Construire le prompt pour Claude Vision
  const systemPrompt = `Tu es un expert en maintenance d'ascenseurs. Tu analyses des photos de pièces détachées pour les identifier.

Ton objectif est d'identifier :
1. Le TYPE de pièce (contacteur, bouton, carte électronique, galet, patin, câble, etc.)
2. La MARQUE si visible (Schindler, Otis, Kone, ThyssenKrupp, etc.)
3. Les RÉFÉRENCES visibles sur la pièce (numéros gravés, étiquettes, codes)
4. L'ÉTAT de la pièce (neuf, usé, défectueux)
5. Des SUGGESTIONS de recherche pour trouver cette pièce chez Sodimas, Hauer ou MGTI

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "type_piece": "string - type de pièce identifié",
  "description": "string - description détaillée de la pièce",
  "marque_detectee": "string ou null - marque si identifiable",
  "references_lues": ["array de strings - toutes les références visibles"],
  "caracteristiques": ["array de strings - caractéristiques techniques observées"],
  "etat": "string - neuf/usé/défectueux/indéterminé",
  "suggestions_recherche": ["array de strings - termes à rechercher chez les fournisseurs"],
  "confiance": 0.0-1.0,
  "conseil_technique": "string ou null - conseil pour le technicien"
}`;

  let userPrompt = "Analyse cette photo de pièce d'ascenseur et identifie-la :";
  
  if (contexte?.marqueAscenseur) {
    userPrompt += `\n- Marque de l'ascenseur : ${contexte.marqueAscenseur}`;
  }
  if (contexte?.typeAscenseur) {
    userPrompt += `\n- Type d'ascenseur : ${contexte.typeAscenseur}`;
  }
  if (contexte?.codeAscenseur) {
    userPrompt += `\n- Code appareil : ${contexte.codeAscenseur}`;
  }

  try {
    // Appel à l'API Claude Vision via l'endpoint Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API Claude: ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.content.find((c: any) => c.type === 'text')?.text || '';
    
    // Parser la réponse JSON
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as AnalysePhotoResult;
      return result;
    }
    
    throw new Error('Réponse invalide de Claude Vision');
  } catch (error) {
    console.error('Erreur analyse photo:', error);
    
    // Retourner un résultat par défaut en cas d'erreur
    return {
      type_piece: 'Non identifié',
      description: 'Impossible d\'analyser la photo. Veuillez réessayer ou saisir les informations manuellement.',
      references_lues: [],
      caracteristiques: [],
      suggestions_recherche: [],
      confiance: 0,
    };
  }
}

/**
 * Sauvegarde une recherche photo dans l'historique
 */
export async function sauvegarderRecherchePhoto(
  photoUrl: string | null,
  analyseIa: AnalysePhotoResult,
  codeAscenseur?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('recherches_pieces_photo')
    .insert({
      photo_url: photoUrl,
      analyse_ia: analyseIa,
      code_ascenseur: codeAscenseur,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

/**
 * Récupère l'historique des recherches photo
 */
export async function getHistoriqueRecherchesPhoto(
  codeAscenseur?: string,
  limit: number = 20
): Promise<RecherchePhotoHistorique[]> {
  let query = supabase
    .from('recherches_pieces_photo')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (codeAscenseur) {
    query = query.eq('code_ascenseur', codeAscenseur);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================
// PIÈCES PERSONNELLES
// ============================================

export interface PiecePersonnelle {
  id: string;
  reference: string;
  designation: string;
  description?: string;
  piece_catalogue_id?: string;
  fournisseur_prefere?: string;
  prix_achat?: number;
  delai_livraison_jours?: number;
  notes?: string;
  photo_url?: string;
  tags?: string[];
  created_at: string;
}

export async function getPiecesPersonnelles(): Promise<PiecePersonnelle[]> {
  const { data, error } = await supabase
    .from('pieces_personnelles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function ajouterPiecePersonnelle(piece: Partial<PiecePersonnelle>): Promise<PiecePersonnelle> {
  const { data, error } = await supabase
    .from('pieces_personnelles')
    .insert(piece)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function supprimerPiecePersonnelle(id: string): Promise<void> {
  const { error } = await supabase
    .from('pieces_personnelles')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// HISTORIQUE PIÈCES PAR ASCENSEUR
// ============================================

export interface HistoriquePieceAscenseur {
  id: string;
  code_ascenseur: string;
  piece_id?: string;
  reference: string;
  designation: string;
  date_installation?: string;
  date_commande?: string;
  quantite: number;
  prix_unitaire?: number;
  fournisseur?: string;
  numero_commande?: string;
  technicien_nom?: string;
  motif?: string;
  notes?: string;
  created_at: string;
}

export async function getHistoriquePiecesAscenseur(codeAscenseur: string): Promise<HistoriquePieceAscenseur[]> {
  const { data, error } = await supabase
    .from('historique_pieces_ascenseur')
    .select('*')
    .eq('code_ascenseur', codeAscenseur)
    .order('date_installation', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function ajouterHistoriquePiece(historique: Partial<HistoriquePieceAscenseur>): Promise<HistoriquePieceAscenseur> {
  const { data, error } = await supabase
    .from('historique_pieces_ascenseur')
    .insert(historique)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============================================
// UPLOAD PHOTO PIÈCE
// ============================================

export async function uploadPhotoPiece(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `pieces/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error('Erreur lors de l\'upload de la photo');
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Convertit un fichier image en base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// MARQUES D'ASCENSEURS CONNUES
// ============================================

export const MARQUES_ASCENSEURS = [
  'Schindler',
  'Otis',
  'Kone',
  'ThyssenKrupp',
  'Mitsubishi',
  'Fujitec',
  'Orona',
  'Wittur',
  'Fermator',
  'Bucher',
  'Ziehl-Abegg',
  'Montanari',
  'Sematic',
  'CEDES',
  'BST',
  'Dynatech',
  'Autre',
];

export const TYPES_PIECES = [
  { code: 'CONTACTEUR', label: 'Contacteur / Relais', categorie: 'ELECTRONIQUE' },
  { code: 'CARTE', label: 'Carte électronique', categorie: 'ELECTRONIQUE' },
  { code: 'BOUTON', label: 'Bouton / Poussoir', categorie: 'BOUTONS_SIGNAL' },
  { code: 'AFFICHEUR', label: 'Afficheur / Display', categorie: 'BOUTONS_SIGNAL' },
  { code: 'GALET', label: 'Galet / Roulette', categorie: 'PORTES_PALIERES' },
  { code: 'PATIN', label: 'Patin / Garniture', categorie: 'PORTES_PALIERES' },
  { code: 'SERRURE', label: 'Serrure / Verrou', categorie: 'PORTES_PALIERES' },
  { code: 'MOTEUR', label: 'Moteur', categorie: 'MACHINERIE' },
  { code: 'FREIN', label: 'Frein / Mâchoire', categorie: 'MACHINERIE' },
  { code: 'VARIATEUR', label: 'Variateur', categorie: 'MACHINERIE' },
  { code: 'CAPTEUR', label: 'Capteur / Détecteur', categorie: 'SECURITE' },
  { code: 'CABLE', label: 'Câble / Fil', categorie: 'CABLAGE' },
  { code: 'POULIE', label: 'Poulie / Réa', categorie: 'MACHINERIE' },
  { code: 'AMORTISSEUR', label: 'Amortisseur', categorie: 'CABINE' },
  { code: 'AUTRE', label: 'Autre', categorie: 'DIVERS' },
];
