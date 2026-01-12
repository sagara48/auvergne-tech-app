/**
 * Service Export et Partage des Notes
 * PDF, Email, Partage collègues, QR Code
 */

import { supabase } from './supabase';
import { jsPDF } from 'jspdf';
import type { Note } from '@/types';

// =============================================
// TYPES
// =============================================

export interface NotePartage {
  id: string;
  note_id: string;
  technicien_id: string;
  permission: 'lecture' | 'edition';
  created_at: string;
  technicien?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    avatar_initiales: string;
  };
}

export interface NoteLiaison {
  id: string;
  note_source_id: string;
  note_cible_id: string;
  type_liaison: 'reference' | 'suite' | 'associee';
  created_at: string;
  note_cible?: {
    id: string;
    titre: string;
    couleur: string;
    categorie: string;
  };
}

export interface NoteRappel {
  id: string;
  note_id: string;
  type: 'echeance' | 'rappel_avant';
  delai_minutes?: number; // Pour rappel_avant: 60, 1440 (1j), 10080 (1sem)
  date_rappel: string;
  envoye: boolean;
  created_at: string;
}

// =============================================
// EXPORT PDF
// =============================================

export async function exportNoteToPDF(note: Note): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Couleur de la note (bande en haut)
  const color = hexToRgb(note.couleur || '#6366f1');
  doc.setFillColor(color.r, color.g, color.b);
  doc.rect(0, 0, pageWidth, 10, 'F');

  // Logo/Titre
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('AuvergneTech - Note', margin, yPos + 20);
  yPos += 30;

  // Titre de la note
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text(note.titre || 'Sans titre', margin, yPos);
  yPos += 15;

  // Métadonnées
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  
  const metadatas = [
    `Catégorie: ${note.categorie}`,
    `Priorité: ${note.priorite}`,
    `Statut: ${note.statut}`,
  ];
  
  if (note.ascenseur) {
    metadatas.push(`Ascenseur: ${note.ascenseur.code}`);
  }
  
  if (note.echeance_date) {
    metadatas.push(`Échéance: ${new Date(note.echeance_date).toLocaleDateString('fr-FR')}`);
  }

  doc.text(metadatas.join(' | '), margin, yPos);
  yPos += 15;

  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Contenu
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  
  if (note.contenu) {
    const lines = doc.splitTextToSize(note.contenu, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 6 + 10;
  }

  // Checklist
  if (note.checklist && note.checklist.length > 0) {
    yPos += 5;
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text('Checklist:', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    note.checklist.forEach((item: any) => {
      const checkbox = item.fait ? '☑' : '☐';
      doc.setTextColor(item.fait ? 100 : 50, item.fait ? 100 : 50, item.fait ? 100 : 50);
      doc.text(`${checkbox} ${item.texte}`, margin + 5, yPos);
      yPos += 6;
    });
  }

  // Tags
  if (note.tags && note.tags.length > 0) {
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 200);
    doc.text(`Tags: ${note.tags.map((t: string) => `#${t}`).join(' ')}`, margin, yPos);
  }

  // Pied de page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
    margin,
    pageHeight - 10
  );

  return doc.output('blob');
}

/**
 * Télécharger la note en PDF
 */
export async function downloadNotePDF(note: Note): Promise<void> {
  const blob = await exportNoteToPDF(note);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `note-${note.titre?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'sans-titre'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================
// PARTAGE EMAIL
// =============================================

export function shareNoteByEmail(note: Note, destinataires?: string[]): void {
  const subject = encodeURIComponent(`Note: ${note.titre}`);
  
  let body = `${note.titre}\n`;
  body += `${'='.repeat(note.titre?.length || 10)}\n\n`;
  body += `${note.contenu || ''}\n\n`;
  
  if (note.checklist && note.checklist.length > 0) {
    body += `Checklist:\n`;
    note.checklist.forEach((item: any) => {
      body += `${item.fait ? '✓' : '○'} ${item.texte}\n`;
    });
    body += '\n';
  }
  
  if (note.tags && note.tags.length > 0) {
    body += `Tags: ${note.tags.map((t: string) => `#${t}`).join(' ')}\n`;
  }
  
  body += `\n---\nEnvoyé depuis AuvergneTech`;
  
  const mailto = destinataires?.length 
    ? `mailto:${destinataires.join(',')}?subject=${subject}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  
  window.open(mailto);
}

// =============================================
// QR CODE
// =============================================

export function generateNoteQRCode(noteId: string): string {
  // URL de la note (à adapter selon l'environnement)
  const baseUrl = window.location.origin;
  const noteUrl = `${baseUrl}/notes/${noteId}`;
  
  // Générer un QR code via API publique (ou librairie locale)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(noteUrl)}`;
}

// =============================================
// PARTAGE AVEC COLLEGUES
// =============================================

export async function getNotesPartages(noteId: string): Promise<NotePartage[]> {
  const { data, error } = await supabase
    .from('notes_partages')
    .select(`
      *,
      technicien:techniciens(id, nom, prenom, email, avatar_initiales)
    `)
    .eq('note_id', noteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function partagerNote(
  noteId: string, 
  technicienId: string, 
  permission: 'lecture' | 'edition'
): Promise<NotePartage> {
  const { data, error } = await supabase
    .from('notes_partages')
    .upsert({
      note_id: noteId,
      technicien_id: technicienId,
      permission
    }, { onConflict: 'note_id,technicien_id' })
    .select(`
      *,
      technicien:techniciens(id, nom, prenom, email, avatar_initiales)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function supprimerPartage(partageId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_partages')
    .delete()
    .eq('id', partageId);

  if (error) throw error;
}

// =============================================
// LIAISONS ENTRE NOTES
// =============================================

export async function getNotesLiees(noteId: string): Promise<NoteLiaison[]> {
  const { data, error } = await supabase
    .from('notes_liaisons')
    .select(`
      *,
      note_cible:notes!notes_liaisons_note_cible_id_fkey(id, titre, couleur, categorie)
    `)
    .eq('note_source_id', noteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function lierNotes(
  noteSourceId: string, 
  noteCibleId: string, 
  typeLiaison: 'reference' | 'suite' | 'associee' = 'reference'
): Promise<NoteLiaison> {
  const { data, error } = await supabase
    .from('notes_liaisons')
    .insert({
      note_source_id: noteSourceId,
      note_cible_id: noteCibleId,
      type_liaison: typeLiaison
    })
    .select(`
      *,
      note_cible:notes!notes_liaisons_note_cible_id_fkey(id, titre, couleur, categorie)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function supprimerLiaison(liaisonId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_liaisons')
    .delete()
    .eq('id', liaisonId);

  if (error) throw error;
}

// =============================================
// RAPPELS ET ÉCHEANCES
// =============================================

export async function getNoteRappels(noteId: string): Promise<NoteRappel[]> {
  const { data, error } = await supabase
    .from('notes_rappels')
    .select('*')
    .eq('note_id', noteId)
    .order('date_rappel', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function creerRappel(
  noteId: string,
  type: 'echeance' | 'rappel_avant',
  dateRappel: string,
  delaiMinutes?: number
): Promise<NoteRappel> {
  const { data, error } = await supabase
    .from('notes_rappels')
    .insert({
      note_id: noteId,
      type,
      date_rappel: dateRappel,
      delai_minutes: delaiMinutes,
      envoye: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function supprimerRappel(rappelId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_rappels')
    .delete()
    .eq('id', rappelId);

  if (error) throw error;
}

export async function getRappelsDus(): Promise<Array<NoteRappel & { note: Note }>> {
  const { data, error } = await supabase
    .from('notes_rappels')
    .select(`
      *,
      note:notes(*)
    `)
    .eq('envoye', false)
    .lte('date_rappel', new Date().toISOString())
    .order('date_rappel', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function marquerRappelEnvoye(rappelId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_rappels')
    .update({ envoye: true })
    .eq('id', rappelId);

  if (error) throw error;
}

// =============================================
// UTILITAIRES
// =============================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 99, g: 102, b: 241 };
}

/**
 * Calculer le statut d'échéance
 */
export function getEcheanceStatus(echeanceDate: string | null): {
  status: 'none' | 'ok' | 'proche' | 'urgent' | 'depasse';
  label: string;
  color: string;
} {
  if (!echeanceDate) {
    return { status: 'none', label: '', color: '' };
  }

  const now = new Date();
  const echeance = new Date(echeanceDate);
  const diffMs = echeance.getTime() - now.getTime();
  const diffJours = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return { status: 'depasse', label: 'Échéance dépassée', color: '#ef4444' };
  } else if (diffJours <= 1) {
    return { status: 'urgent', label: 'Échéance aujourd\'hui', color: '#f97316' };
  } else if (diffJours <= 3) {
    return { status: 'proche', label: 'Échéance proche', color: '#f59e0b' };
  } else if (diffJours <= 7) {
    return { status: 'ok', label: 'Cette semaine', color: '#22c55e' };
  } else {
    return { status: 'ok', label: '', color: '#22c55e' };
  }
}
