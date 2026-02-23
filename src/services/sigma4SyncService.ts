// ═══════════════════════════════════════════════════════════════
// SIGMA4 SYNC SERVICE — Synchronise S4L API → Supabase iot_*
// Push état des ascenseurs, alertes automatiques, trafic
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/services/supabase';
import {
  isConnectedToSigma4, getLifts, getDashboard, getLiftErrors,
  Sigma4Lift, Sigma4MessageEntry,
} from '@/services/sigma4liftsApi';
import { lookupErrorCode, severityFromApi } from '@/services/sigma4ErrorCodes';

// ═══ TYPES ═══

interface IotLiftRow {
  lift_id: string;
  ascenseur_id?: string | null;
  nom: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  etat: string;
  etage: number;
  etage_max: number;
  position_mm: number;
  porte: string;
  en_mouvement: boolean;
  direction: string;
  batterie_percent: number;
  securites_ok: boolean;
  connecte: boolean;
  dernier_signal: string;
  firmware_version: string;
  hardware_version: string;
  controller_type: string;
}

interface IotAlertRow {
  lift_id: string;
  niveau: string;
  type: string;
  message: string;
  timestamp: string;
}

// ═══ MAPPING HELPERS ═══

function mapEstadoToEtat(estado: number): string {
  switch (estado) {
    case 0: return 'normal';
    case 10: return 'arret';
    case 20: return 'maintenance';
    case 90: return 'deconnecte';
    default: return 'inconnu';
  }
}

function mapEstadoToConnecte(estado: number): boolean {
  return estado !== 90;
}

/** Mappe un lift S4L vers une ligne iot_lifts Supabase */
function liftToIotRow(lift: Sigma4Lift): IotLiftRow {
  return {
    lift_id: String(lift.id),
    nom: lift.liftCompRef || '',
    adresse: [lift.address, lift.zipCode, lift.city].filter(Boolean).join(', '),
    lat: lift.latitude !== 0 ? lift.latitude : null,
    lng: lift.longitude !== 0 ? lift.longitude : null,
    etat: mapEstadoToEtat(lift.estado),
    etage: 0, // sera mis à jour par le monitor
    etage_max: lift.numeroParadas || 10,
    position_mm: 0,
    porte: 'fermee',
    en_mouvement: false,
    direction: 'idle',
    batterie_percent: 100,
    securites_ok: true,
    connecte: mapEstadoToConnecte(lift.estado),
    dernier_signal: new Date().toISOString(),
    firmware_version: lift.versionSW || '',
    hardware_version: '',
    controller_type: lift.modeloAscensor || 'MP ecoGO',
  };
}

// ═══ LINK SIGMA4 ↔ ASCENSEURS ═══

/** Tente de lier automatiquement un lift S4L à un ascenseur Supabase par code/adresse/ville */
async function autoLinkLift(lift: Sigma4Lift): Promise<string | null> {
  // 1. Match exact par code (liftCompRef ≈ code ascenseur)
  const { data: byCode } = await supabase
    .from('ascenseurs')
    .select('id')
    .eq('code', lift.liftCompRef)
    .maybeSingle();
  if (byCode?.id) return byCode.id;

  // 2. Match par ville + adresse (fuzzy)
  if (lift.city && lift.address) {
    const { data: byAddr } = await supabase
      .from('ascenseurs')
      .select('id, adresse, ville')
      .ilike('ville', `%${lift.city}%`)
      .limit(5);
    if (byAddr && byAddr.length > 0) {
      const addrLower = lift.address.toLowerCase();
      const match = byAddr.find(a =>
        a.adresse?.toLowerCase().includes(addrLower) ||
        addrLower.includes(a.adresse?.toLowerCase() || '')
      );
      if (match) return match.id;
    }
  }

  return null;
}

// ═══ SYNC LIFTS ═══

/** Synchronise tous les lifts S4L → iot_lifts Supabase (upsert) */
export async function syncLiftsToSupabase(): Promise<{ synced: number; linked: number; errors: string[] }> {
  if (!isConnectedToSigma4()) {
    return { synced: 0, linked: 0, errors: ['Non connecté à Sigma4'] };
  }

  const errors: string[] = [];
  let synced = 0;
  let linked = 0;

  try {
    const lifts = await getLifts();
    const activeLifts = lifts.filter(l => !l.baja);

    // Récupérer les liens existants
    const { data: existing } = await supabase
      .from('iot_lifts')
      .select('lift_id, ascenseur_id');

    const existingMap = new Map(existing?.map(e => [e.lift_id, e.ascenseur_id]) || []);

    // Préparer les rows
    const rows: (IotLiftRow & { ascenseur_id?: string | null })[] = [];

    for (const lift of activeLifts) {
      const row = liftToIotRow(lift);

      // Garder le lien existant ou tenter auto-link
      const existingLink = existingMap.get(row.lift_id);
      if (existingLink) {
        row.ascenseur_id = existingLink;
      } else {
        try {
          const autoLinked = await autoLinkLift(lift);
          if (autoLinked) {
            row.ascenseur_id = autoLinked;
            linked++;
          }
        } catch {} // silencieux
      }

      rows.push(row);
    }

    // Upsert par batch de 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase
        .from('iot_lifts')
        .upsert(batch, { onConflict: 'lift_id' });
      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
      } else {
        synced += batch.length;
      }
    }
  } catch (e: any) {
    errors.push(e.message || 'Erreur sync lifts');
  }

  return { synced, linked, errors };
}

// ═══ SYNC ALERTS ═══

/** Crée des alertes automatiques dans iot_alerts pour les ascenseurs en anomalie */
export async function syncAlertsToSupabase(): Promise<{ created: number; errors: string[] }> {
  if (!isConnectedToSigma4()) {
    return { created: 0, errors: ['Non connecté à Sigma4'] };
  }

  const errors: string[] = [];
  let created = 0;

  try {
    const lifts = await getLifts();
    const problemLifts = lifts.filter(l => !l.baja && l.estado !== 0);

    // Récupérer les alertes non-acquittées existantes pour éviter les doublons
    const { data: existingAlerts } = await supabase
      .from('iot_alerts')
      .select('lift_id, type, message')
      .eq('acquittee', false);

    const existingSet = new Set(existingAlerts?.map(a => `${a.lift_id}:${a.type}`) || []);

    const newAlerts: IotAlertRow[] = [];

    for (const lift of problemLifts) {
      const liftId = String(lift.id);
      const alertType = lift.estado === 10 ? 'arret' : lift.estado === 20 ? 'maintenance' : 'deconnexion';
      const key = `${liftId}:${alertType}`;

      if (!existingSet.has(key)) {
        const niveau = lift.estado === 10 ? 'critique' : lift.estado === 20 ? 'warning' : 'info';
        newAlerts.push({
          lift_id: liftId,
          niveau,
          type: alertType,
          message: `${lift.liftCompRef} — ${alertType === 'arret' ? 'Ascenseur arrêté' : alertType === 'maintenance' ? 'En maintenance' : 'Perte de connexion'} · ${lift.city || lift.address || ''}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (newAlerts.length > 0) {
      const { error } = await supabase.from('iot_alerts').insert(newAlerts);
      if (error) {
        errors.push(error.message);
      } else {
        created = newAlerts.length;
      }
    }

    // Auto-acquitter les alertes pour les lifts redevenus OK
    const okLiftIds = lifts
      .filter(l => !l.baja && l.estado === 0)
      .map(l => String(l.id));

    if (okLiftIds.length > 0) {
      await supabase
        .from('iot_alerts')
        .update({ acquittee: true, acquitte_date: new Date().toISOString() })
        .eq('acquittee', false)
        .in('lift_id', okLiftIds);
    }
  } catch (e: any) {
    errors.push(e.message || 'Erreur sync alerts');
  }

  return { created, errors };
}

// ═══ SYNC ERRORS (messages S4L → iot_alerts) ═══

/** Sync les erreurs récentes d'un lift vers iot_alerts avec sévérité */
export async function syncLiftErrorsToAlerts(liftId: number, days = 1): Promise<number> {
  try {
    const messages = await getLiftErrors(liftId, days);
    if (!messages || !Array.isArray(messages)) return 0;

    const errors = messages.filter((m: Sigma4MessageEntry) => {
      const dtype = (m.dtype || '').toUpperCase();
      return dtype === 'AVERIA' || dtype === 'ALARMA';
    });

    if (errors.length === 0) return 0;

    // Récupérer les alertes existantes pour ce lift (dernières 24h)
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: existing } = await supabase
      .from('iot_alerts')
      .select('message')
      .eq('lift_id', String(liftId))
      .gte('timestamp', since);

    const existingMessages = new Set(existing?.map(a => a.message) || []);

    const newAlerts: IotAlertRow[] = [];
    for (const msg of errors) {
      const content = (msg.content || '').trim();
      if (!content || content === '0000') continue;

      const lookup = lookupErrorCode(content);
      const desc = lookup?.description || `Code ${content}`;
      const severity = lookup?.severity;

      let niveau = 'info';
      if (severity === 'fatal_local') niveau = 'critique';
      else if (severity === 'fatal_remote') niveau = 'warning';
      else if (severity === 'leve') niveau = 'info';

      const message = `Erreur ${content} — ${desc}`;
      if (existingMessages.has(message)) continue;

      newAlerts.push({
        lift_id: String(liftId),
        niveau,
        type: 'erreur',
        message,
        timestamp: msg.systemDate || msg.messageDate || new Date().toISOString(),
      });
    }

    if (newAlerts.length > 0) {
      await supabase.from('iot_alerts').insert(newAlerts);
    }

    return newAlerts.length;
  } catch {
    return 0;
  }
}

// ═══ FULL SYNC ═══

/** Synchronisation complète : lifts + alertes état + alertes erreurs */
export async function fullSigma4Sync(): Promise<{
  lifts: { synced: number; linked: number };
  alerts: { created: number };
  errors: string[];
}> {
  const allErrors: string[] = [];

  const liftsResult = await syncLiftsToSupabase();
  allErrors.push(...liftsResult.errors);

  const alertsResult = await syncAlertsToSupabase();
  allErrors.push(...alertsResult.errors);

  return {
    lifts: { synced: liftsResult.synced, linked: liftsResult.linked },
    alerts: { created: alertsResult.created },
    errors: allErrors,
  };
}

// ═══ LINK MANAGEMENT ═══

/** Lie manuellement un lift S4L à un ascenseur Supabase */
export async function linkLiftToAscenseur(liftId: string, ascenseurId: string): Promise<boolean> {
  const { error } = await supabase
    .from('iot_lifts')
    .update({ ascenseur_id: ascenseurId })
    .eq('lift_id', liftId);
  return !error;
}

/** Délie un lift S4L d'un ascenseur Supabase */
export async function unlinkLift(liftId: string): Promise<boolean> {
  const { error } = await supabase
    .from('iot_lifts')
    .update({ ascenseur_id: null })
    .eq('lift_id', liftId);
  return !error;
}

/** Récupère l'état IoT d'un ascenseur Supabase (par son UUID) */
export async function getIotStatusForAscenseur(ascenseurId: string): Promise<{
  lift_id: string;
  nom: string;
  etat: string;
  connecte: boolean;
  dernier_signal: string;
  batterie_percent: number;
  securites_ok: boolean;
} | null> {
  const { data } = await supabase
    .from('iot_lifts')
    .select('lift_id, nom, etat, connecte, dernier_signal, batterie_percent, securites_ok')
    .eq('ascenseur_id', ascenseurId)
    .maybeSingle();
  return data;
}

/** Récupère les alertes actives d'un ascenseur */
export async function getAlertsForAscenseur(ascenseurId: string): Promise<any[]> {
  const { data: lift } = await supabase
    .from('iot_lifts')
    .select('lift_id')
    .eq('ascenseur_id', ascenseurId)
    .maybeSingle();

  if (!lift) return [];

  const { data: alerts } = await supabase
    .from('iot_alerts')
    .select('*')
    .eq('lift_id', lift.lift_id)
    .eq('acquittee', false)
    .order('timestamp', { ascending: false })
    .limit(10);

  return alerts || [];
}
