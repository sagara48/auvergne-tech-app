// ═══════════════════════════════════════════════════════════════
// UNIFIED LIFT SERVICE — Fusion Progilift + Sigma4 IoT
// Crée une fiche ascenseur unifiée avec score de santé,
// timeline croisée, alertes combinées et recommandations.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/services/supabase';
import {
  isConnectedToSigma4, getLifts, getMonitorOnline, getLiftServices,
  getLiftErrors, Sigma4Lift, Sigma4MonitorData, Sigma4ServiceEntry,
  Sigma4MessageEntry,
} from '@/services/sigma4liftsApi';
import {
  getLiftState, getEstadoInfo, isOperational, hasProblem, isConnected, isUrgent,
  EstadoCategory,
} from '@/services/sigma4LiftStates';
import { lookupErrorCode, severityInfo, S4LErrorCode } from '@/services/sigma4ErrorCodes';

// ═══ TYPES ═══

export interface ProgiliftData {
  ascenseur: {
    id: string;
    code_appareil: string;
    adresse: string;
    ville: string;
    code_postal: string;
    secteur: number;
    marque: string;
    modele: string;
    type_appareil: string;
    type_planning: string;
    nb_visites_an: number;
    en_arret: boolean;
    dernier_passage: string | null;
    localisation: string;
    tel_cabine: string;
  } | null;
  pannes: PanneRecord[];
  arrets: ArretRecord[];
  visites: VisiteRecord[];
}

export interface PanneRecord {
  id: string;
  date_appel: string;
  motif: string;
  cause: string;
  depanneur: string;
  duree_minutes: number;
  etat: string;
}

export interface ArretRecord {
  id: string;
  date_appel: string;
  heure_appel: string;
  motif: string;
  demandeur: string;
}

export interface VisiteRecord {
  id: string;
  date: string;
  type: string;
  technicien: string;
  notes?: string;
}

export interface Sigma4Data {
  lift: Sigma4Lift | null;
  linked: boolean;              // Lien S4L ↔ Progilift établi
  monitor: Sigma4MonitorData | null;
  traffic: Sigma4ServiceEntry[];
  errors: Sigma4MessageEntry[];
  alerts: IoTAlert[];
}

export interface IoTAlert {
  id: string;
  timestamp: string;
  message: string;
  niveau: string;
  type: string;
  acquittee: boolean;
}

// ─── FICHE UNIFIÉE ───

export interface UnifiedLift {
  // Identité
  codeAppareil: string;
  adresse: string;
  ville: string;
  codePostal: string;
  secteur: number;
  localisation: string;

  // Sources
  progilift: ProgiliftData;
  sigma4: Sigma4Data;

  // Cross-data
  healthScore: number;            // 0-100
  healthFactors: HealthFactor[];
  recommendations: Recommendation[];
  timelineEvents: TimelineEvent[];
  sourceMatch: 'exact' | 'fuzzy' | 'manual' | 'none';
}

export interface HealthFactor {
  id: string;
  label: string;
  score: number;         // 0-100
  weight: number;        // 0-1
  color: string;
  icon: string;
  detail: string;
}

export interface Recommendation {
  id: string;
  priority: 'urgent' | 'important' | 'info';
  title: string;
  description: string;
  icon: string;
  color: string;
  actionLabel?: string;
  actionModule?: string; // 'sigma4' | 'travaux' | 'stock'
}

export interface TimelineEvent {
  id: string;
  date: string;                               // ISO
  type: 'visite' | 'panne' | 'arret' | 'erreur_iot' | 'alerte_iot' | 'etat_change';
  source: 'progilift' | 'sigma4' | 'combined';
  title: string;
  detail?: string;
  color: string;
  icon: string;
}

// ═══ CHARGEMENT DES DONNÉES ═══

/** Charge les données Progilift depuis Supabase */
async function loadProgiliftData(codeAppareil: string): Promise<ProgiliftData> {
  // Ascenseur
  const { data: asc } = await supabase
    .from('parc_ascenseurs')
    .select('*')
    .eq('code_appareil', codeAppareil)
    .maybeSingle();

  if (!asc) return { ascenseur: null, pannes: [], arrets: [], visites: [] };

  const idWsoucont = asc.id_wsoucont;

  // Pannes (6 derniers mois)
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const { data: pannesRaw } = await supabase
    .from('parc_pannes')
    .select('*')
    .eq('id_wsoucont', idWsoucont)
    .gte('date_appel', sixMonthsAgo)
    .order('date_appel', { ascending: false })
    .limit(20);

  // Arrêts (3 derniers mois)
  const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const { data: arretsRaw } = await supabase
    .from('parc_arrets')
    .select('*')
    .eq('id_wsoucont', idWsoucont)
    .gte('date_appel', threeMonthsAgo)
    .order('date_appel', { ascending: false })
    .limit(20);

  return {
    ascenseur: asc,
    pannes: (pannesRaw || []).map(p => ({
      id: p.id,
      date_appel: p.date_appel,
      motif: p.motif || '',
      cause: p.cause || '',
      depanneur: p.depanneur || '',
      duree_minutes: p.duree_minutes || 0,
      etat: p.etat || '',
    })),
    arrets: (arretsRaw || []).map(a => ({
      id: a.id,
      date_appel: a.date_appel,
      heure_appel: a.heure_appel || '',
      motif: a.motif || '',
      demandeur: a.demandeur || '',
    })),
    visites: [], // Les visites sont dans les pannes avec type planning
  };
}

/** Charge les données Sigma4 pour un code appareil */
async function loadSigma4Data(codeAppareil: string): Promise<Sigma4Data> {
  const empty: Sigma4Data = { lift: null, linked: false, monitor: null, traffic: [], errors: [], alerts: [] };
  if (!isConnectedToSigma4()) return empty;

  try {
    const lifts = await getLifts();

    // Chercher le match
    const match = lifts.find(l =>
      l.liftCompRef === codeAppareil ||
      l.liftCompRef?.includes(codeAppareil) ||
      codeAppareil.includes(l.liftCompRef || '')
    );

    // Chercher le lien en base
    const { data: dbLink } = await supabase
      .from('iot_lifts')
      .select('lift_id, ascenseur_id')
      .eq('nom', codeAppareil)
      .maybeSingle();

    const lift = match || (dbLink ? lifts.find(l => String(l.id) === dbLink.lift_id) : null) || null;
    if (!lift) return empty;

    // Charger données complémentaires en parallèle
    const [monitor, traffic, errorsRaw, alertsRaw] = await Promise.allSettled([
      getMonitorOnline(lift.id),
      getLiftServices(lift.id).catch(() => []),
      getLiftErrors(lift.id, 30).catch(() => []),
      supabase
        .from('iot_alerts')
        .select('*')
        .eq('lift_id', String(lift.id))
        .order('timestamp', { ascending: false })
        .limit(20)
        .then(r => r.data || []),
    ]);

    return {
      lift,
      linked: !!dbLink?.ascenseur_id,
      monitor: monitor.status === 'fulfilled' ? monitor.value : null,
      traffic: traffic.status === 'fulfilled' ? traffic.value : [],
      errors: errorsRaw.status === 'fulfilled' ? errorsRaw.value as Sigma4MessageEntry[] : [],
      alerts: (alertsRaw.status === 'fulfilled' ? alertsRaw.value : []) as IoTAlert[],
    };
  } catch {
    return empty;
  }
}

// ═══ FUSION + ANALYSE ═══

/** Charge et fusionne toutes les données pour un ascenseur */
export async function getUnifiedLift(codeAppareil: string): Promise<UnifiedLift> {
  const [progilift, sigma4] = await Promise.all([
    loadProgiliftData(codeAppareil),
    loadSigma4Data(codeAppareil),
  ]);

  const asc = progilift.ascenseur;

  // Déterminer le type de match
  let sourceMatch: UnifiedLift['sourceMatch'] = 'none';
  if (sigma4.lift) {
    if (sigma4.lift.liftCompRef === codeAppareil) sourceMatch = 'exact';
    else if (sigma4.linked) sourceMatch = 'manual';
    else sourceMatch = 'fuzzy';
  }

  // Timeline croisée
  const timelineEvents = buildTimeline(progilift, sigma4);

  // Score de santé
  const { score, factors } = computeHealthScore(progilift, sigma4);

  // Recommandations
  const recommendations = generateRecommendations(progilift, sigma4, factors);

  return {
    codeAppareil,
    adresse: asc?.adresse || sigma4.lift?.address || '',
    ville: asc?.ville || sigma4.lift?.city || '',
    codePostal: asc?.code_postal || sigma4.lift?.zipCode || '',
    secteur: asc?.secteur || 0,
    localisation: asc?.localisation || sigma4.lift?.situacionEnEdificio || '',
    progilift,
    sigma4,
    healthScore: score,
    healthFactors: factors,
    recommendations,
    timelineEvents,
    sourceMatch,
  };
}

// ═══ TIMELINE CROISÉE ═══

function buildTimeline(pg: ProgiliftData, s4: Sigma4Data): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Pannes Progilift
  pg.pannes.forEach(p => {
    events.push({
      id: `pg-panne-${p.id}`,
      date: p.date_appel,
      type: 'panne',
      source: 'progilift',
      title: `Panne: ${p.motif || 'Sans motif'}`,
      detail: [p.cause, p.depanneur, p.duree_minutes > 0 ? `${p.duree_minutes}min` : null].filter(Boolean).join(' · '),
      color: '#DC2626',
      icon: '🔴',
    });
  });

  // Arrêts Progilift
  pg.arrets.forEach(a => {
    events.push({
      id: `pg-arret-${a.id}`,
      date: a.date_appel,
      type: 'arret',
      source: 'progilift',
      title: `Arrêt: ${a.motif || 'Appel client'}`,
      detail: a.demandeur ? `Demandé par: ${a.demandeur}` : undefined,
      color: '#EA580C',
      icon: '⚠️',
    });
  });

  // Erreurs IoT Sigma4
  s4.errors.forEach(e => {
    const errInfo = lookupErrorCode(e.content);
    events.push({
      id: `s4-err-${e.id}`,
      date: e.messageDate,
      type: 'erreur_iot',
      source: 'sigma4',
      title: `Erreur IoT: ${errInfo?.descFr || e.content}`,
      detail: [e.dtype, errInfo?.family, errInfo?.severity].filter(Boolean).join(' · '),
      color: '#8B5CF6',
      icon: '📡',
    });
  });

  // Alertes IoT Supabase
  s4.alerts.filter(a => !a.acquittee).forEach(a => {
    events.push({
      id: `s4-alert-${a.id}`,
      date: a.timestamp,
      type: 'alerte_iot',
      source: 'sigma4',
      title: `Alerte: ${a.message}`,
      detail: `${a.niveau} · ${a.type}`,
      color: '#DC2626',
      icon: '🚨',
    });
  });

  // Tri chronologique décroissant
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

// ═══ SCORE DE SANTÉ ═══

function computeHealthScore(pg: ProgiliftData, s4: Sigma4Data): { score: number; factors: HealthFactor[] } {
  const factors: HealthFactor[] = [];

  // ── Factor 1: État IoT actuel (poids 35%)
  if (s4.lift) {
    const estado = s4.lift.estado;
    let stateScore = 100;
    if (isUrgent(estado)) stateScore = 0;
    else if (hasProblem(estado)) stateScore = 30;
    else if (!isOperational(estado)) stateScore = 60;

    const info = getEstadoInfo(estado);
    factors.push({
      id: 'iot_state', label: 'État IoT', score: stateScore, weight: 0.35,
      color: info.color, icon: info.icon,
      detail: `${info.label} (code ${estado})`,
    });
  } else {
    // Pas d'IoT → neutre (pas de pénalité)
    factors.push({
      id: 'iot_state', label: 'État IoT', score: 75, weight: 0.15,
      color: '#64748B', icon: '📡',
      detail: 'Non connecté Sigma4',
    });
  }

  // ── Factor 2: Fréquence de pannes (poids 25%)
  const recentPannes = pg.pannes.filter(p => {
    const d = new Date(p.date_appel);
    return d.getTime() > Date.now() - 90 * 86400000; // 3 mois
  });
  const panneScore = recentPannes.length === 0 ? 100 : recentPannes.length <= 1 ? 80 : recentPannes.length <= 3 ? 50 : 20;
  factors.push({
    id: 'pannes', label: 'Pannes (3 mois)', score: panneScore, weight: 0.25,
    color: panneScore >= 80 ? '#059669' : panneScore >= 50 ? '#CA8A04' : '#DC2626',
    icon: recentPannes.length === 0 ? '✅' : '❌',
    detail: `${recentPannes.length} panne${recentPannes.length > 1 ? 's' : ''} en 3 mois`,
  });

  // ── Factor 3: Maintenance à jour (poids 20%)
  let maintenanceScore = 50; // pas de données → neutre
  if (pg.ascenseur) {
    const lastVisit = pg.ascenseur.dernier_passage;
    if (lastVisit) {
      const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
      const expectedFreq = pg.ascenseur.nb_visites_an > 0 ? Math.floor(365 / pg.ascenseur.nb_visites_an) : 180;
      const ratio = daysSince / expectedFreq;
      maintenanceScore = ratio < 0.8 ? 100 : ratio < 1.1 ? 80 : ratio < 1.5 ? 50 : 20;
    }
    factors.push({
      id: 'maintenance', label: 'Maintenance', score: maintenanceScore, weight: 0.20,
      color: maintenanceScore >= 80 ? '#059669' : maintenanceScore >= 50 ? '#CA8A04' : '#DC2626',
      icon: maintenanceScore >= 80 ? '🔧' : '⏰',
      detail: pg.ascenseur.dernier_passage
        ? `Dernier passage: ${new Date(pg.ascenseur.dernier_passage).toLocaleDateString('fr-FR')}`
        : 'Pas de visite enregistrée',
    });
  }

  // ── Factor 4: Erreurs IoT récentes (poids 15%)
  if (s4.lift) {
    const recentErrors = s4.errors.filter(e => {
      const d = new Date(e.messageDate);
      return d.getTime() > Date.now() - 30 * 86400000;
    });
    const errorScore = recentErrors.length === 0 ? 100 : recentErrors.length <= 2 ? 75 : recentErrors.length <= 5 ? 45 : 15;
    factors.push({
      id: 'iot_errors', label: 'Erreurs IoT (30j)', score: errorScore, weight: 0.15,
      color: errorScore >= 75 ? '#059669' : errorScore >= 45 ? '#CA8A04' : '#DC2626',
      icon: recentErrors.length === 0 ? '✅' : '⚡',
      detail: `${recentErrors.length} erreur${recentErrors.length > 1 ? 's' : ''} en 30 jours`,
    });
  }

  // ── Factor 5: Connexion / disponibilité (poids 5%)
  if (s4.lift) {
    const connScore = isConnected(s4.lift.estado) ? 100 : 0;
    factors.push({
      id: 'connexion', label: 'Connexion', score: connScore, weight: 0.05,
      color: connScore > 0 ? '#059669' : '#EA580C',
      icon: connScore > 0 ? '📶' : '📵',
      detail: connScore > 0 ? 'Boîtier en ligne' : 'Boîtier déconnecté',
    });
  }

  // Score global pondéré
  const totalWeight = factors.reduce((acc, f) => acc + f.weight, 0);
  const score = totalWeight > 0
    ? Math.round(factors.reduce((acc, f) => acc + f.score * f.weight, 0) / totalWeight)
    : 50;

  return { score, factors };
}

// ═══ RECOMMANDATIONS ═══

function generateRecommendations(pg: ProgiliftData, s4: Sigma4Data, factors: HealthFactor[]): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. État critique → intervention urgente
  if (s4.lift && isUrgent(s4.lift.estado)) {
    const info = getEstadoInfo(s4.lift.estado);
    recs.push({
      id: 'urgent-state',
      priority: 'urgent',
      title: `Ascenseur en ${info.label}`,
      description: `Code ${s4.lift.estado} — Intervention immédiate nécessaire. Ouvrir le monitor pour diagnostic temps réel.`,
      icon: '🚨', color: '#DC2626',
      actionLabel: 'Ouvrir Monitor', actionModule: 'sigma4',
    });
  }

  // 2. Panne en cours + IoT non critique → vérifier cohérence
  if (pg.ascenseur?.en_arret && s4.lift && isOperational(s4.lift.estado)) {
    recs.push({
      id: 'mismatch-arret-ok',
      priority: 'important',
      title: 'Incohérence: arrêt Progilift mais IoT OK',
      description: `L'ascenseur est marqué "en arrêt" dans Progilift mais l'IoT indique un état normal. Vérifier si l'arrêt a été résolu.`,
      icon: '🔄', color: '#CA8A04',
    });
  }

  // 3. IoT en panne mais pas d'arrêt Progilift
  if (s4.lift && hasProblem(s4.lift.estado) && pg.ascenseur && !pg.ascenseur.en_arret) {
    recs.push({
      id: 'mismatch-panne-no-arret',
      priority: 'important',
      title: 'Anomalie IoT non déclarée dans Progilift',
      description: `L'IoT signale un problème (${getEstadoInfo(s4.lift.estado).label}) mais aucun arrêt n'est enregistré dans Progilift. Déclarer l'arrêt.`,
      icon: '📝', color: '#EA580C',
    });
  }

  // 4. Maintenance en retard
  const maintenanceFactor = factors.find(f => f.id === 'maintenance');
  if (maintenanceFactor && maintenanceFactor.score < 50) {
    recs.push({
      id: 'maintenance-late',
      priority: 'important',
      title: 'Maintenance en retard',
      description: maintenanceFactor.detail + `. Planning: ${pg.ascenseur?.nb_visites_an || '?'} visites/an.`,
      icon: '⏰', color: '#CA8A04',
    });
  }

  // 5. Erreurs IoT récurrentes
  if (s4.errors.length >= 5) {
    // Regrouper par code
    const byCode: Record<string, number> = {};
    s4.errors.forEach(e => { byCode[e.content] = (byCode[e.content] || 0) + 1; });
    const topError = Object.entries(byCode).sort((a, b) => b[1] - a[1])[0];
    if (topError && topError[1] >= 3) {
      const errInfo = lookupErrorCode(topError[0]);
      recs.push({
        id: 'recurring-error',
        priority: 'important',
        title: `Erreur récurrente: ${errInfo?.descFr || topError[0]}`,
        description: `Code ${topError[0]} apparaît ${topError[1]}× en 30 jours. Investiguer la cause racine.`,
        icon: '🔁', color: '#8B5CF6',
        actionLabel: 'Voir erreurs', actionModule: 'sigma4',
      });
    }
  }

  // 6. Pas de lien S4L ↔ Progilift
  if (s4.lift && !s4.linked && pg.ascenseur) {
    recs.push({
      id: 'link-missing',
      priority: 'info',
      title: 'Liaison IoT ↔ Progilift non confirmée',
      description: 'Le rapprochement est automatique. Vérifier et confirmer le lien dans le module IoT.',
      icon: '🔗', color: '#3B82F6',
    });
  }

  // 7. Pas d'IoT du tout
  if (!s4.lift && pg.ascenseur) {
    recs.push({
      id: 'no-iot',
      priority: 'info',
      title: 'Pas de supervision IoT',
      description: 'Cet ascenseur n\'est pas connecté à Sigma4. L\'ajout d\'un boîtier permettrait la supervision temps réel.',
      icon: '📡', color: '#64748B',
    });
  }

  // 8. Trafic anormal (si données)
  if (s4.traffic.length >= 7) {
    const recent = s4.traffic.slice(-7);
    const avgDaily = recent.reduce((a, t) => a + t.total, 0) / recent.length;
    const lastDay = recent[recent.length - 1];
    if (lastDay && avgDaily > 0 && lastDay.total < avgDaily * 0.3) {
      recs.push({
        id: 'low-traffic',
        priority: 'info',
        title: 'Trafic anormalement bas',
        description: `${lastDay.total} courses hier vs moyenne ${avgDaily.toFixed(0)}/jour. L'ascenseur est peut-être peu utilisé ou en panne partielle.`,
        icon: '📉', color: '#CA8A04',
      });
    }
  }

  // Trier par priorité
  const priorityOrder: Record<string, number> = { urgent: 0, important: 1, info: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs;
}

// ═══ UTILITAIRES EXPORT ═══

/** Couleur du score santé */
export function healthColor(score: number): string {
  if (score >= 80) return '#059669';
  if (score >= 60) return '#CA8A04';
  if (score >= 40) return '#EA580C';
  return '#DC2626';
}

/** Label du score santé */
export function healthLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Bon';
  if (score >= 55) return 'Moyen';
  if (score >= 35) return 'Dégradé';
  return 'Critique';
}

/** Durée depuis une date en texte lisible */
export function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}j`;
  const m = Math.floor(d / 30);
  return `${m} mois`;
}
