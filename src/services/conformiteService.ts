// ═══════════════════════════════════════════════════════════════
// SERVICE CONFORMITÉ — Scoring, Alertes, Documents obligatoires
// Synergies GED × Parc Ascenseurs × Contrôle Technique
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ═══ TYPES ═══

export interface DocObligatoire {
  code: string;
  label: string;
  categorie: 'reglementaire' | 'technique' | 'administratif';
  expirable: boolean;
  periodiciteJours?: number; // 365 = annuel
}

export interface DocStatus {
  doc: DocObligatoire;
  present: boolean;
  expire: boolean;
  expireBientot: boolean;
  joursRestants: number | null;
  documentId?: string;
  dateExpiration?: string;
}

export interface ReserveBcInfo {
  id: string;
  description: string;
  bureau: string;
  reportDate: string;
  reportNumber: string;
  isResolved: boolean;
  resolvedAt: string | null;
  joursOuvert: number;
}

export interface ConformiteScore {
  score: number; // 0-100
  label: 'conforme' | 'a_surveiller' | 'non_conforme';
  color: string;
  details: {
    docsScore: number;
    reservesScore: number;
    controleScore: number;
  };
  docsStatus: DocStatus[];
  reservesOuvertes: ReserveBcInfo[];
  dernierControle: string | null;
  prochainBcExpire: string | null;
}

export interface AlerteConformite {
  id: string;
  type: 'doc_expire' | 'doc_expire_bientot' | 'doc_manquant' | 'reserve_ouverte' | 'controle_ancien';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  ascenseurCode: string;
  ascenseurSite: string;
  ascenseurId: string;
  date: string;
}

// ═══ DOCUMENTS OBLIGATOIRES ═══

export const DOCS_OBLIGATOIRES: DocObligatoire[] = [
  { code: 'rapport_bc', label: 'Rapport Bureau de Contrôle', categorie: 'reglementaire', expirable: true, periodiciteJours: 365 },
  { code: 'contrat_maintenance', label: 'Contrat de maintenance', categorie: 'administratif', expirable: true, periodiciteJours: 365 },
  { code: 'attestation_ce', label: 'Attestation CE / conformité', categorie: 'reglementaire', expirable: false },
  { code: 'schema_electrique', label: 'Schéma électrique', categorie: 'technique', expirable: false },
  { code: 'carnet_entretien', label: 'Carnet d\'entretien', categorie: 'reglementaire', expirable: false },
];

// Mots-clés pour matcher documents ↔ type obligatoire
const DOC_KEYWORDS: Record<string, string[]> = {
  rapport_bc: ['rapport bc', 'bureau contrôle', 'bureau de contrôle', 'socotec', 'apave', 'veritas', 'dekra', 'qualiconsult', 'cep', 'contrôle réglementaire'],
  contrat_maintenance: ['contrat', 'maintenance', 'entretien annuel'],
  attestation_ce: ['attestation ce', 'conformité', 'déclaration ce', 'marquage ce'],
  schema_electrique: ['schéma', 'schema', 'électrique', 'electrique', 'câblage', 'armoire'],
  carnet_entretien: ['carnet', 'entretien', 'registre', 'maintenance'],
};

// ═══ FONCTIONS UTILITAIRES ═══

function matchDocType(nomDoc: string, descDoc: string | null): string | null {
  const text = `${nomDoc} ${descDoc || ''}`.toLowerCase();
  for (const [code, keywords] of Object.entries(DOC_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return code;
  }
  return null;
}

function joursEntre(date1: string, date2: string): number {
  return Math.floor((new Date(date2).getTime() - new Date(date1).getTime()) / (1000 * 60 * 60 * 24));
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

// ═══ SCORING ═══

export function calculerScoreConformite(
  docsStatus: DocStatus[],
  reservesOuvertes: ReserveBcInfo[],
  dernierControleDate: string | null,
): { score: number; docsScore: number; reservesScore: number; controleScore: number } {
  // Documents : 50% du score
  const docsObligatoires = docsStatus.length;
  const docsPresentsValides = docsStatus.filter(d => d.present && !d.expire).length;
  const docsScore = docsObligatoires > 0 ? (docsPresentsValides / docsObligatoires) * 100 : 100;

  // Réserves BC : 30% du score
  const reservesScore = reservesOuvertes.length === 0 ? 100 : Math.max(0, 100 - reservesOuvertes.length * 25);

  // Dernier contrôle : 20% du score
  let controleScore = 100;
  if (dernierControleDate) {
    const joursDepuis = joursEntre(dernierControleDate, aujourdhui());
    if (joursDepuis > 365) controleScore = 0;
    else if (joursDepuis > 270) controleScore = 40;
    else if (joursDepuis > 180) controleScore = 70;
  } else {
    controleScore = 30; // Pas de contrôle enregistré
  }

  const score = Math.round(docsScore * 0.50 + reservesScore * 0.30 + controleScore * 0.20);
  return { score, docsScore: Math.round(docsScore), reservesScore: Math.round(reservesScore), controleScore: Math.round(controleScore) };
}

export function scoreLabel(score: number): 'conforme' | 'a_surveiller' | 'non_conforme' {
  if (score >= 85) return 'conforme';
  if (score >= 60) return 'a_surveiller';
  return 'non_conforme';
}

export function scoreColor(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

export function scoreLabelFr(score: number): string {
  if (score >= 85) return 'Conforme';
  if (score >= 60) return 'À surveiller';
  return 'Non conforme';
}

// ═══ REQUÊTES BD ═══

export async function getReservesBcAscenseur(ascenseurId: string): Promise<ReserveBcInfo[]> {
  try {
    const { data: reports } = await supabase
      .from('mes_control_reports')
      .select('*, mes_bc_reserve_items(*)')
      .eq('device_id', ascenseurId);

    if (!reports) return [];

    const reserves: ReserveBcInfo[] = [];
    for (const report of reports) {
      for (const item of (report.mes_bc_reserve_items || [])) {
        const reportDate = report.report_date || report.created_at?.slice(0, 10) || '';
        reserves.push({
          id: item.id,
          description: item.description,
          bureau: report.control_office || '',
          reportDate,
          reportNumber: report.report_number || '',
          isResolved: item.is_resolved || false,
          resolvedAt: item.resolved_at,
          joursOuvert: item.is_resolved ? 0 : joursEntre(reportDate, aujourdhui()),
        });
      }
    }
    return reserves;
  } catch {
    return [];
  }
}

export async function getDocumentsGedAscenseur(ascenseurId: string): Promise<any[]> {
  try {
    // Essayer la vue GED d'abord
    const { data, error } = await supabase
      .from('v_documents_ascenseur')
      .select('*')
      .eq('ascenseur_id', ascenseurId)
      .order('created_at', { ascending: false });
    
    if (!error && data) return data;
    
    // Fallback: table documents simple
    const { data: docs2 } = await supabase
      .from('documents')
      .select('*')
      .eq('ascenseur_id', ascenseurId)
      .order('created_at', { ascending: false });
    
    return docs2 || [];
  } catch {
    return [];
  }
}

export function evaluerDocsObligatoires(documents: any[]): DocStatus[] {
  const today = aujourdhui();
  return DOCS_OBLIGATOIRES.map(doc => {
    // Chercher un document correspondant
    const match = documents.find(d => {
      const matched = matchDocType(d.nom || d.fichier_nom || '', d.description || d.type_libelle || '');
      return matched === doc.code;
    });

    if (!match) {
      return { doc, present: false, expire: false, expireBientot: false, joursRestants: null };
    }

    const dateExp = match.date_expiration;
    let expire = false;
    let expireBientot = false;
    let joursRestants: number | null = null;

    if (dateExp) {
      joursRestants = joursEntre(today, dateExp);
      expire = joursRestants < 0;
      expireBientot = !expire && joursRestants <= 60;
    }

    return {
      doc,
      present: true,
      expire,
      expireBientot,
      joursRestants,
      documentId: match.id,
      dateExpiration: dateExp,
    };
  });
}

// ═══ ALERTES ═══

export function genererAlertes(
  ascenseurs: { id: string; code_appareil: string; adresse: string }[],
  allDocsStatus: Map<string, DocStatus[]>,
  allReserves: Map<string, ReserveBcInfo[]>,
): AlerteConformite[] {
  const alertes: AlerteConformite[] = [];
  const today = aujourdhui();

  for (const asc of ascenseurs) {
    const docs = allDocsStatus.get(asc.id) || [];
    const reserves = allReserves.get(asc.id) || [];

    // Documents expirés
    for (const d of docs) {
      if (!d.present) {
        alertes.push({
          id: `${asc.id}-doc-${d.doc.code}`,
          type: 'doc_manquant',
          severity: d.doc.categorie === 'reglementaire' ? 'critical' : 'warning',
          message: `${d.doc.label} manquant`,
          ascenseurCode: asc.code_appareil,
          ascenseurSite: asc.adresse,
          ascenseurId: asc.id,
          date: today,
        });
      } else if (d.expire) {
        alertes.push({
          id: `${asc.id}-exp-${d.doc.code}`,
          type: 'doc_expire',
          severity: 'critical',
          message: `${d.doc.label} expiré depuis ${Math.abs(d.joursRestants!)} jours`,
          ascenseurCode: asc.code_appareil,
          ascenseurSite: asc.adresse,
          ascenseurId: asc.id,
          date: today,
        });
      } else if (d.expireBientot) {
        alertes.push({
          id: `${asc.id}-soon-${d.doc.code}`,
          type: 'doc_expire_bientot',
          severity: 'warning',
          message: `${d.doc.label} expire dans ${d.joursRestants} jours`,
          ascenseurCode: asc.code_appareil,
          ascenseurSite: asc.adresse,
          ascenseurId: asc.id,
          date: today,
        });
      }
    }

    // Réserves non levées
    const ouvertes = reserves.filter(r => !r.isResolved);
    if (ouvertes.length > 0) {
      const maxJours = Math.max(...ouvertes.map(r => r.joursOuvert));
      alertes.push({
        id: `${asc.id}-reserves`,
        type: 'reserve_ouverte',
        severity: maxJours > 90 ? 'critical' : 'warning',
        message: `${ouvertes.length} réserve(s) non levée(s) depuis ${maxJours} jours`,
        ascenseurCode: asc.code_appareil,
        ascenseurSite: asc.adresse,
        ascenseurId: asc.id,
        date: today,
      });
    }
  }

  // Trier : critical d'abord
  alertes.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });

  return alertes;
}

// ═══ AUTO-ARCHIVAGE RAPPORT BC → GED ═══

export async function archiverRapportBcDansGed(
  appareilId: string,
  report: {
    control_office: string;
    report_number: string;
    report_date: string;
    status: string;
    observations: string;
    reserves: { description: string; is_resolved: boolean }[];
  }
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Calculer date expiration (J+12 mois)
    const dateExp = new Date(report.report_date);
    dateExp.setFullYear(dateExp.getFullYear() + 1);

    const reservesText = report.reserves.length > 0
      ? `\n\nRéserves (${report.reserves.length}):\n` + report.reserves.map((r, i) => `${i + 1}. ${r.description} ${r.is_resolved ? '✅' : '❌'}`).join('\n')
      : '\n\nAucune réserve.';

    const description = `Rapport Bureau de Contrôle — ${report.control_office}\nN° ${report.report_number}\nDate: ${report.report_date}\nStatut: ${report.status}\n\nObservations: ${report.observations || 'Aucune'}${reservesText}`;

    // Vérifier si un document GED existe déjà pour ce rapport
    const { data: existing } = await supabase
      .from('ged_documents')
      .select('id')
      .eq('numero_document', report.report_number)
      .maybeSingle();

    const docData = {
      nom: `Rapport BC ${report.control_office} — ${report.report_date}`,
      description,
      numero_document: report.report_number,
      date_document: report.report_date,
      date_expiration: dateExp.toISOString().slice(0, 10),
      cree_par: user.id,
      source_auto: 'bureau_controle',
      ascenseur_ids: [appareilId],
    };

    if (existing) {
      await supabase.from('ged_documents').update(docData).eq('id', existing.id);
    } else {
      await supabase.from('ged_documents').insert(docData);
    }

    return true;
  } catch (err) {
    console.error('Erreur archivage BC → GED:', err);
    return false;
  }
}

// ═══ TIMELINE UNIFIÉE ═══

export interface TimelineEvent {
  id: string;
  date: Date;
  dateStr: string;
  type: 'controle' | 'visite' | 'panne' | 'bc_report' | 'document' | 'reserve_levee';
  label: string;
  detail?: string;
  color: string;
  icon: string;
}

export function buildTimeline(
  controles: any[],
  visites: any[],
  pannes: any[],
  reserves: ReserveBcInfo[],
  docsGed: any[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const parseYYYYMMDD = (val: any): Date | null => {
    if (!val) return null;
    const s = String(val);
    if (s.length === 8) return new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
    return null;
  };

  // Contrôles Progilift
  controles.forEach((c, i) => {
    const d = c.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: `ctrl-${i}`, date, dateStr: date.toISOString().slice(0, 10), type: 'controle', label: 'Contrôle ' + (d.Libelle || c.motif || 'technique'), detail: d.NOTE2 || '', color: '#8B5CF6', icon: '🔍' });
  });

  // Visites
  visites.forEach((v, i) => {
    const d = v.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: `vis-${i}`, date, dateStr: date.toISOString().slice(0, 10), type: 'visite', label: 'Visite d\'entretien', detail: d.NOTE2 || '', color: '#3B82F6', icon: '🔧' });
  });

  // Pannes
  pannes.forEach((p, i) => {
    const d = p.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: `pan-${i}`, date, dateStr: date.toISOString().slice(0, 10), type: 'panne', label: 'Panne: ' + (d.Libelle || p.motif || 'non définie'), detail: d.NOTE2 || '', color: '#EF4444', icon: '⚡' });
  });

  // Réserves levées
  reserves.filter(r => r.isResolved && r.resolvedAt).forEach(r => {
    const date = new Date(r.resolvedAt!);
    events.push({ id: `res-${r.id}`, date, dateStr: date.toISOString().slice(0, 10), type: 'reserve_levee', label: `Réserve levée: ${r.description.slice(0, 60)}`, detail: r.bureau, color: '#10B981', icon: '✅' });
  });

  // Documents GED
  docsGed.forEach(doc => {
    const dateStr = doc.date_document || doc.created_at?.slice(0, 10);
    if (dateStr) {
      const date = new Date(dateStr);
      const isAuto = doc.source_auto === 'bureau_controle';
      events.push({
        id: `doc-${doc.id}`,
        date,
        dateStr: date.toISOString().slice(0, 10),
        type: isAuto ? 'bc_report' : 'document',
        label: isAuto ? `Rapport BC auto-archivé: ${doc.nom}` : `Document: ${doc.nom}`,
        detail: doc.description,
        color: isAuto ? '#F97316' : '#3B82F6',
        icon: isAuto ? '📋' : '📄',
      });
    }
  });

  // Trier par date décroissante
  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}
