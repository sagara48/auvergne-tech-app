// ═══════════════════════════════════════════════════════════════
// API CONTRÔLES TECHNIQUES — CRUD Supabase
// Calendrier, observations, levées, check-lists, dashboard
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ═══ TYPES ═══

export type TypeControle = 'quinquennal' | 'periodique' | 'semestriel' | 'annuel' | 'exceptionnel';
export type StatutControle = 'planifie' | 'en_cours' | 'termine' | 'annule';
export type GraviteObservation = 'OC' | 'OI' | 'OA'; // Courante, Importante, Anomalie grave
export type StatutObservation = 'ouverte' | 'devis_envoye' | 'travaux_planifies' | 'en_cours' | 'levee' | 'validee';
export type CategorieCheck = 'machinerie' | 'gaine' | 'cabine' | 'portes' | 'securite' | 'eclairage' | 'signalisation' | 'divers';

export const TYPES_CONTROLE: { id: TypeControle; nom: string; frequence: string; organisme: boolean; couleur: string }[] = [
  { id: 'quinquennal', nom: 'Contrôle quinquennal', frequence: '5 ans', organisme: true, couleur: '#B91C1C' },
  { id: 'periodique', nom: 'Inspection périodique', frequence: '5 ans', organisme: true, couleur: '#EA580C' },
  { id: 'annuel', nom: 'Vérification annuelle', frequence: '1 an', organisme: false, couleur: '#3B82F6' },
  { id: 'semestriel', nom: 'Visite semestrielle', frequence: '6 mois', organisme: false, couleur: '#059669' },
  { id: 'exceptionnel', nom: 'Contrôle exceptionnel', frequence: 'ponctuel', organisme: true, couleur: '#8B5CF6' },
];

export const ORGANISMES = [
  { id: 'apave', nom: 'Apave', tel: '0810 141 141' },
  { id: 'bv', nom: 'Bureau Veritas', tel: '0811 701 818' },
  { id: 'socotec', nom: 'Socotec', tel: '0969 398 398' },
  { id: 'dekra', nom: 'Dekra', tel: '0800 32 33 34' },
  { id: 'qualiconsult', nom: 'Qualiconsult', tel: '05 57 22 14 14' },
];

export const GRAVITES: { id: GraviteObservation; nom: string; couleur: string; delai: string; icon: string }[] = [
  { id: 'OA', nom: 'Anomalie grave', couleur: '#DC2626', delai: '3 mois max', icon: '🔴' },
  { id: 'OI', nom: 'Observation importante', couleur: '#EA580C', delai: 'Avant prochain contrôle', icon: '🟠' },
  { id: 'OC', nom: 'Observation courante', couleur: '#CA8A04', delai: 'Recommandation', icon: '🟡' },
];

export const CATEGORIES_CHECK: { id: CategorieCheck; nom: string; icon: string }[] = [
  { id: 'machinerie', nom: 'Machinerie', icon: '⚙️' },
  { id: 'gaine', nom: 'Gaine', icon: '🏗️' },
  { id: 'cabine', nom: 'Cabine', icon: '🛗' },
  { id: 'portes', nom: 'Portes palières', icon: '🚪' },
  { id: 'securite', nom: 'Dispositifs sécurité', icon: '🛡️' },
  { id: 'eclairage', nom: 'Éclairage', icon: '💡' },
  { id: 'signalisation', nom: 'Signalisation', icon: '⚠️' },
  { id: 'divers', nom: 'Divers', icon: '📋' },
];

export interface Controle {
  id: string;
  ascenseur_id: string;
  technicien_id?: string;
  type_controle: TypeControle;
  statut: StatutControle;
  organisme?: string;
  date_planifiee: string;
  date_realisation?: string;
  rapport_url?: string;
  notes?: string;
  score_conformite?: number; // 0-100
  created_at: string;
  updated_at: string;
  // Joins
  ascenseur?: { code: string; adresse: string; marque?: string; client?: { nom: string } };
  observations?: Observation[];
  _observation_count?: number;
  _oa_count?: number;
}

export interface Observation {
  id: string;
  controle_id: string;
  gravite: GraviteObservation;
  statut: StatutObservation;
  categorie: CategorieCheck;
  description: string;
  reference_norme?: string;
  photo_url?: string;
  delai_levee?: string;
  devis_montant?: number;
  travaux_id?: string;
  notes?: string;
  created_at: string;
}

export interface Levee {
  id: string;
  observation_id: string;
  date_levee: string;
  technicien_id?: string;
  description: string;
  photo_avant_url?: string;
  photo_apres_url?: string;
  validee: boolean;
  notes?: string;
}

export interface CheckItem {
  id: string;
  controle_id: string;
  categorie: CategorieCheck;
  libelle: string;
  conforme: boolean | null; // null = non vérifié
  commentaire?: string;
  photo_url?: string;
}

// Items de check-list standard (norme NF EN 13015)
export const CHECKLIST_STANDARD: { categorie: CategorieCheck; items: string[] }[] = [
  { categorie: 'machinerie', items: [
    'Accès machinerie sécurisé', 'Éclairage machinerie', 'Aération / ventilation', 'Propreté locale',
    'Machine de traction — état général', 'Frein — usure garnitures', 'Frein — fonctionnement',
    'Limiteur de vitesse — état', 'Limiteur de vitesse — plombage', 'Armoire de commande — état',
    'Armoire — protections électriques', 'Câbles de traction — usure', 'Câbles — attaches',
  ]},
  { categorie: 'gaine', items: [
    'Éclairage gaine', 'Guidage cabine — état rails', 'Guidage contrepoids', 'Amortisseurs cabine',
    'Amortisseurs contrepoids', 'Câble de limiteur', 'Parachute — état', 'Interrupteur cuvette',
    'Échelle cuvette', 'Propreté cuvette', 'Étanchéité gaine',
  ]},
  { categorie: 'cabine', items: [
    'Éclairage cabine', 'Éclairage secours', 'Ventilation cabine', 'Revêtement sol', 'Miroir',
    'Main courante', 'Dispositif anti-vandalisme', 'Affichage étage', 'Boîte à boutons — état',
    'Bouton alarme', 'Interphone / téléphone', 'Trappe de secours', 'Pesée / surcharge',
  ]},
  { categorie: 'portes', items: [
    'Portes palières — état général', 'Jeu porte / linteau < 6mm', 'Contacts de porte',
    'Dispositif anti-pince doigts', 'Verrouillage — fonctionnement', 'Fermeture automatique',
    'Seuil — état / jeu', 'Opérateur porte cabine', 'Cellule de détection',
  ]},
  { categorie: 'securite', items: [
    'Arrêt interrupteur cuvette', 'Arrêt interrupteur toit cabine', 'Commande de secours (pompiers)',
    'Déverrouillage palière', 'Parachute — essai', 'Dispositif anti-dérive', 'Précision d\'arrêt',
    'Protection contre survitesse montée', 'Dispositif UCM',
  ]},
  { categorie: 'eclairage', items: [
    'Éclairage paliers', 'Signalisation présence cabine', 'Éclairage boutons paliers',
    'Indicateur sens de marche', 'Pictogramme alarme incendie',
  ]},
  { categorie: 'signalisation', items: [
    'Plaque constructeur', 'Charge nominale affichée', 'Nombre de personnes affiché',
    'Consignes de sécurité', 'Numéro téléphone dépannage', 'Marquage CE',
  ]},
];

// ═══ CRUD Contrôles ═══

export async function getControles(filters?: { ascenseur_id?: string; statut?: StatutControle; type?: TypeControle }): Promise<Controle[]> {
  let q = supabase.from('controles_techniques').select(`*, ascenseur:ascenseurs(code, adresse, marque, client:clients(nom))`).order('date_planifiee', { ascending: true });
  if (filters?.ascenseur_id) q = q.eq('ascenseur_id', filters.ascenseur_id);
  if (filters?.statut) q = q.eq('statut', filters.statut);
  if (filters?.type) q = q.eq('type_controle', filters.type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getControle(id: string): Promise<Controle> {
  const { data, error } = await supabase.from('controles_techniques').select(`*, ascenseur:ascenseurs(code, adresse, marque, client:clients(nom)), observations:controle_observations(*)`).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createControle(c: Partial<Controle>): Promise<Controle> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('controles_techniques').insert({ ...c, technicien_id: c.technicien_id || user?.id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateControle(id: string, c: Partial<Controle>): Promise<Controle> {
  const { data, error } = await supabase.from('controles_techniques').update(c).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteControle(id: string): Promise<void> {
  const { error } = await supabase.from('controles_techniques').delete().eq('id', id);
  if (error) throw error;
}

// ═══ CRUD Observations ═══

export async function getObservations(controleId: string): Promise<Observation[]> {
  const { data, error } = await supabase.from('controle_observations').select('*').eq('controle_id', controleId).order('gravite', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createObservation(o: Partial<Observation>): Promise<Observation> {
  const { data, error } = await supabase.from('controle_observations').insert(o).select().single();
  if (error) throw error;
  return data;
}

export async function updateObservation(id: string, o: Partial<Observation>): Promise<Observation> {
  const { data, error } = await supabase.from('controle_observations').update(o).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteObservation(id: string): Promise<void> {
  const { error } = await supabase.from('controle_observations').delete().eq('id', id);
  if (error) throw error;
}

// ═══ CRUD Levées ═══

export async function createLevee(l: Partial<Levee>): Promise<Levee> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('controle_levees').insert({ ...l, technicien_id: l.technicien_id || user?.id }).select().single();
  if (error) throw error;
  // Auto-update observation status
  if (l.observation_id) await updateObservation(l.observation_id, { statut: 'levee' });
  return data;
}

export async function getLevees(observationId: string): Promise<Levee[]> {
  const { data, error } = await supabase.from('controle_levees').select('*').eq('observation_id', observationId).order('date_levee', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ═══ CRUD Check-list ═══

export async function getCheckItems(controleId: string): Promise<CheckItem[]> {
  const { data, error } = await supabase.from('controle_check_items').select('*').eq('controle_id', controleId).order('categorie');
  if (error) throw error;
  return data || [];
}

export async function initChecklist(controleId: string): Promise<CheckItem[]> {
  const items: Partial<CheckItem>[] = [];
  CHECKLIST_STANDARD.forEach(cat => cat.items.forEach(libelle => items.push({ controle_id: controleId, categorie: cat.categorie, libelle, conforme: null })));
  const { data, error } = await supabase.from('controle_check_items').insert(items).select();
  if (error) throw error;
  return data || [];
}

export async function updateCheckItem(id: string, ci: Partial<CheckItem>): Promise<CheckItem> {
  const { data, error } = await supabase.from('controle_check_items').update(ci).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ═══ Dashboard stats ═══

export interface ControleStats {
  total: number;
  planifies: number;
  enRetard: number;
  obsOuvertes: number;
  oaOuvertes: number;
  oiOuvertes: number;
  ocOuvertes: number;
  tauxConformite: number;
  prochains: Controle[];
}

export async function getControleStats(): Promise<ControleStats> {
  const { data: controles } = await supabase.from('controles_techniques').select('*, ascenseur:ascenseurs(code, adresse)').order('date_planifiee');
  const { data: obs } = await supabase.from('controle_observations').select('*').in('statut', ['ouverte', 'devis_envoye', 'travaux_planifies', 'en_cours']);
  const all = controles || [];
  const openObs = obs || [];
  const now = new Date().toISOString().slice(0, 10);
  const enRetard = all.filter(c => c.statut === 'planifie' && c.date_planifiee < now);
  const prochains = all.filter(c => c.statut === 'planifie' && c.date_planifiee >= now).slice(0, 5);
  const termines = all.filter(c => c.statut === 'termine');
  const avgConf = termines.length > 0 ? termines.reduce((a, c) => a + (c.score_conformite || 0), 0) / termines.length : 0;

  return {
    total: all.length,
    planifies: all.filter(c => c.statut === 'planifie').length,
    enRetard: enRetard.length,
    obsOuvertes: openObs.length,
    oaOuvertes: openObs.filter(o => o.gravite === 'OA').length,
    oiOuvertes: openObs.filter(o => o.gravite === 'OI').length,
    ocOuvertes: openObs.filter(o => o.gravite === 'OC').length,
    tauxConformite: Math.round(avgConf),
    prochains,
  };
}

// ═══ Ascenseurs list (for selectors) ═══

export async function getAscenseursList(): Promise<{ id: string; code: string; adresse: string; marque?: string }[]> {
  const { data, error } = await supabase.from('ascenseurs').select('id, code, adresse, marque').order('code');
  if (error) throw error;
  return data || [];
}
