import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, Plus, Search, Package, Truck, Check, X, Eye, Edit, 
  Archive, Calendar, User, Clock, AlertTriangle, Minus, MoreVertical,
  ChevronRight, FileText, Trash2, ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getCommandes, createCommande, updateCommande, archiveCommande,
  addCommandeLigne, deleteCommandeLigne, updateCommandeLigne, getStockArticles, getAscenseurs,
  getTravauxEnAttentePieces, receptionnerLigneCommande, createStockMouvement
} from '@/services/api';
import { ArchiveModal } from './ArchivesPage';
import type { Commande, CommandeLigne, StatutCommande, Priorite } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

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
  'Schneider Electric',
  'Legrand',
  'ABB',
  'Siemens',
  'Hager',
  'Otis Parts',
  'Schindler Supply',
  'Thyssen Parts',
  'Kone Express',
  'Autre',
];

// Types pour les lignes du formulaire
interface LigneForm {
  id: string;
  type: 'stock' | 'manuel';
  article_id?: string;
  designation: string;
  reference: string;
  quantite: number;
  ascenseur_id?: string;
  detail?: string;
}

// Helper pour obtenir l'action suivante logique
function getNextAction(statut: StatutCommande): { next: StatutCommande | null; label: string } | null {
  switch (statut) {
    case 'brouillon': return { next: 'en_attente', label: 'Soumettre' };
    case 'en_attente': return { next: 'validee', label: 'Valider' };
    case 'validee': return { next: 'commandee', label: 'Commander' };
    case 'commandee': return { next: 'expediee', label: 'Expédier' };
    case 'expediee': return { next: null, label: 'Réceptionner' }; // null = ouvre modal
    default: return null;
  }
}

// Helper pour les autres actions disponibles
function getOtherActions(statut: StatutCommande): { statut: StatutCommande; label: string; color: string }[] {
  const actions: { statut: StatutCommande; label: string; color: string }[] = [];
  
  if (!['recue', 'annulee'].includes(statut)) {
    actions.push({ statut: 'annulee', label: 'Annuler', color: 'red' });
  }
  
  return actions;
}

// Menu d'actions rapides
function ActionDropdown({ 
  commande, 
  onStatusChange, 
  onArchive,
  onOpenDetail,
  onReception,
  toutRecu = false
}: { 
  commande: Commande; 
  onStatusChange: (statut: StatutCommande) => void;
  onArchive: () => void;
  onOpenDetail: () => void;
  onReception: () => void;
  toutRecu?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const otherActions = getOtherActions(commande.statut);
  const canReception = ['commandee', 'expediee'].includes(commande.statut) && !toutRecu;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 py-1">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail(); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Voir détails
            </button>
            
            {canReception && (
              <button
                onClick={(e) => { e.stopPropagation(); onReception(); setIsOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-green-500/10 flex items-center gap-2"
              >
                <Package className="w-4 h-4" /> Réceptionner
              </button>
            )}
            
            {otherActions.map(action => (
              <button
                key={action.statut}
                onClick={(e) => { e.stopPropagation(); onStatusChange(action.statut); setIsOpen(false); }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-${action.color}-500/10 text-${action.color}-400 flex items-center gap-2`}
              >
                <X className="w-4 h-4" /> {action.label}
              </button>
            ))}
            
            <div className="border-t border-[var(--border-primary)] my-1" />
            
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
            >
              <Archive className="w-4 h-4" /> Archiver
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Modal création/édition commande amélioré
function CommandeFormModal({ 
  commande, 
  onClose, 
  onSave 
}: { 
  commande?: Commande; 
  onClose: () => void; 
  onSave: (data: Partial<Commande>, lignes: LigneForm[]) => void;
}) {
  const [form, setForm] = useState({
    fournisseur: commande?.fournisseur || '',
    reference_fournisseur: commande?.reference_fournisseur || '',
    priorite: commande?.priorite || 'normale',
    date_livraison_prevue: commande?.date_livraison_prevue || '',
    notes: commande?.notes || '',
  });

  // Lignes de commande
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [showAddLigne, setShowAddLigne] = useState(false);
  const [ligneType, setLigneType] = useState<'stock' | 'manuel'>('stock');
  const [articleSearch, setArticleSearch] = useState('');
  const [newLigne, setNewLigne] = useState({
    designation: '',
    reference: '',
    quantite: 1,
    ascenseur_id: '',
    detail: '',
  });

  // Queries
  const { data: articles } = useQuery({ queryKey: ['stock-articles'], queryFn: getStockArticles });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });

  // Filtrer les articles
  const filteredArticles = articles?.filter(a => 
    articleSearch.length >= 2 && (
      a.designation?.toLowerCase().includes(articleSearch.toLowerCase()) ||
      a.reference?.toLowerCase().includes(articleSearch.toLowerCase())
    )
  ).slice(0, 10) || [];

  const addLigneFromStock = (article: any) => {
    // Vérifier si déjà ajouté
    if (lignes.some(l => l.article_id === article.id)) {
      toast.error('Cet article est déjà dans la liste');
      return;
    }
    setLignes([...lignes, {
      id: `ligne-${Date.now()}`,
      type: 'stock',
      article_id: article.id,
      designation: article.designation,
      reference: article.reference || '',
      quantite: 1,
      ascenseur_id: '',
      detail: '',
    }]);
    setArticleSearch('');
  };

  const addLigneManuelle = () => {
    if (!newLigne.designation.trim()) {
      toast.error('La désignation est requise');
      return;
    }
    setLignes([...lignes, {
      id: `ligne-${Date.now()}`,
      type: 'manuel',
      designation: newLigne.designation.trim(),
      reference: newLigne.reference.trim(),
      quantite: newLigne.quantite || 1,
      ascenseur_id: newLigne.ascenseur_id || '',
      detail: newLigne.detail || '',
    }]);
    setNewLigne({ designation: '', reference: '', quantite: 1, ascenseur_id: '', detail: '' });
    setShowAddLigne(false);
  };

  const removeLigne = (id: string) => {
    setLignes(lignes.filter(l => l.id !== id));
  };

  const updateLigne = (id: string, field: keyof LigneForm, value: any) => {
    setLignes(lignes.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSubmit = () => {
    if (!form.fournisseur) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    if (lignes.length === 0) {
      toast.error('Ajoutez au moins une pièce à commander');
      return;
    }
    onSave({
      fournisseur: form.fournisseur,
      reference_fournisseur: form.reference_fournisseur || null,
      priorite: form.priorite as Priorite,
      date_livraison_prevue: form.date_livraison_prevue || null,
      notes: form.notes || null,
      technicien_id: CURRENT_USER_ID,
      statut: commande?.statut || 'brouillon',
    }, lignes);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-y-auto">
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
            {/* Infos commande */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Section Pièces à commander */}
            <div className="border-t border-[var(--border-primary)] pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Package className="w-4 h-4" /> Pièces à commander
                  {lignes.length > 0 && <Badge variant="blue">{lignes.length}</Badge>}
                </h3>
                <button
                  onClick={() => setShowAddLigne(!showAddLigne)}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {showAddLigne ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Ajouter une pièce
                </button>
              </div>

              {/* Formulaire ajout pièce */}
              {showAddLigne && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4 space-y-3">
                  {/* Tabs Stock / Manuel */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLigneType('stock')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        ligneType === 'stock'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Package className="w-4 h-4 inline mr-2" />Depuis le stock
                    </button>
                    <button
                      onClick={() => setLigneType('manuel')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        ligneType === 'manuel'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Edit className="w-4 h-4 inline mr-2" />Saisie manuelle
                    </button>
                  </div>

                  {ligneType === 'stock' ? (
                    <div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                        <Input
                          value={articleSearch}
                          onChange={e => setArticleSearch(e.target.value)}
                          placeholder="Rechercher un article (min. 2 car.)..."
                          className="pl-10"
                        />
                      </div>
                      {filteredArticles.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto border border-[var(--border-primary)] rounded-lg divide-y divide-[var(--border-primary)]">
                          {filteredArticles.map(article => (
                            <button
                              key={article.id}
                              onClick={() => addLigneFromStock(article)}
                              className="w-full p-2 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">{article.designation}</div>
                                <div className="text-xs text-[var(--text-muted)]">{article.reference}</div>
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)]">
                                Stock: {article.quantite_stock}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Désignation *</label>
                          <Input
                            value={newLigne.designation}
                            onChange={e => setNewLigne({ ...newLigne, designation: e.target.value })}
                            placeholder="Nom de la pièce"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Référence</label>
                          <Input
                            value={newLigne.reference}
                            onChange={e => setNewLigne({ ...newLigne, reference: e.target.value })}
                            placeholder="Réf. fournisseur"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Quantité</label>
                          <Input
                            type="number"
                            min="1"
                            value={newLigne.quantite}
                            onChange={e => setNewLigne({ ...newLigne, quantite: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Ascenseur (opt.)</label>
                          <Select
                            value={newLigne.ascenseur_id}
                            onChange={e => setNewLigne({ ...newLigne, ascenseur_id: e.target.value })}
                          >
                            <option value="">Aucun</option>
                            {ascenseurs?.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.adresse?.slice(0, 30)}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Détail (opt.)</label>
                          <Input
                            value={newLigne.detail}
                            onChange={e => setNewLigne({ ...newLigne, detail: e.target.value })}
                            placeholder="Infos supp."
                          />
                        </div>
                      </div>
                      <Button variant="primary" className="w-full" onClick={addLigneManuelle}>
                        <Plus className="w-4 h-4" /> Ajouter cette pièce
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Liste des lignes */}
              {lignes.length > 0 ? (
                <div className="space-y-2">
                  {lignes.map((ligne, index) => (
                    <div 
                      key={ligne.id} 
                      className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{ligne.designation}</span>
                            {ligne.type === 'stock' && <Badge variant="blue" className="text-xs">Stock</Badge>}
                            {ligne.type === 'manuel' && <Badge variant="amber" className="text-xs">Manuel</Badge>}
                          </div>
                          {ligne.reference && (
                            <div className="text-xs text-[var(--text-muted)]">Réf: {ligne.reference}</div>
                          )}
                        </div>
                        
                        {/* Quantité */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateLigne(ligne.id, 'quantite', Math.max(1, ligne.quantite - 1))}
                            className="w-7 h-7 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-mono text-sm text-[var(--text-primary)]">{ligne.quantite}</span>
                          <button
                            onClick={() => updateLigne(ligne.id, 'quantite', ligne.quantite + 1)}
                            className="w-7 h-7 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => removeLigne(ligne.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Options ascenseur et détail */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Select
                          value={ligne.ascenseur_id || ''}
                          onChange={e => updateLigne(ligne.id, 'ascenseur_id', e.target.value)}
                          className="text-xs py-1"
                        >
                          <option value="">Ascenseur (opt.)</option>
                          {ascenseurs?.map(a => (
                            <option key={a.id} value={a.id}>{a.code}</option>
                          ))}
                        </Select>
                        <Input
                          value={ligne.detail || ''}
                          onChange={e => updateLigne(ligne.id, 'detail', e.target.value)}
                          placeholder="Détail (opt.)"
                          className="text-xs py-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-[var(--text-muted)] text-sm border border-dashed border-[var(--border-primary)] rounded-lg">
                  Aucune pièce ajoutée. Cliquez sur "Ajouter une pièce" ci-dessus.
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                placeholder="Notes ou commentaires..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit}>
              {commande ? 'Enregistrer' : 'Créer la commande'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Interface pour l'affectation
interface AffectationLigne {
  ligneId: string;
  quantiteRecue: number;
  affectations: { travailId: string; travailCode: string; travailTitre: string; besoin: number; quantite: number }[];
  stockQuantite: number;
}

// Modal de réception intelligent
function ReceptionModal({
  commande,
  onClose,
  onSuccess,
}: {
  commande: Commande;
  onClose: () => void;
  onSuccess: (toutRecu: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [travauxEnAttente, setTravauxEnAttente] = useState<any[]>([]);
  const [affectationsParLigne, setAffectationsParLigne] = useState<Record<string, AffectationLigne>>({});

  // Charger les travaux en attente de pièces
  useEffect(() => {
    const loadData = async () => {
      try {
        const travaux = await getTravauxEnAttentePieces();
        setTravauxEnAttente(travaux);
        
        // Initialiser les affectations pour chaque ligne
        const initialAffectations: Record<string, AffectationLigne> = {};
        
        commande.lignes?.forEach((ligne: any) => {
          // Trouver les travaux qui ont besoin de cet article
          const travauxPourCetteLigne = travaux.filter(t => {
            const pieces = t.pieces || [];
            return pieces.some((p: any) => {
              if (p.source !== 'commande' || p.consommee) return false;
              if (ligne.article_id && p.article_id === ligne.article_id) return true;
              if (p.designation?.toLowerCase() === ligne.designation?.toLowerCase()) return true;
              return false;
            });
          });
          
          // Calculer les besoins par travail
          const affectations = travauxPourCetteLigne.map(t => {
            const pieces = t.pieces || [];
            const pieceMatch = pieces.find((p: any) => {
              if (p.source !== 'commande' || p.consommee) return false;
              if (ligne.article_id && p.article_id === ligne.article_id) return true;
              if (p.designation?.toLowerCase() === ligne.designation?.toLowerCase()) return true;
              return false;
            });
            const besoin = pieceMatch ? pieceMatch.quantite - (pieceMatch.quantite_recue || 0) : 0;
            return {
              travailId: t.id,
              travailCode: t.code,
              travailTitre: t.titre || t.ascenseur?.adresse || 'Sans titre',
              besoin,
              quantite: 0, // Par défaut, rien d'affecté
            };
          });
          
          initialAffectations[ligne.id] = {
            ligneId: ligne.id,
            quantiteRecue: ligne.quantite, // Par défaut, on considère tout reçu
            affectations,
            stockQuantite: ligne.quantite, // Par défaut, tout va au stock
          };
        });
        
        setAffectationsParLigne(initialAffectations);
      } catch (err) {
        console.error('Erreur chargement:', err);
        toast.error('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [commande]);

  // Mettre à jour la quantité affectée à un travail
  const updateAffectation = (ligneId: string, travailId: string, quantite: number) => {
    setAffectationsParLigne(prev => {
      const ligne = prev[ligneId];
      if (!ligne) return prev;
      
      const newAffectations = ligne.affectations.map(a => 
        a.travailId === travailId ? { ...a, quantite: Math.max(0, quantite) } : a
      );
      
      // Recalculer ce qui reste pour le stock
      const totalAffecte = newAffectations.reduce((sum, a) => sum + a.quantite, 0);
      const stockQuantite = Math.max(0, ligne.quantiteRecue - totalAffecte);
      
      return {
        ...prev,
        [ligneId]: { ...ligne, affectations: newAffectations, stockQuantite }
      };
    });
  };

  // Tout affecter à un travail
  const affecterTout = (ligneId: string, travailId: string) => {
    setAffectationsParLigne(prev => {
      const ligne = prev[ligneId];
      if (!ligne) return prev;
      
      const aff = ligne.affectations.find(a => a.travailId === travailId);
      if (!aff) return prev;
      
      // Mettre le maximum possible sur ce travail
      const maxPossible = Math.min(aff.besoin, ligne.quantiteRecue);
      return {
        ...prev,
        [ligneId]: {
          ...ligne,
          affectations: ligne.affectations.map(a => 
            a.travailId === travailId ? { ...a, quantite: maxPossible } : { ...a, quantite: 0 }
          ),
          stockQuantite: ligne.quantiteRecue - maxPossible
        }
      };
    });
  };

  // Tout au stock
  const toutAuStock = (ligneId: string) => {
    setAffectationsParLigne(prev => {
      const ligne = prev[ligneId];
      if (!ligne) return prev;
      
      return {
        ...prev,
        [ligneId]: {
          ...ligne,
          affectations: ligne.affectations.map(a => ({ ...a, quantite: 0 })),
          stockQuantite: ligne.quantiteRecue
        }
      };
    });
  };

  // Mettre à jour la quantité reçue
  const updateQuantiteRecue = (ligneId: string, nouvelleQuantite: number) => {
    setAffectationsParLigne(prev => {
      const ligne = prev[ligneId];
      if (!ligne) return prev;
      
      // Recalculer les affectations (ne pas dépasser la nouvelle quantité)
      let resteDisponible = nouvelleQuantite;
      const newAffectations = ligne.affectations.map(a => {
        const newQte = Math.min(a.quantite, resteDisponible);
        resteDisponible -= newQte;
        return { ...a, quantite: newQte };
      });
      
      // Le reste va au stock
      const totalAffecte = newAffectations.reduce((sum, a) => sum + a.quantite, 0);
      const stockQuantite = Math.max(0, nouvelleQuantite - totalAffecte);
      
      return {
        ...prev,
        [ligneId]: {
          ...ligne,
          quantiteRecue: nouvelleQuantite,
          affectations: newAffectations,
          stockQuantite
        }
      };
    });
  };

  // Valider la réception
  const validerReception = async () => {
    setIsSaving(true);
    try {
      for (const [ligneId, data] of Object.entries(affectationsParLigne)) {
        const ligne = commande.lignes?.find((l: any) => l.id === ligneId);
        if (!ligne) continue;
        
        // Extraire l'article_id correctement (peut être un objet article ou un string)
        const articleId = typeof ligne.article_id === 'string' 
          ? ligne.article_id 
          : (ligne.article?.id || null);
        
        await receptionnerLigneCommande(
          ligneId,
          data.quantiteRecue,
          articleId,
          ligne.designation,
          data.affectations.filter(a => a.quantite > 0).map(a => ({ travailId: a.travailId, quantite: a.quantite })),
          data.stockQuantite
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      
      // Calculer si tout est reçu
      const totalCommande = commande.lignes?.reduce((sum: number, l: any) => sum + l.quantite, 0) || 0;
      const totalRecu = Object.values(affectationsParLigne).reduce((sum, l) => sum + l.quantiteRecue, 0);
      const toutRecu = totalRecu >= totalCommande && totalCommande > 0;
      
      toast.success('Réception validée avec succès');
      onSuccess(toutRecu);
    } catch (err) {
      console.error('Erreur réception:', err);
      toast.error('Erreur lors de la réception');
    } finally {
      setIsSaving(false);
    }
  };

  // Résumé des affectations
  const resume = useMemo(() => {
    const affectationsTravaux: { travailCode: string; designation: string; quantite: number }[] = [];
    const stockEntrees: { designation: string; quantite: number }[] = [];
    
    Object.values(affectationsParLigne).forEach(ligne => {
      const ligneData = commande.lignes?.find((l: any) => l.id === ligne.ligneId);
      if (!ligneData) return;
      
      ligne.affectations.forEach(aff => {
        if (aff.quantite > 0) {
          affectationsTravaux.push({
            travailCode: aff.travailCode,
            designation: ligneData.designation,
            quantite: aff.quantite
          });
        }
      });
      
      if (ligne.stockQuantite > 0) {
        stockEntrees.push({
          designation: ligneData.designation,
          quantite: ligne.stockQuantite
        });
      }
    });
    
    return { affectationsTravaux, stockEntrees };
  }, [affectationsParLigne, commande.lignes]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Package className="w-6 h-6 text-green-400" />
                Réception de commande
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">{commande.code} - {commande.fournisseur}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">Analyse des besoins en cours...</p>
            </div>
          ) : (
            <>
              {/* Liste des lignes avec affectations */}
              <div className="space-y-4 mb-6">
                {commande.lignes?.map((ligne: any) => {
                  const data = affectationsParLigne[ligne.id];
                  if (!data) return null;
                  
                  const hasAffectations = data.affectations.length > 0;
                  
                  return (
                    <div key={ligne.id} className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                      {/* Header ligne */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">{ligne.designation}</div>
                          {ligne.reference && <div className="text-xs text-[var(--text-muted)]">Réf: {ligne.reference}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-[var(--text-muted)] mb-1">Commandé: {ligne.quantite}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-secondary)]">Reçu:</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantiteRecue(ligne.id, Math.max(0, data.quantiteRecue - 1))}
                                className="w-7 h-7 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={data.quantiteRecue}
                                onChange={(e) => updateQuantiteRecue(ligne.id, parseInt(e.target.value) || 0)}
                                className="w-14 text-center font-mono text-sm py-1 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded text-green-400 font-bold"
                              />
                              <button
                                onClick={() => updateQuantiteRecue(ligne.id, data.quantiteRecue + 1)}
                                className="w-7 h-7 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {data.quantiteRecue !== ligne.quantite && (
                              <button
                                onClick={() => updateQuantiteRecue(ligne.id, ligne.quantite)}
                                className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                              >
                                Tout
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Affectations aux travaux */}
                      {hasAffectations && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Travaux en attente de cette pièce :
                          </div>
                          <div className="space-y-2">
                            {data.affectations.map(aff => (
                              <div key={aff.travailId} className="flex items-center gap-3 p-2 bg-[var(--bg-elevated)] rounded-lg">
                                <input
                                  type="checkbox"
                                  checked={aff.quantite > 0}
                                  onChange={(e) => updateAffectation(ligne.id, aff.travailId, e.target.checked ? Math.min(aff.besoin, data.quantiteRecue) : 0)}
                                  className="w-4 h-4 rounded border-[var(--border-primary)] text-green-500"
                                />
                                <div className="flex-1">
                                  <span className="font-mono text-xs text-cyan-400">{aff.travailCode}</span>
                                  <span className="text-sm text-[var(--text-primary)] ml-2">{aff.travailTitre}</span>
                                  <span className="text-xs text-[var(--text-muted)] ml-2">(besoin: {aff.besoin})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-[var(--text-muted)]">Affecter:</span>
                                  <button
                                    onClick={() => updateAffectation(ligne.id, aff.travailId, Math.max(0, aff.quantite - 1))}
                                    className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={Math.min(aff.besoin, data.quantiteRecue)}
                                    value={aff.quantite}
                                    onChange={(e) => updateAffectation(ligne.id, aff.travailId, parseInt(e.target.value) || 0)}
                                    className="w-12 text-center font-mono text-sm py-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)]"
                                  />
                                  <button
                                    onClick={() => updateAffectation(ligne.id, aff.travailId, Math.min(aff.besoin, aff.quantite + 1))}
                                    className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex items-center justify-center hover:bg-[var(--bg-hover)]"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => affecterTout(ligne.id, aff.travailId)}
                                    className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 ml-1"
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Reste au stock */}
                      <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-[var(--text-primary)]">Ajouter au stock</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-blue-400">{data.stockQuantite}</span>
                          {hasAffectations && (
                            <button
                              onClick={() => toutAuStock(ligne.id)}
                              className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                            >
                              Tout
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Résumé */}
              <div className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-primary)] mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Résumé de la réception</h3>
                
                {resume.affectationsTravaux.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-amber-400 font-medium mb-1">→ Affectations aux travaux :</div>
                    {resume.affectationsTravaux.map((aff, i) => (
                      <div key={i} className="text-sm text-[var(--text-secondary)] ml-2">
                        • {aff.quantite}x {aff.designation} → <span className="font-mono text-cyan-400">{aff.travailCode}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {resume.stockEntrees.length > 0 && (
                  <div>
                    <div className="text-xs text-blue-400 font-medium mb-1">→ Entrées en stock :</div>
                    {resume.stockEntrees.map((entry, i) => (
                      <div key={i} className="text-sm text-[var(--text-secondary)] ml-2">
                        • {entry.quantite}x {entry.designation}
                      </div>
                    ))}
                  </div>
                )}
                
                {resume.affectationsTravaux.length === 0 && resume.stockEntrees.length === 0 && (
                  <div className="text-sm text-[var(--text-muted)]">Aucune affectation configurée</div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isSaving}>
                  Annuler
                </Button>
                <Button variant="primary" className="flex-1" onClick={validerReception} disabled={isSaving}>
                  {isSaving ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Valider la réception
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// Modal détail commande
function CommandeDetailModal({
  commande,
  onClose,
  onEdit,
  onArchive,
  onStatusChange,
  onReception,
}: {
  commande: Commande;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onStatusChange: (statut: StatutCommande) => void;
  onReception: () => void;
}) {
  const queryClient = useQueryClient();
  const config = STATUT_CONFIG[commande.statut] || STATUT_CONFIG.brouillon;
  const prioriteConfig = PRIORITE_CONFIG[commande.priorite] || PRIORITE_CONFIG.normale;

  const deleteLigneMutation = useMutation({
    mutationFn: deleteCommandeLigne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Ligne supprimée');
    },
  });

  // Calculer les stats de réception
  const statsReception = useMemo(() => {
    if (!commande.lignes) return { total: 0, recues: 0, complete: false };
    const total = commande.lignes.reduce((sum: number, l: any) => sum + l.quantite, 0);
    const recues = commande.lignes.reduce((sum: number, l: any) => sum + (l.quantite_recue || 0), 0);
    return { total, recues, complete: recues >= total };
  }, [commande.lignes]);

  // Workflow des statuts
  const getNextStatuts = (): StatutCommande[] => {
    switch (commande.statut) {
      case 'brouillon': return ['en_attente', 'annulee'];
      case 'en_attente': return ['validee', 'annulee'];
      case 'validee': return ['commandee', 'annulee'];
      case 'commandee': return ['expediee', 'annulee'];
      case 'expediee': return [];
      default: return [];
    }
  };

  // Peut-on réceptionner ? Seulement si commandée/expédiée ET pas tout reçu
  const canReceptionner = ['commandee', 'expediee'].includes(commande.statut) && !statsReception.complete;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-lg font-bold text-cyan-400">{commande.code}</span>
                <Badge variant={config.color}>{config.label}</Badge>
                <Badge variant={prioriteConfig.color}>{prioriteConfig.label}</Badge>
              </div>
              <div className="text-[var(--text-secondary)]">{commande.fournisseur}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onArchive} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <Archive className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>

          {/* Infos */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {commande.reference_fournisseur && (
              <div>
                <div className="text-xs text-[var(--text-muted)]">Réf. fournisseur</div>
                <div className="text-sm text-[var(--text-primary)]">{commande.reference_fournisseur}</div>
              </div>
            )}
            {commande.date_commande && (
              <div>
                <div className="text-xs text-[var(--text-muted)]">Date commande</div>
                <div className="text-sm text-[var(--text-primary)]">
                  {format(new Date(commande.date_commande), 'dd/MM/yyyy', { locale: fr })}
                </div>
              </div>
            )}
            {commande.date_livraison_prevue && (
              <div>
                <div className="text-xs text-[var(--text-muted)]">Livraison prévue</div>
                <div className="text-sm text-[var(--text-primary)]">
                  {format(new Date(commande.date_livraison_prevue), 'dd/MM/yyyy', { locale: fr })}
                </div>
              </div>
            )}
            {commande.date_reception && (
              <div>
                <div className="text-xs text-[var(--text-muted)]">Date réception</div>
                <div className="text-sm text-[var(--text-primary)]">
                  {format(new Date(commande.date_reception), 'dd/MM/yyyy', { locale: fr })}
                </div>
              </div>
            )}
          </div>

          {/* Lignes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Package className="w-4 h-4" /> Articles ({commande.lignes?.length || 0})
                {statsReception.recues > 0 && (
                  <Badge variant={statsReception.complete ? 'green' : 'amber'}>
                    {statsReception.recues}/{statsReception.total} reçus
                  </Badge>
                )}
              </h3>
              {canReceptionner && (
                <Button variant="primary" size="sm" onClick={onReception}>
                  <Package className="w-4 h-4" /> Réceptionner
                </Button>
              )}
            </div>
            
            {commande.lignes && commande.lignes.length > 0 ? (
              <div className="space-y-2">
                {commande.lignes.map((ligne: any) => {
                  const qteRecue = ligne.quantite_recue || 0;
                  const isComplete = qteRecue >= ligne.quantite;
                  const isPartial = qteRecue > 0 && qteRecue < ligne.quantite;
                  
                  return (
                    <div 
                      key={ligne.id} 
                      className={`p-3 rounded-lg border ${
                        isComplete 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : isPartial 
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{ligne.designation}</span>
                            {isComplete && <Check className="w-4 h-4 text-green-400" />}
                          </div>
                          {ligne.reference && <div className="text-xs text-[var(--text-muted)]">Réf: {ligne.reference}</div>}
                          {ligne.detail && <div className="text-xs text-[var(--text-tertiary)]">{ligne.detail}</div>}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {(qteRecue > 0 || commande.statut === 'recue') && (
                              <span className={`text-xs ${isComplete ? 'text-green-400' : 'text-amber-400'}`}>
                                {qteRecue} reçu(s)
                              </span>
                            )}
                            <span className="font-mono font-bold text-[var(--text-primary)]">x{ligne.quantite}</span>
                          </div>
                          
                          {commande.statut === 'brouillon' && (
                            <button
                              onClick={() => deleteLigneMutation.mutate(ligne.id)}
                              className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">Aucun article</div>
            )}
          </div>

          {/* Notes */}
          {commande.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Notes</h3>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-sm text-[var(--text-secondary)]">
                {commande.notes}
              </div>
            </div>
          )}

          {/* Actions statut */}
          {getNextStatuts().length > 0 && (
            <div className="border-t border-[var(--border-primary)] pt-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Changer le statut</h3>
              <div className="flex flex-wrap gap-2">
                {getNextStatuts().map(statut => {
                  const cfg = STATUT_CONFIG[statut] || STATUT_CONFIG.brouillon;
                  return (
                    <Button
                      key={statut}
                      variant="secondary"
                      onClick={() => onStatusChange(statut)}
                      className={statut === 'annulee' ? 'text-red-400 hover:bg-red-500/20' : ''}
                    >
                      <cfg.icon className="w-4 h-4" /> {cfg.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
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
  const [receptionCommande, setReceptionCommande] = useState<Commande | null>(null);
  const [archiveItem, setArchiveItem] = useState<Commande | null>(null);
  const queryClient = useQueryClient();

  const { data: commandes, isLoading } = useQuery({
    queryKey: ['commandes'],
    queryFn: () => getCommandes(),
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, lignes }: { data: Partial<Commande>; lignes: LigneForm[] }) => {
      const commande = await createCommande(data);
      // Ajouter les lignes
      for (const ligne of lignes) {
        await addCommandeLigne({
          commande_id: commande.id,
          article_id: ligne.article_id || null,
          designation: ligne.designation,
          reference: ligne.reference || null,
          quantite: ligne.quantite,
          ascenseur_id: ligne.ascenseur_id || null,
          detail: ligne.detail || null,
        });
      }
      return commande;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande créée');
      setShowForm(false);
    },
    onError: (err: any) => {
      console.error('Erreur création commande:', err);
      toast.error('Erreur: ' + err.message);
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
      const matchSearch = c.code?.toLowerCase().includes(search.toLowerCase()) || 
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
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouvelle commande
        </Button>
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
              const config = STATUT_CONFIG[commande.statut] || STATUT_CONFIG.brouillon;
              const prioriteConfig = PRIORITE_CONFIG[commande.priorite] || PRIORITE_CONFIG.normale;
              const StatusIcon = config.icon;
              
              // Calculer si tout est reçu
              const totalCommande = commande.lignes?.reduce((sum: number, l: any) => sum + l.quantite, 0) || 0;
              const totalRecu = commande.lignes?.reduce((sum: number, l: any) => sum + (l.quantite_recue || 0), 0) || 0;
              const toutRecu = totalRecu >= totalCommande && totalCommande > 0;
              
              // Adapter nextAction si tout est reçu
              const nextAction = toutRecu && commande.statut === 'expediee' 
                ? null 
                : getNextAction(commande.statut);
              
              return (
                <div
                  key={commande.id}
                  className="p-4 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-4 flex-1 cursor-pointer"
                      onClick={() => setDetailCommande(commande)}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-${config.color}-500/20 flex items-center justify-center`}>
                        <StatusIcon className={`w-6 h-6 text-${config.color}-400`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-cyan-400">{commande.code}</span>
                          <Badge variant={config.color}>{config.label}</Badge>
                          <Badge variant={prioriteConfig.color}>{prioriteConfig.label}</Badge>
                          {toutRecu && ['commandee', 'expediee'].includes(commande.statut) && (
                            <Badge variant="green">Tout reçu</Badge>
                          )}
                        </div>
                        <div className="text-sm text-[var(--text-primary)]">{commande.fournisseur}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {commande.lignes?.length || 0} article(s)
                          {commande.date_commande && ` • Commandé le ${format(new Date(commande.date_commande), 'dd/MM/yyyy', { locale: fr })}`}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions rapides */}
                    <div className="flex items-center gap-2">
                      {nextAction && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (nextAction.next) {
                              handleStatusChange(commande, nextAction.next);
                            } else {
                              // Pour réceptionner, ouvrir le modal de réception
                              setReceptionCommande(commande);
                            }
                          }}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                            nextAction.next === null
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          }`}
                        >
                          <ArrowRight className="w-4 h-4" />
                          {nextAction.label}
                        </button>
                      )}
                      
                      <ActionDropdown
                        commande={commande}
                        onStatusChange={(statut) => handleStatusChange(commande, statut)}
                        onArchive={() => setArchiveItem(commande)}
                        onOpenDetail={() => setDetailCommande(commande)}
                        onReception={() => setReceptionCommande(commande)}
                        toutRecu={toutRecu}
                      />
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
        <CommandeFormModal
          onClose={() => setShowForm(false)}
          onSave={(data, lignes) => createMutation.mutate({ data, lignes })}
        />
      )}

      {detailCommande && (
        <CommandeDetailModal
          commande={detailCommande}
          onClose={() => setDetailCommande(null)}
          onEdit={() => { setEditCommande(detailCommande); setDetailCommande(null); }}
          onArchive={() => { setArchiveItem(detailCommande); }}
          onStatusChange={(statut) => handleStatusChange(detailCommande, statut)}
          onReception={() => { setReceptionCommande(detailCommande); setDetailCommande(null); }}
        />
      )}

      {receptionCommande && (
        <ReceptionModal
          commande={receptionCommande}
          onClose={() => setReceptionCommande(null)}
          onSuccess={(toutRecu) => {
            if (toutRecu) {
              handleStatusChange(receptionCommande, 'recue');
            }
            setReceptionCommande(null);
          }}
        />
      )}

      {archiveItem && (
        <ArchiveModal
          itemType="commande"
          itemCode={archiveItem.code}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          onClose={() => setArchiveItem(null)}
        />
      )}
    </div>
  );
}
