// ═══════════════════════════════════════════════════════════════
// PDF BUILDER — Core brandé AuvergneTech
// ═══════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Design tokens
export const PDF_COLORS = {
  accent: [185, 28, 28] as [number, number, number],
  accentDark: [153, 27, 27] as [number, number, number],
  text: [30, 27, 46] as [number, number, number],
  secondary: [88, 82, 112] as [number, number, number],
  muted: [148, 144, 168] as [number, number, number],
  border: [228, 223, 240] as [number, number, number],
  bg: [248, 246, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [5, 150, 105] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  error: [234, 88, 12] as [number, number, number],
};

const MX = 20; // margin X

// Helpers
export function fmtDate(date?: string | Date | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? new Date(date) : date, fmt, { locale: fr });
  } catch { return '—'; }
}

export function fmtDateTime(date?: string | Date | null): string {
  return fmtDate(date, 'dd/MM/yyyy HH:mm');
}

export function safe(val: any): string {
  if (val === null || val === undefined) return '—';
  return String(val);
}

export function trunc(str: string | null | undefined, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '…' : str;
}

// ═══ PDF BUILDER CLASS ═══

export class PDFBuilder {
  doc: jsPDF;
  y: number;
  pw: number; // page width
  cw: number; // content width
  pn: number; // page number
  title: string;
  sub: string;

  constructor(title: string, subtitle = '', orient: 'portrait' | 'landscape' = 'portrait') {
    this.doc = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
    this.pw = orient === 'portrait' ? 210 : 297;
    this.cw = this.pw - MX * 2;
    this.y = 20;
    this.pn = 1;
    this.title = title;
    this.sub = subtitle;
    this._header();
  }

  // ─── En-tête brandée ───
  _header() {
    const d = this.doc;
    // Bande rouge top
    d.setFillColor(...PDF_COLORS.accent);
    d.rect(0, 0, this.pw, 2.5, 'F');
    // Logo
    d.setFillColor(...PDF_COLORS.accent);
    d.roundedRect(MX, 7, 14, 14, 2.5, 2.5, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    d.setTextColor(...PDF_COLORS.white);
    d.text('AT', MX + 7, 16, { align: 'center' });
    // Company name
    d.setTextColor(...PDF_COLORS.text);
    d.setFontSize(11);
    d.text('AuvergneTech', MX + 18, 13);
    d.setFontSize(6);
    d.setTextColor(...PDF_COLORS.muted);
    d.setFont('helvetica', 'normal');
    d.text('ASCENSEURS', MX + 18, 18);
    // Date export
    d.setFontSize(7);
    d.setTextColor(...PDF_COLORS.secondary);
    d.text(`Export : ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, this.pw - MX, 13, { align: 'right' });
    // Separator
    d.setDrawColor(...PDF_COLORS.border);
    d.setLineWidth(0.25);
    d.line(MX, 25, this.pw - MX, 25);
    this.y = 31;
  }

  // ─── Pied de page ───
  _footer() {
    const d = this.doc;
    const fy = 288;
    d.setDrawColor(...PDF_COLORS.border);
    d.setLineWidth(0.15);
    d.line(MX, fy - 3, this.pw - MX, fy - 3);
    d.setFontSize(6.5);
    d.setTextColor(...PDF_COLORS.muted);
    d.text(`${this.title}${this.sub ? ' — ' + this.sub : ''}`, MX, fy);
    d.text(`Page ${this.pn}`, this.pw - MX, fy, { align: 'right' });
    d.setFillColor(...PDF_COLORS.accent);
    d.rect(0, 294.5, this.pw, 2.5, 'F');
  }

  // ─── Nouvelle page ───
  newPage() {
    this._footer();
    this.doc.addPage();
    this.pn++;
    this._header();
  }

  // ─── Vérifier espace restant ───
  ensure(needed: number) {
    if (this.y + needed > 272) this.newPage();
  }

  // ─── Titre principal ───
  docTitle(text: string, badge?: string) {
    const d = this.doc;
    d.setFont('helvetica', 'bold');
    d.setFontSize(17);
    d.setTextColor(...PDF_COLORS.text);
    d.text(text, MX, this.y);
    if (badge) {
      const tw = d.getTextWidth(text);
      const bw = d.getStringUnitWidth(badge) * 7 / d.internal.scaleFactor + 6;
      d.setFillColor(...PDF_COLORS.accent);
      d.roundedRect(MX + tw + 4, this.y - 5, bw, 7, 1.5, 1.5, 'F');
      d.setFontSize(7);
      d.setTextColor(...PDF_COLORS.white);
      d.text(badge, MX + tw + 4 + bw / 2, this.y - 0.5, { align: 'center' });
    }
    this.y += 3;
  }

  // ─── Sous-titre ───
  docSubtitle(text: string) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...PDF_COLORS.secondary);
    this.doc.text(text, MX, this.y);
    this.y += 7;
  }

  // ─── Section title avec barre accent ───
  section(text: string) {
    this.ensure(14);
    this.y += 3;
    const d = this.doc;
    d.setFillColor(...PDF_COLORS.accent);
    d.rect(MX, this.y - 3.5, 2, 5, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(10);
    d.setTextColor(...PDF_COLORS.text);
    d.text(text, MX + 5, this.y);
    this.y += 3;
    d.setDrawColor(...PDF_COLORS.border);
    d.setLineWidth(0.12);
    d.line(MX, this.y, this.pw - MX, this.y);
    this.y += 3;
  }

  // ─── Bloc info key → value (multi-colonnes) ───
  info(data: [string, string][], cols = 2) {
    const colW = this.cw / cols;
    let col = 0;
    const d = this.doc;

    data.forEach(([label, value]) => {
      if (col >= cols) { col = 0; this.y += 7; }
      this.ensure(9);
      const x = MX + col * colW;
      d.setFont('helvetica', 'normal');
      d.setFontSize(7.5);
      d.setTextColor(...PDF_COLORS.muted);
      d.text(label, x, this.y);
      d.setFont('helvetica', 'bold');
      d.setFontSize(9);
      d.setTextColor(...PDF_COLORS.text);
      d.text(trunc(safe(value), 45), x, this.y + 4);
      col++;
    });
    this.y += 11;
  }

  // ─── Tableau ───
  table(headers: string[], rows: string[][], opts?: any) {
    this.ensure(18);
    autoTable(this.doc, {
      startY: this.y,
      head: [headers],
      body: rows,
      margin: { left: MX, right: MX },
      styles: {
        fontSize: 8, cellPadding: 2.5, lineColor: PDF_COLORS.border,
        lineWidth: 0.12, textColor: PDF_COLORS.text, font: 'helvetica',
      },
      headStyles: {
        fillColor: PDF_COLORS.accent, textColor: PDF_COLORS.white,
        fontStyle: 'bold', fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: PDF_COLORS.bg },
      ...opts,
    });
    this.y = (this.doc as any).lastAutoTable.finalY + 5;
  }

  // ─── KPI cards en ligne ───
  kpiRow(kpis: { label: string; value: string; color?: [number, number, number] }[]) {
    this.ensure(22);
    const gap = 3;
    const w = (this.cw - gap * (kpis.length - 1)) / kpis.length;
    const d = this.doc;

    kpis.forEach((kpi, i) => {
      const x = MX + i * (w + gap);
      const color = kpi.color || PDF_COLORS.accent;
      // Card bg
      d.setFillColor(...PDF_COLORS.bg);
      d.roundedRect(x, this.y, w, 17, 2, 2, 'F');
      // Left accent bar
      d.setFillColor(...color);
      d.roundedRect(x, this.y, 2, 17, 1, 1, 'F');
      // Value
      d.setFont('helvetica', 'bold');
      d.setFontSize(13);
      d.setTextColor(...color);
      d.text(kpi.value, x + 6, this.y + 7);
      // Label
      d.setFont('helvetica', 'normal');
      d.setFontSize(7);
      d.setTextColor(...PDF_COLORS.secondary);
      d.text(trunc(kpi.label, 25), x + 6, this.y + 13);
    });
    this.y += 22;
  }

  // ─── Texte libre ───
  text(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
    this.ensure(8);
    const d = this.doc;
    d.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    d.setFontSize(opts?.size || 9);
    d.setTextColor(...(opts?.color || PDF_COLORS.text));
    const lines = d.splitTextToSize(text, this.cw);
    d.text(lines, MX, this.y);
    this.y += lines.length * (opts?.size || 9) * 0.45 + 3;
  }

  // ─── Séparateur léger ───
  separator() {
    this.y += 2;
    this.doc.setDrawColor(...PDF_COLORS.border);
    this.doc.setLineWidth(0.1);
    this.doc.line(MX, this.y, this.pw - MX, this.y);
    this.y += 4;
  }

  // ─── Checklist items ───
  checklist(items: { label: string; checked: boolean; detail?: string }[]) {
    this.ensure(items.length * 6 + 4);
    const d = this.doc;
    items.forEach(item => {
      this.ensure(7);
      // Checkbox
      d.setDrawColor(...PDF_COLORS.border);
      d.setLineWidth(0.3);
      d.rect(MX + 2, this.y - 2.5, 3, 3);
      if (item.checked) {
        d.setFillColor(...PDF_COLORS.success);
        d.rect(MX + 2.5, this.y - 2, 2, 2, 'F');
      }
      // Label
      d.setFont('helvetica', item.checked ? 'bold' : 'normal');
      d.setFontSize(8.5);
      d.setTextColor(...(item.checked ? PDF_COLORS.text : PDF_COLORS.secondary));
      d.text(item.label, MX + 8, this.y);
      // Detail
      if (item.detail) {
        d.setFont('helvetica', 'normal');
        d.setFontSize(7);
        d.setTextColor(...PDF_COLORS.muted);
        d.text(item.detail, MX + 8, this.y + 3.5);
        this.y += 4;
      }
      this.y += 5;
    });
  }

  // ─── Bloc note / remarque ───
  noteBox(text: string, type: 'info' | 'warning' | 'error' = 'info') {
    this.ensure(15);
    const d = this.doc;
    const color = type === 'error' ? PDF_COLORS.error : type === 'warning' ? PDF_COLORS.warning : PDF_COLORS.accent;
    const lines = d.splitTextToSize(text, this.cw - 10);
    const h = lines.length * 4 + 6;
    d.setFillColor(...PDF_COLORS.bg);
    d.roundedRect(MX, this.y, this.cw, h, 1.5, 1.5, 'F');
    d.setFillColor(...color);
    d.roundedRect(MX, this.y, 2, h, 0.5, 0.5, 'F');
    d.setFont('helvetica', 'normal');
    d.setFontSize(8);
    d.setTextColor(...PDF_COLORS.text);
    d.text(lines, MX + 6, this.y + 5);
    this.y += h + 3;
  }

  // ─── Signature block ───
  signatureBlock(parties: string[]) {
    this.ensure(35);
    const d = this.doc;
    const colW = this.cw / parties.length;

    this.y += 5;
    parties.forEach((party, i) => {
      const x = MX + i * colW;
      d.setFont('helvetica', 'bold');
      d.setFontSize(8);
      d.setTextColor(...PDF_COLORS.text);
      d.text(party, x + 5, this.y);
      d.setFont('helvetica', 'normal');
      d.setFontSize(7);
      d.setTextColor(...PDF_COLORS.muted);
      d.text('Date :', x + 5, this.y + 6);
      d.text('Signature :', x + 5, this.y + 11);
      // Zone signature
      d.setDrawColor(...PDF_COLORS.border);
      d.setLineWidth(0.2);
      d.rect(x + 5, this.y + 14, colW - 15, 15);
    });
    this.y += 35;
  }

  // ─── Finaliser et sauvegarder ───
  save(filename: string) {
    this._footer();
    // Ajouter footer à toutes les pages
    const totalPages = this.pn;
    for (let i = 1; i < totalPages; i++) {
      this.doc.setPage(i);
      // Footer already drawn during newPage()
    }
    this.doc.save(filename);
  }

  // ─── Retourner le blob ───
  blob(): Blob {
    this._footer();
    return this.doc.output('blob');
  }
}
