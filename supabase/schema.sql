-- ================================================
-- AUVERGNE TECH - SCHÉMA COMPLET V3.0
-- Stock véhicule + Système de permissions
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- 0. TYPES ENUM DE BASE
-- ================================================

CREATE TYPE priorite AS ENUM ('basse', 'normale', 'haute', 'urgente');
CREATE TYPE statut_travaux AS ENUM ('planifie', 'en_cours', 'en_pause', 'termine', 'annule');
CREATE TYPE statut_demande AS ENUM ('en_attente', 'validee', 'refusee', 'traitee');
CREATE TYPE type_demande AS ENUM ('aide', 'piece', 'conge', 'formation', 'autre');
CREATE TYPE statut_transfert AS ENUM ('en_attente', 'accepte', 'refuse', 'termine');
CREATE TYPE type_mouvement AS ENUM ('entree', 'sortie', 'inventaire', 'transfert', 'ajustement');

-- ================================================
-- 1. SYSTÈME DE RÔLES ET PERMISSIONS
-- ================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  niveau INTEGER DEFAULT 0,
  couleur TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- ================================================
-- 2. UTILISATEURS
-- ================================================

CREATE TABLE IF NOT EXISTS techniciens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  avatar_initiales TEXT,
  telephone TEXT,
  role_id UUID REFERENCES roles(id),
  secteur TEXT,
  chef_equipe_id UUID REFERENCES techniciens(id),
  vehicule_attribue_id UUID,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technicien_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  accorde BOOLEAN DEFAULT true,
  UNIQUE(technicien_id, permission_id)
);

-- ================================================
-- 3. CLIENTS
-- ================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  raison_sociale TEXT NOT NULL,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT,
  contact_nom TEXT,
  type_client TEXT DEFAULT 'professionnel',
  secteur TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 4. VÉHICULES (avant stock pour les FK)
-- ================================================

CREATE TABLE IF NOT EXISTS vehicules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  immatriculation TEXT UNIQUE NOT NULL,
  marque TEXT NOT NULL,
  modele TEXT NOT NULL,
  type_vehicule TEXT DEFAULT 'utilitaire',
  annee INTEGER,
  kilometrage INTEGER DEFAULT 0,
  technicien_id UUID REFERENCES techniciens(id),
  date_ct DATE,
  date_assurance DATE,
  statut TEXT DEFAULT 'disponible',
  capacite_stock INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE techniciens ADD CONSTRAINT fk_vehicule 
  FOREIGN KEY (vehicule_attribue_id) REFERENCES vehicules(id) ON DELETE SET NULL;

-- ================================================
-- 5. STOCK DÉPÔT
-- ================================================

CREATE TABLE IF NOT EXISTS stock_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  description TEXT,
  icone TEXT,
  couleur TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL,
  designation TEXT NOT NULL,
  description TEXT,
  categorie_id UUID REFERENCES stock_categories(id),
  fournisseur TEXT,
  marque TEXT,
  prix_unitaire DECIMAL(10,2),
  quantite_stock INTEGER DEFAULT 0,
  seuil_alerte INTEGER DEFAULT 5,
  seuil_critique INTEGER DEFAULT 2,
  emplacement_depot TEXT,
  unite TEXT DEFAULT 'pièce',
  poids_kg DECIMAL(6,3),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_mouvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES stock_articles(id) ON DELETE CASCADE,
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('entree', 'sortie', 'inventaire', 'transfert_out', 'transfert_in')),
  quantite INTEGER NOT NULL,
  quantite_avant INTEGER,
  quantite_apres INTEGER,
  motif TEXT,
  reference_doc TEXT,
  technicien_id UUID REFERENCES techniciens(id),
  vehicule_id UUID REFERENCES vehicules(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 6. STOCK VÉHICULE
-- ================================================

CREATE TABLE IF NOT EXISTS stock_vehicule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicule_id UUID REFERENCES vehicules(id) ON DELETE CASCADE,
  article_id UUID REFERENCES stock_articles(id) ON DELETE CASCADE,
  quantite INTEGER DEFAULT 0,
  quantite_min INTEGER DEFAULT 0,
  quantite_max INTEGER DEFAULT 10,
  emplacement TEXT,
  derniere_verification DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicule_id, article_id)
);

CREATE TABLE IF NOT EXISTS stock_transferts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE,
  article_id UUID REFERENCES stock_articles(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('depot', 'vehicule')),
  source_vehicule_id UUID REFERENCES vehicules(id),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('depot', 'vehicule')),
  destination_vehicule_id UUID REFERENCES vehicules(id),
  motif TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse', 'annule')),
  demande_par UUID REFERENCES techniciens(id),
  valide_par UUID REFERENCES techniciens(id),
  date_demande TIMESTAMPTZ DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 7. ASCENSEURS ET TOURNÉES
-- ================================================

CREATE TABLE IF NOT EXISTS tournees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  technicien_id UUID REFERENCES techniciens(id),
  secteur TEXT,
  frequence TEXT DEFAULT 'mensuelle',
  nb_ascenseurs INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ascenseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  adresse TEXT NOT NULL,
  ville TEXT,
  type_ascenseur TEXT DEFAULT 'passagers',
  marque TEXT,
  modele TEXT,
  type_contrat TEXT DEFAULT 'entretien',
  statut TEXT DEFAULT 'en_service',
  secteur TEXT,
  tournee_id UUID REFERENCES tournees(id),
  derniere_visite DATE,
  prochaine_visite DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 8. TRAVAUX ET MISE EN SERVICE
-- ================================================

CREATE TABLE IF NOT EXISTS travaux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id),
  ascenseur_id UUID REFERENCES ascenseurs(id),
  technicien_id UUID REFERENCES techniciens(id),
  type_travaux TEXT DEFAULT 'reparation',
  priorite TEXT DEFAULT 'normale',
  statut TEXT DEFAULT 'planifie',
  date_debut DATE,
  date_fin_prevue DATE,
  date_butoir DATE,
  progression INTEGER DEFAULT 0,
  devis_montant DECIMAL(10,2),
  taches JSONB DEFAULT '[]',           -- Liste des tâches à réaliser
  pieces JSONB DEFAULT '[]',           -- Liste des pièces nécessaires
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mise_en_service (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  ascenseur_id UUID REFERENCES ascenseurs(id),
  technicien_id UUID REFERENCES techniciens(id),
  client_id UUID REFERENCES clients(id),
  date_prevue DATE,
  etape_actuelle INTEGER DEFAULT 1,
  statut TEXT DEFAULT 'planifie',
  etape1_preparation BOOLEAN DEFAULT false,
  etape2_verification_electrique BOOLEAN DEFAULT false,
  etape3_verification_mecanique BOOLEAN DEFAULT false,
  etape4_essais_vide BOOLEAN DEFAULT false,
  etape5_essais_charge BOOLEAN DEFAULT false,
  etape6_securites BOOLEAN DEFAULT false,
  etape7_validation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 9. DEMANDES, DOCUMENTS, PLANNING
-- ================================================

CREATE TABLE IF NOT EXISTS demandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  technicien_id UUID REFERENCES techniciens(id),
  type_demande TEXT NOT NULL,
  objet TEXT NOT NULL,
  description TEXT,
  priorite TEXT DEFAULT 'normale',
  statut TEXT DEFAULT 'en_attente',
  traite_par UUID REFERENCES techniciens(id),
  date_traitement TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  type_document TEXT NOT NULL,
  fichier_url TEXT,
  fichier_taille INTEGER,
  dossier TEXT DEFAULT 'general',
  client_id UUID REFERENCES clients(id),
  ascenseur_id UUID REFERENCES ascenseurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titre TEXT NOT NULL,
  description TEXT,
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  type_event TEXT NOT NULL CHECK (type_event IN ('travaux', 'tournee', 'mise_service', 'formation', 'conge', 'rtt', 'astreinte', 'reunion', 'autre')),
  date_debut TIMESTAMPTZ NOT NULL,
  date_fin TIMESTAMPTZ NOT NULL,
  journee_entiere BOOLEAN DEFAULT false,
  travaux_id UUID REFERENCES travaux(id) ON DELETE SET NULL,
  tournee_id UUID REFERENCES tournees(id) ON DELETE SET NULL,
  mise_service_id UUID REFERENCES mise_en_service(id) ON DELETE SET NULL,
  couleur TEXT DEFAULT '#3b82f6',
  recurrent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_technicien ON planning_events(technicien_id);
CREATE INDEX IF NOT EXISTS idx_planning_dates ON planning_events(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_planning_travaux ON planning_events(travaux_id);
CREATE INDEX IF NOT EXISTS idx_planning_tournee ON planning_events(tournee_id);
CREATE INDEX IF NOT EXISTS idx_planning_mes ON planning_events(mise_service_id);

-- ================================================
-- 10. FEUILLES D'HEURES
-- ================================================

CREATE TABLE IF NOT EXISTS semaines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id),
  annee INTEGER NOT NULL,
  numero_semaine INTEGER NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'brouillon',
  valide_par UUID REFERENCES techniciens(id),
  valide_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(technicien_id, annee, numero_semaine)
);

CREATE TABLE IF NOT EXISTS jours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semaine_id UUID REFERENCES semaines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  jour_semaine INTEGER NOT NULL,
  type_jour TEXT DEFAULT 'travail',
  heures_reference DECIMAL(4,2) DEFAULT 8.00,
  heure_depart TIME,
  lieu_depart TEXT DEFAULT 'Domicile',
  heure_arrivee TIME,
  lieu_arrivee TEXT,
  duree_pause INTERVAL DEFAULT '01:00:00',
  heure_fin TIME,
  heure_retour TIME,
  heures_travail DECIMAL(4,2) DEFAULT 0,
  heures_trajet DECIMAL(4,2) DEFAULT 0,
  heures_rtt DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jour_id UUID REFERENCES jours(id) ON DELETE CASCADE,
  periode TEXT DEFAULT 'matin',
  description TEXT NOT NULL,
  duree INTERVAL NOT NULL,
  temps_trajet INTERVAL DEFAULT '00:00:00',
  reference_code TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS astreintes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semaine_id UUID REFERENCES semaines(id) ON DELETE CASCADE,
  type_astreinte TEXT NOT NULL,
  heure_depart TIME,
  temps_trajet INTERVAL DEFAULT '00:00:00',
  motif TEXT,
  temps_site INTERVAL DEFAULT '00:00:00',
  comptage TEXT GENERATED ALWAYS AS (
    CASE WHEN type_astreinte = 'samedi_jour' THEN 'rtt' ELSE 'paye' END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 11. VUES
-- ================================================

CREATE OR REPLACE VIEW vue_stock_global AS
SELECT 
  a.id AS article_id, a.reference, a.designation, a.categorie_id,
  a.quantite_stock AS stock_depot,
  COALESCE(SUM(sv.quantite), 0)::INTEGER AS stock_vehicules,
  (a.quantite_stock + COALESCE(SUM(sv.quantite), 0))::INTEGER AS stock_total,
  a.seuil_alerte, a.seuil_critique, a.prix_unitaire
FROM stock_articles a
LEFT JOIN stock_vehicule sv ON sv.article_id = a.id
WHERE a.actif = true
GROUP BY a.id;

CREATE OR REPLACE VIEW vue_stock_vehicule_detail AS
SELECT 
  sv.id, sv.vehicule_id, sv.article_id, sv.quantite, sv.quantite_min,
  v.immatriculation, v.marque AS vehicule_marque, v.modele AS vehicule_modele,
  t.id AS technicien_id, t.prenom || ' ' || t.nom AS technicien_nom,
  a.reference, a.designation, a.prix_unitaire,
  CASE WHEN sv.quantite <= sv.quantite_min THEN 'alerte' ELSE 'ok' END AS niveau
FROM stock_vehicule sv
JOIN vehicules v ON v.id = sv.vehicule_id
JOIN stock_articles a ON a.id = sv.article_id
LEFT JOIN techniciens t ON t.id = v.technicien_id;

CREATE OR REPLACE VIEW vue_technicien_permissions AS
SELECT 
  t.id AS technicien_id,
  t.email,
  t.nom,
  t.prenom,
  r.code AS role_code,
  r.nom AS role_nom,
  r.niveau AS role_niveau,
  ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL) AS permissions
FROM techniciens t
LEFT JOIN roles r ON r.id = t.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN permissions p ON p.id = rp.permission_id
LEFT JOIN technicien_permissions tp ON tp.technicien_id = t.id AND tp.accorde = false
WHERE t.actif = true
GROUP BY t.id, r.code, r.nom, r.niveau;

-- ================================================
-- 12. TRIGGERS
-- ================================================

CREATE OR REPLACE FUNCTION calculer_heures_jour() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type_jour = 'travail' AND NEW.heure_arrivee IS NOT NULL AND NEW.heure_fin IS NOT NULL THEN
    NEW.heures_travail := GREATEST(0, ROUND((EXTRACT(EPOCH FROM (NEW.heure_fin - NEW.heure_arrivee)) / 3600 - COALESCE(EXTRACT(EPOCH FROM NEW.duree_pause) / 3600, 1))::numeric, 2));
    IF NEW.heure_depart IS NOT NULL AND NEW.heure_retour IS NOT NULL THEN
      NEW.heures_trajet := GREATEST(0, ROUND((EXTRACT(EPOCH FROM (NEW.heure_arrivee - NEW.heure_depart)) / 3600 + EXTRACT(EPOCH FROM (NEW.heure_retour - NEW.heure_fin)) / 3600)::numeric, 2));
    END IF;
    NEW.heures_rtt := GREATEST(0, NEW.heures_travail - NEW.heures_reference);
  ELSE
    NEW.heures_travail := 0; NEW.heures_trajet := 0; NEW.heures_rtt := 0;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculer_heures ON jours;
CREATE TRIGGER trigger_calculer_heures BEFORE INSERT OR UPDATE ON jours FOR EACH ROW EXECUTE FUNCTION calculer_heures_jour();

-- Fonction pour appliquer un transfert validé
CREATE OR REPLACE FUNCTION appliquer_transfert() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND OLD.statut = 'en_attente' THEN
    -- Retirer de la source
    IF NEW.source_type = 'depot' THEN
      UPDATE stock_articles SET quantite_stock = quantite_stock - NEW.quantite WHERE id = NEW.article_id;
    ELSE
      UPDATE stock_vehicule SET quantite = quantite - NEW.quantite 
      WHERE vehicule_id = NEW.source_vehicule_id AND article_id = NEW.article_id;
    END IF;
    -- Ajouter à la destination
    IF NEW.destination_type = 'depot' THEN
      UPDATE stock_articles SET quantite_stock = quantite_stock + NEW.quantite WHERE id = NEW.article_id;
    ELSE
      INSERT INTO stock_vehicule (vehicule_id, article_id, quantite)
      VALUES (NEW.destination_vehicule_id, NEW.article_id, NEW.quantite)
      ON CONFLICT (vehicule_id, article_id) DO UPDATE SET quantite = stock_vehicule.quantite + NEW.quantite;
    END IF;
    NEW.date_validation := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_transfert ON stock_transferts;
CREATE TRIGGER trigger_transfert BEFORE UPDATE ON stock_transferts FOR EACH ROW EXECUTE FUNCTION appliquer_transfert();

-- ================================================
-- 13. CHAT & MESSAGERIE
-- ================================================

-- Canaux de discussion
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private', 'direct')),
  icone TEXT DEFAULT '💬',
  couleur TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES techniciens(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES techniciens(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  file_url TEXT,
  file_name TEXT,
  -- Contexte métier (optionnel)
  travaux_id UUID REFERENCES travaux(id) ON DELETE CASCADE,
  mise_service_id UUID REFERENCES mise_en_service(id) ON DELETE CASCADE,
  ascenseur_id UUID REFERENCES ascenseurs(id) ON DELETE CASCADE,
  -- Mentions
  mentions UUID[] DEFAULT '{}',
  -- Métadonnées
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lecture des messages (pour notifications)
CREATE TABLE IF NOT EXISTS chat_message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  UNIQUE(channel_id, user_id)
);

-- Membres des canaux privés
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Index pour performance chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_travaux ON chat_messages(travaux_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_mes ON chat_messages(mise_service_id);
CREATE INDEX IF NOT EXISTS idx_chat_reads_user ON chat_message_reads(user_id);

-- ================================================
-- 14. DASHBOARD PERSONNALISABLE
-- ================================================

-- Configuration dashboard par technicien
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '[]',
  widgets JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(technicien_id)
);

-- Notes personnelles (pour widget notes)
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist items (pour widget checklist)
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_technicien ON dashboard_configs(technicien_id);
CREATE INDEX IF NOT EXISTS idx_checklist_technicien ON checklist_items(technicien_id, date);

-- ================================================
-- 16. NOTES & MÉMOS
-- ================================================

-- Notes personnelles
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  contenu TEXT,
  couleur TEXT DEFAULT '#6366f1',
  categorie TEXT DEFAULT 'perso',
  tags TEXT[] DEFAULT '{}',
  epingle BOOLEAN DEFAULT false,
  archive BOOLEAN DEFAULT false,
  rappel_date TIMESTAMPTZ,
  -- Contexte métier (optionnel - pour notes contextuelles)
  ascenseur_id UUID REFERENCES ascenseurs(id) ON DELETE CASCADE,
  travaux_id UUID REFERENCES travaux(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  mise_service_id UUID REFERENCES mise_en_service(id) ON DELETE CASCADE,
  -- Partage
  partage BOOLEAN DEFAULT false,
  visible_par UUID[] DEFAULT '{}',
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catégories de notes personnalisées
CREATE TABLE IF NOT EXISTS note_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  couleur TEXT DEFAULT '#6366f1',
  icone TEXT DEFAULT '📝',
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notes_technicien ON notes(technicien_id);
CREATE INDEX IF NOT EXISTS idx_notes_epingle ON notes(epingle) WHERE epingle = true;
CREATE INDEX IF NOT EXISTS idx_notes_ascenseur ON notes(ascenseur_id);
CREATE INDEX IF NOT EXISTS idx_notes_travaux ON notes(travaux_id);
CREATE INDEX IF NOT EXISTS idx_notes_client ON notes(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_partage ON notes(partage) WHERE partage = true;

-- ================================================
-- 18. NOTIFICATIONS
-- ================================================

-- Types de notification
CREATE TYPE notification_type AS ENUM (
  'panne',          -- Ascenseur en panne
  'travaux',        -- Assignation, deadline, validation travaux
  'mise_service',   -- Étapes MES, validation
  'stock',          -- Alerte stock, transfert
  'message',        -- Mention, message direct
  'planning',       -- Rappel intervention
  'note',           -- Rappel note
  'system'          -- Notifications système
);

-- Priorité notification
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  priority notification_priority DEFAULT 'normal',
  titre TEXT NOT NULL,
  message TEXT,
  icone TEXT,
  couleur TEXT,
  -- Liens contextuels
  lien_type TEXT, -- 'travaux', 'ascenseur', 'miseservice', 'chat', 'stock', 'note'
  lien_id UUID,
  lien_url TEXT,
  -- État
  lue BOOLEAN DEFAULT false,
  lue_at TIMESTAMPTZ,
  archivee BOOLEAN DEFAULT false,
  -- Métadonnées
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Préférences de notification par technicien
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID REFERENCES techniciens(id) ON DELETE CASCADE UNIQUE,
  -- Activation par type
  panne_enabled BOOLEAN DEFAULT true,
  travaux_enabled BOOLEAN DEFAULT true,
  mise_service_enabled BOOLEAN DEFAULT true,
  stock_enabled BOOLEAN DEFAULT true,
  message_enabled BOOLEAN DEFAULT true,
  planning_enabled BOOLEAN DEFAULT true,
  note_enabled BOOLEAN DEFAULT true,
  -- Options
  sound_enabled BOOLEAN DEFAULT true,
  desktop_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  -- Ne pas déranger
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_start TIME,
  dnd_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notifications_technicien ON notifications(technicien_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lue ON notifications(lue) WHERE lue = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- ================================================
-- 19. SYSTÈME D'ARCHIVAGE
-- ================================================

-- Ajouter colonne archive aux tables concernées (si pas déjà présente)
ALTER TABLE travaux ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT false;
ALTER TABLE travaux ADD COLUMN IF NOT EXISTS archive_date TIMESTAMPTZ;
ALTER TABLE travaux ADD COLUMN IF NOT EXISTS archive_par UUID REFERENCES techniciens(id);
ALTER TABLE travaux ADD COLUMN IF NOT EXISTS archive_raison TEXT;

ALTER TABLE mise_en_service ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT false;
ALTER TABLE mise_en_service ADD COLUMN IF NOT EXISTS archive_date TIMESTAMPTZ;
ALTER TABLE mise_en_service ADD COLUMN IF NOT EXISTS archive_par UUID REFERENCES techniciens(id);
ALTER TABLE mise_en_service ADD COLUMN IF NOT EXISTS archive_raison TEXT;

ALTER TABLE demandes ADD COLUMN IF NOT EXISTS archive BOOLEAN DEFAULT false;
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS archive_date TIMESTAMPTZ;
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS archive_par UUID REFERENCES techniciens(id);
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS archive_raison TEXT;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_travaux_archive ON travaux(archive) WHERE archive = true;
CREATE INDEX IF NOT EXISTS idx_mes_archive ON mise_en_service(archive) WHERE archive = true;
CREATE INDEX IF NOT EXISTS idx_demandes_archive ON demandes(archive) WHERE archive = true;

-- ================================================
-- 20. SYSTÈME NFC
-- ================================================

-- Types de tags NFC
CREATE TYPE type_tag_nfc AS ENUM (
  'ascenseur',      -- Tag sur un ascenseur
  'emplacement',    -- Tag sur un emplacement stock (dépôt ou véhicule)
  'article'         -- Tag sur une pièce/article spécifique
);

-- Table des tags NFC
CREATE TABLE IF NOT EXISTS nfc_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL,         -- UID unique du tag NFC (ex: 04:A3:2B:C1:D4:E5:F6)
  type type_tag_nfc NOT NULL,
  -- Associations selon le type (une seule remplie)
  ascenseur_id UUID REFERENCES ascenseurs(id) ON DELETE SET NULL,
  article_id UUID REFERENCES stock_articles(id) ON DELETE SET NULL,
  -- Pour les emplacements stock
  emplacement_code TEXT,            -- Ex: "DEP-A3-R2" (Dépôt, Allée 3, Rang 2)
  emplacement_description TEXT,     -- Ex: "Étagère contacteurs"
  vehicule_id UUID REFERENCES vehicules(id) ON DELETE SET NULL,  -- Si emplacement dans véhicule
  -- Métadonnées
  label TEXT,                       -- Nom court affiché
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  derniere_utilisation TIMESTAMPTZ,
  created_by UUID REFERENCES techniciens(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des scans NFC
CREATE TABLE IF NOT EXISTS nfc_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES nfc_tags(id) ON DELETE CASCADE,
  technicien_id UUID REFERENCES techniciens(id),
  action TEXT NOT NULL,             -- 'consultation', 'sortie_stock', 'entree_stock', 'inventaire', 'note', 'demande', 'encodage'
  -- Contexte du scan
  ascenseur_id UUID REFERENCES ascenseurs(id),  -- Si action liée à un ascenseur
  article_id UUID REFERENCES stock_articles(id), -- Si action liée à un article
  quantite INTEGER,                 -- Pour mouvements stock
  -- Géolocalisation (optionnel)
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  device_info TEXT,                 -- 'web_nfc', 'web_usb', 'android_app'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_nfc_tags_uid ON nfc_tags(uid);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_type ON nfc_tags(type);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_ascenseur ON nfc_tags(ascenseur_id) WHERE ascenseur_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfc_tags_article ON nfc_tags(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfc_scans_tag ON nfc_scans(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_scans_technicien ON nfc_scans(technicien_id);
CREATE INDEX IF NOT EXISTS idx_nfc_scans_created ON nfc_scans(created_at DESC);

-- ================================================
-- 21. COMMANDES DE PIÈCES
-- ================================================

-- Statut commande
CREATE TYPE statut_commande AS ENUM ('brouillon', 'en_attente', 'validee', 'commandee', 'expediee', 'recue', 'annulee');

-- Table principale commandes
CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  technicien_id UUID REFERENCES techniciens(id),
  fournisseur TEXT,
  reference_fournisseur TEXT,
  statut statut_commande DEFAULT 'brouillon',
  priorite priorite DEFAULT 'normale',
  date_commande TIMESTAMPTZ,
  date_livraison_prevue DATE,
  date_reception TIMESTAMPTZ,
  notes TEXT,
  -- Archivage
  archive BOOLEAN DEFAULT false,
  archive_date TIMESTAMPTZ,
  archive_par UUID REFERENCES techniciens(id),
  archive_raison TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lignes de commande
CREATE TABLE IF NOT EXISTS commande_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  article_id UUID REFERENCES stock_articles(id),
  designation TEXT NOT NULL,
  reference TEXT,
  quantite INTEGER NOT NULL DEFAULT 1,
  quantite_recue INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_commandes_technicien ON commandes(technicien_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_archive ON commandes(archive) WHERE archive = true;
CREATE INDEX IF NOT EXISTS idx_commande_lignes_commande ON commande_lignes(commande_id);

-- Vue pour les archives avec commandes
CREATE OR REPLACE VIEW vue_archives AS
SELECT 
  'travaux' as type,
  t.id,
  t.code,
  t.titre as libelle,
  t.statut::text,
  t.archive_date,
  t.archive_raison,
  tech.nom || ' ' || tech.prenom as archive_par_nom,
  t.created_at,
  t.updated_at as date_cloture
FROM travaux t
LEFT JOIN techniciens tech ON t.archive_par = tech.id
WHERE t.archive = true

UNION ALL

SELECT 
  'mise_en_service' as type,
  m.id,
  m.code,
  'MES ' || m.code as libelle,
  m.statut::text,
  m.archive_date,
  m.archive_raison,
  tech.nom || ' ' || tech.prenom as archive_par_nom,
  m.created_at,
  m.updated_at as date_cloture
FROM mise_en_service m
LEFT JOIN techniciens tech ON m.archive_par = tech.id
WHERE m.archive = true

UNION ALL

SELECT 
  'demande' as type,
  d.id,
  d.code,
  d.objet as libelle,
  d.statut::text,
  d.archive_date,
  d.archive_raison,
  tech.nom || ' ' || tech.prenom as archive_par_nom,
  d.created_at,
  d.updated_at as date_cloture
FROM demandes d
LEFT JOIN techniciens tech ON d.archive_par = tech.id
WHERE d.archive = true

UNION ALL

SELECT 
  'commande' as type,
  c.id,
  c.code,
  COALESCE(c.fournisseur, 'Commande') || ' - ' || c.code as libelle,
  c.statut::text,
  c.archive_date,
  c.archive_raison,
  tech.nom || ' ' || tech.prenom as archive_par_nom,
  c.created_at,
  c.date_reception as date_cloture
FROM commandes c
LEFT JOIN techniciens tech ON c.archive_par = tech.id
WHERE c.archive = true

ORDER BY archive_date DESC;

-- ================================================
-- 22. DONNÉES DE TEST
-- ================================================

-- Rôles
INSERT INTO roles (id, code, nom, description, niveau, couleur) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'technicien', 'Technicien', 'Technicien de maintenance', 0, '#22c55e'),
  ('aaaa2222-2222-2222-2222-222222222222', 'chef_equipe', 'Chef d''équipe', 'Responsable d''équipe', 50, '#f59e0b'),
  ('aaaa3333-3333-3333-3333-333333333333', 'responsable', 'Responsable', 'Responsable technique', 100, '#3b82f6'),
  ('aaaa4444-4444-4444-4444-444444444444', 'admin', 'Administrateur', 'Accès complet', 200, '#ef4444')
ON CONFLICT (id) DO NOTHING;

-- Permissions
INSERT INTO permissions (id, code, nom, module) VALUES
  ('aaab0001-0001-0001-0001-000000000001', 'dashboard.view', 'Voir le tableau de bord', 'dashboard'),
  ('aaab0002-0002-0002-0002-000000000002', 'planning.view', 'Voir le planning', 'planning'),
  ('aaab0003-0003-0003-0003-000000000003', 'planning.edit', 'Modifier le planning', 'planning'),
  ('aaab0004-0004-0004-0004-000000000004', 'planning.manage_all', 'Gérer tous les plannings', 'planning'),
  ('aaab0005-0005-0005-0005-000000000005', 'travaux.view', 'Voir les travaux', 'travaux'),
  ('aaab0006-0006-0006-0006-000000000006', 'travaux.create', 'Créer des travaux', 'travaux'),
  ('aaab0007-0007-0007-0007-000000000007', 'travaux.edit', 'Modifier les travaux', 'travaux'),
  ('aaab0008-0008-0008-0008-000000000008', 'stock.view', 'Voir le stock', 'stock'),
  ('aaab0009-0009-0009-0009-000000000009', 'stock.mouvement', 'Mouvements de stock', 'stock'),
  ('aaab0010-0010-0010-0010-000000000010', 'stock.transfert', 'Demander des transferts', 'stock'),
  ('aaab0011-0011-0011-0011-000000000011', 'stock.valider_transfert', 'Valider les transferts', 'stock'),
  ('aaab0012-0012-0012-0012-000000000012', 'vehicules.view', 'Voir les véhicules', 'vehicules'),
  ('aaab0013-0013-0013-0013-000000000013', 'vehicules.stock_view', 'Voir le stock véhicule', 'vehicules'),
  ('aaab0014-0014-0014-0014-000000000014', 'vehicules.stock_edit', 'Modifier le stock véhicule', 'vehicules'),
  ('aaab0015-0015-0015-0015-000000000015', 'ascenseurs.view', 'Voir les ascenseurs', 'ascenseurs'),
  ('aaab0016-0016-0016-0016-000000000016', 'demandes.view', 'Voir les demandes', 'demandes'),
  ('aaab0017-0017-0017-0017-000000000017', 'demandes.create', 'Créer des demandes', 'demandes'),
  ('aaab0018-0018-0018-0018-000000000018', 'demandes.valider', 'Valider les demandes', 'demandes'),
  ('aaab0019-0019-0019-0019-000000000019', 'heures.view', 'Voir ses feuilles', 'heures'),
  ('aaab0020-0020-0020-0020-000000000020', 'heures.edit', 'Modifier ses feuilles', 'heures'),
  ('aaab0021-0021-0021-0021-000000000021', 'heures.valider', 'Valider les feuilles', 'heures'),
  ('aaab0022-0022-0022-0022-000000000022', 'heures.view_all', 'Voir toutes les feuilles', 'heures'),
  ('aaab0023-0023-0023-0023-000000000023', 'admin.users', 'Gérer les utilisateurs', 'admin'),
  ('aaab0024-0024-0024-0024-000000000024', 'admin.roles', 'Gérer les rôles', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Permissions par rôle (Technicien)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaa1111-1111-1111-1111-111111111111', id FROM permissions 
WHERE code IN ('dashboard.view','planning.view','travaux.view','stock.view','stock.transfert','vehicules.view','vehicules.stock_view','ascenseurs.view','demandes.view','demandes.create','heures.view','heures.edit')
ON CONFLICT DO NOTHING;

-- Permissions par rôle (Chef d'équipe)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaa2222-2222-2222-2222-222222222222', id FROM permissions 
WHERE code IN ('dashboard.view','planning.view','planning.edit','travaux.view','travaux.create','travaux.edit','stock.view','stock.mouvement','stock.transfert','vehicules.view','vehicules.stock_view','vehicules.stock_edit','ascenseurs.view','demandes.view','demandes.create','heures.view','heures.edit','heures.view_all')
ON CONFLICT DO NOTHING;

-- Permissions par rôle (Responsable)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaa3333-3333-3333-3333-333333333333', id FROM permissions WHERE code NOT IN ('admin.users','admin.roles')
ON CONFLICT DO NOTHING;

-- Permissions par rôle (Admin = tout)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'aaaa4444-4444-4444-4444-444444444444', id FROM permissions
ON CONFLICT DO NOTHING;

-- Véhicules (avant techniciens pour FK)
INSERT INTO vehicules (id, immatriculation, marque, modele, type_vehicule, annee, kilometrage, statut) VALUES
  ('eeee1111-1111-1111-1111-111111111111', 'FT-456-AB', 'Renault', 'Master', 'fourgon', 2021, 45000, 'en_service'),
  ('eeee2222-2222-2222-2222-222222222222', 'GH-789-CD', 'Peugeot', 'Expert', 'utilitaire', 2022, 32000, 'en_service'),
  ('eeee3333-3333-3333-3333-333333333333', 'JK-012-EF', 'Citroën', 'Jumpy', 'utilitaire', 2020, 67000, 'en_service'),
  ('eeee4444-4444-4444-4444-444444444444', 'LM-345-GH', 'Ford', 'Transit', 'fourgon', 2019, 89000, 'disponible')
ON CONFLICT (id) DO NOTHING;

-- Techniciens
INSERT INTO techniciens (id, email, nom, prenom, avatar_initiales, role_id, secteur, vehicule_attribue_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'nicolas@auvergne-tech.fr', 'Bonnet', 'Nicolas', 'NB', 'aaaa1111-1111-1111-1111-111111111111', 'Nord', 'eeee1111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', 'marc@auvergne-tech.fr', 'Dupont', 'Marc', 'MD', 'aaaa1111-1111-1111-1111-111111111111', 'Sud', 'eeee2222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333', 'pierre@auvergne-tech.fr', 'Lambert', 'Pierre', 'PL', 'aaaa2222-2222-2222-2222-222222222222', 'Est', 'eeee3333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444', 'jean@auvergne-tech.fr', 'Martin', 'Jean-Paul', 'JP', 'aaaa3333-3333-3333-3333-333333333333', NULL, NULL),
  ('55555555-5555-5555-5555-555555555555', 'admin@auvergne-tech.fr', 'Admin', 'System', 'AS', 'aaaa4444-4444-4444-4444-444444444444', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Mise à jour FK véhicules -> techniciens
UPDATE vehicules SET technicien_id = '11111111-1111-1111-1111-111111111111' WHERE id = 'eeee1111-1111-1111-1111-111111111111';
UPDATE vehicules SET technicien_id = '22222222-2222-2222-2222-222222222222' WHERE id = 'eeee2222-2222-2222-2222-222222222222';
UPDATE vehicules SET technicien_id = '33333333-3333-3333-3333-333333333333' WHERE id = 'eeee3333-3333-3333-3333-333333333333';

-- Clients
INSERT INTO clients (code, raison_sociale, adresse, ville, type_client, secteur) VALUES
  ('CLI-001', 'Résidence Les Pins', '12 rue des Pins', 'Clermont-Ferrand', 'syndic', 'Nord'),
  ('CLI-002', 'Mairie Issoire', '1 place de la Mairie', 'Issoire', 'collectivite', 'Sud'),
  ('CLI-003', 'Clinique St-Joseph', '8 rue St-Joseph', 'Clermont-Ferrand', 'professionnel', 'Nord'),
  ('CLI-004', 'Résidence du Parc', '45 avenue du Parc', 'Vichy', 'syndic', 'Est'),
  ('CLI-005', 'Centre Commercial Jaude', '100 Centre Jaude', 'Clermont-Ferrand', 'professionnel', 'Nord')
ON CONFLICT (code) DO NOTHING;

-- Tournées
INSERT INTO tournees (id, code, nom, technicien_id, secteur, nb_ascenseurs) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'T1', 'Secteur Nord', '11111111-1111-1111-1111-111111111111', 'Nord', 12),
  ('aaaa2222-2222-2222-2222-222222222222', 'T2', 'Secteur Sud', '22222222-2222-2222-2222-222222222222', 'Sud', 15),
  ('aaaa3333-3333-3333-3333-333333333333', 'T3', 'Secteur Est', '33333333-3333-3333-3333-333333333333', 'Est', 10)
ON CONFLICT (id) DO NOTHING;

-- Ascenseurs
INSERT INTO ascenseurs (code, client_id, adresse, ville, secteur, marque, statut, type_contrat) VALUES
  ('ASC-0001', (SELECT id FROM clients WHERE code='CLI-001'), '12 rue des Pins', 'Clermont-Ferrand', 'Nord', 'Otis', 'en_service', 'complet'),
  ('ASC-0002', (SELECT id FROM clients WHERE code='CLI-001'), '12 rue des Pins Bat B', 'Clermont-Ferrand', 'Nord', 'Otis', 'en_service', 'complet'),
  ('ASC-0003', (SELECT id FROM clients WHERE code='CLI-002'), '1 place de la Mairie', 'Issoire', 'Sud', 'Schindler', 'en_service', 'entretien'),
  ('ASC-0004', (SELECT id FROM clients WHERE code='CLI-003'), '8 rue St-Joseph', 'Clermont-Ferrand', 'Nord', 'Kone', 'en_panne', 'premium'),
  ('ASC-0005', (SELECT id FROM clients WHERE code='CLI-004'), '45 avenue du Parc', 'Vichy', 'Est', 'ThyssenKrupp', 'en_service', 'entretien')
ON CONFLICT (code) DO NOTHING;

-- Catégories stock
INSERT INTO stock_categories (id, nom, couleur) VALUES
  ('cccc1111-1111-1111-1111-111111111111', 'Électrique', '#3b82f6'),
  ('cccc2222-2222-2222-2222-222222222222', 'Mécanique', '#22c55e'),
  ('cccc3333-3333-3333-3333-333333333333', 'Sécurité', '#ef4444'),
  ('cccc4444-4444-4444-4444-444444444444', 'Câbles', '#f59e0b'),
  ('cccc5555-5555-5555-5555-555555555555', 'Consommables', '#a855f7')
ON CONFLICT (id) DO NOTHING;

-- Articles stock dépôt
INSERT INTO stock_articles (id, reference, designation, categorie_id, quantite_stock, seuil_alerte, seuil_critique, prix_unitaire, marque) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'VAR-001', 'Variateur VF-200', 'cccc1111-1111-1111-1111-111111111111', 5, 5, 2, 850.00, 'ABB'),
  ('aaaa0002-0002-0002-0002-000000000002', 'VAR-002', 'Variateur VF-300', 'cccc1111-1111-1111-1111-111111111111', 8, 5, 2, 1200.00, 'ABB'),
  ('aaaa0003-0003-0003-0003-000000000003', 'MOT-001', 'Moteur 5.5kW', 'cccc2222-2222-2222-2222-222222222222', 3, 3, 1, 2500.00, 'Siemens'),
  ('aaaa0004-0004-0004-0004-000000000004', 'CAB-001', 'Câble plat 24G (m)', 'cccc4444-4444-4444-4444-444444444444', 150, 50, 20, 12.50, 'Draka'),
  ('aaaa0005-0005-0005-0005-000000000005', 'SEC-001', 'Parachute cabine', 'cccc3333-3333-3333-3333-333333333333', 5, 3, 1, 450.00, 'Wittur'),
  ('aaaa0006-0006-0006-0006-000000000006', 'SEC-002', 'Limiteur vitesse', 'cccc3333-3333-3333-3333-333333333333', 4, 3, 1, 380.00, 'Dynatech'),
  ('aaaa0007-0007-0007-0007-000000000007', 'ELE-001', 'Contacteur 40A', 'cccc1111-1111-1111-1111-111111111111', 15, 10, 5, 85.00, 'Schneider'),
  ('aaaa0008-0008-0008-0008-000000000008', 'ELE-002', 'Relais sécurité', 'cccc1111-1111-1111-1111-111111111111', 8, 5, 2, 120.00, 'Pilz'),
  ('aaaa0009-0009-0009-0009-000000000009', 'CON-001', 'Graisse spéciale', 'cccc5555-5555-5555-5555-555555555555', 20, 10, 5, 25.00, 'Shell'),
  ('aaaa0010-0010-0010-0010-000000000010', 'CON-002', 'Huile hydraulique (L)', 'cccc5555-5555-5555-5555-555555555555', 50, 20, 10, 18.00, 'Total')
ON CONFLICT (id) DO NOTHING;

-- Stock véhicules
INSERT INTO stock_vehicule (vehicule_id, article_id, quantite, quantite_min) VALUES
  ('eeee1111-1111-1111-1111-111111111111', 'aaaa0007-0007-0007-0007-000000000007', 3, 2),
  ('eeee1111-1111-1111-1111-111111111111', 'aaaa0008-0008-0008-0008-000000000008', 2, 1),
  ('eeee1111-1111-1111-1111-111111111111', 'aaaa0009-0009-0009-0009-000000000009', 2, 1),
  ('eeee2222-2222-2222-2222-222222222222', 'aaaa0007-0007-0007-0007-000000000007', 2, 2),
  ('eeee2222-2222-2222-2222-222222222222', 'aaaa0009-0009-0009-0009-000000000009', 3, 1),
  ('eeee3333-3333-3333-3333-333333333333', 'aaaa0007-0007-0007-0007-000000000007', 4, 2),
  ('eeee3333-3333-3333-3333-333333333333', 'aaaa0008-0008-0008-0008-000000000008', 1, 1)
ON CONFLICT (vehicule_id, article_id) DO NOTHING;

-- Travaux (certains seront planifiés, d'autres non)
INSERT INTO travaux (code, titre, description, client_id, technicien_id, type_travaux, statut, priorite, progression, date_debut, date_butoir) VALUES
  ('TRV-001', 'Remplacement variateur ASC-0004', 'Remplacement du variateur défectueux', (SELECT id FROM clients WHERE code='CLI-003'), '11111111-1111-1111-1111-111111111111', 'reparation', 'en_cours', 'haute', 65, CURRENT_DATE - 5, CURRENT_DATE + 3),
  ('TRV-002', 'Modernisation cabine Résidence Les Pins', 'Rénovation complète cabine', (SELECT id FROM clients WHERE code='CLI-001'), '22222222-2222-2222-2222-222222222222', 'modernisation', 'planifie', 'normale', 0, CURRENT_DATE + 7, CURRENT_DATE + 30),
  ('TRV-003', 'Mise aux normes PMR Mairie', 'Mise en conformité accessibilité', (SELECT id FROM clients WHERE code='CLI-002'), '33333333-3333-3333-3333-333333333333', 'mise_conformite', 'planifie', 'normale', 0, NULL, CURRENT_DATE + 14),
  ('TRV-004', 'Réparation portes palières', 'Changement système fermeture', (SELECT id FROM clients WHERE code='CLI-004'), '11111111-1111-1111-1111-111111111111', 'reparation', 'planifie', 'haute', 0, NULL, CURRENT_DATE + 5),
  ('TRV-005', 'Changement câbles ASC-0001', 'Remplacement câbles de traction usés', (SELECT id FROM clients WHERE code='CLI-001'), NULL, 'reparation', 'planifie', 'urgente', 0, NULL, CURRENT_DATE - 2),
  ('TRV-006', 'Installation nouveau tableau', 'Nouveau tableau de commande électronique', (SELECT id FROM clients WHERE code='CLI-005'), '22222222-2222-2222-2222-222222222222', 'modernisation', 'en_cours', 'normale', 30, CURRENT_DATE - 3, NULL)
ON CONFLICT (code) DO NOTHING;

-- Mise en service (certaines planifiées, d'autres non)
INSERT INTO mise_en_service (code, ascenseur_id, technicien_id, statut, etape_actuelle, date_prevue, etape1_preparation, etape2_verification_electrique, etape3_verification_mecanique) VALUES
  ('MES-001', (SELECT id FROM ascenseurs WHERE code='ASC-0005'), '33333333-3333-3333-3333-333333333333', 'en_cours', 4, CURRENT_DATE + 3, true, true, true),
  ('MES-002', (SELECT id FROM ascenseurs WHERE code='ASC-0001'), '11111111-1111-1111-1111-111111111111', 'planifie', 1, CURRENT_DATE + 10, false, false, false),
  ('MES-003', (SELECT id FROM ascenseurs WHERE code='ASC-0003'), NULL, 'planifie', 1, CURRENT_DATE + 14, false, false, false),
  ('MES-004', (SELECT id FROM ascenseurs WHERE code='ASC-0002'), '22222222-2222-2222-2222-222222222222', 'planifie', 1, CURRENT_DATE + 21, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Demandes
INSERT INTO demandes (code, technicien_id, type_demande, objet, statut, priorite) VALUES
  ('DEM-001', '22222222-2222-2222-2222-222222222222', 'piece', 'Variateur VF-200 pour TRV-001', 'en_attente', 'haute'),
  ('DEM-002', '11111111-1111-1111-1111-111111111111', 'conge', 'Congés du 15 au 22 février', 'approuve', 'normale')
ON CONFLICT (code) DO NOTHING;

-- Transferts en attente
INSERT INTO stock_transferts (code, article_id, quantite, source_type, destination_type, destination_vehicule_id, motif, statut, demande_par) VALUES
  ('TRF-001', 'aaaa0001-0001-0001-0001-000000000001', 1, 'depot', 'vehicule', 'eeee1111-1111-1111-1111-111111111111', 'Intervention TRV-001', 'en_attente', '11111111-1111-1111-1111-111111111111'),
  ('TRF-002', 'aaaa0009-0009-0009-0009-000000000009', 2, 'depot', 'vehicule', 'eeee2222-2222-2222-2222-222222222222', 'Réapprovisionnement', 'en_attente', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (code) DO NOTHING;

-- Planning (quelques événements déjà planifiés)
INSERT INTO planning_events (titre, technicien_id, type_event, date_debut, date_fin, couleur, travaux_id) VALUES
  ('TRV-001', '11111111-1111-1111-1111-111111111111', 'travaux', CURRENT_DATE + interval '1 days 8 hours', CURRENT_DATE + interval '1 days 17 hours', '#a855f7', (SELECT id FROM travaux WHERE code='TRV-001'))
ON CONFLICT DO NOTHING;

INSERT INTO planning_events (titre, technicien_id, type_event, date_debut, date_fin, couleur, tournee_id) VALUES
  ('Tournée T1', '11111111-1111-1111-1111-111111111111', 'tournee', CURRENT_DATE + interval '0 days 8 hours', CURRENT_DATE + interval '0 days 17 hours', '#84cc16', 'aaaa1111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO planning_events (titre, technicien_id, type_event, date_debut, date_fin, couleur, mise_service_id) VALUES
  ('MES-001', '33333333-3333-3333-3333-333333333333', 'mise_service', CURRENT_DATE + interval '2 days 8 hours', CURRENT_DATE + interval '2 days 17 hours', '#f97316', (SELECT id FROM mise_en_service WHERE code='MES-001'))
ON CONFLICT DO NOTHING;

-- Documents
INSERT INTO documents (nom, type_document, dossier, client_id) VALUES
  ('Contrat entretien 2024', 'contrat', 'Contrats', (SELECT id FROM clients WHERE code='CLI-001')),
  ('Rapport intervention 15/01', 'rapport', 'Rapports', (SELECT id FROM clients WHERE code='CLI-003'))
ON CONFLICT DO NOTHING;

-- Canaux de chat par défaut
INSERT INTO chat_channels (code, nom, description, type, icone, couleur) VALUES
  ('general', 'Général', 'Discussions générales de l''équipe', 'public', '💬', '#6366f1'),
  ('urgences', 'Urgences', 'Signalement des urgences et pannes', 'public', '🚨', '#ef4444'),
  ('technique', 'Technique', 'Questions et discussions techniques', 'public', '🔧', '#f59e0b'),
  ('planning', 'Planning', 'Organisation et planning des interventions', 'public', '📅', '#10b981')
ON CONFLICT (code) DO NOTHING;

-- Messages de test
INSERT INTO chat_messages (channel_id, sender_id, content, type) VALUES
  ((SELECT id FROM chat_channels WHERE code='general'), '11111111-1111-1111-1111-111111111111', 'Bienvenue sur le chat AuvergneTech ! 👋', 'text'),
  ((SELECT id FROM chat_channels WHERE code='urgences'), '11111111-1111-1111-1111-111111111111', 'Canal réservé aux urgences et pannes critiques.', 'system'),
  ((SELECT id FROM chat_channels WHERE code='technique'), '22222222-2222-2222-2222-222222222222', 'Une question sur un variateur ? C''est ici !', 'text'),
  ((SELECT id FROM chat_channels WHERE code='general'), '22222222-2222-2222-2222-222222222222', 'Réunion planning décalée à 14h', 'text'),
  ((SELECT id FROM chat_channels WHERE code='general'), '33333333-3333-3333-3333-333333333333', 'OK pour moi 👍', 'text'),
  ((SELECT id FROM chat_channels WHERE code='technique'), '11111111-1111-1111-1111-111111111111', 'Quelqu''un a une clé tricoise ?', 'text')
ON CONFLICT DO NOTHING;


-- ================================================
-- DONNÉES DE TEST NFC
-- ================================================

-- Tags ascenseurs
INSERT INTO nfc_tags (uid, type, ascenseur_id, label, created_by) VALUES
  ('04:A3:B2:C1:D4:E5:F6', 'ascenseur', (SELECT id FROM ascenseurs WHERE code = 'ASC-0001'), 'Tag ASC-0001', '11111111-1111-1111-1111-111111111111'),
  ('04:B4:C3:D2:E1:F0:A7', 'ascenseur', (SELECT id FROM ascenseurs WHERE code = 'ASC-0002'), 'Tag ASC-0002', '11111111-1111-1111-1111-111111111111'),
  ('04:C5:D4:E3:F2:A1:B8', 'ascenseur', (SELECT id FROM ascenseurs WHERE code = 'ASC-0003'), 'Tag ASC-0003', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (uid) DO NOTHING;

-- Tags emplacements dépôt
INSERT INTO nfc_tags (uid, type, emplacement_description, label, created_by) VALUES
  ('04:D6:E5:F4:A3:B2:C9', 'emplacement', 'Étagère A - Rang 1', 'Contacteurs et relais', '11111111-1111-1111-1111-111111111111'),
  ('04:E7:F6:A5:B4:C3:D0', 'emplacement', 'Étagère A - Rang 2', 'Capteurs et sondes', '11111111-1111-1111-1111-111111111111'),
  ('04:F8:A7:B6:C5:D4:E1', 'emplacement', 'Étagère B - Rang 1', 'Variateurs', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (uid) DO NOTHING;

-- Tags emplacements véhicules
INSERT INTO nfc_tags (uid, type, emplacement_description, vehicule_id, label, created_by) VALUES
  ('04:A9:B8:C7:D6:E5:F2', 'emplacement', 'Coffre véhicule', 'eeee1111-1111-1111-1111-111111111111', 'Stock véhicule Nicolas', '11111111-1111-1111-1111-111111111111'),
  ('04:B0:C9:D8:E7:F6:A3', 'emplacement', 'Coffre véhicule', 'eeee2222-2222-2222-2222-222222222222', 'Stock véhicule Pierre', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (uid) DO NOTHING;

-- Scans de test
INSERT INTO nfc_scans (tag_id, technicien_id, action, metadata) VALUES
  ((SELECT id FROM nfc_tags WHERE uid = '04:A3:B2:C1:D4:E5:F6'), '11111111-1111-1111-1111-111111111111', 'consultation', '{"source": "mobile"}'),
  ((SELECT id FROM nfc_tags WHERE uid = '04:D6:E5:F4:A3:B2:C9'), '11111111-1111-1111-1111-111111111111', 'inventaire', '{"articles": 5}'),
  ((SELECT id FROM nfc_tags WHERE uid = '04:A9:B8:C7:D6:E5:F2'), '11111111-1111-1111-1111-111111111111', 'sortie_stock', '{"article": "Contacteur 40A", "quantite": 2}')
ON CONFLICT DO NOTHING;
