// ═══════════════════════════════════════════════════════════════
// SIGMA4 DASHBOARD WIDGETS — Widgets IoT pour le Dashboard global
// IoTFleetWidget, IoTAlertsWidget, IoTAvailabilityWidget
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radio, AlertTriangle, Wifi, WifiOff, Activity,
  ArrowRight, CheckCircle2, XCircle, Wrench, Loader2,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import {
  isConnectedToSigma4, getLifts, getSigma4Session,
  Sigma4Lift,
} from '@/services/sigma4liftsApi';
import { fullSigma4Sync } from '@/services/sigma4SyncService';
import { WidgetWrapper } from './widgets';
import { Badge } from '@/components/ui';

// ═══════════════════════════════════════════════════════════════
// WIDGET 1: ÉTAT DU PARC IoT
// Compteurs: En marche / Arrêtés / Maintenance / Déconnectés
// ═══════════════════════════════════════════════════════════════

export function IoTFleetWidget({ onRemove }: { onRemove?: () => void }) {
  const connected = isConnectedToSigma4();

  const { data: lifts, isLoading } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    enabled: connected,
    staleTime: 120000,
    retry: 1,
  });

  // Sync auto vers Supabase à chaque fetch
  useEffect(() => {
    if (lifts && lifts.length > 0) {
      fullSigma4Sync().catch(() => {});
    }
  }, [lifts]);

  const stats = useMemo(() => {
    if (!lifts) return null;
    const active = lifts.filter(l => !l.baja);
    return {
      total: active.length,
      ok: active.filter(l => l.estado >= 0 && l.estado <= 9).length,
      arret: active.filter(l => (l.estado >= 10 && l.estado <= 19) || (l.estado >= 60 && l.estado <= 89)).length,
      maintenance: active.filter(l => (l.estado >= 20 && l.estado <= 39) || (l.estado >= 40 && l.estado <= 59)).length,
      deconnecte: active.filter(l => l.estado >= 90).length,
    };
  }, [lifts]);

  if (!connected) {
    return (
      <WidgetWrapper title="Parc IoT Sigma4" icon={Radio} color="#059669" onRemove={onRemove}>
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
          <WifiOff className="w-8 h-8 text-[var(--text-muted)] opacity-30" />
          <p className="text-xs text-[var(--text-muted)]">Non connecté à Sigma4Lifts</p>
          <p className="text-xs text-[var(--text-tertiary)]">Ouvrez le module IoT pour vous connecter</p>
        </div>
      </WidgetWrapper>
    );
  }

  const counters = stats ? [
    { label: 'En marche', value: stats.ok, color: '#059669', bg: 'bg-[#059669]/10' },
    { label: 'Arrêtés', value: stats.arret, color: '#DC2626', bg: 'bg-[#DC2626]/10' },
    { label: 'Maintenance', value: stats.maintenance, color: '#8B5CF6', bg: 'bg-[#8B5CF6]/10' },
    { label: 'Déconnectés', value: stats.deconnecte, color: '#EA580C', bg: 'bg-[#EA580C]/10' },
  ] : [];

  return (
    <WidgetWrapper title="Parc IoT Sigma4" icon={Radio} color="#059669" onRemove={onRemove}>
      {isLoading ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#059669]" />
        </div>
      ) : (
        <div className="h-full flex flex-col gap-2">
          {/* Compteurs */}
          <div className="flex items-center justify-around gap-2 flex-1">
            {counters.map((c, i) => (
              <div key={i} className={`flex-1 ${c.bg} rounded-xl p-2.5 text-center`}>
                <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] font-semibold">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Barre progression */}
          {stats && stats.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Disponibilité parc</span>
                <span className="text-xs font-bold" style={{ color: '#059669' }}>
                  {((stats.ok / stats.total) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
                {stats.ok > 0 && (
                  <div className="h-full bg-[#059669]" style={{ width: `${(stats.ok / stats.total) * 100}%` }} />
                )}
                {stats.maintenance > 0 && (
                  <div className="h-full bg-[#8B5CF6]" style={{ width: `${(stats.maintenance / stats.total) * 100}%` }} />
                )}
                {stats.arret > 0 && (
                  <div className="h-full bg-[#DC2626]" style={{ width: `${(stats.arret / stats.total) * 100}%` }} />
                )}
                {stats.deconnecte > 0 && (
                  <div className="h-full bg-[#EA580C]" style={{ width: `${(stats.deconnecte / stats.total) * 100}%` }} />
                )}
              </div>
            </div>
          )}

          {/* Session info */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">
              <Wifi className="w-3 h-3 inline mr-1 text-[#059669]" />
              {getSigma4Session()?.userName}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{stats?.total} appareils</span>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════
// WIDGET 2: ALERTES IoT ACTIVES
// Liste les ascenseurs en anomalie avec détails
// ═══════════════════════════════════════════════════════════════

export function IoTAlertsWidget({ onRemove }: { onRemove?: () => void }) {
  const connected = isConnectedToSigma4();

  const { data: lifts } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    enabled: connected,
    staleTime: 120000,
    retry: 1,
  });

  // Aussi récupérer les alertes Supabase (enrichies)
  const { data: dbAlerts } = useQuery({
    queryKey: ['iot-alerts-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('iot_alerts')
        .select('*')
        .eq('acquittee', false)
        .order('timestamp', { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 60000,
  });

  const problemLifts = useMemo(() => {
    if (!lifts) return [];
    return lifts
      .filter(l => !l.baja && l.estado !== 0)
      .sort((a, b) => {
        const prio = (e: number) => {
          if (e >= 10 && e <= 19 || e >= 60 && e <= 69) return 0;
          if (e >= 90) return 1;
          return 2;
        };
        return prio(a.estado) - prio(b.estado);
      })
      .slice(0, 6);
  }, [lifts]);

  const getStatusInfo = (estado: number) => {
    switch (estado) {
      case 0: return { label: 'En marche (0)', color: '#059669', icon: CheckCircle2, pulse: false };
      case 1: return { label: 'SOS (1)', color: '#DC2626', icon: XCircle, pulse: true };
      case 7: return { label: 'Reset position (7)', color: '#CA8A04', icon: AlertTriangle, pulse: false };
      case 8: return { label: 'MES (8)', color: '#3B82F6', icon: Wrench, pulse: false };
      case 10: return { label: 'Arrêté (10)', color: '#DC2626', icon: XCircle, pulse: true };
      case 15: return { label: 'Panne (15)', color: '#DC2626', icon: XCircle, pulse: true };
      case 20: return { label: 'Maintenance (20)', color: '#8B5CF6', icon: Wrench, pulse: false };
      case 90: return { label: 'Sans connexion (90)', color: '#EA580C', icon: WifiOff, pulse: false };
      case 91: return { label: 'Connexion instable (91)', color: '#EA580C', icon: WifiOff, pulse: false };
      default:
        if (estado >= 1 && estado <= 9) return { label: `Opérationnel (${estado})`, color: '#059669', icon: CheckCircle2, pulse: false };
        if (estado >= 10 && estado <= 19) return { label: `Arrêté (${estado})`, color: '#DC2626', icon: XCircle, pulse: true };
        if (estado >= 20 && estado <= 39) return { label: `Maintenance (${estado})`, color: '#8B5CF6', icon: Wrench, pulse: false };
        if (estado >= 40 && estado <= 59) return { label: `Hors service (${estado})`, color: '#64748B', icon: AlertTriangle, pulse: false };
        if (estado >= 60 && estado <= 89) return { label: `Urgence (${estado})`, color: '#DC2626', icon: XCircle, pulse: true };
        if (estado >= 90) return { label: `Déconnecté (${estado})`, color: '#EA580C', icon: WifiOff, pulse: false };
        return { label: `État (${estado})`, color: '#64748B', icon: AlertTriangle, pulse: false };
    }
  };

  if (!connected) {
    return (
      <WidgetWrapper title="Alertes IoT" icon={AlertTriangle} color="#DC2626" onRemove={onRemove}>
        <div className="h-full flex items-center justify-center">
          <p className="text-xs text-[var(--text-muted)]">Non connecté</p>
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper title="Alertes IoT" icon={AlertTriangle} color="#DC2626" onRemove={onRemove} compact>
      {problemLifts.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-[#059669] opacity-40" />
          <p className="text-xs text-[#059669] font-semibold">Tous les appareils OK</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {problemLifts.map(lift => {
            const status = getStatusInfo(lift.estado);
            const Icon = status.icon;
            return (
              <div key={lift.id}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0`}
                  style={{ backgroundColor: `${status.color}15` }}>
                  <Icon className={`w-3.5 h-3.5 ${status.pulse ? 'animate-pulse' : ''}`}
                    style={{ color: status.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{lift.liftCompRef}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{lift.city || lift.address}</p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: `${status.color}15`, color: status.color }}>
                  {status.label}
                </span>
              </div>
            );
          })}
          {lifts && lifts.filter(l => !l.baja && l.estado !== 0).length > 6 && (
            <p className="text-[10px] text-center text-[var(--text-muted)]">
              +{lifts.filter(l => !l.baja && l.estado !== 0).length - 6} autres alertes
            </p>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════
// WIDGET 3: DISPONIBILITÉ IoT (graphique tendance)
// Taux de disponibilité + tendance
// ═══════════════════════════════════════════════════════════════

export function IoTAvailabilityWidget({ onRemove }: { onRemove?: () => void }) {
  const connected = isConnectedToSigma4();

  const { data: lifts } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    enabled: connected,
    staleTime: 120000,
    retry: 1,
  });

  // Récupérer l'historique des alertes pour la tendance
  const { data: alertHistory } = useQuery({
    queryKey: ['iot-alerts-history'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('iot_alerts')
        .select('timestamp, niveau, type')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });
      return data || [];
    },
    staleTime: 300000,
  });

  const stats = useMemo(() => {
    if (!lifts) return null;
    const active = lifts.filter(l => !l.baja);
    const total = active.length;
    if (total === 0) return null;
    const ok = active.filter(l => l.estado >= 0 && l.estado <= 9).length;
    const rate = (ok / total) * 100;

    // Tendance basée sur les alertes
    const today = alertHistory?.filter(a => {
      const d = new Date(a.timestamp);
      return d.toDateString() === new Date().toDateString();
    }).length || 0;

    const yesterday = alertHistory?.filter(a => {
      const d = new Date(a.timestamp);
      const y = new Date(Date.now() - 86400000);
      return d.toDateString() === y.toDateString();
    }).length || 0;

    const trend = today < yesterday ? 'up' : today > yesterday ? 'down' : 'stable';

    // Alertes par jour pour mini-graphique
    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    alertHistory?.forEach(a => {
      const key = a.timestamp.slice(0, 10);
      if (key in byDay) byDay[key]++;
    });

    return { total, ok, rate, trend, todayAlerts: today, byDay };
  }, [lifts, alertHistory]);

  if (!connected || !stats) {
    return (
      <WidgetWrapper title="Disponibilité IoT" icon={Activity} color="#059669" onRemove={onRemove}>
        <div className="h-full flex items-center justify-center">
          <p className="text-xs text-[var(--text-muted)]">{!connected ? 'Non connecté' : 'Chargement…'}</p>
        </div>
      </WidgetWrapper>
    );
  }

  const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats.trend === 'up' ? '#059669' : stats.trend === 'down' ? '#DC2626' : '#64748B';
  const trendLabel = stats.trend === 'up' ? 'En hausse' : stats.trend === 'down' ? 'En baisse' : 'Stable';

  // Mini sparkline
  const sparkValues = Object.values(stats.byDay);
  const sparkMax = Math.max(...sparkValues, 1);

  return (
    <WidgetWrapper title="Disponibilité IoT" icon={Activity} color="#059669" onRemove={onRemove}>
      <div className="h-full flex flex-col gap-3">
        {/* Score principal */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-3xl font-extrabold" style={{ color: stats.rate >= 90 ? '#059669' : stats.rate >= 70 ? '#CA8A04' : '#DC2626' }}>
              {stats.rate.toFixed(0)}%
            </p>
            <p className="text-[10px] text-[var(--text-muted)] font-semibold">
              {stats.ok}/{stats.total} en service
            </p>
          </div>
          <div className="flex-1 text-right">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ backgroundColor: `${trendColor}10` }}>
              <TrendIcon className="w-3.5 h-3.5" style={{ color: trendColor }} />
              <span className="text-xs font-bold" style={{ color: trendColor }}>{trendLabel}</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              {stats.todayAlerts} alerte{stats.todayAlerts > 1 ? 's' : ''} aujourd'hui
            </p>
          </div>
        </div>

        {/* Sparkline alertes / jour */}
        <div>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Alertes (7 derniers jours)</p>
          <div className="flex items-end gap-1 h-8">
            {sparkValues.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-[#DC2626]"
                style={{
                  height: `${Math.max((v / sparkMax) * 100, 4)}%`,
                  opacity: v === 0 ? 0.15 : 0.6,
                }} />
            ))}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-[var(--text-tertiary)]">
              {new Date(Date.now() - 6 * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </span>
            <span className="text-[9px] text-[var(--text-tertiary)]">Aujourd'hui</span>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}
