import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, Plus, Search, Package, Truck, Check, X, Eye, Edit, 
  Archive, Calendar, User, Clock, AlertTriangle,
  ChevronRight, FileText, Trash2
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getCommandes, createCommande, updateCommande, archiveCommande,
  addCommandeLigne, deleteCommandeLigne
} from '@/services/api';
import { supabase } from '@/services/supabase';
import { ArchiveModal } from './ArchivesPage';
import { usePanierStore } from '@/stores/panierStore';
import { AddToPanierModal } from '@/components/Panier';
import type { Commande, CommandeLigne, StatutCommande, Priorite } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ID utilisateur actuel
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Configuration des statuts
const STATUT_CONFIG: Record<StatutCommande, { label: string; color: 'gray' | 'amber' | 'blue' | 'purple' | 'cyan' | 'green' | 'red'; icon: any }> = {
  brouillon: { label: 'Brouillon', color: 'gray', icon: FileText },
  en_attente: { label: 'En attente', color: 'amber', icon: Clock },
  validee: { label: 'Validée', color: 'blue', icon: Check },
  commandee: { label: 'Commandée', color: 'purple', icon: ShoppingCart },
  expediee: { label: 'Expédiée', color: 'cyan', icon: Truck },
  recue: { label: 'Reçue', color: 'green', icon: Package },
  annulee: { label: 'Annulée', color: 'red', icon: X },
};

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: 'gray' | 'blue' | 'amber' | 'red' }> = {
  basse: { label: 'Basse', color: 'gray' },
  normale: { label: 'Normale', color: 'blue' },
  haute: { label: 'Haute', color: 'amber' },
  urgente: { label: 'Urgente', color: 'red' },
};

const FOURNISSEURS = [
  'Otis Parts',
  'Schindler Supply',
  'Thyssen Parts',
  'Kone Express',
  'Mitsubishi Electric',
  'Autre',
];

// Modal création/édition commande
function CommandeFormModal({ 
  commande, 
  onClose, 
  onSave 
}: { 
  commande?: Commande; 
  onClose: () => void; 
  onSave: (data: Partial<Commande>) => void;
}) {
  const [form, setForm] = useState({
    fournisseur: commande?.fournisseur || '',
    reference_fournisseur: commande?.reference_fournisseur || '',
    priorite: commande?.priorite || 'normale',
    date_livraison_prevue: commande?.date_livraison_prevue || '',
    notes: commande?.notes || '',
  });

  const handleSubmit = () => {
    if (!form.fournisseur) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    onSave({
      ...form,
      technicien_id: CURRENT_USER_ID,
      statut: commande?.statut || 'brouillon',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {commande ? 'Modifier la commande' : 'Nouvelle commande'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fournisseur *</label>
              <Select value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })}>
                <option value="">Sélectionner...</option>
                {FOURNISSEURS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Référence fournisseur</label>
              <Input 
                value={form.reference_fournisseur} 
                onChange={e => setForm({ ...form, reference_fournisseur: e.target.value })}
                placeholder="Ex: OT-2024-789"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Priorité</label>
                <Select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value as Priorite })}>
                  {Object.entries(PRIORITE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Livraison prévue</label>
                <Input 
                  type="date"
                  value={form.date_livraison_prevue} 
                  onChange={e => setForm({ ...form, date_livraison_prevue: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                placeholder="Notes ou commentaires..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit}>
              {commande ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal pour ajouter un article manuellement à une commande
function AddLigneModal({
  commandeId,
  onClose,
  onSuccess
}: {
  commandeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    designation: '',
    reference: '',
    quantite: 1,
    notes: '',
  });

  const addMutation = useMutation({
    mutationFn: () => addCommandeLigne({
      commande_id: commandeId,
      designation: form.designation,
      reference: form.reference,
      quantite: form.quantite,
      notes: form.notes,
    }),
    onSuccess: () => {
      toast.success('Article ajouté');
      onSuccess();
      onClose();
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const handleSubmit = () => {
    if (!form.designation) {
      toast.error('Veuillez saisir une désignation');
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Ajouter un article</h3>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Désignation *</label>
              <Input
                value={form.designation}
                onChange={e => setForm({ ...form, designation: e.target.value })}
                placeholder="Ex: Contacteur 40A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Référence</label>
              <Input
                value={form.reference}
                onChange={e => setForm({ ...form, reference: e.target.value })}
                placeholder="Ex: CT-40A-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Quantité</label>
              <Input
                type="number"
                min={1}
                value={form.quantite}
                onChange={e => setForm({ ...form, quantite: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
              <Input
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Remarques..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              onClick={handleSubmit}
              disabled={addMutation.isPending}
            >
              <Plus className="w-4 h-4" /> Ajouter
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal détail commande avec lignes
function CommandeDetailModal({ 
  commande, 
  onClose, 
  onEdit,
  onArchive,
  onStatusChange,
  onRefresh
}: { 
  commande: Commande; 
  onClose: () => void; 
  onEdit: () => void;
  onArchive: () => void;
  onStatusChange: (statut: StatutCommande) => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddLigne, setShowAddLigne] = useState(false);

  const statusConfig = STATUT_CONFIG[commande.statut];
  const StatusIcon = statusConfig.icon;

  // Supprimer ligne
  const deleteLigneMutation = useMutation({
    mutationFn: (ligneId: string) => deleteCommandeLigne(ligneId, commande.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Article supprimé');
      onRefresh();
    },
  });

  // Marquer ligne comme reçue
  const markReceivedMutation = useMutation({
    mutationFn: async ({ ligneId, quantite }: { ligneId: string; quantite: number }) => {
      const { error } = await supabase
        .from('commande_lignes')
        .update({ quantite_recue: quantite })
        .eq('id', ligneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Quantité reçue mise à jour');
      onRefresh();
    },
  });

  // Workflow des statuts
  const getNextStatus = (): StatutCommande | null => {
    switch (commande.statut) {
      case 'brouillon': return 'en_attente';
      case 'en_attente': return 'validee';
      case 'validee': return 'commandee';
      case 'commandee': return 'expediee';
      case 'expediee': return 'recue';
      default: return null;
    }
  };

  const nextStatus = getNextStatus();
  const totalArticles = commande.lignes?.reduce((sum, l) => sum + l.quantite, 0) || 0;
  const totalRecus = commande.lignes?.reduce((sum, l) => sum + (l.quantite_recue || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[650px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-cyan-400 font-semibold">{commande.code}</div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{commande.fournisseur}</h2>
              {commande.reference_fournisseur && (
                <div className="text-sm text-[var(--text-tertiary)]">Réf: {commande.reference_fournisseur}</div>
              )}
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
            <Badge variant={statusConfig.color} className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
            <Badge variant={PRIORITE_CONFIG[commande.priorite].color}>
              {PRIORITE_CONFIG[commande.priorite].label}
            </Badge>
            <Badge variant="cyan" className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {totalArticles} article(s)
            </Badge>
            {totalRecus > 0 && (
              <Badge variant="green" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                {totalRecus} reçu(s)
              </Badge>
            )}
          </div>

          {/* Infos */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {commande.technicien && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <User className="w-4 h-4 text-[var(--text-tertiary)]" />
                {commande.technicien.prenom} {commande.technicien.nom}
              </div>
            )}
            {commande.date_livraison_prevue && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Calendar className="w-4 h-4 text-[var(--text-tertiary)]" />
                Livraison: {format(parseISO(commande.date_livraison_prevue), 'd MMM yyyy', { locale: fr })}
              </div>
            )}
            {commande.date_commande && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <ShoppingCart className="w-4 h-4 text-[var(--text-tertiary)]" />
                Commandé: {format(parseISO(commande.date_commande), 'd MMM yyyy', { locale: fr })}
              </div>
            )}
            {commande.date_reception && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <Check className="w-4 h-4" />
                Reçu: {format(parseISO(commande.date_reception), 'd MMM yyyy', { locale: fr })}
              </div>
            )}
          </div>

          {commande.notes && (
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] mb-4 text-sm text-[var(--text-secondary)]">
              {commande.notes}
            </div>
          )}

          {/* Lignes de commande */}
          <div className="border-t border-[var(--border-secondary)] pt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--text-primary)]">
                Articles ({commande.lignes?.length || 0})
              </h3>
              {commande.statut === 'brouillon' && (
                <Button variant="secondary" size="sm" onClick={() => setShowAddLigne(true)}>
                  <Plus className="w-4 h-4" /> Ajouter
                </Button>
              )}
            </div>

            {commande.lignes && commande.lignes.length > 0 ? (
              <div className="space-y-2">
                {commande.lignes.map(ligne => (
                  <div 
                    key={ligne.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{ligne.designation}</span>
                        {ligne.reference && (
                          <span className="text-xs text-[var(--text-tertiary)]">({ligne.reference})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="cyan">{ligne.quantite} demandé(s)</Badge>
                        {ligne.quantite_recue > 0 && (
                          <Badge variant="green">{ligne.quantite_recue} reçu(s)</Badge>
                        )}
                        {ligne.notes && (
                          <span className="text-xs text-amber-400">💬 {ligne.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {commande.statut === 'expediee' && ligne.quantite_recue < ligne.quantite && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => markReceivedMutation.mutate({ 
                            ligneId: ligne.id, 
                            quantite: ligne.quantite 
                          })}
                        >
                          <Check className="w-3 h-3" /> Reçu
                        </Button>
                      )}
                      {commande.statut === 'brouillon' && (
                        <button 
                          onClick={() => deleteLigneMutation.mutate(ligne.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[var(--text-muted)]">
                Aucun article dans cette commande
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            {nextStatus && commande.statut !== 'annulee' && (
              <Button 
                variant="primary" 
                className="flex-1"
                onClick={() => onStatusChange(nextStatus)}
              >
                <ChevronRight className="w-4 h-4" />
                {STATUT_CONFIG[nextStatus].label}
              </Button>
            )}
            {commande.statut !== 'annulee' && commande.statut !== 'recue' && (
              <Button 
                variant="danger" 
                size="sm"
                onClick={() => onStatusChange('annulee')}
              >
                Annuler
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {showAddLigne && (
        <AddLigneModal
          commandeId={commande.id}
          onClose={() => setShowAddLigne(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
          }}
        />
      )}
    </div>
  );
}

// Page principale Commandes
export function CommandesPage() {
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editCommande, setEditCommande] = useState<Commande | null>(null);
  const [detailCommande, setDetailCommande] = useState<Commande | null>(null);
  const [archiveItem, setArchiveItem] = useState<Commande | null>(null);
  const [showAddToPanier, setShowAddToPanier] = useState(false);
  const queryClient = useQueryClient();
  const { items: panierItems, openPanier } = usePanierStore();

  const { data: commandes, isLoading, refetch } = useQuery({
    queryKey: ['commandes'],
    queryFn: () => getCommandes(),
  });

  const createMutation = useMutation({
    mutationFn: createCommande,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande créée');
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Commande> }) => updateCommande(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande mise à jour');
      setEditCommande(null);
      setDetailCommande(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveCommande(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      toast.success('Commande archivée');
      setArchiveItem(null);
      setDetailCommande(null);
    },
  });

  const filtered = useMemo(() => {
    if (!commandes) return [];
    return commandes.filter(c => {
      const matchSearch = c.code.toLowerCase().includes(search.toLowerCase()) || 
                          c.fournisseur?.toLowerCase().includes(search.toLowerCase()) ||
                          c.reference_fournisseur?.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === 'all' || c.statut === filterStatut;
      return matchSearch && matchStatut;
    });
  }, [commandes, search, filterStatut]);

  const stats = useMemo(() => ({
    total: commandes?.length || 0,
    en_cours: commandes?.filter(c => ['en_attente', 'validee', 'commandee', 'expediee'].includes(c.statut)).length || 0,
    recues: commandes?.filter(c => c.statut === 'recue').length || 0,
    urgentes: commandes?.filter(c => c.priorite === 'urgente' && !['recue', 'annulee'].includes(c.statut)).length || 0,
  }), [commandes]);

  const handleStatusChange = (commande: Commande, newStatut: StatutCommande) => {
    const updates: Partial<Commande> = { statut: newStatut };
    if (newStatut === 'commandee' && !commande.date_commande) {
      updates.date_commande = new Date().toISOString();
    }
    if (newStatut === 'recue') {
      updates.date_reception = new Date().toISOString();
    }
    updateMutation.mutate({ id: commande.id, data: updates });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-cyan-400" />
            Commandes
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Gestion des commandes de pièces et matériel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {panierItems.length > 0 && (
            <Button variant="secondary" onClick={openPanier}>
              <ShoppingCart className="w-4 h-4" />
              Panier ({panierItems.length})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowAddToPanier(true)}>
            <Plus className="w-4 h-4" /> Ajouter au panier
          </Button>
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-sm text-[var(--text-secondary)]">Total</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Truck className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.en_cours}</div>
              <div className="text-sm text-[var(--text-secondary)]">En cours</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.recues}</div>
              <div className="text-sm text-[var(--text-secondary)]">Reçues</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.urgentes}</div>
              <div className="text-sm text-[var(--text-secondary)]">Urgentes</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par code, fournisseur..."
                className="pl-10"
              />
            </div>
            <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-48">
              <option value="all">Tous les statuts</option>
              {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Liste */}
      <Card>
        <div className="divide-y divide-[var(--border-secondary)]">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">Aucune commande trouvée</div>
          ) : (
            filtered.map(commande => {
              const statusConfig = STATUT_CONFIG[commande.statut];
              const StatusIcon = statusConfig.icon;
              const totalArticles = commande.lignes?.reduce((sum, l) => sum + l.quantite, 0) || 0;
              
              return (
                <div 
                  key={commande.id}
                  className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                  onClick={() => setDetailCommande(commande)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <StatusIcon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-cyan-400">{commande.code}</span>
                          <Badge variant={statusConfig.color}>{statusConfig.label}</Badge>
                          <Badge variant={PRIORITE_CONFIG[commande.priorite].color}>
                            {PRIORITE_CONFIG[commande.priorite].label}
                          </Badge>
                        </div>
                        <div className="text-sm text-[var(--text-primary)]">{commande.fournisseur}</div>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)] mt-1">
                          <span>{totalArticles} article(s)</span>
                          {commande.date_livraison_prevue && (
                            <span>Livraison: {format(parseISO(commande.date_livraison_prevue), 'd MMM', { locale: fr })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="cyan" className="text-lg">{totalArticles} pièce(s)</Badge>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={e => { e.stopPropagation(); setArchiveItem(commande); }}
                          className="p-2 hover:bg-amber-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-amber-400"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                          <Eye className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Modals */}
      {showForm && (
        <CommandeFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} />
      )}
      {editCommande && (
        <CommandeFormModal commande={editCommande} onClose={() => setEditCommande(null)} onSave={data => updateMutation.mutate({ id: editCommande.id, data })} />
      )}
      {detailCommande && (
        <CommandeDetailModal 
          commande={detailCommande}
          onClose={() => setDetailCommande(null)}
          onEdit={() => { setEditCommande(detailCommande); setDetailCommande(null); }}
          onArchive={() => setArchiveItem(detailCommande)}
          onStatusChange={(statut) => handleStatusChange(detailCommande, statut)}
          onRefresh={() => refetch().then(r => { const u = r.data?.find(c => c.id === detailCommande.id); if (u) setDetailCommande(u); })}
        />
      )}
      {archiveItem && (
        <ArchiveModal
          type="commande"
          code={archiveItem.code}
          libelle={`${archiveItem.fournisseur} - ${archiveItem.lignes?.length || 0} article(s)`}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
      {showAddToPanier && (
        <AddToPanierModal
          onClose={() => setShowAddToPanier(false)}
        />
      )}
    </div>
  );
}
