import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, Wrench, Plus, X, Clock, MapPin, User,
  ChevronLeft, ChevronRight, AlertTriangle, Check, Loader2
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { 
  format, parseISO, addDays, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameDay, isToday 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// TYPES
// =============================================
interface Travaux {
  id: string;
  code: string;
  titre: string;
  description?: string;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  priorite: 'basse' | 'normale' | 'haute' | 'urgente';
  date_debut?: string;
  date_fin?: string;
  technicien_id?: string;
  technicien_nom?: string;
  code_appareil?: string;
  adresse?: string;
  duree_estimee?: number; // en heures
}

interface PlanningEvent {
  id: string;
  titre: string;
  description?: string;
  date_debut: string;
  date_fin?: string;
  heure_debut?: string;
  heure_fin?: string;
  type_event: 'travaux' | 'tournee' | 'reunion' | 'conge' | 'autre';
  technicien_id?: string;
  lieu?: string;
  statut: string;
  travaux_id?: string;
  couleur?: string;
}

interface Technicien {
  id: string;
  prenom: string;
  nom: string;
}

// =============================================
// API FUNCTIONS
// =============================================

// Récupérer les travaux planifiables (planifiés ou en cours, non encore au planning)
async function getTravauxPlanifiables(): Promise<Travaux[]> {
  const { data, error } = await supabase
    .from('travaux')
    .select(`
      *,
      technicien:technicien_id(prenom, nom)
    `)
    .in('statut', ['planifie', 'en_cours'])
    .order('priorite', { ascending: true })
    .order('date_debut', { ascending: true });

  if (error) {
    console.error('Erreur récupération travaux:', error);
    return [];
  }

  return (data || []).map((t: any) => ({
    ...t,
    technicien_nom: t.technicien ? `${t.technicien.prenom} ${t.technicien.nom}`.trim() : undefined,
  }));
}

// Récupérer les événements planning d'une période
async function getPlanningEvents(dateDebut: Date, dateFin: Date): Promise<PlanningEvent[]> {
  const { data, error } = await supabase
    .from('planning_events')
    .select('*')
    .gte('date_debut', format(dateDebut, 'yyyy-MM-dd'))
    .lte('date_debut', format(dateFin, 'yyyy-MM-dd'))
    .order('heure_debut');

  if (error) {
    console.error('Erreur récupération planning:', error);
    return [];
  }

  return data || [];
}

// Récupérer les techniciens
async function getTechniciens(): Promise<Technicien[]> {
  const { data, error } = await supabase
    .from('techniciens')
    .select('id, prenom, nom')
    .eq('actif', true)
    .order('nom');

  return data || [];
}

// Planifier un travaux (créer un événement planning)
async function planifierTravaux(params: {
  travaux_id: string;
  date: string;
  heure_debut: string;
  heure_fin?: string;
  technicien_id: string;
  titre: string;
  description?: string;
  lieu?: string;
}): Promise<void> {
  // Créer l'événement planning
  const { error } = await supabase
    .from('planning_events')
    .insert({
      titre: params.titre,
      description: params.description,
      date_debut: params.date,
      date_fin: params.date,
      heure_debut: params.heure_debut,
      heure_fin: params.heure_fin,
      type_event: 'travaux',
      technicien_id: params.technicien_id,
      lieu: params.lieu,
      statut: 'planifie',
      travaux_id: params.travaux_id,
      couleur: '#a855f7', // Violet pour les travaux
    });

  if (error) throw error;

  // Mettre à jour le travaux avec les dates
  await supabase
    .from('travaux')
    .update({
      date_debut: params.date,
      technicien_id: params.technicien_id,
    })
    .eq('id', params.travaux_id);

  // Créer une notification
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('notifications').insert({
      user_id: params.technicien_id,
      type: 'planning',
      priority: 'normal',
      titre: 'Nouveau travaux planifié',
      message: `${params.titre} planifié le ${format(parseISO(params.date), 'dd/MM/yyyy', { locale: fr })} à ${params.heure_debut}`,
      lue: false,
      metadata: { travaux_id: params.travaux_id, date: params.date },
    });
  }
}

// =============================================
// COMPOSANT MODAL PLANIFICATION
// =============================================
interface ModalPlanifierProps {
  travaux: Travaux;
  techniciens: Technicien[];
  onClose: () => void;
  onSuccess: () => void;
}

function ModalPlanifier({ travaux, techniciens, onClose, onSuccess }: ModalPlanifierProps) {
  const [date, setDate] = useState(travaux.date_debut || format(new Date(), 'yyyy-MM-dd'));
  const [heureDebut, setHeureDebut] = useState('08:00');
  const [heureFin, setHeureFin] = useState('12:00');
  const [technicienId, setTechnicienId] = useState(travaux.technicien_id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date || !heureDebut || !technicienId) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      await planifierTravaux({
        travaux_id: travaux.id,
        date,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        technicien_id: technicienId,
        titre: `Travaux ${travaux.code}`,
        description: travaux.titre || travaux.description,
        lieu: travaux.adresse,
      });
      toast.success('Travaux planifié avec succès');
      onSuccess();
    } catch (error) {
      toast.error('Erreur lors de la planification');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-md">
        <CardBody className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-[var(--text-primary)]">Planifier travaux</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Infos travaux */}
          <div className="p-4 bg-purple-500/10 border-b border-[var(--border-primary)]">
            <p className="font-semibold text-[var(--text-primary)]">{travaux.code}</p>
            <p className="text-sm text-[var(--text-muted)]">{travaux.titre}</p>
            {travaux.adresse && (
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {travaux.adresse}
              </p>
            )}
          </div>

          {/* Formulaire */}
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                Technicien *
              </label>
              <Select 
                value={technicienId} 
                onChange={e => setTechnicienId(e.target.value)}
                className="w-full"
              >
                <option value="">-- Sélectionner --</option>
                {techniciens.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.prenom} {t.nom}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                Date *
              </label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Heure début *
                </label>
                <Input 
                  type="time" 
                  value={heureDebut} 
                  onChange={e => setHeureDebut(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Heure fin
                </label>
                <Input 
                  type="time" 
                  value={heureFin} 
                  onChange={e => setHeureFin(e.target.value)}
                />
              </div>
            </div>

            {travaux.duree_estimee && (
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Durée estimée: {travaux.duree_estimee}h
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-4 border-t border-[var(--border-primary)]">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Planifier
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// COMPOSANT LISTE TRAVAUX À PLANIFIER
// =============================================
export function TravauxAPlanifier({ onTravauxPlanifie }: { onTravauxPlanifie?: () => void }) {
  const queryClient = useQueryClient();
  const [selectedTravaux, setSelectedTravaux] = useState<Travaux | null>(null);

  const { data: travaux, isLoading } = useQuery({
    queryKey: ['travaux-planifiables'],
    queryFn: getTravauxPlanifiables,
  });

  const { data: techniciens } = useQuery({
    queryKey: ['techniciens-actifs'],
    queryFn: getTechniciens,
  });

  // Filtrer les travaux sans date
  const travauxSansDate = (travaux || []).filter(t => !t.date_debut);
  const travauxAvecDate = (travaux || []).filter(t => t.date_debut);

  const prioriteConfig = {
    urgente: { color: 'text-red-400', bg: 'bg-red-500/20', badge: 'red' as const },
    haute: { color: 'text-amber-400', bg: 'bg-amber-500/20', badge: 'amber' as const },
    normale: { color: 'text-blue-400', bg: 'bg-blue-500/20', badge: 'blue' as const },
    basse: { color: 'text-gray-400', bg: 'bg-gray-500/20', badge: 'gray' as const },
  };

  const handlePlanificationSuccess = () => {
    setSelectedTravaux(null);
    queryClient.invalidateQueries({ queryKey: ['travaux-planifiables'] });
    queryClient.invalidateQueries({ queryKey: ['planning-events'] });
    onTravauxPlanifie?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Travaux sans date (à planifier en priorité) */}
      {travauxSansDate.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            À planifier ({travauxSansDate.length})
          </h4>
          <div className="space-y-2">
            {travauxSansDate.map(t => {
              const config = prioriteConfig[t.priorite];
              return (
                <Card key={t.id} className={`border-l-4 ${config.bg}`} style={{ borderLeftColor: config.color.replace('text-', '#').replace('-400', '') }}>
                  <CardBody className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-[var(--text-primary)]">{t.code}</span>
                          <Badge variant={config.badge} className="text-[10px]">{t.priorite}</Badge>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] truncate">{t.titre}</p>
                        {t.adresse && (
                          <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {t.adresse}
                          </p>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => setSelectedTravaux(t)}
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Planifier
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Travaux déjà planifiés */}
      {travauxAvecDate.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            Planifiés ({travauxAvecDate.length})
          </h4>
          <div className="space-y-2">
            {travauxAvecDate.slice(0, 5).map(t => (
              <Card key={t.id} className="bg-green-500/5 border-green-500/20">
                <CardBody className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm text-[var(--text-primary)]">{t.code}</span>
                      <p className="text-xs text-[var(--text-muted)]">
                        {format(parseISO(t.date_debut!), 'dd/MM/yyyy', { locale: fr })}
                        {t.technicien_nom && ` • ${t.technicien_nom}`}
                      </p>
                    </div>
                    <Badge variant="green" className="text-[10px]">Planifié</Badge>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {travauxSansDate.length === 0 && travauxAvecDate.length === 0 && (
        <div className="text-center py-8">
          <Check className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-[var(--text-muted)]">Tous les travaux sont planifiés</p>
        </div>
      )}

      {/* Modal planification */}
      {selectedTravaux && techniciens && (
        <ModalPlanifier
          travaux={selectedTravaux}
          techniciens={techniciens}
          onClose={() => setSelectedTravaux(null)}
          onSuccess={handlePlanificationSuccess}
        />
      )}
    </div>
  );
}

// =============================================
// COMPOSANT VUE PLANNING AVEC TRAVAUX
// =============================================
export function PlanningTravauxView() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: currentWeekStart, end: weekEnd }).slice(0, 5); // Lun-Ven

  const { data: events, refetch } = useQuery({
    queryKey: ['planning-events', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: () => getPlanningEvents(currentWeekStart, weekEnd),
  });

  // Grouper les événements par jour
  const eventsByDay = days.reduce((acc, day) => {
    acc[format(day, 'yyyy-MM-dd')] = (events || []).filter(e => 
      isSameDay(parseISO(e.date_debut), day)
    );
    return acc;
  }, {} as Record<string, PlanningEvent[]>);

  const typeColors = {
    travaux: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
    tournee: 'bg-lime-500/20 border-lime-500/50 text-lime-400',
    reunion: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    conge: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
    autre: 'bg-gray-500/20 border-gray-500/50 text-gray-400',
  };

  return (
    <div className="space-y-4">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Semaine précédente
        </Button>
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Semaine du {format(currentWeekStart, 'dd MMMM yyyy', { locale: fr })}
        </span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
        >
          Semaine suivante
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Grille planning */}
      <div className="grid grid-cols-5 gap-2">
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dateKey] || [];
          const travauxEvents = dayEvents.filter(e => e.type_event === 'travaux');

          return (
            <div key={dateKey} className="min-h-[150px]">
              <div className={`text-center p-2 rounded-t-lg ${
                isToday(day) ? 'bg-blue-500/20' : 'bg-[var(--bg-secondary)]'
              }`}>
                <p className="text-xs text-[var(--text-muted)]">
                  {format(day, 'EEE', { locale: fr })}
                </p>
                <p className={`text-lg font-bold ${
                  isToday(day) ? 'text-blue-400' : 'text-[var(--text-primary)]'
                }`}>
                  {format(day, 'd')}
                </p>
              </div>
              <div className="border border-[var(--border-primary)] border-t-0 rounded-b-lg p-1 space-y-1 min-h-[100px]">
                {dayEvents.map(event => (
                  <div 
                    key={event.id}
                    className={`p-1.5 rounded text-xs border ${typeColors[event.type_event]}`}
                  >
                    <p className="font-medium truncate">{event.titre}</p>
                    {event.heure_debut && (
                      <p className="text-[10px] opacity-75">{event.heure_debut.slice(0, 5)}</p>
                    )}
                  </div>
                ))}
                {dayEvents.length === 0 && (
                  <p className="text-[10px] text-center text-[var(--text-muted)] py-4">-</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.entries(typeColors).map(([type, classes]) => (
          <div key={type} className={`px-2 py-1 rounded text-xs border ${classes}`}>
            {type === 'travaux' ? '🔧 Travaux' : 
             type === 'tournee' ? '🚗 Tournée' :
             type === 'reunion' ? '👥 Réunion' :
             type === 'conge' ? '🏖️ Congé' : '📌 Autre'}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================
// COMPOSANT COMPLET PLANNING + TRAVAUX
// =============================================
export function PlanningTravaux() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'planning' | 'travaux'>('travaux');

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)] pb-2">
        <button
          onClick={() => setActiveView('travaux')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            activeView === 'travaux'
              ? 'bg-purple-500/20 text-purple-400 font-medium'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Travaux à planifier
        </button>
        <button
          onClick={() => setActiveView('planning')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            activeView === 'planning'
              ? 'bg-blue-500/20 text-blue-400 font-medium'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Vue planning
        </button>
      </div>

      {/* Contenu */}
      {activeView === 'travaux' ? (
        <TravauxAPlanifier 
          onTravauxPlanifie={() => queryClient.invalidateQueries({ queryKey: ['planning-events'] })}
        />
      ) : (
        <PlanningTravauxView />
      )}
    </div>
  );
}

export default PlanningTravaux;
