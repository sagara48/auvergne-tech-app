// ═══════════════════════════════════════════════════════════════
// SERVICE CONFORMITÉ V2 — Source unique : controles_techniques
// Synergies GED × Parc Ascenseurs × Contrôle Technique
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ═══ TYPES ═══

export interface DocObligatoire {
  code: string;
  label: string;
  categorie: 'reglementaire' | 'technique' | 'administratif';
  expirable: boolean;
  periodiciteJours?: number;
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

export interface ObservationInfo {
  id: string;
  description: string;
  gravite: 'OA' | 'OI' | 'OC';
  graviteLabel: string;
  categorie: string;
  statut: string;
  controleId: string;
  controleType: string;
  organisme: string;
  dateConstatation: string;
  joursOuvert: number;
  isLevee: boolean;
  dateLevee: string | null;
}

export interface ControleInfo {
  id: string;
  type: string;
  typeLabel: string;
  statut: string;
  organisme: string;
  datePlanifiee: string;
  dateRealisation: string | null;
  scoreConformite: number | null;
  nbObservations: number;
  nbOa: number;
  nbNonLevees: number;
}

export interface AlerteConformite {
  id: string;
  type: 'doc_expire' | 'doc_expire_bientot' | 'doc_manquant' | 'observation_ouverte' | 'controle_retard' | 'oa_urgente';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  ascenseurCode?: string;
  ascenseurSite?: string;
  ascenseurId?: string;
  date: string;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  dateStr: string;
  type: 'controle_tech' | 'controle_progilift' | 'visite' | 'panne' | 'observation_levee' | 'document' | 'bc_report';
  label: string;
  detail?: string;
  color: string;
  icon: string;
}

// ═══ DOCUMENTS OBLIGATOIRES ═══

export const DOCS_OBLIGATOIRES: DocObligatoire[] = [
  { code: 'rapport_bc', label: 'Rapport Bureau de Contrôle', categorie: 'reglementaire', expirable: true, periodiciteJours: 365 },
  { code: 'contrat_maintenance', label: 'Contrat de maintenance', categorie: 'administratif', expirable: true, periodiciteJours: 365 },
  { code: 'attestation_ce', label: 'Attestation CE / conformité', categorie: 'reglementaire', expirable: false },
  { code: 'schema_electrique', label: 'Schéma électrique', categorie: 'technique', expirable: false },
  { code: 'carnet_entretien', label: "Carnet d'entretien", categorie: 'reglementaire', expirable: false },
];

const DOC_KEYWORDS: Record<string, string[]> = {
  rapport_bc: ['rapport bc', 'bureau contrôle', 'bureau de contrôle', 'socotec', 'apave', 'veritas', 'dekra', 'qualiconsult', 'cep', 'contrôle réglementaire', 'contrôle technique', 'controle technique'],
  contrat_maintenance: ['contrat', 'maintenance', 'entretien annuel'],
  attestation_ce: ['attestation ce', 'conformité', 'déclaration ce', 'marquage ce'],
  schema_electrique: ['schéma', 'schema', 'électrique', 'electrique', 'câblage', 'armoire'],
  carnet_entretien: ['carnet', 'entretien', 'registre', 'maintenance'],
};

const TYPES_LABELS: Record<string, string> = {
  quinquennal: 'Contrôle quinquennal',
  periodique: 'Inspection périodique',
  annuel: 'Vérification annuelle',
  semestriel: 'Visite semestrielle',
  exceptionnel: 'Contrôle exceptionnel',
};

const GRAVITE_LABELS: Record<string, string> = {
  OA: 'Anomalie grave',
  OI: 'Observation importante',
  OC: 'Observation courante',
};

// ═══ UTILITAIRES ═══

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
  observations: ObservationInfo[],
  dernierControleDate: string | null,
): { score: number; details: { docsScore: number; reservesScore: number; controleScore: number } } {
  const docsObligatoires = docsStatus.length;
  const docsPresentsValides = docsStatus.filter(d => d.present && !d.expire).length;
  const docsScore = docsObligatoires > 0 ? (docsPresentsValides / docsObligatoires) * 100 : 100;

  const nonLevees = observations.filter(o => !o.isLevee);
  const nbOa = nonLevees.filter(o => o.gravite === 'OA').length;
  const nbOi = nonLevees.filter(o => o.gravite === 'OI').length;
  const nbOc = nonLevees.filter(o => o.gravite === 'OC').length;
  const penalite = nbOa * 30 + nbOi * 15 + nbOc * 5;
  const reservesScore = Math.max(0, 100 - penalite);

  let controleScore = 100;
  if (dernierControleDate) {
    const joursDepuis = joursEntre(dernierControleDate, aujourdhui());
    if (joursDepuis > 365) controleScore = 0;
    else if (joursDepuis > 270) controleScore = 40;
    else if (joursDepuis > 180) controleScore = 70;
  } else {
    controleScore = 30;
  }

  const score = Math.round(docsScore * 0.50 + reservesScore * 0.30 + controleScore * 0.20);
  return { score, details: { docsScore: Math.round(docsScore), reservesScore: Math.round(reservesScore), controleScore: Math.round(controleScore) } };
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

// ═══ REQUÊTES BD — SOURCE : controles_techniques ═══

export async function getObservationsAscenseur(ascenseurId: string): Promise<ObservationInfo[]> {
  try {
    const { data: controles } = await supabase
      .from('controles_techniques')
      .select('id, type_controle, organisme, date_planifiee, date_realisation, controle_observations(*)')
      .eq('ascenseur_id', ascenseurId)
      .order('date_planifiee', { ascending: false });

    if (!controles) return [];

    const today = aujourdhui();
    const observations: ObservationInfo[] = [];

    for (const ct of controles) {
      for (const obs of ((ct as any).controle_observations || [])) {
        const isLevee = ['levee', 'validee'].includes(obs.statut);
        const dateConst = obs.date_constatation || ct.date_realisation || ct.date_planifiee || '';
        observations.push({
          id: obs.id,
          description: obs.description,
          gravite: obs.gravite,
          graviteLabel: GRAVITE_LABELS[obs.gravite] || obs.gravite,
          categorie: obs.categorie || '',
          statut: obs.statut,
          controleId: ct.id,
          controleType: TYPES_LABELS[ct.type_controle] || ct.type_controle,
          organisme: ct.organisme || '',
          dateConstatation: dateConst,
          joursOuvert: isLevee ? 0 : (dateConst ? joursEntre(dateConst, today) : 0),
          isLevee,
          dateLevee: obs.date_levee || null,
        });
      }
    }
    return observations;
  } catch {
    return [];
  }
}

export async function getControlesAscenseur(ascenseurId: string): Promise<ControleInfo[]> {
  try {
    const { data } = await supabase
      .from('controles_techniques')
      .select('*, controle_observations(id, gravite, statut)')
      .eq('ascenseur_id', ascenseurId)
      .order('date_planifiee', { ascending: false });

    if (!data) return [];

    return data.map(ct => {
      const obs = (ct as any).controle_observations || [];
      const nonLevees = obs.filter((o: any) => !['levee', 'validee'].includes(o.statut));
      return {
        id: ct.id,
        type: ct.type_controle,
        typeLabel: TYPES_LABELS[ct.type_controle] || ct.type_controle,
        statut: ct.statut,
        organisme: ct.organisme || '',
        datePlanifiee: ct.date_planifiee,
        dateRealisation: ct.date_realisation,
        scoreConformite: ct.score_conformite,
        nbObservations: obs.length,
        nbOa: obs.filter((o: any) => o.gravite === 'OA').length,
        nbNonLevees: nonLevees.length,
      };
    });
  } catch {
    return [];
  }
}

export async function getDocumentsGedAscenseur(ascenseurId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('v_documents_ascenseur')
      .select('*')
      .eq('ascenseur_id', ascenseurId)
      .order('created_at', { ascending: false });

    if (!error && data) return data;

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
    const match = documents.find(d => {
      const matched = matchDocType(d.nom || d.fichier_nom || '', d.description || d.type_libelle || '');
      return matched === doc.code;
    });

    if (!match) return { doc, present: false, expire: false, expireBientot: false, joursRestants: null };

    const dateExp = match.date_expiration;
    let expire = false, expireBientot = false, joursRestants: number | null = null;
    if (dateExp) {
      joursRestants = joursEntre(today, dateExp);
      expire = joursRestants < 0;
      expireBientot = !expire && joursRestants <= 60;
    }
    return { doc, present: true, expire, expireBientot, joursRestants, documentId: match.id, dateExpiration: dateExp };
  });
}

// ═══ AUTO-ARCHIVAGE CONTRÔLE TECHNIQUE → GED ═══

export async function archiverControleDansGed(
  ascenseurId: string,
  controle: {
    id: string;
    type_controle: string;
    organisme: string;
    date_realisation: string;
    notes?: string;
    score_conformite?: number;
    observations: { description: string; gravite: string; statut: string }[];
  }
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const dateExp = new Date(controle.date_realisation);
    dateExp.setFullYear(dateExp.getFullYear() + 1);

    const typeLabel = TYPES_LABELS[controle.type_controle] || controle.type_controle;
    const obsText = controle.observations.length > 0
      ? '\n\nObservations (' + controle.observations.length + '):\n' +
        controle.observations.map((o, i) => (i + 1) + '. [' + o.gravite + '] ' + o.description + ' — ' + o.statut).join('\n')
      : '\n\nAucune observation.';

    const description = typeLabel + ' — ' + controle.organisme + '\nDate: ' + controle.date_realisation + '\nScore: ' + (controle.score_conformite ?? 'N/A') + '%\n\nNotes: ' + (controle.notes || 'Aucune') + obsText;
    const reportNumber = 'CT-' + controle.id.slice(0, 8);

    const { data: existing } = await supabase
      .from('ged_documents')
      .select('id')
      .eq('numero_document', reportNumber)
      .maybeSingle();

    const docData = {
      nom: typeLabel + ' ' + controle.organisme + ' — ' + controle.date_realisation,
      description: description,
      numero_document: reportNumber,
      date_document: controle.date_realisation,
      date_expiration: dateExp.toISOString().slice(0, 10),
      cree_par: user.id,
      source_auto: 'controle_technique',
      ascenseur_ids: [ascenseurId],
    };

    if (existing) {
      await supabase.from('ged_documents').update(docData).eq('id', existing.id);
    } else {
      await supabase.from('ged_documents').insert(docData);
    }
    return true;
  } catch (err) {
    console.error('Erreur archivage CT → GED:', err);
    return false;
  }
}

// Gardé pour compatibilité MES (mise en service uniquement)
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

    const dateExp = new Date(report.report_date);
    dateExp.setFullYear(dateExp.getFullYear() + 1);

    const reservesText = report.reserves.length > 0
      ? '\n\nRéserves (' + report.reserves.length + '):\n' + report.reserves.map((r, i) => (i + 1) + '. ' + r.description + ' ' + (r.is_resolved ? '✅' : '❌')).join('\n')
      : '\n\nAucune réserve.';

    const description = 'Rapport BC MES — ' + report.control_office + '\nN° ' + report.report_number + '\nDate: ' + report.report_date + '\n\nObservations: ' + (report.observations || 'Aucune') + reservesText;

    const { data: existing } = await supabase
      .from('ged_documents')
      .select('id')
      .eq('numero_document', report.report_number)
      .maybeSingle();

    const docData = {
      nom: 'Rapport BC MES ' + report.control_office + ' — ' + report.report_date,
      description: description,
      numero_document: report.report_number,
      date_document: report.report_date,
      date_expiration: dateExp.toISOString().slice(0, 10),
      cree_par: user.id,
      source_auto: 'bureau_controle_mes',
      ascenseur_ids: [appareilId],
    };

    if (existing) {
      await supabase.from('ged_documents').update(docData).eq('id', existing.id);
    } else {
      await supabase.from('ged_documents').insert(docData);
    }
    return true;
  } catch (err) {
    console.error('Erreur archivage BC MES → GED:', err);
    return false;
  }
}

// ═══ TIMELINE UNIFIÉE ═══

export function buildTimeline(
  controlesProgilift: any[],
  visites: any[],
  pannes: any[],
  observations: ObservationInfo[],
  controlesTech: ControleInfo[],
  docsGed: any[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const parseYYYYMMDD = (val: any): Date | null => {
    if (!val) return null;
    const s = String(val);
    if (s.length === 8) return new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
    return null;
  };

  controlesTech.forEach(ct => {
    const dateStr = ct.dateRealisation || ct.datePlanifiee;
    if (dateStr) {
      const date = new Date(dateStr);
      const statusIcon = ct.statut === 'termine' ? '✅' : ct.statut === 'planifie' ? '📅' : '🔄';
      events.push({
        id: 'ct-' + ct.id,
        date: date,
        dateStr: date.toISOString().slice(0, 10),
        type: 'controle_tech',
        label: ct.typeLabel + ' — ' + (ct.organisme || 'Interne'),
        detail: ct.nbObservations > 0 ? ct.nbObservations + ' obs. dont ' + ct.nbOa + ' OA • Score: ' + (ct.scoreConformite ?? '—') + '%' : 'Score: ' + (ct.scoreConformite ?? '—') + '%',
        color: ct.nbOa > 0 ? '#EF4444' : ct.statut === 'termine' ? '#10B981' : '#F59E0B',
        icon: statusIcon,
      });
    }
  });

  controlesProgilift.forEach((c, i) => {
    const d = c.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: 'ctrl-' + i, date: date, dateStr: date.toISOString().slice(0, 10), type: 'controle_progilift', label: 'Contrôle Progilift: ' + (d.Libelle || c.motif || 'technique'), detail: d.NOTE2 || '', color: '#8B5CF6', icon: '🔍' });
  });

  visites.forEach((v, i) => {
    const d = v.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: 'vis-' + i, date: date, dateStr: date.toISOString().slice(0, 10), type: 'visite', label: "Visite d'entretien", detail: d.NOTE2 || '', color: '#3B82F6', icon: '🔧' });
  });

  pannes.forEach((p, i) => {
    const d = p.data_wpanne || {};
    const date = parseYYYYMMDD(d.DATE);
    if (date) events.push({ id: 'pan-' + i, date: date, dateStr: date.toISOString().slice(0, 10), type: 'panne', label: 'Panne: ' + (d.Libelle || p.motif || 'non définie'), detail: d.NOTE2 || '', color: '#EF4444', icon: '⚡' });
  });

  observations.filter(o => o.isLevee && o.dateLevee).forEach(o => {
    const date = new Date(o.dateLevee!);
    events.push({ id: 'lev-' + o.id, date: date, dateStr: date.toISOString().slice(0, 10), type: 'observation_levee', label: 'Obs. levée [' + o.gravite + ']: ' + o.description.slice(0, 60), detail: o.controleType + ' — ' + o.organisme, color: '#10B981', icon: '✅' });
  });

  docsGed.forEach(doc => {
    const ds = doc.date_document || (doc.created_at ? doc.created_at.slice(0, 10) : null);
    if (ds) {
      const date = new Date(ds);
      const isAuto = doc.source_auto && (doc.source_auto.startsWith('controle') || doc.source_auto.startsWith('bureau'));
      events.push({
        id: 'doc-' + doc.id,
        date: date,
        dateStr: date.toISOString().slice(0, 10),
        type: isAuto ? 'bc_report' : 'document',
        label: isAuto ? 'Auto-archivé: ' + doc.nom : 'Document: ' + doc.nom,
        detail: doc.description || '',
        color: isAuto ? '#F97316' : '#3B82F6',
        icon: isAuto ? '📋' : '📄',
      });
    }
  });

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}
