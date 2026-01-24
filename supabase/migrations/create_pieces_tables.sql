-- ============================================
-- MODULE PIÈCES DÉTACHÉES - SCHÉMA SQL
-- ============================================

-- Table des fournisseurs
CREATE TABLE IF NOT EXISTS fournisseurs_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code TEXT UNIQUE,
  site_web TEXT,
  url_recherche TEXT, -- URL template pour recherche (ex: https://sodimas.com/search?q={query})
  telephone TEXT,
  email TEXT,
  logo_url TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les fournisseurs principaux
INSERT INTO fournisseurs_pieces (nom, code, site_web, url_recherche) VALUES
  ('Sodimas', 'SODIMAS', 'https://www.sodimas.com', 'https://www.sodimas.com/fr/recherche?search={query}'),
  ('Hauer', 'HAUER', 'https://www.hfrench.com', 'https://www.hfrench.com/fr/recherche?q={query}'),
  ('MGTI', 'MGTI', 'https://www.mgti.fr', 'https://www.mgti.fr/recherche?s={query}')
ON CONFLICT (code) DO NOTHING;

-- Table des catégories de pièces
CREATE TABLE IF NOT EXISTS categories_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  icone TEXT, -- nom de l'icône Lucide
  couleur TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES categories_pieces(id),
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les catégories principales
INSERT INTO categories_pieces (nom, code, icone, couleur, ordre) VALUES
  ('Machinerie', 'MACHINERIE', 'Cog', '#ef4444', 1),
  ('Portes palières', 'PORTES_PALIERES', 'DoorOpen', '#f59e0b', 2),
  ('Portes cabine', 'PORTES_CABINE', 'DoorClosed', '#eab308', 3),
  ('Cabine', 'CABINE', 'Box', '#22c55e', 4),
  ('Boutons / Signalisation', 'BOUTONS_SIGNAL', 'CircleDot', '#3b82f6', 5),
  ('Électronique / Cartes', 'ELECTRONIQUE', 'Cpu', '#8b5cf6', 6),
  ('Sécurité', 'SECURITE', 'Shield', '#ec4899', 7),
  ('Câblage', 'CABLAGE', 'Cable', '#64748b', 8),
  ('Divers', 'DIVERS', 'Package', '#71717a', 9)
ON CONFLICT (code) DO NOTHING;

-- Table principale du catalogue de pièces
CREATE TABLE IF NOT EXISTS pieces_catalogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  reference TEXT NOT NULL,
  reference_fabricant TEXT,
  designation TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  fournisseur_id UUID REFERENCES fournisseurs_pieces(id),
  fournisseur_code TEXT, -- Code court pour affichage
  categorie_id UUID REFERENCES categories_pieces(id),
  categorie_code TEXT,
  sous_categorie TEXT,
  
  -- Compatibilité
  marque_compatible TEXT, -- Schindler, Otis, Kone, ThyssenKrupp, etc.
  modeles_compatibles TEXT[], -- Liste des modèles compatibles
  
  -- Caractéristiques
  poids_grammes INT,
  dimensions JSONB, -- {profondeur, hauteur, largeur, longueur}
  unite TEXT DEFAULT 'pièce',
  
  -- Médias
  photo_url TEXT,
  fiche_technique_url TEXT,
  
  -- Prix (indicatif)
  prix_ht DECIMAL(10,2),
  devise TEXT DEFAULT 'EUR',
  
  -- Indexation pour recherche IA
  mots_cles TEXT[], -- Mots-clés pour améliorer la recherche
  caracteristiques JSONB, -- Caractéristiques techniques structurées
  
  -- Métadonnées
  source TEXT, -- 'catalogue_sodimas', 'catalogue_mgti', 'manuel', etc.
  page_catalogue INT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index unique (permet l'import CSV sans blocage)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pieces_ref_fournisseur ON pieces_catalogue(reference, fournisseur_code);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_pieces_reference ON pieces_catalogue(reference);
CREATE INDEX IF NOT EXISTS idx_pieces_designation ON pieces_catalogue USING gin(to_tsvector('french', designation));
CREATE INDEX IF NOT EXISTS idx_pieces_marque ON pieces_catalogue(marque_compatible);
CREATE INDEX IF NOT EXISTS idx_pieces_fournisseur ON pieces_catalogue(fournisseur_code);
CREATE INDEX IF NOT EXISTS idx_pieces_categorie ON pieces_catalogue(categorie_code);
CREATE INDEX IF NOT EXISTS idx_pieces_mots_cles ON pieces_catalogue USING gin(mots_cles);

-- Table des recherches par photo (historique)
CREATE TABLE IF NOT EXISTS recherches_pieces_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Image analysée
  photo_url TEXT,
  photo_base64 TEXT, -- Stockage temporaire pour l'analyse
  
  -- Résultat de l'analyse IA
  analyse_ia JSONB, -- {type_piece, marque_detectee, references_lues, confiance, suggestions}
  
  -- Contexte
  code_ascenseur TEXT, -- Si recherche liée à un ascenseur
  user_id UUID,
  
  -- Résultat
  piece_trouvee_id UUID REFERENCES pieces_catalogue(id),
  piece_sauvegardee BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des pièces personnelles (catalogue enrichi par l'utilisateur)
CREATE TABLE IF NOT EXISTS pieces_personnelles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Copie des infos de base
  reference TEXT NOT NULL,
  designation TEXT NOT NULL,
  description TEXT,
  
  -- Lien avec catalogue officiel
  piece_catalogue_id UUID REFERENCES pieces_catalogue(id),
  
  -- Infos personnalisées
  fournisseur_prefere TEXT,
  prix_achat DECIMAL(10,2),
  delai_livraison_jours INT,
  notes TEXT,
  
  -- Photo personnelle
  photo_url TEXT,
  
  -- Tags personnels
  tags TEXT[],
  
  -- Métadonnées
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table historique des pièces par ascenseur
CREATE TABLE IF NOT EXISTS historique_pieces_ascenseur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ascenseur concerné
  code_ascenseur TEXT NOT NULL,
  
  -- Pièce
  piece_id UUID REFERENCES pieces_catalogue(id),
  piece_perso_id UUID REFERENCES pieces_personnelles(id),
  reference TEXT,
  designation TEXT,
  
  -- Intervention
  date_installation DATE,
  date_commande DATE,
  quantite INT DEFAULT 1,
  prix_unitaire DECIMAL(10,2),
  fournisseur TEXT,
  numero_commande TEXT,
  
  -- Technicien
  technicien_id UUID,
  technicien_nom TEXT,
  
  -- Notes
  motif TEXT, -- Panne, usure, préventif, etc.
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historique_pieces_ascenseur ON historique_pieces_ascenseur(code_ascenseur);
CREATE INDEX IF NOT EXISTS idx_historique_pieces_date ON historique_pieces_ascenseur(date_installation DESC);

-- Fonction de recherche full-text
CREATE OR REPLACE FUNCTION rechercher_pieces(terme TEXT, limite INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  reference TEXT,
  designation TEXT,
  marque_compatible TEXT,
  fournisseur_code TEXT,
  photo_url TEXT,
  score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.reference,
    p.designation,
    p.marque_compatible,
    p.fournisseur_code,
    p.photo_url,
    ts_rank(
      to_tsvector('french', COALESCE(p.reference, '') || ' ' || COALESCE(p.designation, '') || ' ' || COALESCE(p.marque_compatible, '')),
      plainto_tsquery('french', terme)
    ) as score
  FROM pieces_catalogue p
  WHERE 
    p.actif = true
    AND (
      p.reference ILIKE '%' || terme || '%'
      OR p.designation ILIKE '%' || terme || '%'
      OR p.marque_compatible ILIKE '%' || terme || '%'
      OR terme = ANY(p.mots_cles)
      OR to_tsvector('french', COALESCE(p.reference, '') || ' ' || COALESCE(p.designation, '')) @@ plainto_tsquery('french', terme)
    )
  ORDER BY score DESC, p.reference
  LIMIT limite;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE pieces_catalogue IS 'Catalogue unifié des pièces détachées ascenseurs (Sodimas, MGTI, Hauer, etc.)';
COMMENT ON TABLE recherches_pieces_photo IS 'Historique des recherches par photo avec analyse Claude Vision';
COMMENT ON TABLE pieces_personnelles IS 'Pièces ajoutées manuellement par les utilisateurs';
COMMENT ON TABLE historique_pieces_ascenseur IS 'Historique des pièces installées/commandées par ascenseur';
