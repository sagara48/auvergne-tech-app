// ═══════════════════════════════════════════════════════════════
// API TÔLERIE V4 — CRUD + Statut(29) + Realtime(34) + Travaux(26)
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import type { PieceConfig, StatutFabrication } from './tolerie';

function dbToPiece(row: any): PieceConfig {
  return {
    id: row.id, created_at: row.created_at, updated_at: row.updated_at,
    technicien_id: row.technicien_id, travaux_id: row.travaux_id,
    statut: row.statut || 'brouillon',
    statut_historique: row.statut_historique || [],
    matiere: row.matiere, epaisseur: row.epaisseur, finition: row.finition,
    formeBase: row.forme_base, largeur: row.largeur, hauteur: row.hauteur,
    brancheL: row.branche_l, profondeurU: row.profondeur_u, decalageZ: row.decalage_z,
    plis: row.plis || [], trous: row.trous || [], encoches: row.encoches || [],
    chanfreins: row.chanfreins || [], marquages: row.marquages || [], annotations: row.annotations || [],
    nom: row.nom, reference: row.reference, quantite: row.quantite, remarques: row.remarques || '',
  };
}

function pieceToDb(p: PieceConfig) {
  return {
    technicien_id: p.technicien_id, travaux_id: p.travaux_id,
    statut: p.statut, statut_historique: p.statut_historique,
    matiere: p.matiere, epaisseur: p.epaisseur, finition: p.finition,
    forme_base: p.formeBase, largeur: p.largeur, hauteur: p.hauteur,
    branche_l: p.brancheL, profondeur_u: p.profondeurU, decalage_z: p.decalageZ,
    plis: p.plis, trous: p.trous, encoches: p.encoches,
    chanfreins: p.chanfreins, marquages: p.marquages, annotations: p.annotations,
    nom: p.nom, reference: p.reference, quantite: p.quantite, remarques: p.remarques,
  };
}

export async function getPieces(): Promise<PieceConfig[]> {
  const { data, error } = await supabase.from('tolerie_pieces').select('*').order('updated_at', { ascending: false });
  if (error) throw error; return (data || []).map(dbToPiece);
}

export async function getPieceById(id: string): Promise<PieceConfig> {
  const { data, error } = await supabase.from('tolerie_pieces').select('*').eq('id', id).single();
  if (error) throw error; return dbToPiece(data);
}

export async function getPiecesByTravaux(travauxId: string): Promise<PieceConfig[]> {
  const { data, error } = await supabase.from('tolerie_pieces').select('*').eq('travaux_id', travauxId).order('created_at', { ascending: false });
  if (error) throw error; return (data || []).map(dbToPiece);
}

export async function createPiece(piece: PieceConfig): Promise<PieceConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  const dbData = { ...pieceToDb(piece), technicien_id: piece.technicien_id || user?.id };
  const { data, error } = await supabase.from('tolerie_pieces').insert(dbData).select().single();
  if (error) throw error; return dbToPiece(data);
}

export async function updatePiece(id: string, piece: Partial<PieceConfig>): Promise<PieceConfig> {
  const updates: any = {};
  const map: Record<string, string> = { matiere: 'matiere', epaisseur: 'epaisseur', finition: 'finition', formeBase: 'forme_base',
    largeur: 'largeur', hauteur: 'hauteur', brancheL: 'branche_l', profondeurU: 'profondeur_u', decalageZ: 'decalage_z',
    plis: 'plis', trous: 'trous', encoches: 'encoches', chanfreins: 'chanfreins', marquages: 'marquages', annotations: 'annotations',
    nom: 'nom', reference: 'reference', quantite: 'quantite', remarques: 'remarques', travaux_id: 'travaux_id',
    statut: 'statut', statut_historique: 'statut_historique' };
  Object.entries(map).forEach(([k, col]) => { if ((piece as any)[k] !== undefined) updates[col] = (piece as any)[k]; });
  const { data, error } = await supabase.from('tolerie_pieces').update(updates).eq('id', id).select().single();
  if (error) throw error; return dbToPiece(data);
}

export async function deletePiece(id: string): Promise<void> {
  const { error } = await supabase.from('tolerie_pieces').delete().eq('id', id); if (error) throw error;
}

export async function changerStatut(id: string, statut: StatutFabrication): Promise<PieceConfig> {
  const cur = await getPieceById(id);
  const hist = [...(cur.statut_historique || []), { statut, date: new Date().toISOString() }];
  return updatePiece(id, { statut, statut_historique: hist });
}

export async function creerCommandeDepuisPiece(piece: PieceConfig): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const code = `CMD-TOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const { data: cmd, error: e1 } = await supabase.from('commandes').insert({ code, technicien_id: user?.id, fournisseur: '', statut: 'brouillon', priorite: 'normale',
    notes: `Pièce tôlerie: ${piece.reference} — ${piece.nom}\n${piece.matiere} ép.${piece.epaisseur}mm ${piece.largeur}×${piece.hauteur}mm ×${piece.quantite}` }).select().single();
  if (e1) throw e1;
  await supabase.from('commande_lignes').insert({ commande_id: cmd.id, designation: `${piece.nom} — ${piece.matiere} ép.${piece.epaisseur}mm`, reference: piece.reference, quantite: piece.quantite, quantite_recue: 0, detail: `${piece.plis.length}P ${piece.trous.length}T` });
  return cmd.id;
}

export async function getPiecesMultiple(ids: string[]): Promise<PieceConfig[]> {
  const { data, error } = await supabase.from('tolerie_pieces').select('*').in('id', ids);
  if (error) throw error; return (data || []).map(dbToPiece);
}

export async function getTravauxListe(): Promise<{ id: string; code: string; titre: string }[]> {
  const { data, error } = await supabase.from('travaux').select('id, code, titre').order('created_at', { ascending: false }).limit(50);
  if (error) throw error; return data || [];
}

// Feature 34: Realtime
export function subscribeToPiece(pieceId: string, onUpdate: (p: PieceConfig) => void) {
  const ch = supabase.channel(`tolerie-${pieceId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tolerie_pieces', filter: `id=eq.${pieceId}` },
      (payload) => onUpdate(dbToPiece(payload.new))).subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeCursors(pieceId: string, onCursor: (d: { userId: string; x: number; y: number }) => void) {
  const ch = supabase.channel(`tolerie-collab-${pieceId}`)
    .on('broadcast', { event: 'cursor' }, ({ payload }) => onCursor(payload)).subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function broadcastCursor(pieceId: string, userId: string, x: number, y: number) {
  supabase.channel(`tolerie-collab-${pieceId}`).send({ type: 'broadcast', event: 'cursor', payload: { userId, x, y, ts: Date.now() } });
}
