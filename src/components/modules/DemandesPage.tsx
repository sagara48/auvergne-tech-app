import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Search, Check, X, Clock, Package, Calendar, GraduationCap, Plus, User, Archive, Eye } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getDemandes, updateDemande, archiveDemande } from '@/services/api';
import { ArchiveModal } from './ArchivesPage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDemande, StatutDemande, Priorite, Demande } from '@/types';
import toast from 'react-hot-toast';

// ID utilisateur actuel
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const TYPE_CONFIG: Record<TypeDemande, { label: string; icon: any; color: string }> = {
  piece: { label: 'Pièce', icon: Package, color: '#3b82f6' },
  conge: { label: 'Congé', icon: Calendar, color: '#06b6d4' },
  materiel: { label: 'Matériel', icon: Package, color: '#f59e0b' },
  formation: { label: 'Formation', icon: GraduationCap, color: '#a855f7' },
  autre: { label: 'Autre', icon: HelpCircle, color: '#71717a' },
};

const STATUT_CONFIG: Record<StatutDemande, { label: string; color: 'amber' | 'green' | 'red' | 'blue' | 'purple' }> = {
  en_attente: { label: 'En attente', color: 'amber' },
  approuve: { label: 'Approuvée', color: 'green' },
  refuse: { label: 'Refusée', color: 'red' },
  en_cours: { label: 'En cours', color: 'blue' },
  termine: { label: 'Terminée', color: 'purple' },
};

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: 'gray' | 'blue' | 'amber' | 'red' }> = {
  basse: { label: 'Basse', color: 'gray' },
  normale: { label: 'Normale', color: 'blue' },
  haute: { label: 'Haute', color: 'amber' },
  urgente: { label: 'Urgente', color: 'red' },
};

export function DemandesPage() {
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [archiveItem, setArchiveItem] = useState<Demande | null>(null);
  const queryClient = useQueryClient();

  const { data: demandes } = useQuery({ queryKey: ['demandes'], queryFn: () => getDemandes() });

  const updateMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutDemande }) => updateDemande(id, { statut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success('Demande mise à jour');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveDemande(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      toast.success('Demande archivée');
      setArchiveItem(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'archivage");
    },
  });

  const filtered = demandes?.filter(d => filterStatut === 'all' || d.statut === filterStatut) || [];

  const stats = {
    total: demandes?.length || 0,
    en_attente: demandes?.filter(d => d.statut === 'en_attente').length || 0,
    approuve: demandes?.filter(d => d.statut === 'approuve').length || 0,
    refuse: demandes?.filter(d => d.statut === 'refuse').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Total</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">{stats.en_attente}</div>
              <div className="text-xs text-[var(--text-tertiary)]">En attente</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-green-400">{stats.approuve}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Approuvées</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-red-400">{stats.refuse}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Refusées</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between">
        <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-48">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Button variant="primary"><Plus className="w-4 h-4" /> Nouvelle demande</Button>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {filtered.map(demande => {
          const typeConfig = TYPE_CONFIG[demande.type_demande];
          const Icon = typeConfig.icon;
          return (
            <Card key={demande.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${typeConfig.color}20` }}>
                      <Icon className="w-6 h-6" style={{ color: typeConfig.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-pink-400">{demande.code}</span>
                        <Badge variant={STATUT_CONFIG[demande.statut].color}>{STATUT_CONFIG[demande.statut].label}</Badge>
                        <Badge variant={PRIORITE_CONFIG[demande.priorite].color}>{PRIORITE_CONFIG[demande.priorite].label}</Badge>
                      </div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{demande.objet}</h3>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                        {demande.technicien && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {demande.technicien.prenom} {demande.technicien.nom}
                          </span>
                        )}
                        <span>{format(new Date(demande.created_at), 'd MMM yyyy', { locale: fr })}</span>
                        <Badge variant="gray">{typeConfig.label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {demande.statut === 'en_attente' && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: demande.id, statut: 'approuve' })}
                        >
                          <Check className="w-4 h-4" /> Approuver
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: demande.id, statut: 'refuse' })}
                        >
                          <X className="w-4 h-4" /> Refuser
                        </Button>
                      </>
                    )}
                    <button
                      onClick={() => setArchiveItem(demande)}
                      className="p-2 hover:bg-amber-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-amber-400"
                      title="Archiver"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card><CardBody className="text-center py-12 text-[var(--text-muted)]">Aucune demande</CardBody></Card>
        )}
      </div>

      {/* Modal archivage */}
      {archiveItem && (
        <ArchiveModal
          type="demande"
          code={archiveItem.code}
          libelle={archiveItem.objet}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
