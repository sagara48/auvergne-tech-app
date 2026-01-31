// src/components/integrations/synergiesV3.tsx
// Synergies V3: GED-Ascenseurs, Chaîne Appro, Alertes Entretien, Notes Contextuelles

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Upload, Download, Eye, Link, Calendar, FolderOpen,
  AlertTriangle, Clock, CheckCircle2, XCircle, Search, Filter,
  Car, Wrench, Settings, Bell, Package, Truck, ArrowRight,
  Plus, ChevronRight, ExternalLink, File, Image, FileSpreadsheet,
  Building2, MapPin, User, Tag, RefreshCw, Shield, Timer,
  Activity, Zap, BarChart3, X
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays, addDays, isAfter, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';


// =============================================
// 1. GED ↔ ASCENSEURS
// =============================================

interface DocumentGED {
  id: string;
  nom: string;
  type: string;
  categorie: string;
  fichier_url: string;
  taille: number;
  code_appareil?: string;
  date_expiration?: string;
  created_at: string;
  technicien?: { prenom: string; nom: string };
}

export function GEDAscenseurs({ 
  codeAppareil,
  readOnly = false,
  compact = false
}: { 
  codeAppareil: string;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categorieFilter, setCategorieFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents-ascenseur', codeAppareil],
    queryFn: async () => {
      const { data: docsDirect } = await supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .eq('code_appareil', codeAppareil)
        .order('created_at', { ascending: false });

      const { data: docsIndirect } = await supabase
        .from('documents')
        .select('*, technicien:techniciens(prenom, nom)')
        .or(`nom.ilike.%${codeAppareil}%,description.ilike.%${codeAppareil}%`)
        .order('created_at', { ascending: false });

      const allDocs = [...(docsDirect || []), ...(docsIndirect || [])];
      return allDocs.filter((doc, i, self) => i === self.findIndex(d => d.id === doc.id)) as DocumentGED[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const unlinkMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.from('documents').update({ code_appareil: null }).eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-ascenseur', codeAppareil] });
      toast.success('Document délié');
    },
  });

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc => {
      const matchSearch = !searchTerm || doc.nom?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categorieFilter === 'all' || doc.categorie === categorieFilter;
      return matchSearch && matchCat;
    });
  }, [documents, searchTerm, categorieFilter]);

  const categories = useMemo(() => Array.from(new Set(documents?.map(d => d.categorie).filter(Boolean) || [])), [documents]);

  const isExpired = (doc: DocumentGED) => doc.date_expiration && isBefore(parseISO(doc.date_expiration), new Date());
  const isExpiringSoon = (doc: DocumentGED) => {
    if (!doc.date_expiration) return false;
    const exp = parseISO(doc.date_expiration);
    return isAfter(exp, new Date()) && isBefore(exp, addDays(new Date(), 30));
  };

  const getFileIcon = (type: string) => {
    if (type?.includes('image')) return <Image className="w-4 h-4 text-green-400" />;
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (type?.includes('sheet') || type?.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-blue-400" />;
  };

  if (isLoading) return <div className="flex items-center justify-center p-4"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  if (compact) {
    const expiredCount = documents?.filter(isExpired).length || 0;
    const expiringCount = documents?.filter(isExpiringSoon).length || 0;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2"><FolderOpen className="w-4 h-4 text-blue-400" />Documents</span>
          <Badge variant="blue">{documents?.length || 0}</Badge>
        </div>
        {(expiredCount > 0 || expiringCount > 0) && (
          <div className="flex gap-2 text-xs">
            {expiredCount > 0 && <Badge variant="red">{expiredCount} expiré{expiredCount > 1 ? 's' : ''}</Badge>}
            {expiringCount > 0 && <Badge variant="amber">{expiringCount} bientôt</Badge>}
          </div>
        )}
        <div className="space-y-1 max-h-40 overflow-auto">
          {filteredDocs.slice(0, 5).map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-1.5 bg-[var(--bg-tertiary)] rounded text-xs">
              {getFileIcon(doc.type)}<span className="flex-1 truncate">{doc.nom}</span>{isExpired(doc) && <span className="text-red-400">!</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-blue-400" /><h3 className="font-semibold text-[var(--text-primary)]">Documents liés</h3><Badge variant="blue">{documents?.length || 0}</Badge></div>
        <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><RefreshCw className="w-4 h-4 text-[var(--text-muted)]" /></button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm" />
        </div>
        <select value={categorieFilter} onChange={e => setCategorieFilter(e.target.value)} className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm">
          <option value="all">Toutes</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {documents && documents.some(d => isExpired(d) || isExpiringSoon(d)) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2"><AlertTriangle className="w-4 h-4" />Documents à renouveler</div>
          <div className="space-y-1">
            {documents.filter(isExpired).map(doc => (<div key={doc.id} className="flex items-center justify-between text-xs"><span className="text-red-400 truncate">{doc.nom}</span><Badge variant="red">Expiré</Badge></div>))}
            {documents.filter(isExpiringSoon).map(doc => (<div key={doc.id} className="flex items-center justify-between text-xs"><span className="text-amber-400 truncate">{doc.nom}</span><Badge variant="amber">J-{differenceInDays(parseISO(doc.date_expiration!), new Date())}</Badge></div>))}
          </div>
        </div>
      )}

      {filteredDocs.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]"><FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Aucun document lié</p></div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map(doc => (
            <div key={doc.id} className={`p-3 rounded-xl border ${isExpired(doc) ? 'bg-red-500/10 border-red-500/30' : isExpiringSoon(doc) ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}`}>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[var(--bg-secondary)] rounded-lg">{getFileIcon(doc.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="font-medium text-[var(--text-primary)] truncate">{doc.nom}</p>{doc.categorie && <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">{doc.categorie}</span>}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]"><span>{format(parseISO(doc.created_at), 'd MMM yyyy', { locale: fr })}</span>{doc.taille && <span>{(doc.taille / 1024).toFixed(0)} Ko</span>}</div>
                  {doc.date_expiration && <p className={`text-xs mt-1 ${isExpired(doc) ? 'text-red-400' : isExpiringSoon(doc) ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}`}>{isExpired(doc) ? 'Expiré le' : 'Expire le'} {format(parseISO(doc.date_expiration), 'd MMM yyyy', { locale: fr })}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <a href={doc.fichier_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-blue-400"><ExternalLink className="w-4 h-4" /></a>
                  <a href={doc.fichier_url} download className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-green-400"><Download className="w-4 h-4" /></a>
                  {!readOnly && doc.code_appareil === codeAppareil && <button onClick={() => unlinkMutation.mutate(doc.id)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-red-400"><XCircle className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// =============================================
// 2. CHAÎNE D'APPROVISIONNEMENT
// =============================================

export function ChaineApprovisionnement({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<'flux' | 'articles' | 'commandes'>('flux');

  const { data, isLoading } = useQuery({
    queryKey: ['chaine-approvisionnement'],
    queryFn: async () => {
      const [{ data: articles }, { data: travaux }, { data: commandes }] = await Promise.all([
        supabase.from('stock_articles').select('id, designation, reference, quantite_stock, seuil_alerte'),
        supabase.from('travaux').select('id, code, titre, code_appareil, pieces, statut').in('statut', ['planifie', 'en_cours']).not('pieces', 'is', null),
        supabase.from('commandes').select('*, fournisseur:fournisseurs(nom)').in('statut', ['en_attente', 'commandee', 'en_transit']),
      ]);

      const ruptures = articles?.filter(a => a.quantite_stock === 0) || [];
      const alertes = articles?.filter(a => a.quantite_stock > 0 && a.quantite_stock <= (a.seuil_alerte || 5)) || [];
      const travauxBloques = travaux?.filter(t => {
        const pieces = t.pieces as any[];
        return pieces?.some(p => { const art = articles?.find(a => a.id === p.article_id); return art && art.quantite_stock < (p.quantite || 1); });
      }) || [];

      return { articles: articles || [], ruptures, alertes, travauxBloques, commandes: commandes || [], stats: { totalArticles: articles?.length || 0, ruptures: ruptures.length, alertes: alertes.length, travauxBloques: travauxBloques.length, commandesEnCours: commandes?.length || 0 } };
    },
    refetchInterval: 2 * 60 * 1000,
  });

  if (isLoading) return <div className="flex items-center justify-center p-4"><div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2"><Truck className="w-4 h-4 text-orange-400" /><span className="font-semibold text-sm">Approvisionnement</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-center"><p className="text-lg font-bold text-red-400">{data?.stats.ruptures}</p><p className="text-[10px] text-[var(--text-muted)]">Ruptures</p></div>
          <div className="p-2 bg-amber-500/10 rounded-lg text-center"><p className="text-lg font-bold text-amber-400">{data?.stats.alertes}</p><p className="text-[10px] text-[var(--text-muted)]">Alertes</p></div>
          <div className="p-2 bg-orange-500/10 rounded-lg text-center"><p className="text-lg font-bold text-orange-400">{data?.stats.travauxBloques}</p><p className="text-[10px] text-[var(--text-muted)]">Bloqués</p></div>
          <div className="p-2 bg-blue-500/10 rounded-lg text-center"><p className="text-lg font-bold text-blue-400">{data?.stats.commandesEnCours}</p><p className="text-[10px] text-[var(--text-muted)]">Commandes</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-orange-400" /><h3 className="font-semibold text-[var(--text-primary)]">Chaîne d'approvisionnement</h3></div>

      <div className="grid grid-cols-5 gap-2">
        {[{ l: 'Articles', v: data?.stats.totalArticles, c: 'blue' }, { l: 'Ruptures', v: data?.stats.ruptures, c: 'red' }, { l: 'Alertes', v: data?.stats.alertes, c: 'amber' }, { l: 'Bloqués', v: data?.stats.travauxBloques, c: 'orange' }, { l: 'Commandes', v: data?.stats.commandesEnCours, c: 'green' }].map(s => (
          <div key={s.l} className={`p-3 rounded-xl bg-${s.c}-500/10 text-center`}><p className={`text-xl font-bold text-${s.c}-400`}>{s.v || 0}</p><p className="text-[10px] text-[var(--text-muted)]">{s.l}</p></div>
        ))}
      </div>

      <div className="flex gap-2">
        {[{ id: 'flux', l: 'Vue flux' }, { id: 'articles', l: 'Articles critiques' }, { id: 'commandes', l: 'Commandes' }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)} className={`px-3 py-1.5 rounded-lg text-sm ${view === t.id ? 'bg-orange-500/20 text-orange-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>{t.l}</button>
        ))}
      </div>

      {view === 'flux' && (
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center p-4 bg-[var(--bg-secondary)] rounded-xl"><Package className="w-8 h-8 mx-auto mb-2 text-blue-400" /><p className="text-lg font-bold">{data?.stats.totalArticles}</p><p className="text-xs text-[var(--text-muted)]">Stock</p></div>
            <ArrowRight className="w-6 h-6 text-[var(--text-muted)]" />
            <div className="flex-1 text-center p-4 bg-[var(--bg-secondary)] rounded-xl"><Wrench className="w-8 h-8 mx-auto mb-2 text-orange-400" /><p className="text-lg font-bold">{data?.travauxBloques.length}</p><p className="text-xs text-[var(--text-muted)]">Bloqués</p></div>
            <ArrowRight className="w-6 h-6 text-[var(--text-muted)]" />
            <div className="flex-1 text-center p-4 bg-[var(--bg-secondary)] rounded-xl"><Truck className="w-8 h-8 mx-auto mb-2 text-green-400" /><p className="text-lg font-bold">{data?.stats.commandesEnCours}</p><p className="text-xs text-[var(--text-muted)]">Commandes</p></div>
          </div>
        </div>
      )}

      {view === 'articles' && (
        <div className="space-y-2 max-h-96 overflow-auto">
          {data?.ruptures.map(a => (<div key={a.id} className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex justify-between"><div><p className="font-semibold">{a.designation}</p>{a.reference && <p className="text-xs font-mono text-[var(--text-muted)]">{a.reference}</p>}</div><Badge variant="red">Rupture</Badge></div>))}
          {data?.alertes.map(a => (<div key={a.id} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between"><div><p className="font-semibold">{a.designation}</p>{a.reference && <p className="text-xs font-mono text-[var(--text-muted)]">{a.reference}</p>}</div><Badge variant="amber">Stock: {a.quantite_stock}</Badge></div>))}
        </div>
      )}

      {view === 'commandes' && (
        <div className="space-y-2 max-h-96 overflow-auto">
          {data?.commandes.map(c => (<div key={c.id} className={`p-3 rounded-xl border ${c.statut === 'en_transit' ? 'bg-amber-500/10' : 'bg-blue-500/10'} border-[var(--border-primary)]`}><div className="flex justify-between"><div><p className="font-mono font-bold">{c.code}</p><p className="text-xs text-[var(--text-muted)]">{c.fournisseur?.nom}</p></div><Badge variant={c.statut === 'en_transit' ? 'amber' : 'blue'}>{c.statut?.replace('_', ' ')}</Badge></div></div>))}
        </div>
      )}
    </div>
  );
}


// =============================================
// 3. ALERTES ENTRETIEN
// =============================================

interface AlerteEntretien {
  id: string; type: 'vehicule' | 'ascenseur'; code: string; nom: string;
  typeAlerte: 'ct' | 'vidange' | 'visite' | 'controle';
  dateEcheance?: string; kmRestant?: number; urgence: 'critique' | 'haute' | 'moyenne' | 'basse'; details?: string;
}

export function AlertesEntretien({ showVehicules = true, showAscenseurs = true, compact = false }: { showVehicules?: boolean; showAscenseurs?: boolean; compact?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'vehicule' | 'ascenseur'>('all');

  const { data: alertes, isLoading } = useQuery({
    queryKey: ['alertes-entretien', showVehicules, showAscenseurs],
    queryFn: async () => {
      const alertes: AlerteEntretien[] = [];

      if (showVehicules) {
        const { data: vehicules } = await supabase.from('vehicules').select('*, technicien:techniciens(prenom, nom)');
        vehicules?.forEach(v => {
          if (v.date_prochain_ct) {
            const j = differenceInDays(parseISO(v.date_prochain_ct), new Date());
            if (j <= 60) alertes.push({ id: `ct-${v.id}`, type: 'vehicule', code: v.immatriculation, nom: `${v.marque} ${v.modele}`, typeAlerte: 'ct', dateEcheance: v.date_prochain_ct, urgence: j <= 0 ? 'critique' : j <= 15 ? 'haute' : j <= 30 ? 'moyenne' : 'basse', details: v.technicien ? `${v.technicien.prenom} ${v.technicien.nom}` : undefined });
          }
          if (v.prochain_entretien_km && v.kilometrage) {
            const km = v.prochain_entretien_km - v.kilometrage;
            if (km <= 1000) alertes.push({ id: `vidange-${v.id}`, type: 'vehicule', code: v.immatriculation, nom: `${v.marque} ${v.modele}`, typeAlerte: 'vidange', kmRestant: km, urgence: km <= 0 ? 'critique' : km <= 200 ? 'haute' : km <= 500 ? 'moyenne' : 'basse', details: `${v.kilometrage?.toLocaleString()} km` });
          }
        });
      }

      if (showAscenseurs) {
        const { data: visites } = await supabase.from('parc_visites').select('code_appareil, date_visite').order('date_visite', { ascending: false });
        const dern = new Map<string, string>(); visites?.forEach(v => { if (!dern.has(v.code_appareil)) dern.set(v.code_appareil, v.date_visite); });
        const { data: asc } = await supabase.from('parc_ascenseurs').select('code_appareil, adresse, ville').not('type_planning', 'is', null);
        asc?.forEach(a => {
          const d = dern.get(a.code_appareil);
          if (d) { const j = differenceInDays(new Date(), parseISO(d)); if (j >= 45) alertes.push({ id: `visite-${a.code_appareil}`, type: 'ascenseur', code: a.code_appareil, nom: `${a.adresse}, ${a.ville}`, typeAlerte: 'visite', dateEcheance: d, urgence: j >= 90 ? 'critique' : j >= 60 ? 'haute' : 'moyenne', details: `Dernière: ${format(parseISO(d), 'd MMM', { locale: fr })}` }); }
        });
      }

      return alertes.sort((a, b) => ({ critique: 0, haute: 1, moyenne: 2, basse: 3 })[a.urgence] - ({ critique: 0, haute: 1, moyenne: 2, basse: 3 })[b.urgence]);
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => !alertes ? [] : filter === 'all' ? alertes : alertes.filter(a => a.type === filter), [alertes, filter]);
  const uCfg = { critique: { l: 'Critique', c: 'text-red-400', bg: 'bg-red-500/10', bd: 'border-red-500/30' }, haute: { l: 'Haute', c: 'text-orange-400', bg: 'bg-orange-500/10', bd: 'border-orange-500/30' }, moyenne: { l: 'Moyenne', c: 'text-amber-400', bg: 'bg-amber-500/10', bd: 'border-amber-500/30' }, basse: { l: 'Basse', c: 'text-blue-400', bg: 'bg-blue-500/10', bd: 'border-blue-500/30' } };
  const tCfg = { ct: { l: 'CT', i: Shield }, vidange: { l: 'Vidange', i: Settings }, visite: { l: 'Visite', i: Calendar }, controle: { l: 'Contrôle', i: CheckCircle2 } };

  if (isLoading) return <div className="flex items-center justify-center p-4"><div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" /></div>;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /><span className="font-semibold text-sm">Entretiens</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-center"><p className="text-lg font-bold text-red-400">{alertes?.filter(a => a.urgence === 'critique').length || 0}</p><p className="text-[10px] text-[var(--text-muted)]">Critiques</p></div>
          <div className="p-2 bg-orange-500/10 rounded-lg text-center"><p className="text-lg font-bold text-orange-400">{alertes?.filter(a => a.urgence === 'haute').length || 0}</p><p className="text-[10px] text-[var(--text-muted)]">Hautes</p></div>
        </div>
        <div className="space-y-1 max-h-32 overflow-auto">{filtered.slice(0, 3).map(a => (<div key={a.id} className={`p-2 rounded text-xs ${uCfg[a.urgence].bg}`}><span className="font-mono">{a.code}</span> - {tCfg[a.typeAlerte].l}</div>))}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell className="w-5 h-5 text-amber-400" /><h3 className="font-semibold text-[var(--text-primary)]">Alertes entretien</h3></div><Badge variant={alertes && alertes.length > 0 ? 'amber' : 'green'}>{alertes?.length || 0}</Badge></div>
      <div className="flex gap-2">{['all', 'vehicule', 'ascenseur'].map(f => (<button key={f} onClick={() => setFilter(f as any)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>{f === 'all' ? 'Tous' : f === 'vehicule' ? 'Véhicules' : 'Ascenseurs'}</button>))}</div>
      <div className="grid grid-cols-4 gap-2">{Object.entries(uCfg).map(([k, c]) => (<div key={k} className={`p-2 rounded-lg text-center ${c.bg}`}><p className={`text-lg font-bold ${c.c}`}>{alertes?.filter(a => a.urgence === k).length || 0}</p><p className="text-[10px] text-[var(--text-muted)]">{c.l}</p></div>))}</div>
      {filtered.length === 0 ? <div className="text-center py-6 text-[var(--text-muted)]"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" /><p>Aucune alerte</p></div> : (
        <div className="space-y-2 max-h-96 overflow-auto">
          {filtered.map(a => { const cfg = uCfg[a.urgence]; const tc = tCfg[a.typeAlerte]; const Icon = tc.i; return (
            <div key={a.id} className={`p-3 rounded-xl border ${cfg.bg} ${cfg.bd}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg}`}>{a.type === 'vehicule' ? <Car className={`w-5 h-5 ${cfg.c}`} /> : <Building2 className={`w-5 h-5 ${cfg.c}`} />}</div>
                <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-mono font-bold">{a.code}</span><span className={`text-[10px] px-2 py-0.5 rounded ${cfg.bg} ${cfg.c}`}>{cfg.l}</span></div><p className="text-sm text-[var(--text-secondary)]">{a.nom}</p><div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]"><Icon className="w-3 h-3" /><span>{tc.l}</span>{a.dateEcheance && <span className={cfg.c}>{differenceInDays(parseISO(a.dateEcheance), new Date()) <= 0 ? 'Dépassé!' : `J-${differenceInDays(parseISO(a.dateEcheance), new Date())}`}</span>}{a.kmRestant !== undefined && <span className={cfg.c}>{a.kmRestant <= 0 ? 'Dépassé!' : `${a.kmRestant} km`}</span>}</div></div>
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}


// =============================================
// 4. NOTES CONTEXTUELLES
// =============================================

export function NotesContextuelles({ codeAppareil, travauxId, limit = 10, allowCreate = false, compact = false }: { codeAppareil?: string; travauxId?: string; limit?: number; allowCreate?: boolean; compact?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState({ titre: '', contenu: '' });
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes-contextuelles', codeAppareil, travauxId],
    queryFn: async () => {
      let all: any[] = [];
      if (codeAppareil) { const { data } = await supabase.from('notes').select('*, technicien:technicien_id(prenom, nom)').eq('partage', true).or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%,titre.ilike.%${codeAppareil}%`).order('created_at', { ascending: false }).limit(limit); all = [...all, ...(data || [])]; }
      if (travauxId) { const { data } = await supabase.from('notes').select('*, technicien:technicien_id(prenom, nom)').eq('travaux_id', travauxId).order('created_at', { ascending: false }); all = [...all, ...(data || [])]; }
      return all.filter((n, i, s) => i === s.findIndex(x => x.id === n.id)).slice(0, limit);
    },
    enabled: !!codeAppareil || !!travauxId,
  });

  const createMutation = useMutation({
    mutationFn: async (note: { titre: string; contenu: string }) => { const { error } = await supabase.from('notes').insert({ ...note, code_ascenseur: codeAppareil, travaux_id: travauxId, partage: true }); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notes-contextuelles'] }); setShowForm(false); setNewNote({ titre: '', contenu: '' }); toast.success('Note créée'); },
  });

  const cat = useMemo(() => {
    if (!notes) return { imp: [], rec: [], aut: [] };
    const now = new Date();
    const imp = notes.filter(n => n.important || n.titre?.toLowerCase().includes('urgent'));
    const rec = notes.filter(n => differenceInDays(now, parseISO(n.created_at)) <= 7 && !imp.includes(n));
    return { imp, rec, aut: notes.filter(n => !imp.includes(n) && !rec.includes(n)) };
  }, [notes]);

  if (isLoading) return <div className="animate-pulse h-20 bg-[var(--bg-tertiary)] rounded-xl" />;

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-purple-400" />Notes</span><Badge variant="purple">{notes?.length || 0}</Badge></div>
        <div className="space-y-1 max-h-32 overflow-auto">{notes?.slice(0, 3).map(n => (<div key={n.id} className={`p-2 rounded text-xs ${n.important ? 'bg-amber-500/10' : 'bg-[var(--bg-tertiary)]'}`}><p className="font-semibold truncate">{n.titre}</p><p className="text-[var(--text-muted)] line-clamp-1">{n.contenu}</p></div>))}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-400" /><span className="font-semibold text-sm">Notes liées</span><Badge variant="purple">{notes?.length || 0}</Badge></div>{allowCreate && <button onClick={() => setShowForm(!showForm)} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-purple-400"><Plus className="w-4 h-4" /></button>}</div>
      {showForm && (<div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-purple-500/30"><input type="text" placeholder="Titre..." value={newNote.titre} onChange={e => setNewNote({ ...newNote, titre: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm mb-2" /><textarea placeholder="Contenu..." value={newNote.contenu} onChange={e => setNewNote({ ...newNote, contenu: e.target.value })} className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm resize-none" rows={3} /><div className="flex justify-end gap-2 mt-2"><button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-[var(--text-muted)]">Annuler</button><button onClick={() => createMutation.mutate(newNote)} disabled={!newNote.titre || !newNote.contenu} className="px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 rounded-lg disabled:opacity-50">Créer</button></div></div>)}
      {!notes || notes.length === 0 ? <div className="text-center py-4 text-[var(--text-muted)] text-sm"><FileText className="w-6 h-6 mx-auto mb-1 opacity-30" /><p>Aucune note liée</p></div> : (
        <div className="space-y-2 max-h-80 overflow-auto">
          {cat.imp.map(n => (<div key={n.id} className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg"><div className="flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3 text-amber-400" /><p className="text-sm font-semibold text-amber-400">{n.titre}</p></div><p className="text-xs text-[var(--text-muted)] line-clamp-2">{n.contenu}</p></div>))}
          {cat.rec.map(n => (<div key={n.id} className="p-2 bg-blue-500/10 rounded-lg"><div className="flex justify-between"><p className="text-sm font-semibold">{n.titre}</p><span className="text-[10px] text-blue-400">{format(parseISO(n.created_at), 'd MMM', { locale: fr })}</span></div><p className="text-xs text-[var(--text-muted)] line-clamp-2">{n.contenu}</p></div>))}
          {cat.aut.map(n => (<div key={n.id} className="p-2 bg-[var(--bg-tertiary)] rounded-lg"><div className="flex justify-between"><p className="text-sm font-semibold">{n.titre}</p><span className="text-[10px] text-[var(--text-tertiary)]">{format(parseISO(n.created_at), 'd MMM', { locale: fr })}</span></div><p className="text-xs text-[var(--text-muted)] line-clamp-2">{n.contenu}</p></div>))}
        </div>
      )}
    </div>
  );
}


// =============================================
// WIDGETS DASHBOARD
// =============================================

export function GEDWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({ queryKey: ['ged-widget'], queryFn: async () => {
    const now = new Date().toISOString(), in30 = addDays(new Date(), 30).toISOString();
    const [{ data: exp }, { data: expg }, { data: tot }] = await Promise.all([supabase.from('documents').select('id').not('code_appareil', 'is', null).lt('date_expiration', now), supabase.from('documents').select('id').not('code_appareil', 'is', null).gte('date_expiration', now).lte('date_expiration', in30), supabase.from('documents').select('id').not('code_appareil', 'is', null)]);
    return { expired: exp?.length || 0, expiring: expg?.length || 0, total: tot?.length || 0 };
  }});
  return (<Card className="h-full"><CardBody className="p-3"><div className="flex items-center gap-2 mb-3"><FolderOpen className="w-4 h-4 text-blue-400" /><span className="font-semibold text-sm">Docs ascenseurs</span></div><div className="grid grid-cols-3 gap-2"><div className="text-center p-2 bg-blue-500/10 rounded-lg"><p className="text-lg font-bold text-blue-400">{data?.total}</p><p className="text-[10px] text-[var(--text-muted)]">Liés</p></div><div className="text-center p-2 bg-amber-500/10 rounded-lg"><p className="text-lg font-bold text-amber-400">{data?.expiring}</p><p className="text-[10px] text-[var(--text-muted)]">Bientôt</p></div><div className="text-center p-2 bg-red-500/10 rounded-lg"><p className="text-lg font-bold text-red-400">{data?.expired}</p><p className="text-[10px] text-[var(--text-muted)]">Expirés</p></div></div></CardBody></Card>);
}

export function AlertesEntretienWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({ queryKey: ['alertes-entretien-widget'], queryFn: async () => {
    const { data: v } = await supabase.from('vehicules').select('date_prochain_ct, prochain_entretien_km, kilometrage');
    let ct = 0, vid = 0; v?.forEach(x => { if (x.date_prochain_ct && differenceInDays(parseISO(x.date_prochain_ct), new Date()) <= 30) ct++; if (x.prochain_entretien_km && x.kilometrage && (x.prochain_entretien_km - x.kilometrage) <= 500) vid++; });
    const { data: vis } = await supabase.from('parc_visites').select('code_appareil, date_visite').order('date_visite', { ascending: false });
    const d = new Map<string, string>(); vis?.forEach(x => { if (!d.has(x.code_appareil)) d.set(x.code_appareil, x.date_visite); });
    let ret = 0; d.forEach(x => { if (differenceInDays(new Date(), parseISO(x)) >= 45) ret++; });
    return { ct, vid, ret };
  }});
  return (<Card className="h-full"><CardBody className="p-3"><div className="flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-amber-400" /><span className="font-semibold text-sm">Entretiens</span></div><div className="space-y-2"><div className="flex justify-between text-sm"><span className="flex items-center gap-2 text-[var(--text-muted)]"><Shield className="w-3 h-3" />CT</span><Badge variant={data?.ct ? 'red' : 'green'}>{data?.ct || 0}</Badge></div><div className="flex justify-between text-sm"><span className="flex items-center gap-2 text-[var(--text-muted)]"><Settings className="w-3 h-3" />Vidanges</span><Badge variant={data?.vid ? 'orange' : 'green'}>{data?.vid || 0}</Badge></div><div className="flex justify-between text-sm"><span className="flex items-center gap-2 text-[var(--text-muted)]"><Calendar className="w-3 h-3" />Visites</span><Badge variant={data?.ret ? 'amber' : 'green'}>{data?.ret || 0}</Badge></div></div></CardBody></Card>);
}

export function ChaineApproWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({ queryKey: ['chaine-appro-widget'], queryFn: async () => {
    const { data: a } = await supabase.from('stock_articles').select('quantite_stock, seuil_alerte');
    const { data: c } = await supabase.from('commandes').select('id').in('statut', ['en_attente', 'commandee', 'en_transit']);
    return { ruptures: a?.filter(x => x.quantite_stock === 0).length || 0, alertes: a?.filter(x => x.quantite_stock > 0 && x.quantite_stock <= (x.seuil_alerte || 5)).length || 0, commandes: c?.length || 0 };
  }});
  return (<Card className="h-full"><CardBody className="p-3"><div className="flex items-center gap-2 mb-3"><Truck className="w-4 h-4 text-orange-400" /><span className="font-semibold text-sm">Appro</span></div><div className="space-y-1.5"><div className="flex justify-between text-sm"><span className="text-[var(--text-muted)]">Ruptures</span><Badge variant="red">{data?.ruptures}</Badge></div><div className="flex justify-between text-sm"><span className="text-[var(--text-muted)]">Alertes</span><Badge variant="orange">{data?.alertes}</Badge></div><div className="flex justify-between text-sm"><span className="text-[var(--text-muted)]">Commandes</span><Badge variant="blue">{data?.commandes}</Badge></div></div></CardBody></Card>);
}
