-- ============================================
-- MODULE "MON CATALOGUE" - DOSSIERS ET FAVORIS
-- ============================================

-- Table des dossiers personnalisés
CREATE TABLE IF NOT EXISTS pieces_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Pour filtrer par utilisateur
  nom TEXT NOT NULL,
  description TEXT,
  couleur TEXT DEFAULT '#3b82f6', -- Couleur hex pour l'affichage
  icone TEXT DEFAULT 'Folder', -- Nom de l'icône Lucide
  parent_id UUID REFERENCES pieces_dossiers(id) ON DELETE SET NULL, -- Support sous-dossiers
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_dossiers_user ON pieces_dossiers(user_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_parent ON pieces_dossiers(parent_id);

-- Table des favoris (liens user ↔ pièces avec métadonnées)
CREATE TABLE IF NOT EXISTS pieces_favoris (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  
  -- Pièce référencée (soit catalogue, soit personnelle)
  piece_catalogue_id UUID REFERENCES pieces_catalogue(id) ON DELETE CASCADE,
  piece_personnelle_id UUID REFERENCES pieces_personnelles(id) ON DELETE CASCADE,
  
  -- Organisation
  dossier_id UUID REFERENCES pieces_dossiers(id) ON DELETE SET NULL,
  
  -- Métadonnées personnelles
  notes TEXT,
  quantite_habituelle INT DEFAULT 1,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte : une pièce ne peut être favorite qu'une fois par user
  CONSTRAINT unique_favori_catalogue UNIQUE (user_id, piece_catalogue_id),
  CONSTRAINT unique_favori_perso UNIQUE (user_id, piece_personnelle_id),
  -- Au moins une des deux références doit être renseignée
  CONSTRAINT check_piece_ref CHECK (piece_catalogue_id IS NOT NULL OR piece_personnelle_id IS NOT NULL)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_favoris_user ON pieces_favoris(user_id);
CREATE INDEX IF NOT EXISTS idx_favoris_dossier ON pieces_favoris(dossier_id);
CREATE INDEX IF NOT EXISTS idx_favoris_piece_cat ON pieces_favoris(piece_catalogue_id);
CREATE INDEX IF NOT EXISTS idx_favoris_piece_perso ON pieces_favoris(piece_personnelle_id);
CREATE INDEX IF NOT EXISTS idx_favoris_tags ON pieces_favoris USING gin(tags);

-- Vue enrichie des favoris avec infos pièces
CREATE OR REPLACE VIEW v_pieces_favoris AS
SELECT 
  f.id as favori_id,
  f.user_id,
  f.dossier_id,
  f.notes as favori_notes,
  f.quantite_habituelle,
  f.tags as favori_tags,
  f.created_at as favori_created_at,
  
  -- Info dossier
  d.nom as dossier_nom,
  d.couleur as dossier_couleur,
  d.icone as dossier_icone,
  
  -- Info pièce (depuis catalogue ou personnelle)
  COALESCE(pc.id, pp.id) as piece_id,
  COALESCE(pc.reference, pp.reference) as reference,
  COALESCE(pc.designation, pp.designation) as designation,
  COALESCE(pc.description, pp.description) as description,
  COALESCE(pc.photo_url, pp.photo_url) as photo_url,
  COALESCE(pc.fournisseur_code, pp.fournisseur_prefere) as fournisseur,
  pc.prix_ht,
  pc.marque_compatible,
  pc.categorie_code,
  
  -- Source
  CASE 
    WHEN pc.id IS NOT NULL THEN 'catalogue'
    ELSE 'personnelle'
  END as source

FROM pieces_favoris f
LEFT JOIN pieces_dossiers d ON f.dossier_id = d.id
LEFT JOIN pieces_catalogue pc ON f.piece_catalogue_id = pc.id
LEFT JOIN pieces_personnelles pp ON f.piece_personnelle_id = pp.id;

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Ajouter une pièce aux favoris
CREATE OR REPLACE FUNCTION ajouter_favori(
  p_user_id UUID,
  p_piece_catalogue_id UUID DEFAULT NULL,
  p_piece_personnelle_id UUID DEFAULT NULL,
  p_dossier_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO pieces_favoris (user_id, piece_catalogue_id, piece_personnelle_id, dossier_id, notes)
  VALUES (p_user_id, p_piece_catalogue_id, p_piece_personnelle_id, p_dossier_id, p_notes)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Retirer une pièce des favoris
CREATE OR REPLACE FUNCTION retirer_favori(
  p_user_id UUID,
  p_piece_catalogue_id UUID DEFAULT NULL,
  p_piece_personnelle_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM pieces_favoris 
  WHERE user_id = p_user_id 
    AND (
      (p_piece_catalogue_id IS NOT NULL AND piece_catalogue_id = p_piece_catalogue_id)
      OR (p_piece_personnelle_id IS NOT NULL AND piece_personnelle_id = p_piece_personnelle_id)
    );
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Déplacer un favori vers un autre dossier
CREATE OR REPLACE FUNCTION deplacer_favori(
  p_favori_id UUID,
  p_nouveau_dossier_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE pieces_favoris 
  SET dossier_id = p_nouveau_dossier_id, updated_at = NOW()
  WHERE id = p_favori_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Rechercher dans les favoris
CREATE OR REPLACE FUNCTION rechercher_favoris(
  p_user_id UUID,
  p_recherche TEXT DEFAULT NULL,
  p_dossier_id UUID DEFAULT NULL,
  p_fournisseur TEXT DEFAULT NULL,
  p_categorie TEXT DEFAULT NULL
) RETURNS TABLE (
  favori_id UUID,
  piece_id UUID,
  reference TEXT,
  designation TEXT,
  description TEXT,
  photo_url TEXT,
  fournisseur TEXT,
  dossier_id UUID,
  dossier_nom TEXT,
  dossier_couleur TEXT,
  dossier_icone TEXT,
  favori_notes TEXT,
  source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.favori_id,
    v.piece_id,
    v.reference,
    v.designation,
    v.description,
    v.photo_url,
    v.fournisseur,
    v.dossier_id,
    v.dossier_nom,
    v.dossier_couleur,
    v.dossier_icone,
    v.favori_notes,
    v.source
  FROM v_pieces_favoris v
  WHERE v.user_id = p_user_id
    AND (p_recherche IS NULL OR (
      v.reference ILIKE '%' || p_recherche || '%'
      OR v.designation ILIKE '%' || p_recherche || '%'
      OR v.favori_notes ILIKE '%' || p_recherche || '%'
    ))
    AND (p_dossier_id IS NULL OR v.dossier_id = p_dossier_id)
    AND (p_fournisseur IS NULL OR v.fournisseur = p_fournisseur)
    AND (p_categorie IS NULL OR v.categorie_code = p_categorie)
  ORDER BY v.reference;
END;
$$ LANGUAGE plpgsql;

-- Statistiques des favoris
CREATE OR REPLACE FUNCTION stats_favoris(p_user_id UUID)
RETURNS TABLE (
  total_favoris BIGINT,
  total_dossiers BIGINT,
  par_fournisseur JSONB,
  par_dossier JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM pieces_favoris WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM pieces_dossiers WHERE user_id = p_user_id),
    (SELECT COALESCE(jsonb_object_agg(fournisseur, cnt), '{}'::jsonb)
     FROM (
       SELECT v.fournisseur, COUNT(*) as cnt
       FROM v_pieces_favoris v
       WHERE v.user_id = p_user_id AND v.fournisseur IS NOT NULL
       GROUP BY v.fournisseur
     ) sub),
    (SELECT COALESCE(jsonb_object_agg(dossier_nom, cnt), '{}'::jsonb)
     FROM (
       SELECT COALESCE(v.dossier_nom, 'Non classé') as dossier_nom, COUNT(*) as cnt
       FROM v_pieces_favoris v
       WHERE v.user_id = p_user_id
       GROUP BY v.dossier_nom
     ) sub);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONNÉES DE DÉMONSTRATION
-- ============================================

-- Dossiers par défaut (sans user_id pour être accessibles à tous)
INSERT INTO pieces_dossiers (nom, description, couleur, icone, ordre) VALUES
  ('Pièces courantes', 'Pièces fréquemment utilisées', '#22c55e', 'Zap', 1),
  ('Stock véhicule', 'Pièces disponibles dans le véhicule', '#3b82f6', 'Truck', 2),
  ('Références OTIS', 'Pièces pour ascenseurs OTIS', '#ef4444', 'Building2', 3),
  ('Références KONE', 'Pièces pour ascenseurs KONE', '#a855f7', 'Building2', 4),
  ('À commander', 'Pièces à commander prochainement', '#f59e0b', 'ShoppingCart', 5)
ON CONFLICT DO NOTHING;

-- Commentaires
COMMENT ON TABLE pieces_dossiers IS 'Dossiers personnalisés pour organiser les pièces favorites';
COMMENT ON TABLE pieces_favoris IS 'Pièces favorites des utilisateurs avec organisation par dossier';
COMMENT ON VIEW v_pieces_favoris IS 'Vue enrichie des favoris avec informations pièces et dossiers';
