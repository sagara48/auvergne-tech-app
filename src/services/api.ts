import { supabase } from './supabase';
import type { Semaine, Jour, Tache, Astreinte, SemaineAvecDetails, TotauxSemaine, DashboardStats,
  Ascenseur, Travaux, MiseEnService, StockArticle, Vehicule, Demande, Document, PlanningEvent, Tournee, Technicien, StockVehicule, StockTransfert, Role, Permission,
  ChatChannel, ChatMessage, ChatMessageRead } from '@/types';
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
    let query = supabase
      .from('travaux')
      .select('*, client:clients(*), technicien:techniciens(*), ascenseur:ascenseurs(*), tournee:tournees(*)')
      .order('created_at', { ascending: false });
    
    if (!includeArchived) {
      query = query.or('archive.is.null,archive.eq.false');
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Erreur getTravaux:', error);
      throw error;
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
  let query = supabase
    .from('mise_en_service')
    .select('*, ascenseur:ascenseurs(*), technicien:techniciens(*)')
    .order('date_prevue');
  
  if (!includeArchived) {
    query = query.or('archive.is.null,archive.eq.false');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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

export async function createStockMouvement(articleId: string, type: string, quantite: number, motif?: string) {
  const article = await supabase.from('stock_articles').select('quantite_stock').eq('id', articleId).single();
  if (article.error) throw article.error;
  
  const newQty = type === 'entree' ? article.data.quantite_stock + quantite : article.data.quantite_stock - quantite;
  
  await supabase.from('stock_mouvements').insert({ article_id: articleId, type_mouvement: type, quantite, motif, quantite_avant: article.data.quantite_stock, quantite_apres: newQty });
  await supabase.from('stock_articles').update({ quantite_stock: newQty }).eq('id', articleId);
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
  const { data, error } = await supabase.from('vehicules').select('*, technicien:techniciens(*)').order('immatriculation');
  if (error) throw error;
  return data || [];
}

export async function updateVehicule(id: string, data: Partial<Vehicule>): Promise<Vehicule> {
  const { data: result, error } = await supabase.from('vehicules').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

// ================================================
// DEMANDES
// ================================================
export async function getDemandes(includeArchived = false): Promise<Demande[]> {
  let query = supabase
    .from('demandes')
    .select('*, technicien:techniciens(*)')
    .order('created_at', { ascending: false });
  
  if (!includeArchived) {
    query = query.or('archive.is.null,archive.eq.false');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createDemande(demande: Partial<Demande>): Promise<Demande> {
  const code = `DEM-${String(Date.now()).slice(-6)}`;
  const { data, error } = await supabase.from('demandes').insert({ ...demande, code }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDemande(id: string, data: Partial<Demande>): Promise<Demande> {
  const { data: result, error } = await supabase.from('demandes').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
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
  
  let query = supabase.from('travaux').select('*, client:clients(*), technicien:techniciens(*)')
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

  const totaux = calculerTotaux(semaine.jours || [], semaine.astreintes || []);
  return { ...semaine, jours: semaine.jours || [], astreintes: semaine.astreintes || [], totaux };
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

export async function validerSemaine(semaineId: string, validePar: string): Promise<void> {
  const { error } = await supabase.from('semaines').update({ statut: 'soumis', valide_par: validePar, valide_at: new Date().toISOString() }).eq('id', semaineId);
  if (error) throw error;
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
  let heures_travail = 0, heures_trajet = 0, heures_rtt = 0;
  for (const jour of jours) {
    heures_travail += jour.heures_travail || 0;
    heures_trajet += jour.heures_trajet || 0;
    heures_rtt += jour.heures_rtt || 0;
  }
  let heures_astreinte_rtt = 0, heures_astreinte_paye = 0;
  for (const a of astreintes) {
    const t = parseIntervalToHours(a.temps_trajet) + parseIntervalToHours(a.temps_site);
    if (a.comptage === 'rtt') heures_astreinte_rtt += t; else heures_astreinte_paye += t;
  }
  return { heures_travail, heures_trajet, heures_rtt, heures_astreinte_rtt, heures_astreinte_paye, progression: Math.min(100, (heures_travail / 39) * 100) };
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

import type { Note, NoteCategory } from '@/types';

export async function getNotes(technicienId: string, includeShared = true): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales), ascenseur:ascenseurs(code, adresse), travaux:travaux(code, titre), client:clients(code, raison_sociale)')
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
    .select('*, technicien:techniciens(id, nom, prenom, avatar_initiales), ascenseur:ascenseurs(code, adresse), travaux:travaux(code, titre), client:clients(code, raison_sociale)')
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

import type { Notification, NotificationPreferences, NotificationType, NotificationPriority } from '@/types';

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

import type { Commande, CommandeLigne, StatutCommande } from '@/types';

export async function getCommandes(includeArchived = false): Promise<Commande[]> {
  let query = supabase
    .from('commandes')
    .select('*, technicien:techniciens(*), lignes:commande_lignes(*)')
    .order('created_at', { ascending: false });
  
  if (!includeArchived) {
    query = query.or('archive.is.null,archive.eq.false');
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCommande(id: string): Promise<Commande | null> {
  const { data, error } = await supabase
    .from('commandes')
    .select('*, technicien:techniciens(*), lignes:commande_lignes(*, article:stock_articles(*))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCommande(commande: Partial<Commande>): Promise<Commande> {
  const code = `CMD-${String(Date.now()).slice(-6)}`;
  const { data, error } = await supabase
    .from('commandes')
    .insert({ ...commande, code })
    .select()
    .single();
  if (error) throw error;
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

import type { NFCTag, NFCScan, TypeTagNFC, NFCAction } from '@/types';

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

