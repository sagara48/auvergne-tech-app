-- Migration pour ajouter la colonne code_ascenseur à la table documents
-- Cette colonne permet de lier un document à un ascenseur du parc via son code

-- Ajouter la colonne si elle n'existe pas
ALTER TABLE documents ADD COLUMN IF NOT EXISTS code_ascenseur TEXT;

-- Créer un index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_documents_code_ascenseur ON documents(code_ascenseur);

-- Commentaire sur la colonne
COMMENT ON COLUMN documents.code_ascenseur IS 'Code appareil de l ascenseur lié (ex: 00110, 03155)';
