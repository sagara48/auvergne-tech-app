// ═══════════════════════════════════════════════════════════════
// MODULE IoT SIGMA4LIFTS — Connexion + Télésurveillance
// Login Sigma4 → API → Dashboard temps réel, alertes, trafic,
// santé composants, journal, commandes distantes
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import {
  Wifi, WifiOff, AlertTriangle, Bell, BellOff,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Shield, Thermometer, Battery, ArrowUp, ArrowDown, Minus,
  RefreshCw, Zap, BarChart3, MapPin,
  DoorOpen, DoorClosed, XCircle, Clock,
  Radio, Send, Volume2, RotateCcw, X, LogIn, LogOut, Loader2, Lock,
  Gauge, Wrench, Cable, Disc,
  ExternalLink, Activity, Eye,
} from 'lucide-react';
import { Card, CardBody, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LiftStatus, LiftAlert, LiftEvent, TrafficStats, LiftHealth,
  EtatAscenseur, NiveauAlerte, TypeEvenement, RemoteCommand,
  ETAT_CONFIG, NIVEAU_ALERTE,
  getLiftStatuses, getActiveAlerts, getAllAlerts, acknowledgeAlert,
  getEvents, getTrafficStats, getLiftHealth,
  getIoTDashboardStats, IoTDashboardStats,
  sendRemoteCommand, subscribeToLiftUpdates, subscribeToAlerts,
  getSigma4FrontUrl, isConnectedToSigma4, getSigma4Session,
  loginSigma4, logoutSigma4, syncToSupabaseCache,
} from '@/services/sigma4liftsApi';

type View = 'dashboard' | 'map' | 'alerts' | 'detail';
type DetailTab = 'status' | 'traffic' | 'health' | 'events' | 'remote';

// ═══ MAIN ═══

export function IoTSigmaPage() {
  const [connected, setConnected] = useState(isConnectedToSigma4());
  const session = getSigma4Session();

  if (!connected) return <LoginView onConnected={() => setConnected(true)} />;
  return <ConnectedView session={session} onDisconnect={() => { logoutSigma4(); setConnected(false); }} />;
}

// ═══ LOGIN VIEW ═══

function LoginView({ onConnected }: { onConnected: () => void }) {
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!loginName || !password) { setError('Identifiant et mot de passe requis'); return; }
    setLoading(true); setError('');
    try {
      await loginSigma4(loginName, password);
      toast.success('Connecté à Sigma4Lifts');
      onConnected();
    } catch (e: any) {
      setError(e.message || 'Erreur de connexion');
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <Card className="w-[340px]"><CardBody className="p-5">
        {/* Logo */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#047857] flex items-center justify-center mx-auto mb-2">
            <Radio className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-[16px] font-extrabold" style={{ letterSpacing: '-0.03em' }}>Sigma4Lifts</h2>
          <p className="text-[9px] text-[var(--text-muted)]">Connectez-vous à votre compte Sigma4Lifts<br />pour accéder à la télésurveillance IoT</p>
        </div>

        {/* Form */}
        <div className="space-y-2">
          <div>
            <label className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Identifiant Sigma4</label>
            <Input
              type="text"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              placeholder="Auver015"
              className="text-[10px] mt-0.5"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Mot de passe</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="text-[10px] mt-0.5"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && <div className="flex items-center gap-1 p-1.5 rounded bg-[#DC2626]/10 border border-[#DC2626]/20">
            <XCircle className="w-3 h-3 text-[#DC2626] flex-shrink-0" />
            <p className="text-[8px] text-[#DC2626] font-semibold">{error}</p>
          </div>}

          <button
            onClick={handleLogin}
            disabled={loading || !loginName || !password}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-[#059669] to-[#047857] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-[var(--border-secondary)] text-center">
          <a href={getSigma4FrontUrl()} target="_blank" rel="noopener noreferrer" className="text-[8px] text-[var(--text-muted)] hover:text-[#059669]">
            <ExternalLink className="w-2.5 h-2.5 inline mr-0.5" />Accéder à sigma4lifts.com
          </a>
          <p className="text-[7px] text-[var(--text-muted)] mt-1">Plateforme IoT par MP Ascensores</p>
        </div>
      </CardBody></Card>
    </div>
  );
}

// ═══ CONNECTED VIEW ═══

function ConnectedView({ session, onDisconnect }: { session: any; onDisconnect: () => void }) {
  const [view, setView] = useState<View>('dashboard');
  const [selectedLift, setSelectedLift] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['iot-stats'], queryFn: getIoTDashboardStats, refetchInterval: 30000, retry: 1 });
  const { data: lifts = [], isLoading } = useQuery({ queryKey: ['iot-lifts'], queryFn: getLiftStatuses, refetchInterval: 15000, retry: 1 });
  const { data: alerts = [] } = useQuery({ queryKey: ['iot-alerts-active'], queryFn: getActiveAlerts, refetchInterval: 10000, retry: 1 });

  // Realtime subscriptions (Supabase cache)
  useEffect(() => {
    const sub = subscribeToLiftUpdates(() => {
      qc.invalidateQueries({ queryKey: ['iot-lifts'] });
      qc.invalidateQueries({ queryKey: ['iot-stats'] });
    });
    const alertSub = subscribeToAlerts((alert) => {
      qc.invalidateQueries({ queryKey: ['iot-alerts-active'] });
      if (alert.niveau === 'emergency' || alert.niveau === 'critical') {
        toast.error(`🚨 ${alert.message}`, { duration: 8000 });
      }
    });
    return () => { sub.unsubscribe(); alertSub.unsubscribe(); };
  }, [qc]);

  const openDetail = (liftId: string) => { setSelectedLift(liftId); setView('detail'); };

  if (view === 'detail' && selectedLift) {
    return <LiftDetailView liftId={selectedLift} lifts={lifts} onBack={() => { setView('dashboard'); setSelectedLift(null); }} />;
  }

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#059669] flex items-center justify-center"><Radio className="w-4 h-4 text-white" /></div>
          <div>
            <h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Sigma4Lifts IoT</h1>
            <p className="text-[7px] text-[var(--text-muted)]">
              Connecté : {session?.userName || session?.userId} {session?.company && `· ${session.company}`}
            </p>
          </div>
          {alerts.length > 0 && <Badge variant="red" className="text-[8px] animate-pulse">{alerts.length} alerte{alerts.length > 1 ? 's' : ''}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {[
            { v: 'dashboard' as View, i: BarChart3, l: 'Dashboard' },
            { v: 'map' as View, i: MapPin, l: 'Carte' },
            { v: 'alerts' as View, i: Bell, l: `Alertes (${alerts.length})` },
          ].map(b => <button key={b.v} onClick={() => setView(b.v)} className={cn('flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold', view === b.v ? 'bg-[#059669] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')}>
            <b.i className="w-3 h-3" />{b.l}</button>)}
          <button onClick={() => { syncToSupabaseCache(); toast.success('Sync Supabase lancée'); }} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Sync cache"><RefreshCw className="w-3 h-3" /></button>
          <a href={getSigma4FrontUrl()} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Ouvrir Sigma4Lifts"><ExternalLink className="w-3 h-3" /></a>
          <button onClick={onDisconnect} className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[8px] font-semibold text-[#DC2626] hover:bg-[#DC2626]/10" title="Déconnexion"><LogOut className="w-3 h-3" /></button>
        </div>
      </div>

      {view === 'dashboard' && stats && <DashboardView stats={stats} lifts={lifts} alerts={alerts} onSelect={openDetail} />}
      {view === 'dashboard' && !stats && isLoading && <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#059669]" /></div>}
      {view === 'map' && <MapView lifts={lifts} onSelect={openDetail} />}
      {view === 'alerts' && <AlertsView alerts={alerts} lifts={lifts} />}
    </div>
  );
}

// ═══ DASHBOARD ═══

function DashboardView({ stats, lifts, alerts, onSelect }: { stats: IoTDashboardStats; lifts: LiftStatus[]; alerts: LiftAlert[]; onSelect: (id: string) => void }) {
  return <div className="flex-1 overflow-y-auto space-y-2">
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { label: 'En ligne', value: stats.enLigne, total: stats.totalAscenseurs, color: '#059669', icon: Wifi },
        { label: 'En panne', value: stats.enPanne, color: '#DC2626', icon: XCircle },
        { label: 'Alertes', value: stats.alertesActives, color: '#EA580C', icon: AlertTriangle },
        { label: 'Disponibilité', value: `${stats.disponibiliteMoyenne}%`, color: stats.disponibiliteMoyenne >= 95 ? '#059669' : '#EA580C', icon: Gauge },
      ].map(k => <Card key={k.label}><CardBody className="p-2 text-center">
        <k.icon className="w-4 h-4 mx-auto mb-0.5" style={{ color: k.color }} />
        <p className="text-[16px] font-extrabold font-mono" style={{ color: k.color }}>{k.value}</p>
        <p className="text-[7px] text-[var(--text-muted)] font-semibold">{k.label}{('total' in k && k.total) ? ` / ${k.total}` : ''}</p>
      </CardBody></Card>)}
    </div>

    <div className="grid grid-cols-3 gap-1.5">
      {[
        { label: 'Trajets aujourd\'hui', value: stats.trajetsAujourdhui, color: '#3B82F6' },
        { label: 'Emprisonnements 24h', value: stats.emprisonnements24h, color: stats.emprisonnements24h > 0 ? '#DC2626' : '#059669' },
        { label: 'Hors ligne', value: stats.horsLigne, color: '#8B5CF6' },
      ].map(k => <Card key={k.label}><CardBody className="p-2 text-center">
        <p className="text-[22px] font-extrabold font-mono" style={{ color: k.color }}>{k.value}</p>
        <p className="text-[7px] text-[var(--text-muted)] font-semibold">{k.label}</p>
      </CardBody></Card>)}
    </div>

    {/* Alertes critiques */}
    {alerts.filter(a => a.niveau === 'emergency' || a.niveau === 'critical').length > 0 && <Card><CardBody className="p-2">
      <p className="text-[9px] font-bold text-[#DC2626] mb-1">🚨 Alertes critiques</p>
      <div className="space-y-0.5">{alerts.filter(a => a.niveau === 'emergency' || a.niveau === 'critical').slice(0, 3).map(a => {
        const lift = lifts.find(l => l.liftId === a.liftId);
        return <div key={a.id} className="flex items-center gap-2 p-1.5 rounded bg-[#DC2626]/5 border border-[#DC2626]/20">
          <span className="text-[10px]">🚨</span>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-bold text-[#DC2626]">{a.message}</p>
            <p className="text-[7px] text-[var(--text-muted)]">{lift?.nom || a.liftId} · {new Date(a.timestamp).toLocaleTimeString('fr')}</p>
          </div>
        </div>;
      })}</div>
    </CardBody></Card>}

    {/* Grille ascenseurs */}
    <div>
      <p className="text-[9px] font-bold mb-1">Parc connecté ({lifts.length})</p>
      <div className="grid grid-cols-2 gap-1">{lifts.map(lift => <LiftCard key={lift.liftId} lift={lift} onClick={() => onSelect(lift.liftId)} />)}</div>
    </div>
  </div>;
}

// ═══ LIFT CARD ═══

function LiftCard({ lift, onClick }: { lift: LiftStatus; onClick: () => void }) {
  const ec = ETAT_CONFIG[lift.etat] || ETAT_CONFIG.normal;
  const isAlert = lift.etat === 'hors_service' || lift.etat === 'emprisonnement' || lift.etat === 'alarme';
  return <button onClick={onClick} className={cn('text-left p-2 rounded-lg border transition-all hover:shadow-md', isAlert ? 'border-[#DC2626]/30 bg-[#DC2626]/3' : 'border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)]')}>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ec.couleur }} />
        <p className="text-[10px] font-bold truncate">{lift.nom}</p>
      </div>
      <div className="flex items-center gap-0.5">
        {lift.connecte ? <Wifi className="w-2.5 h-2.5 text-[#059669]" /> : <WifiOff className="w-2.5 h-2.5 text-[#DC2626]" />}
        <span className="text-[6px] px-1 py-px rounded-full font-bold text-white" style={{ backgroundColor: ec.couleur }}>{ec.label}</span>
      </div>
    </div>
    <p className="text-[7px] text-[var(--text-muted)] truncate mb-1">{lift.adresse}</p>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {lift.direction === 'up' ? <ArrowUp className="w-2.5 h-2.5 text-[#3B82F6]" /> : lift.direction === 'down' ? <ArrowDown className="w-2.5 h-2.5 text-[#EA580C]" /> : <Minus className="w-2.5 h-2.5 text-[var(--text-muted)]" />}
          <span className="text-[11px] font-mono font-extrabold">{lift.etage}</span>
          <span className="text-[6px] text-[var(--text-muted)]">/{lift.etageMax}</span>
        </div>
        {lift.porte === 'ouverte' ? <DoorOpen className="w-2.5 h-2.5 text-[#CA8A04]" /> : <DoorClosed className="w-2.5 h-2.5 text-[#059669]" />}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          <Thermometer className="w-2 h-2" style={{ color: lift.temperatureMachinerie > 45 ? '#DC2626' : '#059669' }} />
          <span className="text-[7px] font-mono">{lift.temperatureMachinerie}°</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Battery className="w-2 h-2" style={{ color: lift.batteriePercent < 20 ? '#DC2626' : '#059669' }} />
          <span className="text-[7px] font-mono">{lift.batteriePercent}%</span>
        </div>
      </div>
    </div>
  </button>;
}

// ═══ MAP VIEW ═══

function MapView({ lifts, onSelect }: { lifts: LiftStatus[]; onSelect: (id: string) => void }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    lifts.forEach(l => { c[l.etat] = (c[l.etat] || 0) + 1; });
    return c;
  }, [lifts]);

  return <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex items-center gap-2 mb-1 flex-wrap">
      {Object.entries(ETAT_CONFIG).map(([k, v]) => counts[k] ? <div key={k} className="flex items-center gap-0.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.couleur }} />
        <span className="text-[7px] font-semibold">{v.label} ({counts[k]})</span>
      </div> : null)}
    </div>
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-3 gap-1.5">{lifts.map(lift => {
        const ec = ETAT_CONFIG[lift.etat];
        return <button key={lift.liftId} onClick={() => onSelect(lift.liftId)} className="p-2 rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] text-left transition-all">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-full flex items-center justify-center text-[8px]" style={{ backgroundColor: ec.couleur + '20', color: ec.couleur }}>{ec.icon}</div>
            <p className="text-[9px] font-bold truncate">{lift.nom}</p>
          </div>
          <p className="text-[7px] text-[var(--text-muted)] truncate">{lift.adresse}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[7px] font-mono font-bold">Ét. {lift.etage}</span>
            <span className="text-[6px] px-1 py-px rounded-full text-white font-bold" style={{ backgroundColor: ec.couleur }}>{ec.label}</span>
          </div>
        </button>;
      })}</div>
    </div>
  </div>;
}

// ═══ ALERTS VIEW ═══

function AlertsView({ alerts: activeAlerts, lifts }: { alerts: LiftAlert[]; lifts: LiftStatus[] }) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [filterNiveau, setFilterNiveau] = useState<NiveauAlerte | ''>('');
  const qc = useQueryClient();
  const { data: allAlerts = [] } = useQuery({ queryKey: ['iot-alerts-all'], queryFn: () => getAllAlerts(100) });
  const ackMut = useMutation({ mutationFn: acknowledgeAlert, onSuccess: () => { qc.invalidateQueries({ queryKey: ['iot-alerts-active'] }); qc.invalidateQueries({ queryKey: ['iot-alerts-all'] }); toast.success('Alerte acquittée'); } });

  const displayed = tab === 'active' ? activeAlerts : allAlerts;
  const filtered = filterNiveau ? displayed.filter(a => a.niveau === filterNiveau) : displayed;

  return <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex items-center gap-1 mb-1 flex-shrink-0">
      <button onClick={() => setTab('active')} className={cn('px-2 py-1 rounded text-[9px] font-bold', tab === 'active' ? 'bg-[#DC2626] text-white' : 'text-[var(--text-muted)]')}>Actives ({activeAlerts.length})</button>
      <button onClick={() => setTab('history')} className={cn('px-2 py-1 rounded text-[9px] font-bold', tab === 'history' ? 'bg-[var(--bg-tertiary)]' : 'text-[var(--text-muted)]')}>Historique</button>
      <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value as any)} className="ml-auto px-1 py-0.5 text-[7px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
        <option value="">Tous niveaux</option>
        {Object.entries(NIVEAU_ALERTE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>
    <div className="flex-1 overflow-y-auto space-y-0.5">{filtered.length === 0 ? <div className="flex items-center justify-center py-8 text-[var(--text-muted)]"><Bell className="w-5 h-5 mr-1" /><span className="text-[10px]">Aucune alerte</span></div> : filtered.map(a => {
      const niv = NIVEAU_ALERTE[a.niveau];
      const lift = lifts.find(l => l.liftId === a.liftId);
      return <Card key={a.id}><CardBody className="p-2">
        <div className="flex items-start gap-2">
          <div className="w-2 self-stretch rounded-full mt-0.5" style={{ backgroundColor: niv.couleur }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="px-1 py-px rounded text-[6px] font-bold text-white" style={{ backgroundColor: niv.couleur }}>{niv.label}</span>
              <span className="text-[7px] font-bold">{lift?.nom || a.liftId}</span>
              <span className="text-[6px] text-[var(--text-muted)] ml-auto font-mono">{new Date(a.timestamp).toLocaleString('fr')}</span>
            </div>
            <p className="text-[8px]">{a.message}</p>
            {a.acquittee && <p className="text-[6px] text-[#059669] mt-0.5">✓ Acquittée le {new Date(a.acquitteDate!).toLocaleString('fr')}</p>}
          </div>
          {!a.acquittee && <button onClick={() => ackMut.mutate(a.id)} className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-[var(--bg-tertiary)] hover:bg-[#059669] hover:text-white"><BellOff className="w-2.5 h-2.5 inline mr-0.5" />OK</button>}
        </div>
      </CardBody></Card>;
    })}</div>
  </div>;
}

// ═══ LIFT DETAIL VIEW ═══

function LiftDetailView({ liftId, lifts, onBack }: { liftId: string; lifts: LiftStatus[]; onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>('status');
  const lift = lifts.find(l => l.liftId === liftId);
  const { data: health } = useQuery({ queryKey: ['iot-health', liftId], queryFn: () => getLiftHealth(liftId) });
  const { data: events = [] } = useQuery({ queryKey: ['iot-events', liftId], queryFn: () => getEvents(liftId, 50) });
  const { data: traffic = [] } = useQuery({ queryKey: ['iot-traffic', liftId], queryFn: () => getTrafficStats(liftId, 7) });

  if (!lift) return <div className="h-full flex items-center justify-center text-[var(--text-muted)]">Ascenseur non trouvé</div>;
  const ec = ETAT_CONFIG[lift.etat];

  return <div className="h-full flex flex-col gap-2 overflow-hidden">
    {/* Header */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={onBack} className="p-1 rounded hover:bg-[var(--bg-tertiary)]"><ChevronLeft className="w-4 h-4" /></button>
      <div className="w-3 h-8 rounded-full" style={{ backgroundColor: ec.couleur }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[13px] font-extrabold truncate">{lift.nom}</h2>
          <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold text-white" style={{ backgroundColor: ec.couleur }}>{ec.label}</span>
          {lift.connecte ? <Wifi className="w-3 h-3 text-[#059669]" /> : <WifiOff className="w-3 h-3 text-[#DC2626]" />}
        </div>
        <p className="text-[8px] text-[var(--text-muted)] truncate">{lift.adresse} · {lift.controllerType} · FW {lift.firmwareVersion}</p>
      </div>
    </div>

    {/* Live status bar */}
    <div className="grid grid-cols-5 gap-1 flex-shrink-0">
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center">
        <div className="flex items-center justify-center gap-0.5">
          {lift.direction === 'up' ? <ArrowUp className="w-3 h-3 text-[#3B82F6]" /> : lift.direction === 'down' ? <ArrowDown className="w-3 h-3 text-[#EA580C]" /> : <Minus className="w-3 h-3" />}
          <p className="text-[16px] font-extrabold font-mono">{lift.etage}</p>
        </div>
        <p className="text-[6px] text-[var(--text-muted)]">Étage / {lift.etageMax}</p>
      </div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center">
        {lift.porte === 'ouverte' ? <DoorOpen className="w-4 h-4 mx-auto text-[#CA8A04]" /> : lift.porte === 'bloquee' ? <DoorClosed className="w-4 h-4 mx-auto text-[#DC2626]" /> : <DoorClosed className="w-4 h-4 mx-auto text-[#059669]" />}
        <p className="text-[6px] text-[var(--text-muted)] capitalize">{lift.porte}</p>
      </div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center">
        <Thermometer className="w-4 h-4 mx-auto" style={{ color: lift.temperatureMachinerie > 45 ? '#DC2626' : lift.temperatureMachinerie > 35 ? '#CA8A04' : '#059669' }} />
        <p className="text-[10px] font-mono font-bold">{lift.temperatureMachinerie}°C</p>
      </div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center">
        <Battery className="w-4 h-4 mx-auto" style={{ color: lift.batteriePercent < 20 ? '#DC2626' : '#059669' }} />
        <p className="text-[10px] font-mono font-bold">{lift.batteriePercent}%</p>
      </div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center">
        <Shield className="w-4 h-4 mx-auto" style={{ color: lift.securitesOk ? '#059669' : '#DC2626' }} />
        <p className="text-[10px] font-bold" style={{ color: lift.securitesOk ? '#059669' : '#DC2626' }}>{lift.securitesOk ? 'OK' : 'NOK'}</p>
      </div>
    </div>

    {/* Tabs */}
    <div className="flex gap-px p-0.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-secondary)] flex-shrink-0">
      {[
        { id: 'status' as DetailTab, l: 'Status' },
        { id: 'traffic' as DetailTab, l: 'Trafic' },
        { id: 'health' as DetailTab, l: 'Santé' },
        { id: 'events' as DetailTab, l: `Journal (${events.length})` },
        { id: 'remote' as DetailTab, l: 'Commandes' },
      ].map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex-1 py-1.5 rounded-[10px] text-[8px] font-bold', tab === t.id ? 'bg-[#059669] text-white' : 'text-[var(--text-muted)]')}>{t.l}</button>)}
    </div>

    <div className="flex-1 overflow-y-auto">
      {tab === 'status' && <StatusTab lift={lift} />}
      {tab === 'traffic' && <TrafficTab traffic={traffic} />}
      {tab === 'health' && <HealthTab health={health} />}
      {tab === 'events' && <EventsTab events={events} />}
      {tab === 'remote' && <RemoteTab lift={lift} />}
    </div>
  </div>;
}

// ═══ STATUS TAB ═══

function StatusTab({ lift }: { lift: LiftStatus }) {
  const rows: [string, string][] = [
    ['État', ETAT_CONFIG[lift.etat].label],
    ['Étage actuel', `${lift.etage} / ${lift.etageMax}`],
    ['Position', `${lift.positionMm} mm`],
    ['Direction', lift.direction === 'up' ? '▲ Montée' : lift.direction === 'down' ? '▼ Descente' : '— Arrêt'],
    ['Porte', lift.porte],
    ['Température machinerie', `${lift.temperatureMachinerie}°C`],
    ['Batterie secours', `${lift.batteriePercent}%`],
    ['Sécurités', lift.securitesOk ? '✅ OK' : '❌ Anomalie'],
    ['Connecté', lift.connecte ? '✅ En ligne' : '❌ Hors ligne'],
    ['Dernier signal', new Date(lift.dernierSignal).toLocaleString('fr')],
    ['Controller', lift.controllerType],
    ['Firmware', lift.firmwareVersion || '—'],
    ['Hardware', lift.hardwareVersion || '—'],
  ];

  return <div className="space-y-1">
    <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1">Informations temps réel</p>
      <div className="space-y-0.5">{rows.map(([k, v]) => <div key={k} className="flex items-center justify-between py-0.5 border-b border-[var(--border-secondary)] last:border-0">
        <span className="text-[8px] text-[var(--text-muted)]">{k}</span>
        <span className="text-[8px] font-bold font-mono">{v}</span>
      </div>)}</div>
    </CardBody></Card>
    {/* Visu gaine */}
    <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-2">Position cabine</p>
      <div className="flex items-end gap-1 h-[120px]">
        <div className="w-12 h-full bg-[var(--bg-tertiary)] rounded border border-[var(--border-secondary)] relative overflow-hidden">
          {Array.from({ length: lift.etageMax + 1 }, (_, i) => <div key={i} className="absolute left-0 right-0 border-t border-dashed border-[var(--border-secondary)]" style={{ bottom: `${(i / lift.etageMax) * 100}%` }}>
            <span className="text-[5px] font-mono text-[var(--text-muted)] absolute -left-0.5 -top-1.5">{i}</span>
          </div>)}
          <div className="absolute left-1 right-1 h-3 rounded transition-all duration-1000" style={{ bottom: `${(lift.etage / lift.etageMax) * 100}%`, backgroundColor: ETAT_CONFIG[lift.etat].couleur }}>
            <span className="text-[6px] text-white font-bold flex items-center justify-center h-full">{lift.etage}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-between h-full text-[7px] text-[var(--text-muted)]">
          <div>Ét. {lift.etageMax} ↑</div>
          <div className="text-center font-bold text-[12px]" style={{ color: ETAT_CONFIG[lift.etat].couleur }}>
            {lift.direction === 'up' ? '▲' : lift.direction === 'down' ? '▼' : '●'}
          </div>
          <div>Ét. 0 (RDC)</div>
        </div>
      </div>
    </CardBody></Card>
  </div>;
}

// ═══ TRAFFIC TAB ═══

function TrafficTab({ traffic }: { traffic: TrafficStats[] }) {
  if (traffic.length === 0) return <div className="flex items-center justify-center py-8 text-[var(--text-muted)]"><BarChart3 className="w-6 h-6 mr-2" /><span className="text-[10px]">Aucune donnée de trafic</span></div>;
  const totalWeek = traffic.reduce((a, t) => a + t.trajetsTotal, 0);
  const avgDay = Math.round(totalWeek / traffic.length);
  const maxDay = Math.max(...traffic.map(t => t.trajetsTotal));

  return <div className="space-y-1.5">
    <div className="grid grid-cols-3 gap-1">
      <Card><CardBody className="p-2 text-center"><p className="text-[14px] font-extrabold font-mono text-[#3B82F6]">{totalWeek}</p><p className="text-[7px] text-[var(--text-muted)]">Trajets 7j</p></CardBody></Card>
      <Card><CardBody className="p-2 text-center"><p className="text-[14px] font-extrabold font-mono text-[#059669]">{avgDay}</p><p className="text-[7px] text-[var(--text-muted)]">Moy/jour</p></CardBody></Card>
      <Card><CardBody className="p-2 text-center"><p className="text-[14px] font-extrabold font-mono text-[#8B5CF6]">{maxDay}</p><p className="text-[7px] text-[var(--text-muted)]">Max/jour</p></CardBody></Card>
    </div>
    <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1.5">Trajets par jour</p>
      <div className="flex items-end gap-1 h-[80px]">{traffic.map(t => {
        const pct = maxDay > 0 ? (t.trajetsTotal / maxDay) * 100 : 0;
        const day = new Date(t.date).toLocaleDateString('fr', { weekday: 'short' });
        return <div key={t.date} className="flex-1 flex flex-col items-center gap-0.5">
          <span className="text-[7px] font-mono font-bold">{t.trajetsTotal}</span>
          <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: '#3B82F6', minHeight: 2 }} />
          <span className="text-[6px] text-[var(--text-muted)]">{day}</span>
        </div>;
      })}</div>
    </CardBody></Card>
    {traffic.length > 0 && traffic[traffic.length - 1].trajetsParHeure?.length > 0 && <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1.5">Répartition horaire (dernier jour)</p>
      <div className="flex items-end gap-px h-[50px]">{(traffic[traffic.length - 1].trajetsParHeure || []).map((v, h) => {
        const max = Math.max(...(traffic[traffic.length - 1].trajetsParHeure || [1]));
        const pct = max > 0 ? (v / max) * 100 : 0;
        return <div key={h} className="flex-1 flex flex-col items-center">
          <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: v > max * 0.7 ? '#DC2626' : v > max * 0.4 ? '#CA8A04' : '#059669', minHeight: 1 }} />
          {h % 4 === 0 && <span className="text-[5px] text-[var(--text-muted)]">{h}h</span>}
        </div>;
      })}</div>
    </CardBody></Card>}
  </div>;
}

// ═══ HEALTH TAB ═══

function HealthTab({ health }: { health: LiftHealth | null | undefined }) {
  if (!health) return <div className="flex items-center justify-center py-8 text-[var(--text-muted)]"><Activity className="w-6 h-6 mr-2" /><span className="text-[10px]">Aucune donnée de santé</span></div>;
  const components = [
    { key: 'moteur', label: 'Moteur', score: health.moteur, icon: Zap },
    { key: 'portes', label: 'Portes', score: health.portes, icon: DoorClosed },
    { key: 'cables', label: 'Câbles', score: health.cables, icon: Cable },
    { key: 'frein', label: 'Frein', score: health.frein, icon: Disc },
    { key: 'variateur', label: 'Variateur', score: health.variateur, icon: Gauge },
  ];
  const sc = (s: number) => s >= 80 ? '#059669' : s >= 50 ? '#CA8A04' : '#DC2626';

  return <div className="space-y-1.5">
    <Card><CardBody className="p-3 text-center">
      <p className="text-[8px] font-bold uppercase mb-1">Score santé global</p>
      <div className="relative w-20 h-20 mx-auto">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={sc(health.scoreGlobal)} strokeWidth="3" strokeDasharray={`${health.scoreGlobal} ${100 - health.scoreGlobal}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-extrabold font-mono" style={{ color: sc(health.scoreGlobal) }}>{health.scoreGlobal}</span>
        </div>
      </div>
    </CardBody></Card>
    <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1.5">Par composant</p>
      <div className="space-y-1.5">{components.map(c => <div key={c.key} className="flex items-center gap-2">
        <c.icon className="w-3.5 h-3.5" style={{ color: sc(c.score) }} />
        <span className="text-[8px] font-semibold w-16">{c.label}</span>
        <div className="flex-1 h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${c.score}%`, backgroundColor: sc(c.score) }} />
        </div>
        <span className="text-[9px] font-mono font-extrabold w-8 text-right" style={{ color: sc(c.score) }}>{c.score}%</span>
      </div>)}</div>
    </CardBody></Card>
    {components.filter(c => c.score < 80).length > 0 && <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1">Recommandations</p>
      <div className="space-y-0.5">{components.filter(c => c.score < 80).sort((a, b) => a.score - b.score).map(c =>
        <div key={c.key} className="flex items-start gap-1 p-1 rounded" style={{ backgroundColor: sc(c.score) + '10' }}>
          <AlertTriangle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" style={{ color: sc(c.score) }} />
          <div>
            <p className="text-[8px] font-bold" style={{ color: sc(c.score) }}>{c.label} — {c.score}%</p>
            <p className="text-[7px] text-[var(--text-muted)]">{c.score < 50 ? 'Intervention urgente sous 7 jours' : 'Contrôle à la prochaine visite'}</p>
          </div>
        </div>)}</div>
    </CardBody></Card>}
  </div>;
}

// ═══ EVENTS TAB ═══

function EventsTab({ events }: { events: LiftEvent[] }) {
  const [filterType, setFilterType] = useState<TypeEvenement | ''>('');
  const filtered = filterType ? events.filter(e => e.type === filterType) : events;
  const tc: Record<string, { label: string; color: string; icon: string }> = {
    trajet: { label: 'Trajet', color: '#3B82F6', icon: '🛗' }, alarme: { label: 'Alarme', color: '#DC2626', icon: '🚨' },
    erreur: { label: 'Erreur', color: '#EA580C', icon: '⚠️' }, maintenance: { label: 'Maintenance', color: '#8B5CF6', icon: '🔧' },
    emprisonnement: { label: 'Emprisonnement', color: '#DC2626', icon: '🆘' }, porte: { label: 'Porte', color: '#CA8A04', icon: '🚪' },
    batterie: { label: 'Batterie', color: '#059669', icon: '🔋' }, temperature: { label: 'Température', color: '#EA580C', icon: '🌡️' },
    statut: { label: 'Statut', color: '#3B82F6', icon: '📊' }, firmware: { label: 'Firmware', color: '#8B5CF6', icon: '💾' },
  };

  return <div className="space-y-1">
    <div className="flex gap-0.5 flex-wrap">
      <button onClick={() => setFilterType('')} className={cn('px-1.5 py-0.5 rounded text-[7px] font-bold', !filterType ? 'bg-[#059669] text-white' : 'text-[var(--text-muted)]')}>Tous ({events.length})</button>
      {Object.entries(tc).map(([k, v]) => {
        const ct = events.filter(e => e.type === k).length;
        return ct > 0 ? <button key={k} onClick={() => setFilterType(k as TypeEvenement)} className={cn('px-1.5 py-0.5 rounded text-[7px] font-bold', filterType === k ? 'text-white' : 'text-[var(--text-muted)]')} style={filterType === k ? { backgroundColor: v.color } : {}}>{v.icon} {ct}</button> : null;
      })}
    </div>
    <div className="space-y-px">{filtered.map(e => {
      const t = tc[e.type] || { label: e.type, color: '#6B7280', icon: '•' };
      return <div key={e.id} className="flex items-start gap-1.5 py-1 border-b border-[var(--border-secondary)]">
        <span className="text-[9px] mt-0.5">{t.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[8px]">{e.description}</p>
          <p className="text-[6px] text-[var(--text-muted)] font-mono">{new Date(e.timestamp).toLocaleString('fr')}</p>
        </div>
        <span className="text-[6px] px-1 py-px rounded font-bold" style={{ backgroundColor: t.color + '15', color: t.color }}>{t.label}</span>
      </div>;
    })}</div>
  </div>;
}

// ═══ REMOTE TAB ═══

function RemoteTab({ lift }: { lift: LiftStatus }) {
  const qc = useQueryClient();
  const cmdMut = useMutation({
    mutationFn: ({ cmd, params }: { cmd: RemoteCommand; params?: any }) => sendRemoteCommand(lift.liftId, cmd, params),
    onSuccess: (res) => { if (res.success) toast.success(res.message); else toast.error(res.message); qc.invalidateQueries({ queryKey: ['iot-events', lift.liftId] }); },
  });
  const commands: { cmd: RemoteCommand; label: string; desc: string; icon: any; color: string; danger?: boolean }[] = [
    { cmd: 'call_car', label: 'Appel cabine', desc: 'Envoyer la cabine au RDC', icon: ArrowDown, color: '#3B82F6' },
    { cmd: 'reset_board', label: 'Reset carte', desc: 'Redémarrer la carte de commande', icon: RotateCcw, color: '#8B5CF6' },
    { cmd: 'force_alarm_test', label: 'Test alarme', desc: 'Test alarme EN 81-28', icon: Volume2, color: '#CA8A04' },
    { cmd: 'force_door_close', label: 'Fermeture porte', desc: 'Forcer fermeture des portes', icon: DoorClosed, color: '#EA580C' },
    { cmd: 'change_mode', label: 'Mode inspection', desc: 'Basculer en mode inspection', icon: Wrench, color: '#DC2626', danger: true },
  ];

  return <div className="space-y-1.5">
    <Card><CardBody className="p-2">
      <div className="flex items-center gap-1 mb-1">
        <Send className="w-3 h-3 text-[#059669]" />
        <p className="text-[9px] font-bold">Commandes à distance</p>
        <span className="text-[6px] text-[var(--text-muted)] ml-auto">REMOTE CONTROL · {lift.controllerType}</span>
      </div>
      <div className="space-y-1">{commands.map(c => <button key={c.cmd}
        onClick={() => { if (c.danger && !confirm(`⚠️ ${c.label} — êtes-vous sûr ?`)) return; cmdMut.mutate({ cmd: c.cmd }); }}
        disabled={!lift.connecte || cmdMut.isPending}
        className={cn('w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all', !lift.connecte ? 'opacity-30' : 'hover:bg-[var(--bg-tertiary)]', c.danger ? 'border-[#DC2626]/20' : 'border-[var(--border-secondary)]')}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.color + '15' }}>
          <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
        </div>
        <div className="flex-1">
          <p className="text-[9px] font-bold">{c.label}</p>
          <p className="text-[7px] text-[var(--text-muted)]">{c.desc}</p>
        </div>
        {c.danger && <Badge variant="red" className="text-[6px]">ATTENTION</Badge>}
        <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
      </button>)}</div>
    </CardBody></Card>
    {!lift.connecte && <Card><CardBody className="p-2 text-center">
      <WifiOff className="w-6 h-6 mx-auto text-[#DC2626] mb-1" />
      <p className="text-[9px] font-bold text-[#DC2626]">Ascenseur hors ligne</p>
      <p className="text-[7px] text-[var(--text-muted)]">Commandes indisponibles</p>
    </CardBody></Card>}
  </div>;
}

export default IoTSigmaPage;
