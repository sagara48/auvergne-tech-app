// ================================================
// TYPES TYPESCRIPT - AUVERGNE TECH V3.0
// ================================================

// === ENUMS ===
export type StatutSemaine = 'brouillon' | 'soumis' | 'valide' | 'rejete';
export type TypeJour = 'travail' | 'conge' | 'rtt' | 'maladie' | 'ferie' | 'formation';
export type Periode = 'matin' | 'apres-midi';
export type TypeAstreinte = 'samedi_jour' | 'samedi_nuit' | 'dimanche_jour' | 'dimanche_nuit' | 'nuit_semaine';
export type ComptageAstreinte = 'rtt' | 'paye';

// Labels pour les types de jour
export const TYPES_JOUR_LABELS: Record<TypeJour, string> = {
  travail: 'Travail',
  conge: 'Congé',
  rtt: 'RTT',
  maladie: 'Maladie',
  ferie: 'Férié',
  formation: 'Formation'
};

export type StatutAscenseur = 'en_service' | 'en_panne' | 'arrete' | 'en_travaux';
export type TypeTravaux = 'reparation' | 'modernisation' | 'installation' | 'mise_conformite' | 'depannage';
export type StatutTravaux = 'planifie' | 'en_cours' | 'en_attente' | 'termine' | 'annule';
export type Priorite = 'basse' | 'normale' | 'haute' | 'urgente';
export type TypeDemande = 'piece' | 'conge' | 'materiel' | 'formation' | 'autre';
export type StatutDemande = 'en_attente' | 'approuve' | 'refuse' | 'en_cours' | 'termine';
export type TypeDocument = 'contrat' | 'rapport' | 'photo' | 'facture' | 'devis' | 'plan' | 'certificat' | 'autre';
export type TypeEvent = 'travaux' | 'tournee' | 'mise_service' | 'formation' | 'conge' | 'rtt' | 'astreinte' | 'reunion' | 'autre';
export type StatutVehicule = 'disponible' | 'en_service' | 'maintenance' | 'hors_service';
export type StatutTransfert = 'en_attente' | 'valide' | 'refuse' | 'annule';
export type SourceType = 'depot' | 'vehicule';

// === RÔLES ET PERMISSIONS ===
export interface Role {
  id: string;
  code: string;
  nom: string;
  description?: string;
  niveau: number;
  couleur: string;
}

export interface Permission {
  id: string;
  code: string;
  nom: string;
  description?: string;
  module: string;
}

export interface Technicien {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  avatar_initiales?: string;
  telephone?: string;
  role_id?: string;
  secteur?: string;
  chef_equipe_id?: string;
  vehicule_attribue_id?: string;
  actif: boolean;
  role?: Role;
  permissions?: string[];
  vehicule?: Vehicule;
}

// === ENTITÉS PRINCIPALES ===
export interface Client {
  id: string;
  code: string;
  raison_sociale: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  type_client: string;
  secteur?: string;
  actif: boolean;
}

export interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  type_vehicule: string;
  annee?: number;
  kilometrage: number;
  technicien_id?: string;
  date_ct?: string;
  date_assurance?: string;
  statut: StatutVehicule;
  capacite_stock?: number;
  technicien?: Technicien;
  stock_vehicule?: StockVehicule[];
}

export interface Ascenseur {
  id: string;
  code: string;
  client_id?: string;
  adresse: string;
  ville?: string;
  type_ascenseur: string;
  marque?: string;
  modele?: string;
  type_contrat: string;
  statut: StatutAscenseur;
  secteur?: string;
  tournee_id?: string;
  derniere_visite?: string;
  prochaine_visite?: string;
  client?: Client;
}

export interface Tournee {
  id: string;
  code: string;
  nom: string;
  technicien_id?: string;
  secteur?: string;
  frequence: string;
  nb_ascenseurs: number;
  actif: boolean;
  technicien?: Technicien;
}

// Types pour tâches et pièces de travaux
export interface TravauxTache {
  id?: string;
  description: string;
  statut: 'a_faire' | 'en_cours' | 'termine';
  ordre: number;
}

export interface TravauxPiece {
  id?: string;
  article_id?: string;
  designation: string;
  reference?: string;
  quantite: number;
}

export interface Travaux {
  id: string;
  code: string;
  titre: string;
  description?: string;
  client_id?: string;
  ascenseur_id?: string;
  technicien_id?: string;
  type_travaux: TypeTravaux;
  priorite: Priorite;
  statut: StatutTravaux;
  date_debut?: string;
  date_fin_prevue?: string;
  date_butoir?: string;
  progression: number;
  devis_montant?: number;
  taches?: TravauxTache[];
  pieces?: TravauxPiece[];
  client?: Client;
  ascenseur?: Ascenseur;
  technicien?: Technicien;
}

export interface MiseEnService {
  id: string;
  code: string;
  ascenseur_id?: string;
  technicien_id?: string;
  date_prevue?: string;
  etape_actuelle: number;
  statut: string;
  etape1_preparation: boolean;
  etape2_verification_electrique: boolean;
  etape3_verification_mecanique: boolean;
  etape4_essais_vide: boolean;
  etape5_essais_charge: boolean;
  etape6_securites: boolean;
  etape7_validation: boolean;
  ascenseur?: Ascenseur;
  technicien?: Technicien;
}

// === STOCK ===
export interface StockCategorie {
  id: string;
  nom: string;
  description?: string;
  couleur?: string;
}

export interface StockArticle {
  id: string;
  reference: string;
  designation: string;
  description?: string;
  categorie_id?: string;
  fournisseur?: string;
  marque?: string;
  prix_unitaire?: number;
  quantite_stock: number;
  seuil_alerte: number;
  seuil_critique: number;
  emplacement_depot?: string;
  unite?: string;
  actif: boolean;
  categorie?: StockCategorie;
  // Calculé depuis vue_stock_global
  stock_vehicules?: number;
  stock_total?: number;
}

export interface StockMouvement {
  id: string;
  article_id: string;
  type_mouvement: 'entree' | 'sortie' | 'inventaire' | 'transfert_out' | 'transfert_in';
  quantite: number;
  quantite_avant?: number;
  quantite_apres?: number;
  motif?: string;
  technicien_id?: string;
  vehicule_id?: string;
  created_at: string;
  article?: StockArticle;
  technicien?: Technicien;
}

export interface StockVehicule {
  id: string;
  vehicule_id: string;
  article_id: string;
  quantite: number;
  quantite_min: number;
  quantite_max?: number;
  emplacement?: string;
  derniere_verification?: string;
  vehicule?: Vehicule;
  article?: StockArticle;
}

export interface StockTransfert {
  id: string;
  code?: string;
  article_id: string;
  quantite: number;
  source_type: SourceType;
  source_vehicule_id?: string;
  destination_type: SourceType;
  destination_vehicule_id?: string;
  motif?: string;
  statut: StatutTransfert;
  demande_par?: string;
  valide_par?: string;
  date_demande: string;
  date_validation?: string;
  notes?: string;
  article?: StockArticle;
  source_vehicule?: Vehicule;
  destination_vehicule?: Vehicule;
  demandeur?: Technicien;
  valideur?: Technicien;
}

// === AUTRES ===
export interface Demande {
  id: string;
  code: string;
  technicien_id: string;
  type_demande: TypeDemande;
  objet: string;
  description?: string;
  priorite: Priorite;
  statut: StatutDemande;
  traite_par?: string;
  date_traitement?: string;
  created_at: string;
  technicien?: Technicien;
}

export interface Document {
  id: string;
  nom: string;
  type: string;
  type_document: TypeDocument;
  fichier_url?: string;
  fichier_taille?: number;
  dossier: string;
  client_id?: string;
  ascenseur_id?: string;
  version?: string;
  created_at: string;
  updated_at?: string;
  client?: Client;
  ascenseur?: Ascenseur;
}

// Alias pour la GED
export type GEDDocument = Document;

export interface PlanningEvent {
  id: string;
  titre: string;
  description?: string;
  technicien_id: string;
  type_event: TypeEvent;
  date_debut: string;
  date_fin: string;
  journee_entiere?: boolean;
  travaux_id?: string;
  tournee_id?: string;
  mise_service_id?: string;
  couleur: string;
  recurrent?: boolean;
  created_at?: string;
  technicien?: Technicien;
  travaux?: Travaux;
  tournee?: Tournee;
  mise_en_service?: MiseEnService;
}

// ==========================================
// CHAT & MESSAGERIE
// ==========================================

export type ChatChannelType = 'public' | 'private' | 'direct';
export type ChatMessageType = 'text' | 'image' | 'file' | 'system';

export interface ChatChannel {
  id: string;
  nom: string;
  code: string;
  description?: string;
  type: ChatChannelType;
  icone: string;
  couleur: string;
  created_by?: string;
  created_at?: string;
  // Compteur messages non lus (calculé)
  unread_count?: number;
  last_message?: ChatMessage;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id?: string;
  content: string;
  type: ChatMessageType;
  file_url?: string;
  file_name?: string;
  // Contexte métier
  travaux_id?: string;
  mise_service_id?: string;
  ascenseur_id?: string;
  // Mentions
  mentions?: string[];
  // Métadonnées
  edited_at?: string;
  deleted_at?: string;
  created_at: string;
  // Relations
  sender?: Technicien;
  travaux?: Travaux;
  mise_en_service?: MiseEnService;
  ascenseur?: Ascenseur;
}

export interface ChatMessageRead {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_at: string;
  last_read_message_id?: string;
}

// === FEUILLES D'HEURES ===
export interface Semaine {
  id: string;
  technicien_id: string;
  annee: number;
  numero_semaine: number;
  date_debut: string;
  date_fin: string;
  statut: StatutSemaine;
  jours?: Jour[];
  astreintes?: Astreinte[];
}

export interface Jour {
  id: string;
  semaine_id: string;
  date: string;
  jour_semaine: number;
  type_jour: TypeJour;
  heures_reference: number;
  heure_depart?: string;
  lieu_depart: string;
  heure_arrivee?: string;
  lieu_arrivee?: string;
  duree_pause: string;
  heure_fin?: string;
  heure_retour?: string;
  heures_travail: number;
  heures_trajet: number;
  heures_rtt: number;
  taches?: Tache[];
}

export interface Tache {
  id: string;
  jour_id: string;
  periode: Periode;
  description: string;
  duree: string;
  temps_trajet: string;
  reference_code?: string;
  ordre: number;
}

export interface Astreinte {
  id: string;
  semaine_id: string;
  type_astreinte: TypeAstreinte;
  heure_depart?: string;
  temps_trajet: string;
  motif?: string;
  temps_site: string;
  comptage: ComptageAstreinte;
}

// === DASHBOARD ===
export interface DashboardStats {
  total_ascenseurs: number;
  ascenseurs_en_panne: number;
  travaux_en_cours: number;
  mes_en_cours: number;
  stock_critique: number;
  demandes_en_attente: number;
  transferts_en_attente: number;
}

// === UTILITAIRES ===
export interface SemaineAvecDetails extends Semaine {
  jours: Jour[];
  astreintes: Astreinte[];
  totaux: TotauxSemaine;
}

export interface TotauxSemaine {
  heures_travail: number;
  heures_trajet: number;
  heures_rtt: number;
  heures_astreinte_rtt: number;
  heures_astreinte_paye: number;
  progression: number;
}

export interface JourConfig {
  id: number;
  nom: string;
  nomCourt: string;
  heuresRef: number;
}

// ==========================================
// NOTES & MÉMOS
// ==========================================

export type NoteCategorie = 'perso' | 'technique' | 'client' | 'urgent';

export interface Note {
  id: string;
  technicien_id: string;
  titre: string;
  contenu?: string;
  couleur: string;
  categorie: NoteCategorie;
  tags: string[];
  epingle: boolean;
  archive: boolean;
  rappel_date?: string;
  // Contexte métier
  ascenseur_id?: string;
  travaux_id?: string;
  client_id?: string;
  mise_service_id?: string;
  // Partage
  partage: boolean;
  visible_par: string[];
  // Métadonnées
  created_at: string;
  updated_at: string;
  // Relations
  technicien?: Technicien;
  ascenseur?: Ascenseur;
  travaux?: Travaux;
  client?: Client;
  mise_en_service?: MiseEnService;
}

export interface NoteCategory {
  id: string;
  technicien_id: string;
  nom: string;
  couleur: string;
  icone: string;
  ordre: number;
  created_at: string;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export type NotificationType = 'panne' | 'travaux' | 'mise_service' | 'stock' | 'message' | 'planning' | 'note' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  technicien_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  titre: string;
  message?: string;
  icone?: string;
  couleur?: string;
  lien_type?: string;
  lien_id?: string;
  lien_url?: string;
  lue: boolean;
  lue_at?: string;
  archivee: boolean;
  data?: Record<string, any>;
  created_at: string;
  expires_at?: string;
}

export interface NotificationPreferences {
  id: string;
  technicien_id: string;
  panne_enabled: boolean;
  travaux_enabled: boolean;
  mise_service_enabled: boolean;
  stock_enabled: boolean;
  message_enabled: boolean;
  planning_enabled: boolean;
  note_enabled: boolean;
  sound_enabled: boolean;
  desktop_enabled: boolean;
  email_enabled: boolean;
  dnd_enabled: boolean;
  dnd_start?: string;
  dnd_end?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// NFC
// ==========================================

export type TypeTagNFC = 'ascenseur' | 'emplacement' | 'article';

export type NFCAction = 
  | 'consultation' 
  | 'sortie_stock' 
  | 'entree_stock' 
  | 'inventaire' 
  | 'note' 
  | 'demande' 
  | 'encodage';

export interface NFCTag {
  id: string;
  uid: string;
  type: TypeTagNFC;
  ascenseur_id?: string;
  article_id?: string;
  emplacement_code?: string;
  emplacement_description?: string;
  vehicule_id?: string;
  label?: string;
  notes?: string;
  actif: boolean;
  derniere_utilisation?: string;
  created_at: string;
  updated_at: string;
  // Relations
  ascenseur?: Ascenseur;
  article?: StockArticle;
  vehicule?: Vehicule;
}

// Alias pour compatibilité
export type NfcTag = NFCTag;

export interface NFCScan {
  id: string;
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
  created_at: string;
  // Relations
  tag?: NFCTag;
  technicien?: Technicien;
  ascenseur?: Ascenseur;
  article?: StockArticle;
}

// Alias pour compatibilité
export type NfcScan = NFCScan;

// État du lecteur NFC
export interface NFCReaderState {
  available: boolean;
  reading: boolean;
  writing: boolean;
  error?: string;
  lastTag?: string;
}

// ==========================================
// COMMANDES
// ==========================================

export type StatutCommande = 'brouillon' | 'en_attente' | 'validee' | 'commandee' | 'expediee' | 'recue' | 'annulee';

export interface Commande {
  id: string;
  code: string;
  technicien_id?: string;
  fournisseur?: string;
  reference_fournisseur?: string;
  statut: StatutCommande;
  priorite: Priorite;
  date_commande?: string;
  date_livraison_prevue?: string;
  date_reception?: string;
  notes?: string;
  archive: boolean;
  archive_date?: string;
  archive_par?: string;
  archive_raison?: string;
  created_at: string;
  updated_at: string;
  // Relations
  technicien?: Technicien;
  lignes?: CommandeLigne[];
}

export interface CommandeLigne {
  id: string;
  commande_id: string;
  article_id?: string;
  designation: string;
  reference?: string;
  quantite: number;
  quantite_recue: number;
  notes?: string;
  created_at: string;
  // Relations
  article?: StockArticle;
}

// === CONSTANTES ===
export const JOURS_CONFIG: JourConfig[] = [
  { id: 0, nom: 'Lundi', nomCourt: 'Lun', heuresRef: 8 },
  { id: 1, nom: 'Mardi', nomCourt: 'Mar', heuresRef: 8 },
  { id: 2, nom: 'Mercredi', nomCourt: 'Mer', heuresRef: 8 },
  { id: 3, nom: 'Jeudi', nomCourt: 'Jeu', heuresRef: 8 },
  { id: 4, nom: 'Vendredi', nomCourt: 'Ven', heuresRef: 7 },
];

export const TYPES_ASTREINTE_LABELS: Record<TypeAstreinte, string> = {
  samedi_jour: 'Samedi jour',
  samedi_nuit: 'Samedi nuit',
  dimanche_jour: 'Dimanche jour',
  dimanche_nuit: 'Dimanche nuit',
  nuit_semaine: 'Nuit semaine'
};

export const TYPE_EVENT_COLORS: Record<TypeEvent, string> = {
  travaux: '#ef4444',
  tournee: '#3b82f6',
  mise_service: '#22c55e',
  formation: '#a855f7',
  conge: '#f59e0b',
  rtt: '#06b6d4',
  astreinte: '#ec4899',
  reunion: '#6366f1',
  autre: '#71717a'
};

export const STATUT_TRANSFERT_CONFIG: Record<StatutTransfert, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: '#f59e0b' },
  valide: { label: 'Validé', color: '#22c55e' },
  refuse: { label: 'Refusé', color: '#ef4444' },
  annule: { label: 'Annulé', color: '#71717a' }
};
