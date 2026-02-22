// ═══════════════════════════════════════════════════════════════
// SIGMA4LIFTS API — Connexion directe plateforme IoT
// Auth: POST /divide/login → token
// Data: GET /divide/dashboard, /divide/users, etc.
// Proxy Vercel: /api/sigma4/* → sigma4lifts.com/sigma/rs/*
// ═══════════════════════════════════════════════════════════════

// ═══ TYPES ═══

export interface Sigma4Session {
  token: string;
  userId: string;
  userName: string;
  company?: string;
  expiresAt: number;
}

export interface Sigma4ChartItem {
  label: string | null;
  quantity: number;
  id: string;
}

export interface Sigma4Chart {
  caption: string;
  aspect: 'pie' | 'bar';
  data: Sigma4ChartItem[];
  idString: string;
}

export interface Sigma4Dashboard {
  groupId: string | null;
  dashboard: Sigma4Chart[];
}

// ═══ CONFIG ═══

const SIGMA4_API   = '/api/sigma4';  // Proxy Vercel → sigma4lifts.com/sigma/rs/
const SIGMA4_FRONT = 'https://www.sigma4lifts.com/sigma-front/#/';
const STORAGE_KEY  = 'sigma4_session';

// ═══ SESSION ═══

function getStoredSession(): Sigma4Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s: Sigma4Session = JSON.parse(raw);
    if (s.expiresAt < Date.now()) { localStorage.removeItem(STORAGE_KEY); return null; }
    return s;
  } catch { return null; }
}

function storeSession(s: Sigma4Session) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(STORAGE_KEY); }

export function getSigma4Session(): Sigma4Session | null { return getStoredSession(); }
export function isConnectedToSigma4(): boolean { return getStoredSession() !== null; }
export function getSigma4FrontUrl(): string { return SIGMA4_FRONT; }

// ═══ AUTH ═══

export async function loginSigma4(username: string, password: string): Promise<Sigma4Session> {
  const res = await fetch(`${SIGMA4_API}/divide/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }).toString(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('Identifiants incorrects');
    throw new Error(`Erreur Sigma4 (${res.status})`);
  }

  const data = await res.json();

  // Le token peut être retourné directement comme string ou dans un objet
  const token = typeof data === 'string' ? data
    : data.token || data.access_token || data.accessToken || data.sessionId || data.key || '';

  if (!token) throw new Error('Token non reçu');

  // Infos utilisateur
  let userName = username;
  let company = '';
  let userId = username;
  try {
    const userRes = await sigma4Get('/divide/users?loginName=' + encodeURIComponent(username), token);
    const user = Array.isArray(userRes) ? userRes[0] : userRes;
    if (user) {
      userName = user.name || user.userName || user.loginName || username;
      company = user.company || user.companyName || user.divide || '';
      userId = String(user.id || user.userId || username);
    }
  } catch {}

  const session: Sigma4Session = { token, userId, userName, company, expiresAt: Date.now() + 86400_000 };
  storeSession(session);
  return session;
}

export function logoutSigma4(): void { clearSession(); }

// ═══ FETCH HELPERS ═══

async function sigma4Get(path: string, tokenOverride?: string): Promise<any> {
  const token = tokenOverride || getStoredSession()?.token;
  if (!token) throw new Error('Non connecté');

  const res = await fetch(`${SIGMA4_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) { clearSession(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Sigma4 ${res.status}`);
  return res.json();
}

async function sigma4Post(path: string, body: any): Promise<any> {
  const token = getStoredSession()?.token;
  if (!token) throw new Error('Non connecté');

  const res = await fetch(`${SIGMA4_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401) { clearSession(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Sigma4 ${res.status}`);
  return res.json();
}

async function sigma4Put(path: string, body?: any): Promise<any> {
  const token = getStoredSession()?.token;
  if (!token) throw new Error('Non connecté');

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const opts: RequestInit = { method: 'PUT', headers };

  // Body seulement si fourni (pas de Content-Type sans body, comme Axios)
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${SIGMA4_API}${path}`, opts);

  if (res.status === 401) { clearSession(); throw new Error('Session expirée'); }
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`Sigma4 ${res.status}${detail ? ': ' + detail.substring(0, 200) : ''}`);
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text || true; }
}

// ═══ ENDPOINTS CONNUS ═══

export async function getDashboard(): Promise<Sigma4Dashboard> {
  return sigma4Get('/divide/dashboard');
}

export async function getUser(loginName: string): Promise<any> {
  return sigma4Get('/divide/users?loginName=' + encodeURIComponent(loginName));
}

// ═══ LIFT TYPES ═══

export interface Sigma4LiftGroup {
  id: number;
  groupName: string;
  description: string;
  companyId: number;
}

export interface Sigma4Lift {
  id: number;
  liftCompRef: string;
  cir: string | null;
  officialRegNumber: string | null;
  manufacturerRef: string;
  manufacturerName: string;
  descripcion: string;
  registrationDate: string | null;
  commisioningDate: string | null;
  deregistrationDate: string | null;
  billingStartDate: string | null;
  billingChangeDate: string | null;
  phoneNumber: string;
  accesoPv: boolean;
  tracId: number;
  estado: number;
  situacionEnEdificio: string;
  numeroCabina: number;
  traccion: string;
  numeroPersonas: number;
  cargaUtil: number | null;
  arquitectura: string;
  numeroParadas: number | null;
  modeloManiobra: number;
  versionSW: string;
  baja: boolean;
  address: string;
  city: string;
  province: string;
  zipCode: string;
  en8128: boolean;
  reporteExternoEn8128: boolean;
  tipoEnlace: number;
  modeloTelefono: string;
  modeloAscensor: string;
  ccid: string;
  macGSR: string | null;
  latitude: number;
  longitude: number;
  ascensoresEnBateria: number;
  dateEN8128OK: string | null;
  ip: string | null;
  apn: string | null;
  simStatus: string | null;
  versionSW: string;
  groups: Sigma4LiftGroup[];
}

// ═══ ENDPOINTS ═══

export async function getLifts(): Promise<Sigma4Lift[]> {
  return sigma4Get('/divide/lifts?advanced=true');
}

export async function getLiftById(id: number): Promise<Sigma4Lift> {
  return sigma4Get(`/divide/lifts/${id}?advanced=true`);
}

// ═══ TRAFFIC / SERVICES ═══

export interface Sigma4ServiceEntry {
  fecha: string;
  total: number;
  parcial: number;
}

export async function getLiftServices(liftId: number): Promise<Sigma4ServiceEntry[]> {
  return sigma4Get(`/divide/lifts/${liftId}/services`);
}

// ═══════════════════════════════════════════════════════════════
// VARIATEUR — Labels phases, contacteurs, freins
// Source : protocole ecoGO / convention variateurs ascenseurs
// ═══════════════════════════════════════════════════════════════

/** Phase du variateur (faseVariador) */
export const DRIVE_PHASES: Record<number, { label: string; color: string }> = {
  0: { label: 'Arrêté',           color: '#64748B' },
  1: { label: 'Pré-magnétisation', color: '#CA8A04' },
  2: { label: 'Accélération',     color: '#3B82F6' },
  3: { label: 'Vitesse constante', color: '#059669' },
  4: { label: 'Décélération',     color: '#EA580C' },
  5: { label: 'Arrêt frein',      color: '#CA8A04' },
  6: { label: 'Recalage',         color: '#8B5CF6' },
  7: { label: 'Évacuation',       color: '#DC2626' },
};

/** Contacteurs (variadorContactores) — bitmask K1/K2 */
export const CONTACTOR_STATES: Record<number, { label: string; color: string }> = {
  0: { label: 'K1/K2 ouverts',   color: '#64748B' },
  1: { label: 'K1 fermé',        color: '#CA8A04' },
  2: { label: 'K2 fermé',        color: '#CA8A04' },
  3: { label: 'K1+K2 fermés',    color: '#059669' },
};

/** Frein (variadorFreno) — bitmask micros frein */
export const BRAKE_STATES: Record<number, { label: string; color: string }> = {
  0: { label: 'Frein appliqué',     color: '#059669' },
  1: { label: 'Frein 1 relâché',    color: '#CA8A04' },
  2: { label: 'Frein 2 relâché',    color: '#CA8A04' },
  3: { label: 'Freins relâchés',    color: '#3B82F6' },
};

export function getDrivePhaseLabel(v: number | null | undefined): string {
  return v != null && DRIVE_PHASES[v] ? DRIVE_PHASES[v].label : v != null ? `Phase ${v}` : '—';
}
export function getDrivePhaseColor(v: number | null | undefined): string {
  return v != null && DRIVE_PHASES[v] ? DRIVE_PHASES[v].color : '#64748B';
}
export function getContactorLabel(v: number | null | undefined): string {
  return v != null && CONTACTOR_STATES[v] ? CONTACTOR_STATES[v].label : v != null ? `État ${v}` : '—';
}
export function getContactorColor(v: number | null | undefined): string {
  return v != null && CONTACTOR_STATES[v] ? CONTACTOR_STATES[v].color : '#64748B';
}
export function getBrakeLabel(v: number | null | undefined): string {
  return v != null && BRAKE_STATES[v] ? BRAKE_STATES[v].label : v != null ? `État ${v}` : '—';
}
export function getBrakeColor(v: number | null | undefined): string {
  return v != null && BRAKE_STATES[v] ? BRAKE_STATES[v].color : '#64748B';
}

export const DOOR_STATES: Record<number, { label: string; color: string }> = {
  0: { label: 'Fermée',      color: '#059669' },
  1: { label: 'Ouverture…',  color: '#CA8A04' },
  2: { label: 'Ouverte',     color: '#EA580C' },
  3: { label: 'Fermeture…',  color: '#CA8A04' },
};

export interface Sigma4Embarque {
  fotocelula: boolean;
  estado: number;         // 0=fermée, 1=en ouverture, 2=ouverte, 3=en fermeture
  orden: number;          // 0=aucun, 1=ouvrir, 2=fermer
  habilitado: boolean;
}

export interface Sigma4MonitorData {
  // Timestamps
  fechaActualizacion: string | null;
  fechaError: string | null;
  fechaComando: string | null;

  // Position & mouvement
  posicionDecimal: number | null;
  posicionMilimetros: number | null;
  destino: number | null;
  planta: number | null;
  nivel: boolean | null;            // à niveau (true = au palier)
  flechaSubida: boolean | null;
  flechaBajada: boolean | null;

  // État ascenseur
  estado: number | null;            // état fonctionnement
  modoFuncionamiento: number | null;
  motivoNoArranque: number | null;
  peso: number | null;

  // Portes (embarques)
  embarques: Sigma4Embarque[] | null;

  // Chaîne de sécurité (true = fermé/OK, false = ouvert/défaut)
  serieSeguridad00: boolean | null;  // Chaîne primaire
  serieSeguridad40: boolean | null;  // Point 40 (MCB)
  serieSeguridad60: boolean | null;  // Inspection (60H)
  serieSeguridad70: boolean | null;  // Shunts portes (70H)
  serieSeguridad80: boolean | null;  // Verrouillages paliers (80H)
  serieSeguridad85: boolean | null;  // Verrouillages cabine (85)
  serieSeguridad90: boolean | null;  // Verrouillages (90H)
  serieSeguridad95: boolean | null;  // Contact 95

  // Erreur courante
  codigoFamiliaError: number | null;
  codigoError: number | null;
  codigoSubError: number | null;
  codigoErrorString: string | null;

  // Alimentation & Batterie
  tensionEntrada: number | null;       // Tension réseau (V)
  tensionManiobra: number | null;      // Tension manœuvre (V)
  intensidadManiobra: number | null;
  tensionCircuitoAux: number | null;
  intensidadCircuitoAux: number | null;
  tensionBateria: number | null;       // ×10 (260 = 26.0V)
  conectadoARed: boolean | null;
  cargaBateria: number | null;         // %
  nivelCargaBateria: number | null;
  estadoCargador: number | null;

  // Variateur
  faseVariador: number | null;
  variadorContactores: number | null;
  variadorFreno: number | null;
  variadorTSO: boolean | null;
  tensionBus: number | null;
  intensidadBus: number | null;

  // Bus (0=OK, 1=warning, 2=error...)
  usoBusManiobra: number | null;
  usoBusAuxiliar: number | null;
  usoBusHueco: number | null;
  usoBusMultiplex: number | null;

  // Cartes détectées
  numPlacaMIO: number | null;
  numPlacaRevMam: number | null;
  numPlacaCar: number | null;
  numPlacaDrive: number | null;
  numPlacaDoc: number | null;
  numPlacaLob: number | null;
  numPlacaInterfono: number | null;
  numPlacaTel: number | null;
  numPlacaAudio: number | null;
  numPlacaLink: number | null;
  numPlacaAlim: number | null;
  numPlacaRevAux: number | null;
  numPlacaSyngo: number | null;

  // Appels (tableaux de booleans, index = n° palier)
  llamadasCabina: boolean[] | null;
  llamadasExterioresSubida: boolean[] | null;
  llamadasExterioresBajada: boolean[] | null;

  // Commande en cours
  comando: string | null;
  plantaLlamada: number | null;
  numFuncionEspecial: number | null;
  activarFuncionEspecial: boolean | null;
  usuario: string | null;

  // Trame brute
  ecoGoNumSeq: number | null;
  ecoGoTrama: string | null;
  ascensor: any;
}

// Actions Monitor Online (29 commandes extraites du bundle)
export type MonitorAction =
  | 'ACTIVAR_PONER_SERVICIO' | 'ACTIVAR_FUERA_SERVICIO' | 'ACTIVAR_RESET'
  | 'BORRAR_LLAMADAS_CABINA' | 'BORRAR_LLAMADAS_EXTERIORES'
  | 'FORZAR_LLAMADA' | 'FORZAR_TEST_TELEFONO' | 'FORZAR_TEST_EN'
  | 'FORZAR_BATERIA_BAJA' | 'FORZAR_MODO_VOZ' | 'FIN_ALARMA_REMOTO'
  | 'LUZ_HUECO' | 'RESET_PLACA' | 'REINICIAR_SCRIPT_BOOTLOADER'
  | 'PIDE_ERRORES_DUMP' | 'GET_PARAMETERS' | 'SET_PARAMETERS'
  | 'DEVOLVER_LOG_ONLINE' | 'SOLICITA_MODO' | 'CAR_CALL';

export const MONITOR_ACTIONS: { key: MonitorAction; label: string; icon: string; danger?: boolean }[] = [
  { key: 'ACTIVAR_PONER_SERVICIO',    label: 'Mise en service',       icon: '▶️' },
  { key: 'ACTIVAR_FUERA_SERVICIO',    label: 'Mise hors service',     icon: '⏸️', danger: true },
  { key: 'ACTIVAR_RESET',             label: 'Reset armoire',         icon: '🔄' },
  { key: 'RESET_PLACA',               label: 'Reset carte',           icon: '🔧', danger: true },
  { key: 'BORRAR_LLAMADAS_CABINA',    label: 'Effacer appels cabine', icon: '🗑️' },
  { key: 'BORRAR_LLAMADAS_EXTERIORES',label: 'Effacer appels paliers',icon: '🗑️' },
  { key: 'FORZAR_LLAMADA',            label: 'Forcer appel alarme',   icon: '🚨' },
  { key: 'FORZAR_TEST_TELEFONO',      label: 'Test téléphone',        icon: '📞' },
  { key: 'FORZAR_TEST_EN',            label: 'Test EN 81-28',         icon: '🛡️' },
  { key: 'FORZAR_BATERIA_BAJA',       label: 'Forcer batterie basse', icon: '🔋' },
  { key: 'FIN_ALARMA_REMOTO',         label: 'Fin alarme',            icon: '🔕' },
  { key: 'LUZ_HUECO',                 label: 'Lumière gaine ON/OFF',  icon: '💡' },
  { key: 'GET_PARAMETERS',            label: 'Lire paramètres',       icon: '📖' },
  { key: 'SET_PARAMETERS',            label: 'Écrire paramètres',     icon: '📝', danger: true },
  { key: 'PIDE_ERRORES_DUMP',         label: 'Dump erreurs',          icon: '📋' },
  { key: 'DEVOLVER_LOG_ONLINE',       label: 'Récupérer log',         icon: '📄' },
  { key: 'SOLICITA_MODO',             label: 'Demander mode',         icon: '❓' },
  { key: 'REINICIAR_SCRIPT_BOOTLOADER', label: 'Redémarrer bootloader', icon: '⚙️', danger: true },
];

// ═══════════════════════════════════════════════════════════════
// SMART PREVENTIVE — Types erreurs
// ═══════════════════════════════════════════════════════════════

export interface Sigma4ErrorEntry {
  errorCode: string;
  description?: string;
  date: string;
  origin?: string;
  severity?: string;
  causa?: string;
}

/** Format réel de la réponse /divide/lifts/{id}/messages */
export interface Sigma4MessageEntry {
  id: number;
  dtype: string;             // "SUCESO", "ALARMA", etc.
  messageDate: string;       // ISO date
  liftId: number;
  systemDate: string;
  type: number;              // 4 = erreur, etc.
  archivado: boolean;
  closingDate: string | null;
  observations: string | null;
  subtype: number;
  subsubtype: number;
  content: string;           // Code erreur ex: "0017", "0000"
  manual: boolean;
  extraCode: string | null;
  extraDate: string | null;
  extraContent: string | null;
  tag: string | null;
}

// ═══════════════════════════════════════════════════════════════
// OPERATING STATES (extrait du bundle)
// ═══════════════════════════════════════════════════════════════

export const OPERATING_STATES: Record<string, { label: string; color: string }> = {
  OPERATIVO:                { label: 'En marche',                color: '#00E200' },
  PARADO:                   { label: 'Hors service',             color: '#FF0000' },
  MANTENIMIENTO_O_REVISION: { label: 'Maintenance / Inspection', color: '#EFA52A' },
  EMERGENCY:                { label: 'Urgence',                  color: '#33CCCC' },
  OTROS:                    { label: 'Modes spéciaux',           color: '#008000' },
  SIN_CONFIGURACION:        { label: 'Non configuré',            color: '#7673D9' },
  SIN_CONEXION_S:           { label: 'Sans connexion',           color: '#EA580C' },
};

// ═══════════════════════════════════════════════════════════════
// NOUVEAUX ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/** Données état d'un ascenseur (Monitor Online — données de base) */
export async function getMonitorOnline(liftId: number): Promise<Sigma4MonitorData> {
  return sigma4Get(`/divide/lifts/${liftId}/status`);
}

/** Activer le monitor temps réel (session monitoring) */
/** Activer le monitor (initialisation) */
export async function activateMonitor(liftId: number): Promise<any> {
  // Étape 1 : Activation initiale (comme S4L: da function)
  await sigma4Put(`/divide/lifts/${liftId}/control/activateMonitor`);
  // Étape 2 : Démarrer le flux temps réel (comme S4L: la function = logMonitorUsage)  
  return sigma4Put(`/divide/lifts/${liftId}/control/activateMonitor?start=true`);
}

/** Keep-alive monitor — rappeler start=true pour maintenir le flux */
export async function keepAliveMonitor(liftId: number): Promise<any> {
  return sigma4Put(`/divide/lifts/${liftId}/control/activateMonitor?start=true`);
}

/** Obtenir l'URL du monitor temps réel (serveur WebSocket/polling séparé) */
export async function getMonitorURL(liftId: number): Promise<string | null> {
  try {
    const data = await sigma4Get(`/divide/lifts/${liftId}/control/getMonitorURL`);
    return data?.URL || null;
  } catch { return null; }
}

/** Envoyer une commande ecoGO (Monitor Online action)
 *  PUT /lifts/{id}/control/{cabina}/ecogo/{action} { orden, planta } */
export async function sendMonitorAction(
  liftId: number, action: MonitorAction, cabina = 1, params?: { orden?: string | number; planta?: number }
): Promise<any> {
  return sigma4Put(`/divide/lifts/${liftId}/control/${cabina}/ecogo/${action}`, params || {});
}

/** Historique d'erreurs / messages d'un ascenseur (7 derniers jours par défaut) */
export async function getLiftErrors(liftId: number, days = 7): Promise<Sigma4MessageEntry[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  // Format Quasar/S4L : YYYY/MM/DD HH:mm
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sd = encodeURIComponent(fmt(start));
  const ed = encodeURIComponent(fmt(end));
  return sigma4Get(`/divide/lifts/${liftId}/messages?startDate=${sd}&endDate=${ed}`);
}

/** Catalogue erreurs S4L — /info/errores (avec params optionnels) */
export async function getErrorInfo(params?: Record<string, string>): Promise<any> {
  const qs = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : '';
  return sigma4Get(`/divide/info/errores${qs}`);
}

// ═══════════════════════════════════════════════════════════════
// MODES DE FONCTIONNEMENT (XML MODES.FR)
// ═══════════════════════════════════════════════════════════════

/** Cache local des modes (numéro → label FR) */
let _modesCache: Map<number, string> | null = null;

/** Fallback hardcodé pour les modes les plus courants */
const MODE_FALLBACK: Record<number, string> = {
  0:  'HORS SERVICE',
  1:  'NORMAL',
  2:  'NORMAL. PARKING',
  3:  'INSPECTION',
  4:  'INSPECTION HUECO',
  5:  'POMPIERS',
  6:  'POMPIERS PHASE 2',
  7:  'SECOURS',
  8:  'MES (RAPPEL)',
  9:  'PRIORITAIRE',
  10: 'VIP',
  11: 'SABBATIQUE',
  12: 'ATTENTE',
  20: 'NORMAL. AUTONOME',
  21: 'NORMAL. SIMPLEX',
  22: 'NORMAL. DUPLEX',
  23: 'NORMAL. TÉLÉCOMMANDÉ',
  24: 'NORMAL. SELECTIF',
  25: 'NORMAL. COLLECTIF DESCENTE',
  26: 'NORMAL. COLLECTIF COMPLET',
  30: 'APPRENTISSAGE GAINE',
  31: 'TEST AUTOMATIQUE',
  40: 'BLOCAGE. ERREUR',
  41: 'BLOCAGE. SÉRIE OUVERTE',
  50: 'HORS TENSION',
  99: 'INCONNU',
};

/** Charger les modes depuis le fichier XML MODES.FR du serveur S4L */
export async function fetchModesXML(): Promise<Map<number, string>> {
  if (_modesCache) return _modesCache;
  try {
    const token = getStoredSession()?.token;
    if (!token) throw new Error('No token');
    const res = await fetch(`${SIGMA4_API}/divide/files/MODES.FR`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`); // 404 → fallback silencieux
    const text = await res.text();
    if (text.includes('<')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const map = new Map<number, string>();
      const nodes = doc.querySelectorAll('mode, Mode, MODE, m, item, entry');
      nodes.forEach(node => {
        const id = parseInt(node.getAttribute('id') || node.getAttribute('ID') || node.getAttribute('num') || node.getAttribute('code') || '', 10);
        const txt = (node.getAttribute('text') || node.getAttribute('name') || node.getAttribute('label') || node.textContent || '').trim();
        if (!isNaN(id) && txt) map.set(id, txt.toUpperCase());
      });
      if (map.size > 0) { _modesCache = map; return map; }
    }
  } catch { /* Fallback silencieux — les labels MODE_FALLBACK sont suffisants */ }
  _modesCache = new Map(Object.entries(MODE_FALLBACK).map(([k, v]) => [Number(k), v]));
  return _modesCache;
}

/** Obtenir le label d'un mode (sync, depuis le cache ou fallback) */
export function getModeLabel(modoFuncionamiento: number | null | undefined): string {
  if (modoFuncionamiento == null) return '—';
  if (_modesCache?.has(modoFuncionamiento)) return _modesCache.get(modoFuncionamiento)!;
  if (modoFuncionamiento in MODE_FALLBACK) return MODE_FALLBACK[modoFuncionamiento];
  return `MODE ${modoFuncionamiento}`;
}

/** Couleur associée au mode de fonctionnement */
const MODE_COLORS: Record<number, string> = {
  0: '#059669', 1: '#DC2626', 3: '#CA8A04', 4: '#CA8A04', 5: '#3B82F6',
  6: '#64748B', 7: '#CA8A04', 8: '#EA580C', 9: '#DC2626', 15: '#DC2626',
  16: '#DC2626', 17: '#EA580C', 18: '#8B5CF6', 19: '#CA8A04', 20: '#3B82F6',
  21: '#DC2626', 22: '#CA8A04', 23: '#059669', 24: '#059669', 25: '#059669',
  26: '#059669', 30: '#CA8A04', 31: '#CA8A04', 40: '#DC2626', 41: '#DC2626', 50: '#64748B',
};
export function getModeColor(modoFuncionamiento: number | null | undefined): string {
  if (modoFuncionamiento == null) return '#64748B';
  return MODE_COLORS[modoFuncionamiento] || '#64748B';
}

/** Hardware d'un ascenseur */
export async function getLiftHardware(liftId: number): Promise<any> {
  return sigma4Get(`/divide/lifts/${liftId}/hardware`);
}

/** Paramètres — lecture */
export async function getLiftParameters(liftId: number): Promise<any> {
  return sigma4Get(`/divide/lifts/${liftId}/parameters`);
}

/** Paramètres — écriture */
export async function setLiftParameters(liftId: number, parameters: any): Promise<any> {
  return sigma4Put(`/divide/lifts/${liftId}/parameters`, parameters);
}

/** Identify (info fabricant / version) */
export async function getLiftIdentify(liftId: number): Promise<any> {
  return sigma4Get(`/divide/lifts/${liftId}/identify`);
}

/** Groupes */
export async function getLiftGroups(): Promise<Sigma4LiftGroup[]> {
  return sigma4Get('/divide/lifts/groups');
}

/** Tracs (historique événements) */
export async function getTracs(liftId?: number): Promise<any> {
  return sigma4Get(liftId ? `/divide/tracs?liftId=${liftId}` : '/divide/tracs');
}

/** Analytics */
export async function getAnalytics(type: 'avgavailability' | 'avgservices' | 'stopped'): Promise<any> {
  return sigma4Get(`/divide/analytics/${type}`);
}

// ═══ GENERIC ═══

export async function sigma4Request(path: string): Promise<any> {
  return sigma4Get(path);
}
