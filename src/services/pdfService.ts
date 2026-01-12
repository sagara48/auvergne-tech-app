import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Étendre jsPDF pour autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface RapportMensuelData {
  mois: string;
  totalAscenseurs: number;
  tauxDisponibilite: number;
  pannes30j: number;
  arretsEnCours: number;
  pannesParSecteur: Record<string, number>;
  top10Pannes: Array<{ code: string; adresse: string; ville: string; count: number; secteur: number }>;
  arretsLongs: Array<{ code: string; ville: string; heures: number }>;
  pannesBloquees: Array<{ code: string; ville: string; personnes: number; date: string }>;
}

interface RapportAscenseurData {
  ascenseur: any;
  pannes: any[];
  visites: any[];
  controles: any[];
}

// Couleurs du thème
const COLORS = {
  primary: [249, 115, 22],    // Orange
  secondary: [59, 130, 246],  // Bleu
  success: [34, 197, 94],     // Vert
  danger: [239, 68, 68],      // Rouge
  warning: [245, 158, 11],    // Jaune
  purple: [168, 85, 247],     // Violet
  dark: [30, 30, 30],         // Fond sombre
  gray: [107, 114, 128],      // Gris
};

/**
 * Génère un rapport mensuel PDF
 */
export function generateRapportMensuel(data: RapportMensuelData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 20;

  // Header avec logo et titre
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RAPPORT MENSUEL', 15, 18);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Parc Ascenseurs - ${data.mois}`, 15, 28);
  
  doc.setFontSize(10);
  doc.text(`Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, pageWidth - 15, 28, { align: 'right' });

  y = 50;

  // Section KPIs
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INDICATEURS CLÉS', 15, y);
  y += 10;

  // Boxes KPIs
  const kpiWidth = 42;
  const kpiHeight = 25;
  const kpis = [
    { label: 'Ascenseurs', value: data.totalAscenseurs.toString(), color: COLORS.secondary },
    { label: 'Disponibilité', value: `${data.tauxDisponibilite}%`, color: COLORS.success },
    { label: 'Pannes (30j)', value: data.pannes30j.toString(), color: COLORS.warning },
    { label: 'En arrêt', value: data.arretsEnCours.toString(), color: COLORS.danger },
  ];

  kpis.forEach((kpi, index) => {
    const x = 15 + index * (kpiWidth + 5);
    doc.setFillColor(...kpi.color);
    doc.roundedRect(x, y, kpiWidth, kpiHeight, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + kpiWidth / 2, y + 12, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + kpiWidth / 2, y + 20, { align: 'center' });
  });

  y += kpiHeight + 15;

  // Section Alertes si présentes
  if (data.arretsLongs.length > 0 || data.pannesBloquees.length > 0) {
    doc.setTextColor(...COLORS.danger);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ ALERTES', 15, y);
    y += 8;

    if (data.arretsLongs.length > 0) {
      doc.setTextColor(...COLORS.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Arrêts prolongés (>${24}h):`, 15, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      data.arretsLongs.slice(0, 5).forEach(arret => {
        doc.text(`• ${arret.code} - ${arret.ville} (${Math.floor(arret.heures / 24)}j ${arret.heures % 24}h)`, 20, y);
        y += 5;
      });
      y += 5;
    }

    if (data.pannesBloquees.length > 0) {
      doc.setTextColor(...COLORS.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Pannes avec personnes bloquées:', 15, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      data.pannesBloquees.slice(0, 5).forEach(panne => {
        doc.text(`• ${panne.code} - ${panne.ville} (${panne.personnes} pers.) - ${panne.date}`, 20, y);
        y += 5;
      });
      y += 5;
    }
  }

  // Section Pannes par secteur
  if (Object.keys(data.pannesParSecteur).length > 0) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉPARTITION PAR SECTEUR', 15, y);
    y += 8;

    const secteurData = Object.entries(data.pannesParSecteur)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    doc.autoTable({
      startY: y,
      head: [['Secteur', 'Pannes']],
      body: secteurData.map(([secteur, count]) => [`Secteur ${secteur}`, count]),
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.primary,
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: 'center' }
      },
      margin: { left: 15, right: 15 }
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  }

  // Vérifier si on a besoin d'une nouvelle page
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  // Section Top 10 ascenseurs en panne
  if (data.top10Pannes.length > 0) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOP 10 - ASCENSEURS LES PLUS EN PANNE', 15, y);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [['#', 'Code', 'Adresse', 'Ville', 'Secteur', 'Pannes']],
      body: data.top10Pannes.map((asc, index) => [
        index + 1,
        asc.code,
        asc.adresse?.substring(0, 30) || '',
        asc.ville || '',
        asc.secteur,
        asc.count
      ]),
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.danger,
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { cellWidth: 35 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: 15, right: 15 }
    });
  }

  // Pied de page
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(
      `Page ${i} / ${pageCount} - Auvergne Ascenseurs - Rapport généré automatiquement`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Télécharger le PDF
  const fileName = `rapport-mensuel-${format(new Date(), 'yyyy-MM')}.pdf`;
  doc.save(fileName);
}

/**
 * Génère un rapport détaillé pour un ascenseur
 */
export function generateRapportAscenseur(data: RapportAscenseurData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const { ascenseur, pannes, visites, controles } = data;
  let y = 20;

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE ASCENSEUR', 15, 18);
  
  doc.setFontSize(14);
  doc.text(ascenseur.code_appareil || 'N/A', 15, 30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 15, 35, { align: 'right' });

  y = 55;

  // Informations générales
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS GÉNÉRALES', 15, y);
  y += 8;

  const infos = [
    ['Adresse', ascenseur.adresse || 'N/A'],
    ['Ville', `${ascenseur.ville || ''} ${ascenseur.code_postal || ''}`],
    ['Secteur', ascenseur.secteur?.toString() || 'N/A'],
    ['Type', ascenseur.type_appareil || 'N/A'],
    ['Marque', ascenseur.marque || 'N/A'],
    ['Modèle', ascenseur.modele || 'N/A'],
    ['N° Série', ascenseur.num_serie || 'N/A'],
    ['Type planning', ascenseur.type_planning || 'Hors contrat'],
    ['Visites/an', ascenseur.nb_visites_an?.toString() || '0'],
  ];

  doc.autoTable({
    startY: y,
    body: infos,
    theme: 'plain',
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', textColor: COLORS.gray },
      1: { cellWidth: 100 }
    },
    margin: { left: 15, right: 15 }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Statistiques
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('STATISTIQUES', 15, y);
  y += 8;

  const stats = [
    { label: 'Total pannes', value: pannes.length, color: COLORS.danger },
    { label: 'Total visites', value: visites.length, color: COLORS.secondary },
    { label: 'Total contrôles', value: controles.length, color: COLORS.purple },
  ];

  stats.forEach((stat, index) => {
    const x = 15 + index * 55;
    doc.setFillColor(...stat.color);
    doc.roundedRect(x, y, 50, 20, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value.toString(), x + 25, y + 10, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, x + 25, y + 16, { align: 'center' });
  });

  y += 35;

  // Historique des pannes (dernières 20)
  if (pannes.length > 0) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTORIQUE DES PANNES', 15, y);
    y += 8;

    const pannesData = pannes.slice(0, 20).map(p => {
      const data = p.data_wpanne || {};
      let dateStr = 'N/A';
      if (data.DATE) {
        const ds = String(data.DATE);
        if (ds.length === 8) {
          dateStr = `${ds.substring(6, 8)}/${ds.substring(4, 6)}/${ds.substring(0, 4)}`;
        }
      }
      return [
        dateStr,
        data.Libelle?.substring(0, 40) || data.PANNES?.substring(0, 40) || 'N/A',
        data.DEPANNEUR || 'N/A'
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['Date', 'Description', 'Technicien']],
      body: pannesData,
      theme: 'striped',
      headStyles: { 
        fillColor: COLORS.danger,
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 100 },
        2: { cellWidth: 40 }
      },
      margin: { left: 15, right: 15 }
    });
  }

  // Pied de page
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(
      `Page ${i} / ${pageCount} - ${ascenseur.code_appareil} - Auvergne Ascenseurs`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Télécharger le PDF
  const fileName = `fiche-${ascenseur.code_appareil || 'ascenseur'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
