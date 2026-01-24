-- Migration pour ajouter la colonne code_ascenseur à la table notes
-- Cette colonne permet de lier une note à un ascenseur du parc via son code

-- Ajouter la colonne si elle n'existe pas
ALTER TABLE notes ADD COLUMN IF NOT EXISTS code_ascenseur TEXT;

-- Créer un index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_notes_code_ascenseur ON notes(code_ascenseur);

-- Commentaire sur la colonne
COMMENT ON COLUMN notes.code_ascenseur IS 'Code appareil de l ascenseur lié (ex: 00110, 03155)';
