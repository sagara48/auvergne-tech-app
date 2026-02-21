-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: IoT Sigma4Lifts — Tables télésurveillance
-- iot_lifts, iot_alerts, iot_events, iot_traffic, iot_health
-- ═══════════════════════════════════════════════════════════════

-- 1. Cache statut temps réel des ascenseurs connectés
CREATE TABLE IF NOT EXISTS iot_lifts (
  lift_id TEXT PRIMARY KEY,
  ascenseur_id UUID REFERENCES ascenseurs(id) ON DELETE SET NULL,
  nom TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  etat TEXT NOT NULL DEFAULT 'normal',
  etage INTEGER NOT NULL DEFAULT 0,
  etage_max INTEGER NOT NULL DEFAULT 10,
  position_mm INTEGER NOT NULL DEFAULT 0,
  porte TEXT NOT NULL DEFAULT 'fermee',
  en_mouvement BOOLEAN NOT NULL DEFAULT false,
  direction TEXT NOT NULL DEFAULT 'idle',
  batterie_percent INTEGER NOT NULL DEFAULT 100,
  temperature_machinerie NUMERIC(5,1) NOT NULL DEFAULT 22.0,
  securites_ok BOOLEAN NOT NULL DEFAULT true,
  connecte BOOLEAN NOT NULL DEFAULT true,
  dernier_signal TIMESTAMPTZ NOT NULL DEFAULT now(),
  firmware_version TEXT DEFAULT '',
  hardware_version TEXT DEFAULT '',
  controller_type TEXT DEFAULT 'MP ecoGO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE iot_lifts ADD COLUMN IF NOT EXISTS ascenseur_id UUID REFERENCES ascenseurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_iot_lifts_etat ON iot_lifts(etat);
CREATE INDEX IF NOT EXISTS idx_iot_lifts_connecte ON iot_lifts(connecte);
CREATE INDEX IF NOT EXISTS idx_iot_lifts_ascenseur ON iot_lifts(ascenseur_id);

-- 2. Alertes (actives + historique)
CREATE TABLE IF NOT EXISTS iot_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lift_id TEXT NOT NULL REFERENCES iot_lifts(lift_id) ON DELETE CASCADE,
  niveau TEXT NOT NULL DEFAULT 'info',
  type TEXT NOT NULL DEFAULT 'erreur',
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  acquittee BOOLEAN NOT NULL DEFAULT false,
  acquitte_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acquitte_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iot_alerts_lift ON iot_alerts(lift_id);
CREATE INDEX IF NOT EXISTS idx_iot_alerts_acquittee ON iot_alerts(acquittee);
CREATE INDEX IF NOT EXISTS idx_iot_alerts_timestamp ON iot_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_iot_alerts_niveau ON iot_alerts(niveau);

-- 3. Journal événements
CREATE TABLE IF NOT EXISTS iot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lift_id TEXT NOT NULL REFERENCES iot_lifts(lift_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'trajet',
  description TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_iot_events_lift ON iot_events(lift_id);
CREATE INDEX IF NOT EXISTS idx_iot_events_type ON iot_events(type);
CREATE INDEX IF NOT EXISTS idx_iot_events_timestamp ON iot_events(timestamp DESC);

-- 4. Statistiques trafic journalières
CREATE TABLE IF NOT EXISTS iot_traffic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lift_id TEXT NOT NULL REFERENCES iot_lifts(lift_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  trajets_total INTEGER NOT NULL DEFAULT 0,
  trajets_par_heure JSONB NOT NULL DEFAULT '[]'::jsonb,
  etages_frequentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  temps_arret_moyen NUMERIC(8,2) DEFAULT 0,
  consommation_kwh NUMERIC(8,2),
  UNIQUE(lift_id, date)
);

CREATE INDEX IF NOT EXISTS idx_iot_traffic_lift_date ON iot_traffic(lift_id, date);

-- 5. Scores santé composants (maintenance prédictive)
CREATE TABLE IF NOT EXISTS iot_health (
  lift_id TEXT PRIMARY KEY REFERENCES iot_lifts(lift_id) ON DELETE CASCADE,
  score_global INTEGER NOT NULL DEFAULT 100,
  moteur INTEGER NOT NULL DEFAULT 100,
  portes INTEGER NOT NULL DEFAULT 100,
  cables INTEGER NOT NULL DEFAULT 100,
  frein INTEGER NOT NULL DEFAULT 100,
  variateur INTEGER NOT NULL DEFAULT 100,
  dernier_calcul TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers
CREATE OR REPLACE FUNCTION update_iot_lifts_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iot_lifts_updated ON iot_lifts;
CREATE TRIGGER trg_iot_lifts_updated BEFORE UPDATE ON iot_lifts
  FOR EACH ROW EXECUTE FUNCTION update_iot_lifts_updated_at();

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE iot_lifts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE iot_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS
ALTER TABLE iot_lifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_traffic ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iot_lifts_all" ON iot_lifts FOR ALL USING (true);
CREATE POLICY "iot_alerts_all" ON iot_alerts FOR ALL USING (true);
CREATE POLICY "iot_events_all" ON iot_events FOR ALL USING (true);
CREATE POLICY "iot_traffic_all" ON iot_traffic FOR ALL USING (true);
CREATE POLICY "iot_health_all" ON iot_health FOR ALL USING (true);
