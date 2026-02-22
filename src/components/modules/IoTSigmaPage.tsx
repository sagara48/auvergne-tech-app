// ═══════════════════════════════════════════════════════════════
// MODULE IoT SIGMA4LIFTS — Dashboard + Ascenseurs + Monitor + Erreurs
// Login → /divide/login → Dashboard | Ascenseurs | Monitor | Erreurs
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import {
  Radio, ExternalLink, RefreshCw, LogIn, LogOut, Loader2,
  XCircle, BarChart3, PieChart, ChevronDown, ChevronUp,
  LayoutDashboard, Building2, Search, MapPin,
  ChevronRight, Shield, Layers, Navigation, Wifi, Activity, TrendingUp,
  Monitor, AlertTriangle, BookOpen, ArrowUp, ArrowDown, DoorOpen,
  Weight, Thermometer, Zap, Send, Filter,
} from 'lucide-react';
import { Card, CardBody, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sigma4Chart, Sigma4ChartItem, Sigma4Dashboard, Sigma4Lift, Sigma4ServiceEntry,
  Sigma4MonitorData, MonitorAction,
  getDashboard, getLifts, getLiftServices, getMonitorOnline, sendMonitorAction,
  getSigma4FrontUrl, getSigma4Session,
  isConnectedToSigma4, loginSigma4, logoutSigma4,
  MONITOR_ACTIONS,
} from '@/services/sigma4liftsApi';
import {
  searchErrorCodes, getAllErrorCodes, getErrorStats, getErrorsByFamily,
  SEVERITY_LEVELS, CAUSA_CATEGORIES, S4LErrorCode, SeverityKey,
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
        {tab === 'monitor' && <MonitorTab />}
        {tab === 'errors' && <ErrorsTab />}
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

function MonitorTab() {
  const { data: lifts, isLoading } = useQuery({
    queryKey: ['sigma4', 'lifts'],
    queryFn: getLifts,
    staleTime: 120000,
    retry: 1,
  });
  const [selectedLiftId, setSelectedLiftId] = useState<number | null>(null);
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
  const { data: monitor, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['sigma4', 'monitor', liftId],
    queryFn: () => getMonitorOnline(liftId),
    refetchInterval: 5000,
    retry: 1,
  });
  const [showActions, setShowActions] = useState(false);

  const handleAction = async (action: MonitorAction) => {
    const label = MONITOR_ACTIONS.find(a => a.key === action)?.label || action;
    if (!confirm(`Confirmer l'action : ${label} ?`)) return;
    try {
      await sendMonitorAction(liftId, action);
      toast.success('Action envoyée : ' + label);
      qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] });
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'envoi');
    }
  };

  if (isLoading) return <LoadingState text="Connexion au monitor..." />;
  if (error) return (
    <ErrorState error={error} onRetry={() => qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] })} />
  );

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
            Live{dataUpdatedAt ? ` · ${new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}` : ''}
          </span>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['sigma4', 'monitor', liftId] })}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {monitor ? (
        <>
          {/* ── KPIs principaux ── */}
          <div className="grid grid-cols-4 gap-1.5">
            <MiniKPI label="Position" value={monitor.posicion != null ? String(monitor.posicion) : '—'}
              icon={<MapPin className="w-3.5 h-3.5" />} color="#3B82F6" />
            <MiniKPI label="Destination" value={monitor.destino != null ? String(monitor.destino) : '—'}
              icon={<Navigation className="w-3.5 h-3.5" />} color="#8B5CF6" />
            <MiniKPI label="Étages" value={monitor.plantas != null ? String(monitor.plantas) : '—'}
              icon={<Layers className="w-3.5 h-3.5" />} color="#059669" />
            <MiniKPI label="Poids" value={monitor.peso != null ? `${monitor.peso} kg` : '—'}
              icon={<Weight className="w-3.5 h-3.5" />} color={monitor.sobrecarga ? '#DC2626' : '#EA580C'} />
          </div>

          {/* ── Portes & Sécurité / Variateur & Bus CAN ── */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Portes & Sécurité */}
            <Card><CardBody className="p-2 space-y-1.5">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                <DoorOpen className="w-2.5 h-2.5" /> Portes & Sécurité
              </p>
              <div className="grid grid-cols-2 gap-1">
                <MonitorBadge label="Porte"
                  value={monitor.puerta === 'ABIERTA' ? 'Ouverte' : monitor.puerta === 'CERRADA' ? 'Fermée' : monitor.puerta || '—'}
                  color={monitor.puerta === 'ABIERTA' ? '#EA580C' : '#059669'} />
                <MonitorBadge label="Cellule photo"
                  value={monitor.fotocelula ? 'Activée' : 'Libre'}
                  color={monitor.fotocelula ? '#CA8A04' : '#059669'} />
                <MonitorBadge label="Surcharge"
                  value={monitor.sobrecarga ? '⚠️ OUI' : 'Non'}
                  color={monitor.sobrecarga ? '#DC2626' : '#059669'} />
                <MonitorBadge label="Chaîne sécu."
                  value={monitor.serieSeguridad || monitor.serie || '—'}
                  color={monitor.serie === 'OK' ? '#059669' : '#CA8A04'} />
              </div>
              {monitor.ultimoEvento && (
                <div className="pt-1 border-t border-[var(--border-secondary)]">
                  <p className="text-[6px] text-[var(--text-muted)]">Dernier événement</p>
                  <p className="text-[7px] font-mono font-bold truncate">{monitor.ultimoEvento}</p>
                </div>
              )}
            </CardBody></Card>

            {/* Variateur & Bus CAN */}
            <Card><CardBody className="p-2 space-y-1.5">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Variateur & Bus CAN
              </p>
              <div className="grid grid-cols-2 gap-1">
                <MonitorBadge label="Variateur" value={monitor.variador || '—'} color="#3B82F6" />
                <MonitorBadge label="Tension bus"
                  value={monitor.tensionBus != null ? `${monitor.tensionBus} V` : '—'} color="#8B5CF6" />
                <MonitorBadge label="CAN A" value={monitor.canA || '—'} color="#64748B" />
                <MonitorBadge label="CAN B" value={monitor.canB || '—'} color="#64748B" />
                <MonitorBadge label="CAN H (gaine)" value={monitor.canH || '—'} color="#64748B" />
                <MonitorBadge label="CAN M (manœuvre)" value={monitor.canM || '—'} color="#64748B" />
              </div>
            </CardBody></Card>
          </div>

          {/* ── Appels extérieurs ── */}
          {(monitor.exteriorSubida || monitor.exteriorBajada) && (
            <Card><CardBody className="p-2">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1">Appels paliers</p>
              <div className="flex gap-3">
                {monitor.exteriorSubida && monitor.exteriorSubida.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-[#059669]" />
                    <span className="text-[7px] font-mono">{monitor.exteriorSubida.join(', ')}</span>
                  </div>
                )}
                {monitor.exteriorBajada && monitor.exteriorBajada.length > 0 && (
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3 h-3 text-[#DC2626]" />
                    <span className="text-[7px] font-mono">{monitor.exteriorBajada.join(', ')}</span>
                  </div>
                )}
                {(!monitor.exteriorSubida?.length && !monitor.exteriorBajada?.length) && (
                  <span className="text-[7px] text-[var(--text-muted)]">Aucun appel en cours</span>
                )}
              </div>
            </CardBody></Card>
          )}

          {/* ── Stats voyages & température ── */}
          {(monitor.viajes != null || monitor.viajesHoy != null || monitor.temperatura != null) && (
            <div className="flex gap-1.5">
              {monitor.viajesHoy != null && (
                <MiniKPI label="Voyages auj." value={String(monitor.viajesHoy)}
                  icon={<TrendingUp className="w-3.5 h-3.5" />} color="#059669" />
              )}
              {monitor.viajes != null && (
                <MiniKPI label="Compteur total" value={monitor.viajes.toLocaleString('fr-FR')}
                  icon={<Activity className="w-3.5 h-3.5" />} color="#3B82F6" />
              )}
              {monitor.temperatura != null && (
                <MiniKPI label="Température" value={`${monitor.temperatura}°C`}
                  icon={<Thermometer className="w-3.5 h-3.5" />}
                  color={monitor.temperatura > 40 ? '#DC2626' : '#64748B'} />
              )}
            </div>
          )}

          {/* ── Communication ── */}
          {(monitor.operador || monitor.paquetesEnviados != null) && (
            <Card><CardBody className="p-2">
              <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
                <Wifi className="w-2.5 h-2.5" /> Communication
              </p>
              <div className="grid grid-cols-4 gap-1">
                {monitor.operador && <MonitorBadge label="Opérateur" value={monitor.operador} color="#3B82F6" />}
                {monitor.paquetesEnviados != null && <MonitorBadge label="Paquets envoyés" value={String(monitor.paquetesEnviados)} color="#059669" />}
                {monitor.paquetesErroneos != null && <MonitorBadge label="Paquets erreur" value={String(monitor.paquetesErroneos)} color={monitor.paquetesErroneos > 0 ? '#DC2626' : '#059669'} />}
                {monitor.porcentajeErrores != null && <MonitorBadge label="% erreurs" value={`${monitor.porcentajeErrores}%`} color={monitor.porcentajeErrores > 5 ? '#DC2626' : '#059669'} />}
              </div>
            </CardBody></Card>
          )}

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
          <p className="text-[8px] text-[var(--text-muted)] mt-1">
            L'ascenseur doit être connecté et configuré pour le monitoring temps réel
          </p>
        </div>
      )}
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

function ErrorsTab() {
  const [subTab, setSubTab] = useState<'search' | 'families' | 'preventive'>('search');

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 flex-shrink-0 bg-[var(--bg-secondary)] rounded-lg p-0.5">
        {([
          { id: 'search' as const, label: 'Recherche codes', icon: Search },
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
        {subTab === 'search' && <ErrorSearchPanel />}
        {subTab === 'families' && <ErrorFamiliesPanel />}
        {subTab === 'preventive' && <SmartPreventivePanel />}
      </div>
    </div>
  );
}

// ── RECHERCHE CODES D'ERREUR ──

function ErrorSearchPanel() {
  const [query, setQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const stats = useMemo(() => getErrorStats(), []);

  const results = useMemo(() => {
    let codes = query.length >= 2 ? searchErrorCodes(query, 100) : getAllErrorCodes();
    if (filterSeverity !== 'all') codes = codes.filter(c => c.severity === filterSeverity);
    return codes;
  }, [query, filterSeverity]);

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden">
      {/* Severity stats bar */}
      <div className="flex gap-1 flex-shrink-0">
        <Card className="flex-1"><CardBody className="p-1.5 text-center">
          <p className="text-[14px] font-extrabold font-mono text-[#3B82F6]">{stats.total}</p>
          <p className="text-[5px] text-[var(--text-muted)] font-semibold">codes en base</p>
        </CardBody></Card>
        {(Object.entries(SEVERITY_LEVELS) as [SeverityKey, typeof SEVERITY_LEVELS[SeverityKey]][]).map(([key, sev]) => (
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
  const sev = error.severity ? SEVERITY_LEVELS[error.severity] : null;

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

function ErrorFamiliesPanel() {
  const stats = useMemo(() => getErrorStats(), []);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const familyCodes = useMemo(() => {
    if (!selectedFamily) return [];
    return getErrorsByFamily(selectedFamily);
  }, [selectedFamily]);

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

function SmartPreventivePanel() {
  const stats = useMemo(() => getErrorStats(), []);

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
          {(Object.entries(SEVERITY_LEVELS) as [SeverityKey, typeof SEVERITY_LEVELS[SeverityKey]][]).map(([key, sev]) => {
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
            <strong style={{ color: '#DC2626' }}>Fatales locales</strong> → intervention sur site ·
            <strong style={{ color: '#EA580C' }}> Fatales remote</strong> → réarmables via S4L ·
            <strong style={{ color: '#CA8A04' }}> Lèves</strong> → réarmement automatique
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
