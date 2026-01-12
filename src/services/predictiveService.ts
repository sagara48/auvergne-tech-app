/**
 * Service d'Analyse Prédictive des Pannes
 * Utilise l'historique pour prédire les futures pannes
 */

import { supabase } from './supabase';

export interface PredictionPanne {
  ascenseurId: string;
  codeAppareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  scoreRisque: number; // 0-100
  niveau: 'critique' | 'eleve' | 'moyen' | 'faible';
  probabilitePanne7j: number;
  probabilitePanne30j: number;
  dernierePanne?: Date;
  nombrePannes30j: number;
  nombrePannes90j: number;
  facteurs: Array<{
    facteur: string;
    impact: number; // -100 à +100
    description: string;
    type: 'risque' | 'protection';
  }>;
  tendance: 'hausse' | 'stable' | 'baisse';
  recommandations: string[];
  prochaineVisite?: string;
  pannesRecurrentes?: Array<{
    type: string;
    count: number;
    derniere: Date;
  }>;
}

export interface AnalyseGlobale {
  scoreGlobal: number;
  ascenseursACritiquer: number;
  ascenseursAEleveRisque: number;
  tendanceGenerale: 'amelioration' | 'stable' | 'degradation';
  predictions: PredictionPanne[];
  alertes: Array<{
    type: string;
    message: string;
    ascenseurs: string[];
    priorite: 'haute' | 'moyenne' | 'basse';
  }>;
}

// Poids des facteurs de risque
const FACTEURS_RISQUE = {
  // Facteurs augmentant le risque
  panneRecente: { poids: 25, description: 'Panne dans les 7 derniers jours' },
  pannesFrequentes: { poids: 30, description: 'Plus de 3 pannes en 30 jours' },
  panneRecurrente: { poids: 35, description: 'Même type de panne répété' },
  ascenseurAncien: { poids: 15, description: 'Installation > 20 ans' },
  enArret: { poids: 40, description: 'Actuellement en arrêt' },
  sansContrat: { poids: 20, description: 'Hors contrat de maintenance' },
  visitesEnRetard: { poids: 15, description: 'Visite planifiée en retard' },
  
  // Facteurs réduisant le risque
  visitesReguliers: { poids: -20, description: 'Visites régulières effectuées' },
  sousContrat: { poids: -15, description: 'Sous contrat de maintenance' },
  sansPanneRecente: { poids: -10, description: 'Aucune panne depuis 90 jours' },
  interventionPreventive: { poids: -25, description: 'Maintenance préventive récente' },
};

/**
 * Extraire la date depuis le format YYYYMMDD
 */
function parseDateYYYYMMDD(dateStr: string): Date | null {
  if (!dateStr || dateStr.length !== 8) return null;
  try {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  } catch {
    return null;
  }
}

/**
 * Calculer le score de risque pour un ascenseur
 */
async function calculerScoreRisque(
  ascenseur: any,
  pannes: any[],
  visites: any[]
): Promise<PredictionPanne> {
  const now = new Date();
  const j7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const j30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const j90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Filtrer les vraies pannes (exclure visites cause=99 et contrôles cause=0)
  const vraisPannes = pannes.filter(p => {
    const data = p.data_wpanne || {};
    const cause = data.CAUSE || p.cause;
    return cause !== '99' && cause !== '0' && cause !== 99 && cause !== 0;
  });
  
  // Extraire les dates des pannes
  const pannesAvecDates = vraisPannes.map(p => {
    const data = p.data_wpanne || {};
    const dateStr = String(data.DATE || '');
    return {
      ...p,
      datePanne: parseDateYYYYMMDD(dateStr),
      type: data.ENSEMBLE || data.PANNES || 'Inconnu'
    };
  }).filter(p => p.datePanne);
  
  // Compter les pannes par période
  const pannes7j = pannesAvecDates.filter(p => p.datePanne! >= j7).length;
  const pannes30j = pannesAvecDates.filter(p => p.datePanne! >= j30).length;
  const pannes90j = pannesAvecDates.filter(p => p.datePanne! >= j90).length;
  
  // Dernière panne
  const dernierePanne = pannesAvecDates.length > 0 
    ? pannesAvecDates.sort((a, b) => b.datePanne!.getTime() - a.datePanne!.getTime())[0].datePanne
    : undefined;
  
  // Détecter les pannes récurrentes
  const pannesParType: Record<string, { count: number; derniere: Date }> = {};
  pannesAvecDates.filter(p => p.datePanne! >= j90).forEach(p => {
    const type = p.type;
    if (!pannesParType[type]) {
      pannesParType[type] = { count: 0, derniere: p.datePanne! };
    }
    pannesParType[type].count++;
    if (p.datePanne! > pannesParType[type].derniere) {
      pannesParType[type].derniere = p.datePanne!;
    }
  });
  
  const pannesRecurrentes = Object.entries(pannesParType)
    .filter(([, v]) => v.count >= 2)
    .map(([type, v]) => ({ type, count: v.count, derniere: v.derniere }))
    .sort((a, b) => b.count - a.count);
  
  // Calculer les facteurs de risque
  const facteurs: PredictionPanne['facteurs'] = [];
  let scoreBase = 20; // Score de base
  
  // Panne récente (7j)
  if (pannes7j > 0) {
    facteurs.push({
      facteur: 'Panne récente',
      impact: FACTEURS_RISQUE.panneRecente.poids * pannes7j,
      description: `${pannes7j} panne(s) dans les 7 derniers jours`,
      type: 'risque'
    });
    scoreBase += FACTEURS_RISQUE.panneRecente.poids * pannes7j;
  }
  
  // Pannes fréquentes (30j)
  if (pannes30j >= 3) {
    facteurs.push({
      facteur: 'Pannes fréquentes',
      impact: FACTEURS_RISQUE.pannesFrequentes.poids,
      description: `${pannes30j} pannes en 30 jours (seuil: 3)`,
      type: 'risque'
    });
    scoreBase += FACTEURS_RISQUE.pannesFrequentes.poids;
  }
  
  // Pannes récurrentes
  if (pannesRecurrentes.length > 0) {
    const principale = pannesRecurrentes[0];
    facteurs.push({
      facteur: 'Panne récurrente détectée',
      impact: FACTEURS_RISQUE.panneRecurrente.poids,
      description: `"${principale.type}" - ${principale.count} fois en 90 jours`,
      type: 'risque'
    });
    scoreBase += FACTEURS_RISQUE.panneRecurrente.poids;
  }
  
  // En arrêt
  if (ascenseur.en_arret) {
    facteurs.push({
      facteur: 'Actuellement en arrêt',
      impact: FACTEURS_RISQUE.enArret.poids,
      description: 'Ascenseur actuellement hors service',
      type: 'risque'
    });
    scoreBase += FACTEURS_RISQUE.enArret.poids;
  }
  
  // Sans contrat
  if (!ascenseur.type_planning) {
    facteurs.push({
      facteur: 'Hors contrat',
      impact: FACTEURS_RISQUE.sansContrat.poids,
      description: 'Pas de contrat de maintenance',
      type: 'risque'
    });
    scoreBase += FACTEURS_RISQUE.sansContrat.poids;
  } else {
    facteurs.push({
      facteur: 'Sous contrat',
      impact: FACTEURS_RISQUE.sousContrat.poids,
      description: `Contrat: ${ascenseur.type_planning}`,
      type: 'protection'
    });
    scoreBase += FACTEURS_RISQUE.sousContrat.poids;
  }
  
  // Sans panne récente (bonus)
  if (pannes90j === 0) {
    facteurs.push({
      facteur: 'Aucune panne récente',
      impact: FACTEURS_RISQUE.sansPanneRecente.poids,
      description: 'Aucune panne depuis 90 jours',
      type: 'protection'
    });
    scoreBase += FACTEURS_RISQUE.sansPanneRecente.poids;
  }
  
  // Visites régulières
  const visitesRecentes = visites.filter(v => {
    const data = v.data_wpanne || {};
    const dateStr = String(data.DATE || '');
    const dateVisite = parseDateYYYYMMDD(dateStr);
    return dateVisite && dateVisite >= j90;
  });
  
  if (visitesRecentes.length >= 2) {
    facteurs.push({
      facteur: 'Maintenance régulière',
      impact: FACTEURS_RISQUE.visitesReguliers.poids,
      description: `${visitesRecentes.length} visites en 90 jours`,
      type: 'protection'
    });
    scoreBase += FACTEURS_RISQUE.visitesReguliers.poids;
  }
  
  // Limiter le score entre 0 et 100
  const scoreRisque = Math.max(0, Math.min(100, scoreBase));
  
  // Déterminer le niveau
  let niveau: PredictionPanne['niveau'];
  if (scoreRisque >= 70) niveau = 'critique';
  else if (scoreRisque >= 50) niveau = 'eleve';
  else if (scoreRisque >= 30) niveau = 'moyen';
  else niveau = 'faible';
  
  // Calculer les probabilités
  const probabilitePanne7j = Math.min(95, scoreRisque * 0.8 + pannes7j * 15);
  const probabilitePanne30j = Math.min(98, scoreRisque * 1.2 + pannes30j * 10);
  
  // Tendance (comparer 30j vs 30-60j)
  const j60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const pannes30_60j = pannesAvecDates.filter(p => p.datePanne! >= j60 && p.datePanne! < j30).length;
  let tendance: PredictionPanne['tendance'] = 'stable';
  if (pannes30j > pannes30_60j + 1) tendance = 'hausse';
  else if (pannes30j < pannes30_60j - 1) tendance = 'baisse';
  
  // Recommandations
  const recommandations: string[] = [];
  
  if (scoreRisque >= 70) {
    recommandations.push('🚨 Intervention préventive urgente recommandée');
  }
  if (pannesRecurrentes.length > 0) {
    recommandations.push(`🔄 Investiguer la cause racine de "${pannesRecurrentes[0].type}"`);
  }
  if (ascenseur.en_arret) {
    recommandations.push('⚠️ Prioriser la remise en service');
  }
  if (!ascenseur.type_planning) {
    recommandations.push('📋 Proposer un contrat de maintenance');
  }
  if (pannes30j >= 3) {
    recommandations.push('📊 Analyser les patterns de pannes');
  }
  if (recommandations.length === 0) {
    recommandations.push('✅ Continuer la maintenance préventive régulière');
  }
  
  return {
    ascenseurId: ascenseur.id,
    codeAppareil: ascenseur.code_appareil,
    adresse: ascenseur.adresse,
    ville: ascenseur.ville,
    secteur: ascenseur.secteur,
    scoreRisque: Math.round(scoreRisque),
    niveau,
    probabilitePanne7j: Math.round(probabilitePanne7j),
    probabilitePanne30j: Math.round(probabilitePanne30j),
    dernierePanne,
    nombrePannes30j: pannes30j,
    nombrePannes90j: pannes90j,
    facteurs,
    tendance,
    recommandations,
    pannesRecurrentes: pannesRecurrentes.length > 0 ? pannesRecurrentes : undefined
  };
}

/**
 * Analyser tous les ascenseurs et générer des prédictions
 */
export async function analyserParcComplet(secteurs?: number[]): Promise<AnalyseGlobale> {
  try {
    // Récupérer les ascenseurs
    let query = supabase.from('parc_ascenseurs').select('*');
    if (secteurs && secteurs.length > 0) {
      query = query.in('secteur', secteurs);
    }
    const { data: ascenseurs, error: errAsc } = await query;
    
    if (errAsc || !ascenseurs) {
      throw new Error('Erreur récupération ascenseurs');
    }
    
    // Récupérer toutes les pannes
    const { data: pannes, error: errPannes } = await supabase
      .from('parc_pannes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (errPannes) {
      throw new Error('Erreur récupération pannes');
    }
    
    // Grouper les pannes par ascenseur
    const pannesParAscenseur: Record<string, any[]> = {};
    (pannes || []).forEach(p => {
      const key = String(p.id_wsoucont);
      if (!pannesParAscenseur[key]) pannesParAscenseur[key] = [];
      pannesParAscenseur[key].push(p);
    });
    
    // Séparer visites et pannes
    const visitesParAscenseur: Record<string, any[]> = {};
    Object.entries(pannesParAscenseur).forEach(([key, items]) => {
      visitesParAscenseur[key] = items.filter(p => {
        const data = p.data_wpanne || {};
        return String(data.CAUSE) === '99';
      });
    });
    
    // Calculer les prédictions
    const predictions: PredictionPanne[] = [];
    
    for (const ascenseur of ascenseurs) {
      const pannesAsc = pannesParAscenseur[String(ascenseur.id_wsoucont)] || [];
      const visitesAsc = visitesParAscenseur[String(ascenseur.id_wsoucont)] || [];
      
      const prediction = await calculerScoreRisque(ascenseur, pannesAsc, visitesAsc);
      predictions.push(prediction);
    }
    
    // Trier par score de risque décroissant
    predictions.sort((a, b) => b.scoreRisque - a.scoreRisque);
    
    // Statistiques globales
    const ascenseursACritiquer = predictions.filter(p => p.niveau === 'critique').length;
    const ascenseursAEleveRisque = predictions.filter(p => p.niveau === 'eleve').length;
    const scoreGlobal = predictions.length > 0
      ? Math.round(predictions.reduce((sum, p) => sum + p.scoreRisque, 0) / predictions.length)
      : 0;
    
    // Tendance générale
    const enHausse = predictions.filter(p => p.tendance === 'hausse').length;
    const enBaisse = predictions.filter(p => p.tendance === 'baisse').length;
    let tendanceGenerale: AnalyseGlobale['tendanceGenerale'] = 'stable';
    if (enHausse > enBaisse * 1.5) tendanceGenerale = 'degradation';
    else if (enBaisse > enHausse * 1.5) tendanceGenerale = 'amelioration';
    
    // Générer les alertes
    const alertes: AnalyseGlobale['alertes'] = [];
    
    if (ascenseursACritiquer > 0) {
      alertes.push({
        type: 'critique',
        message: `${ascenseursACritiquer} ascenseur(s) en risque critique`,
        ascenseurs: predictions.filter(p => p.niveau === 'critique').map(p => p.codeAppareil),
        priorite: 'haute'
      });
    }
    
    // Pannes récurrentes globales
    const ascenseursAvecRecurrence = predictions.filter(p => p.pannesRecurrentes && p.pannesRecurrentes.length > 0);
    if (ascenseursAvecRecurrence.length > 0) {
      alertes.push({
        type: 'recurrence',
        message: `${ascenseursAvecRecurrence.length} ascenseur(s) avec pannes récurrentes`,
        ascenseurs: ascenseursAvecRecurrence.map(p => p.codeAppareil),
        priorite: 'moyenne'
      });
    }
    
    return {
      scoreGlobal,
      ascenseursACritiquer,
      ascenseursAEleveRisque,
      tendanceGenerale,
      predictions,
      alertes
    };
  } catch (error) {
    console.error('Erreur analyse prédictive:', error);
    return {
      scoreGlobal: 0,
      ascenseursACritiquer: 0,
      ascenseursAEleveRisque: 0,
      tendanceGenerale: 'stable',
      predictions: [],
      alertes: []
    };
  }
}

/**
 * Obtenir la prédiction pour un ascenseur spécifique
 */
export async function getPredictionAscenseur(codeAppareil: string): Promise<PredictionPanne | null> {
  try {
    const { data: ascenseur } = await supabase
      .from('parc_ascenseurs')
      .select('*')
      .eq('code_appareil', codeAppareil)
      .single();
    
    if (!ascenseur) return null;
    
    const { data: pannes } = await supabase
      .from('parc_pannes')
      .select('*')
      .eq('id_wsoucont', ascenseur.id_wsoucont)
      .order('created_at', { ascending: false });
    
    const visites = (pannes || []).filter(p => {
      const data = p.data_wpanne || {};
      return String(data.CAUSE) === '99';
    });
    
    return calculerScoreRisque(ascenseur, pannes || [], visites);
  } catch (error) {
    console.error('Erreur prédiction ascenseur:', error);
    return null;
  }
}
