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
    'SODIMAS': `https://my.sodimas.com/fr/recherche?search=${encodeURIComponent(query)}`,
    'HAUER': `https://www.hfrepartition.com/catalogsearch/result/?q=${encodeURIComponent(query)}`,
    'MGTI': `https://www.mgti.fr/?s=${encodeURIComponent(query)}&post_type=product`,
    'MP': `https://www.mp-servicenter.com/portal/repuestos-ascensores-mp?search=${encodeURIComponent(query)}`,
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
 * Analyse une photo de pièce avec Claude Vision via API Route Vercel
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
  try {
    // Appel à l'API Route Vercel
    const response = await fetch('/api/analyze-piece-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        contexte,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data as AnalysePhotoResult;
  } catch (error) {
    console.error('Erreur analyse photo:', error);
    
    // Retourner un résultat par défaut en cas d'erreur
    return {
      type_piece: 'Analyse impossible',
      description: 'Impossible d\'analyser la photo. Veuillez réessayer ou saisir les informations manuellement.',
      marque_detectee: undefined,
      references_lues: [],
      caracteristiques: [],
      etat: 'indéterminé',
      suggestions_recherche: [],
      confiance: 0,
      conseil_technique: 'Vérifiez que l\'image est nette et bien éclairée.',
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

/**
 * Compresse et redimensionne une image avant envoi à Claude
 * Max 1024px, qualité 85%, format JPEG
 */
export function compressImageForAnalysis(file: File, maxSize = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculer les nouvelles dimensions
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      // Dessiner l'image redimensionnée
      ctx?.drawImage(img, 0, 0, width, height);

      // Convertir en JPEG compressé
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      console.log(`Image compressée: ${img.width}x${img.height} -> ${Math.round(width)}x${Math.round(height)}, ~${Math.round(dataUrl.length / 1024)}KB`);
      
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error('Erreur chargement image'));

    // Charger l'image depuis le fichier
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
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

// ============================================
// MODULE "MON CATALOGUE" - DOSSIERS & FAVORIS
// ============================================

export interface Dossier {
  id: string;
  nom: string;
  description?: string;
  couleur: string;
  icone: string;
  parent_id?: string;
  ordre: number;
  created_at: string;
  // Calculé
  count?: number;
}

export interface Favori {
  favori_id: string;
  piece_id: string;
  reference: string;
  designation: string;
  description?: string;
  photo_url?: string;
  fournisseur?: string;
  dossier_id?: string;
  dossier_nom?: string;
  dossier_couleur?: string;
  dossier_icone?: string;
  favori_notes?: string;
  quantite_habituelle?: number;
  favori_tags?: string[];
  source: 'catalogue' | 'personnelle';
  prix_ht?: number;
  marque_compatible?: string;
  categorie_code?: string;
}

export interface StatsFavoris {
  total_favoris: number;
  total_dossiers: number;
  par_fournisseur: Record<string, number>;
  par_dossier: Record<string, number>;
}

// DOSSIERS

export async function getDossiers(): Promise<Dossier[]> {
  const { data, error } = await supabase
    .from('pieces_dossiers')
    .select('*')
    .order('ordre');
  
  if (error) throw error;
  return data || [];
}

export async function creerDossier(dossier: Partial<Dossier>): Promise<Dossier> {
  const { data, error } = await supabase
    .from('pieces_dossiers')
    .insert({
      nom: dossier.nom,
      description: dossier.description,
      couleur: dossier.couleur || '#3b82f6',
      icone: dossier.icone || 'Folder',
      parent_id: dossier.parent_id,
      ordre: dossier.ordre || 0,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function modifierDossier(id: string, updates: Partial<Dossier>): Promise<Dossier> {
  const { data, error } = await supabase
    .from('pieces_dossiers')
    .update({
      nom: updates.nom,
      description: updates.description,
      couleur: updates.couleur,
      icone: updates.icone,
      parent_id: updates.parent_id,
      ordre: updates.ordre,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function supprimerDossier(id: string): Promise<void> {
  // Les favoris dans ce dossier seront déplacés vers "Non classé" (dossier_id = null) grâce au ON DELETE SET NULL
  const { error } = await supabase
    .from('pieces_dossiers')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// FAVORIS

export async function getFavoris(options?: {
  dossierId?: string;
  fournisseur?: string;
  recherche?: string;
}): Promise<Favori[]> {
  let query = supabase
    .from('v_pieces_favoris')
    .select('*');
  
  if (options?.dossierId) {
    query = query.eq('dossier_id', options.dossierId);
  }
  if (options?.fournisseur) {
    query = query.eq('fournisseur', options.fournisseur);
  }
  if (options?.recherche) {
    const terme = options.recherche.toLowerCase();
    query = query.or(`reference.ilike.%${terme}%,designation.ilike.%${terme}%,favori_notes.ilike.%${terme}%`);
  }
  
  query = query.order('reference');
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function ajouterFavori(
  pieceCatalogueId?: string,
  piecePersonnelleId?: string,
  dossierId?: string,
  notes?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('pieces_favoris')
    .insert({
      piece_catalogue_id: pieceCatalogueId,
      piece_personnelle_id: piecePersonnelleId,
      dossier_id: dossierId,
      notes,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function retirerFavori(favoriId: string): Promise<void> {
  const { error } = await supabase
    .from('pieces_favoris')
    .delete()
    .eq('id', favoriId);
  
  if (error) throw error;
}

export async function retirerFavoriByPiece(pieceCatalogueId?: string, piecePersonnelleId?: string): Promise<void> {
  let query = supabase.from('pieces_favoris').delete();
  
  if (pieceCatalogueId) {
    query = query.eq('piece_catalogue_id', pieceCatalogueId);
  } else if (piecePersonnelleId) {
    query = query.eq('piece_personnelle_id', piecePersonnelleId);
  }
  
  const { error } = await query;
  if (error) throw error;
}

export async function deplacerFavori(favoriId: string, nouveauDossierId: string | null): Promise<void> {
  const { error } = await supabase
    .from('pieces_favoris')
    .update({ dossier_id: nouveauDossierId, updated_at: new Date().toISOString() })
    .eq('id', favoriId);
  
  if (error) throw error;
}

export async function modifierNotesFavori(favoriId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('pieces_favoris')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', favoriId);
  
  if (error) throw error;
}

export async function estFavori(pieceCatalogueId?: string, piecePersonnelleId?: string): Promise<boolean> {
  let query = supabase.from('pieces_favoris').select('id').limit(1);
  
  if (pieceCatalogueId) {
    query = query.eq('piece_catalogue_id', pieceCatalogueId);
  } else if (piecePersonnelleId) {
    query = query.eq('piece_personnelle_id', piecePersonnelleId);
  }
  
  const { data } = await query;
  return (data?.length || 0) > 0;
}

// STATISTIQUES

export async function getStatsFavoris(): Promise<StatsFavoris> {
  // Total favoris
  const { count: totalFavoris } = await supabase
    .from('pieces_favoris')
    .select('*', { count: 'exact', head: true });
  
  // Total dossiers
  const { count: totalDossiers } = await supabase
    .from('pieces_dossiers')
    .select('*', { count: 'exact', head: true });
  
  // Par fournisseur
  const { data: favoris } = await supabase
    .from('v_pieces_favoris')
    .select('fournisseur');
  
  const parFournisseur: Record<string, number> = {};
  favoris?.forEach(f => {
    if (f.fournisseur) {
      parFournisseur[f.fournisseur] = (parFournisseur[f.fournisseur] || 0) + 1;
    }
  });
  
  // Par dossier
  const { data: favorisDossiers } = await supabase
    .from('v_pieces_favoris')
    .select('dossier_nom');
  
  const parDossier: Record<string, number> = {};
  favorisDossiers?.forEach(f => {
    const nom = f.dossier_nom || 'Non classé';
    parDossier[nom] = (parDossier[nom] || 0) + 1;
  });
  
  return {
    total_favoris: totalFavoris || 0,
    total_dossiers: totalDossiers || 0,
    par_fournisseur: parFournisseur,
    par_dossier: parDossier,
  };
}

// ICÔNES ET COULEURS DISPONIBLES

export const COULEURS_DOSSIERS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const ICONES_DOSSIERS = [
  'Folder',
  'Star',
  'Zap',
  'Truck',
  'Building2',
  'ShoppingCart',
  'Bookmark',
  'Tag',
  'Box',
  'Wrench',
  'Heart',
  'AlertCircle',
  'Clock',
  'Settings',
];
