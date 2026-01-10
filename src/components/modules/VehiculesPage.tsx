import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, User, AlertTriangle, CheckCircle, Plus, Gauge, Package, ArrowLeftRight, X, ChevronDown, ChevronUp, Edit2, Trash2, Calendar, Wrench } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getVehicules, getStockVehicule, createTransfert, getStockArticles, createVehicule, updateVehicule, deleteVehicule, getTechniciens } from '@/services/api';
import { differenceInDays, format } from 'date-fns';
import type { StatutVehicule, Vehicule } from '@/types';
import toast from 'react-hot-toast';

const STATUT_CONFIG: Record<StatutVehicule, { label: string; color: 'green' | 'blue' | 'amber' | 'red' }> = {
  disponible: { label: 'Disponible', color: 'blue' },
  en_service: { label: 'En service', color: 'green' },
  maintenance: { label: 'Maintenance', color: 'amber' },
  hors_service: { label: 'Hors service', color: 'red' },
};

// Modal Formulaire Véhicule
function VehiculeFormModal({ 
  vehicule, 
  onClose, 
  onSave 
}: { 
  vehicule?: Vehicule | null; 
  onClose: () => void; 
  onSave: (data: Partial<Vehicule>) => void;
}) {
  const [immatriculation, setImmatriculation] = useState(vehicule?.immatriculation || '');
  const [marque, setMarque] = useState(vehicule?.marque || '');
  const [modele, setModele] = useState(vehicule?.modele || '');
  const [annee, setAnnee] = useState(vehicule?.annee?.toString() || new Date().getFullYear().toString());
  const [kilometrage, setKilometrage] = useState(vehicule?.kilometrage?.toString() || '0');
  const [dateCt, setDateCt] = useState(vehicule?.date_ct ? format(new Date(vehicule.date_ct), 'yyyy-MM-dd') : '');
  const [dateAssurance, setDateAssurance] = useState(vehicule?.date_assurance ? format(new Date(vehicule.date_assurance), 'yyyy-MM-dd') : '');
  const [statut, setStatut] = useState<StatutVehicule>(vehicule?.statut || 'disponible');
  const [technicienId, setTechnicienId] = useState(vehicule?.technicien_id || '');

  const { data: techniciens } = useQuery({ queryKey: ['techniciens'], queryFn: getTechniciens });

  const handleSubmit = () => {
    if (!immatriculation.trim()) {
      toast.error('L\'immatriculation est requise');
      return;
    }
    if (!marque.trim()) {
      toast.error('La marque est requise');
      return;
    }
    if (!modele.trim()) {
      toast.error('Le modèle est requis');
      return;
    }
    onSave({
      immatriculation: immatriculation.toUpperCase(),
      marque: marque.trim(),
      modele: modele.trim(),
      annee: annee ? parseInt(annee) : null,
      kilometrage: parseInt(kilometrage) || 0,
      date_ct: dateCt || null,
      date_assurance: dateAssurance || null,
      statut,
      technicien_id: technicienId || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Car className="w-6 h-6 text-green-400" />
              {vehicule ? 'Modifier le véhicule' : 'Nouveau véhicule'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Immatriculation *</label>
                <Input 
                  value={immatriculation} 
                  onChange={e => setImmatriculation(e.target.value.toUpperCase())} 
                  placeholder="AB-123-CD" 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Statut</label>
                <Select value={statut} onChange={e => setStatut(e.target.value as StatutVehicule)}>
                  {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Marque *</label>
                <Input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Renault, Peugeot..." />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Modèle *</label>
                <Input value={modele} onChange={e => setModele(e.target.value)} placeholder="Kangoo, Partner..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Année</label>
                <Input type="number" value={annee} onChange={e => setAnnee(e.target.value)} min={2000} max={2030} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Kilométrage</label>
                <Input type="number" value={kilometrage} onChange={e => setKilometrage(e.target.value)} min={0} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date CT
                </label>
                <Input type="date" value={dateCt} onChange={e => setDateCt(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date Assurance
                </label>
                <Input type="date" value={dateAssurance} onChange={e => setDateAssurance(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                <User className="w-3 h-3" /> Technicien attitré
              </label>
              <Select value={technicienId} onChange={e => setTechnicienId(e.target.value)}>
                <option value="">Aucun</option>
                {techniciens?.map(t => (
                  <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
                ))}
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                {vehicule ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function VehiculeStock({ vehiculeId, technicienId }: { vehiculeId: string; technicienId?: string }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const queryClient = useQueryClient();

  const { data: stock } = useQuery({ queryKey: ['stock-vehicule', vehiculeId], queryFn: () => getStockVehicule(vehiculeId) });
  const { data: articlesDepot } = useQuery({ queryKey: ['stock-articles'], queryFn: getStockArticles });

  const mutation = useMutation({
    mutationFn: (data: any) => createTransfert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
      queryClient.invalidateQueries({ queryKey: ['transferts'] });
      toast.success('Demande de transfert créée');
      setShowModal(false);
    },
  });

  const handleSubmit = () => {
    if (!selectedArticle || !technicienId) return;
    mutation.mutate({
      article_id: selectedArticle,
      quantite: qty,
      source_type: direction === 'in' ? 'depot' : 'vehicule',
      source_vehicule_id: direction === 'out' ? vehiculeId : undefined,
      destination_type: direction === 'in' ? 'vehicule' : 'depot',
      destination_vehicule_id: direction === 'in' ? vehiculeId : undefined,
      motif: 'Demande technicien',
      demande_par: technicienId,
    });
  };

  const alertes = stock?.filter(s => s.quantite <= s.quantite_min) || [];

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <Package className="w-4 h-4" /> Stock ({stock?.length || 0})
          {alertes.length > 0 && <Badge variant="red">{alertes.length} alertes</Badge>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
          <ArrowLeftRight className="w-3 h-3" /> Transfert
        </Button>
      </div>

      {stock && stock.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {stock.map(item => (
            <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${item.quantite <= item.quantite_min ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--bg-tertiary)]'}`}>
              <div>
                <div className="font-medium text-[var(--text-primary)]">{item.article?.designation}</div>
                <div className="text-[var(--text-muted)]">{item.article?.reference}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${item.quantite <= item.quantite_min ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{item.quantite}</div>
                <div className="text-[var(--text-muted)]">min: {item.quantite_min}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-[var(--text-muted)] text-sm">Aucun article</div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[420px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Transfert stock</h3>
                <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-[var(--text-tertiary)]" /></button>
              </div>
              <div className="space-y-4">
                <Select value={direction} onChange={e => setDirection(e.target.value as any)}>
                  <option value="in">Dépôt → Véhicule</option>
                  <option value="out">Véhicule → Dépôt</option>
                </Select>
                <Select value={selectedArticle} onChange={e => setSelectedArticle(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {(direction === 'in' ? articlesDepot : stock?.map(s => s.article))?.map(a => (
                    <option key={a?.id} value={a?.id}>{a?.reference} - {a?.designation}</option>
                  ))}
                </Select>
                <Input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Annuler</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={!selectedArticle}>Demander</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export function VehiculesPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editVehicule, setEditVehicule] = useState<Vehicule | null>(null);

  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: getVehicules });

  const createMutation = useMutation({
    mutationFn: createVehicule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
      toast.success('Véhicule créé');
      setShowForm(false);
    },
    onError: (error: any) => {
      console.error('Erreur création véhicule:', error);
      const message = error?.message || 'Erreur lors de la création';
      if (message.includes('duplicate') || message.includes('unique')) {
        toast.error('Cette immatriculation existe déjà');
      } else {
        toast.error(message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicule> }) => updateVehicule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
      toast.success('Véhicule modifié');
      setEditVehicule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
      toast.success('Véhicule supprimé');
    },
  });

  const handleSave = (data: Partial<Vehicule>) => {
    if (editVehicule) {
      updateMutation.mutate({ id: editVehicule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, immat: string) => {
    if (confirm(`Supprimer le véhicule ${immat} ?`)) {
      deleteMutation.mutate(id);
    }
  };

  const getCtStatus = (d?: string) => {
    if (!d) return { label: 'Non renseigné', color: 'gray' };
    const days = differenceInDays(new Date(d), new Date());
    if (days < 0) return { label: 'CT expiré', color: 'red' };
    if (days < 30) return { label: `CT ${days}j`, color: 'amber' };
    return { label: 'CT OK', color: 'green' };
  };

  const stats = {
    total: vehicules?.length || 0,
    en_service: vehicules?.filter(v => v.statut === 'en_service').length || 0,
    disponible: vehicules?.filter(v => v.statut === 'disponible').length || 0,
    ct_proche: vehicules?.filter(v => v.date_ct && differenceInDays(new Date(v.date_ct), new Date()) < 30).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Véhicules', value: stats.total, icon: Car, color: 'green' },
          { label: 'En service', value: stats.en_service, icon: CheckCircle, color: 'green' },
          { label: 'Disponibles', value: stats.disponible, icon: Car, color: 'blue' },
          { label: 'CT à faire', value: stats.ct_proche, icon: AlertTriangle, color: 'amber' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-${s.color}-500/20 flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 text-${s.color}-400`} />
              </div>
              <div>
                <div className={`text-2xl font-extrabold ${s.value > 0 && i > 0 ? `text-${s.color}-400` : 'text-[var(--text-primary)]'}`}>{s.value}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{s.label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouveau véhicule
        </Button>
      </div>

      <div className="space-y-4">
        {vehicules?.map(v => {
          const ct = getCtStatus(v.date_ct);
          const cfg = STATUT_CONFIG[v.statut];
          const isExp = expanded === v.id;
          return (
            <Card key={v.id}>
              <CardBody>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(isExp ? null : v.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Car className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{v.immatriculation}</div>
                      <div className="text-sm text-[var(--text-tertiary)]">{v.marque} {v.modele} {v.annee && `(${v.annee})`}</div>
                      {v.technicien && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                          <User className="w-3 h-3" /> {v.technicien.prenom} {v.technicien.nom}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={cfg.color}>{cfg.label}</Badge>
                      <div className="text-xs text-[var(--text-muted)] mt-1"><Gauge className="w-3 h-3 inline mr-1" />{v.kilometrage?.toLocaleString()} km</div>
                    </div>
                    <Badge variant={ct.color as any}>{ct.label}</Badge>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={e => { e.stopPropagation(); setEditVehicule(v); }} 
                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded"
                      >
                        <Edit2 className="w-4 h-4 text-[var(--text-tertiary)]" />
                      </button>
                      <button 
                        onClick={e => { e.stopPropagation(); handleDelete(v.id, v.immatriculation); }} 
                        className="p-1.5 hover:bg-red-500/20 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                    {isExp ? <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />}
                  </div>
                </div>
                {isExp && <VehiculeStock vehiculeId={v.id} technicienId={v.technicien_id} />}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {(!vehicules || vehicules.length === 0) && (
        <Card>
          <CardBody className="text-center py-12">
            <Car className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
            <div className="text-[var(--text-muted)] mb-4">Aucun véhicule</div>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Ajouter un véhicule
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Modal création/édition */}
      {(showForm || editVehicule) && (
        <VehiculeFormModal
          vehicule={editVehicule}
          onClose={() => { setShowForm(false); setEditVehicule(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
