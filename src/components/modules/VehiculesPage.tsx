import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Car, User, AlertTriangle, CheckCircle, Plus, Gauge, Package, X, ChevronDown, ChevronUp, 
  Edit2, Trash2, Calendar, Wrench, Fuel, ArrowRight, ArrowLeft, Settings, 
  TrendingUp, Droplet, Clock, MapPin, FileText, AlertCircle, History, Save, RotateCcw
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getVehicules, getStockVehicule, getStockArticles, 
  createVehicule, updateVehicule, deleteVehicule, getTechniciens,
  ajouterStockVehicule, retirerStockVehicule, setStockVehicule, updateStockVehiculeMinimal,
  getTypesEntretien, getEntretiensVehicule, createEntretien, deleteEntretien,
  getPleinsVehicule, createPlein, deletePlein, getStatsCarburant,
  getPeriodiciteVehicule, upsertPeriodicite, deletePeriodicite
} from '@/services/api';
import type { TypeEntretien, EntretienVehicule, PleinCarburant, PeriodicitePersonnalisee } from '@/services/api';
import { differenceInDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { StatutVehicule, Vehicule } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const STATUT_CONFIG: Record<StatutVehicule, { label: string; color: 'green' | 'blue' | 'amber' | 'red' }> = {
  disponible: { label: 'Disponible', color: 'blue' },
  en_service: { label: 'En service', color: 'green' },
  maintenance: { label: 'Maintenance', color: 'amber' },
  hors_service: { label: 'Hors service', color: 'red' },
};

const TYPES_CARBURANT = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'essence', label: 'Essence' },
  { value: 'electrique', label: 'Électrique' },
  { value: 'hybride', label: 'Hybride' },
];

// ============================================
// COMPOSANT STOCK VÉHICULE
// ============================================
function VehiculeStock({ vehiculeId }: { vehiculeId: string }) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [editingMinimal, setEditingMinimal] = useState<string | null>(null);
  const [minimalValues, setMinimalValues] = useState<Record<string, number>>({});

  const { data: stock } = useQuery({ 
    queryKey: ['stock-vehicule', vehiculeId], 
    queryFn: () => getStockVehicule(vehiculeId) 
  });
  const { data: articlesDepot } = useQuery({ 
    queryKey: ['stock-articles'], 
    queryFn: getStockArticles 
  });

  const ajouterMutation = useMutation({
    mutationFn: () => ajouterStockVehicule(vehiculeId, selectedArticle, qty, CURRENT_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule', vehiculeId] });
      queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
      toast.success(`${qty} article(s) ajouté(s) au véhicule`);
      setShowAddModal(false);
      setSelectedArticle('');
      setQty(1);
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const retirerMutation = useMutation({
    mutationFn: () => retirerStockVehicule(vehiculeId, selectedArticle, qty, CURRENT_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule', vehiculeId] });
      queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
      toast.success(`${qty} article(s) retourné(s) au dépôt`);
      setShowAddModal(false);
      setSelectedArticle('');
      setQty(1);
    },
    onError: () => toast.error('Erreur lors du retrait'),
  });

  const updateMinimalMutation = useMutation({
    mutationFn: ({ articleId, min }: { articleId: string; min: number }) => 
      updateStockVehiculeMinimal(vehiculeId, articleId, min),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule', vehiculeId] });
      toast.success('Stock minimal mis à jour');
      setEditingMinimal(null);
    },
    onError: () => toast.error('Erreur'),
  });

  const handleSubmit = () => {
    if (!selectedArticle) return;
    if (direction === 'in') {
      ajouterMutation.mutate();
    } else {
      retirerMutation.mutate();
    }
  };

  const handleSaveMinimal = (articleId: string) => {
    const newMin = minimalValues[articleId];
    if (newMin !== undefined) {
      updateMinimalMutation.mutate({ articleId, min: newMin });
    }
  };

  const startEditMinimal = (item: any) => {
    setEditingMinimal(item.article_id);
    setMinimalValues({ ...minimalValues, [item.article_id]: item.quantite_min });
  };

  const alertes = stock?.filter(s => s.quantite <= s.quantite_min) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-[var(--text-primary)]">Stock véhicule</span>
          <Badge variant="blue">{stock?.length || 0} articles</Badge>
          {alertes.length > 0 && <Badge variant="red">{alertes.length} alertes</Badge>}
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" /> Gérer stock
        </Button>
      </div>

      {stock && stock.length > 0 ? (
        <div className="space-y-2">
          {stock.map(item => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 rounded-xl ${
                item.quantite <= item.quantite_min 
                  ? 'bg-red-500/10 border border-red-500/30' 
                  : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm text-[var(--text-primary)]">{item.article?.designation}</div>
                <div className="text-xs text-[var(--text-muted)]">{item.article?.reference}</div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Quantité actuelle */}
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    item.quantite <= item.quantite_min ? 'text-red-400' : 'text-[var(--text-primary)]'
                  }`}>
                    {item.quantite}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">en stock</div>
                </div>

                {/* Stock minimal éditable */}
                <div className="text-center">
                  {editingMinimal === item.article_id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={minimalValues[item.article_id] ?? item.quantite_min}
                        onChange={e => setMinimalValues({ 
                          ...minimalValues, 
                          [item.article_id]: parseInt(e.target.value) || 0 
                        })}
                        className="w-16 h-8 text-center text-sm"
                      />
                      <button 
                        onClick={() => handleSaveMinimal(item.article_id)}
                        className="p-1 hover:bg-green-500/20 rounded text-green-400"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setEditingMinimal(null)}
                        className="p-1 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-muted)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => startEditMinimal(item)}
                      className="group"
                    >
                      <div className="text-sm font-medium text-amber-400 group-hover:text-amber-300">
                        min: {item.quantite_min}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-tertiary)]">
                        cliquer pour modifier
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun article dans ce véhicule</p>
        </div>
      )}

      {/* Modal Gestion Stock */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-[450px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Gérer le stock</h3>
                <button onClick={() => setShowAddModal(false)}>
                  <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Direction */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDirection('in')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      direction === 'in' 
                        ? 'border-green-500 bg-green-500/10 text-green-400' 
                        : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <ArrowRight className="w-5 h-5" />
                    <span className="font-medium">Dépôt → Véhicule</span>
                  </button>
                  <button
                    onClick={() => setDirection('out')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      direction === 'out' 
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                        : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                    }`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-medium">Véhicule → Dépôt</span>
                  </button>
                </div>

                {/* Article */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Article</label>
                  <Select value={selectedArticle} onChange={e => setSelectedArticle(e.target.value)}>
                    <option value="">Sélectionner un article...</option>
                    {direction === 'in' 
                      ? articlesDepot?.filter(a => a.quantite_stock > 0).map(a => (
                          <option key={a.id} value={a.id}>
                            {a.reference} - {a.designation} (stock: {a.quantite_stock})
                          </option>
                        ))
                      : stock?.map(s => (
                          <option key={s.article?.id} value={s.article?.id}>
                            {s.article?.reference} - {s.article?.designation} (qté: {s.quantite})
                          </option>
                        ))
                    }
                  </Select>
                </div>

                {/* Quantité */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Quantité</label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={qty} 
                    onChange={e => setQty(parseInt(e.target.value) || 1)} 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>
                    Annuler
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1" 
                    onClick={handleSubmit} 
                    disabled={!selectedArticle}
                  >
                    {direction === 'in' ? 'Ajouter au véhicule' : 'Retourner au dépôt'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT ENTRETIENS
// ============================================
function VehiculeEntretiens({ vehiculeId, kilometrageActuel }: { vehiculeId: string; kilometrageActuel: number }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type_entretien_id: '',
    type_personnalise: '',
    date_entretien: format(new Date(), 'yyyy-MM-dd'),
    kilometrage: kilometrageActuel.toString(),
    cout: '',
    garage: '',
    notes: '',
  });

  const { data: typesEntretien } = useQuery({
    queryKey: ['types-entretien'],
    queryFn: getTypesEntretien,
  });

  const { data: entretiens } = useQuery({
    queryKey: ['entretiens-vehicule', vehiculeId],
    queryFn: () => getEntretiensVehicule(vehiculeId),
  });

  const createMutation = useMutation({
    mutationFn: createEntretien,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entretiens-vehicule', vehiculeId] });
      toast.success('Entretien enregistré');
      setShowForm(false);
      setFormData({
        type_entretien_id: '',
        type_personnalise: '',
        date_entretien: format(new Date(), 'yyyy-MM-dd'),
        kilometrage: kilometrageActuel.toString(),
        cout: '',
        garage: '',
        notes: '',
      });
    },
    onError: () => toast.error('Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntretien,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entretiens-vehicule', vehiculeId] });
      toast.success('Entretien supprimé');
    },
  });

  const handleSubmit = () => {
    const typeSelected = typesEntretien?.find(t => t.id === formData.type_entretien_id);
    const km = parseInt(formData.kilometrage);
    
    createMutation.mutate({
      vehicule_id: vehiculeId,
      type_entretien_id: formData.type_entretien_id || undefined,
      type_personnalise: formData.type_personnalise || undefined,
      date_entretien: formData.date_entretien,
      kilometrage: km,
      cout: formData.cout ? parseFloat(formData.cout) : undefined,
      garage: formData.garage || undefined,
      notes: formData.notes || undefined,
      prochain_km: typeSelected?.periodicite_km ? km + typeSelected.periodicite_km : undefined,
      created_by: CURRENT_USER_ID,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-[var(--text-primary)]">Entretiens</span>
          <Badge variant="amber">{entretiens?.length || 0}</Badge>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Liste des entretiens */}
      {entretiens && entretiens.length > 0 ? (
        <div className="space-y-2">
          {entretiens.map(e => (
            <div key={e.id} className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)] rounded-xl group">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${e.type_entretien?.couleur || '#6366f1'}20` }}
              >
                <Wrench className="w-5 h-5" style={{ color: e.type_entretien?.couleur || '#6366f1' }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)]">
                  {e.type_entretien?.nom || e.type_personnalise}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(e.date_entretien), 'dd/MM/yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {e.kilometrage.toLocaleString()} km
                  </span>
                  {e.garage && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {e.garage}
                    </span>
                  )}
                </div>
              </div>
              {e.cout && (
                <div className="text-right">
                  <div className="font-bold text-[var(--text-primary)]">{e.cout.toFixed(2)} €</div>
                </div>
              )}
              <button
                onClick={() => deleteMutation.mutate(e.id)}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun entretien enregistré</p>
        </div>
      )}

      {/* Modal Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-[500px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Nouvel entretien</h3>
                <button onClick={() => setShowForm(false)}>
                  <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Type d'entretien</label>
                  <Select 
                    value={formData.type_entretien_id} 
                    onChange={e => setFormData({ ...formData, type_entretien_id: e.target.value })}
                  >
                    <option value="">Sélectionner ou saisir ci-dessous</option>
                    {typesEntretien?.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nom} {t.periodicite_km ? `(tous les ${t.periodicite_km.toLocaleString()} km)` : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {!formData.type_entretien_id && (
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Ou type personnalisé</label>
                    <Input 
                      value={formData.type_personnalise} 
                      onChange={e => setFormData({ ...formData, type_personnalise: e.target.value })}
                      placeholder="Ex: Remplacement rétroviseur"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date</label>
                    <Input 
                      type="date" 
                      value={formData.date_entretien} 
                      onChange={e => setFormData({ ...formData, date_entretien: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Kilométrage</label>
                    <Input 
                      type="number" 
                      value={formData.kilometrage} 
                      onChange={e => setFormData({ ...formData, kilometrage: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Coût (€)</label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={formData.cout} 
                      onChange={e => setFormData({ ...formData, cout: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Garage</label>
                    <Input 
                      value={formData.garage} 
                      onChange={e => setFormData({ ...formData, garage: e.target.value })}
                      placeholder="Nom du garage"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Détails supplémentaires..."
                    className="w-full h-20 p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSubmit}>Enregistrer</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT CARBURANT
// ============================================
function VehiculeCarburant({ vehiculeId, kilometrageActuel }: { vehiculeId: string; kilometrageActuel: number }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date_plein: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kilometrage: kilometrageActuel.toString(),
    litres: '',
    montant: '',
    type_carburant: 'diesel',
    plein_complet: true,
    station: '',
  });

  const { data: pleins } = useQuery({
    queryKey: ['pleins-vehicule', vehiculeId],
    queryFn: () => getPleinsVehicule(vehiculeId),
  });

  const { data: stats } = useQuery({
    queryKey: ['stats-carburant', vehiculeId],
    queryFn: () => getStatsCarburant(vehiculeId),
  });

  const createMutation = useMutation({
    mutationFn: createPlein,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pleins-vehicule', vehiculeId] });
      queryClient.invalidateQueries({ queryKey: ['stats-carburant', vehiculeId] });
      toast.success('Plein enregistré');
      setShowForm(false);
    },
    onError: () => toast.error('Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlein,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pleins-vehicule', vehiculeId] });
      queryClient.invalidateQueries({ queryKey: ['stats-carburant', vehiculeId] });
      toast.success('Plein supprimé');
    },
  });

  const handleSubmit = () => {
    createMutation.mutate({
      vehicule_id: vehiculeId,
      date_plein: formData.date_plein,
      kilometrage: parseInt(formData.kilometrage),
      litres: parseFloat(formData.litres),
      montant: parseFloat(formData.montant),
      type_carburant: formData.type_carburant,
      plein_complet: formData.plein_complet,
      station: formData.station || undefined,
      created_by: CURRENT_USER_ID,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fuel className="w-5 h-5 text-green-400" />
          <span className="font-semibold text-[var(--text-primary)]">Carburant</span>
          <Badge variant="green">{pleins?.length || 0} pleins</Badge>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Ajouter plein
        </Button>
      </div>

      {/* Stats */}
      {stats && stats.nbPleins > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
            <div className="text-xl font-bold text-[var(--text-primary)]">{stats.totalLitres.toFixed(0)} L</div>
            <div className="text-xs text-[var(--text-muted)]">Total litres</div>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
            <div className="text-xl font-bold text-[var(--text-primary)]">{stats.totalDepense.toFixed(0)} €</div>
            <div className="text-xs text-[var(--text-muted)]">Total dépensé</div>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
            <div className="text-xl font-bold text-[var(--text-primary)]">{stats.prixMoyenLitre.toFixed(3)} €/L</div>
            <div className="text-xs text-[var(--text-muted)]">Prix moyen</div>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
            <div className="text-xl font-bold text-green-400">
              {stats.consommationMoyenne ? `${stats.consommationMoyenne} L` : '-'}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Conso /100km</div>
          </div>
        </div>
      )}

      {/* Liste des pleins */}
      {pleins && pleins.length > 0 ? (
        <div className="space-y-2">
          {pleins.slice(0, 10).map(p => (
            <div key={p.id} className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)] rounded-xl group">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Fuel className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{p.litres.toFixed(2)} L</span>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-[var(--text-primary)]">{p.montant.toFixed(2)} €</span>
                  {p.prix_litre && (
                    <span className="text-xs text-[var(--text-muted)]">({p.prix_litre.toFixed(3)} €/L)</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(p.date_plein), 'dd/MM/yyyy HH:mm')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {p.kilometrage.toLocaleString()} km
                  </span>
                  {p.station && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {p.station}
                    </span>
                  )}
                </div>
              </div>
              {!p.plein_complet && (
                <Badge variant="gray">Partiel</Badge>
              )}
              <button
                onClick={() => deleteMutation.mutate(p.id)}
                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Fuel className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun plein enregistré</p>
        </div>
      )}

      {/* Modal Formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-[450px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Nouveau plein</h3>
                <button onClick={() => setShowForm(false)}>
                  <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date et heure</label>
                    <Input 
                      type="datetime-local" 
                      value={formData.date_plein} 
                      onChange={e => setFormData({ ...formData, date_plein: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Kilométrage</label>
                    <Input 
                      type="number" 
                      value={formData.kilometrage} 
                      onChange={e => setFormData({ ...formData, kilometrage: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Litres</label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={formData.litres} 
                      onChange={e => setFormData({ ...formData, litres: e.target.value })}
                      placeholder="45.50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Montant (€)</label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={formData.montant} 
                      onChange={e => setFormData({ ...formData, montant: e.target.value })}
                      placeholder="85.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Carburant</label>
                    <Select 
                      value={formData.type_carburant} 
                      onChange={e => setFormData({ ...formData, type_carburant: e.target.value })}
                    >
                      {TYPES_CARBURANT.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Station</label>
                    <Input 
                      value={formData.station} 
                      onChange={e => setFormData({ ...formData, station: e.target.value })}
                      placeholder="Total, Shell..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.plein_complet}
                    onChange={e => setFormData({ ...formData, plein_complet: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[var(--text-primary)]">Plein complet</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
                  <Button 
                    variant="primary" 
                    className="flex-1" 
                    onClick={handleSubmit}
                    disabled={!formData.litres || !formData.montant}
                  >
                    Enregistrer
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT RÉGLAGES PÉRIODICITÉS
// ============================================
function VehiculeReglages({ vehiculeId, vehiculeImmat }: { vehiculeId: string; vehiculeImmat: string }) {
  const queryClient = useQueryClient();

  const { data: typesEntretien } = useQuery({
    queryKey: ['types-entretien'],
    queryFn: getTypesEntretien,
  });

  const { data: periodicites } = useQuery({
    queryKey: ['periodicite-vehicule', vehiculeId],
    queryFn: () => getPeriodiciteVehicule(vehiculeId),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ typeId, data }: { typeId: string; data: any }) => 
      upsertPeriodicite(vehiculeId, typeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodicite-vehicule', vehiculeId] });
      toast.success('Périodicité mise à jour');
    },
    onError: () => toast.error('Erreur'),
  });

  const resetMutation = useMutation({
    mutationFn: (typeId: string) => deletePeriodicite(vehiculeId, typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodicite-vehicule', vehiculeId] });
      toast.success('Périodicité réinitialisée');
    },
  });

  // Map des périodicités personnalisées par type
  const periodiciteMap = new Map(
    periodicites?.map(p => [p.type_entretien_id, p]) || []
  );

  const handleUpdate = (typeId: string, field: 'periodicite_km' | 'periodicite_mois' | 'actif', value: any) => {
    const current = periodiciteMap.get(typeId);
    upsertMutation.mutate({
      typeId,
      data: {
        periodicite_km: current?.periodicite_km,
        periodicite_mois: current?.periodicite_mois,
        actif: current?.actif ?? true,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-purple-400" />
        <span className="font-semibold text-[var(--text-primary)]">Périodicités d'entretien</span>
        <span className="text-xs text-[var(--text-muted)]">pour {vehiculeImmat}</span>
      </div>

      <p className="text-sm text-[var(--text-tertiary)] mb-4">
        Personnalisez les intervalles d'entretien pour ce véhicule. Les valeurs modifiées apparaissent en surbrillance.
      </p>

      <div className="space-y-2">
        {typesEntretien?.map(type => {
          const custom = periodiciteMap.get(type.id);
          const isCustomized = custom !== undefined;
          const kmValue = custom?.periodicite_km ?? type.periodicite_km;
          const moisValue = custom?.periodicite_mois ?? type.periodicite_mois;
          const isActive = custom?.actif ?? true;

          return (
            <div 
              key={type.id} 
              className={`p-4 rounded-xl border transition-all ${
                isCustomized 
                  ? 'bg-purple-500/10 border-purple-500/30' 
                  : 'bg-[var(--bg-tertiary)] border-transparent'
              } ${!isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${type.couleur}20` }}
                  >
                    <Wrench className="w-4 h-4" style={{ color: type.couleur }} />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{type.nom}</div>
                    <div className="text-xs text-[var(--text-muted)]">{type.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCustomized && (
                    <button
                      onClick={() => resetMutation.mutate(type.id)}
                      className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title="Réinitialiser aux valeurs par défaut"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => handleUpdate(type.id, 'actif', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">Actif</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">
                    Périodicité km
                    {type.periodicite_km && (
                      <span className="text-[var(--text-muted)] ml-1">(défaut: {type.periodicite_km.toLocaleString()})</span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={kmValue || ''}
                      onChange={e => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        handleUpdate(type.id, 'periodicite_km', val);
                      }}
                      placeholder="km"
                      className={`${isCustomized && custom?.periodicite_km !== type.periodicite_km ? 'border-purple-500' : ''}`}
                      disabled={!isActive}
                    />
                    <span className="text-sm text-[var(--text-muted)]">km</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">
                    Périodicité mois
                    {type.periodicite_mois && (
                      <span className="text-[var(--text-muted)] ml-1">(défaut: {type.periodicite_mois})</span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={moisValue || ''}
                      onChange={e => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        handleUpdate(type.id, 'periodicite_mois', val);
                      }}
                      placeholder="mois"
                      className={`${isCustomized && custom?.periodicite_mois !== type.periodicite_mois ? 'border-purple-500' : ''}`}
                      disabled={!isActive}
                    />
                    <span className="text-sm text-[var(--text-muted)]">mois</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MODAL FORMULAIRE VÉHICULE
// ============================================
function VehiculeFormModal({ 
  vehicule, 
  onClose, 
  onSave 
}: { 
  vehicule?: Vehicule | null; 
  onClose: () => void; 
  onSave: (data: Partial<Vehicule>) => void;
}) {
  const [formData, setFormData] = useState({
    immatriculation: vehicule?.immatriculation || '',
    marque: vehicule?.marque || '',
    modele: vehicule?.modele || '',
    annee: vehicule?.annee?.toString() || new Date().getFullYear().toString(),
    kilometrage: vehicule?.kilometrage?.toString() || '0',
    date_ct: vehicule?.date_ct ? format(new Date(vehicule.date_ct), 'yyyy-MM-dd') : '',
    date_assurance: vehicule?.date_assurance ? format(new Date(vehicule.date_assurance), 'yyyy-MM-dd') : '',
    statut: vehicule?.statut || 'disponible' as StatutVehicule,
    technicien_id: vehicule?.technicien_id || '',
    type_carburant: vehicule?.type_carburant || 'diesel',
  });

  const { data: techniciens } = useQuery({ queryKey: ['techniciens'], queryFn: getTechniciens });

  const handleSubmit = () => {
    if (!formData.immatriculation.trim()) {
      toast.error('L\'immatriculation est requise');
      return;
    }
    if (!formData.marque.trim()) {
      toast.error('La marque est requise');
      return;
    }
    if (!formData.modele.trim()) {
      toast.error('Le modèle est requis');
      return;
    }
    onSave({
      immatriculation: formData.immatriculation.toUpperCase(),
      marque: formData.marque.trim(),
      modele: formData.modele.trim(),
      annee: formData.annee ? parseInt(formData.annee) : null,
      kilometrage: parseInt(formData.kilometrage) || 0,
      date_ct: formData.date_ct || null,
      date_assurance: formData.date_assurance || null,
      statut: formData.statut,
      technicien_id: formData.technicien_id || null,
      type_carburant: formData.type_carburant,
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
                  value={formData.immatriculation} 
                  onChange={e => setFormData({ ...formData, immatriculation: e.target.value.toUpperCase() })} 
                  placeholder="AB-123-CD" 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Statut</label>
                <Select 
                  value={formData.statut} 
                  onChange={e => setFormData({ ...formData, statut: e.target.value as StatutVehicule })}
                >
                  {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Marque *</label>
                <Input 
                  value={formData.marque} 
                  onChange={e => setFormData({ ...formData, marque: e.target.value })} 
                  placeholder="Renault, Peugeot..." 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Modèle *</label>
                <Input 
                  value={formData.modele} 
                  onChange={e => setFormData({ ...formData, modele: e.target.value })} 
                  placeholder="Kangoo, Partner..." 
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Année</label>
                <Input 
                  type="number" 
                  value={formData.annee} 
                  onChange={e => setFormData({ ...formData, annee: e.target.value })} 
                  min={2000} 
                  max={2030} 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Kilométrage</label>
                <Input 
                  type="number" 
                  value={formData.kilometrage} 
                  onChange={e => setFormData({ ...formData, kilometrage: e.target.value })} 
                  min={0} 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Carburant</label>
                <Select 
                  value={formData.type_carburant} 
                  onChange={e => setFormData({ ...formData, type_carburant: e.target.value })}
                >
                  {TYPES_CARBURANT.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date CT
                </label>
                <Input 
                  type="date" 
                  value={formData.date_ct} 
                  onChange={e => setFormData({ ...formData, date_ct: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date Assurance
                </label>
                <Input 
                  type="date" 
                  value={formData.date_assurance} 
                  onChange={e => setFormData({ ...formData, date_assurance: e.target.value })} 
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-1">
                <User className="w-3 h-3" /> Technicien attitré
              </label>
              <Select 
                value={formData.technicien_id} 
                onChange={e => setFormData({ ...formData, technicien_id: e.target.value })}
              >
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

// ============================================
// DETAIL VÉHICULE
// ============================================
function VehiculeDetail({ vehicule, onClose }: { vehicule: Vehicule; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'stock' | 'entretiens' | 'carburant' | 'reglages'>('stock');
  
  const tabs = [
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'entretiens', label: 'Entretiens', icon: Wrench },
    { id: 'carburant', label: 'Carburant', icon: Fuel },
    { id: 'reglages', label: 'Réglages', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Car className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{vehicule.immatriculation}</h2>
                <div className="text-sm text-[var(--text-tertiary)]">
                  {vehicule.marque} {vehicule.modele} {vehicule.annee && `(${vehicule.annee})`}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Gauge className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]">{vehicule.kilometrage?.toLocaleString()} km</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' 
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'stock' && <VehiculeStock vehiculeId={vehicule.id} />}
            {activeTab === 'entretiens' && (
              <VehiculeEntretiens vehiculeId={vehicule.id} kilometrageActuel={vehicule.kilometrage || 0} />
            )}
            {activeTab === 'carburant' && (
              <VehiculeCarburant vehiculeId={vehicule.id} kilometrageActuel={vehicule.kilometrage || 0} />
            )}
            {activeTab === 'reglages' && (
              <VehiculeReglages vehiculeId={vehicule.id} vehiculeImmat={vehicule.immatriculation} />
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" onClick={onClose} className="w-full">Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================
export function VehiculesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editVehicule, setEditVehicule] = useState<Vehicule | null>(null);
  const [viewVehicule, setViewVehicule] = useState<Vehicule | null>(null);

  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: getVehicules });

  const createMutation = useMutation({
    mutationFn: createVehicule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules'] });
      toast.success('Véhicule créé');
      setShowForm(false);
    },
    onError: (error: any) => {
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
      {/* Stats */}
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
                <div className={`text-2xl font-extrabold ${s.value > 0 && i > 0 ? `text-${s.color}-400` : 'text-[var(--text-primary)]'}`}>
                  {s.value}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">{s.label}</div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouveau véhicule
        </Button>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {vehicules?.map(v => {
          const ct = getCtStatus(v.date_ct);
          const cfg = STATUT_CONFIG[v.statut];
          return (
            <Card key={v.id} className="hover:border-[var(--border-secondary)] transition-all cursor-pointer">
              <CardBody>
                <div className="flex items-center justify-between" onClick={() => setViewVehicule(v)}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <Car className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{v.immatriculation}</div>
                      <div className="text-sm text-[var(--text-tertiary)]">
                        {v.marque} {v.modele} {v.annee && `(${v.annee})`}
                      </div>
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
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        <Gauge className="w-3 h-3 inline mr-1" />
                        {v.kilometrage?.toLocaleString()} km
                      </div>
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
                  </div>
                </div>
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

      {/* Modals */}
      {(showForm || editVehicule) && (
        <VehiculeFormModal
          vehicule={editVehicule}
          onClose={() => { setShowForm(false); setEditVehicule(null); }}
          onSave={handleSave}
        />
      )}

      {viewVehicule && (
        <VehiculeDetail
          vehicule={viewVehicule}
          onClose={() => setViewVehicule(null)}
        />
      )}
    </div>
  );
}
