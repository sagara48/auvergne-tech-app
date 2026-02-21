import { supabase } from './supabase';
import type { 
  Semaine, Jour, Tache, Astreinte, SemaineAvecDetails, TotauxSemaine, DashboardStats,
  Ascenseur, Travaux, MiseEnService, StockArticle, Vehicule, Demande, Document, PlanningEvent, Tournee, Technicien, StockVehicule, StockTransfert, Role, Permission,
  ChatChannel, ChatMessage, ChatMessageRead, Note, NoteCategory,
  Notification, NotificationPreferences, NotificationType, NotificationPriority,
  Commande, CommandeLigne, StatutCommande,
  NFCTag, NFCScan, TypeTagNFC, NFCAction,
  TypeDemande, StatutDemande, DemandeHistorique
} from '@/types';
import { format, addDays, getWeek, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';

// ================================================
// DASHBOARD
// ================================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const [ascenseurs, travaux, mes, stock, demandes, transferts] = await Promise.all([
    supabase.from('ascenseurs').select('statut'),
    supabase.from('travaux').select('statut').in('statut', ['planifie', 'en_cours']),
    supabase.from('mise_en_service').select('statut').in('statut', ['planifie', 'en_cours']),
    supabase.from('stock_articles').select('quantite_stock, seuil_critique').eq('actif', true),
    supabase.from('demandes').select('statut').eq('statut', 'en_attente'),
    supabase.from('stock_transferts').select('statut').eq('statut', 'en_attente'),
  ]);
  
  return {
    total_ascenseurs: ascenseurs.data?.length || 0,
    ascenseurs_en_panne: ascenseurs.data?.filter(a => a.statut === 'en_panne').length || 0,
    travaux_en_cours: travaux.data?.length || 0,
    mes_en_cours: mes.data?.length || 0,
    stock_critique: stock.data?.filter(s => s.quantite_stock <= s.seuil_critique).length || 0,
    demandes_en_attente: demandes.data?.length || 0,
    transferts_en_attente: transferts.data?.length || 0,
  };
}

// ================================================
// ASCENSEURS
// ================================================
export async function getAscenseurs(): Promise<Ascenseur[]> {
  const { data, error } = await supabase.from('ascenseurs').select('*, client:clients(*)').order('code');
  if (error) throw error;
  return data || [];
}

export async function getAscenseur(id: string): Promise<Ascenseur | null> {
  const { data, error } = await supabase.from('ascenseurs').select('*, client:clients(*)').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateAscenseur(id: string, data: Partial<Ascenseur>): Promise<Ascenseur> {
  const { data: result, error } = await supabase.from('ascenseurs').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

// ================================================
// TRAVAUX
// ================================================
export async function getTravaux(includeArchived = false): Promise<Travaux[]> {
  try {
    const { data, error } = await supabase
      .from('travaux')
      .select('*, client:clients(*), technicien:techniciens!travaux_technicien_id_fkey(*), ascenseur:ascenseurs(*)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur getTravaux:', error.message, error.details, error.hint);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception getTravaux:', err);
    return [];
  }
}

export async function createTravaux(travaux: Partial<Travaux>): Promise<Travaux> {
  const code = `TRV-${String(Date.now()).slice(-6)}`;
  const { data, error } = await supabase.from('travaux').insert({ ...travaux, code }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTravaux(id: string, data: Partial<Travaux>): Promise<Travaux> {
  const { data: result, error } = await supabase.from('travaux').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

// ================================================
// MISE EN SERVICE
// ================================================
export async function getMiseEnServices(includeArchived = false): Promise<MiseEnService[]> {
  try {
    let query = supabase
      .from('mise_en_service')
      .select('*, ascenseur:ascenseurs(*), technicien:techniciens!mise_en_service_technicien_id_fkey(*)')
      .order('date_prevue');
    
    if (!includeArchived) {
      query = query.or('archive.is.null,archive.eq.false');
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erreur getMiseEnServices:', error.message, error.details, error.hint);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception getMiseEnServices:', err);
    return [];
  }
}

export async function updateMiseEnService(id: string, data: Partial<MiseEnService>): Promise<MiseEnService> {
  const { data: result, error } = await supabase.from('mise_en_service').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

// ================================================
// TOURNEES
// ================================================
export async function getTournees(): Promise<Tournee[]> {
  const { data, error } = await supabase.from('tournees').select('*, technicien:techniciens(*)').order('code');
  if (error) throw error;
  return data || [];
}

// ================================================
// STOCK
// ================================================
export async function getStockArticles(): Promise<StockArticle[]> {
  const { data, error } = await supabase.from('stock_articles').select('*, categorie:stock_categories(*)').eq('actif', true).order('designation');
  if (error) throw error;
  return data || [];
}

export async function updateStockArticle(id: string, data: Partial<StockArticle>): Promise<StockArticle> {
  const { data: result, error } = await supabase.from('stock_articles').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function createStockArticle(data: Partial<StockArticle>): Promise<StockArticle> {
  const { data: result, error } = await supabase.from('stock_articles').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function deleteStockArticle(id: string): Promise<void> {
  const { error } = await supabase.from('stock_articles').delete().eq('id', id);
  if (error) throw error;
}

export async function createStockMouvement(articleId: string, type: string, quantite: number, motif?: string) {
  const article = await supabase.from('stock_articles').select('quantite_stock').eq('id', articleId).single();
  if (article.error) throw article.error;
  
  const newQty = type === 'entree' ? article.data.quantite_stock + quantite : article.data.quantite_stock - quantite;
  
  await supabase.from('stock_mouvements').insert({ article_id: articleId, type_mouvement: type, quantite, motif, quantite_avant: article.data.quantite_stock, quantite_apres: newQty });
  await supabase.from('stock_articles').update({ quantite_stock: newQty }).eq('id', articleId);
}

export async function getStockMouvements(limit = 50) {
  const { data, error } = await supabase
    .from('stock_mouvements')
    .select('*, article:stock_articles(id, designation, reference)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getStockMouvementsFiltered(dateDebut?: string, dateFin?: string) {
  let query = supabase
    .from('stock_mouvements')
    .select('*, article:stock_articles(id, designation, reference)')
    .order('created_at', { ascending: false });
  
  if (dateDebut) {
    query = query.gte('created_at', dateDebut);
  }
  if (dateFin) {
    query = query.lte('created_at', dateFin + 'T23:59:59');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStockMouvementsByArticle(articleId: string, dateDebut?: string, dateFin?: string) {
  let query = supabase
    .from('stock_mouvements')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false });
  
  if (dateDebut) {
    query = query.gte('created_at', dateDebut);
  }
  if (dateFin) {
    query = query.lte('created_at', dateFin + 'T23:59:59');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ================================================
// CATÉGORIES STOCK
// ================================================
export async function getStockCategories() {
  const { data, error } = await supabase
    .from('stock_categories')
    .select('*')
    .order('nom');
  if (error) throw error;
  return data || [];
}

export async function createStockCategorie(data: { nom: string; description?: string }) {
  const { data: result, error } = await supabase.from('stock_categories').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateStockCategorie(id: string, data: { nom?: string; description?: string }) {
  const { data: result, error } = await supabase.from('stock_categories').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function deleteStockCategorie(id: string) {
  const { error } = await supabase.from('stock_categories').delete().eq('id', id);
  if (error) throw error;
}

// ================================================
// STOCK VÉHICULE
// ================================================
export async function getStockVehicule(vehiculeId: string) {
  const { data, error } = await supabase.from('stock_vehicule').select('*, article:stock_articles(*), vehicule:vehicules(*)').eq('vehicule_id', vehiculeId).order('article(designation)');
  if (error) throw error;
  return data || [];
}

export async function getStockVehiculeByTechnicien(technicienId: string) {
  // Trouver le véhicule du technicien
  const { data: vehicule } = await supabase
    .from('vehicules')
    .select('id')
    .eq('technicien_id', technicienId)
    .single();
  
  if (!vehicule) return [];
  
  const { data, error } = await supabase
    .from('stock_vehicule')
    .select('*, article:stock_articles(*), vehicule:vehicules(*)')
    .eq('vehicule_id', vehicule.id);
  
  if (error) throw error;
  return data || [];
}

// Ajouter du stock au véhicule (depuis dépôt)
export async function ajouterStockVehicule(
  vehiculeId: string, 
  articleId: string, 
  quantite: number, 
  technicienId: string,
  notes?: string
): Promise<void> {
  // 1. Vérifier/créer l'entrée stock_vehicule
  const { data: existing } = await supabase
    .from('stock_vehicule')
    .select('id, quantite')
    .eq('vehicule_id', vehiculeId)
    .eq('article_id', articleId)
    .single();

  if (existing) {
    // Mettre à jour la quantité
    await supabase
      .from('stock_vehicule')
      .update({ quantite: existing.quantite + quantite })
      .eq('id', existing.id);
  } else {
    // Créer l'entrée
    await supabase
      .from('stock_vehicule')
      .insert({ vehicule_id: vehiculeId, article_id: articleId, quantite, quantite_min: 0 });
  }

  // 2. Réduire le stock dépôt
  const { data: article } = await supabase
    .from('stock_articles')
    .select('quantite_stock')
    .eq('id', articleId)
    .single();

  if (article) {
    await supabase
      .from('stock_articles')
      .update({ quantite_stock: Math.max(0, article.quantite_stock - quantite) })
      .eq('id', articleId);
  }

  // 3. Créer le mouvement de stock
  await supabase.from('stock_mouvements').insert({
    article_id: articleId,
    type_mouvement: 'sortie',
    quantite,
    motif: 'transfert_vehicule',
    vehicule_id: vehiculeId,
    notes: notes || `Transfert vers véhicule`,
    effectue_par: technicienId,
  });
}

// Retirer du stock véhicule (vers dépôt)
export async function retirerStockVehicule(
  vehiculeId: string, 
  articleId: string, 
  quantite: number, 
  technicienId: string,
  notes?: string
): Promise<void> {
  // 1. Réduire le stock véhicule
  const { data: existing } = await supabase
    .from('stock_vehicule')
    .select('id, quantite')
    .eq('vehicule_id', vehiculeId)
    .eq('article_id', articleId)
    .single();

  if (!existing) throw new Error('Article non trouvé dans le véhicule');

  const newQty = existing.quantite - quantite;
  if (newQty <= 0) {
    // Supprimer l'entrée si quantité <= 0
    await supabase.from('stock_vehicule').delete().eq('id', existing.id);
  } else {
    await supabase
      .from('stock_vehicule')
      .update({ quantite: newQty })
      .eq('id', existing.id);
  }

  // 2. Augmenter le stock dépôt
  const { data: article } = await supabase
    .from('stock_articles')
    .select('quantite_stock')
    .eq('id', articleId)
    .single();

  if (article) {
    await supabase
      .from('stock_articles')
      .update({ quantite_stock: article.quantite_stock + quantite })
      .eq('id', articleId);
  }

  // 3. Créer le mouvement de stock
  await supabase.from('stock_mouvements').insert({
    article_id: articleId,
    type_mouvement: 'entree',
    quantite,
    motif: 'retour_vehicule',
    vehicule_id: vehiculeId,
    notes: notes || `Retour depuis véhicule`,
    effectue_par: technicienId,
  });
}

// Transférer du stock entre deux véhicules
export async function transfertStockVehicule(
  vehiculeSourceId: string,
  vehiculeDestId: string,
  articleId: string,
  quantite: number,
  technicienId: string,
  notes?: string
): Promise<void> {
  // 1. Vérifier et réduire le stock du véhicule source
  const { data: source } = await supabase
    .from('stock_vehicule')
    .select('id, quantite')
    .eq('vehicule_id', vehiculeSourceId)
    .eq('article_id', articleId)
    .single();

  if (!source) throw new Error('Article non trouvé dans le véhicule source');
  if (source.quantite < quantite) throw new Error('Quantité insuffisante dans le véhicule source');

  const newSourceQty = source.quantite - quantite;
  if (newSourceQty <= 0) {
    await supabase.from('stock_vehicule').delete().eq('id', source.id);
  } else {
    await supabase
      .from('stock_vehicule')
      .update({ quantite: newSourceQty })
      .eq('id', source.id);
  }

  // 2. Ajouter au stock du véhicule destination
  const { data: dest } = await supabase
    .from('stock_vehicule')
    .select('id, quantite')
    .eq('vehicule_id', vehiculeDestId)
    .eq('article_id', articleId)
    .single();

  if (dest) {
    await supabase
      .from('stock_vehicule')
      .update({ quantite: dest.quantite + quantite })
      .eq('id', dest.id);
  } else {
    await supabase
      .from('stock_vehicule')
      .insert({ vehicule_id: vehiculeDestId, article_id: articleId, quantite, quantite_min: 0 });
  }

  // 3. Créer les mouvements de stock (sortie source + entrée dest)
  await supabase.from('stock_mouvements').insert([
    {
      article_id: articleId,
      type_mouvement: 'sortie',
      quantite,
      motif: 'transfert_vehicule',
      vehicule_id: vehiculeSourceId,
      notes: notes || `Transfert vers autre véhicule`,
      effectue_par: technicienId,
    },
    {
      article_id: articleId,
      type_mouvement: 'entree',
      quantite,
      motif: 'transfert_vehicule',
      vehicule_id: vehiculeDestId,
      notes: notes || `Transfert depuis autre véhicule`,
      effectue_par: technicienId,
    }
  ]);
}

// Définir le stock initial d'un véhicule (sans mouvement)
export async function setStockVehicule(
  vehiculeId: string, 
  articleId: string, 
  quantite: number,
  quantiteMin: number = 0
): Promise<void> {
  const { data: existing } = await supabase
    .from('stock_vehicule')
    .select('id')
    .eq('vehicule_id', vehiculeId)
    .eq('article_id', articleId)
    .single();

  if (existing) {
    await supabase
      .from('stock_vehicule')
      .update({ quantite, quantite_min: quantiteMin })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('stock_vehicule')
      .insert({ vehicule_id: vehiculeId, article_id: articleId, quantite, quantite_min: quantiteMin });
  }
}

export async function getStockGlobal() {
  const { data, error } = await supabase.from('vue_stock_global').select('*').order('reference');
  if (error) throw error;
  return data || [];
}

export async function updateStockVehicule(id: string, data: { quantite?: number; quantite_min?: number }) {
  const { data: result, error } = await supabase.from('stock_vehicule').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

// ================================================
// TRANSFERTS STOCK
// ================================================
export async function getTransferts(statut?: string) {
  let query = supabase.from('stock_transferts').select(`
    *,
    article:stock_articles(*),
    source_vehicule:vehicules!stock_transferts_source_vehicule_id_fkey(*),
    destination_vehicule:vehicules!stock_transferts_destination_vehicule_id_fkey(*),
    demandeur:techniciens!stock_transferts_demande_par_fkey(*),
    valideur:techniciens!stock_transferts_valide_par_fkey(*)
  `).order('date_demande', { ascending: false });
  
  if (statut && statut !== 'all') query = query.eq('statut', statut);
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createTransfert(data: {
  article_id: string;
  quantite: number;
  source_type: 'depot' | 'vehicule';
  source_vehicule_id?: string;
  destination_type: 'depot' | 'vehicule';
  destination_vehicule_id?: string;
  motif?: string;
  demande_par: string;
}) {
  const code = `TRF-${String(Date.now()).slice(-6)}`;
  const { data: result, error } = await supabase.from('stock_transferts').insert({ ...data, code }).select().single();
  if (error) throw error;
  return result;
}

export async function validerTransfert(id: string, validePar: string, approuve: boolean) {
  const { data, error } = await supabase.from('stock_transferts')
    .update({ statut: approuve ? 'valide' : 'refuse', valide_par: validePar })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ================================================
// ENTRETIENS VÉHICULES
// ================================================

export interface TypeEntretien {
  id: string;
  nom: string;
  description?: string;
  periodicite_km?: number;
  periodicite_mois?: number;
  icone: string;
  couleur: string;
  ordre: number;
  actif: boolean;
}

export interface EntretienVehicule {
  id: string;
  vehicule_id: string;
  type_entretien_id?: string;
  type_personnalise?: string;
  date_entretien: string;
  kilometrage: number;
  cout?: number;
  garage?: string;
  notes?: string;
  prochain_km?: number;
  prochaine_date?: string;
  pieces_jointes?: { nom: string; url: string }[];
  created_at: string;
  created_by?: string;
  type_entretien?: TypeEntretien;
}

export async function getTypesEntretien(): Promise<TypeEntretien[]> {
  const { data, error } = await supabase
    .from('vehicules_types_entretien')
    .select('*')
    .eq('actif', true)
    .order('ordre');
  if (error) {
    console.warn('Table vehicules_types_entretien non disponible');
    return [];
  }
  return data || [];
}

export async function getEntretiensVehicule(vehiculeId: string): Promise<EntretienVehicule[]> {
  const { data, error } = await supabase
    .from('vehicules_entretiens')
    .select('*, type_entretien:vehicules_types_entretien(*)')
    .eq('vehicule_id', vehiculeId)
    .order('date_entretien', { ascending: false });
  if (error) {
    console.warn('Table vehicules_entretiens non disponible');
    return [];
  }
  return data || [];
}

export async function createEntretien(entretien: Partial<EntretienVehicule>): Promise<EntretienVehicule> {
  const { data, error } = await supabase
    .from('vehicules_entretiens')
    .insert(entretien)
    .select('*, type_entretien:vehicules_types_entretien(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEntretien(id: string, entretien: Partial<EntretienVehicule>): Promise<EntretienVehicule> {
  const { data, error } = await supabase
    .from('vehicules_entretiens')
    .update(entretien)
    .eq('id', id)
    .select('*, type_entretien:vehicules_types_entretien(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntretien(id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicules_entretiens')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Récupérer les prochains entretiens à prévoir
export async function getProchainEntretiens(vehiculeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('vue_vehicules_prochains_entretiens')
    .select('*')
    .eq('vehicule_id', vehiculeId);
  if (error) return [];
  return data || [];
}

// ================================================
// PÉRIODICITÉS PERSONNALISÉES
// ================================================

export interface PeriodicitePersonnalisee {
  id: string;
  vehicule_id: string;
  type_entretien_id: string;
  periodicite_km?: number;
  periodicite_mois?: number;
  actif: boolean;
  notes?: string;
  type_entretien?: TypeEntretien;
}

export async function getPeriodiciteVehicule(vehiculeId: string): Promise<PeriodicitePersonnalisee[]> {
  const { data, error } = await supabase
    .from('vehicules_periodicite_personnalisee')
    .select('*, type_entretien:vehicules_types_entretien(*)')
    .eq('vehicule_id', vehiculeId);
  if (error) {
    console.warn('Table vehicules_periodicite_personnalisee non disponible');
    return [];
  }
  return data || [];
}

export async function upsertPeriodicite(
  vehiculeId: string,
  typeEntretienId: string,
  data: { periodicite_km?: number; periodicite_mois?: number; actif?: boolean; notes?: string }
): Promise<PeriodicitePersonnalisee> {
  const { data: result, error } = await supabase
    .from('vehicules_periodicite_personnalisee')
    .upsert({
      vehicule_id: vehiculeId,
      type_entretien_id: typeEntretienId,
      ...data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vehicule_id,type_entretien_id' })
    .select('*, type_entretien:vehicules_types_entretien(*)')
    .single();
  if (error) throw error;
  return result;
}

export async function deletePeriodicite(vehiculeId: string, typeEntretienId: string): Promise<void> {
  const { error } = await supabase
    .from('vehicules_periodicite_personnalisee')
    .delete()
    .eq('vehicule_id', vehiculeId)
    .eq('type_entretien_id', typeEntretienId);
  if (error) throw error;
}

// ================================================
// STOCK VÉHICULE - MISE À JOUR STOCK MINIMAL
// ================================================

export async function updateStockVehiculeMinimal(
  vehiculeId: string, 
  articleId: string, 
  quantiteMin: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('stock_vehicule')
    .select('id')
    .eq('vehicule_id', vehiculeId)
    .eq('article_id', articleId)
    .single();

  if (existing) {
    await supabase
      .from('stock_vehicule')
      .update({ quantite_min: quantiteMin })
      .eq('id', existing.id);
  }
}

// ================================================
// PLEINS CARBURANT
// ================================================

export interface PleinCarburant {
  id: string;
  vehicule_id: string;
  date_plein: string;
  kilometrage: number;
  litres: number;
  montant: number;
  prix_litre?: number;
  type_carburant: string;
  plein_complet: boolean;
  station?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export async function getPleinsVehicule(vehiculeId: string): Promise<PleinCarburant[]> {
  const { data, error } = await supabase
    .from('vehicules_pleins')
    .select('*')
    .eq('vehicule_id', vehiculeId)
    .order('date_plein', { ascending: false });
  if (error) {
    console.warn('Table vehicules_pleins non disponible');
    return [];
  }
  return data || [];
}

export async function createPlein(plein: Partial<PleinCarburant>): Promise<PleinCarburant> {
  const { data, error } = await supabase
    .from('vehicules_pleins')
    .insert(plein)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlein(id: string, plein: Partial<PleinCarburant>): Promise<PleinCarburant> {
  const { data, error } = await supabase
    .from('vehicules_pleins')
    .update(plein)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlein(id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicules_pleins')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Statistiques carburant
export async function getStatsCarburant(vehiculeId: string): Promise<{
  totalLitres: number;
  totalDepense: number;
  prixMoyenLitre: number;
  consommationMoyenne: number | null;
  nbPleins: number;
}> {
  const { data, error } = await supabase
    .from('vue_vehicules_stats_carburant')
    .select('*')
    .eq('vehicule_id', vehiculeId)
    .single();
  
  if (error || !data) {
    return { totalLitres: 0, totalDepense: 0, prixMoyenLitre: 0, consommationMoyenne: null, nbPleins: 0 };
  }
  
  return {
    totalLitres: data.total_litres || 0,
    totalDepense: data.total_depense || 0,
    prixMoyenLitre: data.prix_moyen_litre || 0,
    consommationMoyenne: data.consommation_moyenne,
    nbPleins: data.nb_pleins || 0,
  };
}

// ================================================
// PERMISSIONS
// ================================================
export async function getRoles() {
  const { data, error } = await supabase.from('roles').select('*').order('niveau');
  if (error) throw error;
  return data || [];
}

export async function getPermissions() {
  const { data, error } = await supabase.from('permissions').select('*').order('module, code');
  if (error) throw error;
  return data || [];
}

export async function getTechnicienPermissions(technicienId: string): Promise<string[]> {
  const { data, error } = await supabase.from('vue_technicien_permissions').select('permissions').eq('technicien_id', technicienId).single();
  if (error) return [];
  return data?.permissions || [];
}

// ================================================
// VEHICULES
// ================================================
export async function getVehicules(): Promise<Vehicule[]> {
  const { data, error } = await supabase.from('vehicules').select('*, technicien:techniciens!vehicules_technicien_id_fkey(*)').order('immatriculation');
  if (error) throw error;
  return data || [];
}

export async function createVehicule(vehicule: Partial<Vehicule>): Promise<Vehicule> {
  const { data, error } = await supabase.from('vehicules').insert(vehicule).select('*, technicien:techniciens!vehicules_technicien_id_fkey(*)').single();
  if (error) throw error;
  return data;
}

export async function updateVehicule(id: string, data: Partial<Vehicule>): Promise<Vehicule> {
  const { data: result, error } = await supabase.from('vehicules').update(data).eq('id', id).select('*, technicien:techniciens!vehicules_technicien_id_fkey(*)').single();
  if (error) throw error;
  return result;
}

export async function deleteVehicule(id: string): Promise<void> {
  const { error } = await supabase.from('vehicules').delete().eq('id', id);
  if (error) throw error;
}

// ================================================
// DEMANDES
// ================================================
export async function getDemandes(options?: { 
  includeArchived?: boolean; 
  technicienId?: string;
  type?: TypeDemande;
  statut?: StatutDemande;
}): Promise<Demande[]> {
  let query = supabase
    .from('demandes')
    .select(`
      *,
      technicien:techniciens!demandes_technicien_id_fkey(*),
      traite_par_technicien:techniciens!demandes_traite_par_fkey(*),
      article:stock_articles(*),
      ascenseur:ascenseurs(*, client:clients(*))
    `)
    .order('created_at', { ascending: false });
  
  if (!options?.includeArchived) {
    query = query.or('archive.is.null,archive.eq.false');
  }
  
  if (options?.technicienId) {
    query = query.eq('technicien_id', options.technicienId);
  }
  
  if (options?.type) {
    query = query.eq('type_demande', options.type);
  }
  
  if (options?.statut) {
    query = query.eq('statut', options.statut);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDemandeById(id: string): Promise<Demande | null> {
  const { data, error } = await supabase
    .from('demandes')
    .select(`
      *,
      technicien:techniciens!demandes_technicien_id_fkey(*),
      traite_par_technicien:techniciens!demandes_traite_par_fkey(*),
      article:stock_articles(*),
      ascenseur:ascenseurs(*, client:clients(*))
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDemande(demande: Partial<Demande>): Promise<Demande> {
  const code = `DEM-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const { data, error } = await supabase
    .from('demandes')
    .insert({ ...demande, code, statut: demande.statut || 'en_attente' })
    .select()
    .single();
  if (error) throw error;
  
  // Créer l'entrée historique
  await supabase.from('demandes_historique').insert({
    demande_id: data.id,
    action: 'creation',
    nouveau_statut: data.statut,
    effectue_par: demande.technicien_id,
    commentaire: 'Demande créée'
  });
  
  return data;
}

export async function updateDemande(id: string, data: Partial<Demande>): Promise<Demande> {
  const { data: result, error } = await supabase
    .from('demandes')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function traiterDemande(
  id: string, 
  statut: StatutDemande, 
  traitePar: string, 
  commentaire?: string,
  motifRefus?: string
): Promise<Demande> {
  // Récupérer l'ancien statut
  const { data: ancienne } = await supabase
    .from('demandes')
    .select('statut')
    .eq('id', id)
    .single();
  
  const updateData: any = {
    statut,
    traite_par: traitePar,
    date_traitement: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (commentaire) updateData.commentaire_admin = commentaire;
  if (motifRefus) updateData.motif_refus = motifRefus;
  
  const { data: result, error } = await supabase
    .from('demandes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  
  // Créer l'entrée historique
  await supabase.from('demandes_historique').insert({
    demande_id: id,
    action: statut === 'approuve' ? 'approbation' : statut === 'refuse' ? 'refus' : 'modification',
    ancien_statut: ancienne?.statut,
    nouveau_statut: statut,
    effectue_par: traitePar,
    commentaire: commentaire || motifRefus || `Statut changé en ${statut}`
  });
  
  // Si c'est une demande de congé/RTT approuvée, créer l'événement planning
  if (statut === 'approuve' && result.type_demande && ['conge', 'rtt'].includes(result.type_demande)) {
    await supabase.from('planning_events').insert({
      technicien_id: result.technicien_id,
      type_event: result.type_demande,
      titre: result.type_demande === 'conge' ? 'Congé' : 'RTT',
      date_debut: result.date_debut,
      date_fin: result.date_fin,
      journee_complete: true,
      description: result.description,
    });
  }
  
  return result;
}

export async function getDemandeHistorique(demandeId: string): Promise<DemandeHistorique[]> {
  const { data, error } = await supabase
    .from('demandes_historique')
    .select('*, effectue_par_technicien:techniciens(*)')
    .eq('demande_id', demandeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addDemandeComment(
  demandeId: string, 
  commentaire: string, 
  effectuePar: string
): Promise<void> {
  await supabase.from('demandes_historique').insert({
    demande_id: demandeId,
    action: 'commentaire',
    commentaire,
    effectue_par: effectuePar
  });
}

// Vérifier les conflits de congés
export async function checkConflitsConges(
  technicienId: string,
  dateDebut: string,
  dateFin: string
): Promise<{ hasConflict: boolean; conflits: Demande[] }> {
  const { data, error } = await supabase
    .from('demandes')
    .select('*, technicien:techniciens(*)')
    .in('type_demande', ['conge', 'rtt'])
    .eq('statut', 'approuve')
    .neq('technicien_id', technicienId)
    .or(`date_debut.lte.${dateFin},date_fin.gte.${dateDebut}`);
  
  if (error) throw error;
  
  // Filtrer pour ne garder que les vraies intersections
  const conflits = (data || []).filter(d => {
    const dDebut = new Date(d.date_debut!);
    const dFin = new Date(d.date_fin!);
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    return dDebut <= fin && dFin >= debut;
  });
  
  return { hasConflict: conflits.length > 0, conflits };
}

// Calculer le nombre de jours ouvrés entre deux dates
export function calculerJoursOuvres(dateDebut: string, dateFin: string, demiJourneeDebut = false, demiJourneeFin = false): number {
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  let jours = 0;
  
  const current = new Date(debut);
  while (current <= fin) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Pas samedi/dimanche
      jours++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  // Ajuster pour les demi-journées
  if (demiJourneeDebut) jours -= 0.5;
  if (demiJourneeFin) jours -= 0.5;
  
  return Math.max(0, jours);
}

// Statistiques des demandes
export async function getDemandesStats(technicienId?: string): Promise<{
  total: number;
  par_statut: Record<string, number>;
  par_type: Record<string, number>;
  en_attente_depuis_48h: number;
}> {
  let query = supabase.from('demandes').select('*').or('archive.is.null,archive.eq.false');
  
  if (technicienId) {
    query = query.eq('technicien_id', technicienId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  const demandes = data || [];
  const maintenant = new Date();
  const il_y_a_48h = new Date(maintenant.getTime() - 48 * 60 * 60 * 1000);
  
  return {
    total: demandes.length,
    par_statut: demandes.reduce((acc, d) => {
      acc[d.statut] = (acc[d.statut] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    par_type: demandes.reduce((acc, d) => {
      acc[d.type_demande] = (acc[d.type_demande] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    en_attente_depuis_48h: demandes.filter(d => 
      d.statut === 'en_attente' && new Date(d.created_at) < il_y_a_48h
    ).length
  };
}

// ================================================
// DOCUMENTS (GED)
// ================================================
export async function getDocuments(options?: { ascenseur_id?: string }): Promise<Document[]> {
  let query = supabase
    .from('documents')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false });
  
  if (options?.ascenseur_id) {
    query = query.eq('ascenseur_id', options.ascenseur_id);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ================================================
// PLANNING
// ================================================
export async function getPlanningEvents(dateDebut: string, dateFin: string): Promise<PlanningEvent[]> {
  const { data, error } = await supabase.from('planning_events').select('*, technicien:techniciens(*)')
    .gte('date_debut', dateDebut).lte('date_fin', dateFin).order('date_debut');
  if (error) throw error;
  return data || [];
}

export async function createPlanningEvent(event: Partial<PlanningEvent>): Promise<PlanningEvent> {
  const { data, error } = await supabase.from('planning_events').insert(event).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlanningEvent(id: string, data: Partial<PlanningEvent>): Promise<PlanningEvent> {
  const { data: result, error } = await supabase.from('planning_events').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function deletePlanningEvent(id: string): Promise<void> {
  const { error } = await supabase.from('planning_events').delete().eq('id', id);
  if (error) throw error;
}

// Éléments non planifiés
export async function getTravauxNonPlanifies(): Promise<Travaux[]> {
  const { data: planifies } = await supabase.from('planning_events').select('travaux_id').not('travaux_id', 'is', null);
  const planifiesIds = planifies?.map(p => p.travaux_id).filter(Boolean) || [];
  
  let query = supabase.from('travaux').select('*, client:clients(*), technicien:techniciens!travaux_technicien_id_fkey(*)')
    .in('statut', ['planifie', 'en_cours']);
  
  if (planifiesIds.length > 0) {
    query = query.not('id', 'in', `(${planifiesIds.join(',')})`);
  }
  
  const { data, error } = await query.order('priorite', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMESNonPlanifiees(): Promise<MiseEnService[]> {
  const { data: planifies } = await supabase.from('planning_events').select('mise_service_id').not('mise_service_id', 'is', null);
  const planifiesIds = planifies?.map(p => p.mise_service_id).filter(Boolean) || [];
  
  let query = supabase.from('mise_en_service').select('*, ascenseur:ascenseurs(*), technicien:techniciens(*)')
    .in('statut', ['planifie', 'en_cours']);
  
  if (planifiesIds.length > 0) {
    query = query.not('id', 'in', `(${planifiesIds.join(',')})`);
  }
  
  const { data, error } = await query.order('date_prevue');
  if (error) throw error;
  return data || [];
}

export async function getTourneesActives(): Promise<Tournee[]> {
  const { data, error } = await supabase.from('tournees').select('*, technicien:techniciens(*)').eq('actif', true).order('code');
  if (error) throw error;
  return data || [];
}

export async function getTechniciens(): Promise<Technicien[]> {
  const { data, error } = await supabase.from('techniciens').select('*, role:roles(*)').eq('actif', true).order('nom');
  if (error) throw error;
  return data || [];
}

// ================================================
// FEUILLES D'HEURES
// ================================================
export async function getSemaine(technicienId: string, annee: number, numeroSemaine: number): Promise<SemaineAvecDetails | null> {
  let { data: semaine, error } = await supabase.from('semaines')
    .select('*, jours(*, taches(*)), astreintes(*)')
    .eq('technicien_id', technicienId).eq('annee', annee).eq('numero_semaine', numeroSemaine).single();

  if (error && error.code === 'PGRST116') {
    semaine = await creerSemaine(technicienId, annee, numeroSemaine);
  } else if (error) throw error;
  if (!semaine) return null;

  // Trier les jours par jour_semaine (0=lundi, 4=vendredi)
  const joursTries = (semaine.jours || []).sort((a: Jour, b: Jour) => a.jour_semaine - b.jour_semaine);
  
  const totaux = calculerTotaux(joursTries, semaine.astreintes || []);
  return { ...semaine, jours: joursTries, astreintes: semaine.astreintes || [], totaux };
}

export async function creerSemaine(technicienId: string, annee: number, numeroSemaine: number): Promise<Semaine> {
  const dates = getDatesSemaine(annee, numeroSemaine);
  const { data: semaine, error } = await supabase.from('semaines').insert({
    technicien_id: technicienId, annee, numero_semaine: numeroSemaine,
    date_debut: format(dates[0], 'yyyy-MM-dd'), date_fin: format(dates[4], 'yyyy-MM-dd'), statut: 'brouillon',
  }).select().single();
  if (error) throw error;

  const joursData = dates.map((d, i) => ({
    semaine_id: semaine.id, date: format(d, 'yyyy-MM-dd'), jour_semaine: i,
    type_jour: 'travail', heures_reference: i === 4 ? 7 : 8, lieu_depart: 'Domicile', duree_pause: '01:00:00',
  }));
  await supabase.from('jours').insert(joursData);
  return semaine;
}

export async function updateJour(jourId: string, data: Partial<Jour>): Promise<Jour> {
  const { data: jour, error } = await supabase.from('jours').update(data).eq('id', jourId).select().single();
  if (error) throw error;
  return jour;
}

export async function creerTache(jourId: string, data: Partial<Tache>): Promise<Tache> {
  const { data: tache, error } = await supabase.from('taches').insert({ jour_id: jourId, ...data }).select().single();
  if (error) throw error;
  return tache;
}

export async function updateTache(tacheId: string, data: Partial<Tache>): Promise<Tache> {
  const { data: tache, error } = await supabase.from('taches').update(data).eq('id', tacheId).select().single();
  if (error) throw error;
  return tache;
}

export async function deleteTache(tacheId: string): Promise<void> {
  const { error } = await supabase.from('taches').delete().eq('id', tacheId);
  if (error) throw error;
}

export async function creerAstreinte(semaineId: string, data: Partial<Astreinte>): Promise<Astreinte> {
  const { data: astreinte, error } = await supabase.from('astreintes').insert({ semaine_id: semaineId, ...data }).select().single();
  if (error) throw error;
  return astreinte;
}

export async function updateAstreinte(astreinteId: string, data: Partial<Astreinte>): Promise<Astreinte> {
  const { data: astreinte, error } = await supabase.from('astreintes').update(data).eq('id', astreinteId).select().single();
  if (error) throw error;
  return astreinte;
}

export async function deleteAstreinte(astreinteId: string): Promise<void> {
  const { error } = await supabase.from('astreintes').delete().eq('id', astreinteId);
  if (error) throw error;
}

// Mettre à jour les infos de la semaine (astreintes cochées, etc.)
export async function updateSemaine(
  semaineId: string, 
  data: { 
    astreinte_semaine?: boolean; 
    astreinte_weekend?: boolean; 
    astreinte_ferie?: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('semaines')
    .update(data)
    .eq('id', semaineId);
  if (error) throw error;
}

export async function validerSemaine(semaineId: string, validePar: string): Promise<{ deduction_rtt: number }> {
  // 1. Récupérer la semaine avec ses jours et astreintes
  const { data: semaine, error: fetchError } = await supabase
    .from('semaines')
    .select('*, jours(*), astreintes(*)')
    .eq('id', semaineId)
    .single();
  
  if (fetchError) throw fetchError;
  if (!semaine) throw new Error('Semaine non trouvée');

  // 2. Calculer les totaux et heures manquantes
  const totaux = calculerTotaux(semaine.jours || [], semaine.astreintes || []);
  
  // 3. Si heures manquantes, déduire du solde RTT
  if (totaux.deduction_rtt > 0) {
    const anneeConges = getAnneeConges(new Date(semaine.date_debut));
    
    // Récupérer ou créer le solde
    let { data: solde } = await supabase
      .from('soldes_conges')
      .select('*')
      .eq('technicien_id', semaine.technicien_id)
      .eq('annee_conges', anneeConges)
      .single();
    
    if (!solde) {
      // Créer le solde s'il n'existe pas
      const { data: newSolde, error: insertError } = await supabase
        .from('soldes_conges')
        .insert({
          technicien_id: semaine.technicien_id,
          annee_conges: anneeConges,
          rtt_pris: totaux.deduction_rtt,
        })
        .select()
        .single();
      
      if (insertError) console.warn('Erreur création solde:', insertError);
      solde = newSolde;
    } else {
      // Mettre à jour le solde existant (ajouter les heures manquantes aux RTT pris)
      const { error: updateError } = await supabase
        .from('soldes_conges')
        .update({ 
          rtt_pris: (solde.rtt_pris || 0) + totaux.deduction_rtt,
          updated_at: new Date().toISOString()
        })
        .eq('id', solde.id);
      
      if (updateError) console.warn('Erreur mise à jour solde RTT:', updateError);
    }
  }

  // 4. Marquer la semaine comme validée
  const { error } = await supabase
    .from('semaines')
    .update({ 
      statut: 'soumis', 
      valide_par: validePar, 
      valide_at: new Date().toISOString(),
      deduction_rtt_appliquee: totaux.deduction_rtt // Sauvegarder la déduction appliquée
    })
    .eq('id', semaineId);
  
  if (error) throw error;
  
  return { deduction_rtt: totaux.deduction_rtt };
}

// ================================================
// UTILITAIRES
// ================================================
export function parseIntervalToHours(interval: string): number {
  if (!interval) return 0;
  const timeMatch = interval.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) return parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60;
  const hMatch = interval.match(/^(\d+)h(\d{0,2})$/);
  if (hMatch) return parseInt(hMatch[1], 10) + parseInt(hMatch[2] || '0', 10) / 60;
  return 0;
}

function calculerTotaux(jours: Jour[], astreintes: Astreinte[]): TotauxSemaine {
  const OBJECTIF_HEBDO = 39; // Heures par semaine
  
  let heures_travail = 0, heures_trajet = 0, heures_rtt = 0;
  
  for (const jour of jours) {
    // RTT et congés comptent comme heures de travail normales
    if (jour.type_jour === 'rtt' || jour.type_jour === 'conge' || jour.type_jour === 'ferie' || jour.type_jour === 'formation') {
      heures_travail += jour.heures_reference || 0;
    } else if (jour.type_jour === 'travail') {
      heures_travail += jour.heures_travail || 0;
      heures_trajet += jour.heures_trajet || 0;
    }
    // Maladie ne compte pas dans les heures de travail
    heures_rtt += jour.heures_rtt || 0;
  }
  
  let heures_astreinte_rtt = 0, heures_astreinte_paye = 0;
  for (const a of astreintes) {
    const t = parseIntervalToHours(a.temps_trajet) + parseIntervalToHours(a.temps_site);
    if (a.comptage === 'rtt') heures_astreinte_rtt += t; else heures_astreinte_paye += t;
  }
  
  // Calcul des heures manquantes
  const heures_manquantes = OBJECTIF_HEBDO - heures_travail;
  
  // Les RTT sont en heures, donc la déduction est directement en heures
  // Arrondi à 0.5h près
  const deduction_rtt = heures_manquantes > 0 
    ? Math.round(heures_manquantes * 2) / 2 
    : 0;
  
  return { 
    heures_travail, 
    heures_trajet, 
    heures_rtt, 
    heures_astreinte_rtt, 
    heures_astreinte_paye, 
    progression: Math.min(100, (heures_travail / OBJECTIF_HEBDO) * 100),
    heures_manquantes: Math.max(0, heures_manquantes),
    deduction_rtt // En heures
  };
}

// ================================================
// SOLDES CONGÉS / RTT
// ================================================

export interface SoldeConges {
  id: string;
  technicien_id: string;
  annee_conges: number;
  conges_initial: number;
  conges_acquis: number;
  conges_pris: number;
  conges_solde?: number;
  rtt_initial: number;
  rtt_acquis: number;
  rtt_pris: number;
  rtt_solde?: number;
  periode_debut?: string;
  periode_fin?: string;
  verrouille: boolean;
  verrouille_at?: string;
  verrouille_par?: string;
  deverrouille_at?: string;
  deverrouille_par?: string;
}

// Calculer l'année de congés (mai à avril)
export function getAnneeConges(date: Date = new Date()): number {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  // Si entre janvier et avril, on est dans l'année précédente
  return month < 5 ? year - 1 : year;
}

export async function getSoldeConges(technicienId: string, anneeConges?: number): Promise<SoldeConges | null> {
  const annee = anneeConges ?? getAnneeConges();
  
  // Essayer de récupérer le solde existant
  let { data, error } = await supabase
    .from('soldes_conges')
    .select('*')
    .eq('technicien_id', technicienId)
    .eq('annee_conges', annee)
    .single();

  if (error && error.code === 'PGRST116') {
    // Créer le solde s'il n'existe pas
    const { data: newData, error: insertError } = await supabase
      .from('soldes_conges')
      .insert({
        technicien_id: technicienId,
        annee_conges: annee,
        conges_initial: 0,
        conges_acquis: calculerCongesAcquis(annee),
        conges_pris: 0,
        rtt_initial: 0,
        rtt_acquis: 0,
        rtt_pris: 0,
      })
      .select()
      .single();
    
    if (insertError) {
      console.warn('Erreur création solde congés:', insertError);
      return null;
    }
    data = newData;
  } else if (error) {
    console.warn('Erreur récupération solde congés:', error);
    return null;
  }

  if (!data) return null;

  // Calculer les soldes
  return {
    ...data,
    conges_solde: data.conges_initial + data.conges_acquis - data.conges_pris,
    rtt_solde: data.rtt_initial + data.rtt_acquis - data.rtt_pris,
  };
}

export async function updateSoldeConges(
  technicienId: string, 
  anneeConges: number, 
  data: Partial<SoldeConges>
): Promise<SoldeConges> {
  const { data: result, error } = await supabase
    .from('soldes_conges')
    .update(data)
    .eq('technicien_id', technicienId)
    .eq('annee_conges', anneeConges)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    ...result,
    conges_solde: result.conges_initial + result.conges_acquis - result.conges_pris,
    rtt_solde: result.rtt_initial + result.rtt_acquis - result.rtt_pris,
  };
}

// Verrouiller les soldes (validation définitive)
export async function verrouillerSoldes(
  technicienId: string, 
  anneeConges: number,
  verrouillePar: string
): Promise<SoldeConges> {
  const { data: result, error } = await supabase
    .from('soldes_conges')
    .update({ 
      verrouille: true, 
      verrouille_at: new Date().toISOString(),
      verrouille_par: verrouillePar 
    })
    .eq('technicien_id', technicienId)
    .eq('annee_conges', anneeConges)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    ...result,
    conges_solde: result.conges_initial + result.conges_acquis - result.conges_pris,
    rtt_solde: result.rtt_initial + result.rtt_acquis - result.rtt_pris,
  };
}

// Déverrouiller les soldes (admin seulement)
export async function deverrouillerSoldes(
  technicienId: string, 
  anneeConges: number,
  deverrouillePar: string
): Promise<SoldeConges> {
  const { data: result, error } = await supabase
    .from('soldes_conges')
    .update({ 
      verrouille: false, 
      deverrouille_at: new Date().toISOString(),
      deverrouille_par: deverrouillePar 
    })
    .eq('technicien_id', technicienId)
    .eq('annee_conges', anneeConges)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    ...result,
    conges_solde: result.conges_initial + result.conges_acquis - result.conges_pris,
    rtt_solde: result.rtt_initial + result.rtt_acquis - result.rtt_pris,
  };
}

// Calculer les congés acquis depuis mai (2.08j/mois, max 25j)
function calculerCongesAcquis(anneeConges: number): number {
  const now = new Date();
  const debutPeriode = new Date(anneeConges, 4, 1); // 1er mai
  
  if (now < debutPeriode) return 0;
  
  const moisEcoules = Math.min(12, 
    (now.getFullYear() - debutPeriode.getFullYear()) * 12 
    + now.getMonth() - debutPeriode.getMonth() + 1
  );
  
  return Math.min(25, Math.round(moisEcoules * 2.08 * 100) / 100);
}

export function getDatesSemaine(annee: number, numeroSemaine: number): Date[] {
  const firstDayOfYear = new Date(annee, 0, 1);
  const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
  const firstMonday = addDays(firstDayOfYear, daysToFirstMonday);
  const weekStart = addDays(firstMonday, (numeroSemaine - 1) * 7);
  return [0, 1, 2, 3, 4].map(i => addDays(weekStart, i));
}

export function getSemaineActuelle(): { annee: number; numeroSemaine: number } {
  const now = new Date();
  return { annee: getYear(now), numeroSemaine: getWeek(now, { weekStartsOn: 1, locale: fr }) };
}

// ================================================
// CHAT & MESSAGERIE
// ================================================

export async function getChatChannels(): Promise<ChatChannel[]> {
  const { data, error } = await supabase
    .from('chat_channels')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function getChatMessages(channelId: string, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, sender:techniciens(id, nom, prenom, avatar_initiales)')
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getContextMessages(contextType: 'travaux' | 'mise_service' | 'ascenseur', contextId: string, limit = 50): Promise<ChatMessage[]> {
  const column = contextType === 'mise_service' ? 'mise_service_id' : `${contextType}_id`;
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, sender:techniciens(id, nom, prenom, avatar_initiales)')
    .eq(column, contextId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function sendChatMessage(message: Partial<ChatMessage>): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(message)
    .select('*, sender:techniciens(id, nom, prenom, avatar_initiales)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateChatMessage(id: string, content: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChatMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markChannelAsRead(channelId: string, userId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_message_reads')
    .upsert({
      channel_id: channelId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
      last_read_message_id: messageId,
    }, { onConflict: 'channel_id,user_id' });
  if (error) throw error;
}

export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
  // Get last read timestamps for all channels
  const { data: reads } = await supabase
    .from('chat_message_reads')
    .select('channel_id, last_read_at')
    .eq('user_id', userId);
  
  const readsMap = new Map(reads?.map(r => [r.channel_id, r.last_read_at]) || []);
  
  // Get all channels
  const { data: channels } = await supabase
    .from('chat_channels')
    .select('id');
  
  const counts: Record<string, number> = {};
  
  for (const channel of channels || []) {
    const lastRead = readsMap.get(channel.id);
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channel.id)
      .is('deleted_at', null);
    
    if (lastRead) {
      query = query.gt('created_at', lastRead);
    }
    
    const { count } = await query;
    counts[channel.id] = count || 0;
  }
  
  return counts;
}

export async function createDirectChannel(userId1: string, userId2: string): Promise<ChatChannel> {
  const code = [userId1, userId2].sort().join('-');
  
  // Check if exists
  const { data: existing } = await supabase
    .from('chat_channels')
    .select('*')
    .eq('code', code)
    .single();
  
  if (existing) return existing;
  
  // Create new
  const { data, error } = await supabase
    .from('chat_channels')
    .insert({
      code,
      nom: 'Message direct',
      type: 'direct',
      icone: '👤',
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Add members
  await supabase.from('chat_channel_members').insert([
    { channel_id: data.id, user_id: userId1 },
    { channel_id: data.id, user_id: userId2 },
  ]);
  
  return data;
}

// ================================================
// NOTES & MÉMOS
// ================================================

// Types étendus pour Notes
export interface NoteDossier {
  id: string;
  nom: string;
  description?: string;
  couleur: string;
  icone: string;
  ordre: number;
  parent_id?: string;
  created_at: string;
}

export interface NoteCommentaire {
  id: string;
  note_id: string;
  technicien_id: string;
  contenu: string;
  created_at: string;
  technicien?: { id: string; nom: string; prenom: string; avatar_initiales: string };
}

export interface NotePieceJointe {
  id: string;
  note_id: string;
  nom: string;
  fichier_url: string;
  fichier_type?: string;
  fichier_taille?: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  texte: string;
  fait: boolean;
  ordre: number;
}

// Fonctions Dossiers Notes
export async function getNotesDossiers(): Promise<NoteDossier[]> {
  const { data, error } = await supabase
    .from('notes_dossiers')
    .select('*')
    .order('ordre');
  if (error) {
    console.warn('Table notes_dossiers non disponible');
    return [];
  }
  return data || [];
}

export async function createNoteDossier(dossier: Partial<NoteDossier>): Promise<NoteDossier> {
  const { data, error } = await supabase
    .from('notes_dossiers')
    .insert(dossier)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNoteDossier(id: string, dossier: Partial<NoteDossier>): Promise<NoteDossier> {
  const { data, error } = await supabase
    .from('notes_dossiers')
    .update(dossier)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNoteDossier(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes_dossiers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Fonctions Notes principales
export async function getNotes(technicienId: string, includeShared = true): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales), ascenseur:ascenseurs(id, code, adresse), travaux:travaux(code, titre), client:clients(code, raison_sociale), dossier:notes_dossiers(id, nom, couleur)')
    .eq('archive', false)
    .order('epingle', { ascending: false })
    .order('updated_at', { ascending: false });

  if (includeShared) {
    query = query.or(`technicien_id.eq.${technicienId},partage.eq.true`);
  } else {
    query = query.eq('technicien_id', technicienId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales), ascenseur:ascenseurs(id, code, adresse), travaux:travaux(code, titre), client:clients(code, raison_sociale), dossier:notes_dossiers(id, nom, couleur)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getContextNotes(
  contextType: 'ascenseur' | 'travaux' | 'client' | 'mise_service',
  contextId: string
): Promise<Note[]> {
  const column = `${contextType}_id`;
  const { data, error } = await supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .eq(column, contextId)
    .eq('archive', false)
    .order('epingle', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createNote(note: Partial<Note>): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert(note)
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, updates: Partial<Note>): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function toggleNotePin(id: string, epingle: boolean): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ epingle, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ archive: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Fonctions Commentaires
export async function getNoteCommentaires(noteId: string): Promise<NoteCommentaire[]> {
  const { data, error } = await supabase
    .from('notes_commentaires')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export async function createNoteCommentaire(commentaire: { note_id: string; technicien_id: string; contenu: string }): Promise<NoteCommentaire> {
  const { data, error } = await supabase
    .from('notes_commentaires')
    .insert(commentaire)
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNoteCommentaire(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes_commentaires')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Fonctions Pièces jointes
export async function getNotePiecesJointes(noteId: string): Promise<NotePieceJointe[]> {
  const { data, error } = await supabase
    .from('notes_pieces_jointes')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function uploadNotePieceJointe(noteId: string, file: File, createdBy: string): Promise<NotePieceJointe> {
  // Upload fichier
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `notes/${noteId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) throw new Error('Erreur upload fichier');

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  // Créer entrée en base
  const { data, error } = await supabase
    .from('notes_pieces_jointes')
    .insert({
      note_id: noteId,
      nom: file.name,
      fichier_url: urlData.publicUrl,
      fichier_type: file.type,
      fichier_taille: file.size,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNotePieceJointe(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes_pieces_jointes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// Fonctions Rappels
export async function getNotesAvecRappel(technicienId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom)')
    .not('rappel_date', 'is', null)
    .eq('rappel_envoye', false)
    .eq('archive', false)
    .or(`technicien_id.eq.${technicienId},partage.eq.true`)
    .order('rappel_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function marquerRappelEnvoye(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ rappel_envoye: true })
    .eq('id', noteId);
  if (error) throw error;
}

export async function getNoteCategories(technicienId: string): Promise<NoteCategory[]> {
  const { data, error } = await supabase
    .from('note_categories')
    .select('*')
    .eq('technicien_id', technicienId)
    .order('ordre');
  if (error) throw error;
  return data || [];
}

export async function searchNotes(technicienId: string, query: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales)')
    .or(`technicien_id.eq.${technicienId},partage.eq.true`)
    .eq('archive', false)
    .or(`titre.ilike.%${query}%,contenu.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ================================================
// NOTIFICATIONS
// ================================================

export async function getNotifications(
  technicienId: string, 
  options: { limit?: number; includeRead?: boolean; includeArchived?: boolean } = {}
): Promise<Notification[]> {
  const { limit = 50, includeRead = true, includeArchived = false } = options;
  
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('technicien_id', technicienId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (!includeRead) {
    query = query.eq('lue', false);
  }
  if (!includeArchived) {
    query = query.eq('archivee', false);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount(technicienId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('technicien_id', technicienId)
    .eq('lue', false)
    .eq('archivee', false);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ lue: true, lue_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsAsRead(technicienId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ lue: true, lue_at: new Date().toISOString() })
    .eq('technicien_id', technicienId)
    .eq('lue', false);
  if (error) throw error;
}

export async function archiveNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ archivee: true })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function createNotification(notification: {
  technicien_id: string;
  type: NotificationType;
  priority?: NotificationPriority;
  titre: string;
  message?: string;
  icone?: string;
  couleur?: string;
  lien_type?: string;
  lien_id?: string;
  lien_url?: string;
  data?: Record<string, any>;
}): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getNotificationPreferences(technicienId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('technicien_id', technicienId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateNotificationPreferences(
  technicienId: string, 
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('technicien_id', technicienId)
    .single();
  
  if (existing) {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update({ ...preferences, updated_at: new Date().toISOString() })
      .eq('technicien_id', technicienId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({ technicien_id: technicienId, ...preferences })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ================================================
// ARCHIVAGE
// ================================================

export interface ArchiveItem {
  type: 'travaux' | 'mise_en_service' | 'demande' | 'commande';
  id: string;
  code: string;
  libelle: string;
  statut: string;
  archive_date: string;
  archive_raison?: string;
  archive_par_nom?: string;
  created_at: string;
  date_cloture?: string;
}

export async function getArchives(options?: { 
  type?: 'travaux' | 'mise_en_service' | 'demande' | 'commande';
  limit?: number;
}): Promise<ArchiveItem[]> {
  let query = supabase
    .from('vue_archives')
    .select('*')
    .order('archive_date', { ascending: false });
  
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function archiveTravaux(
  id: string, 
  technicienId: string, 
  raison?: string
): Promise<void> {
  const { error } = await supabase
    .from('travaux')
    .update({
      archive: true,
      archive_date: new Date().toISOString(),
      archive_par: technicienId,
      archive_raison: raison,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function unarchiveTravaux(id: string): Promise<void> {
  const { error } = await supabase
    .from('travaux')
    .update({
      archive: false,
      archive_date: null,
      archive_par: null,
      archive_raison: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveMiseEnService(
  id: string, 
  technicienId: string, 
  raison?: string
): Promise<void> {
  const { error } = await supabase
    .from('mise_en_service')
    .update({
      archive: true,
      archive_date: new Date().toISOString(),
      archive_par: technicienId,
      archive_raison: raison,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function unarchiveMiseEnService(id: string): Promise<void> {
  const { error } = await supabase
    .from('mise_en_service')
    .update({
      archive: false,
      archive_date: null,
      archive_par: null,
      archive_raison: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function archiveDemande(
  id: string, 
  technicienId: string, 
  raison?: string
): Promise<void> {
  const { error } = await supabase
    .from('demandes')
    .update({
      archive: true,
      archive_date: new Date().toISOString(),
      archive_par: technicienId,
      archive_raison: raison,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function unarchiveDemande(id: string): Promise<void> {
  const { error } = await supabase
    .from('demandes')
    .update({
      archive: false,
      archive_date: null,
      archive_par: null,
      archive_raison: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getArchiveStats(): Promise<{
  travaux: number;
  mise_en_service: number;
  demande: number;
  commande: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('vue_archives')
    .select('type');
  
  if (error) throw error;
  
  const stats = {
    travaux: 0,
    mise_en_service: 0,
    demande: 0,
    commande: 0,
    total: data?.length || 0,
  };
  
  data?.forEach(item => {
    if (item.type === 'travaux') stats.travaux++;
    else if (item.type === 'mise_en_service') stats.mise_en_service++;
    else if (item.type === 'demande') stats.demande++;
    else if (item.type === 'commande') stats.commande++;
  });
  
  return stats;
}

// ================================================
// COMMANDES
// ================================================

export async function getCommandes(includeArchived = false): Promise<Commande[]> {
  try {
    let query = supabase
      .from('commandes')
      .select('*, technicien:techniciens!commandes_technicien_id_fkey(*), lignes:commande_lignes(*)')
      .order('created_at', { ascending: false });
    
    if (!includeArchived) {
      query = query.or('archive.is.null,archive.eq.false');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur getCommandes:', error.message, error.details, error.hint);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception getCommandes:', err);
    return [];
  }
}

export async function getCommande(id: string): Promise<Commande | null> {
  const { data, error } = await supabase
    .from('commandes')
    .select('*, technicien:techniciens!commandes_technicien_id_fkey(*), lignes:commande_lignes(*, article:stock_articles(*))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCommande(commande: Partial<Commande>): Promise<Commande> {
  const code = `CMD-${String(Date.now()).slice(-6)}`;
  console.log('createCommande - données envoyées:', { ...commande, code });
  
  const { data, error } = await supabase
    .from('commandes')
    .insert({ ...commande, code })
    .select()
    .single();
  
  if (error) {
    console.error('createCommande - erreur:', error.message, error.details, error.hint);
    throw error;
  }
  return data;
}

export async function updateCommande(id: string, updates: Partial<Commande>): Promise<Commande> {
  const { data, error } = await supabase
    .from('commandes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCommande(id: string): Promise<void> {
  const { error } = await supabase
    .from('commandes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function archiveCommande(
  id: string, 
  technicienId: string, 
  raison?: string
): Promise<void> {
  const { error } = await supabase
    .from('commandes')
    .update({
      archive: true,
      archive_date: new Date().toISOString(),
      archive_par: technicienId,
      archive_raison: raison,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function unarchiveCommande(id: string): Promise<void> {
  const { error } = await supabase
    .from('commandes')
    .update({
      archive: false,
      archive_date: null,
      archive_par: null,
      archive_raison: null,
    })
    .eq('id', id);
  if (error) throw error;
}

// Lignes de commande
export async function addCommandeLigne(ligne: Partial<CommandeLigne>): Promise<CommandeLigne> {
  const { data, error } = await supabase
    .from('commande_lignes')
    .insert(ligne)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCommandeLigne(id: string, updates: Partial<CommandeLigne>): Promise<CommandeLigne> {
  const { data, error } = await supabase
    .from('commande_lignes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCommandeLigne(id: string, commandeId: string): Promise<void> {
  const { error } = await supabase
    .from('commande_lignes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ================================================
// NFC TAGS & SCANS
// ================================================

export async function getNFCTags(options?: {
  type?: TypeTagNFC;
  actif?: boolean;
}): Promise<NFCTag[]> {
  let query = supabase
    .from('nfc_tags')
    .select('*, ascenseur:ascenseurs(*), article:stock_articles(*), vehicule:vehicules(*)')
    .order('created_at', { ascending: false });
  
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.actif !== undefined) {
    query = query.eq('actif', options.actif);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getNFCTagByUID(uid: string): Promise<NFCTag | null> {
  const { data, error } = await supabase
    .from('nfc_tags')
    .select('*, ascenseur:ascenseurs(*, client:clients(*)), article:stock_articles(*), vehicule:vehicules(*)')
    .eq('uid', uid)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function getNFCTag(id: string): Promise<NFCTag | null> {
  const { data, error } = await supabase
    .from('nfc_tags')
    .select('*, ascenseur:ascenseurs(*, client:clients(*)), article:stock_articles(*), vehicule:vehicules(*)')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
}

export async function createNFCTag(tag: Partial<NFCTag>): Promise<NFCTag> {
  const { data, error } = await supabase
    .from('nfc_tags')
    .insert(tag)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNFCTag(id: string, updates: Partial<NFCTag>): Promise<NFCTag> {
  const { data, error } = await supabase
    .from('nfc_tags')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNFCTag(id: string): Promise<void> {
  const { error } = await supabase
    .from('nfc_tags')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getNFCScans(options?: {
  tagId?: string;
  technicienId?: string;
  limit?: number;
}): Promise<NFCScan[]> {
  let query = supabase
    .from('nfc_scans')
    .select('*, tag:nfc_tags(*), technicien:techniciens(*), ascenseur:ascenseurs(*), article:stock_articles(*)')
    .order('created_at', { ascending: false });
  
  if (options?.tagId) {
    query = query.eq('tag_id', options.tagId);
  }
  if (options?.technicienId) {
    query = query.eq('technicien_id', options.technicienId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createNFCScan(scan: {
  tag_id: string;
  technicien_id?: string;
  action: NFCAction;
  ascenseur_id?: string;
  article_id?: string;
  quantite?: number;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, any>;
  device_info?: string;
}): Promise<NFCScan> {
  const { data, error } = await supabase
    .from('nfc_scans')
    .insert(scan)
    .select()
    .single();
  if (error) throw error;
  
  // Mettre à jour la dernière utilisation du tag
  await supabase
    .from('nfc_tags')
    .update({ derniere_utilisation: new Date().toISOString() })
    .eq('id', scan.tag_id);
  
  return data;
}

export async function getNFCStats(): Promise<{
  total: number;
  ascenseur: number;
  emplacement: number;
  article: number;
  scansToday: number;
  nonAssocies: number;
}> {
  const { data: tags } = await supabase
    .from('nfc_tags')
    .select('type, ascenseur_id, emplacement_code, article_id');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: scansToday } = await supabase
    .from('nfc_scans')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  
  const stats = {
    total: tags?.length || 0,
    ascenseur: tags?.filter(t => t.type === 'ascenseur').length || 0,
    emplacement: tags?.filter(t => t.type === 'emplacement').length || 0,
    article: tags?.filter(t => t.type === 'article').length || 0,
    scansToday: scansToday || 0,
    nonAssocies: tags?.filter(t => 
      !t.ascenseur_id && !t.emplacement_code && !t.article_id
    ).length || 0,
  };
  
  return stats;
}

// ================================================
// DOCUMENTS BY ASCENSEUR (pour scan NFC)
// ================================================

export async function getDocumentsByAscenseur(ascenseurId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('ascenseur_id', ascenseurId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDocumentsByCodeAscenseur(codeAscenseur: string): Promise<any[]> {
  // Chercher par code_ascenseur exact ou dans le nom du document
  const { data: byCode, error: error1 } = await supabase
    .from('documents')
    .select('*')
    .eq('code_ascenseur', codeAscenseur)
    .order('created_at', { ascending: false });
  
  const { data: byName, error: error2 } = await supabase
    .from('documents')
    .select('*')
    .ilike('nom', `%${codeAscenseur}%`)
    .order('created_at', { ascending: false });
  
  // Fusionner et dédupliquer
  const allDocs = [...(byCode || []), ...(byName || [])];
  const uniqueDocs = allDocs.filter((doc, index, self) => 
    index === self.findIndex(d => d.id === doc.id)
  );
  
  // Trier par date décroissante
  uniqueDocs.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  return uniqueDocs;
}

export async function uploadDocumentForAscenseur(
  file: File, 
  codeAscenseur: string,
  typeDocument: string = 'autre'
): Promise<any> {
  // Upload le fichier vers Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${codeAscenseur}_${Date.now()}.${fileExt}`;
  const filePath = `ascenseurs/${codeAscenseur}/${fileName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);
  
  if (uploadError) throw uploadError;
  
  // Obtenir l'URL publique
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);
  
  // Créer l'entrée dans la table documents
  const { data, error } = await supabase
    .from('documents')
    .insert({
      nom: file.name,
      type_document: typeDocument,
      fichier_url: urlData.publicUrl,
      fichier_taille: file.size,
      code_ascenseur: codeAscenseur,
      dossier: 'ascenseurs'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getTravauxByAscenseur(ascenseurId: string): Promise<any[]> {
  const { data: ascenseur } = await supabase
    .from('ascenseurs')
    .select('client_id')
    .eq('id', ascenseurId)
    .single();
  
  if (!ascenseur?.client_id) return [];
  
  const { data, error } = await supabase
    .from('travaux')
    .select('*')
    .eq('client_id', ascenseur.client_id)
    .in('statut', ['planifie', 'en_cours'])
    .or('archive.is.null,archive.eq.false')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getNotesByAscenseur(ascenseurId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, technicien:techniciens(*)')
    .contains('tags', ['ascenseur'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Aliases pour compatibilité (camelCase)
export const getNfcTagByUid = getNFCTagByUID;
export const createNfcScan = createNFCScan;
export const getNfcTags = getNFCTags;
export const getNfcTag = getNFCTag;
export const createNfcTag = createNFCTag;
export const updateNfcTag = updateNFCTag;
export const deleteNfcTag = deleteNFCTag;
export const getNfcScans = getNFCScans;
export const getNfcStats = getNFCStats;

// === RÉCEPTION COMMANDES - WORKFLOW INTELLIGENT ===

// Récupérer les travaux en attente de pièces (source='commande', non consommées)
export async function getTravauxEnAttentePieces(): Promise<any[]> {
  const { data, error } = await supabase
    .from('travaux')
    .select('*, ascenseur:ascenseurs(*), client:clients(*)')
    .not('pieces', 'eq', '[]')
    .in('statut', ['a_planifier', 'planifie', 'en_cours'])
    .or('archive.is.null,archive.eq.false')
    .order('date_butoir', { ascending: true });
  
  if (error) {
    console.error('Erreur getTravauxEnAttentePieces:', error);
    return [];
  }
  
  // Filtrer ceux qui ont des pièces en attente (source='commande' et non consommées)
  return (data || []).filter(travail => {
    const pieces = travail.pieces || [];
    return pieces.some((p: any) => p.source === 'commande' && !p.consommee);
  });
}

// Trouver les travaux qui ont besoin d'un article spécifique
export async function getTravauxNeedingArticle(articleId?: string, designation?: string): Promise<any[]> {
  const travauxEnAttente = await getTravauxEnAttentePieces();
  
  return travauxEnAttente.filter(travail => {
    const pieces = travail.pieces || [];
    return pieces.some((p: any) => {
      if (p.source !== 'commande' || p.consommee) return false;
      // Match par article_id ou par designation (pour les pièces manuelles)
      if (articleId && p.article_id === articleId) return true;
      if (designation && p.designation?.toLowerCase().includes(designation.toLowerCase())) return true;
      return false;
    });
  });
}

// Affecter des pièces reçues à un travail
export async function affecterPiecesATravail(
  travailId: string, 
  articleId: string | undefined, 
  designation: string,
  quantiteAffectee: number
): Promise<void> {
  // Récupérer le travail
  const { data: travail, error: fetchError } = await supabase
    .from('travaux')
    .select('pieces, code')
    .eq('id', travailId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const pieces = travail.pieces || [];
  let resteAAfecter = quantiteAffectee;
  
  // Mettre à jour les pièces correspondantes
  const updatedPieces = pieces.map((p: any) => {
    if (resteAAfecter <= 0) return p;
    if (p.source !== 'commande' || p.statut === 'en_stock' || p.consommee) return p;
    
    // Match par article_id ou designation
    const match = (articleId && p.article_id === articleId) || 
                  (designation && p.designation?.toLowerCase() === designation.toLowerCase());
    
    if (match) {
      const qteNecessaire = p.quantite - (p.quantite_recue || 0);
      const qteAAffecter = Math.min(resteAAfecter, qteNecessaire);
      resteAAfecter -= qteAAffecter;
      
      const newQteRecue = (p.quantite_recue || 0) + qteAAffecter;
      const isComplete = newQteRecue >= p.quantite;
      
      return {
        ...p,
        quantite_recue: newQteRecue,
        statut: isComplete ? 'en_stock' : 'en_attente',
        consommee: false, // Pas encore consommée, juste en stock
      };
    }
    return p;
  });
  
  // Sauvegarder
  const { error: updateError } = await supabase
    .from('travaux')
    .update({ pieces: updatedPieces, updated_at: new Date().toISOString() })
    .eq('id', travailId);
  
  if (updateError) throw updateError;
  
  // Créer un mouvement de stock "sortie vers travaux" si on a un articleId
  if (articleId && quantiteAffectee > 0) {
    // On enregistre une sortie du stock vers le travail
    await createStockMouvement(
      articleId, 
      'sortie', 
      quantiteAffectee, 
      `Affectation travaux ${travail.code}`
    );
  }
}

// Réceptionner une ligne de commande avec distribution intelligente
export async function receptionnerLigneCommande(
  ligneId: string,
  quantiteRecue: number,
  articleId: string | null | undefined,
  designation: string,
  affectations: { travailId: string; quantite: number }[],
  ajouterAuStock: number
): Promise<void> {
  // Valider l'articleId
  const validArticleId = (typeof articleId === 'string' && articleId.length > 0) ? articleId : null;
  
  // 1. Mettre à jour la ligne de commande
  await updateCommandeLigne(ligneId, { quantite_recue: quantiteRecue });
  
  // 2. Entrée totale au stock d'abord (si on a un articleId)
  if (quantiteRecue > 0 && validArticleId) {
    await createStockMouvement(validArticleId, 'entree', quantiteRecue, 'Réception commande');
  }
  
  // 3. Sorties vers travaux (les affectations créent des mouvements de sortie)
  for (const aff of affectations) {
    if (aff.quantite > 0) {
      await affecterPiecesATravailSansMouvement(aff.travailId, validArticleId || undefined, designation, aff.quantite);
      
      // Créer le mouvement de sortie vers travaux
      if (validArticleId) {
        // Récupérer le code du travail pour le motif
        const { data: travail } = await supabase
          .from('travaux')
          .select('code')
          .eq('id', aff.travailId)
          .single();
        
        await createStockMouvement(
          validArticleId, 
          'sortie', 
          aff.quantite, 
          `Affectation travaux ${travail?.code || aff.travailId}`
        );
      }
    }
  }
}

// Version sans mouvement de stock (utilisée par receptionnerLigneCommande)
async function affecterPiecesATravailSansMouvement(
  travailId: string, 
  articleId: string | undefined, 
  designation: string,
  quantiteAffectee: number
): Promise<void> {
  const { data: travail, error: fetchError } = await supabase
    .from('travaux')
    .select('pieces')
    .eq('id', travailId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const pieces = travail.pieces || [];
  let resteAAfecter = quantiteAffectee;
  
  const updatedPieces = pieces.map((p: any) => {
    if (resteAAfecter <= 0) return p;
    if (p.source !== 'commande' || p.statut === 'en_stock' || p.consommee) return p;
    
    const match = (articleId && p.article_id === articleId) || 
                  (designation && p.designation?.toLowerCase() === designation.toLowerCase());
    
    if (match) {
      const qteNecessaire = p.quantite - (p.quantite_recue || 0);
      const qteAAffecter = Math.min(resteAAfecter, qteNecessaire);
      resteAAfecter -= qteAAffecter;
      
      const newQteRecue = (p.quantite_recue || 0) + qteAAffecter;
      const isComplete = newQteRecue >= p.quantite;
      
      return {
        ...p,
        quantite_recue: newQteRecue,
        statut: isComplete ? 'en_stock' : 'en_attente',
        consommee: false,
      };
    }
    return p;
  });
  
  const { error: updateError } = await supabase
    .from('travaux')
    .update({ pieces: updatedPieces, updated_at: new Date().toISOString() })
    .eq('id', travailId);
  
  if (updateError) throw updateError;
}

// ================================================
// GED - GESTION ELECTRONIQUE DES DOCUMENTS
// ================================================

export interface GedDossier {
  id: string;
  nom: string;
  description?: string;
  parent_id?: string;
  couleur: string;
  icone: string;
  ordre: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  _count?: number;
}

export async function getGedDossiers(): Promise<GedDossier[]> {
  const { data, error } = await supabase
    .from('ged_dossiers')
    .select('*')
    .order('ordre', { ascending: true });
  if (error) {
    console.warn('Table ged_dossiers non disponible:', error.message);
    return [];
  }
  return data || [];
}

export async function createGedDossier(dossier: Partial<GedDossier>): Promise<GedDossier> {
  const { data, error } = await supabase
    .from('ged_dossiers')
    .insert(dossier)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGedDossier(id: string, dossier: Partial<GedDossier>): Promise<GedDossier> {
  const { data, error } = await supabase
    .from('ged_dossiers')
    .update(dossier)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGedDossier(id: string): Promise<void> {
  const { error } = await supabase
    .from('ged_dossiers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getDocumentsWithDossier(): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, dossier_ged:ged_dossiers(id, nom, couleur)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadDocument(file: File, metadata: {
  nom: string;
  type_document: string;
  dossier_id?: string;
  dossier?: string;
  ascenseur_id?: string;
  client_id?: string;
  code_ascenseur?: string;
}): Promise<Document> {
  // 1. Upload du fichier vers Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  // Organiser dans un sous-dossier si c'est un document d'ascenseur
  const filePath = metadata.code_ascenseur 
    ? `ascenseurs/${metadata.code_ascenseur}/${fileName}`
    : `documents/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Erreur upload:', uploadError);
    throw new Error('Erreur lors de l\'upload du fichier');
  }

  // 2. Obtenir l'URL publique
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  // 3. Créer l'entrée dans la base
  const { data, error } = await supabase
    .from('documents')
    .insert({
      nom: metadata.nom || file.name,
      type_document: metadata.type_document,
      dossier: metadata.code_ascenseur ? 'ascenseurs' : metadata.dossier,
      dossier_id: metadata.dossier_id,
      ascenseur_id: metadata.ascenseur_id,
      client_id: metadata.client_id,
      code_ascenseur: metadata.code_ascenseur,
      fichier_nom: file.name,
      fichier_type: file.type,
      fichier_taille: file.size,
      fichier_url: urlData.publicUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  // Récupérer le document pour avoir le chemin du fichier
  const { data: doc } = await supabase
    .from('documents')
    .select('fichier_url')
    .eq('id', id)
    .single();

  // Supprimer le fichier du storage si présent
  if (doc?.fichier_url) {
    const path = doc.fichier_url.split('/documents/')[1];
    if (path) {
      await supabase.storage.from('documents').remove([`documents/${path}`]);
    }
  }

  // Supprimer l'entrée de la base
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateDocument(id: string, data: Partial<Document>): Promise<Document> {
  const { data: doc, error } = await supabase
    .from('documents')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return doc;
}
