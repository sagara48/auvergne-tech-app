-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Contrôles Techniques — Tables complètes
-- controles_techniques, controle_observations, controle_levees, controle_check_items
-- ═══════════════════════════════════════════════════════════════

-- 1. Table principale des contrôles
CREATE TABLE IF NOT EXISTS controles_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ascenseur_id UUID NOT NULL REFERENCES ascenseurs(id) ON DELETE CASCADE,
  technicien_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type_controle TEXT NOT NULL DEFAULT 'semestriel',
  statut TEXT NOT NULL DEFAULT 'planifie',
  organisme TEXT,
  date_planifiee DATE NOT NULL,
  date_realisation DATE,
  rapport_url TEXT,
  notes TEXT DEFAULT '',
  score_conformite INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_controles_ascenseur ON controles_techniques(ascenseur_id);
CREATE INDEX idx_controles_date ON controles_techniques(date_planifiee);
CREATE INDEX idx_controles_statut ON controles_techniques(statut);
CREATE INDEX idx_controles_type ON controles_techniques(type_controle);

-- 2. Observations (non-conformités)
CREATE TABLE IF NOT EXISTS controle_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id UUID NOT NULL REFERENCES controles_techniques(id) ON DELETE CASCADE,
  gravite TEXT NOT NULL DEFAULT 'OC',
  statut TEXT NOT NULL DEFAULT 'ouverte',
  categorie TEXT NOT NULL DEFAULT 'divers',
  description TEXT NOT NULL,
  reference_norme TEXT,
  photo_url TEXT,
  delai_levee DATE,
  devis_montant NUMERIC(10,2),
  travaux_id UUID REFERENCES travaux(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obs_controle ON controle_observations(controle_id);
CREATE INDEX idx_obs_gravite ON controle_observations(gravite);
CREATE INDEX idx_obs_statut ON controle_observations(statut);

-- 3. Levées d'observations
CREATE TABLE IF NOT EXISTS controle_levees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES controle_observations(id) ON DELETE CASCADE,
  technicien_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_levee DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  photo_avant_url TEXT,
  photo_apres_url TEXT,
  validee BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_levees_obs ON controle_levees(observation_id);

-- 4. Check-list items
CREATE TABLE IF NOT EXISTS controle_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id UUID NOT NULL REFERENCES controles_techniques(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  libelle TEXT NOT NULL,
  conforme BOOLEAN,
  commentaire TEXT,
  photo_url TEXT
);

CREATE INDEX idx_check_controle ON controle_check_items(controle_id);

-- Triggers updated_at
CREATE OR REPLACE FUNCTION update_controles_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_controles_updated_at BEFORE UPDATE ON controles_techniques
  FOR EACH ROW EXECUTE FUNCTION update_controles_updated_at();

-- RLS
ALTER TABLE controles_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_levees ENABLE ROW LEVEL SECURITY;
ALTER TABLE controle_check_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "controles_all" ON controles_techniques FOR ALL USING (true);
CREATE POLICY "observations_all" ON controle_observations FOR ALL USING (true);
CREATE POLICY "levees_all" ON controle_levees FOR ALL USING (true);
CREATE POLICY "check_items_all" ON controle_check_items FOR ALL USING (true);
