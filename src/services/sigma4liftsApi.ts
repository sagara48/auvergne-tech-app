// ═══════════════════════════════════════════════════════════════
// SIGMA4LIFTS API — Connexion directe à la plateforme IoT
// Auth → Token → Fetch data → Cache Supabase
// https://www.sigma4lifts.com/sigma-front/#/
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ═══ TYPES ═══

export type EtatAscenseur = 'normal' | 'inspection' | 'hors_service' | 'emprisonnement' | 'alarme' | 'maintenance';
export type EtatPorte = 'ouverte' | 'fermee' | 'en_mouvement' | 'bloquee';
export type NiveauAlerte = 'info' | 'warning' | 'critical' | 'emergency';
export type TypeEvenement = 'trajet' | 'alarme' | 'erreur' | 'maintenance' | 'emprisonnement' | 'porte' | 'batterie' | 'temperature' | 'statut' | 'firmware';

export interface Sigma4Session {
  token: string;
  refreshToken?: string;
  userId: string;
  userName: string;
  expiresAt: number;  // timestamp ms
  company?: string;
}

export interface LiftStatus {
  liftId: string;
  ascenseurId?: string;
  nom: string;
  adresse: string;
  lat?: number;
  lng?: number;
  etat: EtatAscenseur;
  etage: number;
  etageMax: number;
  positionMm: number;
  porte: EtatPorte;
  enMouvement: boolean;
  direction: 'up' | 'down' | 'idle';
  batteriePercent: number;
  temperatureMachinerie: number;
  securitesOk: boolean;
  connecte: boolean;
  dernierSignal: string;
  firmwareVersion: string;
  hardwareVersion: string;
  controllerType: string;
}

export interface LiftAlert {
  id: string;
  liftId: string;
  niveau: NiveauAlerte;
  type: TypeEvenement;
  message: string;
  timestamp: string;
  acquittee: boolean;
  acquittePar?: string;
  acquitteDate?: string;
}

export interface LiftEvent {
  id: string;
  liftId: string;
  type: TypeEvenement;
  description: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface TrafficStats {
  liftId: string;
  date: string;
  trajetsTotal: number;
  trajetsParHeure: number[];
  etagesPlusFrequentes: { etage: number; count: number }[];
  tempsArretMoyen: number;
  consommationKwh?: number;
}

export interface LiftHealth {
  liftId: string;
  scoreGlobal: number;
  moteur: number;
  portes: number;
  cables: number;
  frein: number;
  variateur: number;
  dernierCalcul: string;
}

export interface IoTDashboardStats {
  totalAscenseurs: number;
  enLigne: number;
  horsLigne: number;
  enPanne: number;
  alertesActives: number;
  emprisonnements24h: number;
  trajetsAujourdhui: number;
  disponibiliteMoyenne: number;
}

export type RemoteCommand = 'call_car' | 'reset_board' | 'force_alarm_test' | 'change_mode' | 'force_door_close';

// ═══ CONFIGURATION ═══

const SIGMA4_BASE = 'https://www.sigma4lifts.com';
const SIGMA4_API  = '/api/sigma4';  // Proxy Vercel → contourne CORS
const SIGMA4_FRONT = `${SIGMA4_BASE}/sigma-front/#/`;

const STORAGE_KEY = 'sigma4_session';

// ═══ SESSION MANAGEMENT ═══

function getStoredSession(): Sigma4Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: Sigma4Session = JSON.parse(raw);
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

function storeSession(session: Sigma4Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getSigma4Session(): Sigma4Session | null {
  return getStoredSession();
}

export function isConnectedToSigma4(): boolean {
  return getStoredSession() !== null;
}

export function getSigma4FrontUrl(): string {
  return SIGMA4_FRONT;
}

// ═══ AUTH — Login / Logout / Refresh ═══

export async function loginSigma4(username: string, password: string): Promise<Sigma4Session> {
  // POST /divide/login → retourne le token
  const res = await fetch(`${SIGMA4_API}/divide/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('Identifiants incorrects');
    if (res.status === 404) throw new Error('Utilisateur non trouvé');
    const err = await res.text().catch(() => '');
    throw new Error(`Erreur Sigma4Lifts (${res.status}): ${err}`);
  }

  const data = await res.json();

  // Extraire le token — peut être à la racine ou dans un sous-objet
  const token = data.token || data.access_token || data.accessToken
    || data.sessionId || data.session_id || data.key
    || (typeof data === 'string' ? data : '');

  if (!token) throw new Error('Token non reçu — vérifiez vos identifiants');

  // Récupérer les infos utilisateur avec le token
  let userName = username;
  let company = '';
  let userId = username;
  try {
    const userRes = await fetch(`${SIGMA4_API}/divide/users?loginName=${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      const user = Array.isArray(userData) ? userData[0] : userData;
      userName = user?.name || user?.userName || user?.loginName || username;
      company = user?.company || user?.companyName || user?.divide || '';
      userId = String(user?.id || user?.userId || username);
    }
  } catch {}

  const session: Sigma4Session = {
    token,
    refreshToken: undefined,
    userId,
    userName,
    company,
    expiresAt: Date.now() + 86400 * 1000, // 24h
  };

  storeSession(session);

  // Enregistrer la connexion Sigma4 dans Supabase (métadonnées)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('sigma4_connections').upsert({
      user_id: user.id,
      sigma4_user_id: session.userId,
      sigma4_email: email,
      sigma4_company: session.company,
      last_login: new Date().toISOString(),
    }, { onConflict: 'user_id' }).catch(() => {});
  }

  return session;
}

export async function logoutSigma4(): Promise<void> {
  const session = getStoredSession();
  if (session?.token) {
    await fetch(`${SIGMA4_API}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }
  clearSession();
}

async function refreshToken(): Promise<boolean> {
  const session = getStoredSession();
  if (!session?.refreshToken) return false;
  try {
    const res = await fetch(`${SIGMA4_API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) { clearSession(); return false; }
    const data = await res.json();
    storeSession({
      ...session,
      token: data.token || data.access_token,
      expiresAt: Date.now() + (data.expiresIn || 86400) * 1000,
    });
    return true;
  } catch { clearSession(); return false; }
}

// ═══ FETCH WRAPPER (auth + retry) ═══

async function sigma4Fetch<T>(path: string, options?: RequestInit): Promise<T> {
  let session = getStoredSession();
  if (!session) throw new Error('Non connecté à Sigma4Lifts');

  // Token expiré ? tenter refresh
  if (session.expiresAt < Date.now() + 60000) {
    const ok = await refreshToken();
    if (!ok) throw new Error('Session Sigma4Lifts expirée — reconnectez-vous');
    session = getStoredSession()!;
  }

  const res = await fetch(`${SIGMA4_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options?.headers || {}),
    },
  });

  // 401 → tenter refresh une fois
  if (res.status === 401) {
    const ok = await refreshToken();
    if (ok) {
      const s2 = getStoredSession()!;
      const res2 = await fetch(`${SIGMA4_API}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s2.token}` },
      });
      if (res2.ok) return res2.json();
    }
    clearSession();
    throw new Error('Session expirée — reconnectez-vous');
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Sigma4 erreur ${res.status}: ${err}`);
  }

  return res.json();
}

// ═══ STATUS — Données temps réel depuis Sigma4 ═══

export async function getLiftStatuses(): Promise<LiftStatus[]> {
  try {
    const data = await sigma4Fetch<any[]>('/lifts');
    return (data || []).map(mapSigmaLift);
  } catch (e) {
    // Fallback Supabase cache
    const { data } = await supabase.from('iot_lifts').select('*').order('nom');
    return (data || []).map(mapDbLift);
  }
}

export async function getLiftStatus(liftId: string): Promise<LiftStatus | null> {
  try {
    const data = await sigma4Fetch<any>(`/lifts/${liftId}`);
    return mapSigmaLift(data);
  } catch {
    const { data } = await supabase.from('iot_lifts').select('*').eq('lift_id', liftId).single();
    return data ? mapDbLift(data) : null;
  }
}

// ═══ NOTIFY — Alertes depuis Sigma4 ═══

export async function getActiveAlerts(): Promise<LiftAlert[]> {
  try {
    const data = await sigma4Fetch<any[]>('/alerts?status=active');
    return (data || []).map(mapSigmaAlert);
  } catch {
    const { data } = await supabase.from('iot_alerts').select('*').eq('acquittee', false).order('timestamp', { ascending: false });
    return data || [];
  }
}

export async function getAllAlerts(limit = 50): Promise<LiftAlert[]> {
  try {
    const data = await sigma4Fetch<any[]>(`/alerts?limit=${limit}`);
    return (data || []).map(mapSigmaAlert);
  } catch {
    const { data } = await supabase.from('iot_alerts').select('*').order('timestamp', { ascending: false }).limit(limit);
    return data || [];
  }
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  try {
    await sigma4Fetch(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
  } catch {}
  // Aussi en local
  await supabase.from('iot_alerts').update({ acquittee: true, acquitte_date: new Date().toISOString() }).eq('id', alertId).catch(() => {});
}

// ═══ PREVENTIVE — Événements ═══

export async function getEvents(liftId?: string, limit = 100): Promise<LiftEvent[]> {
  try {
    const path = liftId ? `/lifts/${liftId}/events?limit=${limit}` : `/events?limit=${limit}`;
    const data = await sigma4Fetch<any[]>(path);
    return (data || []).map(mapSigmaEvent);
  } catch {
    let q = supabase.from('iot_events').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (liftId) q = q.eq('lift_id', liftId);
    const { data } = await q;
    return data || [];
  }
}

// ═══ TRAFFIC CONTROL ═══

export async function getTrafficStats(liftId: string, days = 7): Promise<TrafficStats[]> {
  try {
    const data = await sigma4Fetch<any[]>(`/lifts/${liftId}/traffic?days=${days}`);
    return (data || []).map(mapSigmaTraffic);
  } catch {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase.from('iot_traffic').select('*').eq('lift_id', liftId).gte('date', since).order('date');
    return data || [];
  }
}

// ═══ HEALTH — Santé composants ═══

export async function getLiftHealth(liftId: string): Promise<LiftHealth | null> {
  try {
    const data = await sigma4Fetch<any>(`/lifts/${liftId}/health`);
    return mapSigmaHealth(data);
  } catch {
    const { data } = await supabase.from('iot_health').select('*').eq('lift_id', liftId).single();
    return data || null;
  }
}

export async function getAllHealthScores(): Promise<LiftHealth[]> {
  try {
    const data = await sigma4Fetch<any[]>('/health');
    return (data || []).map(mapSigmaHealth);
  } catch {
    const { data } = await supabase.from('iot_health').select('*').order('score_global');
    return data || [];
  }
}

// ═══ REMOTE CONTROL ═══

export async function sendRemoteCommand(liftId: string, command: RemoteCommand, params?: Record<string, any>): Promise<{ success: boolean; message: string }> {
  try {
    const data = await sigma4Fetch<any>(`/lifts/${liftId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, ...params }),
    });
    return { success: true, message: data.message || `Commande "${command}" envoyée` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Échec de la commande' };
  }
}

// ═══ DASHBOARD STATS (agrégation) ═══

export async function getIoTDashboardStats(): Promise<IoTDashboardStats> {
  const lifts = await getLiftStatuses();
  const alerts = await getActiveAlerts();
  const enLigne = lifts.filter(l => l.connecte).length;
  const enPanne = lifts.filter(l => l.etat === 'hors_service' || l.etat === 'alarme').length;
  const dispo = lifts.length > 0 ? Math.round(((lifts.length - enPanne) / lifts.length) * 100) : 100;

  // Compteurs trafic du jour
  let trajets = 0;
  try {
    const data = await sigma4Fetch<any>('/traffic/today');
    trajets = data?.total || 0;
  } catch {}

  // Emprisonnements 24h
  let empris = 0;
  try {
    const data = await sigma4Fetch<any[]>('/events?type=emprisonnement&since=24h');
    empris = (data || []).length;
  } catch {}

  return { totalAscenseurs: lifts.length, enLigne, horsLigne: lifts.length - enLigne, enPanne, alertesActives: alerts.length, emprisonnements24h: empris, trajetsAujourdhui: trajets, disponibiliteMoyenne: dispo };
}

// ═══ SYNC Sigma4 → Supabase cache ═══

export async function syncToSupabaseCache(): Promise<{ synced: number; errors: number }> {
  if (!isConnectedToSigma4()) return { synced: 0, errors: 0 };
  let synced = 0, errors = 0;
  try {
    const lifts = await sigma4Fetch<any[]>('/lifts');
    for (const l of lifts || []) {
      const mapped = mapSigmaLift(l);
      const { error } = await supabase.from('iot_lifts').upsert({
        lift_id: mapped.liftId, nom: mapped.nom, adresse: mapped.adresse,
        lat: mapped.lat, lng: mapped.lng, etat: mapped.etat, etage: mapped.etage,
        etage_max: mapped.etageMax, position_mm: mapped.positionMm, porte: mapped.porte,
        en_mouvement: mapped.enMouvement, direction: mapped.direction,
        batterie_percent: mapped.batteriePercent, temperature_machinerie: mapped.temperatureMachinerie,
        securites_ok: mapped.securitesOk, connecte: mapped.connecte,
        dernier_signal: mapped.dernierSignal, firmware_version: mapped.firmwareVersion,
        hardware_version: mapped.hardwareVersion, controller_type: mapped.controllerType,
      }, { onConflict: 'lift_id' });
      if (error) errors++; else synced++;
    }
  } catch { errors++; }
  return { synced, errors };
}

// ═══ REALTIME — Supabase (pour cache local) ═══

export function subscribeToLiftUpdates(callback: (payload: any) => void) {
  return supabase.channel('iot-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_lifts' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_alerts' }, callback)
    .subscribe();
}

export function subscribeToAlerts(callback: (alert: LiftAlert) => void) {
  return supabase.channel('iot-alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_alerts' }, (p) => callback(p.new as LiftAlert))
    .subscribe();
}

// ═══ MAPPERS — Sigma4 API → types locaux ═══
// Les noms de champs Sigma4 peuvent varier, on gère toutes les variantes

function mapSigmaLift(d: any): LiftStatus {
  return {
    liftId: d.id || d.liftId || d.lift_id || '',
    ascenseurId: d.ascenseurId || d.ascenseur_id,
    nom: d.name || d.nom || d.description || '',
    adresse: d.address || d.adresse || d.location || '',
    lat: d.lat || d.latitude,
    lng: d.lng || d.longitude,
    etat: mapEtat(d.status || d.state || d.etat),
    etage: d.floor ?? d.etage ?? d.currentFloor ?? 0,
    etageMax: d.maxFloor ?? d.etageMax ?? d.totalFloors ?? 10,
    positionMm: d.positionMm ?? d.position ?? 0,
    porte: mapPorte(d.doorStatus || d.door || d.porte),
    enMouvement: d.moving ?? d.enMouvement ?? d.isMoving ?? false,
    direction: mapDirection(d.direction || d.dir),
    batteriePercent: d.battery ?? d.batteryPercent ?? d.batteriePercent ?? 100,
    temperatureMachinerie: d.temperature ?? d.machineTemp ?? d.temperatureMachinerie ?? 22,
    securitesOk: d.safetyOk ?? d.securitesOk ?? d.safetyDevicesOk ?? true,
    connecte: d.connected ?? d.online ?? d.connecte ?? true,
    dernierSignal: d.lastSignal || d.dernierSignal || d.lastSeen || new Date().toISOString(),
    firmwareVersion: d.firmwareVersion || d.fwVersion || d.firmware || '',
    hardwareVersion: d.hardwareVersion || d.hwVersion || d.hardware || '',
    controllerType: d.controllerType || d.controller || d.boardType || 'MP ecoGO',
  };
}

function mapSigmaAlert(d: any): LiftAlert {
  return {
    id: d.id || d.alertId || '',
    liftId: d.liftId || d.lift_id || d.elevatorId || '',
    niveau: mapNiveau(d.level || d.severity || d.niveau),
    type: (d.type || d.eventType || 'erreur') as TypeEvenement,
    message: d.message || d.description || d.text || '',
    timestamp: d.timestamp || d.date || d.createdAt || new Date().toISOString(),
    acquittee: d.acknowledged ?? d.acquittee ?? false,
    acquittePar: d.acknowledgedBy,
    acquitteDate: d.acknowledgedAt,
  };
}

function mapSigmaEvent(d: any): LiftEvent {
  return {
    id: d.id || d.eventId || '',
    liftId: d.liftId || d.lift_id || d.elevatorId || '',
    type: (d.type || d.eventType || 'trajet') as TypeEvenement,
    description: d.description || d.message || d.text || '',
    timestamp: d.timestamp || d.date || new Date().toISOString(),
    details: d.details || d.data,
  };
}

function mapSigmaTraffic(d: any): TrafficStats {
  return {
    liftId: d.liftId || d.lift_id || '',
    date: d.date || '',
    trajetsTotal: d.totalTrips ?? d.trajetsTotal ?? 0,
    trajetsParHeure: d.tripsPerHour || d.trajetsParHeure || [],
    etagesPlusFrequentes: d.topFloors || d.etagesPlusFrequentes || [],
    tempsArretMoyen: d.avgStopTime ?? d.tempsArretMoyen ?? 0,
    consommationKwh: d.consumption ?? d.consommationKwh,
  };
}

function mapSigmaHealth(d: any): LiftHealth {
  return {
    liftId: d.liftId || d.lift_id || '',
    scoreGlobal: d.globalScore ?? d.scoreGlobal ?? d.score ?? 100,
    moteur: d.motor ?? d.moteur ?? 100,
    portes: d.doors ?? d.portes ?? 100,
    cables: d.cables ?? d.ropes ?? 100,
    frein: d.brake ?? d.frein ?? 100,
    variateur: d.inverter ?? d.variateur ?? d.drive ?? 100,
    dernierCalcul: d.lastCalculation || d.dernierCalcul || new Date().toISOString(),
  };
}

function mapDbLift(d: any): LiftStatus {
  return {
    liftId: d.lift_id, nom: d.nom, adresse: d.adresse, lat: d.lat, lng: d.lng,
    etat: d.etat, etage: d.etage, etageMax: d.etage_max, positionMm: d.position_mm,
    porte: d.porte, enMouvement: d.en_mouvement, direction: d.direction,
    batteriePercent: d.batterie_percent, temperatureMachinerie: d.temperature_machinerie,
    securitesOk: d.securites_ok, connecte: d.connecte, dernierSignal: d.dernier_signal,
    firmwareVersion: d.firmware_version, hardwareVersion: d.hardware_version,
    controllerType: d.controller_type,
  };
}

function mapEtat(s: string): EtatAscenseur {
  const map: Record<string, EtatAscenseur> = {
    normal: 'normal', running: 'normal', active: 'normal', 'in_service': 'normal',
    inspection: 'inspection', test: 'inspection',
    'out_of_service': 'hors_service', stopped: 'hors_service', disabled: 'hors_service', hors_service: 'hors_service',
    entrapment: 'emprisonnement', trapped: 'emprisonnement', emprisonnement: 'emprisonnement',
    alarm: 'alarme', error: 'alarme', fault: 'alarme', alarme: 'alarme',
    maintenance: 'maintenance', service: 'maintenance',
  };
  return map[s?.toLowerCase()] || 'normal';
}

function mapPorte(s: string): EtatPorte {
  const map: Record<string, EtatPorte> = {
    open: 'ouverte', opened: 'ouverte', ouverte: 'ouverte',
    closed: 'fermee', fermee: 'fermee',
    moving: 'en_mouvement', opening: 'en_mouvement', closing: 'en_mouvement', en_mouvement: 'en_mouvement',
    blocked: 'bloquee', stuck: 'bloquee', bloquee: 'bloquee',
  };
  return map[s?.toLowerCase()] || 'fermee';
}

function mapDirection(s: string): 'up' | 'down' | 'idle' {
  if (!s) return 'idle';
  const low = s.toLowerCase();
  if (low === 'up' || low === 'montee' || low === 'ascending') return 'up';
  if (low === 'down' || low === 'descente' || low === 'descending') return 'down';
  return 'idle';
}

function mapNiveau(s: string): NiveauAlerte {
  const map: Record<string, NiveauAlerte> = {
    info: 'info', low: 'info', notice: 'info',
    warning: 'warning', warn: 'warning', medium: 'warning',
    critical: 'critical', high: 'critical', error: 'critical',
    emergency: 'emergency', urgent: 'emergency', fatal: 'emergency',
  };
  return map[s?.toLowerCase()] || 'info';
}

// ═══ CONSTANTES UI ═══

export const ETAT_CONFIG: Record<EtatAscenseur, { label: string; couleur: string; icon: string }> = {
  normal:          { label: 'En service',      couleur: '#059669', icon: '✅' },
  inspection:      { label: 'Inspection',      couleur: '#3B82F6', icon: '🔍' },
  hors_service:    { label: 'Hors service',    couleur: '#DC2626', icon: '🔴' },
  emprisonnement:  { label: 'Emprisonnement',  couleur: '#DC2626', icon: '🚨' },
  alarme:          { label: 'Alarme',          couleur: '#EA580C', icon: '⚠️' },
  maintenance:     { label: 'Maintenance',     couleur: '#8B5CF6', icon: '🔧' },
};

export const NIVEAU_ALERTE: Record<NiveauAlerte, { label: string; couleur: string }> = {
  info:      { label: 'Info',      couleur: '#3B82F6' },
  warning:   { label: 'Attention', couleur: '#CA8A04' },
  critical:  { label: 'Critique',  couleur: '#EA580C' },
  emergency: { label: 'Urgence',   couleur: '#DC2626' },
};
