// ═══════════════════════════════════════════════════════════════
// IOT STATUS BADGE — Badge IoT temps réel pour fiche ascenseur
// Affiche l'état Sigma4 dans ParcAscenseursPage
// Usage: <IoTStatusBadge codeAppareil="AUV-042" />
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radio, Wifi, WifiOff, XCircle, Wrench, CheckCircle2,
  Activity, AlertTriangle, ChevronRight, Loader2, Link2,
  Clock, Zap, Shield,
} from 'lucide-react';
import { Card, CardBody, Badge } from '@/components/ui';
import { supabase } from '@/services/supabase';
import {
  isConnectedToSigma4, getLifts, getMonitorOnline,
  Sigma4Lift,
} from '@/services/sigma4liftsApi';

// ═══ TYPES ═══

interface IoTStatusData {
  lift: Sigma4Lift | null;
  linked: boolean;
  dbLinkId: string | null;
}

// ═══ BADGE COMPACT (pour AscenseurCard / AscenseurRow) ═══

export function IoTStatusDot({ codeAppareil }: { codeAppareil: string }) {
  const { data } = useIoTStatus(codeAppareil);

  if (!data || !data.lift) return null;

  const info = getEstadoStyle(data.lift.estado);

  return (
    <span
      title={`IoT: ${info.label}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${info.pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: `${info.color}15`, color: info.color }}
    >
      <Radio className="w-2.5 h-2.5" />
      {info.short}
    </span>
  );
}

// ═══ BADGE INLINE (pour la barre de titre du modal) ═══

export function IoTStatusInline({ codeAppareil }: { codeAppareil: string }) {
  const { data, isLoading } = useIoTStatus(codeAppareil);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#059669]/10 text-[10px] text-[#059669] font-bold">
        <Loader2 className="w-3 h-3 animate-spin" /> IoT…
      </span>
    );
  }

  if (!data || !data.lift) return null;

  const info = getEstadoStyle(data.lift.estado);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${info.pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: `${info.color}15`, color: info.color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
      IoT: {info.label}
    </span>
  );
}

// ═══ PANNEAU COMPLET (pour l'onglet Info du modal ascenseur) ═══

export function IoTStatusPanel({ codeAppareil, ascenseurId }: { codeAppareil: string; ascenseurId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useIoTStatus(codeAppareil);

  // Données monitor live si expandé
  const { data: monitor } = useQuery({
    queryKey: ['sigma4', 'monitor-badge', data?.lift?.id],
    queryFn: () => data?.lift ? getMonitorOnline(data.lift.id) : null,
    enabled: expanded && !!data?.lift,
    staleTime: 15000,
    refetchInterval: expanded ? 15000 : false,
  });

  // Récupérer les alertes Supabase liées
  const { data: alerts } = useQuery({
    queryKey: ['iot-alerts-badge', data?.lift?.id],
    queryFn: async () => {
      if (!data?.lift) return [];
      const { data: rows } = await supabase
        .from('iot_alerts')
        .select('*')
        .eq('lift_id', String(data.lift.id))
        .eq('acquittee', false)
        .order('timestamp', { ascending: false })
        .limit(5);
      return rows || [];
    },
    enabled: !!data?.lift,
    staleTime: 60000,
  });

  if (!isConnectedToSigma4()) return null;

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#059669]" />
          <span className="text-xs text-[var(--text-muted)]">Recherche IoT…</span>
        </CardBody>
      </Card>
    );
  }

  if (!data || !data.lift) {
    return (
      <Card className="border-dashed border-[var(--border-secondary)]">
        <CardBody className="p-3 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-[var(--text-muted)] opacity-40" />
          <span className="text-xs text-[var(--text-muted)]">Aucun appareil IoT Sigma4 lié à cet ascenseur</span>
        </CardBody>
      </Card>
    );
  }

  const lift = data.lift;
  const info = getEstadoStyle(lift.estado);
  const Icon = info.icon;

  return (
    <Card className="overflow-hidden" style={{ borderColor: `${info.color}30` }}>
      <CardBody className="p-0">
        {/* Header cliquable */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${info.color}15` }}>
            <Radio className={`w-4.5 h-4.5 ${info.pulse ? 'animate-pulse' : ''}`}
              style={{ color: info.color }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">Sigma4 IoT</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ backgroundColor: `${info.color}15`, color: info.color }}>
                {info.label}
              </span>
              {alerts && alerts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#DC2626] text-white text-[10px] font-bold">
                  {alerts.length}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate">
              Ref S4L: {lift.liftCompRef} · {lift.city}
              {data.linked && <Link2 className="w-3 h-3 inline ml-1 text-[#059669]" />}
            </p>
          </div>
          <ChevronRight className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {/* Détails expandés */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-[var(--border-secondary)] space-y-2.5">
            {/* KPIs rapides */}
            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                icon={Activity} label="État" value={info.label} color={info.color}
              />
              <MiniStat
                icon={Wifi} label="Connexion"
                value={lift.estado !== 90 ? 'Connecté' : 'Perdu'}
                color={lift.estado !== 90 ? '#059669' : '#EA580C'}
              />
              <MiniStat
                icon={Zap} label="Arrêts" value={String(lift.numeroParadas || '?')} color="#3B82F6"
              />
              <MiniStat
                icon={Shield} label="Sécurités"
                value={monitor?.securityChain ? 'OK' : '?'}
                color={monitor?.securityChain ? '#059669' : '#64748B'}
              />
            </div>

            {/* Monitor live */}
            {monitor && (
              <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] space-y-1">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Données temps réel</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Étage: </span>
                    <span className="font-bold font-mono">{monitor.floor ?? '?'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Direction: </span>
                    <span className="font-bold">{monitor.direction === 1 ? '↑' : monitor.direction === 2 ? '↓' : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Porte: </span>
                    <span className="font-bold">{monitor.door1Opened ? 'Ouverte' : 'Fermée'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alertes actives */}
            {alerts && alerts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#DC2626] uppercase">Alertes actives</p>
                {alerts.slice(0, 3).map((alert: any) => (
                  <div key={alert.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-[#DC2626]/5">
                    <AlertTriangle className="w-3 h-3 text-[#DC2626] flex-shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)] truncate">{alert.message}</span>
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                      {new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Infos techniques */}
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
              {lift.modeloAscensor && (
                <div><span className="font-semibold">Contrôleur:</span> {lift.modeloAscensor}</div>
              )}
              {lift.versionSW && (
                <div><span className="font-semibold">Firmware:</span> {lift.versionSW}</div>
              )}
              {lift.tipoEnlace != null && (
                <div><span className="font-semibold">Liaison:</span> {lift.tipoEnlace === 1 ? '4G' : lift.tipoEnlace === 2 ? 'Ethernet' : `Type ${lift.tipoEnlace}`}</div>
              )}
              <div>
                <span className="font-semibold">Dernière sync:</span> {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ═══ HOOK INTERNE ═══

function useIoTStatus(codeAppareil: string) {
  return useQuery<IoTStatusData | null>({
    queryKey: ['iot-status', codeAppareil],
    queryFn: async () => {
      if (!isConnectedToSigma4()) return null;

      // 1. Chercher dans iot_lifts Supabase (lien ascenseur_id)
      const { data: dbLink } = await supabase
        .from('iot_lifts')
        .select('lift_id')
        .eq('nom', codeAppareil)
        .maybeSingle();

      // 2. Chercher dans S4L API par liftCompRef
      const lifts = await getLifts();
      const match = lifts.find(l =>
        l.liftCompRef === codeAppareil ||
        l.liftCompRef?.includes(codeAppareil) ||
        codeAppareil.includes(l.liftCompRef || '')
      );

      if (!match && !dbLink) return { lift: null, linked: false, dbLinkId: null };

      // Si trouvé par API
      if (match) {
        return {
          lift: match,
          linked: !!dbLink,
          dbLinkId: dbLink?.lift_id || null,
        };
      }

      // Si seulement lien DB, chercher dans lifts par ID
      if (dbLink) {
        const byId = lifts.find(l => String(l.id) === dbLink.lift_id);
        return {
          lift: byId || null,
          linked: true,
          dbLinkId: dbLink.lift_id,
        };
      }

      return { lift: null, linked: false, dbLinkId: null };
    },
    enabled: isConnectedToSigma4(),
    staleTime: 120000,
    retry: 1,
  });
}

// ═══ HELPERS ═══

function getEstadoStyle(estado: number): {
  label: string; short: string; color: string;
  icon: typeof Radio; pulse: boolean;
} {
  switch (estado) {
    case 0: return { label: 'En marche (0)', short: 'OK (0)', color: '#059669', icon: CheckCircle2, pulse: false };
    case 1: return { label: 'SOS (1)', short: 'SOS (1)', color: '#DC2626', icon: XCircle, pulse: true };
    case 7: return { label: 'Reset position (7)', short: 'RESET (7)', color: '#CA8A04', icon: AlertTriangle, pulse: false };
    case 8: return { label: 'MES (8)', short: 'MES (8)', color: '#3B82F6', icon: Wrench, pulse: false };
    case 10: return { label: 'Arrêté (10)', short: 'ARRÊT (10)', color: '#DC2626', icon: XCircle, pulse: true };
    case 15: return { label: 'Panne (15)', short: 'PANNE (15)', color: '#DC2626', icon: XCircle, pulse: true };
    case 20: return { label: 'Maintenance (20)', short: 'MAINT (20)', color: '#8B5CF6', icon: Wrench, pulse: false };
    case 90: return { label: 'Sans connexion (90)', short: 'H.L. (90)', color: '#EA580C', icon: WifiOff, pulse: false };
    case 91: return { label: 'Résilié (91)', short: 'RÉSILIÉ (91)', color: '#64748B', icon: AlertTriangle, pulse: false };
    default:
      if (estado >= 1 && estado <= 9) return { label: `Opérationnel (${estado})`, short: `OK (${estado})`, color: '#059669', icon: CheckCircle2, pulse: false };
      if (estado >= 10 && estado <= 19) return { label: `Arrêté (${estado})`, short: `ARRÊT (${estado})`, color: '#DC2626', icon: XCircle, pulse: true };
      if (estado >= 20 && estado <= 39) return { label: `Maintenance (${estado})`, short: `MAINT (${estado})`, color: '#8B5CF6', icon: Wrench, pulse: false };
      if (estado >= 40 && estado <= 59) return { label: `Hors service (${estado})`, short: `H.S. (${estado})`, color: '#64748B', icon: AlertTriangle, pulse: false };
      if (estado >= 60 && estado <= 89) return { label: `Urgence (${estado})`, short: `URG (${estado})`, color: '#DC2626', icon: AlertTriangle, pulse: true };
      if (estado >= 90) return { label: `Déconnecté (${estado})`, short: `(${estado})`, color: '#EA580C', icon: WifiOff, pulse: false };
      return { label: `État (${estado})`, short: `(${estado})`, color: '#64748B', icon: AlertTriangle, pulse: false };
  }
}

function MiniStat({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: string;
}) {
  return (
    <div className="text-center p-1.5 rounded-lg bg-[var(--bg-tertiary)]">
      <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color }} />
      <p className="text-xs font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
