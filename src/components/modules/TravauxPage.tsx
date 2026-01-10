import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Calendar, User, Building2, X, Eye, Edit, CalendarCheck, AlertTriangle, Clock, Archive } from 'lucide-react';
import { Button, Card, CardBody, Badge, ProgressBar, Input, Select } from '@/components/ui';
import { getTravaux, updateTravaux, createTravaux, getAscenseurs, archiveTravaux } from '@/services/api';
import { supabase } from '@/services/supabase';
import { ContextChat } from './ChatPage';
import { ContextNotes } from './NotesPage';
import { ArchiveModal } from './ArchivesPage';
import type { Travaux, StatutTravaux, Priorite } from '@/types';
import { format, parseISO, differenceInDays, isAfter, isBefore, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const STATUT_CONFIG: Record<StatutTravaux, { label: string; color: 'blue' | 'amber' | 'purple' | 'green' | 'gray' }> = {
  planifie: { label: 'Planifié', color: 'blue' },
  en_cours: { label: 'En cours', color: 'amber' },
  en_attente: { label: 'En attente', color: 'purple' },
  termine: { label: 'Terminé', color: 'green' },
  annule: { label: 'Annulé', color: 'gray' },
};

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: 'gray' | 'blue' | 'amber' | 'red' }> = {
  basse: { label: 'Basse', color: 'gray' },
  normale: { label: 'Normale', color: 'blue' },
  haute: { label: 'Haute', color: 'amber' },
  urgente: { label: 'Urgente', color: 'red' },
};

const TYPE_TRAVAUX = [
  { value: 'reparation', label: 'Réparation' },
  { value: 'modernisation', label: 'Modernisation' },
  { value: 'installation', label: 'Installation' },
  { value: 'mise_conformite', label: 'Mise en conformité' },
  { value: 'depannage', label: 'Dépannage' },
];

// Fonction pour calculer l'urgence de la date butoir
function getDateButoirStatus(dateButoir: string | undefined, statut: StatutTravaux) {
  if (!dateButoir || statut === 'termine' || statut === 'annule') return null;
  
  const butoir = parseISO(dateButoir);
  const today = new Date();
  const daysLeft = differenceInDays(butoir, today);
  
  if (daysLeft < 0) {
    return { label: `Dépassée (${Math.abs(daysLeft)}j)`, color: 'red', icon: AlertTriangle, urgent: true };
  } else if (daysLeft === 0) {
    return { label: "Aujourd'hui !", color: 'red', icon: AlertTriangle, urgent: true };
  } else if (daysLeft <= 3) {
    return { label: `${daysLeft}j restants`, color: 'red', icon: Clock, urgent: true };
  } else if (daysLeft <= 7) {
    return { label: `${daysLeft}j restants`, color: 'amber', icon: Clock, urgent: false };
  } else if (daysLeft <= 14) {
    return { label: `${daysLeft}j restants`, color: 'amber', icon: Calendar, urgent: false };
  } else {
    return { label: format(butoir, 'd MMM', { locale: fr }), color: 'gray', icon: Calendar, urgent: false };
  }
}

// Composant Badge Date Butoir
function DateButoirBadge({ dateButoir, statut }: { dateButoir?: string; statut: StatutTravaux }) {
  const status = getDateButoirStatus(dateButoir, statut);
  if (!status) return null;

  const Icon = status.icon;
  const colorClasses: Record<string, string> = {
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    gray: 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] border-dark-500',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses[status.color]} ${status.urgent ? 'animate-pulse' : ''}`}>
      <Icon className="w-3 h-3" />
      {status.label}
    </span>
  );
}

// Modal création/édition (sans champ date planification)
function TravauxFormModal({ travaux, onClose, onSave }: { travaux?: Travaux; onClose: () => void; onSave: (data: Partial<Travaux>) => void }) {
  const [form, setForm] = useState({
    titre: travaux?.titre || '',
    description: travaux?.description || '',
    type_travaux: travaux?.type_travaux || 'reparation',
    priorite: travaux?.priorite || 'normale',
    statut: travaux?.statut || 'planifie',
    client_id: travaux?.client_id || '',
    ascenseur_id: travaux?.ascenseur_id || '',
    technicien_id: travaux?.technicien_id || '',
    date_butoir: travaux?.date_butoir || '',
    devis_montant: travaux?.devis_montant || '',
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('actif', true).order('raison_sociale');
      return data || [];
    },
  });

  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });

  const { data: techniciens } = useQuery({
    queryKey: ['techniciens'],
    queryFn: async () => {
      const { data } = await supabase.from('techniciens').select('*, role:roles(*)').eq('actif', true).order('nom');
      return data || [];
    },
  });

  const techs = techniciens?.filter(t => t.role?.code === 'technicien' || t.role?.code === 'chef_equipe') || [];
  const filteredAscenseurs = form.client_id ? ascenseurs?.filter(a => a.client_id === form.client_id) : ascenseurs;

  const handleSubmit = () => {
    if (!form.titre) {
      toast.error('Le titre est requis');
      return;
    }
    onSave({
      ...form,
      devis_montant: form.devis_montant ? parseFloat(form.devis_montant as string) : undefined,
      date_butoir: form.date_butoir || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{travaux ? 'Modifier le travaux' : 'Nouveau travaux'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Titre *</label>
              <Input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Ex: Remplacement variateur" />
            </div>

            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] placeholder-dark-500 focus:outline-none focus:border-purple-500 resize-none"
                rows={3}
                placeholder="Détails du travaux..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Type de travaux</label>
                <Select value={form.type_travaux} onChange={e => setForm({ ...form, type_travaux: e.target.value as any })}>
                  {TYPE_TRAVAUX.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Priorité</label>
                <Select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as any })}>
                  {Object.entries(PRIORITE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Client</label>
                <Select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, ascenseur_id: '' })}>
                  <option value="">Sélectionner...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Ascenseur</label>
                <Select value={form.ascenseur_id} onChange={e => setForm({ ...form, ascenseur_id: e.target.value })}>
                  <option value="">Sélectionner...</option>
                  {filteredAscenseurs?.map(a => <option key={a.id} value={a.id}>{a.code} - {a.adresse}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Technicien assigné</label>
              <Select value={form.technicien_id} onChange={e => setForm({ ...form, technicien_id: e.target.value })}>
                <option value="">Non assigné</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
              </Select>
            </div>

            {/* Date butoir */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Date butoir (optionnel)</span>
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Date limite de réalisation</label>
                <input
                  type="date"
                  value={form.date_butoir}
                  onChange={e => setForm({ ...form, date_butoir: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-dark-500 rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">Un indicateur visuel s'affichera à l'approche de cette date</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Montant devis (€)</label>
              <Input type="number" step="0.01" value={form.devis_montant} onChange={e => setForm({ ...form, devis_montant: e.target.value })} placeholder="0.00" />
            </div>

            {travaux && (
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Statut</label>
                <Select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value as any })}>
                  {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                {travaux ? 'Enregistrer' : 'Créer le travaux'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal détail
function TravauxDetailModal({ 
  travaux, 
  planningDate, 
  onClose, 
  onEdit,
  onArchive 
}: { 
  travaux: Travaux; 
  planningDate?: string; 
  onClose: () => void; 
  onEdit: () => void;
  onArchive: () => void;
}) {
  const butoirStatus = getDateButoirStatus(travaux.date_butoir, travaux.statut);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[550px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-purple-400 font-semibold">{travaux.code}</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{travaux.titre}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onArchive} className="p-2 hover:bg-amber-500/20 rounded-lg" title="Archiver">
                <Archive className="w-5 h-5 text-[var(--text-tertiary)] hover:text-amber-400" />
              </button>
              <button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg" title="Modifier">
                <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>

          {travaux.description && <p className="text-[var(--text-tertiary)] mb-4">{travaux.description}</p>}

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge variant={STATUT_CONFIG[travaux.statut].color}>{STATUT_CONFIG[travaux.statut].label}</Badge>
            <Badge variant={PRIORITE_CONFIG[travaux.priorite].color}>{PRIORITE_CONFIG[travaux.priorite].label}</Badge>
            <Badge variant="purple">{TYPE_TRAVAUX.find(t => t.value === travaux.type_travaux)?.label}</Badge>
            {planningDate && (
              <Badge variant="green" className="flex items-center gap-1">
                <CalendarCheck className="w-3 h-3" />
                Planifié le {format(parseISO(planningDate), 'd MMM yyyy', { locale: fr })}
              </Badge>
            )}
          </div>

          {/* Alerte date butoir */}
          {butoirStatus && butoirStatus.urgent && (
            <div className={`p-3 rounded-xl mb-4 flex items-center gap-3 ${
              butoirStatus.color === 'red' ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${butoirStatus.color === 'red' ? 'text-red-400' : 'text-amber-400'}`} />
              <div>
                <div className={`text-sm font-semibold ${butoirStatus.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                  Date butoir : {format(parseISO(travaux.date_butoir!), 'd MMMM yyyy', { locale: fr })}
                </div>
                <div className={`text-xs ${butoirStatus.color === 'red' ? 'text-red-300' : 'text-amber-300'}`}>
                  {butoirStatus.label}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4">
            {travaux.client && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                <div><span className="text-[var(--text-tertiary)] text-sm">Client:</span> <span className="text-[var(--text-primary)]">{travaux.client.raison_sociale}</span></div>
              </div>
            )}
            {travaux.ascenseur && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                <div><span className="text-[var(--text-tertiary)] text-sm">Ascenseur:</span> <span className="text-[var(--text-primary)]">{travaux.ascenseur.code}</span></div>
              </div>
            )}
            {travaux.technicien && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <div><span className="text-[var(--text-tertiary)] text-sm">Technicien:</span> <span className="text-[var(--text-primary)]">{travaux.technicien.prenom} {travaux.technicien.nom}</span></div>
              </div>
            )}
            {travaux.date_butoir && !butoirStatus?.urgent && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <div><span className="text-[var(--text-tertiary)] text-sm">Date butoir:</span> <span className="text-[var(--text-primary)]">{format(parseISO(travaux.date_butoir), 'd MMMM yyyy', { locale: fr })}</span></div>
              </div>
            )}
            {travaux.devis_montant && (
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 text-[var(--text-muted)] text-center">€</span>
                <div><span className="text-[var(--text-tertiary)] text-sm">Devis:</span> <span className="text-[var(--text-primary)] font-mono">{travaux.devis_montant.toFixed(2)} €</span></div>
              </div>
            )}
          </div>

          {!planningDate && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4 text-sm text-amber-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Non planifié - Allez dans le Planning pour planifier ce travaux
            </div>
          )}

          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--text-tertiary)]">Progression</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{travaux.progression}%</span>
            </div>
            <ProgressBar value={travaux.progression} variant={travaux.progression >= 100 ? 'green' : 'purple'} />
          </div>

          {/* Chat contextuel */}
          <ContextChat 
            contextType="travaux" 
            contextId={travaux.id} 
            contextLabel={travaux.code}
          />

          {/* Notes contextuelles */}
          <ContextNotes 
            contextType="travaux" 
            contextId={travaux.id} 
            contextLabel={travaux.code}
          />

          <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            <Button variant="primary" className="flex-1" onClick={onEdit}>
              <Edit className="w-4 h-4" /> Modifier
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function TravauxPage() {
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editTravaux, setEditTravaux] = useState<Travaux | null>(null);
  const [detailTravaux, setDetailTravaux] = useState<Travaux | null>(null);
  const [archiveItem, setArchiveItem] = useState<Travaux | null>(null);
  const queryClient = useQueryClient();

  const { data: travaux } = useQuery({ queryKey: ['travaux'], queryFn: () => getTravaux() });
  
  const { data: planningEvents } = useQuery({
    queryKey: ['planning-events-travaux'],
    queryFn: async () => {
      const { data } = await supabase.from('planning_events').select('travaux_id, date_debut').not('travaux_id', 'is', null);
      return data || [];
    },
  });

  const getPlanningDate = (travauxId: string) => {
    const event = planningEvents?.find(e => e.travaux_id === travauxId);
    return event?.date_debut;
  };

  const createMutation = useMutation({
    mutationFn: createTravaux,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      toast.success('Travaux créé');
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Travaux> }) => updateTravaux(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      toast.success('Travaux mis à jour');
      setEditTravaux(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveTravaux(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      toast.success('Travaux archivé');
      setArchiveItem(null);
      setDetailTravaux(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'archivage");
    },
  });

  const filtered = travaux?.filter(t => {
    const matchSearch = t.code.toLowerCase().includes(search.toLowerCase()) || t.titre.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' || t.statut === filterStatut;
    return matchSearch && matchStatut;
  }) || [];

  // Trier par urgence (date butoir dépassée en premier)
  const sorted = [...filtered].sort((a, b) => {
    const statusA = getDateButoirStatus(a.date_butoir, a.statut);
    const statusB = getDateButoirStatus(b.date_butoir, b.statut);
    
    if (statusA?.urgent && !statusB?.urgent) return -1;
    if (!statusA?.urgent && statusB?.urgent) return 1;
    
    if (a.date_butoir && b.date_butoir) {
      return new Date(a.date_butoir).getTime() - new Date(b.date_butoir).getTime();
    }
    if (a.date_butoir && !b.date_butoir) return -1;
    if (!a.date_butoir && b.date_butoir) return 1;
    
    return 0;
  });

  const stats = {
    total: travaux?.length || 0,
    en_cours: travaux?.filter(t => t.statut === 'en_cours').length || 0,
    planifie: travaux?.filter(t => t.statut === 'planifie').length || 0,
    urgent: travaux?.filter(t => {
      const status = getDateButoirStatus(t.date_butoir, t.statut);
      return status?.urgent;
    }).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--text-primary)]' },
          { label: 'En cours', value: stats.en_cours, color: 'text-amber-400' },
          { label: 'Planifiés', value: stats.planifie, color: 'text-blue-400' },
          { label: 'Urgents', value: stats.urgent, color: 'text-red-400' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="text-center">
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
          </div>
          <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-40">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nouveau travaux</Button>
      </div>

      <Card>
        <div className="divide-y divide-dark-600">
          {sorted.map(t => {
            const planningDate = getPlanningDate(t.id);
            const butoirStatus = getDateButoirStatus(t.date_butoir, t.statut);
            return (
              <div key={t.id} className={`p-5 hover:bg-[var(--bg-tertiary)]/30 transition-colors ${butoirStatus?.urgent ? 'bg-red-500/5' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => setDetailTravaux(t)}>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-bold text-purple-400">{t.code}</span>
                      <Badge variant={STATUT_CONFIG[t.statut].color}>{STATUT_CONFIG[t.statut].label}</Badge>
                      <Badge variant={PRIORITE_CONFIG[t.priorite].color}>{PRIORITE_CONFIG[t.priorite].label}</Badge>
                      {planningDate && (
                        <Badge variant="green" className="flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" />
                          {format(parseISO(planningDate), 'd MMM', { locale: fr })}
                        </Badge>
                      )}
                      {butoirStatus && <DateButoirBadge dateButoir={t.date_butoir} statut={t.statut} />}
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{t.titre}</h3>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                      {t.client && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {t.client.raison_sociale}</span>}
                      {t.technicien && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {t.technicien.prenom} {t.technicien.nom}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{t.progression}%</div>
                      <div className="w-24"><ProgressBar value={t.progression} variant={t.progression >= 100 ? 'green' : 'amber'} /></div>
                    </div>
                    <button onClick={() => setDetailTravaux(t)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                      <Eye className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-[var(--text-muted)]">Aucun travaux trouvé</div>}
        </div>
      </Card>

      {showForm && (
        <TravauxFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} />
      )}
      {editTravaux && (
        <TravauxFormModal travaux={editTravaux} onClose={() => setEditTravaux(null)} onSave={data => updateMutation.mutate({ id: editTravaux.id, data })} />
      )}
      {detailTravaux && (
        <TravauxDetailModal 
          travaux={detailTravaux} 
          planningDate={getPlanningDate(detailTravaux.id)} 
          onClose={() => setDetailTravaux(null)} 
          onEdit={() => { setEditTravaux(detailTravaux); setDetailTravaux(null); }} 
          onArchive={() => { setArchiveItem(detailTravaux); }}
        />
      )}
      {archiveItem && (
        <ArchiveModal
          type="travaux"
          code={archiveItem.code}
          libelle={archiveItem.titre}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
