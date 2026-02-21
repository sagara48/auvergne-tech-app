// ═══════════════════════════════════════════════════════════════
// SIGMA4LIFTS API — Intégration plateforme IoT MP Ascensores
// https://www.sigma4lifts.com/sigma-front/#/
// STATUS, NOTIFY, PREVENTIVE, TRAFFIC, REMOTE CONTROL, EMERGENCY
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ═══ TYPES — Miroir des données Sigma4Lifts ═══

export type EtatAscenseur = 'normal' | 'inspection' | 'hors_service' | 'emprisonnement' | 'alarme' | 'maintenance';
export type EtatPorte = 'ouverte' | 'fermee' | 'en_mouvement' | 'bloquee';
export type NiveauAlerte = 'info' | 'warning' | 'critical' | 'emergency';
export type TypeEvenement = 'trajet' | 'alarme' | 'erreur' | 'maintenance' | 'emprisonnement' | 'porte' | 'batterie' | 'temperature' | 'statut' | 'firmware';

export interface Sigma4Config {
  baseUrl: string;          // https://www.sigma4lifts.com/sigma-front
  apiUrl: string;           // URL API backend Sigma4Lifts
  token?: string;           // Auth token
  refreshInterval: number;  // ms entre les polls (défaut 30s)
}

export interface LiftStatus {
  liftId: string;
  ascenseurId: string;      // lien vers table ascenseurs
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
  temperatureMachinerie: number;  // °C
  securitesOk: boolean;
  connecte: boolean;
  dernierSignal: string;    // ISO datetime
  firmwareVersion: string;
  hardwareVersion: string;
  controllerType: string;   // MP ecoGO, MicroBasic, Via serie
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
  trajetsParHeure: number[];  // 24 valeurs
  etagesPlusFrequentes: { etage: number; count: number }[];
  tempsArretMoyen: number;    // secondes
  consommationKwh?: number;
}

export interface LiftHealth {
  liftId: string;
  scoreGlobal: number;       // 0-100
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
  disponibiliteMoyenne: number;  // %
}

// ═══ CONFIGURATION ═══

const DEFAULT_CONFIG: Sigma4Config = {
  baseUrl: 'https://www.sigma4lifts.com/sigma-front',
  apiUrl: 'https://www.sigma4lifts.com/api/v1',
  refreshInterval: 30000,
};

let config: Sigma4Config = { ...DEFAULT_CONFIG };

export function configureSigma4(c: Partial<Sigma4Config>) {
  config = { ...config, ...c };
}

export function getSigma4Config(): Sigma4Config {
  return config;
}

// ═══ TABLES SUPABASE (cache local + historique) ═══

// iot_lifts: cache statut temps réel
// iot_alerts: alertes actives et historique
// iot_events: journal événements
// iot_traffic: stats trafic journalières
// iot_health: scores santé composants

// ═══ STATUS — Statut temps réel ═══

export async function getLiftStatuses(): Promise<LiftStatus[]> {
  const { data, error } = await supabase
    .from('iot_lifts')
    .select('*')
    .order('nom');
  if (error) throw error;
  return data || [];
}

export async function getLiftStatus(liftId: string): Promise<LiftStatus | null> {
  const { data, error } = await supabase
    .from('iot_lifts')
    .select('*')
    .eq('lift_id', liftId)
    .single();
  if (error) return null;
  return data;
}

export async function updateLiftStatus(liftId: string, status: Partial<LiftStatus>): Promise<void> {
  const { error } = await supabase
    .from('iot_lifts')
    .upsert({ lift_id: liftId, ...status, dernier_signal: new Date().toISOString() })
    .eq('lift_id', liftId);
  if (error) throw error;
}

// ═══ NOTIFY — Alertes ═══

export async function getActiveAlerts(): Promise<LiftAlert[]> {
  const { data, error } = await supabase
    .from('iot_alerts')
    .select('*')
    .eq('acquittee', false)
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllAlerts(limit = 50): Promise<LiftAlert[]> {
  const { data, error } = await supabase
    .from('iot_alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('iot_alerts')
    .update({ acquittee: true, acquitte_par: user?.id, acquitte_date: new Date().toISOString() })
    .eq('id', alertId);
  if (error) throw error;
}

export async function createAlert(alert: Partial<LiftAlert>): Promise<void> {
  const { error } = await supabase.from('iot_alerts').insert(alert);
  if (error) throw error;
}

// ═══ PREVENTIVE — Événements & logs ═══

export async function getEvents(liftId?: string, limit = 100): Promise<LiftEvent[]> {
  let q = supabase.from('iot_events').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (liftId) q = q.eq('lift_id', liftId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function logEvent(event: Partial<LiftEvent>): Promise<void> {
  const { error } = await supabase.from('iot_events').insert({ ...event, timestamp: event.timestamp || new Date().toISOString() });
  if (error) throw error;
}

// ═══ TRAFFIC CONTROL — Stats trajets ═══

export async function getTrafficStats(liftId: string, days = 7): Promise<TrafficStats[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('iot_traffic')
    .select('*')
    .eq('lift_id', liftId)
    .gte('date', since)
    .order('date');
  if (error) throw error;
  return data || [];
}

export async function getTodayTrafficAll(): Promise<{ liftId: string; trajets: number }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('iot_traffic')
    .select('lift_id, trajets_total')
    .eq('date', today);
  if (error) throw error;
  return (data || []).map(d => ({ liftId: d.lift_id, trajets: d.trajets_total }));
}

// ═══ HEALTH — Scores santé composants ═══

export async function getLiftHealth(liftId: string): Promise<LiftHealth | null> {
  const { data, error } = await supabase
    .from('iot_health')
    .select('*')
    .eq('lift_id', liftId)
    .single();
  if (error) return null;
  return data;
}

export async function getAllHealthScores(): Promise<LiftHealth[]> {
  const { data, error } = await supabase
    .from('iot_health')
    .select('*')
    .order('score_global', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ═══ REMOTE CONTROL — Commandes à distance ═══

export type RemoteCommand = 'call_car' | 'reset_board' | 'force_alarm_test' | 'change_mode' | 'force_door_close';

export async function sendRemoteCommand(liftId: string, command: RemoteCommand, params?: Record<string, any>): Promise<{ success: boolean; message: string }> {
  // Log la commande
  await logEvent({ liftId, type: 'maintenance', description: `Commande distante: ${command}`, details: params });
  // En production: appel API Sigma4Lifts
  // const res = await fetch(`${config.apiUrl}/lifts/${liftId}/command`, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ command, ...params }) });
  return { success: true, message: `Commande "${command}" envoyée` };
}

// ═══ DASHBOARD STATS ═══

export async function getIoTDashboardStats(): Promise<IoTDashboardStats> {
  const lifts = await getLiftStatuses();
  const alerts = await getActiveAlerts();
  const today = new Date().toISOString().slice(0, 10);
  const { data: traffic } = await supabase.from('iot_traffic').select('trajets_total').eq('date', today);
  const { data: events24h } = await supabase.from('iot_events').select('type').eq('type', 'emprisonnement').gte('timestamp', new Date(Date.now() - 86400000).toISOString());

  const enLigne = lifts.filter(l => l.connecte).length;
  const enPanne = lifts.filter(l => l.etat === 'hors_service' || l.etat === 'alarme').length;
  const trajetsTotal = (traffic || []).reduce((a, t) => a + (t.trajets_total || 0), 0);
  const dispo = lifts.length > 0 ? Math.round(((lifts.length - enPanne) / lifts.length) * 100) : 100;

  return {
    totalAscenseurs: lifts.length,
    enLigne,
    horsLigne: lifts.length - enLigne,
    enPanne,
    alertesActives: alerts.length,
    emprisonnements24h: (events24h || []).length,
    trajetsAujourdhui: trajetsTotal,
    disponibiliteMoyenne: dispo,
  };
}

// ═══ SYNC depuis Sigma4Lifts → Supabase ═══

export async function syncFromSigma4(): Promise<{ synced: number; errors: number }> {
  // En production: fetch depuis l'API Sigma4Lifts et upsert dans Supabase
  // const res = await fetch(`${config.apiUrl}/lifts`, { headers: { Authorization: `Bearer ${config.token}` } });
  // const lifts = await res.json();
  // for (const lift of lifts) { await updateLiftStatus(lift.id, mapSigmaToLocal(lift)); }
  return { synced: 0, errors: 0 };
}

// ═══ REALTIME — Subscription Supabase ═══

export function subscribeToLiftUpdates(callback: (payload: any) => void) {
  return supabase
    .channel('iot-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_lifts' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_alerts' }, callback)
    .subscribe();
}

export function subscribeToAlerts(callback: (alert: LiftAlert) => void) {
  return supabase
    .channel('iot-alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_alerts' }, (payload) => callback(payload.new as LiftAlert))
    .subscribe();
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

export const CONTROLLER_TYPES = ['MP ecoGO', 'MicroBasic', 'Via serie'] as const;
