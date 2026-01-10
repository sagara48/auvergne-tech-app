import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragStartEvent, DragEndEvent, pointerWithin } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus, Hammer, FileCheck, Route, GripVertical, X, Clock, MapPin, User, Eye, Calendar, Building2, AlertTriangle, Info } from 'lucide-react';
import { Button, Card, CardBody, Badge, Select } from '@/components/ui';
import { getPlanningEvents, createPlanningEvent, updatePlanningEvent, deletePlanningEvent, getTechniciens, getTravauxNonPlanifies, getMESNonPlanifiees, getTourneesActives } from '@/services/api';
import { TYPE_EVENT_COLORS } from '@/types';
import type { PlanningEvent, Travaux, MiseEnService, Tournee, TypeEvent } from '@/types';
import { format, addDays, startOfWeek, parseISO, setHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Composant Draggable pour les éléments de la sidebar
function DraggableItem({ id, type, data, children }: { id: string; type: string; data: any; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type, data },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      {children}
    </div>
  );
}

// Composant Droppable pour les cellules du planning
function DroppableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] p-1 transition-colors ${isOver ? 'bg-blue-500/20 ring-2 ring-blue-500/50 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
}

// Carte d'événement dans le planning
function EventCard({ event, onDelete, onClick }: { event: PlanningEvent; onDelete: () => void; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { type: 'event', data: event },
  });

  const color = event.couleur || TYPE_EVENT_COLORS[event.type_event] || '#6366f1';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative p-2 rounded-lg text-xs mb-1 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02]'}`}
      style={{ background: `${color}25`, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="font-semibold text-[var(--text-primary)] truncate">{event.titre}</div>
          <div className="text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {format(parseISO(event.date_debut), 'HH:mm')} - {format(parseISO(event.date_fin), 'HH:mm')}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/30 rounded transition-opacity"
        >
          <X className="w-3 h-3 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// Modal de détail pour Travaux (lecture seule)
function TravauxDetailModal({ travaux, onClose }: { travaux: Travaux; onClose: () => void }) {
  const prioriteColors: Record<string, string> = { basse: 'gray', normale: 'blue', haute: 'amber', urgente: 'red' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Hammer className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{travaux.code}</div>
                <div className="text-sm text-[var(--text-tertiary)]">Travaux</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{travaux.titre}</h3>
              {travaux.description && <p className="text-sm text-[var(--text-tertiary)]">{travaux.description}</p>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={prioriteColors[travaux.priorite] as any}>{travaux.priorite}</Badge>
              <Badge variant={travaux.statut === 'en_cours' ? 'amber' : 'blue'}>{travaux.statut.replace('_', ' ')}</Badge>
              <Badge variant="purple">{travaux.type_travaux.replace('_', ' ')}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              {travaux.client && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Client</div>
                    <div className="text-sm text-[var(--text-primary)]">{travaux.client.raison_sociale}</div>
                  </div>
                </div>
              )}
              {travaux.ascenseur && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Ascenseur</div>
                    <div className="text-sm text-[var(--text-primary)]">{travaux.ascenseur.code}</div>
                  </div>
                </div>
              )}
              {travaux.technicien && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Technicien</div>
                    <div className="text-sm text-[var(--text-primary)]">{travaux.technicien.prenom} {travaux.technicien.nom}</div>
                  </div>
                </div>
              )}
              {travaux.devis_montant && (
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Devis</div>
                    <div className="text-sm text-[var(--text-primary)]">{travaux.devis_montant.toFixed(2)} €</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-tertiary)]">Progression</span>
                <span className="text-lg font-bold text-[var(--text-primary)]">{travaux.progression}%</span>
              </div>
              <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${travaux.progression}%` }} />
              </div>
            </div>

            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-sm text-purple-300 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Glissez-déposez cet élément sur le planning pour le planifier
            </div>

            <Button variant="secondary" className="w-full" onClick={onClose}>Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal de détail pour MES (lecture seule)
function MESDetailModal({ mes, onClose }: { mes: MiseEnService; onClose: () => void }) {
  const ETAPES = [
    { num: 1, label: 'Préparation', field: 'etape1_preparation' },
    { num: 2, label: 'Vérif. élec.', field: 'etape2_verification_electrique' },
    { num: 3, label: 'Vérif. méca.', field: 'etape3_verification_mecanique' },
    { num: 4, label: 'Essais vide', field: 'etape4_essais_vide' },
    { num: 5, label: 'Essais charge', field: 'etape5_essais_charge' },
    { num: 6, label: 'Sécurités', field: 'etape6_securites' },
    { num: 7, label: 'Validation', field: 'etape7_validation' },
  ];

  const completedSteps = ETAPES.filter(e => (mes as any)[e.field]).length;
  const progress = Math.round((completedSteps / 7) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">{mes.code}</div>
                <div className="text-sm text-[var(--text-tertiary)]">Mise en service</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={mes.statut === 'en_cours' ? 'amber' : mes.statut === 'termine' ? 'green' : 'blue'}>
                {mes.statut === 'en_cours' ? 'En cours' : mes.statut === 'termine' ? 'Terminée' : 'Planifiée'}
              </Badge>
              <Badge variant="orange">Étape {mes.etape_actuelle}/7</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              {mes.ascenseur && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Ascenseur</div>
                    <div className="text-sm text-[var(--text-primary)]">{mes.ascenseur.code}</div>
                    <div className="text-xs text-[var(--text-muted)]">{mes.ascenseur.adresse}</div>
                  </div>
                </div>
              )}
              {mes.technicien && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <div className="text-xs text-[var(--text-muted)]">Technicien</div>
                    <div className="text-sm text-[var(--text-primary)]">{mes.technicien.prenom} {mes.technicien.nom}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Progression</span>
                <span className="text-sm font-bold text-orange-400">{progress}%</span>
              </div>
              <div className="flex gap-1">
                {ETAPES.map(etape => {
                  const done = (mes as any)[etape.field];
                  return (
                    <div key={etape.num} className="flex-1 text-center">
                      <div className={`h-2 rounded-full mb-1 ${done ? 'bg-orange-500' : 'bg-[var(--bg-elevated)]'}`} />
                      <div className={`text-[10px] ${done ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>{etape.num}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-300 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Glissez-déposez cet élément sur le planning pour le planifier
            </div>

            <Button variant="secondary" className="w-full" onClick={onClose}>Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Carte dans la sidebar (travaux, MES, tournée)
function SidebarCard({ item, type, icon: Icon, color, onShowDetail }: { item: any; type: string; icon: any; color: string; onShowDetail: () => void }) {
  return (
    <div className="relative group">
      <DraggableItem id={`${type}-${item.id}`} type={type} data={item}>
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] hover:border-dark-500 transition-colors">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.code || item.titre || item.nom}</div>
              <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                {type === 'travaux' && (item.titre || item.client?.raison_sociale)}
                {type === 'mes' && item.ascenseur?.code}
                {type === 'tournee' && `${item.nb_ascenseurs} ascenseurs`}
              </div>
              {(type === 'travaux' || type === 'mes') && (item.date_debut || item.date_prevue) && (
                <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                  <Calendar className="w-3 h-3" />
                  {format(parseISO(item.date_debut || item.date_prevue), 'd MMM', { locale: fr })}
                </div>
              )}
              {item.technicien && (
                <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                  <User className="w-3 h-3" />
                  {item.technicien.prenom} {item.technicien.nom?.charAt(0)}.
                </div>
              )}
              {type === 'travaux' && item.priorite === 'urgente' && (
                <Badge variant="red" className="mt-1 text-[10px]">Urgent</Badge>
              )}
            </div>
            <GripVertical className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          </div>
        </div>
      </DraggableItem>
      {/* Bouton détail */}
      {(type === 'travaux' || type === 'mes') && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowDetail(); }}
          className="absolute top-2 right-8 p-1.5 bg-[var(--bg-elevated)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-dark-500"
          title="Voir détail"
        >
          <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
      )}
    </div>
  );
}

export function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'travaux' | 'mes' | 'tournees'>('travaux');
  const [selectedTravaux, setSelectedTravaux] = useState<Travaux | null>(null);
  const [selectedMES, setSelectedMES] = useState<MiseEnService | null>(null);
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const jours = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const dateDebut = format(jours[0], 'yyyy-MM-dd');
  const dateFin = format(jours[4], 'yyyy-MM-dd') + 'T23:59:59';

  // Queries
  const { data: events } = useQuery({
    queryKey: ['planning', dateDebut, dateFin],
    queryFn: () => getPlanningEvents(dateDebut, dateFin),
  });
  const { data: techniciens } = useQuery({ queryKey: ['techniciens'], queryFn: getTechniciens });
  const { data: travauxNonPlanifies } = useQuery({ queryKey: ['travaux-non-planifies'], queryFn: getTravauxNonPlanifies });
  const { data: mesNonPlanifiees } = useQuery({ queryKey: ['mes-non-planifiees'], queryFn: getMESNonPlanifiees });
  const { data: tournees } = useQuery({ queryKey: ['tournees-actives'], queryFn: getTourneesActives });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPlanningEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] });
      queryClient.invalidateQueries({ queryKey: ['mes-non-planifiees'] });
      toast.success('Événement planifié');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlanningEvent> }) => updatePlanningEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      toast.success('Événement déplacé');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlanningEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] });
      queryClient.invalidateQueries({ queryKey: ['mes-non-planifiees'] });
      toast.success('Événement supprimé');
    },
  });

  const techs = techniciens?.filter(t => t.role?.code === 'technicien' || t.role?.code === 'chef_equipe') || [];

  const getEventsForCell = (techId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events?.filter(e => e.technicien_id === techId && e.date_debut.startsWith(dateStr)) || [];
  };

  const naviguer = (dir: number) => setCurrentDate(prev => addDays(prev, dir * 7));

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over) return;

    const dropId = over.id as string;
    if (!dropId.startsWith('cell-')) return;

    const [, techId, dateStr] = dropId.split('|');
    const activeData = active.data.current as { type: string; data: any };

    if (activeData.type === 'event') {
      const evt = activeData.data as PlanningEvent;
      const oldDate = parseISO(evt.date_debut);
      const newDate = parseISO(dateStr);
      const hoursDiff = newDate.getTime() - parseISO(format(oldDate, 'yyyy-MM-dd')).getTime();
      
      const newDebut = new Date(oldDate.getTime() + hoursDiff);
      const newFin = new Date(parseISO(evt.date_fin).getTime() + hoursDiff);

      updateMutation.mutate({
        id: evt.id,
        data: {
          technicien_id: techId,
          date_debut: newDebut.toISOString(),
          date_fin: newFin.toISOString(),
        },
      });
    } else if (activeData.type === 'travaux') {
      const travaux = activeData.data as Travaux;
      const dateJour = parseISO(dateStr);
      createMutation.mutate({
        titre: travaux.code,
        technicien_id: techId,
        type_event: 'travaux',
        date_debut: setHours(dateJour, 8).toISOString(),
        date_fin: setHours(dateJour, 17).toISOString(),
        travaux_id: travaux.id,
        couleur: TYPE_EVENT_COLORS.travaux,
      });
    } else if (activeData.type === 'mes') {
      const mes = activeData.data as MiseEnService;
      const dateJour = parseISO(dateStr);
      createMutation.mutate({
        titre: mes.code,
        technicien_id: techId,
        type_event: 'mise_service',
        date_debut: setHours(dateJour, 8).toISOString(),
        date_fin: setHours(dateJour, 17).toISOString(),
        mise_service_id: mes.id,
        couleur: TYPE_EVENT_COLORS.mise_service,
      });
    } else if (activeData.type === 'tournee') {
      const tournee = activeData.data as Tournee;
      const dateJour = parseISO(dateStr);
      createMutation.mutate({
        titre: `Tournée ${tournee.code}`,
        technicien_id: techId,
        type_event: 'tournee',
        date_debut: setHours(dateJour, 8).toISOString(),
        date_fin: setHours(dateJour, 17).toISOString(),
        tournee_id: tournee.id,
        couleur: TYPE_EVENT_COLORS.tournee,
      });
    }
  };

  const activeDragData = useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith('event-')) return events?.find(e => e.id === activeId.replace('event-', ''));
    if (activeId.startsWith('travaux-')) return travauxNonPlanifies?.find(t => t.id === activeId.replace('travaux-', ''));
    if (activeId.startsWith('mes-')) return mesNonPlanifiees?.find(m => m.id === activeId.replace('mes-', ''));
    if (activeId.startsWith('tournee-')) return tournees?.find(t => t.id === activeId.replace('tournee-', ''));
    return null;
  }, [activeId, events, travauxNonPlanifies, mesNonPlanifiees, tournees]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {/* Grille planning */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => naviguer(-1)} className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)]">
                <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <div>
                <div className="text-lg font-bold text-[var(--text-primary)]">
                  Semaine du {format(jours[0], 'd MMMM yyyy', { locale: fr })}
                </div>
                <div className="text-sm text-[var(--text-tertiary)]">
                  {format(jours[0], 'd MMM', { locale: fr })} - {format(jours[4], 'd MMM', { locale: fr })}
                </div>
              </div>
              <button onClick={() => naviguer(1)} className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)]">
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>Aujourd'hui</Button>
            </div>

            <div className="flex gap-3">
              {[
                { label: 'Travaux', color: TYPE_EVENT_COLORS.travaux },
                { label: 'Tournée', color: TYPE_EVENT_COLORS.tournee },
                { label: 'MES', color: TYPE_EVENT_COLORS.mise_service },
                { label: 'Congé', color: TYPE_EVENT_COLORS.conge },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <div className="w-3 h-3 rounded" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Grille */}
          <Card className="flex-1 overflow-auto">
            <div className="grid grid-cols-[160px_repeat(5,1fr)] min-w-[900px]">
              {/* Header */}
              <div className="p-3 bg-[var(--bg-tertiary)] font-semibold text-sm text-[var(--text-secondary)] border-b border-r border-[var(--border-primary)] sticky top-0 z-10">
                Technicien
              </div>
              {jours.map((jour, i) => {
                const isToday = format(jour, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div key={i} className={`p-3 text-center border-b border-r border-[var(--border-primary)] last:border-r-0 sticky top-0 z-10 ${isToday ? 'bg-blue-500/20' : 'bg-[var(--bg-tertiary)]'}`}>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase">{format(jour, 'EEE', { locale: fr })}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-400' : 'text-[var(--text-primary)]'}`}>{format(jour, 'd')}</div>
                  </div>
                );
              })}

              {/* Lignes techniciens */}
              {techs.map(tech => (
                <>
                  <div key={`tech-${tech.id}`} className="p-3 bg-[var(--bg-tertiary)]/50 border-b border-r border-[var(--border-primary)] flex items-center gap-3 sticky left-0 z-[5]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-[var(--text-primary)]">
                      {tech.avatar_initiales}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{tech.prenom} {tech.nom?.charAt(0)}.</div>
                      <div className="text-xs text-[var(--text-muted)]">{tech.secteur || 'Non assigné'}</div>
                    </div>
                  </div>
                  {jours.map((jour, jIdx) => {
                    const cellId = `cell-|${tech.id}|${format(jour, 'yyyy-MM-dd')}`;
                    const cellEvents = getEventsForCell(tech.id, jour);
                    const isToday = format(jour, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div key={`${tech.id}-${jIdx}`} className={`border-b border-r border-[var(--border-primary)] last:border-r-0 ${isToday ? 'bg-blue-500/5' : ''}`}>
                        <DroppableCell id={cellId}>
                          {cellEvents.map(evt => (
                            <EventCard key={evt.id} event={evt} onDelete={() => deleteMutation.mutate(evt.id)} onClick={() => {}} />
                          ))}
                        </DroppableCell>
                      </div>
                    );
                  })}
                </>
              ))}

              {techs.length === 0 && (
                <div className="col-span-6 p-8 text-center text-[var(--text-muted)]">Aucun technicien trouvé</div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar - Éléments à planifier */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <div className="flex gap-1 mb-3">
            {[
              { id: 'travaux', label: 'Travaux', icon: Hammer, count: travauxNonPlanifies?.length || 0 },
              { id: 'mes', label: 'MES', icon: FileCheck, count: mesNonPlanifiees?.length || 0 },
              { id: 'tournees', label: 'Tournées', icon: Route, count: tournees?.length || 0 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  sidebarTab === tab.id ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count > 0 && <Badge variant="purple" className="ml-1 text-[10px] px-1.5 py-0">{tab.count}</Badge>}
              </button>
            ))}
          </div>

          <Card className="flex-1 overflow-hidden">
            <CardBody className="p-2 h-full overflow-y-auto">
              <div className="space-y-2">
                {sidebarTab === 'travaux' && travauxNonPlanifies?.map(t => (
                  <SidebarCard key={t.id} item={t} type="travaux" icon={Hammer} color={TYPE_EVENT_COLORS.travaux} onShowDetail={() => setSelectedTravaux(t)} />
                ))}
                {sidebarTab === 'mes' && mesNonPlanifiees?.map(m => (
                  <SidebarCard key={m.id} item={m} type="mes" icon={FileCheck} color={TYPE_EVENT_COLORS.mise_service} onShowDetail={() => setSelectedMES(m)} />
                ))}
                {sidebarTab === 'tournees' && tournees?.map(t => (
                  <SidebarCard key={t.id} item={t} type="tournee" icon={Route} color={TYPE_EVENT_COLORS.tournee} onShowDetail={() => {}} />
                ))}

                {sidebarTab === 'travaux' && (!travauxNonPlanifies || travauxNonPlanifies.length === 0) && (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">Tous les travaux sont planifiés</div>
                )}
                {sidebarTab === 'mes' && (!mesNonPlanifiees || mesNonPlanifiees.length === 0) && (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">Toutes les MES sont planifiées</div>
                )}
                {sidebarTab === 'tournees' && (!tournees || tournees.length === 0) && (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">Aucune tournée active</div>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="mt-2 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
            <div className="font-semibold text-[var(--text-secondary)] mb-1">💡 Astuce</div>
            <div className="space-y-1">
              <div>• <strong>Glisser-déposer</strong> sur le planning</div>
              <div>• <strong>Cliquer 👁</strong> pour voir le détail et planifier</div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeDragData && (
          <div className="p-3 bg-[var(--bg-elevated)] rounded-lg border-2 border-blue-500 shadow-xl opacity-90 max-w-[200px]">
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {(activeDragData as any).code || (activeDragData as any).titre || (activeDragData as any).nom}
            </div>
          </div>
        )}
      </DragOverlay>

      {/* Modals de détail */}
      {selectedTravaux && (
        <TravauxDetailModal travaux={selectedTravaux} onClose={() => setSelectedTravaux(null)} />
      )}
      {selectedMES && (
        <MESDetailModal mes={selectedMES} onClose={() => setSelectedMES(null)} />
      )}
    </DndContext>
  );
}
