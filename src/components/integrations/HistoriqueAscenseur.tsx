import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, Clock, Wrench, AlertTriangle, FileText, Route, Calendar,
  TrendingUp, Package, Euro, ChevronDown, ChevronRight, Phone,
  MapPin, Building2, Download, Eye, BarChart3, History
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HistoriqueAscenseurProps {
  ascenseur: {
    id?: string;
    id_wsoucont?: number;
    code_appareil: string;
    adresse: string;
    ville: string;
    code_postal?: string;
    secteur?: number;
    marque?: string;
    modele?: string;
    type_planning?: string;
    nb_visites_an?: number;
    tel_cabine?: string;
    dernier_passage?: string;
  };
  onClose: () => void;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'visite' | 'panne' | 'arret' | 'travaux' | 'mes' | 'document' | 'pieces_remplacees';
  titre: string;
  description?: string;
  technicien?: string;
  duree?: number;
  pieces?: { designation: string; quantite: number; prix?: number }[];
  statut?: string;
  cout?: number;
}

// Récupérer l'historique complet d'un ascenseur
async function getHistoriqueAscenseur(codeAppareil: string, idWsoucont?: number): Promise<{
  timeline: TimelineEvent[];
  stats: {
    visites: number;
    pannes: number;
    travaux: number;
    piecesRemplacees: number;
    coutTotal: number;
    piecesUtilisees: { designation: string; quantite: number }[];
  };
}> {
  const timeline: TimelineEvent[] = [];
  let coutTotal = 0;
  const piecesMap: Record<string, number> = {};

  // 1. Pannes depuis parc_pannes
  if (idWsoucont) {
    const { data: pannes } = await supabase
      .from('parc_pannes')
      .select('*')
      .eq('id_wsoucont', idWsoucont)
      .order('date_appel', { ascending: false })
      .limit(50);

    (pannes || []).forEach((p: any) => {
      timeline.push({
        id: `panne-${p.id}`,
        date: p.date_appel,
        type: 'panne',
        titre: `Panne #${p.id_panne || p.id.slice(0, 8)}`,
        description: p.motif || p.cause,
        technicien: p.depanneur,
        duree: p.duree_minutes,
        statut: p.etat,
      });
    });
  }

  // 2. Arrêts depuis parc_arrets
  if (idWsoucont) {
    const { data: arrets } = await supabase
      .from('parc_arrets')
      .select('*')
      .eq('id_wsoucont', idWsoucont)
      .order('date_appel', { ascending: false })
      .limit(50);

    (arrets || []).forEach((a: any) => {
      timeline.push({
        id: `arret-${a.id}`,
        date: a.date_appel,
        type: 'arret',
        titre: `Arrêt signalé`,
        description: a.motif,
        technicien: a.demandeur,
      });
    });
  }

  // 3. Travaux liés à l'ascenseur
  const { data: travaux } = await supabase
    .from('travaux')
    .select(`
      *,
      technicien:technicien_id(prenom, nom),
      pieces:travaux_pieces(designation, quantite, prix_unitaire)
    `)
    .or(`code.ilike.%${codeAppareil}%,description.ilike.%${codeAppareil}%`)
    .order('created_at', { ascending: false })
    .limit(30);

  (travaux || []).forEach((t: any) => {
    const pieces = t.pieces || [];
    const coutPieces = pieces.reduce((acc: number, p: any) => acc + (p.prix_unitaire || 0) * p.quantite, 0);
    coutTotal += coutPieces;

    pieces.forEach((p: any) => {
      piecesMap[p.designation] = (piecesMap[p.designation] || 0) + p.quantite;
    });

    timeline.push({
      id: `travaux-${t.id}`,
      date: t.date_debut || t.created_at,
      type: 'travaux',
      titre: `Travaux ${t.code}`,
      description: t.titre || t.description,
      technicien: t.technicien ? `${t.technicien.prenom} ${t.technicien.nom}` : undefined,
      pieces: pieces.map((p: any) => ({ designation: p.designation, quantite: p.quantite, prix: p.prix_unitaire })),
      statut: t.statut,
      cout: coutPieces,
    });
  });

  // 4. Mises en service
  const { data: mes } = await supabase
    .from('mise_en_service')
    .select('*, technicien:technicien_id(prenom, nom)')
    .or(`code.ilike.%${codeAppareil}%,description.ilike.%${codeAppareil}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  (mes || []).forEach((m: any) => {
    timeline.push({
      id: `mes-${m.id}`,
      date: m.date_mes || m.created_at,
      type: 'mes',
      titre: `MES ${m.code}`,
      description: m.type_mes || m.description,
      technicien: m.technicien ? `${m.technicien.prenom} ${m.technicien.nom}` : undefined,
      statut: m.statut,
    });
  });

  // 5. Documents liés
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .ilike('tags', `%${codeAppareil}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  (documents || []).forEach((d: any) => {
    timeline.push({
      id: `doc-${d.id}`,
      date: d.created_at,
      type: 'document',
      titre: d.nom,
      description: d.categorie,
    });
  });

  // 6. Visites depuis planning_events (type tournee)
  const { data: visites } = await supabase
    .from('planning_events')
    .select('*, technicien:technicien_id(prenom, nom)')
    .eq('type_event', 'tournee')
    .ilike('description', `%${codeAppareil}%`)
    .order('date_debut', { ascending: false })
    .limit(30);

  (visites || []).forEach((v: any) => {
    timeline.push({
      id: `visite-${v.id}`,
      date: v.date_debut,
      type: 'visite',
      titre: v.titre || 'Visite d\'entretien',
      description: v.description,
      technicien: v.technicien ? `${v.technicien.prenom} ${v.technicien.nom}` : undefined,
    });
  });

  // 7. Interventions rapides avec pièces remplacées
  const { data: interventions } = await supabase
    .from('interventions_rapides')
    .select(`
      *,
      technicien:technicien_id(prenom, nom),
      pieces:intervention_pieces(
        quantite,
        article:article_id(designation, reference)
      )
    `)
    .eq('code_appareil', codeAppareil)
    .order('date_intervention', { ascending: false })
    .limit(50);

  (interventions || []).forEach((i: any) => {
    const pieces = (i.pieces || []).map((p: any) => ({
      designation: p.article?.designation || 'Pièce',
      quantite: p.quantite,
    }));

    // Ajouter les pièces au compteur global
    pieces.forEach((p: any) => {
      piecesMap[p.designation] = (piecesMap[p.designation] || 0) + p.quantite;
    });

    if (pieces.length > 0) {
      timeline.push({
        id: `intervention-pieces-${i.id}`,
        date: i.date_intervention,
        type: 'pieces_remplacees' as any,
        titre: `Pièces remplacées`,
        description: i.description || `${pieces.length} pièce(s) remplacée(s)`,
        technicien: i.technicien ? `${i.technicien.prenom} ${i.technicien.nom}` : undefined,
        pieces,
      });
    }
  });

  // 8. Mouvements de stock liés à cet ascenseur (sorties)
  const { data: mouvements } = await supabase
    .from('stock_mouvements')
    .select(`
      *,
      technicien:technicien_id(prenom, nom),
      article:article_id(designation, reference)
    `)
    .eq('code_appareil', codeAppareil)
    .eq('type_mouvement', 'sortie')
    .order('date_mouvement', { ascending: false })
    .limit(50);

  // Grouper les mouvements par date et technicien
  const mouvementsGroupes: Record<string, any[]> = {};
  (mouvements || []).forEach((m: any) => {
    const key = `${m.date_mouvement}_${m.technicien_id}`;
    if (!mouvementsGroupes[key]) {
      mouvementsGroupes[key] = [];
    }
    mouvementsGroupes[key].push(m);
  });

  Object.entries(mouvementsGroupes).forEach(([key, mvts]) => {
    const firstMvt = mvts[0];
    const pieces = mvts.map((m: any) => ({
      designation: m.article?.designation || 'Article',
      quantite: m.quantite,
    }));

    // Ajouter les pièces au compteur global
    pieces.forEach((p: any) => {
      piecesMap[p.designation] = (piecesMap[p.designation] || 0) + p.quantite;
    });

    timeline.push({
      id: `mouvement-${key}`,
      date: firstMvt.date_mouvement,
      type: 'pieces_remplacees' as any,
      titre: `Pièces utilisées`,
      description: firstMvt.motif || `${pieces.length} article(s)`,
      technicien: firstMvt.technicien ? `${firstMvt.technicien.prenom} ${firstMvt.technicien.nom}` : undefined,
      pieces,
    });
  });

  // Trier par date décroissante
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculer les stats
  const stats = {
    visites: timeline.filter(e => e.type === 'visite').length,
    pannes: timeline.filter(e => e.type === 'panne').length,
    travaux: timeline.filter(e => e.type === 'travaux').length,
    piecesRemplacees: timeline.filter(e => e.type === 'pieces_remplacees').length,
    coutTotal,
    piecesUtilisees: Object.entries(piecesMap)
      .map(([designation, quantite]) => ({ designation, quantite }))
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 10),
  };

  return { timeline, stats };
}

// Icône par type d'événement
function EventIcon({ type }: { type: TimelineEvent['type'] }) {
  const icons = {
    visite: <Route className="w-4 h-4 text-lime-400" />,
    panne: <AlertTriangle className="w-4 h-4 text-red-400" />,
    arret: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    travaux: <Wrench className="w-4 h-4 text-purple-400" />,
    mes: <Building2 className="w-4 h-4 text-blue-400" />,
    document: <FileText className="w-4 h-4 text-gray-400" />,
    pieces_remplacees: <Package className="w-4 h-4 text-cyan-400" />,
  };
  return icons[type] || <Clock className="w-4 h-4" />;
}

// Badge par type
function EventBadge({ type }: { type: TimelineEvent['type'] }) {
  const badges: Record<string, { variant: any; label: string }> = {
    visite: { variant: 'green', label: 'Visite' },
    panne: { variant: 'red', label: 'Panne' },
    arret: { variant: 'orange', label: 'Arrêt' },
    travaux: { variant: 'purple', label: 'Travaux' },
    mes: { variant: 'blue', label: 'MES' },
    document: { variant: 'gray', label: 'Document' },
    pieces_remplacees: { variant: 'cyan', label: 'Pièces' },
  };
  const b = badges[type] || { variant: 'gray', label: type };
  return <Badge variant={b.variant} className="text-[10px]">{b.label}</Badge>;
}

// Composant Timeline Event
function TimelineEventCard({ event, isExpanded, onToggle }: { event: TimelineEvent; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="relative pl-8 pb-4">
      {/* Ligne verticale */}
      <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-[var(--border-primary)]" />
      
      {/* Point sur la timeline */}
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-[var(--bg-elevated)] border-2 border-[var(--border-primary)] flex items-center justify-center">
        <EventIcon type={event.type} />
      </div>
      
      {/* Contenu */}
      <div 
        className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <EventBadge type={event.type} />
                <span className="text-xs text-[var(--text-muted)]">
                  {format(parseISO(event.date), 'd MMM yyyy', { locale: fr })}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{event.titre}</h4>
              {event.description && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">{event.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {event.cout && event.cout > 0 && (
                <Badge variant="amber" className="text-[10px]">{event.cout.toFixed(0)}€</Badge>
              )}
              {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
            </div>
          </div>
          
          {/* Détails expandus */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-[var(--border-primary)] space-y-2">
              {event.technicien && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">Technicien:</span>
                  {event.technicien}
                </div>
              )}
              {event.duree && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">Durée:</span>
                  {event.duree} min
                </div>
              )}
              {event.statut && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--text-muted)]">Statut:</span>
                  <Badge variant={event.statut === 'termine' ? 'green' : event.statut === 'en_cours' ? 'blue' : 'gray'} className="text-[10px]">
                    {event.statut}
                  </Badge>
                </div>
              )}
              {event.pieces && event.pieces.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Pièces utilisées:</p>
                  <div className="flex flex-wrap gap-1">
                    {event.pieces.map((p, i) => (
                      <Badge key={i} variant="purple" className="text-[10px]">
                        {p.quantite}x {p.designation}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoriqueAscenseur({ ascenseur, onClose }: HistoriqueAscenseurProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'documents'>('timeline');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['historique-ascenseur', ascenseur.code_appareil],
    queryFn: () => getHistoriqueAscenseur(ascenseur.code_appareil, ascenseur.id_wsoucont),
  });

  const filteredTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    if (filterType === 'all') return data.timeline;
    return data.timeline.filter(e => e.type === filterType);
  }, [data?.timeline, filterType]);

  const toggleEvent = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Grouper par mois
  const timelineByMonth = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    filteredTimeline.forEach(event => {
      const monthKey = format(parseISO(event.date), 'MMMM yyyy', { locale: fr });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(event);
    });
    return groups;
  }, [filteredTimeline]);

  const joursSinceDernierPassage = ascenseur.dernier_passage 
    ? differenceInDays(new Date(), parseISO(ascenseur.dernier_passage))
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-lime-500/20 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-lime-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{ascenseur.code_appareil}</h2>
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {ascenseur.adresse}, {ascenseur.ville}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {ascenseur.type_planning && (
                    <Badge variant="blue">{ascenseur.type_planning}</Badge>
                  )}
                  {ascenseur.secteur && (
                    <Badge variant="purple">Secteur {ascenseur.secteur}</Badge>
                  )}
                  {ascenseur.marque && (
                    <Badge variant="gray">{ascenseur.marque}</Badge>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
              <p className="text-xl font-bold text-lime-400">{data?.stats.visites || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Visites</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
              <p className="text-xl font-bold text-red-400">{data?.stats.pannes || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Pannes</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
              <p className="text-xl font-bold text-purple-400">{data?.stats.travaux || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Travaux</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
              <p className="text-xl font-bold text-amber-400">{(data?.stats.coutTotal || 0).toFixed(0)}€</p>
              <p className="text-[10px] text-[var(--text-muted)]">Coût pièces</p>
            </div>
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
              <p className="text-xl font-bold text-blue-400">{joursSinceDernierPassage ?? '-'}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Jours depuis visite</p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 p-2 border-b border-[var(--border-primary)]">
          {[
            { id: 'timeline', label: 'Chronologie', icon: History },
            { id: 'stats', label: 'Statistiques', icon: BarChart3 },
            { id: 'documents', label: 'Documents', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-lime-500 text-white' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full" />
            </div>
          ) : activeTab === 'timeline' ? (
            <>
              {/* Filtres */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-[var(--text-muted)]">Filtrer:</span>
                {['all', 'visite', 'panne', 'travaux', 'document'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterType === type
                        ? 'bg-lime-500 text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {type === 'all' ? 'Tout' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {Object.entries(timelineByMonth).map(([month, events]) => (
                <div key={month} className="mb-6">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 capitalize flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {month}
                  </h3>
                  <div>
                    {events.map(event => (
                      <TimelineEventCard
                        key={event.id}
                        event={event}
                        isExpanded={expandedEvents.has(event.id)}
                        onToggle={() => toggleEvent(event.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {filteredTimeline.length === 0 && (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun événement dans l'historique</p>
                </div>
              )}
            </>
          ) : activeTab === 'stats' ? (
            <div className="space-y-6">
              {/* Pièces les plus utilisées */}
              <Card>
                <CardBody>
                  <h4 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    Pièces les plus remplacées
                  </h4>
                  {data?.stats.piecesUtilisees && data.stats.piecesUtilisees.length > 0 ? (
                    <div className="space-y-2">
                      {data.stats.piecesUtilisees.map((piece, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg">
                          <span className="text-sm text-[var(--text-secondary)]">{piece.designation}</span>
                          <Badge variant="purple">{piece.quantite}x</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Aucune pièce enregistrée</p>
                  )}
                </CardBody>
              </Card>

              {/* Infos techniques */}
              <Card>
                <CardBody>
                  <h4 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-400" />
                    Informations techniques
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Marque</p>
                      <p className="text-sm font-medium">{ascenseur.marque || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Modèle</p>
                      <p className="text-sm font-medium">{ascenseur.modele || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Contrat</p>
                      <p className="text-sm font-medium">{ascenseur.type_planning || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Visites/an</p>
                      <p className="text-sm font-medium">{ascenseur.nb_visites_an || '-'}</p>
                    </div>
                    {ascenseur.tel_cabine && (
                      <div className="col-span-2">
                        <p className="text-xs text-[var(--text-muted)]">Téléphone cabine</p>
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {ascenseur.tel_cabine}
                        </p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTimeline.filter(e => e.type === 'document').map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{doc.titre}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {format(parseISO(doc.date), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {filteredTimeline.filter(e => e.type === 'document').length === 0 && (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun document lié</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
