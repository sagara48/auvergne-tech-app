import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragStartEvent, DragEndEvent, pointerWithin } from '@dnd-kit/core';
import { 
  ChevronLeft, ChevronRight, Plus, Hammer, FileCheck, Route, GripVertical, X, Clock, MapPin, User, Eye, Calendar, Building2, 
  AlertTriangle, Info, Palmtree, Phone, Trash2, Check, RotateCcw, CalendarPlus, Copy
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Select, Input } from '@/components/ui';
import { 
  getPlanningEvents, createPlanningEvent, updatePlanningEvent, deletePlanningEvent, 
  getTechniciens, getTravauxNonPlanifies, getMESNonPlanifiees, getTourneesActives
} from '@/services/api';
import { TYPE_EVENT_COLORS } from '@/types';
import type { PlanningEvent, Travaux, MiseEnService, Tournee } from '@/types';
import { format, addDays, startOfWeek, parseISO, setHours, addWeeks, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { supabase } from '@/services/supabase';

// Types locaux
interface PlanningConge {
  id: string;
  technicien_id: string;
  date_debut: string;
  date_fin: string;
  type: string;
  motif?: string;
  valide: boolean;
  technicien?: { prenom: string; nom: string };
}

interface PlanningAstreinte {
  id: string;
  technicien_id: string;
  date_debut: string; // Jeudi de début
  date_fin: string;   // Jeudi de fin
  type: string;
  note?: string;
  technicien?: { prenom: string; nom: string; telephone?: string };
}

// API pour congés et astreintes (tables optionnelles)
async function getPlanningConges(): Promise<PlanningConge[]> {
  try {
    const { data, error } = await supabase
      .from('planning_conges')
      .select('*, technicien:technicien_id(prenom, nom)')
      .order('date_debut');
    if (error) { 
      // Table n'existe pas encore - silencieux
      if (error.code === '42P01' || error.code === 'PGRST116') return []; 
      console.warn('Congés non disponibles:', error.message); 
      return []; 
    }
    return data || [];
  } catch {
    return [];
  }
}

async function createPlanningConge(conge: Partial<PlanningConge>): Promise<PlanningConge> {
  const { data, error } = await supabase.from('planning_conges').insert(conge).select().single();
  if (error) throw new Error('Veuillez exécuter le script SQL planning_schema.sql dans Supabase');
  return data;
}

async function deletePlanningConge(id: string): Promise<void> {
  const { error } = await supabase.from('planning_conges').delete().eq('id', id);
  if (error) throw error;
}

async function getPlanningAstreintes(): Promise<PlanningAstreinte[]> {
  try {
    const { data, error } = await supabase
      .from('planning_astreintes')
      .select('*, technicien:technicien_id(prenom, nom, telephone)')
      .order('date_debut');
    if (error) { 
      if (error.code === '42P01' || error.code === 'PGRST116') return [];
      console.warn('Astreintes non disponibles:', error.message); 
      return []; 
    }
    return data || [];
  } catch {
    return [];
  }
}

async function createPlanningAstreinte(astreinte: Partial<PlanningAstreinte>): Promise<PlanningAstreinte> {
  const { data, error } = await supabase.from('planning_astreintes').insert(astreinte).select().single();
  if (error) throw new Error('Veuillez exécuter le script SQL planning_schema.sql dans Supabase');
  return data;
}

async function updatePlanningAstreinte(id: string, astreinte: Partial<PlanningAstreinte>): Promise<PlanningAstreinte> {
  const { data, error } = await supabase.from('planning_astreintes').update(astreinte).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deletePlanningAstreinte(id: string): Promise<void> {
  const { error } = await supabase.from('planning_astreintes').delete().eq('id', id);
  if (error) throw error;
}

async function getAstreinteEnCours(date: string): Promise<PlanningAstreinte | null> {
  try {
    const { data, error } = await supabase
      .from('planning_astreintes')
      .select('*, technicien:technicien_id(prenom, nom, telephone)')
      .lte('date_debut', date)
      .gte('date_fin', date)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Composants Drag & Drop
function DraggableItem({ id, type, data, children }: { id: string; type: string; data: any; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { type, data } });
  return <div ref={setNodeRef} {...listeners} {...attributes} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}>{children}</div>;
}

function DroppableCell({ id, isBlocked, children }: { id: string; isBlocked?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[100px] p-1 transition-colors ${isBlocked ? 'bg-green-500/10' : isOver ? 'bg-blue-500/20 ring-2 ring-blue-500/50' : ''}`}>
      {children}
    </div>
  );
}

// Carte événement
function EventCard({ event, onDelete, onDuplicate }: { event: PlanningEvent; onDelete: () => void; onDuplicate: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `event-${event.id}`, data: { type: 'event', data: event } });
  const color = event.couleur || TYPE_EVENT_COLORS[event.type_event] || '#6366f1';
  const isExpire = (event as any).statut === 'expire';

  return (
    <div 
      ref={setNodeRef}
      className={`group relative p-2 rounded-lg text-xs mb-1 transition-all ${isDragging ? 'opacity-50' : 'hover:scale-[1.02]'} ${isExpire ? 'opacity-60' : ''}`}
      style={{ background: `${color}25`, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-1">
        {/* Handle de drag - seul élément draggable */}
        <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-white/10 rounded">
          <GripVertical className="w-3 h-3 text-[var(--text-muted)]" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--text-primary)] truncate flex items-center gap-1">
            {event.titre}
            {isExpire && <AlertTriangle className="w-3 h-3 text-amber-400" />}
          </div>
          <div className="text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {format(parseISO(event.date_debut), 'HH:mm')} - {format(parseISO(event.date_fin), 'HH:mm')}
          </div>
        </div>
        
        {/* Boutons d'action */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }} 
            className="p-1 hover:bg-blue-500/30 rounded"
            title="Dupliquer"
          >
            <Copy className="w-3 h-3 text-blue-400" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className="p-1 hover:bg-red-500/30 rounded"
            title="Supprimer"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Carte congé
function CongeCard({ conge }: { conge: PlanningConge }) {
  const typeLabels: Record<string, string> = { conge: 'Congés', rtt: 'RTT', maladie: 'Maladie', formation: 'Formation', autre: 'Absence' };
  return (
    <div className="p-2 rounded-lg text-xs mb-1 bg-green-500/20 border-l-[3px] border-green-500">
      <div className="font-semibold text-green-400 flex items-center gap-1">
        <Palmtree className="w-3 h-3" />
        {typeLabels[conge.type] || 'Absence'}
      </div>
    </div>
  );
}

// Modal création événement
function CreateEventModal({ onClose, defaultDate, defaultTech, techniciens }: { onClose: () => void; defaultDate?: Date; defaultTech?: string; techniciens: any[] }) {
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState('');
  const [lieu, setLieu] = useState('');
  const [techId, setTechId] = useState(defaultTech || '');
  const [date, setDate] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [heureDebut, setHeureDebut] = useState('09:00');
  const [heureFin, setHeureFin] = useState('10:00');
  const [typeEvent, setTypeEvent] = useState('rdv');

  const createMutation = useMutation({
    mutationFn: createPlanningEvent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planning'] }); toast.success('Événement créé'); onClose(); },
  });

  const handleSubmit = () => {
    if (!titre || !techId) { toast.error('Titre et technicien requis'); return; }
    createMutation.mutate({
      titre, lieu, technicien_id: techId, type_event: typeEvent,
      date_debut: new Date(`${date}T${heureDebut}:00`).toISOString(),
      date_fin: new Date(`${date}T${heureFin}:00`).toISOString(),
      est_manuel: true,
      couleur: typeEvent === 'rdv' ? '#3b82f6' : typeEvent === 'reunion' ? '#8b5cf6' : '#6b7280',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CalendarPlus className="w-6 h-6 text-blue-400" /> Nouvel événement
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[{ id: 'rdv', label: 'RDV' }, { id: 'reunion', label: 'Réunion' }, { id: 'autre', label: 'Autre' }].map(t => (
                <button key={t.id} onClick={() => setTypeEvent(t.id)} className={`p-2 rounded-lg text-xs border-2 ${typeEvent === t.id ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--border-primary)]'}`}>{t.label}</button>
              ))}
            </div>
            <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre *" />
            <Select value={techId} onChange={e => setTechId(e.target.value)}>
              <option value="">Technicien *</option>
              {techniciens.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              <Input type="time" value={heureDebut} onChange={e => setHeureDebut(e.target.value)} />
              <Input type="time" value={heureFin} onChange={e => setHeureFin(e.target.value)} />
            </div>
            <Input value={lieu} onChange={e => setLieu(e.target.value)} placeholder="Lieu (optionnel)" />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>Créer</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal congés avec calendrier mensuel
function CongesModal({ onClose, techniciens }: { onClose: () => void; techniciens: any[] }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [techId, setTechId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [type, setType] = useState('conge');
  const [editingConge, setEditingConge] = useState<PlanningConge | null>(null);

  const { data: conges } = useQuery({ queryKey: ['planning-conges'], queryFn: getPlanningConges });
  
  const createMutation = useMutation({ 
    mutationFn: createPlanningConge, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['planning-conges'] }); 
      toast.success('Congé ajouté'); 
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || 'Erreur')
  });
  
  const deleteMutation = useMutation({ 
    mutationFn: deletePlanningConge, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['planning-conges'] }); 
      toast.success('Congé supprimé'); 
    } 
  });

  const resetForm = () => {
    setTechId('');
    setDateDebut('');
    setDateFin('');
    setEditingConge(null);
  };

  const typeLabels: Record<string, string> = { conge: 'Congés', rtt: 'RTT', maladie: 'Maladie', formation: 'Formation' };
  const typeColors: Record<string, string> = { conge: '#10b981', rtt: '#3b82f6', maladie: '#ef4444', formation: '#f59e0b' };

  // Générer les jours du mois
  const monthStart = startOfWeek(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), { weekStartsOn: 1 });
  const daysInView = Array.from({ length: 42 }, (_, i) => addDays(monthStart, i));

  // Congés pour un jour donné
  const getCongesForDay = (date: Date) => {
    return conges?.filter(c => {
      const start = parseISO(c.date_debut);
      const end = parseISO(c.date_fin);
      return isWithinInterval(date, { start, end: addDays(end, 1) });
    }) || [];
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Palmtree className="w-6 h-6 text-green-400" /> Planning des congés
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* Calendrier */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCurrentMonth(addDays(currentMonth, -30))} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-semibold text-[var(--text-primary)]">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </span>
                <button onClick={() => setCurrentMonth(addDays(currentMonth, 30))} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--text-tertiary)] mb-1">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="py-1">{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1 flex-1">
                {daysInView.map((day, i) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const dayConges = getCongesForDay(day);
                  
                  return (
                    <div 
                      key={i} 
                      className={`min-h-[60px] p-1 rounded border ${isCurrentMonth ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]/30'} ${isToday ? 'border-blue-500' : 'border-transparent'}`}
                    >
                      <div className={`text-xs ${isCurrentMonth ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} ${isToday ? 'font-bold text-blue-400' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {dayConges.slice(0, 2).map(c => (
                          <div 
                            key={c.id} 
                            className="text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                            style={{ background: `${typeColors[c.type]}30`, color: typeColors[c.type] }}
                            onClick={() => {
                              setEditingConge(c);
                              setTechId(c.technicien_id);
                              setDateDebut(c.date_debut);
                              setDateFin(c.date_fin);
                              setType(c.type);
                            }}
                          >
                            {c.technicien?.prenom?.charAt(0)}.{c.technicien?.nom?.charAt(0)}
                          </div>
                        ))}
                        {dayConges.length > 2 && (
                          <div className="text-[9px] text-[var(--text-muted)]">+{dayConges.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formulaire */}
            <div className="w-64 flex flex-col">
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {editingConge ? 'Modifier' : 'Ajouter'} un congé
                </h3>
                <Select value={techId} onChange={e => setTechId(e.target.value)}>
                  <option value="">Technicien...</option>
                  {techniciens.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
                </Select>
                <Select value={type} onChange={e => setType(e.target.value)}>
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                <div className="flex gap-2">
                  {editingConge && (
                    <Button variant="secondary" size="sm" onClick={resetForm}>Annuler</Button>
                  )}
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      if (!techId || !dateDebut || !dateFin) return toast.error('Remplir tous les champs');
                      createMutation.mutate({ technicien_id: techId, date_debut: dateDebut, date_fin: dateFin, type, valide: true });
                    }}
                  >
                    {editingConge ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
                {editingConge && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-red-400 hover:bg-red-500/20"
                    onClick={() => { deleteMutation.mutate(editingConge.id); resetForm(); }}
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </Button>
                )}
              </div>

              {/* Légende */}
              <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-xl">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Légende</h4>
                <div className="space-y-1">
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded" style={{ background: typeColors[k] }} />
                      <span className="text-[var(--text-tertiary)]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal astreintes avec calendrier (jeudi à jeudi)
function AstreintesModal({ onClose, techniciens }: { onClose: () => void; techniciens: any[] }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [techId, setTechId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [editingAstreinte, setEditingAstreinte] = useState<PlanningAstreinte | null>(null);

  const { data: astreintes } = useQuery({ queryKey: ['planning-astreintes'], queryFn: getPlanningAstreintes });
  
  const createMutation = useMutation({ 
    mutationFn: createPlanningAstreinte, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['planning-astreintes'] }); 
      queryClient.invalidateQueries({ queryKey: ['astreinte-encours'] }); 
      toast.success('Astreinte ajoutée'); 
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || 'Erreur')
  });
  
  const updateMutation = useMutation({ 
    mutationFn: ({ id, data }: { id: string; data: Partial<PlanningAstreinte> }) => updatePlanningAstreinte(id, data), 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['planning-astreintes'] }); 
      queryClient.invalidateQueries({ queryKey: ['astreinte-encours'] }); 
      toast.success('Astreinte modifiée'); 
      resetForm();
    }
  });
  
  const deleteMutation = useMutation({ 
    mutationFn: deletePlanningAstreinte, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['planning-astreintes'] }); 
      toast.success('Astreinte supprimée'); 
      resetForm();
    } 
  });

  const resetForm = () => {
    setTechId('');
    setDateDebut('');
    setDateFin('');
    setEditingAstreinte(null);
  };

  // Trouver le prochain jeudi à partir d'une date
  const getNextThursday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (4 - day + 7) % 7; // 4 = jeudi
    d.setDate(d.getDate() + diff);
    return d;
  };

  // Quand on sélectionne une date de début, auto-remplir +7 jours
  const handleDateDebutChange = (value: string) => {
    setDateDebut(value);
    if (value) {
      const debut = parseISO(value);
      setDateFin(format(addDays(debut, 7), 'yyyy-MM-dd'));
    }
  };

  // Générer les jours du mois
  const monthStart = startOfWeek(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), { weekStartsOn: 1 });
  const daysInView = Array.from({ length: 42 }, (_, i) => addDays(monthStart, i));

  // Astreinte pour un jour donné
  const getAstreinteForDay = (date: Date) => {
    return astreintes?.find(a => {
      const start = parseISO(a.date_debut);
      const end = parseISO(a.date_fin);
      return isWithinInterval(date, { start, end });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Phone className="w-6 h-6 text-red-400" /> Planning des astreintes
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="amber">Jeudi → Jeudi</Badge>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* Calendrier */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCurrentMonth(addDays(currentMonth, -30))} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-semibold text-[var(--text-primary)]">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </span>
                <button onClick={() => setCurrentMonth(addDays(currentMonth, 30))} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--text-tertiary)] mb-1">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                  <div key={d} className={`py-1 ${d === 'Jeu' ? 'text-red-400 font-bold' : ''}`}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 flex-1">
                {daysInView.map((day, i) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const isThursday = day.getDay() === 4;
                  const astreinte = getAstreinteForDay(day);
                  const isStartDay = astreinte && format(parseISO(astreinte.date_debut), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                  
                  return (
                    <div 
                      key={i} 
                      className={`min-h-[60px] p-1 rounded border transition-colors cursor-pointer
                        ${isCurrentMonth ? 'bg-[var(--bg-secondary)]' : 'bg-[var(--bg-tertiary)]/30'} 
                        ${isToday ? 'border-blue-500' : isThursday ? 'border-red-500/30' : 'border-transparent'}
                        ${astreinte ? 'bg-red-500/10' : ''}
                        hover:bg-[var(--bg-tertiary)]
                      `}
                      onClick={() => {
                        if (astreinte) {
                          setEditingAstreinte(astreinte);
                          setTechId(astreinte.technicien_id);
                          setDateDebut(astreinte.date_debut);
                          setDateFin(astreinte.date_fin);
                        } else if (isThursday) {
                          handleDateDebutChange(format(day, 'yyyy-MM-dd'));
                        }
                      }}
                    >
                      <div className={`text-xs ${isCurrentMonth ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} ${isToday ? 'font-bold text-blue-400' : ''} ${isThursday ? 'text-red-400' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      {astreinte && isStartDay && (
                        <div className="text-[9px] px-1 py-0.5 rounded bg-red-500/30 text-red-300 truncate mt-0.5">
                          <Phone className="w-2 h-2 inline mr-0.5" />
                          {astreinte.technicien?.prenom?.charAt(0)}.{astreinte.technicien?.nom?.charAt(0)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formulaire */}
            <div className="w-64 flex flex-col">
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {editingAstreinte ? 'Modifier' : 'Nouvelle'} astreinte
                </h3>
                <Select value={techId} onChange={e => setTechId(e.target.value)}>
                  <option value="">Technicien...</option>
                  {techniciens.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
                </Select>
                <div>
                  <label className="text-xs text-[var(--text-tertiary)]">Début (jeudi)</label>
                  <Input type="date" value={dateDebut} onChange={e => handleDateDebutChange(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-tertiary)]">Fin (jeudi suivant)</label>
                  <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  {editingAstreinte && (
                    <Button variant="secondary" size="sm" onClick={resetForm}>Annuler</Button>
                  )}
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      if (!techId || !dateDebut || !dateFin) return toast.error('Remplir tous les champs');
                      if (editingAstreinte) {
                        updateMutation.mutate({ id: editingAstreinte.id, data: { technicien_id: techId, date_debut: dateDebut, date_fin: dateFin } });
                      } else {
                        createMutation.mutate({ technicien_id: techId, date_debut: dateDebut, date_fin: dateFin, type: 'semaine' });
                      }
                    }}
                  >
                    {editingAstreinte ? 'Modifier' : 'Ajouter'}
                  </Button>
                </div>
                {editingAstreinte && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-red-400 hover:bg-red-500/20"
                    onClick={() => deleteMutation.mutate(editingAstreinte.id)}
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </Button>
                )}
              </div>

              {/* Liste des prochaines astreintes */}
              <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-xl flex-1 overflow-y-auto">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Prochaines astreintes</h4>
                <div className="space-y-2">
                  {astreintes?.filter(a => parseISO(a.date_fin) >= new Date()).slice(0, 6).map(a => (
                    <div 
                      key={a.id} 
                      className="p-2 bg-[var(--bg-secondary)] rounded-lg cursor-pointer hover:bg-[var(--bg-elevated)]"
                      onClick={() => {
                        setEditingAstreinte(a);
                        setTechId(a.technicien_id);
                        setDateDebut(a.date_debut);
                        setDateFin(a.date_fin);
                      }}
                    >
                      <div className="text-xs font-medium text-[var(--text-primary)]">
                        {a.technicien?.prenom} {a.technicien?.nom}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">
                        {format(parseISO(a.date_debut), 'd MMM', { locale: fr })} → {format(parseISO(a.date_fin), 'd MMM', { locale: fr })}
                      </div>
                    </div>
                  ))}
                  {(!astreintes || astreintes.length === 0) && (
                    <div className="text-xs text-[var(--text-muted)] text-center py-2">Aucune astreinte</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Sidebar Card
function SidebarCard({ item, type, icon: Icon, color, onShowDetail }: { item: any; type: string; icon: any; color: string; onShowDetail: () => void }) {
  const hasReplan = item.nb_replanifications > 0;
  return (
    <div className="relative group">
      <DraggableItem id={`${type}-${item.id}`} type={type} data={item}>
        <div className={`p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] hover:border-dark-500 ${hasReplan ? 'ring-2 ring-amber-500/30' : ''}`}>
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: `${color}20` }}><Icon className="w-4 h-4" style={{ color }} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.code || item.titre || item.nom}</div>
              <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                {type === 'travaux' && (item.titre || item.client?.raison_sociale)}
                {type === 'mes' && item.ascenseur?.code}
                {type === 'tournee' && `${item.nb_ascenseurs} ascenseurs`}
              </div>
              {hasReplan && <Badge variant="amber" className="mt-1 text-[10px]"><RotateCcw className="w-2.5 h-2.5 mr-0.5" />{item.nb_replanifications}x</Badge>}
              {item.derniere_planification && <div className="text-xs text-amber-400 mt-1"><Calendar className="w-3 h-3 inline mr-1" />Dernier: {format(parseISO(item.derniere_planification), 'd MMM', { locale: fr })}</div>}
              {item.technicien && <div className="text-xs text-[var(--text-muted)] mt-1"><User className="w-3 h-3 inline mr-1" />{item.technicien.prenom}</div>}
              {type === 'travaux' && item.priorite === 'urgente' && <Badge variant="red" className="mt-1 text-[10px]">Urgent</Badge>}
            </div>
            <GripVertical className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </div>
      </DraggableItem>
      {(type === 'travaux' || type === 'mes') && <button onClick={onShowDetail} className="absolute top-2 right-8 p-1.5 bg-[var(--bg-elevated)] rounded-lg opacity-0 group-hover:opacity-100"><Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button>}
    </div>
  );
}

// Bandeau astreinte
function AstreinteBanner({ astreinte }: { astreinte: PlanningAstreinte | null }) {
  if (!astreinte) return null;
  return (
    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <Phone className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-red-300">
            Astreinte en cours
          </div>
          <div className="text-xs text-red-400/70">
            {astreinte.technicien?.prenom} {astreinte.technicien?.nom} • {astreinte.technicien?.telephone || 'N/A'}
          </div>
          <div className="text-[10px] text-red-400/50 mt-0.5">
            Du {format(parseISO(astreinte.date_debut), 'EEEE d MMM', { locale: fr })} au {format(parseISO(astreinte.date_fin), 'EEEE d MMM', { locale: fr })}
          </div>
        </div>
      </div>
      <Badge variant="red">
        <Phone className="w-3 h-3 mr-1" />
        D'astreinte
      </Badge>
    </div>
  );
}

// PAGE PRINCIPALE
export function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'travaux' | 'mes' | 'tournees'>('travaux');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showConges, setShowConges] = useState(false);
  const [showAstreintes, setShowAstreintes] = useState(false);
  const [createEventDate, setCreateEventDate] = useState<Date>();
  const [createEventTech, setCreateEventTech] = useState<string>();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const jours = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const dateDebut = format(jours[0], 'yyyy-MM-dd');
  const dateFin = format(jours[4], 'yyyy-MM-dd') + 'T23:59:59';

  // Queries
  const { data: events } = useQuery({ queryKey: ['planning', dateDebut, dateFin], queryFn: () => getPlanningEvents(dateDebut, dateFin) });
  const { data: techniciens } = useQuery({ queryKey: ['techniciens'], queryFn: getTechniciens });
  const { data: travauxNonPlanifies } = useQuery({ queryKey: ['travaux-non-planifies'], queryFn: getTravauxNonPlanifies });
  const { data: mesNonPlanifiees } = useQuery({ queryKey: ['mes-non-planifiees'], queryFn: getMESNonPlanifiees });
  const { data: tournees } = useQuery({ queryKey: ['tournees-actives'], queryFn: getTourneesActives });
  const { data: conges } = useQuery({ queryKey: ['planning-conges'], queryFn: getPlanningConges });
  const { data: astreinteEnCours } = useQuery({ queryKey: ['astreinte-encours', dateDebut], queryFn: () => getAstreinteEnCours(format(new Date(), 'yyyy-MM-dd')) });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPlanningEvent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planning'] }); queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] }); queryClient.invalidateQueries({ queryKey: ['mes-non-planifiees'] }); toast.success('Événement planifié'); },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlanningEvent> }) => updatePlanningEvent(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planning'] }); toast.success('Événement déplacé'); },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlanningEvent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planning'] }); queryClient.invalidateQueries({ queryKey: ['travaux-non-planifies'] }); queryClient.invalidateQueries({ queryKey: ['mes-non-planifiees'] }); toast.success('Événement supprimé'); },
    onError: (e: any) => toast.error(e.message || 'Erreur suppression'),
  });

  const techs = techniciens?.filter(t => t.role?.code === 'technicien' || t.role?.code === 'chef_equipe') || [];

  const isEnConge = (techId: string, date: Date): PlanningConge | null => {
    if (!conges) return null;
    return conges.find(c => c.technicien_id === techId && isWithinInterval(date, { start: parseISO(c.date_debut), end: addDays(parseISO(c.date_fin), 1) })) || null;
  };

  const getEventsForCell = (techId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events?.filter(e => e.technicien_id === techId && e.date_debut.startsWith(dateStr)) || [];
  };

  const naviguer = (dir: number) => setCurrentDate(prev => addDays(prev, dir * 7));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dropId = over.id as string;
    if (!dropId.startsWith('cell-')) return;

    const [, techId, dateStr] = dropId.split('|');
    const activeData = active.data.current as { type: string; data: any };
    const targetDate = parseISO(dateStr);

    if (isEnConge(techId, targetDate)) { toast.error('Ce technicien est en congé'); return; }

    if (activeData.type === 'event') {
      const evt = activeData.data as PlanningEvent;
      const oldDate = parseISO(evt.date_debut);
      const newDate = parseISO(dateStr);
      const hoursDiff = newDate.getTime() - parseISO(format(oldDate, 'yyyy-MM-dd')).getTime();
      updateMutation.mutate({ id: evt.id, data: { technicien_id: techId, date_debut: new Date(oldDate.getTime() + hoursDiff).toISOString(), date_fin: new Date(parseISO(evt.date_fin).getTime() + hoursDiff).toISOString() } });
    } else if (activeData.type === 'travaux') {
      const t = activeData.data as Travaux;
      createMutation.mutate({ titre: t.code, technicien_id: techId, type_event: 'travaux', date_debut: setHours(targetDate, 8).toISOString(), date_fin: setHours(targetDate, 17).toISOString(), travaux_id: t.id, couleur: TYPE_EVENT_COLORS.travaux });
    } else if (activeData.type === 'mes') {
      const m = activeData.data as MiseEnService;
      createMutation.mutate({ titre: m.code, technicien_id: techId, type_event: 'mise_service', date_debut: setHours(targetDate, 8).toISOString(), date_fin: setHours(targetDate, 17).toISOString(), mise_service_id: m.id, couleur: TYPE_EVENT_COLORS.mise_service });
    } else if (activeData.type === 'tournee') {
      const tr = activeData.data as Tournee;
      createMutation.mutate({ titre: `Tournée ${tr.code}`, technicien_id: techId, type_event: 'tournee', date_debut: setHours(targetDate, 8).toISOString(), date_fin: setHours(targetDate, 17).toISOString(), tournee_id: tr.id, couleur: TYPE_EVENT_COLORS.tournee });
    }
  };

  const handleDeleteEvent = (id: string) => { if (confirm('Supprimer cet événement ?')) deleteMutation.mutate(id); };

  const handleDuplicateEvent = (event: PlanningEvent) => {
    // Dupliquer l'événement au jour suivant
    const dateDebut = parseISO(event.date_debut);
    const dateFin = parseISO(event.date_fin);
    const newDateDebut = addDays(dateDebut, 1);
    const newDateFin = addDays(dateFin, 1);
    
    createMutation.mutate({
      titre: event.titre,
      technicien_id: event.technicien_id,
      type_event: event.type_event,
      date_debut: newDateDebut.toISOString(),
      date_fin: newDateFin.toISOString(),
      couleur: event.couleur,
      travaux_id: event.travaux_id,
      mise_service_id: event.mise_service_id,
      tournee_id: event.tournee_id,
      est_manuel: (event as any).est_manuel,
      description: (event as any).description,
      lieu: (event as any).lieu,
    });
    toast.success('Événement dupliqué au jour suivant');
  };

  const handleCellDoubleClick = (techId: string, date: Date) => {
    if (isEnConge(techId, date)) { toast.error('Ce technicien est en congé'); return; }
    setCreateEventDate(date);
    setCreateEventTech(techId);
    setShowCreateEvent(true);
  };

  const activeDragData = activeId ? (events?.find(e => `event-${e.id}` === activeId) || travauxNonPlanifies?.find(t => `travaux-${t.id}` === activeId) || mesNonPlanifiees?.find(m => `mes-${m.id}` === activeId) || tournees?.find(t => `tournee-${t.id}` === activeId)) : null;

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={e => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="h-full flex gap-4 p-4">
        <div className="flex-1 flex flex-col min-w-0">
          <AstreinteBanner astreinte={astreinteEnCours} />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => naviguer(-1)} className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)]"><ChevronLeft className="w-5 h-5" /></button>
              <div className="text-center min-w-[180px]">
                <div className="text-lg font-bold text-[var(--text-primary)]">Semaine {format(jours[0], 'w', { locale: fr })}</div>
                <div className="text-sm text-[var(--text-tertiary)]">{format(jours[0], 'd MMM', { locale: fr })} - {format(jours[4], 'd MMM', { locale: fr })}</div>
              </div>
              <button onClick={() => naviguer(1)} className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)]"><ChevronRight className="w-5 h-5" /></button>
              <Button variant="secondary" size="sm" onClick={() => setCurrentDate(new Date())}>Aujourd'hui</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-3 mr-4">{[{ l: 'Travaux', c: TYPE_EVENT_COLORS.travaux }, { l: 'Tournée', c: TYPE_EVENT_COLORS.tournee }, { l: 'MES', c: TYPE_EVENT_COLORS.mise_service }, { l: 'Congé', c: '#10b981' }].map(x => <div key={x.l} className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]"><div className="w-3 h-3 rounded" style={{ background: x.c }} />{x.l}</div>)}</div>
              <Button variant="secondary" size="sm" onClick={() => setShowConges(true)}><Palmtree className="w-4 h-4" /> Congés</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAstreintes(true)}><Phone className="w-4 h-4" /> Astreintes</Button>
              <Button variant="primary" size="sm" onClick={() => setShowCreateEvent(true)}><Plus className="w-4 h-4" /> Événement</Button>
            </div>
          </div>

          {/* Grille */}
          <Card className="flex-1 overflow-auto">
            <div className="grid grid-cols-[160px_repeat(5,1fr)] min-w-[900px]">
              <div className="p-3 bg-[var(--bg-tertiary)] font-semibold text-sm border-b border-r border-[var(--border-primary)] sticky top-0 z-10">Technicien</div>
              {jours.map((jour, i) => {
                const isToday = format(jour, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return <div key={i} className={`p-3 text-center border-b border-r last:border-r-0 sticky top-0 z-10 ${isToday ? 'bg-blue-500/20' : 'bg-[var(--bg-tertiary)]'}`}><div className="text-xs text-[var(--text-tertiary)] uppercase">{format(jour, 'EEE', { locale: fr })}</div><div className={`text-lg font-bold ${isToday ? 'text-blue-400' : 'text-[var(--text-primary)]'}`}>{format(jour, 'd')}</div></div>;
              })}
              {techs.map(tech => (
                <>
                  <div key={`tech-${tech.id}`} className="p-3 bg-[var(--bg-tertiary)]/50 border-b border-r flex items-center gap-3 sticky left-0 z-[5]">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">{tech.avatar_initiales}</div>
                    <div><div className="text-sm font-medium text-[var(--text-primary)]">{tech.prenom} {tech.nom?.charAt(0)}.</div><div className="text-xs text-[var(--text-muted)]">{tech.secteur || ''}</div></div>
                  </div>
                  {jours.map((jour, jIdx) => {
                    const cellId = `cell-|${tech.id}|${format(jour, 'yyyy-MM-dd')}`;
                    const cellEvents = getEventsForCell(tech.id, jour);
                    const conge = isEnConge(tech.id, jour);
                    const isToday = format(jour, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div key={`${tech.id}-${jIdx}`} className={`border-b border-r last:border-r-0 ${isToday ? 'bg-blue-500/5' : ''}`} onDoubleClick={() => handleCellDoubleClick(tech.id, jour)}>
                        <DroppableCell id={cellId} isBlocked={!!conge}>
                          {conge && <CongeCard conge={conge} />}
                          {!conge && cellEvents.map(evt => <EventCard key={evt.id} event={evt} onDelete={() => handleDeleteEvent(evt.id)} onDuplicate={() => handleDuplicateEvent(evt)} />)}
                        </DroppableCell>
                      </div>
                    );
                  })}
                </>
              ))}
              {techs.length === 0 && <div className="col-span-6 p-8 text-center text-[var(--text-muted)]">Aucun technicien</div>}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <div className="flex gap-1 mb-3">
            {[{ id: 'travaux', label: 'Travaux', icon: Hammer, count: travauxNonPlanifies?.length || 0 }, { id: 'mes', label: 'MES', icon: FileCheck, count: mesNonPlanifiees?.length || 0 }, { id: 'tournees', label: 'Tournées', icon: Route, count: tournees?.length || 0 }].map(tab => (
              <button key={tab.id} onClick={() => setSidebarTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium ${sidebarTab === tab.id ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'}`}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}{tab.count > 0 && <Badge variant="purple" className="ml-1 text-[10px] px-1.5 py-0">{tab.count}</Badge>}
              </button>
            ))}
          </div>
          <Card className="flex-1 overflow-hidden"><CardBody className="p-2 h-full overflow-y-auto"><div className="space-y-2">
            {sidebarTab === 'travaux' && travauxNonPlanifies?.map(t => <SidebarCard key={t.id} item={t} type="travaux" icon={Hammer} color={TYPE_EVENT_COLORS.travaux} onShowDetail={() => {}} />)}
            {sidebarTab === 'mes' && mesNonPlanifiees?.map(m => <SidebarCard key={m.id} item={m} type="mes" icon={FileCheck} color={TYPE_EVENT_COLORS.mise_service} onShowDetail={() => {}} />)}
            {sidebarTab === 'tournees' && tournees?.map(t => <SidebarCard key={t.id} item={t} type="tournee" icon={Route} color={TYPE_EVENT_COLORS.tournee} onShowDetail={() => {}} />)}
            {sidebarTab === 'travaux' && !travauxNonPlanifies?.length && <div className="text-center py-8 text-[var(--text-muted)] text-sm">Tous planifiés</div>}
            {sidebarTab === 'mes' && !mesNonPlanifiees?.length && <div className="text-center py-8 text-[var(--text-muted)] text-sm">Toutes planifiées</div>}
            {sidebarTab === 'tournees' && !tournees?.length && <div className="text-center py-8 text-[var(--text-muted)] text-sm">Aucune tournée</div>}
          </div></CardBody></Card>
          <div className="mt-2 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]">
            <div className="font-semibold text-[var(--text-secondary)] mb-1">💡 Astuces</div>
            <div>• Glisser-déposer • Double-clic = nouvel event • Croix = supprimer</div>
          </div>
        </div>
      </div>

      <DragOverlay>{activeId && activeDragData && <div className="p-3 bg-[var(--bg-elevated)] rounded-lg border-2 border-blue-500 shadow-xl opacity-90 max-w-[200px]"><div className="text-sm font-semibold truncate">{(activeDragData as any).code || (activeDragData as any).titre}</div></div>}</DragOverlay>

      {showCreateEvent && <CreateEventModal onClose={() => { setShowCreateEvent(false); setCreateEventDate(undefined); setCreateEventTech(undefined); }} defaultDate={createEventDate} defaultTech={createEventTech} techniciens={techs} />}
      {showConges && <CongesModal onClose={() => setShowConges(false)} techniciens={techs} />}
      {showAstreintes && <AstreintesModal onClose={() => setShowAstreintes(false)} techniciens={techs} />}
    </DndContext>
  );
}
