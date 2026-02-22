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

  const opts: RequestInit = {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SIGMA4_API}${path}`, opts);

  if (res.status === 401) { clearSession(); throw new Error('Session expirée'); }
  if (!res.ok) throw new Error(`Sigma4 ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
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
// MONITOR ONLINE — Types données temps réel
// ═══════════════════════════════════════════════════════════════

export interface Sigma4MonitorData {
  // Position & mouvement
  posicion: number | null;
  destino: number | null;
  plantas: number | null;
  nivel?: string | null;
  // Portes
  puerta: string | null;           // 'ABIERTA' | 'CERRADA'
  fotocelula: boolean | null;
  ordenAbrir?: boolean | null;
  ordenCerrar?: boolean | null;
  // Charge
  peso: number | null;
  sobrecarga: boolean | null;
  // Sécurité
  serie: string | null;
  serieSeguridad: string | null;
  // Variateur & Bus
  tensionBus: number | null;
  variador: string | null;
  estadoAscensor: string | null;
  canA: string | null;
  canB: string | null;
  canH: string | null;             // CAN gaine (hueco)
  canM: string | null;             // CAN manœuvre
  // Appels
  comandos: string | null;
  exteriorSubida: number[] | null;
  exteriorBajada: number[] | null;
  ultimoEvento: string | null;
  // Stats
  cabina: number | null;
  viajes?: number | null;
  viajesHoy?: number | null;
  temperatura?: number | null;
  // Communication
  operador?: string | null;
  paquetesEnviados?: number | null;
  paquetesErroneos?: number | null;
  porcentajeErrores?: number | null;
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
export async function activateMonitor(liftId: number): Promise<any> {
  return sigma4Put(`/divide/lifts/${liftId}/control/activateMonitor`);
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
  liftId: number, action: MonitorAction, cabina = 1, params?: { orden?: number; planta?: number }
): Promise<any> {
  return sigma4Put(`/divide/lifts/${liftId}/control/${cabina}/ecogo/${action}`, params || {});
}

/** Historique d'erreurs / messages d'un ascenseur */
export async function getLiftErrors(liftId: number): Promise<Sigma4ErrorEntry[]> {
  return sigma4Get(`/divide/lifts/${liftId}/messages`);
}

/** Catalogue erreurs S4L — /info/errores (avec params optionnels) */
export async function getErrorInfo(params?: Record<string, string>): Promise<any> {
  const qs = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : '';
  return sigma4Get(`/divide/info/errores${qs}`);
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
