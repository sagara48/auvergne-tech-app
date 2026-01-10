import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X, Calendar, User, MapPin, Edit, CalendarCheck, Archive } from 'lucide-react';
import { Card, CardBody, Badge, Button, Select } from '@/components/ui';
import { getMiseEnServices, updateMiseEnService, getAscenseurs, archiveMiseEnService } from '@/services/api';
import { supabase } from '@/services/supabase';
import { ContextChat } from './ChatPage';
import { ContextNotes } from './NotesPage';
import { ArchiveModal } from './ArchivesPage';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ID utilisateur actuel
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const ETAPES = [
  { num: 1, label: 'Préparation', field: 'etape1_preparation' },
  { num: 2, label: 'Vérif. électrique', field: 'etape2_verification_electrique' },
  { num: 3, label: 'Vérif. mécanique', field: 'etape3_verification_mecanique' },
  { num: 4, label: 'Essais à vide', field: 'etape4_essais_vide' },
  { num: 5, label: 'Essais en charge', field: 'etape5_essais_charge' },
  { num: 6, label: 'Sécurités', field: 'etape6_securites' },
  { num: 7, label: 'Validation', field: 'etape7_validation' },
];

// Modal création/édition MES (sans champ date)
function MESFormModal({ mes, onClose, onSave }: { mes?: any; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    ascenseur_id: mes?.ascenseur_id || '',
    technicien_id: mes?.technicien_id || '',
    statut: mes?.statut || 'planifie',
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
  const ascenseursDisponibles = ascenseurs?.filter(a => a.statut !== 'en_panne') || [];

  const handleSubmit = () => {
    if (!form.ascenseur_id) {
      toast.error('L\'ascenseur est requis');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{mes ? 'Modifier la MES' : 'Nouvelle mise en service'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Ascenseur *</label>
              <Select value={form.ascenseur_id} onChange={e => setForm({ ...form, ascenseur_id: e.target.value })}>
                <option value="">Sélectionner un ascenseur...</option>
                {ascenseursDisponibles.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.adresse} ({a.client?.raison_sociale})</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Technicien assigné</label>
              <Select value={form.technicien_id} onChange={e => setForm({ ...form, technicien_id: e.target.value })}>
                <option value="">Non assigné</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
              </Select>
            </div>

            {mes && (
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Statut</label>
                <Select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>
                  <option value="planifie">Planifiée</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminée</option>
                </Select>
              </div>
            )}

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-sm text-[var(--text-tertiary)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" />
              La date de planification se définit dans le module Planning
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                {mes ? 'Enregistrer' : 'Créer la MES'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal détail MES
function MESDetailModal({ mes, planningDate, onClose, onEdit, onArchive }: { mes: any; planningDate?: string; onClose: () => void; onEdit: () => void; onArchive: () => void }) {
  const queryClient = useQueryClient();
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMiseEnService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Étape mise à jour');
    },
  });

  const toggleEtape = (field: string, currentValue: boolean) => {
    updateMutation.mutate({ id: mes.id, data: { [field]: !currentValue } });
  };

  const completedSteps = ETAPES.filter(e => mes[e.field]).length;
  const progress = Math.round((completedSteps / 7) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-orange-400 font-semibold">{mes.code}</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Mise en service</h2>
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

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge variant={mes.statut === 'termine' ? 'green' : mes.statut === 'en_cours' ? 'amber' : 'blue'}>
              {mes.statut === 'termine' ? 'Terminée' : mes.statut === 'en_cours' ? 'En cours' : 'Planifiée'}
            </Badge>
            <Badge variant="orange">{progress}% complété</Badge>
            {planningDate && (
              <Badge variant="green" className="flex items-center gap-1">
                <CalendarCheck className="w-3 h-3" />
                Planifié le {format(parseISO(planningDate), 'd MMM yyyy', { locale: fr })}
              </Badge>
            )}
          </div>

          {/* Infos */}
          <div className="space-y-3 p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4">
            {mes.ascenseur && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <div className="text-sm text-[var(--text-primary)] font-semibold">{mes.ascenseur.code}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{mes.ascenseur.adresse}, {mes.ascenseur.ville}</div>
                </div>
              </div>
            )}
            {mes.technicien && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[var(--text-muted)]" />
                <div><span className="text-[var(--text-tertiary)] text-sm">Technicien:</span> <span className="text-[var(--text-primary)]">{mes.technicien.prenom} {mes.technicien.nom}</span></div>
              </div>
            )}
          </div>

          {!planningDate && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4 text-sm text-amber-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Non planifié - Allez dans le Planning pour planifier cette MES
            </div>
          )}

          {/* Étapes interactives */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Étapes de mise en service</h3>
            <div className="space-y-2">
              {ETAPES.map((etape) => {
                const completed = mes[etape.field];
                return (
                  <div
                    key={etape.num}
                    onClick={() => toggleEtape(etape.field, completed)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      completed ? 'bg-green-500/20 border border-green-500/30' : 'bg-[var(--bg-elevated)] border border-dark-500 hover:border-dark-400'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      completed ? 'bg-green-500 text-[var(--text-primary)]' : 'bg-dark-500 text-[var(--text-secondary)]'
                    }`}>
                      {completed ? <Check className="w-4 h-4" /> : etape.num}
                    </div>
                    <span className={completed ? 'text-green-400' : 'text-[var(--text-secondary)]'}>{etape.label}</span>
                    {completed && <Check className="w-4 h-4 text-green-400 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat contextuel */}
          <ContextChat 
            contextType="mise_service" 
            contextId={mes.id} 
            contextLabel={mes.code}
          />

          {/* Notes contextuelles */}
          <ContextNotes 
            contextType="mise_service" 
            contextId={mes.id} 
            contextLabel={mes.code}
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

export function MiseEnServicePage() {
  const [showForm, setShowForm] = useState(false);
  const [editMES, setEditMES] = useState<any>(null);
  const [detailMES, setDetailMES] = useState<any>(null);
  const [archiveItem, setArchiveItem] = useState<any>(null);
  const queryClient = useQueryClient();
  
  const { data: miseEnServices } = useQuery({ queryKey: ['mise-en-service'], queryFn: () => getMiseEnServices() });

  // Récupérer les dates de planification depuis planning_events
  const { data: planningEvents } = useQuery({
    queryKey: ['planning-events-mes'],
    queryFn: async () => {
      const { data } = await supabase.from('planning_events').select('mise_service_id, date_debut').not('mise_service_id', 'is', null);
      return data || [];
    },
  });

  const getPlanningDate = (mesId: string) => {
    const event = planningEvents?.find(e => e.mise_service_id === mesId);
    return event?.date_debut;
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const code = `MES-${String(Date.now()).slice(-6)}`;
      const { data: result, error } = await supabase.from('mise_en_service').insert({ ...data, code }).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Mise en service créée');
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMiseEnService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Mise en service mise à jour');
      setEditMES(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveMiseEnService(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      toast.success('Mise en service archivée');
      setArchiveItem(null);
      setDetailMES(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'archivage");
    },
  });

  const getProgress = (mes: any) => {
    const completed = ETAPES.filter(e => mes[e.field]).length;
    return Math.round((completed / 7) * 100);
  };

  const stats = {
    total: miseEnServices?.length || 0,
    planifie: miseEnServices?.filter(m => m.statut === 'planifie').length || 0,
    en_cours: miseEnServices?.filter(m => m.statut === 'en_cours').length || 0,
    termine: miseEnServices?.filter(m => m.statut === 'termine').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--text-primary)]' },
          { label: 'Planifiées', value: stats.planifie, color: 'text-blue-400' },
          { label: 'En cours', value: stats.en_cours, color: 'text-amber-400' },
          { label: 'Terminées', value: stats.termine, color: 'text-green-400' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="text-center">
              <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouvelle mise en service
        </Button>
      </div>

      <div className="space-y-4">
        {miseEnServices?.map(mes => {
          const planningDate = getPlanningDate(mes.id);
          return (
            <Card key={mes.id} className="hover:border-orange-500/30 transition-colors cursor-pointer" onClick={() => setDetailMES(mes)}>
              <CardBody>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-orange-400">{mes.code}</span>
                      <Badge variant={mes.statut === 'termine' ? 'green' : mes.statut === 'en_cours' ? 'amber' : 'blue'}>
                        {mes.statut === 'termine' ? 'Terminée' : mes.statut === 'en_cours' ? 'En cours' : 'Planifiée'}
                      </Badge>
                      {planningDate && (
                        <Badge variant="green" className="flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" />
                          {format(parseISO(planningDate), 'd MMM', { locale: fr })}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-tertiary)]">
                      {mes.ascenseur?.code} - {mes.ascenseur?.adresse}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                      {mes.technicien && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {mes.technicien.prenom} {mes.technicien.nom}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{getProgress(mes)}%</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Étape {mes.etape_actuelle}/7</div>
                  </div>
                </div>

                <div className="flex gap-1">
                  {ETAPES.map(etape => (
                    <div
                      key={etape.num}
                      className={`flex-1 h-2 rounded-full ${mes[etape.field] ? 'bg-orange-500' : 'bg-[var(--bg-elevated)]'}`}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })}

        {(!miseEnServices || miseEnServices.length === 0) && (
          <Card>
            <CardBody className="text-center py-12 text-[var(--text-muted)]">
              Aucune mise en service
            </CardBody>
          </Card>
        )}
      </div>

      {showForm && (
        <MESFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} />
      )}
      {editMES && (
        <MESFormModal mes={editMES} onClose={() => setEditMES(null)} onSave={data => updateMutation.mutate({ id: editMES.id, data })} />
      )}
      {detailMES && (
        <MESDetailModal 
          mes={detailMES} 
          planningDate={getPlanningDate(detailMES.id)} 
          onClose={() => setDetailMES(null)} 
          onEdit={() => { setEditMES(detailMES); setDetailMES(null); }}
          onArchive={() => setArchiveItem(detailMES)}
        />
      )}
      {archiveItem && (
        <ArchiveModal
          type="mise_en_service"
          code={archiveItem.code}
          libelle={`MES ${archiveItem.code} - ${archiveItem.ascenseur?.code || ''}`}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
