// ═══════════════════════════════════════════════════════════════
// UNIFIED LIFT PANEL — Panneau fusionné Progilift + Sigma4
// Remplace IoTStatusPanel dans le modal ParcAscenseursPage
// Usage: <UnifiedLiftPanel codeAppareil="AUV-042" />
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Radio, Wifi, WifiOff, Activity, AlertTriangle, ChevronRight,
  Loader2, Link2, Shield, Zap, ArrowUp, ArrowDown, DoorOpen,
  Clock, TrendingUp, Heart, CheckCircle2, XCircle, Eye,
  Wrench, BarChart3, Calendar, FileText, ChevronDown,
} from 'lucide-react';
import { Card, CardBody, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  getUnifiedLift, healthColor, healthLabel, timeAgo,
  UnifiedLift, HealthFactor, Recommendation, TimelineEvent,
} from '@/services/unifiedLiftService';
import { getEstadoInfo, isConnected as isEstadoConnected } from '@/services/sigma4LiftStates';
import { isConnectedToSigma4 } from '@/services/sigma4liftsApi';

// ═══ MAIN PANEL ═══

export function UnifiedLiftPanel({ codeAppareil, onOpenSigma4 }: {
  codeAppareil: string;
  onOpenSigma4?: (liftId: number) => void;
}) {
  const [section, setSection] = useState<'overview' | 'timeline' | 'recs'>('overview');

  const { data: unified, isLoading, error } = useQuery({
    queryKey: ['unified-lift', codeAppareil],
    queryFn: () => getUnifiedLift(codeAppareil),
    staleTime: 60000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#059669]" />
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Chargement fiche unifiée…</p>
            <p className="text-xs text-[var(--text-muted)]">Fusion Progilift + Sigma4 IoT</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!unified || error) {
    return (
      <Card className="border-dashed border-[var(--border-secondary)]">
        <CardBody className="p-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-[var(--text-muted)] opacity-40" />
          <span className="text-xs text-[var(--text-muted)]">Impossible de charger la fiche unifiée</span>
        </CardBody>
      </Card>
    );
  }

  const { sigma4, progilift, healthScore, healthFactors, recommendations, timelineEvents } = unified;
  const hasIoT = !!sigma4.lift;
  const hColor = healthColor(healthScore);
  const estado = sigma4.lift ? getEstadoInfo(sigma4.lift.estado) : null;
  const urgentRecs = recommendations.filter(r => r.priority === 'urgent');

  return (
    <div className="space-y-3">
      {/* ── HEADER: Score + État + Sources ── */}
      <Card className="overflow-hidden" style={hasIoT ? { borderColor: `${estado!.color}30` } : undefined}>
        <CardBody className="p-0">
          <div className="flex items-stretch">
            {/* Score santé */}
            <div className="w-24 flex flex-col items-center justify-center p-3 border-r border-[var(--border-secondary)]"
              style={{ backgroundColor: `${hColor}08` }}>
              <div className="relative">
                <svg viewBox="0 0 36 36" className="w-14 h-14">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="var(--border-secondary)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={hColor} strokeWidth="3"
                    strokeDasharray={`${healthScore}, 100`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold" style={{ color: hColor }}>
                  {healthScore}
                </span>
              </div>
              <p className="text-[10px] font-bold mt-1" style={{ color: hColor }}>{healthLabel(healthScore)}</p>
              <p className="text-[9px] text-[var(--text-muted)]">Score santé</p>
            </div>

            {/* Infos principales */}
            <div className="flex-1 p-3">
              {/* Sources badges */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold',
                  progilift.ascenseur ? 'bg-orange-500/15 text-orange-600' : 'bg-gray-500/10 text-gray-400'
                )}>
                  {progilift.ascenseur ? '✓ Progilift' : '✗ Progilift'}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold',
                  hasIoT ? 'bg-[#059669]/15 text-[#059669]' : 'bg-gray-500/10 text-gray-400'
                )}>
                  {hasIoT ? '✓ Sigma4 IoT' : '✗ Sigma4 IoT'}
                </span>
                {unified.sourceMatch !== 'none' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold flex items-center gap-0.5">
                    <Link2 className="w-2.5 h-2.5" />
                    {unified.sourceMatch === 'exact' ? 'Lié exact' : unified.sourceMatch === 'manual' ? 'Lié manuel' : 'Lié approx.'}
                  </span>
                )}
              </div>

              {/* État IoT en temps réel */}
              {estado && (
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-lg', estado.pulse && 'animate-pulse')}>{estado.icon}</span>
                  <div>
                    <span className="text-sm font-bold" style={{ color: estado.color }}>{estado.label}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1.5">(code {sigma4.lift!.estado})</span>
                  </div>
                </div>
              )}

              {/* KPIs compacts (grid 4 colonnes) */}
              <div className="grid grid-cols-4 gap-1.5">
                {hasIoT && sigma4.monitor && (
                  <>
                    <MiniKpi icon="📍" label="Étage" value={String(sigma4.monitor.floor ?? '?')} />
                    <MiniKpi icon={sigma4.monitor.direction === 1 ? '⬆️' : sigma4.monitor.direction === 2 ? '⬇️' : '⏸️'}
                      label="Direction" value={sigma4.monitor.direction === 1 ? 'Montée' : sigma4.monitor.direction === 2 ? 'Descente' : 'Arrêt'} />
                    <MiniKpi icon={sigma4.monitor.door1Opened ? '🚪' : '🔒'}
                      label="Porte" value={sigma4.monitor.door1Opened ? 'Ouverte' : 'Fermée'} />
                    <MiniKpi icon="🛡️" label="Sécurité"
                      value={sigma4.monitor.securityChain ? 'OK' : '?'}
                      color={sigma4.monitor.securityChain ? '#059669' : '#64748B'} />
                  </>
                )}
                {progilift.ascenseur && (
                  <>
                    <MiniKpi icon="🔧" label="Visites/an" value={String(progilift.ascenseur.nb_visites_an || '—')} />
                    <MiniKpi icon="📅" label="Dern. passage"
                      value={progilift.ascenseur.dernier_passage ? timeAgo(progilift.ascenseur.dernier_passage) : '—'}
                      color={progilift.ascenseur.dernier_passage ? undefined : '#CA8A04'} />
                    <MiniKpi icon="🔴" label="Pannes 3m" value={String(progilift.pannes.length)}
                      color={progilift.pannes.length > 3 ? '#DC2626' : progilift.pannes.length > 0 ? '#CA8A04' : '#059669'} />
                    <MiniKpi icon="⚡" label="Erreurs IoT" value={String(sigma4.errors.length)}
                      color={sigma4.errors.length > 5 ? '#DC2626' : sigma4.errors.length > 0 ? '#CA8A04' : '#059669'} />
                  </>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── ALERTES URGENTES ── */}
      {urgentRecs.length > 0 && (
        <div className="space-y-1.5">
          {urgentRecs.map(rec => (
            <div key={rec.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/5">
              <span className="text-lg">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#DC2626]">{rec.title}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{rec.description}</p>
              </div>
              {rec.actionLabel && rec.actionModule === 'sigma4' && sigma4.lift && onOpenSigma4 && (
                <button onClick={() => onOpenSigma4(sigma4.lift!.id)}
                  className="px-2.5 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] text-xs font-bold hover:bg-[#DC2626]/20 transition-colors flex-shrink-0">
                  {rec.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TABS: Vue d'ensemble / Timeline / Recommandations ── */}
      <div className="flex gap-1">
        {[
          { id: 'overview' as const, label: 'Facteurs santé', icon: Heart, count: healthFactors.length },
          { id: 'timeline' as const, label: 'Timeline croisée', icon: Clock, count: timelineEvents.length },
          { id: 'recs' as const, label: 'Recommandations', icon: CheckCircle2, count: recommendations.length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSection(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              section === tab.id
                ? 'bg-[#059669] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            )}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('px-1 py-0.5 rounded-full text-[9px]',
                section === tab.id ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── SECTION CONTENT ── */}
      {section === 'overview' && <HealthFactorsSection factors={healthFactors} />}
      {section === 'timeline' && <TimelineSection events={timelineEvents} />}
      {section === 'recs' && <RecommendationsSection recommendations={recommendations} onOpenSigma4={onOpenSigma4} sigma4LiftId={sigma4.lift?.id} />}

      {/* ── INFOS TECHNIQUES CROISÉES ── */}
      {hasIoT && (
        <Card>
          <CardBody className="p-3">
            <CollapsibleSection title="Données techniques Sigma4" icon="⚙️" defaultOpen={false}>
              <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
                <TechItem label="Ref S4L" value={sigma4.lift!.liftCompRef} />
                <TechItem label="Contrôleur" value={sigma4.lift!.modeloAscensor} />
                <TechItem label="Firmware" value={sigma4.lift!.versionSW} />
                <TechItem label="Arrêts" value={sigma4.lift!.numeroParadas ? String(sigma4.lift!.numeroParadas) : '?'} />
                <TechItem label="Traction" value={sigma4.lift!.traccion?.replace(/^TRACCION_/, '').replace(/_/g, ' ')} />
                <TechItem label="Architecture" value={sigma4.lift!.arquitectura?.replace(/^ARQUITECTURA_/, '').replace(/_/g, ' ')} />
                <TechItem label="EN 81-28" value={sigma4.lift!.en8128 ? '✓' : '✗'} color={sigma4.lift!.en8128 ? '#059669' : '#DC2626'} />
                <TechItem label="Liaison" value={sigma4.lift!.tipoEnlace === 1 ? 'SIM MP' : sigma4.lift!.tipoEnlace === 4 ? 'Ethernet' : `Type ${sigma4.lift!.tipoEnlace}`} />
                <TechItem label="Capacité" value={sigma4.lift!.numeroPersonas ? `${sigma4.lift!.numeroPersonas} pers.${sigma4.lift!.cargaUtil ? ` / ${sigma4.lift!.cargaUtil}kg` : ''}` : '?'} />
                {sigma4.lift!.latitude !== 0 && (
                  <TechItem label="GPS" value={`${sigma4.lift!.latitude.toFixed(4)}, ${sigma4.lift!.longitude.toFixed(4)}`} />
                )}
              </div>
            </CollapsibleSection>
          </CardBody>
        </Card>
      )}

      {/* ── TRAFIC (si données) ── */}
      {sigma4.traffic.length > 0 && (
        <Card>
          <CardBody className="p-3">
            <CollapsibleSection title="Trafic récent" icon="📊" defaultOpen={false}>
              <TrafficMiniChart traffic={sigma4.traffic} />
            </CollapsibleSection>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ═══ SUB-COMPONENTS ═══

function MiniKpi({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="text-center p-1.5 rounded-lg bg-[var(--bg-tertiary)]">
      <span className="text-xs">{icon}</span>
      <p className="text-xs font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
      <p className="text-[9px] text-[var(--text-muted)] leading-tight">{label}</p>
    </div>
  );
}

function TechItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="font-semibold">{label}:</span>{' '}
      <span className="font-mono" style={color ? { color } : undefined}>{value || '—'}</span>
    </div>
  );
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: {
  title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-bold text-[var(--text-primary)] flex-1">{title}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ═══ HEALTH FACTORS ═══

function HealthFactorsSection({ factors }: { factors: HealthFactor[] }) {
  return (
    <Card>
      <CardBody className="p-3 space-y-2">
        {factors.map(f => (
          <div key={f.id} className="flex items-center gap-2.5">
            <span className="text-sm w-5 text-center">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-[var(--text-primary)]">{f.label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: f.color }}>{f.score}/100</span>
              </div>
              {/* Barre */}
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${f.score}%`, backgroundColor: f.color }} />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{f.detail}</p>
            </div>
            <span className="text-[9px] text-[var(--text-muted)] w-8 text-right">{Math.round(f.weight * 100)}%</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

// ═══ TIMELINE ═══

function TimelineSection({ events }: { events: TimelineEvent[] }) {
  const [limit, setLimit] = useState(10);
  const shown = events.slice(0, limit);

  if (events.length === 0) {
    return (
      <Card>
        <CardBody className="p-4 text-center">
          <Clock className="w-6 h-6 mx-auto text-[var(--text-muted)] opacity-30 mb-1" />
          <p className="text-xs text-[var(--text-muted)]">Aucun événement récent</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-3">
        <div className="space-y-0.5">
          {shown.map((ev, i) => (
            <div key={ev.id} className="flex gap-2.5 group">
              {/* Timeline line */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                <span className="text-xs">{ev.icon}</span>
                {i < shown.length - 1 && <div className="flex-1 w-px bg-[var(--border-secondary)] my-0.5" />}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-primary)] truncate">{ev.title}</span>
                  <span className={cn(
                    'px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0',
                    ev.source === 'progilift' ? 'bg-orange-500/10 text-orange-500' : 'bg-[#059669]/10 text-[#059669]'
                  )}>
                    {ev.source === 'progilift' ? 'PG' : 'S4'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span>{new Date(ev.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span>{new Date(ev.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {ev.detail && <span className="truncate">· {ev.detail}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {events.length > limit && (
          <button onClick={() => setLimit(l => l + 15)}
            className="w-full text-center text-xs font-bold text-[#059669] hover:underline mt-1">
            Voir plus ({events.length - limit} restants)
          </button>
        )}
      </CardBody>
    </Card>
  );
}

// ═══ RECOMMANDATIONS ═══

function RecommendationsSection({ recommendations, onOpenSigma4, sigma4LiftId }: {
  recommendations: Recommendation[];
  onOpenSigma4?: (id: number) => void;
  sigma4LiftId?: number;
}) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardBody className="p-4 text-center">
          <CheckCircle2 className="w-6 h-6 mx-auto text-[#059669] opacity-40 mb-1" />
          <p className="text-xs text-[#059669] font-semibold">Aucune recommandation particulière</p>
        </CardBody>
      </Card>
    );
  }

  const priorityStyles: Record<string, { border: string; bg: string }> = {
    urgent:    { border: '#DC2626', bg: '#DC2626' },
    important: { border: '#CA8A04', bg: '#CA8A04' },
    info:      { border: '#3B82F6', bg: '#3B82F6' },
  };

  return (
    <Card>
      <CardBody className="p-3 space-y-2">
        {recommendations.map(rec => {
          const style = priorityStyles[rec.priority] || priorityStyles.info;
          return (
            <div key={rec.id} className="flex items-start gap-2.5 p-2 rounded-lg"
              style={{ backgroundColor: `${style.bg}06`, borderLeft: `3px solid ${style.border}` }}>
              <span className="text-base mt-0.5">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{rec.title}</span>
                  <span className="px-1 py-0.5 rounded text-[9px] font-bold uppercase"
                    style={{ backgroundColor: `${style.bg}15`, color: style.border }}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{rec.description}</p>
              </div>
              {rec.actionLabel && rec.actionModule === 'sigma4' && sigma4LiftId && onOpenSigma4 && (
                <button onClick={() => onOpenSigma4(sigma4LiftId)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `${style.bg}15`, color: style.border }}>
                  {rec.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// ═══ TRAFFIC MINI CHART ═══

function TrafficMiniChart({ traffic }: { traffic: { fecha: string; total: number; parcial: number }[] }) {
  const last14 = traffic.slice(-14);
  const maxVal = Math.max(...last14.map(t => t.total), 1);

  return (
    <div>
      <div className="flex items-end gap-[2px] h-12 mb-1">
        {last14.map((t, i) => (
          <div key={i} className="flex-1 flex flex-col items-stretch gap-[1px]" title={`${t.fecha}: ${t.total} courses`}>
            <div className="rounded-t-sm bg-[#3B82F6]"
              style={{ height: `${Math.max((t.total / maxVal) * 100, 4)}%`, opacity: 0.7 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>{last14[0]?.fecha ? new Date(last14[0].fecha).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''}</span>
        <span className="font-bold">
          Moy: {Math.round(last14.reduce((a, t) => a + t.total, 0) / (last14.length || 1))}/j
        </span>
        <span>{last14[last14.length - 1]?.fecha ? new Date(last14[last14.length - 1].fecha).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''}</span>
      </div>
    </div>
  );
}

export default UnifiedLiftPanel;
