// ═══════════════════════════════════════════════════════════════
// SIGMA4LIFTS — Base de codes d'erreur
// Extrait du bundle S4L : ~120 codes principaux FR + lookup
// Familles : ECO (ecoGO), F (affichage armoire), MBA, V, VSE
// ═══════════════════════════════════════════════════════════════

export interface S4LErrorCode {
  code: string;
  family: string;
  description: string;
  cause?: string;
  help?: string;
  severity?: 'fatal_local' | 'fatal_remote' | 'leve' | 'info';
}

// ── NIVEAUX DE SÉVÉRITÉ ──

export const SEVERITY_LEVELS = {
  fatal_local:  { label: 'Arrêt — Réinit. locale',      color: '#DC2626', icon: '🔴', short: 'Fatal local' },
  fatal_remote: { label: 'Arrêt — Réinit. à distance',   color: '#EA580C', icon: '🟠', short: 'Fatal remote' },
  leve:         { label: 'Arrêt — Réinit. automatique',   color: '#CA8A04', icon: '🟡', short: 'Leve (auto)' },
  info:         { label: 'Informatif',                     color: '#3B82F6', icon: '🔵', short: 'Info' },
} as const;

export type SeverityKey = keyof typeof SEVERITY_LEVELS;

// ── CATÉGORIES DE CAUSES (TYPOLOGIES SMART PREVENTIVE) ──

export const CAUSA_CATEGORIES: Record<string, { label: string; domain: string }> = {
  SERIE_ABIERTA_EN_MOV:      { label: 'Ouverture porte en déplacement',        domain: 'Sécurité / Portes' },
  SERIE_PUERTAS:             { label: 'Contacts portes chaîne sécurité',       domain: 'Sécurité / Portes' },
  SERIE_CERROJOS:            { label: 'Contacts verrouillages chaîne sécurité', domain: 'Sécurité / Verrouillages' },
  CONTACTOR_PEGADO:          { label: 'Contacteur collé',                       domain: 'Électrique' },
  LIMITADOR_VELOCIDAD:       { label: 'Limiteur de vitesse',                    domain: 'Sécurité mécanique' },
  MAX_TIEMPO_RECORRIDO:      { label: 'Temps max parcours dépassé',             domain: 'Mécanique / Variateur' },
  PAP:                       { label: 'Bouton ouvre-portes',                     domain: 'Portes' },
  FINAL_CARRERA:             { label: 'Fin de course',                          domain: 'Sécurité mécanique' },
  SOBRECARGA:                { label: 'Surcharge',                              domain: 'Pesage' },
  SENSOR_TEMPERATURA_FST:    { label: 'Capteur température',                    domain: 'Environnement' },
  SENSOR_TEMPERATURA_FSP:    { label: 'Pressostat',                             domain: 'Hydraulique' },
  SIN_TENSION:               { label: 'Coupure tension / Phase monitor',        domain: 'Alimentation' },
  ERROR_COMUNICACION_SMQ_CAB:{ label: 'Erreur comm. SMQ-CAB',                   domain: 'Communication' },
  ERROR_CONFIGURACION_SMQ_CAB:{ label: 'Erreur config. SMQ-CAB',                domain: 'Configuration' },
  ERROR_LECTURA_PARAMETROS:  { label: 'Erreur lecture paramètres',              domain: 'Paramétrage' },
  PROGRAMACION:              { label: 'Erreur programmation',                   domain: 'Configuration' },
  ANTIDERIVA:                { label: 'Antidérive (capteur 538 / F26)',         domain: 'Nivelage' },
  BOMBERO_C:                 { label: 'Alarme incendie cabine',                 domain: 'Incendie' },
  BOMBERO_H:                 { label: 'Alarme incendie gaine',                  domain: 'Incendie' },
  SERIE_BOMBEROS:            { label: 'Circuit incendies',                      domain: 'Incendie' },
  INSPECCION:                { label: 'Mode inspection',                        domain: 'Maintenance' },
  RESCATE_DSP:               { label: 'Secours DSP',                           domain: 'Secours' },
  STOP:                      { label: 'Arrêt d\'urgence (STOP)',               domain: 'Sécurité' },
  VIP:                       { label: 'Mode VIP',                              domain: 'Modes spéciaux' },
  EAT:                       { label: 'Erreur antéfinales',                     domain: 'Sécurité mécanique' },
  SIN_ERRORES:               { label: 'Sans erreurs',                          domain: '—' },
  GENERAL:                   { label: 'Erreur générale',                       domain: 'Divers' },
  ESPECIAL:                  { label: 'Erreur spéciale',                       domain: 'Divers' },
};

// ── BASE DE CODES ──
// Extraits du bundle S4L (8582 codes au total, sélection des plus courants FR)

const ERROR_DB: S4LErrorCode[] = [
  // ═══ ECO 01xx — Chaîne de sécurité ═══
  { code: 'ECO001002000', family: 'ECO', severity: 'fatal_local', description: 'Ouverture de l\'un des contacts de la chaîne de sécurité', cause: 'La chaîne de sécurité est ouverte avant le point 40.' },
  { code: 'ECO001003000', family: 'ECO', severity: 'fatal_local', description: 'Ascenseur à l\'arrêt après détection erreur 0102 (hydrauliques)', cause: 'Après ouverture avant point 40, cabine stationne porte fermée au plus bas.' },
  { code: 'ECO001009000', family: 'ECO', severity: 'fatal_local', description: 'Défaillance alimentation 110 Vs', cause: 'Manque d\'alimentation 110 Vs sur la carte SASE.' },
  { code: 'ECO001020000', family: 'ECO', severity: 'fatal_local', description: 'Contact du limiteur de vitesse activé', cause: 'Vitesse supérieure à la vitesse max autorisée détectée.' },
  { code: 'ECO001021000', family: 'ECO', severity: 'fatal_local', description: 'Surveillance bobine limiteur ne change pas (bobine désactivée)', cause: 'Entrée de monitoring mal configurée ou contact ne revient pas au repos.' },
  { code: 'ECO001026000', family: 'ECO', severity: 'fatal_local', description: 'Défaillance carte système de régénération' },
  { code: 'ECO001029000', family: 'ECO', severity: 'fatal_local', description: 'Mouvements incontrôlés de la cabine', cause: 'Cabine traverse la zone de déverrouillage portes ouvertes sans s\'arrêter.' },
  { code: 'ECO001030000', family: 'ECO', severity: 'fatal_local', description: 'Défaillance système surveillance EN 81-1/2+A3', cause: 'Variateur informe d\'un défaut circuit monitoring frein.' },
  { code: 'ECO001091000', family: 'ECO', severity: 'fatal_local', description: 'Activation signal capteur de séisme', cause: 'Capteur séisme activé. Vérifier paramètres 60-63 dossier E/S MCB.' },

  // ═══ ECO 02xx — Portes en mouvement ═══
  { code: 'ECO002006000', family: 'ECO', severity: 'fatal_local', description: 'Ouverture shunts portes palières en marche', cause: 'Ouverture des shunts de portes (point 70H) pendant déplacement.' },
  { code: 'ECO002007000', family: 'ECO', severity: 'fatal_local', description: 'Circuit sécurité verrouillages ouvert en marche (80H)', cause: 'Ouverture chaîne verrouillages (point 80H) pendant déplacement.' },
  { code: 'ECO002008000', family: 'ECO', severity: 'fatal_local', description: 'Circuit sécurité verrouillages cabine ouvert en marche (90H)', cause: 'Ouverture chaîne verrouillages (points 90H) pendant déplacement.' },
  { code: 'ECO002009000', family: 'ECO', severity: 'leve', description: 'Fins de course fermeture/ouverture porte ouverts simultanément (triphasé)' },

  // ═══ ECO 03xx — Portes à l'arrêt ═══
  { code: 'ECO003005000', family: 'ECO', severity: 'fatal_remote', description: 'Défaut répétitif fermeture contact verrous 90C', cause: 'Fermeture contact verrous non détectée après tentatives répétées.' },
  { code: 'ECO003055000', family: 'ECO', severity: 'fatal_local', description: 'Commutation shunts verrouillages 70-80-90 non détectée après recalage' },
  { code: 'ECO003056000', family: 'ECO', severity: 'fatal_local', description: 'Contact monitoring porte cabine (XMPC) détérioré ou ponté' },
  { code: 'ECO003058000', family: 'ECO', severity: 'fatal_local', description: 'Contact relais K9095 collé en position NF' },
  { code: 'ECO003059000', family: 'ECO', severity: 'leve', description: 'Détection blocage portes — 1 déplacement supplémentaire autorisé' },

  // ═══ ECO 06xx — Communication / Variateur ═══
  { code: 'ECO006004000', family: 'ECO', severity: 'fatal_local', description: 'Contacteur collé' },
  { code: 'ECO006018000', family: 'ECO', severity: 'fatal_local', description: 'Défaut communication variateur 3VF', cause: 'Vérifier paramètres lecture signaux ZD/ZS dans dossier Variateur.' },
  { code: 'ECO006020000', family: 'ECO', severity: 'fatal_local', description: 'Reset manuel requis après erreur' },
  { code: 'ECO006040000', family: 'ECO', severity: 'fatal_local', description: 'Pressostat pression max ou min' },
  { code: 'ECO006046000', family: 'ECO', severity: 'fatal_local', description: 'Fosse inondée' },

  // ═══ ECO 09xx — Configuration ═══
  { code: 'ECO009001000', family: 'ECO', severity: 'info', description: 'Carte EXT-CALL de l\'armoire non détectée' },
  { code: 'ECO009015000', family: 'ECO', severity: 'info', description: 'Paramètre variateur mal configuré', help: 'Réinitialiser le variateur. Vérifier quel paramètre est mal configuré.' },
  { code: 'ECO009017005', family: 'ECO', severity: 'info', description: 'Config. fonctionnement sans batteries', help: 'Modifier paramètre 153 → valeur "Non".' },
  { code: 'ECO009017006', family: 'ECO', severity: 'info', description: 'Config. norme EN 81-28', help: 'Modifier paramètre 184 → "Habilitée EN 81-28 version 2018".' },

  // ═══ ECO 025/026 — Communication/SIM ═══
  { code: 'ECO025001001', family: 'ECO', severity: 'info', description: 'Carte SIM mal insérée', cause: 'La carte SIM n\'est pas correctement insérée.' },
  { code: 'ECO026001050', family: 'ECO', severity: 'info', description: 'Carte microSD mal insérée', help: 'S\'assurer que la carte microSD est correctement insérée.' },

  // ═══ ECO 000 ═══
  { code: 'ECO000000000', family: 'ECO', severity: 'info', description: 'L\'ascenseur fonctionne correctement' },

  // ═══ Fxxxx — Codes affichage armoire ═══
  { code: 'F0000', family: 'NUM', severity: 'info', description: 'Sans erreurs' },
  { code: 'F0102', family: 'NUM', severity: 'fatal_local', description: 'Chaîne de sécurité ouverte', cause: 'La chaîne de sécurité s\'est ouverte entre 1H et 3C.' },
  { code: 'F0103', family: 'NUM', severity: 'fatal_local', description: 'Stationnement après fin de course (hydrauliques)' },
  { code: 'F0109', family: 'NUM', severity: 'fatal_local', description: 'Défaut tension 110Vs (fusible TRM, défaut phases KVF)' },
  { code: 'F0120', family: 'NUM', severity: 'fatal_local', description: 'Limiteur de vitesse', cause: 'Déplacement à vitesse > max autorisée.' },
  { code: 'F0129', family: 'NUM', severity: 'fatal_local', description: 'Mouvement incontrôlé de la cabine' },
  { code: 'F0130', family: 'NUM', severity: 'fatal_local', description: 'Contact collé système surveillance A3' },
  { code: 'F0206', family: 'NUM', severity: 'fatal_local', description: 'Shunts portes palières ouverts pendant marche' },
  { code: 'F0207', family: 'NUM', severity: 'fatal_local', description: 'Portes déverrouillées pendant marche' },
  { code: 'F0305', family: 'NUM', severity: 'fatal_remote', description: 'Défaut répétitif fermeture verrous paliers/cabine' },
  { code: 'F0355', family: 'NUM', severity: 'fatal_local', description: 'Verrouillages shuntés après recalage' },
  { code: 'F0401', family: 'NUM', severity: 'leve', description: 'Temps maximum de parcours dépassé' },
  { code: 'F0501', family: 'NUM', severity: 'leve', description: 'Surcharge' },
  { code: 'F0502', family: 'NUM', severity: 'fatal_local', description: 'Défaut variateur de fréquence' },
  { code: 'F0601', family: 'NUM', severity: 'fatal_local', description: 'Défaut communication armoire-variateur' },
  { code: 'F0901', family: 'NUM', severity: 'info', description: 'Défaut de configuration' },

  // ═══ MBA — MP Board A ═══
  { code: 'MBA002', family: 'MBA', severity: 'fatal_local', description: 'Ascenseur hors course ou chaîne primaire ouverte', cause: 'Ouverture chaîne entre bornes 102-220 ou 220-103.' },
  { code: 'MBA003', family: 'MBA', severity: 'fatal_local', description: 'Arrêt après actionnement fin de course (hydrauliques)' },
  { code: 'MBA004', family: 'MBA', severity: 'fatal_local', description: 'Contacteur collé', cause: 'À l\'arrêt porte ouverte, manque tension bornes 3 ou 4.' },
  { code: 'MBA005', family: 'MBA', severity: 'fatal_remote', description: 'Défauts répétés fermeture contacteur porte cabine', cause: 'Fermeture verrous 104-105-106 non détectée après tentatives.' },
  { code: 'MBA006', family: 'MBA', severity: 'fatal_local', description: 'Ouverture shunts de portes en marche', cause: 'Ouverture borne 103 pendant déplacement.' },
  { code: 'MBA007', family: 'MBA', severity: 'fatal_local', description: 'Ouverture verrouillages paliers en marche', cause: 'Ouverture bornes 104-105-106 pendant déplacement.' },
  { code: 'MBA009', family: 'MBA', severity: 'fatal_local', description: 'Fusibles armoire (FM) ou alimentation (FF) fondus' },
  { code: 'MBA011', family: 'MBA', severity: 'leve', description: 'Shunts de portes ouverts > 45 secondes', cause: 'Porte battante restée ouverte (borne 103).' },
  { code: 'MBA013', family: 'MBA', severity: 'fatal_local', description: 'Cabine à niveau intermédiaire, ouverture anormale ralentissement' },
  { code: 'MBA017', family: 'MBA', severity: 'info', description: 'Défaut de paramétrage', cause: 'Possible détérioration mémoire E2PROM.' },
  { code: 'MBA018', family: 'MBA', severity: 'fatal_local', description: 'Défaut variateur de fréquence', cause: 'Contacteurs non activés après ordre de marche.' },
  { code: 'MBA026', family: 'MBA', severity: 'fatal_local', description: 'Défaut signal CPS', cause: 'Signal CPS (carte 538) disparu après service.' },
  { code: 'MBA028', family: 'MBA', severity: 'fatal_local', description: 'Pressostat pression max/min', cause: 'Pression inadéquate groupe hydraulique.' },
  { code: 'MBA055', family: 'MBA', severity: 'fatal_local', description: 'Verrouillages shuntés après recalage', cause: 'Commutation bornes 104-105-106 non détectée.' },

  // ═══ V — Variateur de fréquence ═══
  { code: 'V8192', family: 'V', severity: 'fatal_local', description: 'Surcourant (Overcurrent)' },
  { code: 'V8193', family: 'V', severity: 'fatal_local', description: 'Défaut de terre (Ground fault)' },
  { code: 'V8194', family: 'V', severity: 'fatal_local', description: 'Surtension (Overvoltage)' },
  { code: 'V8195', family: 'V', severity: 'fatal_local', description: 'Sous-tension (Undervoltage)' },
  { code: 'V8196', family: 'V', severity: 'fatal_local', description: 'Perte de phase entrée' },
  { code: 'V8197', family: 'V', severity: 'fatal_local', description: 'Perte de phase sortie' },
  { code: 'V8198', family: 'V', severity: 'fatal_local', description: 'Fusible grillé' },
  { code: 'V8199', family: 'V', severity: 'fatal_local', description: 'Défaut circuit de charge' },
  { code: 'V8200', family: 'V', severity: 'fatal_local', description: 'Surchauffe' },
  { code: 'V8201', family: 'V', severity: 'leve', description: 'Alarme externe' },
  { code: 'V8202', family: 'V', severity: 'fatal_local', description: 'Protection moteur' },
  { code: 'V8203', family: 'V', severity: 'leve', description: 'Surcharge' },
  { code: 'V8204', family: 'V', severity: 'fatal_local', description: 'Survitesse' },
  { code: 'V8205', family: 'V', severity: 'fatal_local', description: 'Perte de commande' },
  { code: 'V8206', family: 'V', severity: 'info', description: 'Thermistance détectée' },
  { code: 'V8207', family: 'V', severity: 'info', description: 'Avertissement durée de vie variateur' },
  { code: 'V12288', family: 'V', severity: 'fatal_local', description: 'Erreur déconnexion' },
  { code: 'V12289', family: 'V', severity: 'fatal_local', description: 'Erreur mémoire' },
  { code: 'V12291', family: 'V', severity: 'fatal_local', description: 'Erreur CPU' },
  { code: 'V12292', family: 'V', severity: 'fatal_local', description: 'Erreur communication' },
  { code: 'V12295', family: 'V', severity: 'fatal_local', description: 'Erreur matériel (Hardware)' },
  { code: 'V12297', family: 'V', severity: 'info', description: 'Erreur durée de vie machine' },

  // ═══ VSE — Variateur chaîne de sécurité ═══
  { code: 'VSE001002', family: 'VSE', severity: 'fatal_local', description: 'Chaîne de sécurité ouverte' },
  { code: 'VSE001020', family: 'VSE', severity: 'fatal_local', description: 'Limiteur de vitesse' },
  { code: 'VSE001029', family: 'VSE', severity: 'fatal_local', description: 'Mouvement incontrôlé cabine (installations A3)' },
  { code: 'VSE002006', family: 'VSE', severity: 'fatal_local', description: 'Shunts portes palières ouverts pendant marche' },
  { code: 'VSE003005', family: 'VSE', severity: 'fatal_remote', description: 'Défaut répétitif fermeture verrous' },
  { code: 'VSE003059', family: 'VSE', severity: 'leve', description: 'Blocage portes — 1 déplacement supplémentaire autorisé' },
  { code: 'VSE003060', family: 'VSE', severity: 'fatal_local', description: 'Pontage entre points (7C/H+8C/H)' },
  { code: 'VSE003061', family: 'VSE', severity: 'fatal_local', description: 'Pontage entre points (8H+9H)' },
  { code: 'VSE006018', family: 'VSE', severity: 'fatal_local', description: 'Défaut communication variateur 3VF' },
  { code: 'VSE006046', family: 'VSE', severity: 'fatal_local', description: 'Fosse inondée' },
  { code: 'VSE009001', family: 'VSE', severity: 'info', description: 'Carte EXT-CALL armoire non détectée' },
];

// ── INDEX & RECHERCHE ──

const _idx = new Map<string, S4LErrorCode>();
ERROR_DB.forEach(e => _idx.set(e.code, e));

/** Recherche exacte par code */
export function lookupErrorCode(code: string): S4LErrorCode | undefined {
  let r = _idx.get(code);
  if (r) return r;
  if (/^\d{4}$/.test(code)) r = _idx.get('F' + code);
  if (r) return r;
  if (code.startsWith('F')) r = _idx.get(code.slice(1));
  return r;
}

/** Recherche texte (code ou description) */
export function searchErrorCodes(query: string, limit = 50): S4LErrorCode[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ERROR_DB.filter(e =>
    e.code.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.cause?.toLowerCase().includes(q) ||
    e.help?.toLowerCase().includes(q)
  ).slice(0, limit);
}

/** Par famille */
export function getErrorsByFamily(family: string): S4LErrorCode[] {
  return ERROR_DB.filter(e => e.family === family);
}

/** Par sévérité */
export function getErrorsBySeverity(severity: string): S4LErrorCode[] {
  return ERROR_DB.filter(e => e.severity === severity);
}

/** Toute la base */
export function getAllErrorCodes(): S4LErrorCode[] { return [...ERROR_DB]; }

/** Stats */
export function getErrorStats() {
  const byFamily: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  ERROR_DB.forEach(e => {
    byFamily[e.family] = (byFamily[e.family] || 0) + 1;
    if (e.severity) bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
  });
  return { total: ERROR_DB.length, byFamily, bySeverity };
}
