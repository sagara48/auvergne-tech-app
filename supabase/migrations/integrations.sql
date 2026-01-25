-- ============================================================
-- INTÉGRATIONS AUVERGNE TECH - ADAPTÉ AU SCHÉMA EXISTANT
-- Version finale compatible avec schema.sql
-- ============================================================

-- ============================================================
-- 1. TYPES DE DOCUMENTS GED
-- ============================================================

CREATE TABLE IF NOT EXISTS ged_types_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  categorie VARCHAR(50) NOT NULL,
  icone VARCHAR(50) DEFAULT 'file',
  extensions_autorisees TEXT[],
  duree_validite_mois INTEGER,
  obligatoire BOOLEAN DEFAULT FALSE,
  ordre_affichage INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extension table documents existante
ALTER TABLE documents ADD COLUMN IF NOT EXISTS type_document_id UUID REFERENCES ged_types_documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_document DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS date_expiration DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS numero_document VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mise_service_id UUID REFERENCES mise_en_service(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS travaux_id UUID REFERENCES travaux(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS statut_document VARCHAR(20) DEFAULT 'actif';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Index documents
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiration ON documents(date_expiration);
CREATE INDEX IF NOT EXISTS idx_documents_travaux ON documents(travaux_id);
CREATE INDEX IF NOT EXISTS idx_documents_mes ON documents(mise_service_id);

-- ============================================================
-- 2. EXTENSION TABLE NOTES
-- ============================================================

ALTER TABLE notes ADD COLUMN IF NOT EXISTS type_note VARCHAR(30) DEFAULT 'info';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 1;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS vehicule_id UUID REFERENCES vehicules(id);

CREATE INDEX IF NOT EXISTS idx_notes_vehicule ON notes(vehicule_id);

-- ============================================================
-- 3. TABLES TRAVAUX ÉTENDUES
-- ============================================================

CREATE TABLE IF NOT EXISTS travaux_pieces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travaux_id UUID NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
  article_id UUID REFERENCES stock_articles(id),
  reference VARCHAR(50) NOT NULL,
  designation TEXT,
  quantite_prevue INTEGER NOT NULL DEFAULT 1,
  quantite_reservee INTEGER DEFAULT 0,
  quantite_utilisee INTEGER DEFAULT 0,
  source VARCHAR(20) DEFAULT 'a_definir',
  vehicule_source_id UUID REFERENCES vehicules(id),
  prix_unitaire_ht DECIMAL(10,2),
  prix_vente_ht DECIMAL(10,2),
  statut VARCHAR(20) DEFAULT 'a_commander',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travaux_etapes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travaux_id UUID NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  date_debut_prevue DATE,
  date_fin_prevue DATE,
  date_debut_reelle DATE,
  date_fin_reelle DATE,
  duree_prevue_heures DECIMAL(6,2),
  duree_reelle_heures DECIMAL(6,2),
  statut VARCHAR(20) DEFAULT 'a_faire',
  pourcentage INTEGER DEFAULT 0,
  technicien_id UUID REFERENCES techniciens(id),
  necessite_validation BOOLEAN DEFAULT FALSE,
  valide_par UUID REFERENCES techniciens(id),
  date_validation TIMESTAMPTZ,
  notes TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(travaux_id, numero)
);

CREATE TABLE IF NOT EXISTS travaux_temps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travaux_id UUID NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
  etape_id UUID REFERENCES travaux_etapes(id),
  technicien_id UUID NOT NULL REFERENCES techniciens(id),
  date_travail DATE NOT NULL,
  heure_debut TIME,
  heure_fin TIME,
  duree_heures DECIMAL(5,2) NOT NULL,
  type_temps VARCHAR(30) DEFAULT 'travail',
  description TEXT,
  jour_id UUID REFERENCES jours(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travaux_pieces_travaux ON travaux_pieces(travaux_id);
CREATE INDEX IF NOT EXISTS idx_travaux_etapes_travaux ON travaux_etapes(travaux_id);
CREATE INDEX IF NOT EXISTS idx_travaux_temps_travaux ON travaux_temps(travaux_id);

-- ============================================================
-- 4. DEMANDES DE RÉAPPROVISIONNEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_demandes_reappro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE,
  vehicule_id UUID NOT NULL REFERENCES vehicules(id),
  technicien_id UUID NOT NULL REFERENCES techniciens(id),
  statut VARCHAR(20) DEFAULT 'en_attente',
  urgence VARCHAR(20) DEFAULT 'normale',
  date_demande TIMESTAMPTZ DEFAULT NOW(),
  date_validation TIMESTAMPTZ,
  date_preparation TIMESTAMPTZ,
  date_livraison TIMESTAMPTZ,
  validee_par UUID REFERENCES techniciens(id),
  preparee_par UUID REFERENCES techniciens(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_demandes_reappro_lignes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  demande_id UUID NOT NULL REFERENCES stock_demandes_reappro(id) ON DELETE CASCADE,
  article_id UUID REFERENCES stock_articles(id),
  reference VARCHAR(50) NOT NULL,
  designation TEXT,
  quantite_demandee INTEGER NOT NULL,
  quantite_validee INTEGER,
  quantite_livree INTEGER DEFAULT 0,
  motif TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS demande_reappro_seq START 1;

CREATE OR REPLACE FUNCTION generate_code_demande_reappro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'RAP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(NEXTVAL('demande_reappro_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_code_demande_reappro ON stock_demandes_reappro;
CREATE TRIGGER trg_code_demande_reappro
  BEFORE INSERT ON stock_demandes_reappro
  FOR EACH ROW EXECUTE FUNCTION generate_code_demande_reappro();

CREATE INDEX IF NOT EXISTS idx_reappro_vehicule ON stock_demandes_reappro(vehicule_id);
CREATE INDEX IF NOT EXISTS idx_reappro_statut ON stock_demandes_reappro(statut);

-- ============================================================
-- 5. VUES
-- ============================================================

CREATE OR REPLACE VIEW v_documents_expiration AS
SELECT 
  d.id, d.nom, d.type_document, d.fichier_url, d.fichier_taille, d.dossier,
  d.date_document, d.date_expiration, d.numero_document,
  d.ascenseur_id, d.code_ascenseur, d.client_id, d.travaux_id, d.mise_service_id,
  d.version, d.created_at,
  t.code AS type_code, t.libelle AS type_libelle, t.categorie, t.obligatoire,
  CASE 
    WHEN d.date_expiration IS NULL THEN 'valide'
    WHEN d.date_expiration < CURRENT_DATE THEN 'expire'
    WHEN d.date_expiration < CURRENT_DATE + INTERVAL '30 days' THEN 'expire_bientot'
    ELSE 'valide'
  END AS statut_expiration,
  d.date_expiration - CURRENT_DATE AS jours_avant_expiration
FROM documents d
LEFT JOIN ged_types_documents t ON t.id = d.type_document_id
WHERE COALESCE(d.statut_document, 'actif') = 'actif';

CREATE OR REPLACE VIEW v_travaux_avancement AS
SELECT 
  t.id, t.code, t.titre, t.statut, t.type_travaux, t.date_debut, t.date_butoir,
  t.devis_montant, t.progression, t.client_id, t.ascenseur_id, t.technicien_id, t.created_at,
  COALESCE((SELECT COUNT(*) FROM travaux_etapes WHERE travaux_id = t.id), 0) AS nb_etapes,
  COALESCE((SELECT COUNT(*) FROM travaux_etapes WHERE travaux_id = t.id AND statut = 'termine'), 0) AS nb_etapes_terminees,
  COALESCE((SELECT COUNT(*) FROM travaux_pieces WHERE travaux_id = t.id), 0) AS nb_pieces,
  COALESCE((SELECT COUNT(*) FROM travaux_pieces WHERE travaux_id = t.id AND statut = 'installe'), 0) AS nb_pieces_installees,
  COALESCE((SELECT COUNT(*) FROM travaux_pieces WHERE travaux_id = t.id AND statut = 'a_commander'), 0) AS nb_pieces_a_commander,
  COALESCE((SELECT SUM(quantite_prevue * COALESCE(prix_unitaire_ht, 0)) FROM travaux_pieces WHERE travaux_id = t.id), 0) AS cout_pieces_prevu,
  COALESCE((SELECT SUM(duree_prevue_heures) FROM travaux_etapes WHERE travaux_id = t.id), 0) AS heures_prevues,
  COALESCE((SELECT SUM(duree_heures) FROM travaux_temps WHERE travaux_id = t.id), 0) AS heures_reelles
FROM travaux t WHERE COALESCE(t.archive, FALSE) = FALSE;

CREATE OR REPLACE VIEW v_alertes_stock_vehicule AS
SELECT 
  v.id AS vehicule_id, v.immatriculation, v.marque || ' ' || v.modele AS vehicule_nom,
  t.prenom || ' ' || t.nom AS technicien_nom,
  COUNT(*) FILTER (WHERE sv.quantite = 0) AS nb_ruptures,
  COUNT(*) FILTER (WHERE sv.quantite > 0 AND sv.quantite <= sv.quantite_min) AS nb_critiques,
  ARRAY_AGG(a.reference) FILTER (WHERE sv.quantite <= sv.quantite_min) AS refs_alerte
FROM vehicules v
LEFT JOIN techniciens t ON t.id = v.technicien_id
LEFT JOIN stock_vehicule sv ON sv.vehicule_id = v.id
LEFT JOIN stock_articles a ON a.id = sv.article_id
WHERE v.statut = 'disponible'
GROUP BY v.id, t.prenom, t.nom
HAVING COUNT(*) FILTER (WHERE sv.quantite <= sv.quantite_min) > 0;

-- ============================================================
-- 6. FONCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION travaux_reserver_pieces(p_travaux_id UUID, p_vehicule_id UUID DEFAULT NULL)
RETURNS TABLE (piece_id UUID, reference VARCHAR, quantite_reservee INTEGER, source VARCHAR, statut VARCHAR) AS $$
DECLARE v_piece RECORD; v_stock_dispo INTEGER;
BEGIN
  FOR v_piece IN SELECT tp.id, tp.article_id, tp.reference, tp.quantite_prevue
    FROM travaux_pieces tp WHERE tp.travaux_id = p_travaux_id AND tp.statut = 'a_commander'
  LOOP
    SELECT COALESCE(quantite_stock, 0) INTO v_stock_dispo FROM stock_articles WHERE id = v_piece.article_id;
    IF v_stock_dispo >= v_piece.quantite_prevue THEN
      UPDATE travaux_pieces SET quantite_reservee = v_piece.quantite_prevue, source = 'stock_depot', statut = 'reserve' WHERE id = v_piece.id;
      UPDATE stock_articles SET quantite_stock = quantite_stock - v_piece.quantite_prevue WHERE id = v_piece.article_id;
      RETURN QUERY SELECT v_piece.id, v_piece.reference, v_piece.quantite_prevue, 'stock_depot'::VARCHAR, 'reserve'::VARCHAR;
    ELSE
      RETURN QUERY SELECT v_piece.id, v_piece.reference, 0, 'commande'::VARCHAR, 'a_commander'::VARCHAR;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generer_demande_reappro(p_vehicule_id UUID, p_technicien_id UUID)
RETURNS UUID AS $$
DECLARE v_demande_id UUID; v_count INTEGER := 0;
BEGIN
  INSERT INTO stock_demandes_reappro (vehicule_id, technicien_id) VALUES (p_vehicule_id, p_technicien_id) RETURNING id INTO v_demande_id;
  INSERT INTO stock_demandes_reappro_lignes (demande_id, article_id, reference, designation, quantite_demandee, motif)
  SELECT v_demande_id, sv.article_id, a.reference, a.designation, GREATEST(sv.quantite_max - sv.quantite, 1),
    CASE WHEN sv.quantite = 0 THEN 'Rupture' ELSE 'Stock bas' END
  FROM stock_vehicule sv JOIN stock_articles a ON a.id = sv.article_id
  WHERE sv.vehicule_id = p_vehicule_id AND sv.quantite <= sv.quantite_min;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN DELETE FROM stock_demandes_reappro WHERE id = v_demande_id; RETURN NULL; END IF;
  RETURN v_demande_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. DONNÉES INITIALES
-- ============================================================

INSERT INTO ged_types_documents (code, libelle, categorie, duree_validite_mois, obligatoire, ordre_affichage) VALUES
  ('CERT_CONF', 'Certificat de conformité CE', 'reglementaire', NULL, TRUE, 1),
  ('RAPPORT_CT', 'Rapport contrôle technique', 'reglementaire', 60, TRUE, 2),
  ('CARNET_ENTRETIEN', 'Carnet d''entretien', 'reglementaire', NULL, TRUE, 3),
  ('CONTRAT', 'Contrat maintenance', 'administratif', 12, TRUE, 5),
  ('NOTICE_CONSTR', 'Notice constructeur', 'technique', NULL, FALSE, 10),
  ('SCHEMA_ELEC', 'Schéma électrique', 'technique', NULL, FALSE, 11),
  ('PV_RECEPTION', 'PV de réception', 'administratif', NULL, FALSE, 20),
  ('PV_MES', 'PV mise en service', 'administratif', NULL, FALSE, 21),
  ('DEVIS', 'Devis', 'commercial', NULL, FALSE, 30),
  ('FACTURE', 'Facture', 'commercial', NULL, FALSE, 31),
  ('PHOTO_INSTALL', 'Photo installation', 'photo', NULL, FALSE, 40),
  ('PHOTO_INTER', 'Photo intervention', 'photo', NULL, FALSE, 41),
  ('RAPPORT_INTER', 'Rapport intervention', 'technique', NULL, FALSE, 15)
ON CONFLICT (code) DO NOTHING;

SELECT 'Intégrations OK!' AS resultat;
