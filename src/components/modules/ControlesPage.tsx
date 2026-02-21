// ═══════════════════════════════════════════════════════════════
// MODULE CONTRÔLES TECHNIQUES
// Dashboard, Calendrier, Liste, Détail, Check-list, Observations, Levées
// Conforme NF EN 13015 / Décret 2004-964
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import {
  Shield, Calendar, List, Plus, Trash2, Edit, ChevronRight, ChevronLeft,
  CheckCircle2, AlertCircle, AlertTriangle, Clock, FileDown, Building2,
  ClipboardCheck, Eye, X, Search, Filter, ArrowUpDown, RefreshCw,
  CircleDot, TrendingUp, BarChart3, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardBody, Badge, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Controle, Observation, CheckItem, Levee,
  TypeControle, StatutControle, GraviteObservation, StatutObservation, CategorieCheck,
  TYPES_CONTROLE, ORGANISMES, GRAVITES, CATEGORIES_CHECK, CHECKLIST_STANDARD,
  getControles, getControle, createControle, updateControle, deleteControle,
  getObservations, createObservation, updateObservation, deleteObservation,
  getCheckItems, initChecklist, updateCheckItem,
  createLevee, getLevees,
  getControleStats, getAscenseursList, ControleStats,
} from '@/services/controleApi';
import { PDFBuilder, fmtDate } from '@/services/pdfBuilder';

type View = 'dashboard' | 'calendar' | 'list' | 'detail';
type Tab = 'info' | 'checklist' | 'observations' | 'levees';

// ═══ MAIN ═══

export function ControlesPage() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<TypeControle | ''>('');
  const [filterStatut, setFilterStatut] = useState<StatutControle | ''>('');
  const [searchQ, setSearchQ] = useState('');
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['controle-stats'], queryFn: getControleStats });
  const { data: controles = [], isLoading } = useQuery({ queryKey: ['controles', filterType, filterStatut], queryFn: () => getControles({ type: filterType || undefined, statut: filterStatut || undefined }) });
  const { data: ascenseurs = [] } = useQuery({ queryKey: ['ascenseurs-list'], queryFn: getAscenseursList });

  const filtered = useMemo(() => {
    if (!searchQ) return controles;
    const q = searchQ.toLowerCase();
    return controles.filter(c => c.ascenseur?.code?.toLowerCase().includes(q) || c.ascenseur?.adresse?.toLowerCase().includes(q) || c.organisme?.toLowerCase().includes(q));
  }, [controles, searchQ]);

  const openDetail = (id: string) => { setSelectedId(id); setView('detail'); };

  if (view === 'detail' && selectedId) return <DetailView id={selectedId} onBack={() => { setView('list'); setSelectedId(null); }} />;

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#B91C1C]" />
          <div><h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>Contrôles Techniques</h1>
            <p className="text-[8px] text-[var(--text-muted)]">NF EN 13015 · Décret 2004-964</p></div>
        </div>
        <div className="flex items-center gap-1">
          {[{ v: 'dashboard' as View, i: BarChart3, l: 'Dashboard' }, { v: 'calendar' as View, i: Calendar, l: 'Calendrier' }, { v: 'list' as View, i: List, l: 'Liste' }].map(b =>
            <button key={b.v} onClick={() => setView(b.v)} className={cn('flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold', view === b.v ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]')}>
              <b.i className="w-3 h-3" />{b.l}</button>)}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-2 py-1 rounded bg-[#B91C1C] text-white text-[9px] font-bold ml-1"><Plus className="w-3 h-3" /> Nouveau</button>
        </div>
      </div>

      {/* Dashboard */}
      {view === 'dashboard' && stats && <DashboardView stats={stats} onOpenDetail={openDetail} />}

      {/* Calendar */}
      {view === 'calendar' && <CalendarView controles={filtered} onSelect={openDetail} />}

      {/* List */}
      {view === 'list' && <>
        <div className="flex gap-1 flex-shrink-0">
          <div className="relative flex-1"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
            <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Rechercher ascenseur, adresse..." className="pl-6 text-[9px]" /></div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            <option value="">Tous types</option>{TYPES_CONTROLE.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as any)} className="px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            <option value="">Tous statuts</option><option value="planifie">Planifié</option><option value="en_cours">En cours</option><option value="termine">Terminé</option></select>
        </div>
        <ListView controles={filtered} onSelect={openDetail} isLoading={isLoading} />
      </>}

      {/* Create modal */}
      {showForm && <CreateModal ascenseurs={ascenseurs} onClose={() => setShowForm(false)} onCreated={(c) => { setShowForm(false); qc.invalidateQueries({ queryKey: ['controles'] }); qc.invalidateQueries({ queryKey: ['controle-stats'] }); openDetail(c.id); }} />}
    </div>
  );
}

// ═══ DASHBOARD ═══

function DashboardView({ stats, onOpenDetail }: { stats: ControleStats; onOpenDetail: (id: string) => void }) {
  return <div className="flex-1 overflow-y-auto space-y-2">
    {/* KPIs */}
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { label: 'Planifiés', value: stats.planifies, color: '#3B82F6', icon: Calendar },
        { label: 'En retard', value: stats.enRetard, color: '#DC2626', icon: AlertCircle },
        { label: 'Obs. ouvertes', value: stats.obsOuvertes, color: '#EA580C', icon: AlertTriangle },
        { label: 'Conformité', value: `${stats.tauxConformite}%`, color: '#059669', icon: TrendingUp },
      ].map(k => <Card key={k.label}><CardBody className="p-2 text-center">
        <k.icon className="w-4 h-4 mx-auto mb-0.5" style={{ color: k.color }} />
        <p className="text-[16px] font-extrabold font-mono" style={{ color: k.color }}>{k.value}</p>
        <p className="text-[7px] text-[var(--text-muted)] font-semibold">{k.label}</p>
      </CardBody></Card>)}
    </div>

    {/* Observations par gravité */}
    <Card><CardBody className="p-2">
      <p className="text-[9px] font-bold mb-1.5">Observations ouvertes par gravité</p>
      <div className="flex gap-2">
        {GRAVITES.map(g => {
          const count = g.id === 'OA' ? stats.oaOuvertes : g.id === 'OI' ? stats.oiOuvertes : stats.ocOuvertes;
          return <div key={g.id} className="flex-1 p-2 rounded-lg text-center" style={{ backgroundColor: g.couleur + '12' }}>
            <span className="text-[14px]">{g.icon}</span>
            <p className="text-[16px] font-extrabold font-mono mt-0.5" style={{ color: g.couleur }}>{count}</p>
            <p className="text-[7px] font-semibold" style={{ color: g.couleur }}>{g.nom}</p>
            <p className="text-[6px] text-[var(--text-muted)]">{g.delai}</p>
          </div>;
        })}
      </div>
    </CardBody></Card>

    {/* Prochains contrôles */}
    <Card><CardBody className="p-2">
      <p className="text-[9px] font-bold mb-1.5"><Clock className="w-3 h-3 inline mr-0.5" />Prochains contrôles</p>
      {stats.prochains.length === 0 ? <p className="text-[8px] text-[var(--text-muted)] text-center py-2">Aucun contrôle planifié</p> :
        <div className="space-y-0.5">{stats.prochains.map(c => {
          const tc = TYPES_CONTROLE.find(t => t.id === c.type_controle);
          const days = Math.ceil((new Date(c.date_planifiee).getTime() - Date.now()) / 86400000);
          return <button key={c.id} onClick={() => onOpenDetail(c.id)} className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-left">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: tc?.couleur }} />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold truncate">{c.ascenseur?.code} — {c.ascenseur?.adresse}</p>
              <p className="text-[7px] text-[var(--text-muted)]">{tc?.nom} {c.organisme && `· ${c.organisme}`}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-mono font-bold">{new Date(c.date_planifiee).toLocaleDateString('fr')}</p>
              <p className={cn('text-[7px] font-bold', days < 7 ? 'text-[#DC2626]' : days < 30 ? 'text-[#EA580C]' : 'text-[#059669]')}>J-{days}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
          </button>;
        })}</div>}
    </CardBody></Card>
  </div>;
}

// ═══ CALENDAR VIEW ═══

function CalendarView({ controles, onSelect }: { controles: Controle[]; onSelect: (id: string) => void }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(), mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay() || 7; // lundi=1
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = i - (firstDay - 1) + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });
  const today = new Date(); const isToday = (d: number) => d === today.getDate() && mo === today.getMonth() && year === today.getFullYear();

  const getForDay = (d: number) => controles.filter(c => { const cd = new Date(c.date_planifiee); return cd.getDate() === d && cd.getMonth() === mo && cd.getFullYear() === year; });
  const prev = () => setMonth(new Date(year, mo - 1));
  const next = () => setMonth(new Date(year, mo + 1));

  return <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex items-center justify-between mb-1">
      <button onClick={prev} className="p-1 rounded hover:bg-[var(--bg-tertiary)]"><ChevronLeft className="w-4 h-4" /></button>
      <p className="text-[11px] font-bold capitalize">{month.toLocaleDateString('fr', { month: 'long', year: 'numeric' })}</p>
      <button onClick={next} className="p-1 rounded hover:bg-[var(--bg-tertiary)]"><ChevronRight className="w-4 h-4" /></button>
    </div>
    <div className="grid grid-cols-7 gap-px text-center mb-0.5">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <p key={d} className="text-[7px] font-bold text-[var(--text-muted)]">{d}</p>)}</div>
    <div className="grid grid-cols-7 gap-px flex-1 overflow-y-auto">{days.map((d, i) => {
      if (!d) return <div key={i} className="bg-[var(--bg-secondary)] rounded" />;
      const items = getForDay(d); const now = new Date().toISOString().slice(0, 10); const dateStr = `${year}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const late = items.some(c => c.statut === 'planifie' && dateStr < now);
      return <div key={i} className={cn('p-0.5 rounded border min-h-[36px]', isToday(d) ? 'border-[#B91C1C] bg-[#B91C1C]/5' : 'border-[var(--border-secondary)]')}>
        <p className={cn('text-[8px] font-bold', isToday(d) ? 'text-[#B91C1C]' : late ? 'text-[#DC2626]' : 'text-[var(--text-secondary)]')}>{d}</p>
        {items.slice(0, 2).map(c => {
          const tc = TYPES_CONTROLE.find(t => t.id === c.type_controle);
          return <button key={c.id} onClick={() => onSelect(c.id)} className="w-full text-left mt-px px-0.5 py-px rounded text-[6px] font-semibold truncate" style={{ backgroundColor: tc?.couleur + '20', color: tc?.couleur }}>
            {c.ascenseur?.code}</button>;
        })}
        {items.length > 2 && <p className="text-[6px] text-[var(--text-muted)] text-center">+{items.length - 2}</p>}
      </div>;
    })}</div>
  </div>;
}

// ═══ LIST VIEW ═══

function ListView({ controles, onSelect, isLoading }: { controles: Controle[]; onSelect: (id: string) => void; isLoading: boolean }) {
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'statut'>('date');
  const sorted = useMemo(() => {
    const s = [...controles];
    if (sortBy === 'date') s.sort((a, b) => a.date_planifiee.localeCompare(b.date_planifiee));
    if (sortBy === 'type') s.sort((a, b) => a.type_controle.localeCompare(b.type_controle));
    if (sortBy === 'statut') s.sort((a, b) => a.statut.localeCompare(b.statut));
    return s;
  }, [controles, sortBy]);

  const statutBadge = (s: StatutControle) => {
    const map: Record<StatutControle, { color: string; label: string }> = {
      planifie: { color: '#3B82F6', label: 'Planifié' }, en_cours: { color: '#EA580C', label: 'En cours' },
      termine: { color: '#059669', label: 'Terminé' }, annule: { color: '#6B7280', label: 'Annulé' },
    };
    const v = map[s]; return <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold text-white" style={{ backgroundColor: v.color }}>{v.label}</span>;
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>;

  return <div className="flex-1 overflow-y-auto">
    <div className="flex items-center gap-1 mb-1 px-1">
      {(['date', 'type', 'statut'] as const).map(s => <button key={s} onClick={() => setSortBy(s)} className={cn('text-[7px] font-semibold px-1.5 py-0.5 rounded', sortBy === s ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>
        <ArrowUpDown className="w-2 h-2 inline mr-0.5" />{s === 'date' ? 'Date' : s === 'type' ? 'Type' : 'Statut'}</button>)}
      <span className="text-[7px] text-[var(--text-muted)] ml-auto">{sorted.length} contrôle(s)</span>
    </div>
    <div className="space-y-0.5">{sorted.map(c => {
      const tc = TYPES_CONTROLE.find(t => t.id === c.type_controle);
      const now = new Date().toISOString().slice(0, 10);
      const late = c.statut === 'planifie' && c.date_planifiee < now;
      return <button key={c.id} onClick={() => onSelect(c.id)} className={cn('w-full flex items-center gap-2 p-2 rounded-lg border text-left hover:bg-[var(--bg-tertiary)] transition-colors', late ? 'border-[#DC2626]/30 bg-[#DC2626]/3' : 'border-[var(--border-secondary)]')}>
        <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: tc?.couleur }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5"><p className="text-[10px] font-bold truncate">{c.ascenseur?.code}</p>{statutBadge(c.statut)}{late && <Badge variant="red" className="text-[6px]">EN RETARD</Badge>}</div>
          <p className="text-[8px] text-[var(--text-muted)] truncate">{c.ascenseur?.adresse}</p>
          <p className="text-[7px] text-[var(--text-muted)]">{tc?.nom} {c.organisme && `· ${c.organisme}`}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[9px] font-mono font-bold">{new Date(c.date_planifiee).toLocaleDateString('fr')}</p>
          {c.score_conformite != null && <p className={cn('text-[8px] font-bold', c.score_conformite >= 80 ? 'text-[#059669]' : c.score_conformite >= 50 ? 'text-[#EA580C]' : 'text-[#DC2626]')}>{c.score_conformite}%</p>}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>;
    })}</div>
  </div>;
}

// ═══ DETAIL VIEW ═══

function DetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('info');
  const [editMode, setEditMode] = useState(false);
  const qc = useQueryClient();
  const { data: controle, isLoading } = useQuery({ queryKey: ['controle', id], queryFn: () => getControle(id) });
  const { data: checks = [] } = useQuery({ queryKey: ['check-items', id], queryFn: () => getCheckItems(id) });
  const { data: observations = [] } = useQuery({ queryKey: ['observations', id], queryFn: () => getObservations(id) });

  const updMut = useMutation({ mutationFn: (c: Partial<Controle>) => updateControle(id, c), onSuccess: () => { qc.invalidateQueries({ queryKey: ['controle', id] }); qc.invalidateQueries({ queryKey: ['controles'] }); toast.success('Mis à jour'); } });
  const delMut = useMutation({ mutationFn: () => deleteControle(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['controles'] }); toast.success('Supprimé'); onBack(); } });
  const initCheckMut = useMutation({ mutationFn: () => initChecklist(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['check-items', id] }); toast.success('Check-list initialisée'); } });

  if (isLoading || !controle) return <div className="h-full flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>;

  const tc = TYPES_CONTROLE.find(t => t.id === controle.type_controle);
  const checkDone = checks.filter(c => c.conforme !== null).length;
  const checkConf = checks.filter(c => c.conforme === true).length;
  const checkTotal = checks.length;
  const confRate = checkTotal > 0 ? Math.round((checkConf / checkTotal) * 100) : 0;
  const oaCt = observations.filter(o => o.gravite === 'OA' && o.statut !== 'levee' && o.statut !== 'validee').length;

  return <div className="h-full flex flex-col gap-2 overflow-hidden">
    {/* Header */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={onBack} className="p-1 rounded hover:bg-[var(--bg-tertiary)]"><ChevronLeft className="w-4 h-4" /></button>
      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: tc?.couleur }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[13px] font-extrabold truncate">{controle.ascenseur?.code}</h2>
          <span className="px-1.5 py-0.5 rounded-full text-[7px] font-bold text-white" style={{ backgroundColor: tc?.couleur }}>{tc?.nom}</span>
          {oaCt > 0 && <Badge variant="red" className="text-[7px] animate-pulse">{oaCt} OA</Badge>}
        </div>
        <p className="text-[8px] text-[var(--text-muted)] truncate">{controle.ascenseur?.adresse} {controle.organisme && `· ${controle.organisme}`}</p>
      </div>
      <div className="flex gap-0.5">
        {controle.statut === 'planifie' && <button onClick={() => updMut.mutate({ statut: 'en_cours', date_realisation: new Date().toISOString().slice(0, 10) })} className="px-2 py-1 rounded bg-[#EA580C] text-white text-[8px] font-bold">Démarrer</button>}
        {controle.statut === 'en_cours' && <button onClick={() => updMut.mutate({ statut: 'termine', score_conformite: confRate })} className="px-2 py-1 rounded bg-[#059669] text-white text-[8px] font-bold">Terminer</button>}
        <button onClick={() => { exportControlePDF(controle, observations, checks); toast.success('PDF exporté'); }} className="px-2 py-1 rounded border border-[var(--border-primary)] text-[8px] font-semibold"><FileDown className="w-3 h-3 inline mr-0.5" />PDF</button>
        <button onClick={() => { if (confirm('Supprimer ?')) delMut.mutate(); }} className="p-1 rounded text-[#DC2626] hover:bg-[#DC2626]/10"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>

    {/* KPIs bar */}
    <div className="grid grid-cols-4 gap-1 flex-shrink-0">
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center"><p className="text-[7px] text-[var(--text-muted)]">Date</p><p className="text-[10px] font-mono font-bold">{new Date(controle.date_planifiee).toLocaleDateString('fr')}</p></div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center"><p className="text-[7px] text-[var(--text-muted)]">Check-list</p><p className="text-[10px] font-mono font-bold">{checkDone}/{checkTotal}</p></div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center"><p className="text-[7px] text-[var(--text-muted)]">Observations</p><p className="text-[10px] font-mono font-bold">{observations.length}</p></div>
      <div className="p-1.5 rounded bg-[var(--bg-secondary)] text-center"><p className="text-[7px] text-[var(--text-muted)]">Conformité</p><p className={cn('text-[10px] font-mono font-bold', confRate >= 80 ? 'text-[#059669]' : confRate >= 50 ? 'text-[#EA580C]' : 'text-[#DC2626]')}>{confRate}%</p></div>
    </div>

    {/* Tabs */}
    <div className="flex gap-px p-0.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-secondary)] flex-shrink-0">
      {[{ id: 'info' as Tab, l: 'Infos' }, { id: 'checklist' as Tab, l: `Check-list (${checkDone}/${checkTotal})` }, { id: 'observations' as Tab, l: `Observations (${observations.length})` }, { id: 'levees' as Tab, l: 'Levées' }].map(t =>
        <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex-1 py-1.5 rounded-[10px] text-[8px] font-bold', tab === t.id ? 'bg-[#B91C1C] text-white' : 'text-[var(--text-muted)]')}>{t.l}</button>)}
    </div>

    {/* Tab content */}
    <div className="flex-1 overflow-y-auto">
      {tab === 'info' && <InfoTab controle={controle} onUpdate={(c) => updMut.mutate(c)} />}
      {tab === 'checklist' && <ChecklistTab controleId={id} checks={checks} onInit={() => initCheckMut.mutate()} />}
      {tab === 'observations' && <ObservationsTab controleId={id} observations={observations} />}
      {tab === 'levees' && <LeveesTab observations={observations} />}
    </div>
  </div>;
}

// ═══ INFO TAB ═══

function InfoTab({ controle, onUpdate }: { controle: Controle; onUpdate: (c: Partial<Controle>) => void }) {
  return <div className="space-y-1.5">
    <Card><CardBody className="p-2 space-y-1">
      <p className="text-[8px] font-bold uppercase">Détails du contrôle</p>
      <div className="grid grid-cols-2 gap-1">
        <div><label className="text-[7px] text-[var(--text-muted)]">Type</label>
          <select value={controle.type_controle} onChange={e => onUpdate({ type_controle: e.target.value as TypeControle })} className="w-full px-2 py-1 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            {TYPES_CONTROLE.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
        <div><label className="text-[7px] text-[var(--text-muted)]">Organisme</label>
          <select value={controle.organisme || ''} onChange={e => onUpdate({ organisme: e.target.value })} className="w-full px-2 py-1 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            <option value="">— Interne —</option>{ORGANISMES.map(o => <option key={o.id} value={o.nom}>{o.nom}</option>)}</select></div>
        <div><label className="text-[7px] text-[var(--text-muted)]">Date planifiée</label>
          <Input type="date" value={controle.date_planifiee?.slice(0, 10)} onChange={e => onUpdate({ date_planifiee: e.target.value })} className="text-[9px]" /></div>
        <div><label className="text-[7px] text-[var(--text-muted)]">Date réalisation</label>
          <Input type="date" value={controle.date_realisation?.slice(0, 10) || ''} onChange={e => onUpdate({ date_realisation: e.target.value })} className="text-[9px]" /></div>
      </div>
    </CardBody></Card>
    <Card><CardBody className="p-2">
      <label className="text-[7px] text-[var(--text-muted)]">Notes</label>
      <textarea value={controle.notes || ''} onChange={e => onUpdate({ notes: e.target.value })} rows={3} className="w-full px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded resize-none" />
    </CardBody></Card>
    <Card><CardBody className="p-2">
      <p className="text-[8px] font-bold uppercase mb-1">Ascenseur</p>
      <div className="grid grid-cols-2 gap-1 text-[8px]">
        <div><span className="text-[var(--text-muted)]">Code:</span> <b>{controle.ascenseur?.code}</b></div>
        <div><span className="text-[var(--text-muted)]">Marque:</span> <b>{controle.ascenseur?.marque || '—'}</b></div>
        <div className="col-span-2"><span className="text-[var(--text-muted)]">Adresse:</span> <b>{controle.ascenseur?.adresse}</b></div>
        <div className="col-span-2"><span className="text-[var(--text-muted)]">Client:</span> <b>{controle.ascenseur?.client?.nom || '—'}</b></div>
      </div>
    </CardBody></Card>
  </div>;
}

// ═══ CHECKLIST TAB ═══

function ChecklistTab({ controleId, checks, onInit }: { controleId: string; checks: CheckItem[]; onInit: () => void }) {
  const qc = useQueryClient();
  const updMut = useMutation({ mutationFn: ({ id, ci }: { id: string; ci: Partial<CheckItem> }) => updateCheckItem(id, ci), onSuccess: () => qc.invalidateQueries({ queryKey: ['check-items', controleId] }) });
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  if (checks.length === 0) return <div className="flex flex-col items-center justify-center py-8 gap-2">
    <ClipboardCheck className="w-8 h-8 text-[var(--text-muted)]" />
    <p className="text-[10px] text-[var(--text-muted)]">Aucune check-list initialisée</p>
    <button onClick={onInit} className="px-3 py-1.5 rounded bg-[#B91C1C] text-white text-[9px] font-bold">Initialiser la check-list NF EN 13015</button>
    <p className="text-[7px] text-[var(--text-muted)]">{CHECKLIST_STANDARD.reduce((a, c) => a + c.items.length, 0)} points de contrôle</p>
  </div>;

  const grouped = CATEGORIES_CHECK.map(cat => ({ ...cat, items: checks.filter(c => c.categorie === cat.id) })).filter(g => g.items.length > 0);
  const total = checks.length, done = checks.filter(c => c.conforme !== null).length, conf = checks.filter(c => c.conforme === true).length;

  return <div className="space-y-1">
    {/* Progress */}
    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--bg-secondary)]">
      <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div className="h-full rounded-full bg-[#059669]" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="text-[8px] font-mono font-bold">{done}/{total}</span>
      <span className="text-[8px] font-bold text-[#059669]">{conf} ✓</span>
      <span className="text-[8px] font-bold text-[#DC2626]">{done - conf} ✗</span>
    </div>

    {grouped.map(g => <Card key={g.id}><CardBody className="p-0">
      <button onClick={() => setExpandedCat(expandedCat === g.id ? null : g.id)} className="w-full flex items-center gap-2 p-2 text-left">
        <span className="text-[12px]">{g.icon}</span>
        <span className="text-[9px] font-bold flex-1">{g.nom}</span>
        <span className="text-[7px] text-[var(--text-muted)] font-mono">{g.items.filter(i => i.conforme !== null).length}/{g.items.length}</span>
        {expandedCat === g.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expandedCat === g.id && <div className="px-2 pb-2 space-y-0.5">{g.items.map(ci => <div key={ci.id} className="flex items-center gap-1.5 py-1 border-t border-[var(--border-secondary)]">
        <div className="flex gap-px">
          <button onClick={() => updMut.mutate({ id: ci.id, ci: { conforme: true } })} className={cn('w-5 h-5 rounded flex items-center justify-center text-[10px]', ci.conforme === true ? 'bg-[#059669] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>✓</button>
          <button onClick={() => updMut.mutate({ id: ci.id, ci: { conforme: false } })} className={cn('w-5 h-5 rounded flex items-center justify-center text-[10px]', ci.conforme === false ? 'bg-[#DC2626] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>✗</button>
          <button onClick={() => updMut.mutate({ id: ci.id, ci: { conforme: null } })} className={cn('w-5 h-5 rounded flex items-center justify-center text-[8px]', ci.conforme === null ? 'bg-amber-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>?</button>
        </div>
        <p className={cn('text-[8px] flex-1', ci.conforme === false && 'text-[#DC2626] font-semibold')}>{ci.libelle}</p>
      </div>)}</div>}
    </CardBody></Card>)}
  </div>;
}

// ═══ OBSERVATIONS TAB ═══

function ObservationsTab({ controleId, observations }: { controleId: string; observations: Observation[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newObs, setNewObs] = useState<Partial<Observation>>({ gravite: 'OC', categorie: 'divers', description: '', statut: 'ouverte' });
  const qc = useQueryClient();
  const addMut = useMutation({ mutationFn: (o: Partial<Observation>) => createObservation({ ...o, controle_id: controleId }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['observations', controleId] }); qc.invalidateQueries({ queryKey: ['controle-stats'] }); setShowAdd(false); setNewObs({ gravite: 'OC', categorie: 'divers', description: '', statut: 'ouverte' }); toast.success('Observation ajoutée'); } });
  const updMut = useMutation({ mutationFn: ({ id, o }: { id: string; o: Partial<Observation> }) => updateObservation(id, o), onSuccess: () => { qc.invalidateQueries({ queryKey: ['observations', controleId] }); toast.success('Mis à jour'); } });
  const delMut = useMutation({ mutationFn: deleteObservation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['observations', controleId] }); toast.success('Supprimé'); } });

  const statutMap: Record<StatutObservation, { label: string; color: string }> = {
    ouverte: { label: 'Ouverte', color: '#DC2626' }, devis_envoye: { label: 'Devis envoyé', color: '#EA580C' },
    travaux_planifies: { label: 'Travaux planifiés', color: '#CA8A04' }, en_cours: { label: 'En cours', color: '#3B82F6' },
    levee: { label: 'Levée', color: '#059669' }, validee: { label: 'Validée', color: '#059669' },
  };

  return <div className="space-y-1">
    <div className="flex justify-between">
      <p className="text-[9px] font-bold">{observations.length} observation(s)</p>
      <button onClick={() => setShowAdd(!showAdd)} className="text-[8px] font-bold px-2 py-0.5 rounded bg-[#B91C1C] text-white"><Plus className="w-2.5 h-2.5 inline mr-0.5" />Ajouter</button>
    </div>

    {showAdd && <Card><CardBody className="p-2 space-y-1 border-2 border-dashed border-[#B91C1C]/30">
      <div className="grid grid-cols-2 gap-1">
        <div><label className="text-[7px]">Gravité</label><div className="flex gap-px">{GRAVITES.map(g => <button key={g.id} onClick={() => setNewObs({ ...newObs, gravite: g.id })} className={cn('flex-1 py-1 rounded text-[7px] font-bold', newObs.gravite === g.id ? 'text-white' : 'bg-[var(--bg-tertiary)]')} style={newObs.gravite === g.id ? { backgroundColor: g.couleur } : {}}>{g.id}</button>)}</div></div>
        <div><label className="text-[7px]">Catégorie</label><select value={newObs.categorie} onChange={e => setNewObs({ ...newObs, categorie: e.target.value as CategorieCheck })} className="w-full px-1 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
          {CATEGORIES_CHECK.map(c => <option key={c.id} value={c.id}>{c.icon} {c.nom}</option>)}</select></div>
      </div>
      <div><label className="text-[7px]">Description</label><textarea value={newObs.description} onChange={e => setNewObs({ ...newObs, description: e.target.value })} rows={2} className="w-full px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded resize-none" placeholder="Décrire la non-conformité..." /></div>
      <div className="grid grid-cols-2 gap-1">
        <div><label className="text-[7px]">Réf. norme</label><Input value={newObs.reference_norme || ''} onChange={e => setNewObs({ ...newObs, reference_norme: e.target.value })} className="text-[8px]" placeholder="NF EN 81-20 §5.4" /></div>
        <div><label className="text-[7px]">Devis €</label><Input type="number" value={newObs.devis_montant || ''} onChange={e => setNewObs({ ...newObs, devis_montant: parseFloat(e.target.value) || undefined })} className="text-[8px]" /></div>
      </div>
      <button onClick={() => { if (newObs.description) addMut.mutate(newObs); }} disabled={!newObs.description} className="w-full py-1.5 rounded bg-[#B91C1C] text-white text-[9px] font-bold disabled:opacity-30">Enregistrer l'observation</button>
    </CardBody></Card>}

    {observations.map(obs => {
      const g = GRAVITES.find(x => x.id === obs.gravite);
      const cat = CATEGORIES_CHECK.find(x => x.id === obs.categorie);
      const st = statutMap[obs.statut];
      return <Card key={obs.id}><CardBody className="p-2">
        <div className="flex items-start gap-1.5">
          <div className="flex flex-col items-center gap-0.5 pt-0.5">
            <span className="text-[12px]">{g?.icon}</span>
            <span className="text-[6px] font-bold" style={{ color: g?.couleur }}>{obs.gravite}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[7px] px-1 py-px rounded" style={{ backgroundColor: cat?.id ? '#8B5CF6' + '20' : undefined, color: '#8B5CF6' }}>{cat?.icon} {cat?.nom}</span>
              <span className="px-1 py-px rounded-full text-[6px] font-bold text-white" style={{ backgroundColor: st.color }}>{st.label}</span>
              {obs.reference_norme && <span className="text-[6px] font-mono text-[var(--text-muted)]">{obs.reference_norme}</span>}
            </div>
            <p className="text-[8px]">{obs.description}</p>
            {obs.devis_montant && <p className="text-[7px] text-[var(--text-muted)] mt-0.5">Devis: <b>{obs.devis_montant.toFixed(2)} €</b></p>}
          </div>
          <div className="flex flex-col gap-px">
            <select value={obs.statut} onChange={e => updMut.mutate({ id: obs.id, o: { statut: e.target.value as StatutObservation } })} className="text-[7px] px-1 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
              {Object.entries(statutMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <button onClick={() => { if (confirm('Supprimer ?')) delMut.mutate(obs.id); }} className="text-[#DC2626] text-[7px]"><Trash2 className="w-2 h-2 inline" /></button>
          </div>
        </div>
      </CardBody></Card>;
    })}
  </div>;
}

// ═══ LEVEES TAB ═══

function LeveesTab({ observations }: { observations: Observation[] }) {
  const openObs = observations.filter(o => o.statut !== 'validee');
  const [selObs, setSelObs] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const qc = useQueryClient();
  const addMut = useMutation({
    mutationFn: (l: Partial<Levee>) => createLevee(l),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['observations'] }); qc.invalidateQueries({ queryKey: ['controle-stats'] }); setSelObs(null); setDesc(''); toast.success('Levée enregistrée'); },
  });

  return <div className="space-y-1.5">
    <Card><CardBody className="p-2">
      <p className="text-[9px] font-bold mb-1">Enregistrer une levée</p>
      <div className="space-y-1">
        <select value={selObs || ''} onChange={e => setSelObs(e.target.value || null)} className="w-full px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
          <option value="">— Sélectionner une observation —</option>
          {openObs.map(o => { const g = GRAVITES.find(x => x.id === o.gravite); return <option key={o.id} value={o.id}>{g?.icon} {o.gravite} — {o.description.slice(0, 60)}</option>; })}
        </select>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Travaux réalisés..." className="w-full px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded resize-none" />
        <button onClick={() => { if (selObs && desc) addMut.mutate({ observation_id: selObs, description: desc, date_levee: new Date().toISOString().slice(0, 10) }); }} disabled={!selObs || !desc} className="w-full py-1.5 rounded bg-[#059669] text-white text-[9px] font-bold disabled:opacity-30"><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Valider la levée</button>
      </div>
    </CardBody></Card>

    <p className="text-[8px] font-bold">Historique des observations</p>
    {observations.map(obs => {
      const g = GRAVITES.find(x => x.id === obs.gravite);
      const isLevee = obs.statut === 'levee' || obs.statut === 'validee';
      return <div key={obs.id} className={cn('flex items-center gap-2 p-1.5 rounded border', isLevee ? 'border-[#059669]/20 bg-[#059669]/3' : 'border-[var(--border-secondary)]')}>
        <span className="text-[10px]">{g?.icon}</span>
        <div className="flex-1 min-w-0"><p className={cn('text-[8px] truncate', isLevee && 'line-through text-[var(--text-muted)]')}>{obs.description}</p></div>
        {isLevee ? <CheckCircle2 className="w-3 h-3 text-[#059669]" /> : <Clock className="w-3 h-3 text-[var(--text-muted)]" />}
      </div>;
    })}
  </div>;
}

// ═══ CREATE MODAL ═══

function CreateModal({ ascenseurs, onClose, onCreated }: { ascenseurs: { id: string; code: string; adresse: string }[]; onClose: () => void; onCreated: (c: Controle) => void }) {
  const [form, setForm] = useState<Partial<Controle>>({ type_controle: 'semestriel', statut: 'planifie', date_planifiee: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  const mut = useMutation({ mutationFn: createControle, onSuccess: (c) => { toast.success('Contrôle planifié'); onCreated(c); } });

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
    <Card className="w-[380px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}><CardBody className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-extrabold"><Shield className="w-4 h-4 inline mr-1 text-[#B91C1C]" />Nouveau contrôle</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      <div><label className="text-[8px] font-bold">Ascenseur *</label>
        <select value={form.ascenseur_id || ''} onChange={e => setForm({ ...form, ascenseur_id: e.target.value })} className="w-full px-2 py-1.5 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
          <option value="">— Sélectionner —</option>{ascenseurs.map(a => <option key={a.id} value={a.id}>{a.code} — {a.adresse}</option>)}</select></div>

      <div className="grid grid-cols-2 gap-1.5">
        <div><label className="text-[8px] font-bold">Type</label>
          <select value={form.type_controle} onChange={e => setForm({ ...form, type_controle: e.target.value as TypeControle })} className="w-full px-2 py-1.5 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            {TYPES_CONTROLE.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></div>
        <div><label className="text-[8px] font-bold">Organisme</label>
          <select value={form.organisme || ''} onChange={e => setForm({ ...form, organisme: e.target.value })} className="w-full px-2 py-1.5 text-[9px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded">
            <option value="">Interne</option>{ORGANISMES.map(o => <option key={o.id} value={o.nom}>{o.nom}</option>)}</select></div>
      </div>

      <div><label className="text-[8px] font-bold">Date planifiée *</label>
        <Input type="date" value={form.date_planifiee || ''} onChange={e => setForm({ ...form, date_planifiee: e.target.value })} className="text-[9px]" /></div>

      <div><label className="text-[8px] font-bold">Notes</label>
        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-2 py-1 text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded resize-none" /></div>

      <button onClick={() => { if (form.ascenseur_id && form.date_planifiee) mut.mutate(form); else toast.error('Ascenseur et date requis'); }} disabled={!form.ascenseur_id}
        className="w-full py-2 rounded bg-[#B91C1C] text-white text-[10px] font-bold disabled:opacity-30">Planifier le contrôle</button>
    </CardBody></Card>
  </div>;
}

// ═══ PDF EXPORT ═══

function exportControlePDF(controle: Controle, observations: Observation[], checks: CheckItem[]) {
  const tc = TYPES_CONTROLE.find(t => t.id === controle.type_controle);
  const pdf = new PDFBuilder('Contrôle Technique', controle.ascenseur?.code || '', 'portrait');
  pdf.docTitle('Rapport de Contrôle Technique');
  pdf.docSubtitle(`${tc?.nom} — ${controle.ascenseur?.code}`);

  pdf.kpiRow([
    { label: 'Date', value: controle.date_planifiee ? new Date(controle.date_planifiee).toLocaleDateString('fr') : '—' },
    { label: 'Organisme', value: controle.organisme || 'Interne' },
    { label: 'Conformité', value: `${controle.score_conformite || 0}%`, color: (controle.score_conformite || 0) >= 80 ? [5, 150, 105] : [220, 38, 38] },
    { label: 'Observations', value: String(observations.length) },
  ]);

  pdf.section('Ascenseur');
  pdf.info([['Code', controle.ascenseur?.code || ''], ['Adresse', controle.ascenseur?.adresse || ''], ['Marque', controle.ascenseur?.marque || '—'], ['Client', controle.ascenseur?.client?.nom || '—']], 2);

  if (observations.length > 0) {
    pdf.section('Observations');
    pdf.table(['Gravité', 'Catégorie', 'Description', 'Statut', 'Norme'], observations.map(o => {
      const g = GRAVITES.find(x => x.id === o.gravite);
      const cat = CATEGORIES_CHECK.find(x => x.id === o.categorie);
      return [o.gravite, cat?.nom || '', o.description.slice(0, 50), o.statut, o.reference_norme || ''];
    }));
  }

  if (checks.length > 0) {
    pdf.section('Check-list');
    const total = checks.length, conf = checks.filter(c => c.conforme === true).length, nc = checks.filter(c => c.conforme === false).length, nd = checks.filter(c => c.conforme === null).length;
    pdf.info([['Total points', String(total)], ['Conformes', String(conf)], ['Non-conformes', String(nc)], ['Non vérifiés', String(nd)]], 4);

    // Non-conformes only
    const ncItems = checks.filter(c => c.conforme === false);
    if (ncItems.length > 0) {
      pdf.table(['Catégorie', 'Point de contrôle'], ncItems.map(ci => {
        const cat = CATEGORIES_CHECK.find(x => x.id === ci.categorie);
        return [cat?.nom || '', ci.libelle];
      }));
    }
  }

  if (controle.notes) { pdf.section('Notes'); pdf.noteBox(controle.notes); }

  pdf.save(`Controle-${controle.ascenseur?.code}-${fmtDate(new Date(), 'yyyyMMdd')}.pdf`);
}
