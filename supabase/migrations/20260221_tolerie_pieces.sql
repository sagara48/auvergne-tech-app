-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Table tolerie_pieces V2 (+ statut fabrication)
-- Compatible V1 existante (ALTER) ou création fresh
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tolerie_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technicien_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  travaux_id UUID REFERENCES travaux(id) ON DELETE SET NULL,

  matiere TEXT NOT NULL DEFAULT 'acier',
  epaisseur NUMERIC(6,2) NOT NULL DEFAULT 2,
  finition TEXT NOT NULL DEFAULT 'brut',
  forme_base TEXT NOT NULL DEFAULT 'rectangle',
  largeur NUMERIC(10,2) NOT NULL DEFAULT 200,
  hauteur NUMERIC(10,2) NOT NULL DEFAULT 100,
  branche_l NUMERIC(10,2),
  profondeur_u NUMERIC(10,2),
  decalage_z NUMERIC(10,2),

  plis JSONB NOT NULL DEFAULT '[]'::jsonb,
  trous JSONB NOT NULL DEFAULT '[]'::jsonb,
  encoches JSONB NOT NULL DEFAULT '[]'::jsonb,
  chanfreins JSONB NOT NULL DEFAULT '[]'::jsonb,
  marquages JSONB NOT NULL DEFAULT '[]'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,

  nom TEXT NOT NULL DEFAULT 'Nouvelle pièce',
  reference TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  remarques TEXT DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V2: Ajout colonnes manquantes si table existante (V1 → V2)
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'brouillon';
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS statut_historique JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS travaux_id UUID REFERENCES travaux(id) ON DELETE SET NULL;
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS marquages JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tolerie_pieces ADD COLUMN IF NOT EXISTS chanfreins JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Index (IF NOT EXISTS pour idempotence)
CREATE INDEX IF NOT EXISTS idx_tolerie_technicien ON tolerie_pieces(technicien_id);
CREATE INDEX IF NOT EXISTS idx_tolerie_travaux ON tolerie_pieces(travaux_id);
CREATE INDEX IF NOT EXISTS idx_tolerie_reference ON tolerie_pieces(reference);
CREATE INDEX IF NOT EXISTS idx_tolerie_statut ON tolerie_pieces(statut);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_tolerie_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tolerie_updated_at ON tolerie_pieces;
CREATE TRIGGER trg_tolerie_updated_at BEFORE UPDATE ON tolerie_pieces
  FOR EACH ROW EXECUTE FUNCTION update_tolerie_updated_at();

-- Feature 34: Realtime (ignore si déjà ajouté)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tolerie_pieces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE tolerie_pieces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tolerie_select" ON tolerie_pieces;
DROP POLICY IF EXISTS "tolerie_insert" ON tolerie_pieces;
DROP POLICY IF EXISTS "tolerie_update" ON tolerie_pieces;
DROP POLICY IF EXISTS "tolerie_delete" ON tolerie_pieces;
CREATE POLICY "tolerie_select" ON tolerie_pieces FOR SELECT USING (true);
CREATE POLICY "tolerie_insert" ON tolerie_pieces FOR INSERT WITH CHECK (auth.uid() = technicien_id);
CREATE POLICY "tolerie_update" ON tolerie_pieces FOR UPDATE USING (auth.uid() = technicien_id);
CREATE POLICY "tolerie_delete" ON tolerie_pieces FOR DELETE USING (auth.uid() = technicien_id);
