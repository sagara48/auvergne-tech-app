// ═══════════════════════════════════════════════════════════════
// SIGMA4 LIFT STATES — Référentiel complet des états ascenseur
// Source: etats_ascenseurs_sigma4lift.xlsx (Sigma4Lift officiel)
// 46 états ascenseur + 17 états display
// ═══════════════════════════════════════════════════════════════

// ═══ CATÉGORIES ═══

export type EstadoCategory = 'normal' | 'attention' | 'critique' | 'special' | 'information' | 'connexion';

export interface EstadoConfig {
  code: number;
  label: string;           // Français
  labelEs: string;         // Español
  labelEn: string;         // English
  category: EstadoCategory;
  color: string;           // Couleur hex
  bgColor: string;         // Couleur fond (10% opacity)
  icon: string;            // Emoji/icône
  short: string;           // Label court (badge)
  pulse: boolean;          // Animation pulse
  priority: number;        // 0 = plus urgent, 5 = moins urgent
  description?: string;    // Description contextuelle
}

// ═══ COULEURS PAR CATÉGORIE ═══

export const CATEGORY_COLORS: Record<EstadoCategory, { color: string; bg: string; label: string; icon: string }> = {
  normal:      { color: '#059669', bg: '#059669', label: 'Normal',      icon: '✅' },
  attention:   { color: '#CA8A04', bg: '#CA8A04', label: 'Attention',   icon: '⚠️' },
  critique:    { color: '#DC2626', bg: '#DC2626', label: 'Critique',    icon: '🔴' },
  special:     { color: '#3B82F6', bg: '#3B82F6', label: 'Spécial',     icon: '🔧' },
  information: { color: '#64748B', bg: '#64748B', label: 'Information', icon: 'ℹ️' },
  connexion:   { color: '#EA580C', bg: '#EA580C', label: 'Connexion',   icon: '📡' },
};

// ═══ ÉTATS ASCENSEUR (46 codes) ═══

export const LIFT_STATES: EstadoConfig[] = [
  // ── Connexion ──
  { code: -1, label: 'Inconnu',                           labelEs: 'Desconocido',                              labelEn: 'Unknown',                               category: 'connexion',   color: '#64748B', bgColor: '#64748B15', icon: '❓', short: '?',       pulse: false, priority: 5, description: 'Code vide / état non reçu' },
  { code: 90, label: 'Sans connexion S4L',                labelEs: 'Sin conexión sigma4lift',                   labelEn: 'Without connection S4L',                 category: 'connexion',   color: '#EA580C', bgColor: '#EA580C15', icon: '📡', short: 'H.L.',    pulse: false, priority: 4, description: 'Aucune connexion avec le boîtier Sigma4Lift' },
  { code: 91, label: 'Pas de données / Config. incorrecte', labelEs: 'Sin datos / Configuración incorrecta',   labelEn: 'No data / Incorrect configuration',      category: 'connexion',   color: '#64748B', bgColor: '#64748B15', icon: '⚙️', short: 'N/D',     pulse: false, priority: 5, description: 'Boîtier présent mais pas de données ou mauvaise configuration' },

  // ── Normal ──
  { code: 0,  label: 'Normal',                            labelEs: 'Normal',                                   labelEn: 'Normal',                                 category: 'normal',      color: '#059669', bgColor: '#05966915', icon: '✅', short: 'OK',      pulse: false, priority: 5 },
  { code: 23, label: 'Normal — Télécommandé',             labelEs: 'Normal. Teleoperado',                      labelEn: 'Normal. Remote controlled',               category: 'normal',      color: '#059669', bgColor: '#05966915', icon: '📱', short: 'TÉLÉCOM', pulse: false, priority: 5 },
  { code: 31, label: 'Normal — Simulation d\'appels',     labelEs: 'Normal. Simulación de llamadas',           labelEn: 'Normal. Simulation of calls',             category: 'normal',      color: '#059669', bgColor: '#05966915', icon: '📞', short: 'SIMUL',   pulse: false, priority: 5 },
  { code: 32, label: 'Normal — Pré-reset après insp. cuvette', labelEs: 'Normal. Pre-reset tras inspección de foso', labelEn: 'Normal. Pre-reset after pit inspection', category: 'normal', color: '#059669', bgColor: '#05966915', icon: '🔄', short: 'PRE-RST', pulse: false, priority: 5 },

  // ── Attention ──
  { code: 2,   label: 'Normal avec anomalie',             labelEs: 'Normal con anomalía',                      labelEn: 'Normal with an anomaly',                 category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⚠️', short: 'ANOM',    pulse: false, priority: 3 },
  { code: 11,  label: 'Normal sous réserve',              labelEs: 'Normal con aviso',                         labelEn: 'Normal with warning',                    category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⚠️', short: 'RÉSERVE', pulse: false, priority: 3 },
  { code: 17,  label: 'Momentanément indisponible',       labelEs: 'No disponible temporalmente',              labelEn: 'Temporarily unavailable',                category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⏸️', short: 'INDISPO', pulse: false, priority: 2, description: 'Indisponible temporairement' },
  { code: 21,  label: 'Surcharge',                        labelEs: 'Sobrecarga',                               labelEn: 'Overload',                               category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⚖️', short: 'SURCH.',  pulse: true,  priority: 2 },
  { code: 51,  label: 'Warning SMQ',                      labelEs: 'Warning SMQ',                              labelEn: 'Warning SMQ',                            category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⚠️', short: 'W.SMQ',   pulse: false, priority: 3 },
  { code: 52,  label: 'Warning CAB',                      labelEs: 'Warning CAB',                              labelEn: 'Warning CAB',                            category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⚠️', short: 'W.CAB',   pulse: false, priority: 3 },
  { code: 105, label: 'Suspension non urgente',           labelEs: 'Suspensión no urgente',                    labelEn: 'Non Urgent Cancel',                      category: 'attention',   color: '#CA8A04', bgColor: '#CA8A0415', icon: '⏹️', short: 'SUSP.',   pulse: false, priority: 3 },

  // ── Critique ──
  { code: 1,   label: 'Secours',                          labelEs: 'Rescate',                                  labelEn: 'Rescue',                                 category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🆘', short: 'SOS',     pulse: true,  priority: 0, description: 'Personne bloquée en cabine' },
  { code: 9,   label: 'Incendies',                        labelEs: 'Incendios',                                labelEn: 'Fire',                                   category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🔥', short: 'FEU',     pulse: true,  priority: 0 },
  { code: 15,  label: 'Panne',                            labelEs: 'Avería',                                   labelEn: 'Breakdown',                              category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '❌', short: 'PANNE',   pulse: true,  priority: 0 },
  { code: 16,  label: 'Hors service — Activé sur place',  labelEs: 'Fuera de servicio, actuación local',       labelEn: 'Out of order. Locally performed',        category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🔴', short: 'H.S.LOC', pulse: true,  priority: 1 },
  { code: 24,  label: 'Hors service — Activé à distance', labelEs: 'Fuera de servicio, actuación remota',      labelEn: 'Lift out of order. Remotely performed',  category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🔴', short: 'H.S.REM', pulse: true,  priority: 1 },
  { code: 25,  label: 'MES alim. secours',                labelEs: 'MES emergencia',                           labelEn: 'MES emergency feeded',                   category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🔋', short: 'MES.SEC', pulse: true,  priority: 1 },
  { code: 28,  label: 'Sauvetage auto. insp. cuvette',    labelEs: 'Rescate automático inspección de foso',    labelEn: 'Auto rescue pit inspection',             category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🆘', short: 'SAUV.A',  pulse: true,  priority: 0 },
  { code: 34,  label: 'Contrôle d\'évacuation',           labelEs: 'Control de evacuación',                    labelEn: 'Evacuation control',                     category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🚨', short: 'ÉVAC.',   pulse: true,  priority: 0 },
  { code: 50,  label: 'Hors service',                     labelEs: 'Fuera de servicio',                        labelEn: 'Out of order',                           category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '⛔', short: 'H.S.',    pulse: true,  priority: 1 },
  { code: 100, label: 'Secours (alarme)',                  labelEs: 'Socorro',                                  labelEn: 'Emergency',                              category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🆘', short: 'SOS.ALM', pulse: true,  priority: 0, description: 'Alarme secours déclenchée' },
  { code: 102, label: 'Suspension d\'urgence',             labelEs: 'Suspensión urgente',                       labelEn: 'Urgent Cancel',                          category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🛑', short: 'SUSP.URG', pulse: true, priority: 0 },
  { code: 103, label: 'Blocage des portes',               labelEs: 'Bloqueo de puertas',                      labelEn: 'Door Blocked',                           category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🚪', short: 'PORTE.BLQ', pulse: true, priority: 1, description: 'Porte bloquée → intervention nécessaire' },
  { code: 104, label: 'Eau dans la fosse',                labelEs: 'Agua en foso',                             labelEn: 'Water In Pit',                           category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '💧', short: 'EAU.FOSS', pulse: true, priority: 0, description: 'Eau détectée dans la cuvette → urgence' },
  { code: 107, label: 'Évacuation',                       labelEs: 'Evacuación',                               labelEn: 'Evacuation',                             category: 'critique',    color: '#DC2626', bgColor: '#DC262615', icon: '🚨', short: 'ÉVAC.',   pulse: true,  priority: 0 },

  // ── Spécial (maintenance, inspection, modes techniques) ──
  { code: 3,   label: 'Inspection toit de cabine',        labelEs: 'Inspección techo cabina',                  labelEn: 'Car roof inspection',                    category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🔍', short: 'INSP.TC', pulse: false, priority: 4 },
  { code: 4,   label: 'Montage',                          labelEs: 'Montaje',                                  labelEn: 'Assembly',                               category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🔧', short: 'MONT.',   pulse: false, priority: 4 },
  { code: 5,   label: 'Apprentissage',                    labelEs: 'Aprendizaje',                              labelEn: 'Learning',                               category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '📚', short: 'APPREN.', pulse: false, priority: 4 },
  { code: 8,   label: 'MES',                              labelEs: 'MES',                                      labelEn: 'MES',                                    category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🛠️', short: 'MES',     pulse: false, priority: 4, description: 'Mise En Service' },
  { code: 18,  label: 'Service spécial',                  labelEs: 'Servicio especial',                        labelEn: 'Special service',                        category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '⚙️', short: 'SPÉCIAL', pulse: false, priority: 4 },
  { code: 22,  label: 'Maintenance — Console cabine',     labelEs: 'Mantenimiento. Cabina consola',            labelEn: 'Maintenance. Console car',               category: 'special',     color: '#8B5CF6', bgColor: '#8B5CF615', icon: '🔧', short: 'MAINT.',  pulse: false, priority: 3, description: 'Technicien en cabine via console' },
  { code: 26,  label: 'Inspection alim. secours',         labelEs: 'Inspección emergencia',                    labelEn: 'Inspection emergency feeded',            category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🔋', short: 'INSP.SEC', pulse: false, priority: 4 },
  { code: 27,  label: 'Inspection cuvette',               labelEs: 'Inspección foso',                          labelEn: 'Pit inspection',                         category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🕳️', short: 'INSP.CUV', pulse: false, priority: 4 },
  { code: 33,  label: 'Shabbat',                          labelEs: 'Shabbat',                                  labelEn: 'Shabbat',                                category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '✡️', short: 'SHAB.',   pulse: false, priority: 5 },
  { code: 101, label: 'Générateur',                       labelEs: 'Generador',                                labelEn: 'Generator',                              category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '⚡', short: 'GÉNÉR.',  pulse: false, priority: 3 },
  { code: 106, label: 'Priorité cabine',                  labelEs: 'Prioridad cabina',                         labelEn: 'Priority Car',                           category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '🔑', short: 'PRIO.CAB', pulse: false, priority: 4 },
  { code: 108, label: 'Annulation du générateur',         labelEs: 'Anulación generador',                      labelEn: 'Generator Shutdown',                     category: 'special',     color: '#3B82F6', bgColor: '#3B82F615', icon: '⚡', short: 'ANN.GÉN', pulse: false, priority: 4 },

  // ── Information ──
  { code: 6,   label: 'Standby',                          labelEs: 'Stand-by',                                 labelEn: 'Standby',                                category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '💤', short: 'STBY',    pulse: false, priority: 5 },
  { code: 7,   label: 'Reset de position',                labelEs: 'Reset de posición',                        labelEn: 'Position reset',                         category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '🔄', short: 'RESET',   pulse: false, priority: 4 },
  { code: 19,  label: 'Test',                             labelEs: 'Test',                                     labelEn: 'Test',                                   category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '🧪', short: 'TEST',    pulse: false, priority: 5 },
  { code: 20,  label: 'Initialisation',                   labelEs: 'Inicialización',                           labelEn: 'Initialisation',                         category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '🔄', short: 'INIT.',   pulse: false, priority: 4 },
  { code: 30,  label: 'Hibernation',                      labelEs: 'Hibernación',                              labelEn: 'Hibernation',                            category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '❄️', short: 'HIBER.',  pulse: false, priority: 5 },
  { code: 109, label: 'Renvoi du télé-service',           labelEs: 'Reenvío teleservicio',                     labelEn: 'Redirection Autodialer',                 category: 'information', color: '#64748B', bgColor: '#64748B15', icon: '📞', short: 'RENVOI',  pulse: false, priority: 5 },
];

// ═══ ÉTATS DISPLAY (17 codes) ═══

export interface DisplayStateConfig {
  code: number;
  label: string;
  labelEs: string;
  labelEn: string;
  isError: boolean;
}

export const DISPLAY_STATES: DisplayStateConfig[] = [
  { code: 0,  label: 'Normal',                            labelEs: 'Normal',                                 labelEn: 'Normal',                              isError: false },
  { code: 1,  label: 'Téléchargement du modèle',          labelEs: 'Descargando plantilla',                  labelEn: 'Downloading template',                isError: false },
  { code: 2,  label: 'Téléchargement mise à jour',        labelEs: 'Descargando actualización de software',  labelEn: 'Downloading software update',         isError: false },
  { code: 3,  label: 'Mise à jour du logiciel',           labelEs: 'Actualizando software',                  labelEn: 'Updating software',                   isError: false },
  { code: 4,  label: 'Erreur téléchargement modèle',      labelEs: 'Error descarga plantilla',               labelEn: 'Error downloading template',          isError: true },
  { code: 5,  label: 'Erreur téléchargement mise à jour', labelEs: 'Error descarga actualización',           labelEn: 'Error downloading software update',   isError: true },
  { code: 6,  label: 'Erreur mise à jour logiciel',       labelEs: 'Error actualización de software',        labelEn: 'Error updating software',             isError: true },
  { code: 7,  label: 'Erreur météo',                      labelEs: 'Error clima',                            labelEn: 'Weather error',                       isError: true },
  { code: 8,  label: 'Erreur RSS',                        labelEs: 'Error RSS',                              labelEn: 'RSS error',                           isError: true },
  { code: 9,  label: 'Erreur décompression modèle',       labelEs: 'Error al descomprimir plantilla',        labelEn: 'Error decompressing template',        isError: true },
  { code: 10, label: 'Espace insuffisant sur l\'écran',   labelEs: 'Falta espacio en el display',            labelEn: 'Not enough space on the display',     isError: true },
  { code: 11, label: 'Modèle téléchargé invalide',        labelEs: 'Plantilla descargada inválida',          labelEn: 'Downloaded template is invalid',      isError: true },
  { code: 12, label: 'Erreur application modèle',         labelEs: 'Error aplicando plantilla',              labelEn: 'Error applying template',             isError: true },
  { code: 13, label: 'Erreur application config. écran',  labelEs: 'Error aplicando config. display',        labelEn: 'Error applying display configuration', isError: true },
  { code: 14, label: 'Erreur téléchargement config. écran', labelEs: 'Error descargando config. display',    labelEn: 'Error downloading display configuration', isError: true },
  { code: 91, label: 'Sans données',                      labelEs: 'Sin datos',                              labelEn: 'No data',                             isError: true },
  { code: 99, label: 'Sans configuration',                labelEs: 'Sin configuración',                      labelEn: 'No configuration',                    isError: true },
];

// ═══ LOOKUP RAPIDE (index par code) ═══

const _liftStateMap = new Map<number, EstadoConfig>();
LIFT_STATES.forEach(s => _liftStateMap.set(s.code, s));

const _displayStateMap = new Map<number, DisplayStateConfig>();
DISPLAY_STATES.forEach(s => _displayStateMap.set(s.code, s));

// ═══ FONCTIONS UTILITAIRES ═══

/** Obtenir la config complète d'un état ascenseur par son code */
export function getLiftState(code: number | null | undefined): EstadoConfig {
  if (code === null || code === undefined) return _liftStateMap.get(-1)!;
  return _liftStateMap.get(code) || {
    code,
    label: `État inconnu (${code})`,
    labelEs: `Estado desconocido (${code})`,
    labelEn: `Unknown state (${code})`,
    category: 'information' as EstadoCategory,
    color: '#64748B', bgColor: '#64748B15',
    icon: '❓', short: `?(${code})`,
    pulse: false, priority: 5,
  };
}

/** Version simplifiée pour badge/affichage rapide */
export function getEstadoInfo(code: number | null | undefined): { label: string; color: string; short: string; icon: string; pulse: boolean; category: EstadoCategory } {
  const s = getLiftState(code);
  return { label: s.label, color: s.color, short: s.short, icon: s.icon, pulse: s.pulse, category: s.category };
}

/** Version pour IoTStatusBadge (compatible signature existante) */
export function getEstadoStyle(code: number | null | undefined): {
  label: string; short: string; color: string; icon: string; pulse: boolean; category: EstadoCategory;
} {
  const s = getLiftState(code);
  return { label: s.label, short: s.short, color: s.color, icon: s.icon, pulse: s.pulse, category: s.category };
}

/** Obtenir la config d'un état display */
export function getDisplayState(code: number | null | undefined): DisplayStateConfig {
  if (code === null || code === undefined) return { code: -1, label: 'Inconnu', labelEs: 'Desconocido', labelEn: 'Unknown', isError: false };
  return _displayStateMap.get(code) || { code, label: `Display (${code})`, labelEs: `Display (${code})`, labelEn: `Display (${code})`, isError: false };
}

// ═══ FILTRES PAR CATÉGORIE ═══

/** Codes par catégorie (pour filtres) */
export const CODES_BY_CATEGORY: Record<EstadoCategory, number[]> = {
  normal:      LIFT_STATES.filter(s => s.category === 'normal').map(s => s.code),
  attention:   LIFT_STATES.filter(s => s.category === 'attention').map(s => s.code),
  critique:    LIFT_STATES.filter(s => s.category === 'critique').map(s => s.code),
  special:     LIFT_STATES.filter(s => s.category === 'special').map(s => s.code),
  information: LIFT_STATES.filter(s => s.category === 'information').map(s => s.code),
  connexion:   LIFT_STATES.filter(s => s.category === 'connexion').map(s => s.code),
};

/** Tester si un code est dans une catégorie */
export function isCategory(code: number, cat: EstadoCategory): boolean {
  return CODES_BY_CATEGORY[cat].includes(code);
}

/** Tester si l'ascenseur est en service (normal ou information) */
export function isOperational(code: number): boolean {
  return isCategory(code, 'normal') || isCategory(code, 'information');
}

/** Tester si l'ascenseur a un problème (critique ou attention) */
export function hasProblem(code: number): boolean {
  return isCategory(code, 'critique') || isCategory(code, 'attention');
}

/** Tester si l'ascenseur est connecté (pas dans catégorie connexion) */
export function isConnected(code: number): boolean {
  return !isCategory(code, 'connexion');
}

/** Tester si l'ascenseur nécessite une intervention urgente */
export function isUrgent(code: number): boolean {
  const s = getLiftState(code);
  return s.priority <= 1;
}

/** Priorité pour tri (0 = plus urgent) */
export function getEstadoPriority(code: number): number {
  return getLiftState(code).priority;
}

/** Tous les codes utilisés (pour debug/select) */
export function getAllLiftStateCodes(): number[] {
  return LIFT_STATES.map(s => s.code).filter(c => c >= 0).sort((a, b) => a - b);
}

/** Liste pour <select> options groupées par catégorie */
export function getLiftStateOptions(): { category: EstadoCategory; label: string; states: { code: number; label: string }[] }[] {
  const cats: EstadoCategory[] = ['critique', 'attention', 'normal', 'special', 'information', 'connexion'];
  return cats.map(cat => ({
    category: cat,
    label: CATEGORY_COLORS[cat].label,
    states: LIFT_STATES.filter(s => s.category === cat && s.code >= 0)
      .sort((a, b) => a.code - b.code)
      .map(s => ({ code: s.code, label: `${s.icon} ${s.label} (${s.code})` })),
  }));
}
