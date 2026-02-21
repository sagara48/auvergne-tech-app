// ═══════════════════════════════════════════════════════════════
// API TÔLERIE — CRUD Supabase pour pièces
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import type { PieceConfig } from './tolerie';

// ═══ DB → PieceConfig serialization ═══

function dbToPiece(row: any): PieceConfig {
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    technicien_id: row.technicien_id,
    travaux_id: row.travaux_id,
    matiere: row.matiere,
    epaisseur: row.epaisseur,
    finition: row.finition,
    formeBase: row.forme_base,
    largeur: row.largeur,
    hauteur: row.hauteur,
    brancheL: row.branche_l,
    profondeurU: row.profondeur_u,
    decalageZ: row.decalage_z,
    plis: row.plis || [],
    trous: row.trous || [],
    encoches: row.encoches || [],
    chanfreins: row.chanfreins || [],
    marquages: row.marquages || [],
    annotations: row.annotations || [],
    nom: row.nom,
    reference: row.reference,
    quantite: row.quantite,
    remarques: row.remarques || '',
  };
}

function pieceToDb(p: PieceConfig) {
  return {
    technicien_id: p.technicien_id,
    travaux_id: p.travaux_id,
    matiere: p.matiere,
    epaisseur: p.epaisseur,
    finition: p.finition,
    forme_base: p.formeBase,
    largeur: p.largeur,
    hauteur: p.hauteur,
    branche_l: p.brancheL,
    profondeur_u: p.profondeurU,
    decalage_z: p.decalageZ,
    plis: p.plis,
    trous: p.trous,
    encoches: p.encoches,
    chanfreins: p.chanfreins,
    marquages: p.marquages,
    annotations: p.annotations,
    nom: p.nom,
    reference: p.reference,
    quantite: p.quantite,
    remarques: p.remarques,
  };
}

// ═══ CRUD ═══

export async function getPieces(): Promise<PieceConfig[]> {
  const { data, error } = await supabase
    .from('tolerie_pieces')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbToPiece);
}

export async function getPieceById(id: string): Promise<PieceConfig> {
  const { data, error } = await supabase
    .from('tolerie_pieces')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return dbToPiece(data);
}

export async function getPiecesByTravaux(travauxId: string): Promise<PieceConfig[]> {
  const { data, error } = await supabase
    .from('tolerie_pieces')
    .select('*')
    .eq('travaux_id', travauxId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbToPiece);
}

export async function createPiece(piece: PieceConfig): Promise<PieceConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  const dbData = { ...pieceToDb(piece), technicien_id: piece.technicien_id || user?.id };
  
  const { data, error } = await supabase
    .from('tolerie_pieces')
    .insert(dbData)
    .select()
    .single();
  if (error) throw error;
  return dbToPiece(data);
}

export async function updatePiece(id: string, piece: Partial<PieceConfig>): Promise<PieceConfig> {
  const updates: any = {};
  if (piece.matiere !== undefined) updates.matiere = piece.matiere;
  if (piece.epaisseur !== undefined) updates.epaisseur = piece.epaisseur;
  if (piece.finition !== undefined) updates.finition = piece.finition;
  if (piece.formeBase !== undefined) updates.forme_base = piece.formeBase;
  if (piece.largeur !== undefined) updates.largeur = piece.largeur;
  if (piece.hauteur !== undefined) updates.hauteur = piece.hauteur;
  if (piece.brancheL !== undefined) updates.branche_l = piece.brancheL;
  if (piece.profondeurU !== undefined) updates.profondeur_u = piece.profondeurU;
  if (piece.decalageZ !== undefined) updates.decalage_z = piece.decalageZ;
  if (piece.plis !== undefined) updates.plis = piece.plis;
  if (piece.trous !== undefined) updates.trous = piece.trous;
  if (piece.encoches !== undefined) updates.encoches = piece.encoches;
  if (piece.chanfreins !== undefined) updates.chanfreins = piece.chanfreins;
  if (piece.marquages !== undefined) updates.marquages = piece.marquages;
  if (piece.annotations !== undefined) updates.annotations = piece.annotations;
  if (piece.nom !== undefined) updates.nom = piece.nom;
  if (piece.reference !== undefined) updates.reference = piece.reference;
  if (piece.quantite !== undefined) updates.quantite = piece.quantite;
  if (piece.remarques !== undefined) updates.remarques = piece.remarques;
  if (piece.travaux_id !== undefined) updates.travaux_id = piece.travaux_id;

  const { data, error } = await supabase
    .from('tolerie_pieces')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return dbToPiece(data);
}

export async function deletePiece(id: string): Promise<void> {
  const { error } = await supabase
    .from('tolerie_pieces')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ═══ Feature 13: Créer commande depuis pièce ═══

export async function creerCommandeDepuisPiece(piece: PieceConfig): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const code = `CMD-TOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const { data: commande, error: errCmd } = await supabase
    .from('commandes')
    .insert({
      code,
      technicien_id: user?.id,
      fournisseur: '',
      statut: 'brouillon',
      priorite: 'normale',
      notes: `Commande pièce tôlerie : ${piece.reference} — ${piece.nom}\nMatière: ${piece.matiere} ép.${piece.epaisseur}mm\nDimensions: ${piece.largeur}×${piece.hauteur}mm\nQté: ${piece.quantite}`,
    })
    .select()
    .single();
  if (errCmd) throw errCmd;

  // Ajouter la ligne
  const { error: errLigne } = await supabase
    .from('commande_lignes')
    .insert({
      commande_id: commande.id,
      designation: `${piece.nom} — ${piece.matiere} ép.${piece.epaisseur}mm — ${piece.largeur}×${piece.hauteur}mm`,
      reference: piece.reference,
      quantite: piece.quantite,
      quantite_recue: 0,
      notes: piece.remarques || '',
      detail: `Finition: ${piece.finition} | Plis: ${piece.plis.length} | Trous: ${piece.trous.length}`,
    });
  if (errLigne) throw errLigne;

  return commande.id;
}

// ═══ Feature 16: Multi-pièces (récupérer plusieurs) ═══

export async function getPiecesMultiple(ids: string[]): Promise<PieceConfig[]> {
  const { data, error } = await supabase
    .from('tolerie_pieces')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return (data || []).map(dbToPiece);
}
