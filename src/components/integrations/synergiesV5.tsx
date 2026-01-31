// src/components/integrations/synergiesV5.tsx
// Synergies V5: Âge Pièces Préventif, Prévisions Consommation, Feedback Terrain

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Clock, Package, AlertTriangle, CheckCircle2, Calendar, TrendingUp,
  BarChart3, ArrowRight, RefreshCw, Wrench, Building2, History,
  MessageSquare, Send, Star, ThumbsUp, Flag, Camera, ArrowUp, ArrowDown,
  MapPin, User, Filter, ChevronDown, Plus, X, Zap, Minus,
  AlertCircle, Target, Activity, ShoppingCart, Truck, Bell, Eye
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInMonths, differenceInYears, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';


// =============================================
// 1. ÂGE PIÈCES ↔ REMPLACEMENT PRÉVENTIF
// =============================================

interface PieceInstallee {
  id: string;
  designation: string;
  reference?: string;
  code_appareil: string;
  adresse?: string;
  ville?: string;
  date_installation: string;
  age_mois: number;
  duree_vie_mois: number;
  pourcentage_vie: number;
  statut: 'ok' | 'attention' | 'remplacer' | 'urgent';
}

const DUREES_VIE: Record<string, number> = {
  'contacteur': 60,
  'relais': 48,
  'bouton': 36,
  'cable': 120,
  'porte': 84,
  'variateur': 96,
  'carte': 72,
  'capteur': 60,
  'eclairage': 36,
  'frein': 60,
  'default': 60,
};

export function AgePiecesPreventif({ 
  seuilAttention = 80,
  seuilRemplacer = 95,
  seuilUrgent = 110,
  compact = false
}: { 
  seuilAttention?: number;
  seuilRemplacer?: number;
  seuilUrgent?: number;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'remplacer' | 'attention'>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['age-pieces-preventif'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code_appareil, pieces, updated_at')
        .eq('statut', 'termine')
        .not('pieces', 'is', null);

      const codes = [...new Set(travaux?.map(t => t.code_appareil) || [])];
      const { data: asc } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville')
        .in('code_appareil', codes);

      const ascMap = new Map(asc?.map(a => [a.code_appareil, a]) || []);
      const pieces: PieceInstallee[] = [];

      travaux?.forEach(t => {
        const ps = t.pieces as any[];
        ps?.forEach(p => {
          if (!p.designation || p.statut !== 'installe') return;

          const designation = p.designation.toLowerCase();
          let dureeVie = DUREES_VIE.default;
          for (const [key, val] of Object.entries(DUREES_VIE)) {
            if (designation.includes(key)) { dureeVie = val; break; }
          }

          const ageMois = differenceInMonths(new Date(), parseISO(t.updated_at));
          const pourcentage = Math.round((ageMois / dureeVie) * 100);

          let statut: 'ok' | 'attention' | 'remplacer' | 'urgent' = 'ok';
          if (pourcentage >= seuilUrgent) statut = 'urgent';
          else if (pourcentage >= seuilRemplacer) statut = 'remplacer';
          else if (pourcentage >= seuilAttention) statut = 'attention';

          const info = ascMap.get(t.code_appareil);
          pieces.push({
            id: `${t.id}-${p.designation}`,
            designation: p.designation,
            reference: p.reference,
            code_appareil: t.code_appareil,
            adresse: info?.adresse,
            ville: info?.ville,
            date_installation: t.updated_at,
            age_mois: ageMois,
            duree_vie_mois: dureeVie,
            pourcentage_vie: pourcentage,
            statut,
          });
        });
      });

      return pieces.sort((a, b) => b.pourcentage_vie - a.pourcentage_vie);
    },
  });

  const creerTravaux = useMutation({
    mutationFn: async (piece: PieceInstallee) => {
      const { error } = await supabase.from('travaux').insert({
        code: `PREV-${Date.now().toString(36).toUpperCase()}`,
        titre: `Remplacement préventif: ${piece.designation}`,
        description: `Pièce à ${piece.pourcentage_vie}% de sa durée de vie.`,
        code_appareil: piece.code_appareil,
        priorite: piece.statut === 'urgent' ? 'urgente' : 'normale',
        statut: 'planifie',
        pieces: [{ designation: piece.designation, reference: piece.reference, quantite: 1 }],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Travaux préventif créé');
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.filter(p => p.statut !== 'ok');
    return data.filter(p => p.statut === filter);
  }, [data, filter]);

  const stats = useMemo(() => ({
    urgent: data?.filter(p => p.statut === 'urgent').length || 0,
    remplacer: data?.filter(p => p.statut === 'remplacer').length || 0,
    attention: data?.filter(p => p.statut === 'attention').length || 0,
  }), [data]);

  const cfg = {
    urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10' },
    remplacer: { label: 'À remplacer', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    attention: { label: 'Attention', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ok: { label: 'OK', color: 'text-green-400', bg: 'bg-green-500/10' },
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm">Âge Pièces</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-red-400">{stats.urgent}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Urgents</p>
          </div>
          <div className="p-2 bg-orange-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-orange-400">{stats.remplacer}</p>
            <p className="text-[10px] text-[var(--text-muted)]">À remplacer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold">Âge des Pièces - Remplacement Préventif</h3>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['urgent', 'remplacer', 'attention'] as const).map(key => (
          <div key={key} className={`p-3 rounded-xl ${cfg[key].bg} text-center`}>
            <p className={`text-2xl font-bold ${cfg[key].color}`}>{stats[key]}</p>
            <p className="text-xs text-[var(--text-muted)]">{cfg[key].label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['all', 'urgent', 'remplacer', 'attention'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}
          >
            {f === 'all' ? 'Tous' : cfg[f as keyof typeof cfg].label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-96 overflow-auto">
        {filtered.map(p => (
          <div key={p.id} className={`p-3 rounded-xl border ${cfg[p.statut].bg} border-[var(--border-primary)]`}>
            <div className="flex justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{p.designation}</span>
                  <Badge variant={p.statut === 'urgent' ? 'red' : p.statut === 'remplacer' ? 'orange' : 'amber'}>
                    {cfg[p.statut].label}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{p.code_appareil} • {p.adresse}</p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold ${cfg[p.statut].color}`}>{p.age_mois}<span className="text-sm">m</span></p>
                <button
                  onClick={() => creerTravaux.mutate(p)}
                  className="mt-1 px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-xs"
                >
                  Créer travaux
                </button>
              </div>
            </div>
            <div className="mt-2 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
              <div className={`h-full ${p.pourcentage_vie >= seuilUrgent ? 'bg-red-500' : p.pourcentage_vie >= seuilRemplacer ? 'bg-orange-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, p.pourcentage_vie)}%` }} />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{p.pourcentage_vie}% de {p.duree_vie_mois} mois</p>
          </div>
        ))}
      </div>
    </div>
  );
}


// =============================================
// 2. CONSOMMATION PIÈCES ↔ PRÉVISIONS
// =============================================

interface ArticleConso {
  id: string;
  designation: string;
  reference?: string;
  stock: number;
  seuil: number;
  conso_6m: number[];
  moyenne: number;
  tendance: 'hausse' | 'stable' | 'baisse';
  mois_rupture: number | null;
  recommandation: number;
}

export function PrevisionConsommation({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<'alertes' | 'hausse' | 'tous'>('alertes');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prevision-conso'],
    queryFn: async () => {
      const date6m = subMonths(new Date(), 6).toISOString();

      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite_stock, seuil_alerte');

      const { data: mvts } = await supabase
        .from('stock_mouvements')
        .select('article_id, quantite, created_at')
        .in('type_mouvement', ['sortie', 'consommation'])
        .gte('created_at', date6m);

      const consoMap = new Map<string, number[]>();
      mvts?.forEach(m => {
        const idx = differenceInMonths(new Date(), parseISO(m.created_at));
        if (idx < 0 || idx >= 6) return;
        const arr = consoMap.get(m.article_id) || [0,0,0,0,0,0];
        arr[idx] += Math.abs(m.quantite);
        consoMap.set(m.article_id, arr);
      });

      const result: ArticleConso[] = [];
      articles?.forEach(a => {
        const conso = consoMap.get(a.id) || [0,0,0,0,0,0];
        const total = conso.reduce((s,v) => s+v, 0);
        const moy = total / 6;
        
        const recent = conso.slice(0,3).reduce((s,v) => s+v, 0);
        const ancien = conso.slice(3,6).reduce((s,v) => s+v, 0);
        let tendance: 'hausse' | 'stable' | 'baisse' = 'stable';
        if (recent > ancien * 1.2) tendance = 'hausse';
        else if (recent < ancien * 0.8) tendance = 'baisse';

        const rupture = moy > 0 ? Math.floor(a.quantite_stock / moy) : null;
        const reco = Math.max(0, Math.ceil(moy * 3) - a.quantite_stock);

        if (total > 0 || a.quantite_stock <= (a.seuil_alerte || 5)) {
          result.push({
            id: a.id,
            designation: a.designation,
            reference: a.reference,
            stock: a.quantite_stock,
            seuil: a.seuil_alerte || 5,
            conso_6m: conso,
            moyenne: Math.round(moy * 10) / 10,
            tendance,
            mois_rupture: rupture && rupture <= 12 ? rupture : null,
            recommandation: reco,
          });
        }
      });

      return result.sort((a,b) => {
        if (a.mois_rupture === null && b.mois_rupture === null) return b.moyenne - a.moyenne;
        if (a.mois_rupture === null) return 1;
        if (b.mois_rupture === null) return -1;
        return a.mois_rupture - b.mois_rupture;
      });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (view === 'alertes') return data.filter(a => a.mois_rupture !== null && a.mois_rupture <= 3);
    if (view === 'hausse') return data.filter(a => a.tendance === 'hausse');
    return data;
  }, [data, view]);

  const stats = useMemo(() => ({
    critiques: data?.filter(a => a.mois_rupture !== null && a.mois_rupture <= 2).length || 0,
    hausse: data?.filter(a => a.tendance === 'hausse').length || 0,
    aCommander: data?.filter(a => a.recommandation > 0).length || 0,
  }), [data]);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">Prévisions Stock</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-red-400">{stats.critiques}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Critiques</p>
          </div>
          <div className="p-2 bg-orange-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-orange-400">{stats.hausse}</p>
            <p className="text-[10px] text-[var(--text-muted)]">En hausse</p>
          </div>
          <div className="p-2 bg-blue-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-blue-400">{stats.aCommander}</p>
            <p className="text-[10px] text-[var(--text-muted)]">À commander</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold">Prévisions de Consommation</h3>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-red-500/10 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.critiques}</p>
          <p className="text-xs text-[var(--text-muted)]">Rupture &lt;2m</p>
        </div>
        <div className="p-3 rounded-xl bg-orange-500/10 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.hausse}</p>
          <p className="text-xs text-[var(--text-muted)]">Conso hausse</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.aCommander}</p>
          <p className="text-xs text-[var(--text-muted)]">À commander</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'alertes', label: 'Alertes rupture' },
          { id: 'hausse', label: 'Tendance hausse' },
          { id: 'tous', label: 'Tous' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setView(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm ${view === f.id ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-96 overflow-auto">
        {filtered.map(a => {
          const TIcon = a.tendance === 'hausse' ? ArrowUp : a.tendance === 'baisse' ? ArrowDown : Minus;
          const tColor = a.tendance === 'hausse' ? 'text-red-400' : a.tendance === 'baisse' ? 'text-green-400' : 'text-gray-400';

          return (
            <div key={a.id} className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <div className="flex justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{a.designation}</span>
                    <span className={`flex items-center gap-1 text-xs ${tColor}`}>
                      <TIcon className="w-3 h-3" />
                      {a.tendance}
                    </span>
                  </div>
                  {a.reference && <p className="text-xs font-mono text-[var(--text-muted)]">{a.reference}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm">Stock: <span className={a.stock <= a.seuil ? 'text-red-400 font-bold' : ''}>{a.stock}</span></p>
                  <p className="text-xs text-[var(--text-muted)]">{a.moyenne}/mois</p>
                </div>
              </div>
              
              <div className="flex items-end gap-1 mt-2 h-8">
                {a.conso_6m.slice().reverse().map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-blue-500/50 rounded-t" 
                      style={{ height: `${Math.min(100, (v / Math.max(...a.conso_6m, 1)) * 100)}%`, minHeight: v > 0 ? '4px' : '0' }} />
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-2 text-xs">
                {a.mois_rupture !== null && (
                  <Badge variant={a.mois_rupture <= 1 ? 'red' : a.mois_rupture <= 2 ? 'orange' : 'amber'}>
                    Rupture {a.mois_rupture}m
                  </Badge>
                )}
                {a.recommandation > 0 && (
                  <span className="text-blue-400">Commander {a.recommandation}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// =============================================
// 3. FEEDBACK TERRAIN
// =============================================

interface Feedback {
  id: string;
  type: 'probleme' | 'suggestion' | 'info' | 'urgence';
  titre: string;
  description: string;
  code_appareil?: string;
  technicien_id: string;
  technicien_nom: string;
  statut: 'nouveau' | 'en_cours' | 'traite';
  priorite: 'haute' | 'normale' | 'basse';
  created_at: string;
  reponse?: string;
}

export function FeedbackTerrain({ 
  technicienId,
  isAdmin = false,
  compact = false
}: { 
  technicienId?: string;
  isAdmin?: boolean;
  compact?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'nouveau' | 'en_cours' | 'all'>('nouveau');
  const [form, setForm] = useState({ type: 'probleme' as const, titre: '', description: '', code_appareil: '', priorite: 'normale' as const });
  const queryClient = useQueryClient();

  const { data: feedbacks, refetch } = useQuery({
    queryKey: ['feedback-terrain', technicienId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('feedback_terrain')
        .select('*, technicien:techniciens(prenom, nom)')
        .order('created_at', { ascending: false });

      if (!isAdmin && technicienId) query = query.eq('technicien_id', technicienId);

      const { data, error } = await query.limit(50);
      if (error?.code === '42P01') return [];
      if (error) throw error;

      return (data || []).map(f => ({
        ...f,
        technicien_nom: f.technicien ? `${f.technicien.prenom} ${f.technicien.nom}` : 'Inconnu',
      })) as Feedback[];
    },
  });

  const createFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('feedback_terrain').insert({
        ...form,
        technicien_id: technicienId,
        statut: 'nouveau',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Feedback envoyé');
      setShowForm(false);
      setForm({ type: 'probleme', titre: '', description: '', code_appareil: '', priorite: 'normale' });
      queryClient.invalidateQueries({ queryKey: ['feedback-terrain'] });
    },
  });

  const updateStatut = useMutation({
    mutationFn: async ({ id, statut, reponse }: { id: string; statut: string; reponse?: string }) => {
      const { error } = await supabase.from('feedback_terrain').update({ statut, reponse }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mis à jour');
      queryClient.invalidateQueries({ queryKey: ['feedback-terrain'] });
    },
  });

  const filtered = useMemo(() => {
    if (!feedbacks) return [];
    if (filter === 'all') return feedbacks;
    return feedbacks.filter(f => f.statut === filter);
  }, [feedbacks, filter]);

  const stats = useMemo(() => ({
    nouveau: feedbacks?.filter(f => f.statut === 'nouveau').length || 0,
    en_cours: feedbacks?.filter(f => f.statut === 'en_cours').length || 0,
    urgences: feedbacks?.filter(f => f.type === 'urgence' && f.statut !== 'traite').length || 0,
  }), [feedbacks]);

  const typeConfig = {
    probleme: { label: 'Problème', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
    suggestion: { label: 'Suggestion', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Zap },
    info: { label: 'Info', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: MessageSquare },
    urgence: { label: 'Urgence', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: AlertTriangle },
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-sm">Feedback Terrain</span>
          </div>
          {!isAdmin && (
            <button onClick={() => setShowForm(true)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded text-purple-400">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-blue-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-blue-400">{stats.nouveau}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Nouveaux</p>
          </div>
          <div className="p-2 bg-orange-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-orange-400">{stats.urgences}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Urgences</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold">Feedback Terrain</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          {!isAdmin && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 rounded-lg text-purple-400 text-sm">
              <Plus className="w-4 h-4" />Nouveau
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
          <div className="flex justify-between">
            <h4 className="font-medium text-purple-400">Nouveau feedback</h4>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm">
              <option value="probleme">🔴 Problème</option>
              <option value="urgence">🟠 Urgence</option>
              <option value="suggestion">🔵 Suggestion</option>
              <option value="info">⚪ Info</option>
            </select>
            <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as any })}
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm">
              <option value="haute">Haute</option>
              <option value="normale">Normale</option>
              <option value="basse">Basse</option>
            </select>
          </div>
          <input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Titre..."
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm" />
          <input value={form.code_appareil} onChange={e => setForm({ ...form, code_appareil: e.target.value })} placeholder="Code appareil (optionnel)..."
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..."
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm resize-none" rows={3} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-[var(--text-muted)]">Annuler</button>
            <button onClick={() => createFeedback.mutate()} disabled={!form.titre || !form.description}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm disabled:opacity-50">
              <Send className="w-4 h-4" />Envoyer
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-blue-500/10 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.nouveau}</p>
          <p className="text-xs text-[var(--text-muted)]">Nouveaux</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.en_cours}</p>
          <p className="text-xs text-[var(--text-muted)]">En cours</p>
        </div>
        <div className="p-3 rounded-xl bg-orange-500/10 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.urgences}</p>
          <p className="text-xs text-[var(--text-muted)]">Urgences</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['nouveau', 'en_cours', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-purple-500/20 text-purple-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
            {f === 'nouveau' ? 'Nouveaux' : f === 'en_cours' ? 'En cours' : 'Tous'}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-96 overflow-auto">
        {filtered.map(fb => {
          const type = typeConfig[fb.type];
          const TypeIcon = type.icon;
          return (
            <div key={fb.id} className={`p-3 rounded-xl border ${type.bg} border-[var(--border-primary)]`}>
              <div className="flex gap-3">
                <div className={`p-2 rounded-lg ${type.bg}`}>
                  <TypeIcon className={`w-5 h-5 ${type.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{fb.titre}</span>
                    <Badge variant={fb.statut === 'nouveau' ? 'blue' : fb.statut === 'en_cours' ? 'amber' : 'green'}>
                      {fb.statut === 'nouveau' ? 'Nouveau' : fb.statut === 'en_cours' ? 'En cours' : 'Traité'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{fb.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-[var(--text-muted)]">
                    <span><User className="w-3 h-3 inline" /> {fb.technicien_nom}</span>
                    <span>{format(parseISO(fb.created_at), 'd MMM HH:mm', { locale: fr })}</span>
                    {fb.code_appareil && <span><Building2 className="w-3 h-3 inline" /> {fb.code_appareil}</span>}
                  </div>
                  {fb.reponse && (
                    <div className="mt-2 p-2 bg-green-500/10 rounded-lg text-sm">
                      <p className="text-xs text-green-400 mb-1">Réponse:</p>
                      {fb.reponse}
                    </div>
                  )}
                  {isAdmin && fb.statut !== 'traite' && (
                    <div className="mt-2 flex gap-2">
                      {fb.statut === 'nouveau' && (
                        <button onClick={() => updateStatut.mutate({ id: fb.id, statut: 'en_cours' })}
                          className="px-2 py-1 bg-amber-500/20 rounded text-amber-400 text-xs">Prendre en charge</button>
                      )}
                      <button onClick={() => { const r = prompt('Réponse:'); if (r) updateStatut.mutate({ id: fb.id, statut: 'traite', reponse: r }); }}
                        className="px-2 py-1 bg-green-500/20 rounded text-green-400 text-xs">Marquer traité</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// =============================================
// WIDGETS
// =============================================

export function AgePiecesWidget() {
  return <Card className="h-full"><CardBody className="p-3"><AgePiecesPreventif compact /></CardBody></Card>;
}

export function PrevisionConsoWidget() {
  return <Card className="h-full"><CardBody className="p-3"><PrevisionConsommation compact /></CardBody></Card>;
}

export function FeedbackTerrainWidget() {
  return <Card className="h-full"><CardBody className="p-3"><FeedbackTerrain compact isAdmin /></CardBody></Card>;
}
