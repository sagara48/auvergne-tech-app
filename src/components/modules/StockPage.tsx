import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, Search, AlertTriangle, TrendingDown, TrendingUp, Plus, Minus, 
  ArrowLeftRight, Check, X, Warehouse, ShoppingCart, History, Eye, Edit, 
  Trash2, Tag, Calendar, QrCode, Download, Printer
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  getStockArticles, createStockMouvement, getStockGlobal, getTransferts, validerTransfert, 
  getStockMouvementsFiltered, getStockMouvementsByArticle, createStockArticle, updateStockArticle,
  deleteStockArticle, getStockCategories, createStockCategorie, updateStockCategorie, deleteStockCategorie,
  getTravauxEnAttentePieces
} from '@/services/api';
import {
  encodeStockQR, qrContentString, generateQRSvg, generateQRDataUrl,
  printLabels, downloadQRSvg,
} from '@/services/qrCodeService';
import { STATUT_TRANSFERT_CONFIG } from '@/types';
import { AddToPanierModal } from '@/components/Panier';
import { useAppStore } from '@/stores/appStore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Obtenir les dates du mois en cours
const getDefaultDates = () => {
  const now = new Date();
  return {
    debut: format(startOfMonth(now), 'yyyy-MM-dd'),
    fin: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
};

// ==================== MODAL DÉTAIL PIÈCE ====================
function ArticleDetailModal({ article, onClose, onEdit }: { article: any; onClose: () => void; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [dateDebut, setDateDebut] = useState(getDefaultDates().debut);
  const [dateFin, setDateFin] = useState(getDefaultDates().fin);
  const [ajustementType, setAjustementType] = useState<'entree' | 'sortie'>('entree');
  const [ajustementQte, setAjustementQte] = useState(1);
  const [ajustementMotif, setAjustementMotif] = useState('');

  const { data: mouvements, isLoading } = useQuery({
    queryKey: ['stock-mouvements-article', article.id, dateDebut, dateFin],
    queryFn: () => getStockMouvementsByArticle(article.id, dateDebut, dateFin),
  });

  const mouvementMutation = useMutation({
    mutationFn: () => createStockMouvement(article.id, ajustementType, ajustementQte, ajustementMotif || `Ajustement ${ajustementType}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-mouvements-article'] });
      queryClient.invalidateQueries({ queryKey: ['stock-mouvements-filtered'] });
      toast.success('Stock ajusté');
      setAjustementQte(1);
      setAjustementMotif('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStockArticle(article.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Article supprimé');
      onClose();
    },
    onError: () => toast.error('Impossible de supprimer (mouvements existants)'),
  });

  const getNiveauAlerte = () => {
    if (article.quantite_stock <= article.seuil_critique) return { label: 'Critique', color: 'red' };
    if (article.quantite_stock <= article.seuil_alerte) return { label: 'Alerte', color: 'amber' };
    return { label: 'OK', color: 'green' };
  };

  const niveau = getNiveauAlerte();

  // Stats mouvements
  const totalEntrees = mouvements?.filter((m: any) => m.type_mouvement === 'entree').reduce((acc: number, m: any) => acc + m.quantite, 0) || 0;
  const totalSorties = mouvements?.filter((m: any) => m.type_mouvement === 'sortie').reduce((acc: number, m: any) => acc + m.quantite, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[750px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-blue-400">{article.reference}</span>
                <Badge variant={niveau.color as any}>{niveau.label}</Badge>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{article.designation}</h2>
              {article.categorie && (
                <span className="text-sm text-[var(--text-tertiary)]">
                  <Tag className="w-3 h-3 inline mr-1" />{article.categorie.nom}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const payload = encodeStockQR(article);
                  downloadQRSvg(payload);
                  toast.success('QR Code téléchargé');
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
                title="Télécharger QR Code"
              >
                <QrCode className="w-5 h-5 text-cyan-400" />
              </button>
              <button
                onClick={() => {
                  const payload = encodeStockQR(article);
                  printLabels([payload]);
                }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
                title="Imprimer étiquette QR"
              >
                <Printer className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg" title="Modifier">
                <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button 
                onClick={() => {
                  if (confirm('Supprimer cet article ?')) deleteMutation.mutate();
                }} 
                className="p-2 hover:bg-red-500/20 rounded-lg" 
                title="Supprimer"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>

          {/* Infos principales */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{article.quantite_stock}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Stock actuel</div>
            </div>
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <div className="text-2xl font-extrabold text-amber-400">{article.seuil_alerte}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Seuil alerte</div>
            </div>
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <div className="text-2xl font-extrabold text-red-400">{article.seuil_critique}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Seuil critique</div>
            </div>
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl text-center">
              <div className="text-xs text-[var(--text-tertiary)] mb-1">Emplacement</div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{article.emplacement || '-'}</div>
            </div>
          </div>

          {/* Ajustement stock */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Ajuster le stock
            </h3>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setAjustementType('entree')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  ajustementType === 'entree'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />Entrée
              </button>
              <button
                onClick={() => setAjustementType('sortie')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  ajustementType === 'sortie'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <TrendingDown className="w-4 h-4 inline mr-2" />Sortie
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={ajustementQte}
                onChange={e => setAjustementQte(parseInt(e.target.value) || 1)}
                className="w-24"
                placeholder="Qté"
              />
              <Input
                value={ajustementMotif}
                onChange={e => setAjustementMotif(e.target.value)}
                placeholder="Motif (optionnel)"
                className="flex-1"
              />
              <Button 
                variant="primary" 
                onClick={() => mouvementMutation.mutate()}
                disabled={mouvementMutation.isPending || ajustementQte < 1}
              >
                Appliquer
              </Button>
            </div>
          </div>

          {/* Historique des mouvements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <History className="w-4 h-4" /> Historique des mouvements
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
                />
                <span className="text-[var(--text-muted)]">→</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={e => setDateFin(e.target.value)}
                  className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
                />
              </div>
            </div>

            {/* Résumé période */}
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-[var(--text-tertiary)]">Entrées:</span>
                <span className="font-bold text-green-400">+{totalEntrees}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-[var(--text-tertiary)]">Sorties:</span>
                <span className="font-bold text-red-400">-{totalSorties}</span>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-primary)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs text-[var(--text-tertiary)]">Date</th>
                    <th className="text-left py-2 px-3 text-xs text-[var(--text-tertiary)]">Type</th>
                    <th className="text-right py-2 px-3 text-xs text-[var(--text-tertiary)]">Qté</th>
                    <th className="text-right py-2 px-3 text-xs text-[var(--text-tertiary)]">Stock</th>
                    <th className="text-left py-2 px-3 text-xs text-[var(--text-tertiary)]">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">Chargement...</td></tr>
                  ) : mouvements?.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">Aucun mouvement sur cette période</td></tr>
                  ) : mouvements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-[var(--bg-tertiary)]/30">
                      <td className="py-2 px-3 text-[var(--text-tertiary)]">
                        {format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={m.type_mouvement === 'entree' ? 'green' : 'red'} className="text-xs">
                          {m.type_mouvement === 'entree' ? 'Entrée' : 'Sortie'}
                        </Badge>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${m.type_mouvement === 'entree' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.type_mouvement === 'entree' ? '+' : '-'}{m.quantite}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-primary)]">{m.quantite_apres}</td>
                      <td className="py-2 px-3 text-[var(--text-tertiary)] truncate max-w-[150px]" title={m.motif}>{m.motif || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ==================== MODAL CRÉATION/MODIFICATION PIÈCE ====================
function ArticleFormModal({ article, categories, onClose, onSave }: { 
  article?: any; 
  categories: any[];
  onClose: () => void; 
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    reference: article?.reference || '',
    designation: article?.designation || '',
    categorie_id: article?.categorie_id || '',
    quantite_stock: article?.quantite_stock ?? 0,
    seuil_alerte: article?.seuil_alerte ?? 5,
    seuil_critique: article?.seuil_critique ?? 2,
    emplacement: article?.emplacement || '',
    fournisseur: article?.fournisseur || '',
  });

  const handleSubmit = () => {
    if (!form.reference || !form.designation) {
      toast.error('Référence et désignation requises');
      return;
    }
    onSave({
      ...form,
      quantite_stock: parseInt(form.quantite_stock as any) || 0,
      seuil_alerte: parseInt(form.seuil_alerte as any) || 5,
      seuil_critique: parseInt(form.seuil_critique as any) || 2,
      categorie_id: form.categorie_id || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {article ? 'Modifier l\'article' : 'Nouvel article'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Référence *</label>
                <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Catégorie</label>
                <Select value={form.categorie_id} onChange={e => setForm({ ...form, categorie_id: e.target.value })}>
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Désignation *</label>
              <Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Stock initial</label>
                <Input type="number" min="0" value={form.quantite_stock} onChange={e => setForm({ ...form, quantite_stock: e.target.value as any })} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Seuil alerte</label>
                <Input type="number" min="0" value={form.seuil_alerte} onChange={e => setForm({ ...form, seuil_alerte: e.target.value as any })} />
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Seuil critique</label>
                <Input type="number" min="0" value={form.seuil_critique} onChange={e => setForm({ ...form, seuil_critique: e.target.value as any })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Emplacement</label>
                <Input value={form.emplacement} onChange={e => setForm({ ...form, emplacement: e.target.value })} placeholder="Ex: Étagère A3" />
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Fournisseur</label>
                <Input value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                {article ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ==================== MODAL GESTION CATÉGORIES ====================
function CategoriesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategorie, setNewCategorie] = useState({ nom: '', description: '' });
  const [editForm, setEditForm] = useState({ nom: '', description: '' });

  const { data: categories } = useQuery({ queryKey: ['stock-categories'], queryFn: getStockCategories });

  const createMutation = useMutation({
    mutationFn: () => createStockCategorie(newCategorie),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      setNewCategorie({ nom: '', description: '' });
      toast.success('Catégorie créée');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateStockCategorie(id, editForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      setEditingId(null);
      toast.success('Catégorie modifiée');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockCategorie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      toast.success('Catégorie supprimée');
    },
    onError: () => toast.error('Impossible de supprimer (articles liés)'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Tag className="w-5 h-5" /> Gérer les catégories
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Formulaire ajout */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Nouvelle catégorie</h3>
            <div className="flex gap-2">
              <Input
                value={newCategorie.nom}
                onChange={e => setNewCategorie({ ...newCategorie, nom: e.target.value })}
                placeholder="Nom de la catégorie"
                className="flex-1"
              />
              <Button variant="primary" onClick={() => createMutation.mutate()} disabled={!newCategorie.nom.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Liste des catégories */}
          <div className="space-y-2">
            {categories?.map((cat: any) => (
              <div key={cat.id} className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                {editingId === cat.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editForm.nom}
                      onChange={e => setEditForm({ ...editForm, nom: e.target.value })}
                      className="flex-1"
                    />
                    <button onClick={() => updateMutation.mutate(cat.id)} className="p-2 hover:bg-green-500/20 rounded-lg text-green-400">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cat.couleur && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.couleur }} />}
                      <span className="text-[var(--text-primary)]">{cat.nom}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => { setEditingId(cat.id); setEditForm({ nom: cat.nom, description: cat.description || '' }); }}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)]"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { if (confirm('Supprimer cette catégorie ?')) deleteMutation.mutate(cat.id); }}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(!categories || categories.length === 0) && (
              <p className="text-center text-[var(--text-muted)] py-4">Aucune catégorie</p>
            )}
          </div>

          <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ==================== PAGE PRINCIPALE STOCK ====================
export function StockPage() {
  const [search, setSearch] = useState('');
  const [filterAlerte, setFilterAlerte] = useState<string>('all');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'depot' | 'global' | 'mouvements' | 'transferts'>('depot');
  const [filterTransfert, setFilterTransfert] = useState('en_attente');
  const [panierArticle, setPanierArticle] = useState<any>(null);
  
  // Modals
  const [detailArticle, setDetailArticle] = useState<any>(null);
  const [editArticle, setEditArticle] = useState<any>(null);
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  
  // Filtres dates mouvements globaux
  const [mouvDateDebut, setMouvDateDebut] = useState(getDefaultDates().debut);
  const [mouvDateFin, setMouvDateFin] = useState(getDefaultDates().fin);
  
  const queryClient = useQueryClient();

  const { data: articles } = useQuery({ queryKey: ['stock'], queryFn: getStockArticles });
  const { data: stockGlobal } = useQuery({ queryKey: ['stock-global'], queryFn: getStockGlobal });
  const { data: transferts } = useQuery({ queryKey: ['transferts', filterTransfert], queryFn: () => getTransferts(filterTransfert) });
  const { data: mouvements } = useQuery({ 
    queryKey: ['stock-mouvements-filtered', mouvDateDebut, mouvDateFin], 
    queryFn: () => getStockMouvementsFiltered(mouvDateDebut, mouvDateFin) 
  });
  const { data: categories } = useQuery({ queryKey: ['stock-categories'], queryFn: getStockCategories });
  const { data: travauxBloques } = useQuery({ queryKey: ['travaux-attente-pieces'], queryFn: getTravauxEnAttentePieces });
  const { setModuleActif } = useAppStore();

  const mouvementMutation = useMutation({
    mutationFn: ({ articleId, type, quantite }: { articleId: string; type: string; quantite: number }) =>
      createStockMouvement(articleId, type, quantite, type === 'entree' ? 'Entrée manuelle' : 'Sortie manuelle'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-global'] });
      queryClient.invalidateQueries({ queryKey: ['stock-mouvements-filtered'] });
      toast.success('Stock mis à jour');
    },
  });

  const validerMutation = useMutation({
    mutationFn: ({ id, approuve }: { id: string; approuve: boolean }) => 
      validerTransfert(id, '44444444-4444-4444-4444-444444444444', approuve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferts'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.success('Transfert traité');
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: createStockArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      setShowNewArticle(false);
      toast.success('Article créé');
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateStockArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      setEditArticle(null);
      setDetailArticle(null);
      toast.success('Article modifié');
    },
  });

  const getNiveauAlerte = (a: any) => {
    if (a.quantite_stock <= a.seuil_critique) return 'critique';
    if (a.quantite_stock <= a.seuil_alerte) return 'alerte';
    return 'ok';
  };

  const filtered = articles?.filter(a => {
    const matchSearch = a.reference?.toLowerCase().includes(search.toLowerCase()) || a.designation?.toLowerCase().includes(search.toLowerCase());
    const niveau = getNiveauAlerte(a);
    const matchAlerte = filterAlerte === 'all' || (filterAlerte === 'alerte' && niveau !== 'ok') || (filterAlerte === 'critique' && niveau === 'critique');
    const matchCategorie = filterCategorie === 'all' || a.categorie_id === filterCategorie;
    return matchSearch && matchAlerte && matchCategorie;
  }) || [];

  const stats = {
    total: articles?.length || 0,
    critique: articles?.filter(a => getNiveauAlerte(a) === 'critique').length || 0,
    alerte: articles?.filter(a => getNiveauAlerte(a) === 'alerte').length || 0,
    transferts_attente: transferts?.filter((t: any) => t.statut === 'en_attente').length || 0,
  };

  // Stats mouvements période
  const mouvStats = {
    entrees: mouvements?.filter((m: any) => m.type_mouvement === 'entree').reduce((acc: number, m: any) => acc + m.quantite, 0) || 0,
    sorties: mouvements?.filter((m: any) => m.type_mouvement === 'sortie').reduce((acc: number, m: any) => acc + m.quantite, 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Package className="w-6 h-6 text-blue-400" /></div>
            <div><div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div><div className="text-xs text-[var(--text-tertiary)]">Références</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
            <div><div className="text-2xl font-extrabold text-red-400">{stats.critique}</div><div className="text-xs text-[var(--text-tertiary)]">Critiques</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-amber-400" /></div>
            <div><div className="text-2xl font-extrabold text-amber-400">{stats.alerte}</div><div className="text-xs text-[var(--text-tertiary)]">En alerte</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#B91C1C]/20 flex items-center justify-center"><ArrowLeftRight className="w-6 h-6 text-[#B91C1C]" /></div>
            <div><div className="text-2xl font-extrabold text-[#B91C1C]">{stats.transferts_attente}</div><div className="text-xs text-[var(--text-tertiary)]">Transferts</div></div>
          </CardBody>
        </Card>
        <Card className="cursor-pointer hover:bg-[var(--bg-tertiary)]" onClick={() => setShowCategories(true)}>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><Tag className="w-6 h-6 text-green-400" /></div>
            <div><div className="text-2xl font-extrabold text-green-400">{categories?.length || 0}</div><div className="text-xs text-[var(--text-tertiary)]">Catégories</div></div>
          </CardBody>
        </Card>
      </div>

      {/* ═══ SYNERGIES STOCK ═══ */}
      {/* Bandeau travaux bloqués */}
      {travauxBloques && travauxBloques.length > 0 && (
        <Card className="overflow-hidden border-red-500/30">
          <div className="flex items-center justify-between px-4 py-3 bg-red-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">
                  ⛔ {travauxBloques.length} travaux bloqués — pièces manquantes
                </div>
                <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {travauxBloques.slice(0, 3).map((t: any) => t.code || 'T-?').join(', ')}
                  {travauxBloques.length > 3 ? ` +${travauxBloques.length - 3} autres` : ''}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={() => setModuleActif('commandes')}>
                <ShoppingCart className="w-3.5 h-3.5" /> Commander
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModuleActif('travaux')}>
                Voir travaux
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Prévision consommation */}
      {articles && articles.length > 0 && (() => {
        const critiques = articles.filter((a: any) => a.quantite !== undefined && a.quantite_min !== undefined && a.quantite <= a.quantite_min * 1.5 && a.quantite > 0);
        if (critiques.length === 0) return null;
        return (
          <Card className="overflow-hidden">
            <div className="px-4 py-2.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Prévision consommation — articles à surveiller</span>
            </div>
            <CardBody className="py-2">
              <div className="grid grid-cols-3 gap-2">
                {critiques.slice(0, 6).map((a: any) => {
                  const ratio = a.quantite_min > 0 ? a.quantite / a.quantite_min : 1;
                  const color = ratio <= 0.5 ? 'red' : ratio <= 1 ? 'amber' : 'green';
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-tertiary)]">
                      <div className={`w-2 h-2 rounded-full bg-${color}-500`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{a.designation || '?'}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{a.quantite}/{a.quantite_min} — {ratio <= 0.5 ? 'Commandez vite' : 'À surveiller'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        );
      })()}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-2">
        {[
          { id: 'depot', label: 'Stock dépôt', icon: Warehouse },
          { id: 'global', label: 'Vue globale', icon: Package },
          { id: 'mouvements', label: 'Mouvements', icon: History },
          { id: 'transferts', label: 'Transferts', icon: ArrowLeftRight },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
            {tab.id === 'transferts' && stats.transferts_attente > 0 && (
              <Badge variant="purple">{stats.transferts_attente}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Stock dépôt */}
      {activeTab === 'depot' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
              </div>
              <Select value={filterAlerte} onChange={e => setFilterAlerte(e.target.value)} className="w-40">
                <option value="all">Tous</option>
                <option value="alerte">En alerte</option>
                <option value="critique">Critiques</option>
              </Select>
              <Select value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)} className="w-48">
                <option value="all">Toutes catégories</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => {
                if (!filtered || filtered.length === 0) return toast.error('Aucun article à imprimer');
                const payloads = filtered.map((a: any) => encodeStockQR(a));
                printLabels(payloads);
                toast.success(`${payloads.length} étiquettes QR générées`);
              }}>
                <QrCode className="w-4 h-4" /> QR étiquettes
              </Button>
              <Button variant="secondary" onClick={() => setShowCategories(true)}>
                <Tag className="w-4 h-4" /> Catégories
              </Button>
              <Button variant="primary" onClick={() => setShowNewArticle(true)}>
                <Plus className="w-4 h-4" /> Nouvel article
              </Button>
            </div>
          </div>

          <Card>
            <div className="divide-y divide-[var(--border-primary)]">
              {filtered.map(article => {
                const niveau = getNiveauAlerte(article);
                return (
                  <div key={article.id} className="p-4 hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setDetailArticle(article)}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          niveau === 'critique' ? 'bg-red-500/20' : niveau === 'alerte' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                        }`}>
                          <Package className={`w-6 h-6 ${
                            niveau === 'critique' ? 'text-red-400' : niveau === 'alerte' ? 'text-amber-400' : 'text-blue-400'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-blue-400">{article.reference}</span>
                            {article.categorie && (
                              <Badge variant="gray" className="text-xs">{article.categorie.nom}</Badge>
                            )}
                          </div>
                          <div className="text-[var(--text-primary)] font-medium">{article.designation}</div>
                          {article.emplacement && (
                            <div className="text-xs text-[var(--text-muted)]">📍 {article.emplacement}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-2xl font-extrabold ${
                            niveau === 'critique' ? 'text-red-400' : niveau === 'alerte' ? 'text-amber-400' : 'text-[var(--text-primary)]'
                          }`}>{article.quantite_stock}</div>
                          <div className="text-xs text-[var(--text-muted)]">min: {article.seuil_alerte}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => mouvementMutation.mutate({ articleId: article.id, type: 'sortie', quantite: 1 })} disabled={article.quantite_stock <= 0} className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 disabled:opacity-50"><Minus className="w-4 h-4" /></button>
                          <button onClick={() => mouvementMutation.mutate({ articleId: article.id, type: 'entree', quantite: 1 })} className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30"><Plus className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDetailArticle(article)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]" title="Détails">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditArticle(article)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]" title="Modifier">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => setPanierArticle(article)} className="p-2 hover:bg-cyan-500/20 rounded-lg text-cyan-400" title="Ajouter au panier">
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-[var(--text-muted)]">Aucun article trouvé</div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Vue globale */}
      {activeTab === 'global' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left py-4 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Article</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Dépôt</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Véhicules</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {stockGlobal?.map((item: any) => (
                  <tr key={item.article_id} className="hover:bg-[var(--bg-tertiary)]/30">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-blue-400">{item.reference}</span>
                      <div className="text-sm text-[var(--text-primary)]">{item.designation}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-primary)]">{item.stock_depot}</td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-primary)]">{item.stock_vehicules}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text-primary)]">{item.stock_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mouvements */}
      {activeTab === 'mouvements' && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historique global des mouvements</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="font-bold text-green-400">+{mouvStats.entrees}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="font-bold text-red-400">-{mouvStats.sorties}</span>
                </div>
                <div className="h-4 w-px bg-[var(--border-primary)]" />
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="date"
                  value={mouvDateDebut}
                  onChange={e => setMouvDateDebut(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
                />
                <span className="text-[var(--text-muted)]">→</span>
                <input
                  type="date"
                  value={mouvDateFin}
                  onChange={e => setMouvDateFin(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Article</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Type</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Qté</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Avant</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Après</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {mouvements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-[var(--bg-tertiary)]/30">
                      <td className="py-3 px-4 text-sm text-[var(--text-tertiary)]">
                        {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{m.article?.designation || '-'}</div>
                        {m.article?.reference && <div className="text-xs text-[var(--text-muted)]">{m.article.reference}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={m.type_mouvement === 'entree' ? 'green' : 'red'}>
                          {m.type_mouvement === 'entree' ? (
                            <><TrendingUp className="w-3 h-3 mr-1" /> Entrée</>
                          ) : (
                            <><TrendingDown className="w-3 h-3 mr-1" /> Sortie</>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-mono font-bold ${m.type_mouvement === 'entree' ? 'text-green-400' : 'text-red-400'}`}>
                          {m.type_mouvement === 'entree' ? '+' : '-'}{m.quantite}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[var(--text-muted)] font-mono">{m.quantite_avant ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-sm text-[var(--text-primary)] font-mono font-bold">{m.quantite_apres ?? '-'}</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-tertiary)] max-w-xs truncate" title={m.motif}>
                        {m.motif || '-'}
                      </td>
                    </tr>
                  ))}
                  {(!mouvements || mouvements.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                        Aucun mouvement sur cette période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Transferts */}
      {activeTab === 'transferts' && (
        <>
          <div className="flex items-center gap-3">
            <Select value={filterTransfert} onChange={e => setFilterTransfert(e.target.value)} className="w-48">
              <option value="all">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Validés</option>
              <option value="refuse">Refusés</option>
            </Select>
          </div>

          <div className="space-y-3">
            {transferts?.map((t: any) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#B91C1C]/20 flex items-center justify-center">
                        <ArrowLeftRight className="w-6 h-6 text-[#B91C1C]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-[#B91C1C]">{t.code}</span>
                          <Badge variant={STATUT_TRANSFERT_CONFIG[t.statut as keyof typeof STATUT_TRANSFERT_CONFIG]?.color as any}>
                            {STATUT_TRANSFERT_CONFIG[t.statut as keyof typeof STATUT_TRANSFERT_CONFIG]?.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-[var(--text-primary)]">{t.article?.designation}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {t.source_vehicule?.immatriculation || 'Dépôt'} → {t.destination_vehicule?.immatriculation || 'Dépôt'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-[var(--text-primary)]">{t.quantite}</div>
                        <div className="text-xs text-[var(--text-muted)]">unités</div>
                      </div>
                      {t.statut === 'en_attente' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => validerMutation.mutate({ id: t.id, approuve: true })}
                            className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => validerMutation.mutate({ id: t.id, approuve: false })}
                            className="w-10 h-10 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {(!transferts || transferts.length === 0) && (
              <Card><CardBody className="text-center py-8 text-[var(--text-muted)]">Aucun transfert</CardBody></Card>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {panierArticle && (
        <AddToPanierModal
          article={panierArticle}
          onClose={() => setPanierArticle(null)}
        />
      )}

      {detailArticle && (
        <ArticleDetailModal
          article={detailArticle}
          onClose={() => setDetailArticle(null)}
          onEdit={() => { setEditArticle(detailArticle); setDetailArticle(null); }}
        />
      )}

      {(showNewArticle || editArticle) && (
        <ArticleFormModal
          article={editArticle}
          categories={categories || []}
          onClose={() => { setShowNewArticle(false); setEditArticle(null); }}
          onSave={(data) => {
            if (editArticle) {
              updateArticleMutation.mutate({ id: editArticle.id, data });
            } else {
              createArticleMutation.mutate(data);
            }
          }}
        />
      )}

      {showCategories && (
        <CategoriesModal onClose={() => setShowCategories(false)} />
      )}
    </div>
  );
}
