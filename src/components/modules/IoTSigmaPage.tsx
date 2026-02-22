// ═══════════════════════════════════════════════════════════════
// MODULE IoT SIGMA4LIFTS — Dashboard + Ascenseurs + Monitor + Erreurs
// Login → /divide/login → Dashboard | Ascenseurs | Monitor | Erreurs
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect } from 'react';
import {
  Radio, ExternalLink, RefreshCw, LogIn, LogOut, Loader2,
  XCircle, BarChart3, PieChart, ChevronDown, ChevronUp,
  LayoutDashboard, Building2, Search, MapPin, Check,
  ChevronRight, Shield, Layers, Navigation, Wifi, Activity, TrendingUp,
  Monitor, AlertTriangle, BookOpen, ArrowUp, ArrowDown, DoorOpen,
  Weight, Thermometer, Zap, Send, Filter, Clock, List,
} from 'lucide-react';
import { Card, CardBody, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sigma4Chart, Sigma4ChartItem, Sigma4Dashboard, Sigma4Lift, Sigma4ServiceEntry,
  Sigma4MonitorData, MonitorAction,
  getDashboard, getLifts, getLiftServices, getMonitorOnline, sendMonitorAction, activateMonitor, keepAliveMonitor,
  getErrorInfo, getLiftErrors, fetchModesXML, getModeLabel, getModeColor, getSigma4FrontUrl, getSigma4Session,
  getDrivePhaseLabel, getDrivePhaseColor, getContactorLabel, getContactorColor, getBrakeLabel, getBrakeColor,
  isConnectedToSigma4, loginSigma4, logoutSigma4,
  MONITOR_ACTIONS,
} from '@/services/sigma4liftsApi';
import {
  searchErrorCodes, getAllErrorCodes, getErrorStats, getErrorsByFamily,
  mergeApiErrors, severityInfo, severityFromApi, lookupErrorCode,
  SEVERITY_LEVELS, CAUSA_CATEGORIES, S4LErrorCode, SeverityKey, S4LApiErrorEntry,
} from '@/services/sigma4ErrorCodes';

// ═══ TABS ═══
type Tab = 'dashboard' | 'lifts' | 'monitor' | 'errors';

// ═══ MAIN ═══
export function IoTSigmaPage() {
  const [connected, setConnected] = useState(isConnectedToSigma4());
  if (!connected) return <LoginView onConnected={() => setConnected(true)} />;
  return <ConnectedView onDisconnect={() => { logoutSigma4(); setConnected(false); }} />;
}

// ═══ LOGIN ═══
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
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#047857] flex items-center justify-center mx-auto mb-2">
            <Radio className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-[16px] font-extrabold" style={{ letterSpacing: '-0.03em' }}>Sigma4Lifts</h2>
          <p className="text-[9px] text-[var(--text-muted)]">Connectez-vous à votre compte Sigma4Lifts<br />pour accéder à la télésurveillance IoT</p>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Identifiant Sigma4</label>
            <Input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Auver015" className="text-[10px] mt-0.5" onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          <div>
            <label className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Mot de passe</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="text-[10px] mt-0.5" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {error && <div className="flex items-center gap-1 p-1.5 rounded bg-[#DC2626]/10 border border-[#DC2626]/20">
            <XCircle className="w-3 h-3 text-[#DC2626] flex-shrink-0" />
            <p className="text-[8px] text-[#DC2626] font-semibold">{error}</p>
          </div>}
          <button onClick={handleLogin} disabled={loading || !loginName || !password}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-[#059669] to-[#047857] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
        <div className="mt-3 pt-2 border-t border-[var(--border-secondary)] text-center">
          <a href={getSigma4FrontUrl()} target="_blank" rel="noopener noreferrer" className="text-[8px] text-[var(--text-muted)] hover:text-[#059669]">
            <ExternalLink className="w-2.5 h-2.5 inline mr-0.5" />Accéder à sigma4lifts.com
          </a>
        </div>
      </CardBody></Card>
    </div>
  );
}

// ═══ CONNECTED VIEW WITH TABS ═══
function ConnectedView({ onDisconnect }: { onDisconnect: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedLiftId, setSelectedLiftId] = useState<number | null>(null);
  const [selectedLift, setSelectedLift] = useState<Sigma4Lift | undefined>(undefined);
  const session = getSigma4Session();
  const qc = useQueryClient();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lifts', label: 'Ascenseurs', icon: Building2 },
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'errors', label: 'Erreurs', icon: AlertTriangle },
  ];

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#059669] flex items-center justify-center"><Radio className="w-4 h-4 text-white" /></div>
          <div>
            <h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Sigma4Lifts IoT</h1>
            <p className="text-[7px] text-[var(--text-muted)]">Connecté : {session?.userName} {session?.company && `· ${session.company}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => qc.invalidateQueries({ queryKey: ['sigma4'] })} className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Rafraîchir"><RefreshCw className="w-3 h-3" /></button>
          <a href={getSigma4FrontUrl()} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]" title="Sigma4Lifts"><ExternalLink className="w-3 h-3" /></a>
          <button onClick={onDisconnect} className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[8px] font-semibold text-[#DC2626] hover:bg-[#DC2626]/10"><LogOut className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 flex-shrink-0 bg-[var(--bg-secondary)] rounded-lg p-0.5">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold transition-all',
              active ? 'bg-[var(--bg-primary)] text-[#059669] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}>
            <Icon className="w-3 h-3" />{t.label}
          </button>;
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'lifts' && <LiftsTab />}
        {tab === 'monitor' && <MonitorTab selectedLiftId={selectedLiftId} setSelectedLiftId={setSelectedLiftId} onLiftChange={setSelectedLift} />}
        {tab === 'errors' && <ErrorsTab selectedLiftId={selectedLiftId} selectedLift={selectedLift} setSelectedLiftId={setSelectedLiftId} onSwitchToMonitor={() => setTab('monitor')} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ═══════════════════════════════════════════════════════════════

function DashboardTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sigma4', 'dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000,
    retry: 1,
  });
  const qc = useQueryClient();

  if (isLoading) return <LoadingState text="Chargement dashboard Sigma4..." />;
  if (error) return <ErrorState error={error} onRetry={() => qc.invalidateQueries({ queryKey: ['sigma4', 'dashboard'] })} />;
  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto space-y-2">
      <DashboardKPIs charts={data.dashboard} />
      <div className="grid grid-cols-2 gap-1.5">
        {data.dashboard.map(chart => <ChartCard key={chart.idString} chart={chart} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ASCENSEURS (LIFTS)
// ═══════════════════════════════════════════════════════════════

function LiftsTab() {
  const { data: lifts, isLoading, error } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    refetchInterval: 120000,
    retry: 1,
  });
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'ref' | 'city' | 'group'>('ref');
  const [selectedLift, setSelectedLift] = useState<number | null>(null);

  // Extract unique groups
  const groups = useMemo(() => {
    if (!lifts) return [];
    const map = new Map<string, string>();
    lifts.forEach(l => l.groups.forEach(g => map.set(String(g.id), g.groupName)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [lifts]);

  // Filter & sort
  const filtered = useMemo(() => {
    if (!lifts) return [];
    let list = lifts.filter(l => !l.baja); // Exclure désactivés

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.liftCompRef.toLowerCase().includes(q) ||
        l.descripcion.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.zipCode.includes(q)
      );
    }

    if (groupFilter === '__none') {
      list = list.filter(l => l.groups.length === 0);
    } else if (groupFilter !== 'all') {
      list = list.filter(l => l.groups.some(g => String(g.id) === groupFilter));
    }

    if (statusFilter === 'en8128_ok') list = list.filter(l => l.en8128);
    else if (statusFilter === 'en8128_ko') list = list.filter(l => !l.en8128);
    else if (statusFilter === 'has_coords') list = list.filter(l => l.latitude !== 0 && l.longitude !== 0);
    else if (statusFilter === 'no_group') list = list.filter(l => l.groups.length === 0);
    else if (statusFilter.startsWith('estado_')) {
      const code = Number(statusFilter.split('_')[1]);
      list = list.filter(l => l.estado === code);
    }

    list.sort((a, b) => {
      if (sortBy === 'ref') return a.liftCompRef.localeCompare(b.liftCompRef);
      if (sortBy === 'city') return (a.city || 'ZZZ').localeCompare(b.city || 'ZZZ');
      if (sortBy === 'group') return (a.groups[0]?.groupName || 'ZZZ').localeCompare(b.groups[0]?.groupName || 'ZZZ');
      return 0;
    });

    return list;
  }, [lifts, search, groupFilter, statusFilter, sortBy]);

  if (isLoading) return <LoadingState text="Chargement des ascenseurs..." />;
  if (error) return <ErrorState error={error} onRetry={() => qc.invalidateQueries({ queryKey: ['sigma4', 'lifts'] })} />;
  if (!lifts) return null;

  const total = lifts.filter(l => !l.baja).length;
  const withEN = lifts.filter(l => !l.baja && l.en8128).length;
  const withCoords = lifts.filter(l => !l.baja && l.latitude !== 0).length;

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      {/* Stats bar */}
      <div className="flex gap-1 flex-shrink-0">
        {[
          { label: 'Ascenseurs', value: total, icon: Building2, color: '#3B82F6' },
          { label: 'EN 81-28', value: withEN, icon: Shield, color: '#059669' },
          { label: 'Géolocalisés', value: withCoords, icon: MapPin, color: '#8B5CF6' },
          { label: 'Groupes', value: groups.length, icon: Layers, color: '#EA580C' },
        ].map(s => (
          <Card key={s.label} className="flex-1"><CardBody className="p-1.5 flex items-center gap-1.5">
            <s.icon className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} />
            <div>
              <p className="text-[12px] font-extrabold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[6px] text-[var(--text-muted)] font-semibold leading-tight">{s.label}</p>
            </div>
          </CardBody></Card>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-1 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher ref, nom, adresse, ville..."
            className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none focus:border-[#059669] transition-colors"
          />
        </div>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none min-w-0">
          <option value="all">Tous groupes</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value="__none">Sans groupe</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none min-w-0">
          <option value="all">Tous statuts</option>
          <option value="estado_0">En marche</option>
          <option value="estado_90">Sans connexion</option>
          <option value="estado_10">Arrêtés</option>
          <option value="en8128_ok">EN 81-28 ✓</option>
          <option value="en8128_ko">EN 81-28 ✗</option>
          <option value="has_coords">Géolocalisés</option>
          <option value="no_group">Sans groupe</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none min-w-0">
          <option value="ref">Tri: Référence</option>
          <option value="city">Tri: Ville</option>
          <option value="group">Tri: Groupe</option>
        </select>
      </div>

      {/* Count */}
      <div className="flex-shrink-0 px-1">
        <p className="text-[8px] text-[var(--text-muted)]">
          {filtered.length} ascenseur{filtered.length > 1 ? 's' : ''} {filtered.length !== total && `(sur ${total})`}
        </p>
      </div>

      {/* Lift List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-[10px] text-[var(--text-muted)]">Aucun ascenseur trouvé</p>
          </div>
        )}
        {filtered.map(lift => (
          <LiftCard
            key={lift.id}
            lift={lift}
            isExpanded={selectedLift === lift.id}
            onToggle={() => setSelectedLift(selectedLift === lift.id ? null : lift.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ═══ LIFT CARD ═══

function LiftCard({ lift, isExpanded, onToggle }: { lift: Sigma4Lift; isExpanded: boolean; onToggle: () => void }) {
  const hasCoords = lift.latitude !== 0 && lift.longitude !== 0;
  const hasAddress = lift.address || lift.city;
  const status = getEstadoInfo(lift.estado);

  return (
    <Card className={cn('transition-all', isExpanded && 'ring-1 ring-[#059669]/30')}>
      <CardBody className="p-0">
        {/* Summary Row */}
        <button onClick={onToggle} className="w-full flex items-center gap-2 p-2 text-left hover:bg-[var(--bg-secondary)]/50 transition-colors rounded-lg">
          {/* Status indicator bar */}
          <div className={cn('w-1 h-8 rounded-full flex-shrink-0')}
            style={{ backgroundColor: status.color }} />

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold text-[var(--text-primary)]">{lift.liftCompRef}</span>
              <span className="px-1 py-0.5 rounded text-[5px] font-bold" style={{ backgroundColor: status.color + '18', color: status.color }}>{status.label}</span>
              {lift.groups.map(g => (
                <span key={g.id} className="px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10 text-[6px] font-bold text-[#3B82F6]">
                  {g.groupName}
                </span>
              ))}
              {lift.en8128 && <Shield className="w-2.5 h-2.5 text-[#059669]" />}
            </div>
            <p className="text-[8px] text-[var(--text-muted)] truncate">{lift.descripcion || '—'}</p>
            {hasAddress && (
              <p className="text-[7px] text-[var(--text-muted)] truncate flex items-center gap-0.5">
                <MapPin className="w-2 h-2 flex-shrink-0" />
                {[lift.address, lift.zipCode, lift.city].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Right side: tech info */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {lift.numeroParadas != null && lift.numeroParadas > 0 && (
              <div className="text-center">
                <p className="text-[10px] font-bold font-mono text-[var(--text-primary)]">{lift.numeroParadas}</p>
                <p className="text-[5px] text-[var(--text-muted)]">arrêts</p>
              </div>
            )}
            {lift.cargaUtil != null && lift.cargaUtil > 0 && (
              <div className="text-center">
                <p className="text-[10px] font-bold font-mono text-[var(--text-primary)]">{lift.cargaUtil}</p>
                <p className="text-[5px] text-[var(--text-muted)]">kg</p>
              </div>
            )}
            {lift.numeroPersonas > 0 && (
              <div className="text-center">
                <p className="text-[10px] font-bold font-mono text-[var(--text-primary)]">{lift.numeroPersonas}</p>
                <p className="text-[5px] text-[var(--text-muted)]">pers.</p>
              </div>
            )}
            <ChevronRight className={cn('w-3 h-3 text-[var(--text-muted)] transition-transform', isExpanded && 'rotate-90')} />
          </div>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-[var(--border-secondary)] space-y-2">
            {/* Technical Details Grid */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              <DetailItem label="Traction" value={cleanTechLabel(lift.traccion)} />
              <DetailItem label="Architecture" value={cleanTechLabel(lift.arquitectura)} />
              <DetailItem label="Fabricant" value={cleanTechLabel(lift.manufacturerName)} />
              <DetailItem label="Modèle téléphone" value={cleanTechLabel(lift.modeloTelefono)} />
              <DetailItem label="Modèle ascenseur" value={cleanTechLabel(lift.modeloAscensor)} />
              <DetailItem label="Réf. fabricant" value={lift.manufacturerRef || '—'} />
              <DetailItem label="Type liaison" value={getTipoEnlaceLabel(lift.tipoEnlace)} />
              <DetailItem label="Cabines batterie" value={String(lift.ascensoresEnBateria)} />
              <DetailItem label="Version SW" value={lift.versionSW || '—'} />
              <DetailItem label="Accès PV" value={lift.accesoPv ? 'Oui' : 'Non'} />
              <DetailItem label="CCID" value={lift.ccid ? `...${lift.ccid.slice(-8)}` : '—'} />
              <DetailItem label="État (código)" value={String(lift.estado)} />
            </div>

            {/* Network info (if available) */}
            {(lift.ip || lift.apn || lift.simStatus) && (
              <div className="p-1.5 rounded bg-[var(--bg-secondary)]">
                <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5" />Réseau / SIM
                </p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {lift.ip && <DetailItem label="IP" value={lift.ip} />}
                  {lift.apn && <DetailItem label="APN" value={lift.apn} />}
                  {lift.simStatus && <DetailItem label="SIM" value={lift.simStatus} />}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              {lift.commisioningDate && <DetailItem label="Mise en service" value={formatDate(lift.commisioningDate)} />}
              {lift.registrationDate && <DetailItem label="Enregistrement" value={formatDate(lift.registrationDate)} />}
              {lift.billingStartDate && <DetailItem label="Début facturation" value={formatDate(lift.billingStartDate)} />}
            </div>

            {/* EN 81-28 */}
            <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-secondary)]">
              <Shield className={cn('w-3.5 h-3.5', lift.en8128 ? 'text-[#059669]' : 'text-[var(--text-muted)]')} />
              <div className="flex-1">
                <p className="text-[8px] font-bold">{lift.en8128 ? 'EN 81-28 conforme' : 'EN 81-28 non conforme'}</p>
                {lift.dateEN8128OK && <p className="text-[7px] text-[var(--text-muted)]">Validé le {formatDate(lift.dateEN8128OK)}</p>}
                {lift.reporteExternoEn8128 && <p className="text-[6px] text-[#EA580C] font-semibold">Report externe actif</p>}
              </div>
            </div>

            {/* Traffic / Services */}
            <LiftTrafficSection liftId={lift.id} />

            {/* Actions */}
            <div className="flex gap-1">
              {hasCoords && (
                <a href={`https://www.google.com/maps?q=${lift.latitude},${lift.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#3B82F6]/10 text-[#3B82F6] text-[8px] font-bold hover:bg-[#3B82F6]/20 transition-colors">
                  <Navigation className="w-2.5 h-2.5" />Voir sur la carte
                </a>
              )}
              <a href={`${getSigma4FrontUrl()}lift/${lift.id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#059669]/10 text-[#059669] text-[8px] font-bold hover:bg-[#059669]/20 transition-colors">
                <ExternalLink className="w-2.5 h-2.5" />Sigma4Lifts
              </a>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[6px] text-[var(--text-muted)] font-semibold uppercase">{label}</p>
      <p className="text-[8px] font-bold text-[var(--text-primary)] truncate">{value}</p>
    </div>
  );
}

// ═══ LIFT TRAFFIC SECTION ═══

function LiftTrafficSection({ liftId }: { liftId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sigma4', 'services', liftId],
    queryFn: () => getLiftServices(liftId),
    retry: 1,
    staleTime: 300000, // 5 min cache
  });

  if (isLoading) return (
    <div className="flex items-center gap-1.5 p-1.5 rounded bg-[var(--bg-secondary)]">
      <Loader2 className="w-3 h-3 animate-spin text-[#3B82F6]" />
      <span className="text-[8px] text-[var(--text-muted)]">Chargement trafic...</span>
    </div>
  );

  if (error || !data || data.length < 2) return null;

  // Sort by date ascending
  const sorted = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Calculate daily trips (difference between consecutive days)
  const dailyTrips: { date: string; trips: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].total - sorted[i - 1].total;
    if (diff >= 0) { // skip negative diffs (data anomalies)
      dailyTrips.push({ date: sorted[i].fecha, trips: diff });
    }
  }

  if (dailyTrips.length === 0) return null;

  // Stats
  const totalCounter = sorted[sorted.length - 1].total;
  const last30 = dailyTrips.slice(-30);
  const avgDaily = last30.length > 0 ? Math.round(last30.reduce((a, d) => a + d.trips, 0) / last30.length) : 0;
  const maxDaily = Math.max(...last30.map(d => d.trips));
  const totalLast30 = last30.reduce((a, d) => a + d.trips, 0);

  // Sparkline data (last 60 days for the chart)
  const sparkData = dailyTrips.slice(-60);
  const sparkMax = Math.max(...sparkData.map(d => d.trips), 1);

  return (
    <div className="p-1.5 rounded bg-[var(--bg-secondary)] space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
          <Activity className="w-2.5 h-2.5" />Trafic / Manœuvres
        </p>
        <span className="text-[7px] font-mono text-[var(--text-muted)]">Compteur: {totalCounter.toLocaleString('fr-FR')}</span>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-1">
        <div className="text-center p-1 rounded bg-[var(--bg-primary)]">
          <p className="text-[11px] font-extrabold font-mono text-[#3B82F6]">{avgDaily}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">moy/jour (30j)</p>
        </div>
        <div className="text-center p-1 rounded bg-[var(--bg-primary)]">
          <p className="text-[11px] font-extrabold font-mono text-[#8B5CF6]">{maxDaily}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">max/jour (30j)</p>
        </div>
        <div className="text-center p-1 rounded bg-[var(--bg-primary)]">
          <p className="text-[11px] font-extrabold font-mono text-[#059669]">{totalLast30.toLocaleString('fr-FR')}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">total 30j</p>
        </div>
      </div>

      {/* Sparkline Bar Chart */}
      <div>
        <p className="text-[6px] text-[var(--text-muted)] mb-0.5">Manœuvres / jour (60 derniers jours)</p>
        <div className="flex items-end gap-px h-10">
          {sparkData.map((d, i) => {
            const pct = (d.trips / sparkMax) * 100;
            const isWeekend = [0, 6].includes(new Date(d.date).getDay());
            return (
              <div key={d.date} className="flex-1 group relative" title={`${formatDateShort(d.date)}: ${d.trips} manœuvres`}>
                <div
                  className="w-full rounded-t-sm transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    backgroundColor: isWeekend ? '#64748B' : '#3B82F6',
                    opacity: isWeekend ? 0.5 : 0.8,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Date labels */}
        <div className="flex justify-between mt-0.5">
          <span className="text-[5px] text-[var(--text-muted)]">{formatDateShort(sparkData[0]?.date)}</span>
          <span className="text-[5px] text-[var(--text-muted)]">{formatDateShort(sparkData[sparkData.length - 1]?.date)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD COMPONENTS
// ═══════════════════════════════════════════════════════════════

function DashboardKPIs({ charts }: { charts: Sigma4Chart[] }) {
  const fonctionnement = charts.find(c => c.idString === 'ESTADO_DE_FUNCIONAMIENTO');
  const contrat = charts.find(c => c.idString === 'TOTAL_ASCENSORES_CONECTADOS');
  const en81 = charts.find(c => c.idString === 'CUMPLIMIENTO_EN81_28');

  const enMarche = fonctionnement?.data.find(d => d.id.includes('OPERATIVO'))?.quantity || 0;
  const aLarret = fonctionnement?.data.find(d => d.id.includes('PARADO'))?.quantity || 0;
  const maintenance = fonctionnement?.data.find(d => d.id.includes('MANTENIMIENTO'))?.quantity || 0;
  const sansConnexion = fonctionnement?.data.find(d => d.id.includes('SIN_CONEXION'))?.quantity || 0;
  const totalSim = contrat?.data.reduce((a, d) => a + d.quantity, 0) || 0;
  const en28ok = en81?.data.find(d => d.id.includes('OK'))?.quantity || 0;
  const en28ko = en81?.data.find(d => d.id.includes('KO'))?.quantity || 0;
  const en28total = en28ok + en28ko;

  return <div className="grid grid-cols-5 gap-1">
    {[
      { label: 'Total connectés', value: totalSim, color: '#3B82F6' },
      { label: 'En marche', value: enMarche, color: '#059669' },
      { label: 'À l\'arrêt', value: aLarret, color: '#DC2626' },
      { label: 'Maintenance', value: maintenance, color: '#8B5CF6' },
      { label: 'Sans connexion', value: sansConnexion, color: '#EA580C' },
    ].map(k => <Card key={k.label}><CardBody className="p-1.5 text-center">
      <p className="text-[16px] font-extrabold font-mono" style={{ color: k.color }}>{k.value}</p>
      <p className="text-[6px] text-[var(--text-muted)] font-semibold leading-tight">{k.label}</p>
    </CardBody></Card>)}
    {en28total > 0 && <div className="col-span-5">
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--bg-secondary)]">
        <span className="text-[8px] font-bold">EN 81-28 :</span>
        <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#059669]" style={{ width: `${(en28ok / en28total) * 100}%` }} />
        </div>
        <span className="text-[8px] font-mono"><span className="text-[#059669] font-bold">{en28ok}</span> OK / <span className="text-[#DC2626] font-bold">{en28ko}</span> KO</span>
      </div>
    </div>}
  </div>;
}

// ═══ CHART CARD ═══

const CHART_COLORS = ['#059669', '#3B82F6', '#8B5CF6', '#EA580C', '#DC2626', '#CA8A04', '#06B6D4', '#D946EF', '#F97316', '#64748B', '#10B981', '#6366F1'];

function ChartCard({ chart }: { chart: Sigma4Chart }) {
  const [expanded, setExpanded] = useState(false);
  const items = chart.data.filter(d => d.quantity > 0 && d.label);
  const total = items.reduce((a, d) => a + d.quantity, 0);
  if (items.length === 0) return null;

  const isKey = ['ESTADO_DE_FUNCIONAMIENTO', 'TOTAL_ASCENSORES_CONECTADOS', 'CUMPLIMIENTO_EN81_28', 'MODELO_MANIOBRA'].includes(chart.idString);

  return <Card className={isKey ? 'col-span-2' : ''}>
    <CardBody className="p-2">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          {chart.aspect === 'pie' ? <PieChart className="w-3 h-3 text-[#3B82F6]" /> : <BarChart3 className="w-3 h-3 text-[#8B5CF6]" />}
          <span className="text-[9px] font-bold">{chart.caption}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-mono text-[var(--text-muted)]">{total}</span>
          {expanded ? <ChevronUp className="w-2.5 h-2.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)]" />}
        </div>
      </button>

      {chart.aspect === 'pie' ? <PieViz items={items} total={total} /> : <BarViz items={items} />}

      {expanded && <div className="mt-1.5 pt-1 border-t border-[var(--border-secondary)] space-y-0.5">
        {items.sort((a, b) => b.quantity - a.quantity).map((d, i) => <div key={d.id} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="text-[7px] flex-1 truncate">{cleanLabel(d.label)}</span>
          <span className="text-[8px] font-mono font-bold">{d.quantity}</span>
          <span className="text-[6px] text-[var(--text-muted)] font-mono w-8 text-right">{total > 0 ? Math.round((d.quantity / total) * 100) : 0}%</span>
        </div>)}
      </div>}
    </CardBody>
  </Card>;
}

// ═══ PIE VISUALIZATION ═══

function PieViz({ items, total }: { items: Sigma4ChartItem[]; total: number }) {
  let cumul = 0;
  const segments = items.map((d, i) => {
    const pct = total > 0 ? (d.quantity / total) * 100 : 0;
    const offset = cumul;
    cumul += pct;
    return { ...d, pct, offset, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return <div className="flex items-center gap-2">
    <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90 flex-shrink-0">
      {segments.map(s => <circle key={s.id} cx="18" cy="18" r="12" fill="none"
        stroke={s.color} strokeWidth="5"
        strokeDasharray={`${s.pct * 0.754} ${(100 - s.pct) * 0.754}`}
        strokeDashoffset={`${-s.offset * 0.754}`} />)}
    </svg>
    <div className="flex-1 space-y-0.5">
      {segments.slice(0, 4).map(s => <div key={s.id} className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
        <span className="text-[7px] truncate flex-1">{cleanLabel(s.label)}</span>
        <span className="text-[7px] font-mono font-bold">{s.quantity}</span>
      </div>)}
      {segments.length > 4 && <p className="text-[6px] text-[var(--text-muted)]">+{segments.length - 4} autres</p>}
    </div>
  </div>;
}

// ═══ BAR VISUALIZATION ═══

function BarViz({ items }: { items: Sigma4ChartItem[] }) {
  const max = Math.max(...items.map(d => d.quantity));
  const sorted = [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 6);

  return <div className="space-y-0.5">
    {sorted.map((d, i) => {
      const pct = max > 0 ? (d.quantity / max) * 100 : 0;
      return <div key={d.id} className="flex items-center gap-1.5">
        <span className="text-[6px] w-20 truncate text-right text-[var(--text-muted)]">{cleanLabel(d.label)}</span>
        <div className="flex-1 h-2.5 bg-[var(--bg-tertiary)] rounded overflow-hidden">
          <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
        </div>
        <span className="text-[7px] font-mono font-bold w-6 text-right">{d.quantity}</span>
      </div>;
    })}
    {items.length > 6 && <p className="text-[6px] text-[var(--text-muted)] text-right">+{items.length - 6} autres</p>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// TAB: MONITOR ONLINE — Supervision temps réel
// ═══════════════════════════════════════════════════════════════

function MonitorTab({ selectedLiftId, setSelectedLiftId, onLiftChange }: {
  selectedLiftId: number | null;
  setSelectedLiftId: (id: number | null) => void;
  onLiftChange: (lift: Sigma4Lift | undefined) => void;
}) {
  const { data: lifts, isLoading } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    staleTime: 120000,
    retry: 1,
  });
  const [search, setSearch] = useState('');

  const activeLifts = useMemo(() => {
    if (!lifts) return [];
    let list = lifts.filter(l => !l.baja);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.liftCompRef.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.descripcion.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.liftCompRef.localeCompare(b.liftCompRef));
  }, [lifts, search]);

  // Notifier le parent quand le lift sélectionné change
  useEffect(() => {
    const lift = activeLifts.find(l => l.id === selectedLiftId);
    onLiftChange(lift);
  }, [selectedLiftId, activeLifts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <LoadingState text="Chargement des ascenseurs..." />;

  return (
    <div className="h-full flex gap-2 overflow-hidden">
      {/* Sidebar — Sélection ascenseur */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-1 overflow-hidden">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[8px] outline-none focus:border-[#059669]" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {activeLifts.map(l => {
            const st = getEstadoInfo(l.estado);
            return (
              <button key={l.id} onClick={() => setSelectedLiftId(l.id)}
                className={cn('w-full text-left px-2 py-1.5 rounded-lg transition-all text-[8px]',
                  selectedLiftId === l.id
                    ? 'bg-[#059669]/15 ring-1 ring-[#059669]/30'
                    : 'hover:bg-[var(--bg-secondary)]'
                )}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="font-bold truncate">{l.liftCompRef}</span>
                </div>
                <p className="text-[6px] text-[var(--text-muted)] truncate pl-3">
                  {l.city || l.descripcion || '—'}
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-[6px] text-[var(--text-muted)] text-center">
          {activeLifts.length} ascenseur{activeLifts.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Main — Monitor Panel */}
      <div className="flex-1 overflow-hidden">
        {selectedLiftId ? (
          <MonitorPanel
            liftId={selectedLiftId}
            lift={activeLifts.find(l => l.id === selectedLiftId)}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Monitor className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
              <p className="text-[10px] text-[var(--text-muted)]">
                Sélectionnez un ascenseur pour accéder au Monitor Online
              </p>
              <p className="text-[7px] text-[var(--text-muted)] mt-1">
                Supervision temps réel : position, portes, sécurité, voyages, commandes à distance
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MONITOR PANEL ──

function MonitorPanel({ liftId, lift }: { liftId: number; lift?: Sigma4Lift }) {
  const qc = useQueryClient();

  // ── Phase de connexion ──
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [connectionStep, setConnectionStep] = useState(0);
  const [connectionError, setConnectionError] = useState('');
  const [initialMonitorData, setInitialMonitorData] = useState<Sigma4MonitorData | null>(null);

  const CONNECTION_STEPS = [
    { label: 'Établissement de la connexion…', icon: '📡' },
    { label: 'Activation du monitor…', icon: '🔌' },
    { label: 'Synchronisation des données…', icon: '📊' },
    { label: 'Connexion établie', icon: '✅' },
  ];

  useEffect(() => {
    let cancelled = false;
    setConnectionState('connecting');
    setConnectionStep(0);
    setConnectionError('');

    (async () => {
      try {
        // Étape 1 — Connexion
        if (cancelled) return;
        setConnectionStep(0);
        await new Promise(r => setTimeout(r, 300));

        // Étape 2 — Activation du monitor
        if (cancelled) return;
        setConnectionStep(1);
        try {
          await activateMonitor(liftId);
        } catch (e: any) {
          console.warn('[Monitor] activateMonitor failed:', e.message);
          // Continue quand même — status peut fonctionner sans activation explicite
        }

        // Étape 3 — Premier fetch des données
        if (cancelled) return;
        setConnectionStep(2);
        const firstData = await getMonitorOnline(liftId);
        if (!cancelled) setInitialMonitorData(firstData);

        // Étape 4 — Connecté (immédiat)
        if (cancelled) return;
        setConnectionStep(3);
        await new Promise(r => setTimeout(r, 150));

        if (!cancelled) setConnectionState('connected');
      } catch (e: any) {
        if (!cancelled) {
          setConnectionError(e.message || 'Erreur de connexion');
          setConnectionState('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [liftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep-alive : ré-activer le monitor toutes les 10s ──
  useEffect(() => {
    if (connectionState !== 'connected') return;
    const interval = setInterval(() => {
      keepAliveMonitor(liftId).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [connectionState, liftId]);

  // ── Polling (uniquement quand connecté) ──
  const { data: monitor, error, dataUpdatedAt } = useQuery({
    queryKey: ['sigma4', 'monitor', liftId],
    queryFn: () => getMonitorOnline(liftId),
    refetchInterval: 2000,
    retry: 1,
    retryDelay: 5000,
    enabled: connectionState === 'connected',
    initialData: initialMonitorData ?? undefined,
    initialDataUpdatedAt: initialMonitorData ? Date.now() : undefined,
    structuralSharing: false, // évite les comparaisons profondes à chaque poll (perf)
  });
  useQuery({ queryKey: ['sigma4', 'modes'], queryFn: fetchModesXML, staleTime: Infinity, retry: false });
  const [showActions, setShowActions] = useState(false);

  const handleAction = async (action: MonitorAction) => {
    const label = MONITOR_ACTIONS.find(a => a.key === action)?.label || action;
    if (!confirm(`Confirmer l'action : ${label} ?`)) return;
    try {
      await sendMonitorAction(liftId, action, lift?.numeroCabina || 1);
      toast.success('Action envoyée : ' + label);
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] }), 2000);
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'envoi');
    }
  };

  /** Envoyer un appel via ecogo/Comando */
  const handleComando = async (planta: number, orden: string) => {
    const typeLabel = orden === 'LlamadasCabina' ? 'cabine' : orden === 'LlamadasExterioresSubida' ? 'montée' : 'descente';
    if (!confirm(`Envoyer appel ${typeLabel} → étage ${planta} ?`)) return;
    try {
      await sendMonitorAction(liftId, 'Comando' as MonitorAction, lift?.numeroCabina || 1, { orden, planta: planta - 1 });
      toast.success(`Appel ${typeLabel} envoyé : étage ${planta}`);
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] }), 1500);
    } catch (e: any) {
      const msg = e.message || 'Erreur inconnue';
      console.error('[Comando]', liftId, orden, planta, msg);
      toast.error(`Erreur appel étage ${planta} : ${msg}`);
    }
  };

  // ── Écran de connexion ──
  if (connectionState === 'connecting') {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-64"><CardBody className="p-5 space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#059669]/10 flex items-center justify-center mx-auto mb-3">
              <Monitor className="w-6 h-6 text-[#059669]" />
            </div>
            <h3 className="text-[12px] font-extrabold">Connexion au Monitor</h3>
            <p className="text-[8px] text-[var(--text-muted)] mt-0.5">{lift?.liftCompRef || `#${liftId}`}</p>
          </div>

          <div className="space-y-2">
            {CONNECTION_STEPS.map((step, i) => {
              const isActive = i === connectionStep;
              const isDone = i < connectionStep;
              return (
                <div key={i} className={cn('flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-300',
                  isActive ? 'bg-[#059669]/10' : isDone ? 'opacity-60' : 'opacity-25'
                )}>
                  {isDone ? (
                    <div className="w-4 h-4 rounded-full bg-[#059669] flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  ) : isActive ? (
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 rounded-full border-2 border-[#059669] border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0" />
                  )}
                  <span className={cn('text-[8px] font-semibold',
                    isActive ? 'text-[#059669]' : isDone ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                  )}>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Barre de progression */}
          <div className="w-full h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div className="h-full bg-[#059669] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((connectionStep + 1) / CONNECTION_STEPS.length) * 100}%` }} />
          </div>
        </CardBody></Card>
      </div>
    );
  }

  // ── Erreur de connexion ──
  if (connectionState === 'error') {
    const is404 = connectionError.includes('404') || connectionError.includes('Not Found');
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-64"><CardBody className="p-5 text-center space-y-3">
          {is404 ? (
            <>
              <Monitor className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
              <p className="text-[10px] font-bold text-[var(--text-muted)]">Monitor non disponible</p>
              <p className="text-[8px] text-[var(--text-muted)]">
                L'ascenseur <strong>{lift?.liftCompRef}</strong> ne supporte pas le monitoring temps réel.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
              <p className="text-[10px] font-bold text-[#DC2626]">Échec de connexion</p>
              <p className="text-[8px] text-[var(--text-muted)]">{connectionError}</p>
            </>
          )}
          <button onClick={() => { setConnectionState('connecting'); setConnectionStep(0); setInitialMonitorData(null); }}
            className="px-4 py-1.5 rounded bg-[#059669] text-white text-[9px] font-bold hover:bg-[#059669]/90">
            Réessayer
          </button>
        </CardBody></Card>
      </div>
    );
  }

  // ── Erreur de polling (après connexion réussie) ──
  if (error && !monitor) {
    const msg = (error as Error).message || '';
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-64"><CardBody className="p-5 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-[10px] font-bold text-[#DC2626]">Connexion perdue</p>
          <p className="text-[8px] text-[var(--text-muted)]">{msg}</p>
          <button onClick={() => { setConnectionState('connecting'); setConnectionStep(0); setInitialMonitorData(null); }}
            className="px-4 py-1.5 rounded bg-[#059669] text-white text-[9px] font-bold hover:bg-[#059669]/90">
            Reconnecter
          </button>
        </CardBody></Card>
      </div>
    );
  }

  // Helpers
  const updatedAt = monitor?.fechaActualizacion
    ? new Date(monitor.fechaActualizacion).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const hasError = monitor && (monitor.codigoError !== 0 || monitor.codigoFamiliaError !== 0);
  const errorStr = hasError ? `F${String(monitor!.codigoFamiliaError || 0).padStart(2,'0')}${String(monitor!.codigoError || 0).padStart(2,'0')}` : null;

  // Nombre de paliers réels (depuis lift ou fallback)
  const numStops = lift?.numeroParadas || 32;

  // Extraire les étages avec appels actifs (seulement étages existants)
  const activeCabinCalls = monitor?.llamadasCabina?.reduce<number[]>((acc, v, i) => { if (v && i < numStops) acc.push(i + 1); return acc; }, []) || [];
  const activeUpCalls = monitor?.llamadasExterioresSubida?.reduce<number[]>((acc, v, i) => { if (v && i < numStops) acc.push(i + 1); return acc; }, []) || [];
  const activeDownCalls = monitor?.llamadasExterioresBajada?.reduce<number[]>((acc, v, i) => { if (v && i < numStops) acc.push(i + 1); return acc; }, []) || [];

  // Embarque principal (porte 1)
  const door = monitor?.embarques?.[0];
  const doorLabel = door ? (['Fermée', 'Ouverture…', 'Ouverte', 'Fermeture…'][door.estado] || `État ${door.estado}`) : '—';
  const doorColor = door ? (['#059669', '#CA8A04', '#EA580C', '#CA8A04'][door.estado] || '#64748B') : '#64748B';

  // Conversion intensités (API renvoie en centièmes d'ampère)
  // Removed fmtA — using AliCard now

  return (
    <div className="h-full overflow-y-auto space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#059669] flex items-center justify-center">
            <Monitor className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-[12px] font-extrabold">{lift?.liftCompRef || `#${liftId}`}</h3>
            <p className="text-[7px] text-[var(--text-muted)]">
              {lift?.city}{lift?.city && lift?.descripcion ? ' · ' : ''}{lift?.descripcion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
          <span className="text-[7px] text-[var(--text-muted)]">
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('fr-FR') : 'Live'}
          </span>
          {updatedAt && (
            <span className="text-[6px] text-[var(--text-muted)] opacity-60" title="Dernière mise à jour de l'ascenseur">
              (S4L: {updatedAt})
            </span>
          )}
          <button onClick={() => qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] })}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {monitor ? (
        <>
          {/* ── Dernier événement / Erreur ── */}
          {hasError ? (
            <Card className="ring-1 ring-[#DC2626]/30"><CardBody className="p-2 flex items-center gap-2 bg-[#DC2626]/5">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
              <div>
                <p className="text-[9px] font-extrabold text-[#DC2626]">Erreur active : {errorStr}</p>
                <p className="text-[7px] text-[var(--text-muted)]">
                  Famille {monitor.codigoFamiliaError} · Code {monitor.codigoError} · Sous-code {monitor.codigoSubError}
                  {monitor.codigoErrorString && ` · ${monitor.codigoErrorString}`}
                </p>
              </div>
            </CardBody></Card>
          ) : (
            <Card><CardBody className="p-1.5 flex items-center gap-1.5 bg-[#059669]/5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              <p className="text-[8px] text-[#059669] font-semibold">L'ascenseur fonctionne correctement</p>
            </CardBody></Card>
          )}

          {/* ── État — Mode de fonctionnement ── */}
          <Card><CardBody className="p-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${getModeColor(monitor.modoFuncionamiento)}20` }}>
              <Layers className="w-3.5 h-3.5" style={{ color: getModeColor(monitor.modoFuncionamiento) }} />
            </div>
            <div>
              <p className="text-[6px] text-[var(--text-muted)] font-semibold uppercase">État</p>
              <p className="text-[11px] font-extrabold" style={{ color: getModeColor(monitor.modoFuncionamiento) }}>{getModeLabel(monitor.modoFuncionamiento)}</p>
            </div>
          </CardBody></Card>

          {/* ── KPIs principaux ── */}
          <div className="grid grid-cols-3 gap-1.5">
            <MiniKPI label="Position" value={monitor.posicionMilimetros != null ? `${monitor.posicionMilimetros} mm` : '—'}
              icon={<MapPin className="w-3.5 h-3.5" />} color="#3B82F6" />
            <MiniKPI label="Destination" value={monitor.destino != null ? String(monitor.destino) : '—'}
              icon={<Navigation className="w-3.5 h-3.5" />} color="#8B5CF6" />
            <MiniKPI label="Poids" value={monitor.peso != null ? `${monitor.peso} Kg` : '—'}
              icon={<Weight className="w-3.5 h-3.5" />} color="#EA580C" />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* ── Portes ── */}
            <Card><CardBody className="p-2 space-y-1.5">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                <DoorOpen className="w-2.5 h-2.5" /> Portes
              </p>
              <div className="grid grid-cols-2 gap-1">
                <MonitorBadge label="Porte 1" value={doorLabel} color={doorColor} />
                <MonitorBadge label="Cellule photo" value={door?.fotocelula ? '⚠️ Activée' : 'Libre'} color={door?.fotocelula ? '#CA8A04' : '#059669'} />
                <MonitorBadge label="À niveau" value={monitor.nivel ? '✅ Oui' : 'Non'} color={monitor.nivel ? '#059669' : '#CA8A04'} />
                <MonitorBadge label="Surcharge" value={monitor.motivoNoArranque === 8 || monitor.peso != null && lift?.cargaUtil != null && monitor.peso > lift.cargaUtil ? '⚠️ OUI' : 'Non'} color={monitor.motivoNoArranque === 8 ? '#DC2626' : '#059669'} />
              </div>
              {monitor.embarques && monitor.embarques.length > 1 && monitor.embarques[1].habilitado && (
                <div className="pt-1 border-t border-[var(--border-secondary)]">
                  <div className="grid grid-cols-2 gap-1">
                    <MonitorBadge label="Porte 2"
                      value={['Fermée', 'Ouverture…', 'Ouverte', 'Fermeture…'][monitor.embarques[1].estado] || `État ${monitor.embarques[1].estado}`}
                      color={['#059669', '#CA8A04', '#EA580C', '#CA8A04'][monitor.embarques[1].estado] || '#64748B'} />
                    <MonitorBadge label="Cellule 2" value={monitor.embarques[1].fotocelula ? '⚠️ Activée' : 'Libre'}
                      color={monitor.embarques[1].fotocelula ? '#CA8A04' : '#059669'} />
                  </div>
                </div>
              )}
              {monitor.flechaSubida && (
                <div className="flex items-center gap-1"><ArrowUp className="w-3 h-3 text-[#059669]" /><span className="text-[7px] text-[#059669] font-bold">Montée</span></div>
              )}
              {monitor.flechaBajada && (
                <div className="flex items-center gap-1"><ArrowDown className="w-3 h-3 text-[#3B82F6]" /><span className="text-[7px] text-[#3B82F6] font-bold">Descente</span></div>
              )}
            </CardBody></Card>

            {/* ── Chaîne de sécurité (Série) ── */}
            <Card><CardBody className="p-2 space-y-1.5">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Série
              </p>
              {/* Points optionnels 85, 95 au-dessus (comme S4L) */}
              <div className="flex justify-center gap-6">
                {([['85', monitor.serieSeguridad85], ['95', monitor.serieSeguridad95]] as [string, boolean | null][]).map(([id, ok]) => (
                  <div key={id}
                    className="w-7 h-5 rounded flex items-center justify-center text-[8px] font-extrabold"
                    style={{
                      backgroundColor: ok === true ? '#5cb85c' : '#9e9e9e',
                      color: 'white',
                    }}>
                    {id}
                  </div>
                ))}
              </div>
              {/* Points principaux 00, 40, 60, 70, 80, 90 */}
              <div className="flex justify-center gap-1">
                {([
                  ['00', monitor.serieSeguridad00],
                  ['40', monitor.serieSeguridad40],
                  ['60', monitor.serieSeguridad60],
                  ['70', monitor.serieSeguridad70],
                  ['80', monitor.serieSeguridad80],
                  ['90', monitor.serieSeguridad90],
                ] as [string, boolean | null][]).map(([id, ok]) => (
                  <div key={id}
                    className="w-8 h-6 rounded flex items-center justify-center text-[9px] font-extrabold"
                    style={{
                      backgroundColor: ok === true ? '#5cb85c' : '#9e9e9e',
                      color: 'white',
                    }}>
                    {id}
                  </div>
                ))}
              </div>
            </CardBody></Card>
          </div>

          {/* ── Alimentation ── */}
          <Card><CardBody className="p-2">
            <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Alimentation
            </p>
            {/* Grille 3 colonnes fidèle au layout S4L */}
            <div className="grid grid-cols-3 gap-1.5">
              <AliCard label="Tension d'entrée" value={monitor.tensionEntrada} unit="V" />
              <AliCard label="Tension (batterie)" value={monitor.tensionBateria != null ? Math.round(monitor.tensionBateria / 10) : null} unit="V" />
              <AliCard label="Tension (circuit contrôleur)" value={monitor.tensionManiobra} unit="V" />
              <AliCard label="Courant (circuit contrôleur)" value={monitor.intensidadManiobra != null ? (monitor.intensidadManiobra / 100) : null} unit="A" decimals={2} />
              <AliCard label="Tension (circuit auxiliaire)" value={monitor.tensionCircuitoAux} unit="V" />
              <AliCard label="Courant (circuit auxiliaire)" value={monitor.intensidadCircuitoAux != null ? (monitor.intensidadCircuitoAux / 100) : null} unit="A" decimals={2} />
            </div>
            {/* Batterie + Réseau */}
            {monitor.cargaBateria != null && (
              <div className="mt-2 pt-1.5 border-t border-[var(--border-secondary)] flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-10 border-2 rounded-sm overflow-hidden" style={{ borderColor: monitor.cargaBateria < 30 ? '#DC2626' : monitor.cargaBateria < 60 ? '#CA8A04' : '#5cb85c' }}>
                    <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-t" style={{ backgroundColor: monitor.cargaBateria < 30 ? '#DC2626' : monitor.cargaBateria < 60 ? '#CA8A04' : '#5cb85c' }} />
                    <div className="absolute bottom-0 w-full transition-all"
                      style={{
                        height: `${monitor.cargaBateria}%`,
                        backgroundColor: monitor.cargaBateria < 30 ? '#DC2626' : monitor.cargaBateria < 60 ? '#CA8A04' : '#5cb85c',
                      }} />
                  </div>
                  <span className="text-[13px] font-extrabold" style={{
                    color: monitor.cargaBateria < 30 ? '#DC2626' : monitor.cargaBateria < 60 ? '#CA8A04' : '#5cb85c'
                  }}>{monitor.cargaBateria} %</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', monitor.conectadoARed ? 'bg-[#5cb85c]' : 'bg-[#DC2626]')} />
                  <span className="text-[8px] font-bold text-[var(--text-secondary)]">
                    {monitor.conectadoARed ? 'Connecté au réseau' : 'Déconnecté'}
                  </span>
                </div>
              </div>
            )}
          </CardBody></Card>

          {/* ── Variateur & Bus ── */}
          <Card><CardBody className="p-2">
            <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" /> Variateur
            </p>
            <div className="grid grid-cols-4 gap-1">
              <MonitorBadge label="Phase" value={getDrivePhaseLabel(monitor.faseVariador)} color={getDrivePhaseColor(monitor.faseVariador)} />
              <MonitorBadge label="Contacteurs" value={getContactorLabel(monitor.variadorContactores)} color={getContactorColor(monitor.variadorContactores)} />
              <MonitorBadge label="Frein" value={getBrakeLabel(monitor.variadorFreno)} color={getBrakeColor(monitor.variadorFreno)} />
              <MonitorBadge label="TSO" value={monitor.variadorTSO ? 'Actif' : 'Inactif'} color={monitor.variadorTSO ? '#DC2626' : '#059669'} />
              <MonitorBadge label="V bus" value={monitor.tensionBus != null ? `${monitor.tensionBus} V` : '—'} color="#3B82F6" />
              <MonitorBadge label="I bus" value={monitor.intensidadBus != null ? `${monitor.intensidadBus}` : '—'} color="#3B82F6" />
              <MonitorBadge label="Bus manœuvre" value={busLabel(monitor.usoBusManiobra)} color={busColor(monitor.usoBusManiobra)} />
              <MonitorBadge label="Bus gaine" value={busLabel(monitor.usoBusHueco)} color={busColor(monitor.usoBusHueco)} />
            </div>
          </CardBody></Card>

          {/* ── Appels (Envoi de cabine / Palier montée / Palier descente) ── */}
          <Card><CardBody className="p-2">
            <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1.5">Appel / Envoi</p>
            <div className="grid grid-cols-3 gap-2">
              {/* Envoi de cabine (cliquable → envoie Comando) */}
              <div>
                <p className="text-[6px] font-bold text-white bg-[#6B7280] rounded px-1.5 py-0.5 mb-1">Envoi de cabine</p>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from({ length: numStops }, (_, i) => i + 1).map(f => {
                    const active = activeCabinCalls.includes(f);
                    return <button key={f} onClick={() => handleComando(f, 'LlamadasCabina')}
                      title={`Envoyer cabine à l'étage ${f}`}
                      className={cn('w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold cursor-pointer transition-all hover:ring-1 hover:ring-[#8B5CF6]',
                      active ? 'bg-[#8B5CF6] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[#8B5CF6]/20'
                    )}>{f}</button>;
                  })}
                </div>
              </div>
              {/* Appel palier en montée (cliquable) */}
              <div>
                <p className="text-[6px] font-bold text-white bg-[#6B7280] rounded px-1.5 py-0.5 mb-1">Appel palier en montée</p>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from({ length: numStops }, (_, i) => i + 1).map(f => {
                    const active = activeUpCalls.includes(f);
                    return <button key={f} onClick={() => handleComando(f, 'LlamadasExterioresSubida')}
                      title={`Appel montée étage ${f}`}
                      className={cn('w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold cursor-pointer transition-all hover:ring-1 hover:ring-[#059669]',
                      active ? 'bg-[#059669] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[#059669]/20'
                    )}>{f}</button>;
                  })}
                </div>
              </div>
              {/* Appel palier en descente (cliquable) */}
              <div>
                <p className="text-[6px] font-bold text-white bg-[#6B7280] rounded px-1.5 py-0.5 mb-1">Appel palier en descente</p>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from({ length: numStops }, (_, i) => i + 1).map(f => {
                    const active = activeDownCalls.includes(f);
                    return <button key={f} onClick={() => handleComando(f, 'LlamadasExterioresBajada')}
                      title={`Appel descente étage ${f}`}
                      className={cn('w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold cursor-pointer transition-all hover:ring-1 hover:ring-[#DC2626]',
                      active ? 'bg-[#DC2626] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[#DC2626]/20'
                    )}>{f}</button>;
                  })}
                </div>
              </div>
            </div>
          </CardBody></Card>

          {/* ── Cartes détectées ── */}
          <Card><CardBody className="p-2">
            <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1">Cartes détectées</p>
            <div className="flex flex-wrap gap-1">
              {([
                ['MIO', monitor.numPlacaMIO], ['RevMam', monitor.numPlacaRevMam], ['CAR', monitor.numPlacaCar],
                ['Drive', monitor.numPlacaDrive], ['DOC', monitor.numPlacaDoc], ['LOB', monitor.numPlacaLob],
                ['Tel', monitor.numPlacaTel], ['Link', monitor.numPlacaLink], ['Alim', monitor.numPlacaAlim],
                ['RevAux', monitor.numPlacaRevAux], ['Audio', monitor.numPlacaAudio], ['Interph.', monitor.numPlacaInterfono],
                ['SynGO', monitor.numPlacaSyngo],
              ] as [string, number | null][]).map(([name, count]) => (
                <span key={name} className={cn('text-[6px] px-1.5 py-0.5 rounded-full font-bold',
                  count && count > 0 ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                )}>
                  {name}{count != null && count > 0 ? ` ×${count}` : ''}
                </span>
              ))}
            </div>
          </CardBody></Card>

          {/* ── Actions à distance ── */}
          <Card><CardBody className="p-2">
            <button onClick={() => setShowActions(!showActions)} className="w-full flex items-center justify-between">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                <Send className="w-2.5 h-2.5" /> Actions à distance ({MONITOR_ACTIONS.length})
              </p>
              {showActions
                ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
            </button>
            {showActions && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                {MONITOR_ACTIONS.map(a => (
                  <button key={a.key} onClick={() => handleAction(a.key)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded text-[7px] font-bold transition-colors',
                      a.danger
                        ? 'bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    )}>
                    <span className="text-[9px]">{a.icon}</span>{a.label}
                  </button>
                ))}
              </div>
            )}
          </CardBody></Card>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-[10px] text-[var(--text-muted)]">Données monitor non disponibles</p>
        </div>
      )}
    </div>
  );
}

function busLabel(v: number | null | undefined): string {
  if (v == null) return '—';
  switch (v) { case 0: return 'OK'; case 1: return 'Warning'; case 2: return 'Error'; default: return String(v); }
}
function busColor(v: number | null | undefined): string {
  if (v == null) return '#64748B';
  switch (v) { case 0: return '#059669'; case 1: return '#CA8A04'; case 2: return '#DC2626'; default: return '#64748B'; }
}

/** Card alimentation fidèle au layout S4L (label petit au-dessus, valeur + unité en grand) */
function AliCard({ label, value, unit, decimals = 0 }: { label: string; value: number | null | undefined; unit: string; decimals?: number }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded p-1.5 text-center">
      <p className="text-[5px] text-[var(--text-muted)] font-semibold truncate">{label}</p>
      <p className="text-[12px] font-extrabold text-[var(--text-primary)]">
        {value != null ? `${decimals > 0 ? value.toFixed(decimals) : value} ${unit}` : '—'}
      </p>
    </div>
  );
}

function MiniKPI({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="flex-1"><CardBody className="p-2 flex items-center gap-2">
      <div className="flex-shrink-0" style={{ color }}>{icon}</div>
      <div>
        <p className="text-[13px] font-extrabold font-mono" style={{ color }}>{value}</p>
        <p className="text-[5px] text-[var(--text-muted)] font-semibold leading-tight">{label}</p>
      </div>
    </CardBody></Card>
  );
}

function MonitorBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-1 rounded bg-[var(--bg-primary)]">
      <p className="text-[5px] text-[var(--text-muted)] font-semibold">{label}</p>
      <p className="text-[8px] font-bold truncate" style={{ color }}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ERREURS — Recherche codes + Familles + Smart Preventive
// ═══════════════════════════════════════════════════════════════

function ErrorsTab({ selectedLiftId, selectedLift, setSelectedLiftId, onSwitchToMonitor }: {
  selectedLiftId: number | null;
  selectedLift?: Sigma4Lift;
  setSelectedLiftId: (id: number | null) => void;
  onSwitchToMonitor: () => void;
}) {
  const [subTab, setSubTab] = useState<'history' | 'search' | 'families' | 'preventive'>(selectedLiftId ? 'history' : 'search');

  // Charger le catalogue d'erreurs depuis l'API S4L
  const { data: apiErrors } = useQuery({
    queryKey: ['sigma4', 'info-errores'],
    queryFn: () => getErrorInfo({}) as Promise<S4LApiErrorEntry[]>,
    staleTime: 600000, // 10 min cache
    retry: 1,
  });

  // Fusionner API + base locale
  const allCodes = useMemo(() => {
    if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
      return mergeApiErrors(apiErrors);
    }
    return getAllErrorCodes();
  }, [apiErrors]);

  const apiCount = apiErrors?.length || 0;

  // Basculer automatiquement sur history quand un lift est sélectionné
  useEffect(() => {
    if (selectedLiftId) setSubTab('history');
  }, [selectedLiftId]);

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Lift sélectionné info */}
      {selectedLiftId && selectedLift && (
        <div className="flex items-center justify-between flex-shrink-0 px-2 py-1.5 rounded-lg bg-[#059669]/10 border border-[#059669]/20">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#059669] flex items-center justify-center">
              <Monitor className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-extrabold text-[#059669]">{selectedLift.liftCompRef}</p>
              <p className="text-[6px] text-[var(--text-muted)]">{selectedLift.city}{selectedLift.city && selectedLift.descripcion ? ' · ' : ''}{selectedLift.descripcion}</p>
            </div>
          </div>
          <button onClick={onSwitchToMonitor} className="text-[7px] font-bold text-[#059669] hover:underline flex items-center gap-0.5">
            <Monitor className="w-2.5 h-2.5" /> Voir Monitor
          </button>
        </div>
      )}

      {!selectedLiftId && (
        <div className="flex items-center gap-2 flex-shrink-0 px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <p className="text-[8px] text-[var(--text-muted)]">
            Sélectionnez un ascenseur dans l'onglet <strong className="text-[var(--text-primary)]">Monitor</strong> pour voir son historique d'erreurs
          </p>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-0.5 flex-shrink-0 bg-[var(--bg-secondary)] rounded-lg p-0.5">
        {([
          ...(selectedLiftId ? [{ id: 'history' as const, label: 'Historique', icon: Clock }] : []),
          { id: 'search' as const, label: 'Catalogue', icon: Search },
          { id: 'families' as const, label: 'Par famille', icon: Layers },
          { id: 'preventive' as const, label: 'Smart Preventive', icon: TrendingUp },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[8px] font-bold transition-all',
                subTab === t.id
                  ? 'bg-[var(--bg-primary)] text-[#EA580C] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}>
              <Icon className="w-3 h-3" />{t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {subTab === 'history' && selectedLiftId && <LiftErrorHistoryPanel liftId={selectedLiftId} lift={selectedLift} allCodes={allCodes} />}
        {subTab === 'search' && <ErrorSearchPanel allCodes={allCodes} apiCount={apiCount} />}
        {subTab === 'families' && <ErrorFamiliesPanel allCodes={allCodes} />}
        {subTab === 'preventive' && <SmartPreventivePanel allCodes={allCodes} apiCount={apiCount} />}
      </div>
    </div>
  );
}

// ── HISTORIQUE ERREURS D'UN ASCENSEUR ──

function LiftErrorHistoryPanel({ liftId, lift, allCodes }: { liftId: number; lift?: Sigma4Lift; allCodes: S4LErrorCode[] }) {
  const qc = useQueryClient();

  // Récupérer les erreurs/messages de l'ascenseur
  const { data: liftErrors, isLoading, error, refetch } = useQuery({
    queryKey: ['sigma4', 'lift-errors', liftId],
    queryFn: () => getLiftErrors(liftId),
    staleTime: 30000,
    retry: 1,
  });

  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Enrichir les erreurs avec les infos du catalogue
  const enrichedErrors = useMemo(() => {
    if (!liftErrors || !Array.isArray(liftErrors)) return [];
    return liftErrors.map((err: any) => {
      // Essayer de trouver le code dans le catalogue
      const code = err.errorCode || err.codigoError || err.idEstandar || err.code || '';
      const catalogEntry = code ? lookupErrorCode(code) : undefined;
      // Chercher aussi par idEstandar dans allCodes
      const catalogFromAll = code ? allCodes.find(c => c.code === code) : undefined;
      const matched = catalogEntry || catalogFromAll;

      return {
        ...err,
        errorCode: code,
        description: err.description || err.descripcion || err.text || matched?.description || code,
        cause: err.causa || err.cause || matched?.cause || '',
        help: matched?.help || '',
        severity: err.severity != null ? severityFromApi(typeof err.severity === 'number' ? err.severity : null) : matched?.severity,
        family: matched?.family || (code ? code.replace(/\d.*/,'') : ''),
        date: err.date || err.fecha || err.timestamp || err.fechaInicio || '',
        dateEnd: err.fechaFin || err.dateEnd || '',
        origin: err.origin || err.origen || '',
      };
    }).sort((a: any, b: any) => {
      // Plus récent en premier
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [liftErrors, allCodes]);

  // Filtrage
  const filteredErrors = useMemo(() => {
    let list = enrichedErrors;
    if (filterSeverity !== 'all') {
      list = list.filter((e: any) => e.severity === filterSeverity);
    }
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e: any) =>
        (e.errorCode || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.cause || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedErrors, filterSeverity, searchQuery]);

  // Stats par sévérité
  const severityStats = useMemo(() => {
    const stats: Record<string, number> = {};
    enrichedErrors.forEach((e: any) => {
      if (e.severity) stats[e.severity] = (stats[e.severity] || 0) + 1;
    });
    return stats;
  }, [enrichedErrors]);

  if (isLoading) return <LoadingState text={`Chargement des erreurs de ${lift?.liftCompRef || '#' + liftId}…`} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      {/* KPI ligne */}
      <div className="flex gap-1 flex-shrink-0">
        <Card className="flex-1"><CardBody className="p-1.5 text-center">
          <p className="text-[14px] font-extrabold font-mono text-[#3B82F6]">{enrichedErrors.length}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">événements</p>
        </CardBody></Card>
        {(Object.entries(SEVERITY_LEVELS) as [SeverityKey, typeof SEVERITY_LEVELS[SeverityKey]][])
          .filter(([key]) => (severityStats[key] || 0) > 0)
          .map(([key, sev]) => (
          <Card key={key} className="flex-1">
            <CardBody className="p-1.5 text-center cursor-pointer hover:opacity-80"
              onClick={() => setFilterSeverity(filterSeverity === key ? 'all' : key)}>
              <p className="text-[14px] font-extrabold font-mono" style={{ color: sev.color }}>
                {severityStats[key] || 0}
              </p>
              <p className="text-[5px] text-[var(--text-muted)] font-semibold leading-tight">
                {sev.icon} {sev.short}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Barre de recherche + filtre actif */}
      <div className="flex gap-1 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filtrer les erreurs…"
            className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none focus:border-[#EA580C] transition-colors" />
        </div>
        {filterSeverity !== 'all' && (
          <button onClick={() => setFilterSeverity('all')}
            className="px-2 py-1 rounded-lg bg-[#EA580C]/10 text-[#EA580C] text-[8px] font-bold">
            ✕ {SEVERITY_LEVELS[filterSeverity as SeverityKey]?.short}
          </button>
        )}
        <button onClick={() => refetch()}
          className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
          <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
        </button>
      </div>

      <p className="text-[7px] text-[var(--text-muted)] px-1 flex-shrink-0">
        {filteredErrors.length} erreur{filteredErrors.length > 1 ? 's' : ''}{searchQuery ? ` pour "${searchQuery}"` : ''}
      </p>

      {/* Liste des erreurs */}
      {filteredErrors.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {filteredErrors.map((err: any, idx: number) => (
            <LiftErrorRow key={`${err.errorCode}-${err.date}-${idx}`} error={err} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Check className="w-8 h-8 text-[#059669] mx-auto mb-2 opacity-40" />
            <p className="text-[10px] text-[var(--text-muted)] font-semibold">
              {enrichedErrors.length === 0 ? 'Aucun événement enregistré' : 'Aucun résultat pour ce filtre'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LiftErrorRow({ error }: { error: any }) {
  const [expanded, setExpanded] = useState(false);
  const sev = error.severity && error.severity in SEVERITY_LEVELS
    ? SEVERITY_LEVELS[error.severity as SeverityKey]
    : null;

  const dateStr = error.date ? (() => {
    try {
      const d = new Date(error.date);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
        ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return error.date; }
  })() : '';

  const dateEndStr = error.dateEnd ? (() => {
    try {
      const d = new Date(error.dateEnd);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  })() : '';

  return (
    <Card>
      <CardBody className="p-0">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 p-2 text-left hover:bg-[var(--bg-secondary)]/50 rounded-lg transition-colors">
          {sev && <span className="text-[8px]" title={sev.label}>{sev.icon}</span>}
          <code className="text-[8px] font-mono font-extrabold text-[#EA580C] flex-shrink-0 w-24">
            {error.errorCode || '—'}
          </code>
          <span className="text-[8px] font-semibold flex-1 truncate text-[var(--text-primary)]">
            {error.description}
          </span>
          {dateStr && (
            <span className="text-[6px] text-[var(--text-muted)] font-mono flex-shrink-0 flex items-center gap-0.5">
              <Clock className="w-2 h-2" />{dateStr}
              {dateEndStr && <span className="text-[var(--text-muted)]">→ {dateEndStr}</span>}
            </span>
          )}
          {error.family && (
            <span className="text-[6px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-bold flex-shrink-0">
              {error.family}
            </span>
          )}
          {(error.cause || error.help || error.origin) && (
            <ChevronRight className={cn(
              'w-2.5 h-2.5 text-[var(--text-muted)] transition-transform flex-shrink-0',
              expanded && 'rotate-90'
            )} />
          )}
        </button>
        {expanded && (
          <div className="px-3 pb-2 space-y-1 border-t border-[var(--border-secondary)]">
            {error.cause && (
              <div className="mt-1">
                <p className="text-[6px] font-bold text-[#EA580C] uppercase">Cause probable</p>
                <p className="text-[7px] text-[var(--text-secondary)]">{error.cause}</p>
              </div>
            )}
            {error.help && (
              <div>
                <p className="text-[6px] font-bold text-[#059669] uppercase">Aide diagnostic</p>
                <p className="text-[7px] text-[var(--text-secondary)]">{error.help}</p>
              </div>
            )}
            {error.origin && (
              <div>
                <p className="text-[6px] font-bold text-[#3B82F6] uppercase">Origine</p>
                <p className="text-[7px] text-[var(--text-secondary)]">{error.origin}</p>
              </div>
            )}
            {sev && (
              <div className="flex items-center gap-1 pt-1">
                <span className="text-[6px] font-bold text-[var(--text-muted)]">Sévérité :</span>
                <span className="text-[7px] font-bold" style={{ color: sev.color }}>{sev.icon} {sev.label}</span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── RECHERCHE CODES D'ERREUR ──

function ErrorSearchPanel({ allCodes, apiCount }: { allCodes: S4LErrorCode[]; apiCount: number }) {
  const [query, setQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const stats = useMemo(() => {
    const byFamily: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    allCodes.forEach(e => {
      byFamily[e.family] = (byFamily[e.family] || 0) + 1;
      if (e.severity) bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    });
    return { total: allCodes.length, byFamily, bySeverity };
  }, [allCodes]);

  const results = useMemo(() => {
    let codes = allCodes;
    if (query.length >= 2) {
      const q = query.toLowerCase();
      codes = codes.filter(e =>
        e.code.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.cause?.toLowerCase().includes(q) ||
        e.help?.toLowerCase().includes(q)
      );
    }
    if (filterSeverity !== 'all') codes = codes.filter(c => c.severity === filterSeverity);
    return codes.slice(0, 200);
  }, [allCodes, query, filterSeverity]);

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      {/* Severity stats bar */}
      <div className="flex gap-1 flex-shrink-0">
        <Card className="flex-1"><CardBody className="p-1.5 text-center">
          <p className="text-[14px] font-extrabold font-mono text-[#3B82F6]">{stats.total}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">
            {apiCount > 0 ? `${apiCount} API + local` : 'codes en base'}
          </p>
        </CardBody></Card>
        {(Object.entries(SEVERITY_LEVELS) as [SeverityKey, typeof SEVERITY_LEVELS[SeverityKey]][])
          .filter(([key]) => (stats.bySeverity[key] || 0) > 0 || ['fatal_local', 'fatal_remote', 'leve', 'info'].includes(key))
          .map(([key, sev]) => (
          <Card key={key} className="flex-1">
            <CardBody className="p-1.5 text-center cursor-pointer hover:opacity-80"
              onClick={() => setFilterSeverity(filterSeverity === key ? 'all' : key)}>
              <p className="text-[14px] font-extrabold font-mono" style={{ color: sev.color }}>
                {stats.bySeverity[key] || 0}
              </p>
              <p className="text-[5px] text-[var(--text-muted)] font-semibold leading-tight">
                {sev.icon} {sev.short}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-1 flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un code (F0102, ECO, MBA…) ou une description…"
            className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] text-[9px] outline-none focus:border-[#EA580C] transition-colors"
            autoFocus />
        </div>
        {filterSeverity !== 'all' && (
          <button onClick={() => setFilterSeverity('all')}
            className="px-2 py-1 rounded-lg bg-[#EA580C]/10 text-[#EA580C] text-[8px] font-bold">
            ✕ {SEVERITY_LEVELS[filterSeverity as SeverityKey]?.short}
          </button>
        )}
      </div>

      <p className="text-[7px] text-[var(--text-muted)] px-1 flex-shrink-0">
        {results.length} résultat{results.length > 1 ? 's' : ''}{query ? ` pour "${query}"` : ''}
      </p>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {results.map(err => <ErrorCodeRow key={err.code} error={err} />)}
      </div>
    </div>
  );
}

function ErrorCodeRow({ error }: { error: S4LErrorCode }) {
  const [expanded, setExpanded] = useState(false);
  const sev = error.severity && error.severity in SEVERITY_LEVELS
    ? SEVERITY_LEVELS[error.severity as SeverityKey]
    : null;

  return (
    <Card>
      <CardBody className="p-0">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 p-2 text-left hover:bg-[var(--bg-secondary)]/50 rounded-lg transition-colors">
          {sev && <span className="text-[8px]" title={sev.label}>{sev.icon}</span>}
          <code className="text-[9px] font-mono font-extrabold text-[#EA580C] flex-shrink-0 w-28">
            {error.code}
          </code>
          <span className="text-[8px] font-semibold flex-1 truncate text-[var(--text-primary)]">
            {error.description}
          </span>
          <span className="text-[6px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-bold flex-shrink-0">
            {error.family}
          </span>
          {(error.cause || error.help) && (
            <ChevronRight className={cn(
              'w-2.5 h-2.5 text-[var(--text-muted)] transition-transform',
              expanded && 'rotate-90'
            )} />
          )}
        </button>
        {expanded && (error.cause || error.help || sev) && (
          <div className="px-3 pb-2 space-y-1 border-t border-[var(--border-secondary)]">
            {error.cause && (
              <div className="mt-1">
                <p className="text-[6px] font-bold text-[#EA580C] uppercase">Cause probable</p>
                <p className="text-[7px] text-[var(--text-secondary)]">{error.cause}</p>
              </div>
            )}
            {error.help && (
              <div>
                <p className="text-[6px] font-bold text-[#059669] uppercase">Aide diagnostic</p>
                <p className="text-[7px] text-[var(--text-secondary)]">{error.help}</p>
              </div>
            )}
            {sev && (
              <div className="flex items-center gap-1 pt-1">
                <span className="text-[6px] font-bold text-[var(--text-muted)]">Sévérité :</span>
                <span className="text-[7px] font-bold" style={{ color: sev.color }}>{sev.icon} {sev.label}</span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── FAMILLES D'ERREUR ──

const ERROR_FAMILIES_META = [
  { key: 'ECO', label: 'ECO — MP ecoGO Sigma', desc: 'Armoire principale Sigma, protocole ecoGO', color: '#059669' },
  { key: 'NUM', label: 'Fxxxx — Codes armoire', desc: 'Format court affiché sur l\'armoire de commande', color: '#3B82F6' },
  { key: 'MBA', label: 'MBA — MP Board A', desc: 'Ancienne génération carte principale', color: '#8B5CF6' },
  { key: 'V', label: 'V — Variateur', desc: 'Erreurs variateur de fréquence (VFD/VVVF)', color: '#EA580C' },
  { key: 'VSE', label: 'VSE — Variateur chaîne sécu.', desc: 'Erreurs variateur chaîne de sécurité', color: '#DC2626' },
];

function ErrorFamiliesPanel({ allCodes }: { allCodes: S4LErrorCode[] }) {
  const stats = useMemo(() => {
    const byFamily: Record<string, number> = {};
    allCodes.forEach(e => { byFamily[e.family] = (byFamily[e.family] || 0) + 1; });
    return { byFamily };
  }, [allCodes]);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const familyCodes = useMemo(() => {
    if (!selectedFamily) return [];
    return allCodes.filter(e => e.family === selectedFamily);
  }, [allCodes, selectedFamily]);

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Family cards */}
      <div className="grid grid-cols-5 gap-1 flex-shrink-0">
        {ERROR_FAMILIES_META.map(f => (
          <Card key={f.key}
            className={cn('cursor-pointer transition-all', selectedFamily === f.key && 'ring-1 ring-[var(--text-primary)]')}>
            <CardBody className="p-2 text-center"
              onClick={() => setSelectedFamily(selectedFamily === f.key ? null : f.key)}>
              <p className="text-[16px] font-extrabold font-mono" style={{ color: f.color }}>
                {stats.byFamily[f.key] || 0}
              </p>
              <p className="text-[7px] font-bold">{f.key}</p>
              <p className="text-[5px] text-[var(--text-muted)] leading-tight mt-0.5">{f.desc}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {selectedFamily ? (
        <>
          <p className="text-[8px] font-bold text-[var(--text-muted)] flex-shrink-0">
            {ERROR_FAMILIES_META.find(f => f.key === selectedFamily)?.label} — {familyCodes.length} codes
          </p>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {familyCodes.map(err => <ErrorCodeRow key={err.code} error={err} />)}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
            <p className="text-[9px] text-[var(--text-muted)]">Sélectionnez une famille pour voir ses codes</p>
            <p className="text-[7px] text-[var(--text-muted)] mt-1">
              Base complète : 8582 codes × 10 langues (sélection des plus courants en FR)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SMART PREVENTIVE ──

function SmartPreventivePanel({ allCodes, apiCount }: { allCodes: S4LErrorCode[]; apiCount: number }) {
  const stats = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    allCodes.forEach(e => { if (e.severity) bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1; });
    return { total: allCodes.length, bySeverity };
  }, [allCodes]);

  // Group typologies by domain
  const domains = useMemo(() => {
    const items = Object.entries(CAUSA_CATEGORIES)
      .filter(([k]) => k !== 'SIN_ERRORES')
      .map(([key, val]) => ({ key, ...val }));

    const map = new Map<string, typeof items>();
    items.forEach(t => {
      const list = map.get(t.domain) || [];
      list.push(t);
      map.set(t.domain, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  return (
    <div className="h-full overflow-y-auto space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#EA580C] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-[12px] font-extrabold">Smart Preventive</h3>
          <p className="text-[7px] text-[var(--text-muted)]">
            Analyse prédictive — classification par sévérité et typologie des erreurs
          </p>
        </div>
      </div>

      {/* Classification par sévérité */}
      <Card><CardBody className="p-3">
        <h4 className="text-[9px] font-extrabold mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-[#EA580C]" /> Classification par sévérité
        </h4>
        <div className="space-y-2">
          {(Object.entries(SEVERITY_LEVELS) as [SeverityKey, typeof SEVERITY_LEVELS[SeverityKey]][])
            .filter(([key]) => (stats.bySeverity[key] || 0) > 0)
            .map(([key, sev]) => {
            const count = stats.bySeverity[key] || 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] w-5 text-center">{sev.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] font-bold" style={{ color: sev.color }}>{sev.label}</span>
                    <span className="text-[8px] font-mono font-bold">
                      {count} <span className="text-[var(--text-muted)]">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: sev.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--border-secondary)] text-center">
          <p className="text-[7px] text-[var(--text-muted)]">
            <strong style={{ color: '#DC2626' }}>Niv. 4</strong> → réarmement local (intervention sur site) ·
            <strong style={{ color: '#EA580C' }}> Niv. 3</strong> → réarmement à distance (via S4L) ·
            <strong style={{ color: '#CA8A04' }}> Niv. 2</strong> → auto-reset ·
            <strong style={{ color: '#3B82F6' }}> Niv. 1</strong> → informatif
            {apiCount > 0 && <span className="block mt-0.5">📡 {apiCount} codes chargés depuis l'API S4L</span>}
          </p>
        </div>
      </CardBody></Card>

      {/* Typologie des erreurs par domaine */}
      <Card><CardBody className="p-3">
        <h4 className="text-[9px] font-extrabold mb-2 flex items-center gap-1">
          <Filter className="w-3 h-3 text-[#8B5CF6]" /> Typologie par cause ({Object.keys(CAUSA_CATEGORIES).length - 1} catégories)
        </h4>
        <div className="space-y-2">
          {domains.map(([domain, items]) => (
            <div key={domain}>
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-0.5">{domain}</p>
              <div className="grid grid-cols-2 gap-0.5">
                {items.map(t => (
                  <div key={t.key} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-[var(--bg-secondary)]">
                    <div className="w-1 h-4 rounded-full bg-[#8B5CF6]/40 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[7px] font-bold truncate">{t.label}</p>
                      <p className="text-[5px] text-[var(--text-muted)] font-mono">CAUSA_{t.key}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardBody></Card>

      {/* Info Life Warning */}
      <Card><CardBody className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#CA8A04]/15 flex items-center justify-center text-[16px]">⚠️</div>
          <div>
            <h4 className="text-[9px] font-extrabold text-[#CA8A04]">Life Warning — Avertissement durée de vie</h4>
            <p className="text-[7px] text-[var(--text-muted)]">
              Détection prédictive des composants en fin de vie : batteries, variateur (V8207),
              condensateurs, relais. Le Smart Preventive classe automatiquement les erreurs et
              alerte avant la panne.
            </p>
          </div>
        </div>
      </CardBody></Card>

      {/* Points chaîne sécurité */}
      <Card><CardBody className="p-3">
        <h4 className="text-[9px] font-extrabold mb-2">Nomenclature chaîne de sécurité (points Sigma)</h4>
        <div className="grid grid-cols-4 gap-1 text-[7px]">
          {[
            { pt: '1H-3C', desc: 'Chaîne primaire' },
            { pt: '40', desc: 'Point coupure MCB' },
            { pt: '60H', desc: 'Shunts inspection' },
            { pt: '70H', desc: 'Shunts portes palières' },
            { pt: '80H', desc: 'Verrouillages paliers' },
            { pt: '90H/90C', desc: 'Verrouillages cabine' },
            { pt: '102-220-103', desc: 'Bornes chaîne MCB' },
            { pt: '104-105-106', desc: 'Bornes verrouillages' },
          ].map(p => (
            <div key={p.pt} className="p-1 rounded bg-[var(--bg-secondary)]">
              <code className="text-[#EA580C] font-mono font-bold">{p.pt}</code>
              <p className="text-[5px] text-[var(--text-muted)]">{p.desc}</p>
            </div>
          ))}
        </div>
      </CardBody></Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function LoadingState({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-[#059669]" />
    <span className="ml-2 text-[10px] text-[var(--text-muted)]">{text}</span>
  </div>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <div className="h-full flex items-center justify-center">
    <Card><CardBody className="p-4 text-center">
      <XCircle className="w-8 h-8 text-[#DC2626] mx-auto mb-2" />
      <p className="text-[10px] font-bold text-[#DC2626]">Erreur de chargement</p>
      <p className="text-[8px] text-[var(--text-muted)]">{(error as Error).message}</p>
      <button onClick={onRetry} className="mt-2 px-3 py-1 rounded bg-[#059669] text-white text-[9px] font-bold">Réessayer</button>
    </CardBody></Card>
  </div>;
}

// ═══ HELPERS ═══

function getEstadoInfo(estado: number): { label: string; color: string } {
  switch (estado) {
    case 0: return { label: 'En marche', color: '#059669' };
    case 10: return { label: 'Arrêté', color: '#DC2626' };
    case 20: return { label: 'Maintenance', color: '#8B5CF6' };
    case 90: return { label: 'Sans connexion', color: '#EA580C' };
    default: return { label: `État ${estado}`, color: '#64748B' };
  }
}

function getTipoEnlaceLabel(tipo: number): string {
  switch (tipo) {
    case 1: return 'SIM MP';
    case 2: return 'SIM externe';
    case 3: return 'SIM partagée';
    case 4: return 'Ethernet';
    case 5: return 'GSR / IoT';
    default: return `Type ${tipo}`;
  }
}

function cleanLabel(label: string | null): string {
  if (!label) return 'Inconnu';
  return label
    .replace(/^TRACCION_/, '').replace(/^ARQUITECTURA_/, '')
    .replace(/_/g, ' ').replace(/SIN DATOS/, 'Sans données')
    .trim();
}

function cleanTechLabel(value: string): string {
  if (!value || value === '-1') return '—';
  return value
    .replace(/^TRACCION_/, '').replace(/^ARQUITECTURA_/, '')
    .replace(/^FABRICANTE_/, '').replace(/^MODELO_TELEFONO_/, '')
    .replace(/^MODELO_ASCENSOR_/, 'Modèle ')
    .replace(/_/g, ' ')
    .trim();
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return date; }
}

function formatDateShort(date?: string): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch { return date; }
}

export default IoTSigmaPage;
