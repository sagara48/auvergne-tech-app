-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Table tolerie_pieces
-- Module Atelier Tôlerie — stockage pièces en base
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tolerie_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technicien_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  travaux_id UUID REFERENCES travaux(id) ON DELETE SET NULL,

  -- Matière
  matiere TEXT NOT NULL DEFAULT 'acier',
  epaisseur NUMERIC(6,2) NOT NULL DEFAULT 2,
  finition TEXT NOT NULL DEFAULT 'brut',

  -- Forme
  forme_base TEXT NOT NULL DEFAULT 'rectangle',
  largeur NUMERIC(10,2) NOT NULL DEFAULT 200,
  hauteur NUMERIC(10,2) NOT NULL DEFAULT 100,
  branche_l NUMERIC(10,2),
  profondeur_u NUMERIC(10,2),
  decalage_z NUMERIC(10,2),

  -- Opérations (stockage JSONB)
  plis JSONB NOT NULL DEFAULT '[]'::jsonb,
  trous JSONB NOT NULL DEFAULT '[]'::jsonb,
  encoches JSONB NOT NULL DEFAULT '[]'::jsonb,
  chanfreins JSONB NOT NULL DEFAULT '[]'::jsonb,
  marquages JSONB NOT NULL DEFAULT '[]'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Meta
  nom TEXT NOT NULL DEFAULT 'Nouvelle pièce',
  reference TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  remarques TEXT DEFAULT '',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_tolerie_pieces_technicien ON tolerie_pieces(technicien_id);
CREATE INDEX idx_tolerie_pieces_travaux ON tolerie_pieces(travaux_id);
CREATE INDEX idx_tolerie_pieces_reference ON tolerie_pieces(reference);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_tolerie_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tolerie_updated_at
  BEFORE UPDATE ON tolerie_pieces
  FOR EACH ROW EXECUTE FUNCTION update_tolerie_updated_at();

-- RLS
ALTER TABLE tolerie_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tolerie_select" ON tolerie_pieces FOR SELECT USING (true);
CREATE POLICY "tolerie_insert" ON tolerie_pieces FOR INSERT WITH CHECK (auth.uid() = technicien_id);
CREATE POLICY "tolerie_update" ON tolerie_pieces FOR UPDATE USING (auth.uid() = technicien_id);
CREATE POLICY "tolerie_delete" ON tolerie_pieces FOR DELETE USING (auth.uid() = technicien_id);
