import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, X, Trash2, Package, CheckCircle2, Circle, 
  ChevronDown, ChevronUp, ShoppingCart, Camera, XCircle, 
  AlertOctagon, MessageSquare, Clock, Route, AlertTriangle, Image
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { getAscenseurs, getStockArticles, createStockMouvement, getTournees } from '@/services/api';
import { supabase } from '@/services/supabase';
import { usePanierStore } from '@/stores/panierStore';
import type { Travaux, StatutTravaux, Priorite, StockArticle, Tournee } from '@/types';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: 'gray' | 'blue' | 'amber' | 'red' }> = {
  basse: { label: 'Basse', color: 'gray' },
  normale: { label: 'Normale', color: 'blue' },
  haute: { label: 'Haute', color: 'amber' },
  urgente: { label: 'Urgente', color: 'red' },
};

const STATUT_CONFIG: Record<StatutTravaux, { label: string; color: 'blue' | 'amber' | 'purple' | 'green' | 'gray' }> = {
  planifie: { label: 'Planifié', color: 'blue' },
  en_cours: { label: 'En cours', color: 'amber' },
  en_attente: { label: 'En attente', color: 'purple' },
  termine: { label: 'Terminé', color: 'green' },
  annule: { label: 'Annulé', color: 'gray' },
};

const TYPE_TRAVAUX = [
  { value: 'reparation', label: 'Réparation' },
  { value: 'modernisation', label: 'Modernisation' },
  { value: 'installation', label: 'Installation' },
  { value: 'mise_conformite', label: 'Mise en conformité' },
  { value: 'depannage', label: 'Dépannage' },
];

const STATUT_TACHE = [
  { value: 'a_faire', label: 'À faire', color: 'gray' },
  { value: 'en_cours', label: 'En cours', color: 'amber' },
  { value: 'termine', label: 'Terminé', color: 'green' },
  { value: 'non_conforme', label: 'Non conforme', color: 'red' },
];

// Types pour tâches et pièces
interface TacheForm {
  id: string;
  description: string;
  statut: 'a_faire' | 'en_cours' | 'termine' | 'non_conforme';
  ordre: number;
  remarque?: string;
  photos?: string[];
}

interface PieceForm {
  id: string;
  type: 'stock' | 'manuel';
  source: 'stock' | 'commande';
  article_id?: string;
  article?: StockArticle;
  designation: string;
  reference?: string;
  quantite: number;
  stock_disponible?: number;
  consommee?: boolean;
}

interface TravauxFormModalProps {
  travaux?: Travaux;
  onClose: () => void;
  onSave: (data: Partial<Travaux>) => void;
}

export function TravauxFormModal({ travaux, onClose, onSave }: TravauxFormModalProps) {
  const queryClient = useQueryClient();
  const { addItem } = usePanierStore();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editingTacheId, setEditingTacheId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    titre: travaux?.titre || '',
    description: travaux?.description || '',
    type_travaux: travaux?.type_travaux || 'reparation',
    priorite: travaux?.priorite || 'normale',
    statut: travaux?.statut || 'planifie',
    client_id: travaux?.client_id || '',
    ascenseur_id: travaux?.ascenseur_id || '',
    technicien_id: travaux?.technicien_id || '',
    tournee_id: (travaux as any)?.tournee_id || '',
    date_butoir: travaux?.date_butoir || '',
    devis_montant: travaux?.devis_montant || '',
  });

  // Tâches
  const [taches, setTaches] = useState<TacheForm[]>(() => {
    if (travaux?.taches && Array.isArray(travaux.taches)) {
      return travaux.taches.map((t: any, i: number) => ({
        id: t.id || `tache-${Date.now()}-${i}`,
        description: t.description || '',
        statut: t.statut || 'a_faire',
        ordre: t.ordre ?? i,
        remarque: t.remarque || '',
        photos: t.photos || [],
      }));
    }
    return [];
  });
  const [newTache, setNewTache] = useState('');

  // Pièces
  const [pieces, setPieces] = useState<PieceForm[]>(() => {
    if (travaux?.pieces && Array.isArray(travaux.pieces)) {
      return travaux.pieces.map((p: any, i: number) => ({
        id: p.id || `piece-${Date.now()}-${i}`,
        type: p.article_id ? 'stock' : 'manuel',
        source: p.source || (p.article_id ? 'stock' : 'commande'),
        article_id: p.article_id,
        designation: p.designation || '',
        reference: p.reference || '',
        quantite: p.quantite || 1,
        stock_disponible: p.stock_disponible,
        consommee: p.consommee || false,
      }));
    }
    return [];
  });
  const [showPieceForm, setShowPieceForm] = useState(false);
  const [pieceMode, setPieceMode] = useState<'stock' | 'manuel'>('stock');
  const [pieceSearch, setPieceSearch] = useState('');
  const [newPiece, setNewPiece] = useState({ designation: '', reference: '', quantite: 1, source: 'stock' as 'stock' | 'commande' });

  // Sections dépliables
  const [showTaches, setShowTaches] = useState(true);
  const [showPieces, setShowPieces] = useState(true);

  // Queries
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

  const { data: stockArticles } = useQuery({
    queryKey: ['stock-articles'],
    queryFn: getStockArticles,
  });

  const { data: tournees } = useQuery({
    queryKey: ['tournees'],
    queryFn: getTournees,
  });

  const techs = techniciens?.filter(t => t.role?.code === 'technicien' || t.role?.code === 'chef_equipe') || [];
  const filteredAscenseurs = form.client_id ? ascenseurs?.filter(a => a.client_id === form.client_id) : ascenseurs;

  // Filtrer les articles pour la recherche
  const filteredArticles = stockArticles?.filter(a => 
    pieceSearch && (
      a.designation.toLowerCase().includes(pieceSearch.toLowerCase()) ||
      a.reference?.toLowerCase().includes(pieceSearch.toLowerCase())
    )
  ).slice(0, 10) || [];

  // ===== GESTION DES TÂCHES =====
  
  const addTache = () => {
    if (!newTache.trim()) return;
    setTaches([...taches, {
      id: `tache-${Date.now()}`,
      description: newTache.trim(),
      statut: 'a_faire',
      ordre: taches.length,
      remarque: '',
      photos: [],
    }]);
    setNewTache('');
  };

  const removeTache = (id: string) => {
    setTaches(taches.filter(t => t.id !== id));
  };

  const updateTacheStatut = async (id: string, newStatut: TacheForm['statut']) => {
    const tache = taches.find(t => t.id === id);
    const oldStatut = tache?.statut;
    
    // Mise à jour du statut
    setTaches(taches.map(t => t.id === id ? { ...t, statut: newStatut } : t));

    // Si la tâche passe à "terminé", consommer les pièces du stock
    if (newStatut === 'termine' && oldStatut !== 'termine' && travaux) {
      const piecesAConsommer = pieces.filter(p => 
        p.source === 'stock' && 
        p.article_id && 
        !p.consommee && 
        (p.stock_disponible || 0) >= p.quantite
      );

      for (const piece of piecesAConsommer) {
        try {
          await createStockMouvement({
            article_id: piece.article_id!,
            type_mouvement: 'sortie',
            quantite: piece.quantite,
            technicien_id: CURRENT_USER_ID,
            source_type: 'depot',
            motif: `Travaux: ${travaux.titre || form.titre}`,
          });
          
          // Marquer comme consommée
          setPieces(prev => prev.map(p => 
            p.id === piece.id ? { ...p, consommee: true } : p
          ));
          
          toast.success(`${piece.designation} déduit du stock`);
        } catch (error) {
          toast.error(`Erreur pour ${piece.designation}`);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['stock-articles'] });
    }
  };

  const updateTacheRemarque = (id: string, remarque: string) => {
    setTaches(taches.map(t => t.id === id ? { ...t, remarque } : t));
  };

  // Gestion des photos
  const handlePhotoUpload = (tacheId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setTaches(prev => prev.map(t => {
          if (t.id === tacheId) {
            return { ...t, photos: [...(t.photos || []), base64] };
          }
          return t;
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (tacheId: string, photoIndex: number) => {
    setTaches(prev => prev.map(t => {
      if (t.id === tacheId) {
        const newPhotos = [...(t.photos || [])];
        newPhotos.splice(photoIndex, 1);
        return { ...t, photos: newPhotos };
      }
      return t;
    }));
  };

  // ===== GESTION DES PIÈCES =====

  const addPieceFromStock = (article: StockArticle) => {
    if (pieces.some(p => p.article_id === article.id)) {
      toast.error('Cette pièce est déjà dans la liste');
      return;
    }
    
    const stockDispo = article.quantite_stock || 0;
    
    setPieces([...pieces, {
      id: `piece-${Date.now()}`,
      type: 'stock',
      source: stockDispo > 0 ? 'stock' : 'commande',
      article_id: article.id,
      article,
      designation: article.designation,
      reference: article.reference || '',
      quantite: 1,
      stock_disponible: stockDispo,
      consommee: false,
    }]);
    setPieceSearch('');
    setShowPieceForm(false);
  };

  const addPieceManuelle = () => {
    if (!newPiece.designation.trim()) {
      toast.error('La désignation est requise');
      return;
    }
    setPieces([...pieces, {
      id: `piece-${Date.now()}`,
      type: 'manuel',
      source: newPiece.source,
      designation: newPiece.designation.trim(),
      reference: newPiece.reference.trim(),
      quantite: newPiece.quantite || 1,
      consommee: false,
    }]);
    setNewPiece({ designation: '', reference: '', quantite: 1, source: 'stock' });
    setShowPieceForm(false);
  };

  const removePiece = (id: string) => {
    setPieces(pieces.filter(p => p.id !== id));
  };

  const updatePieceQuantite = (id: string, quantite: number) => {
    setPieces(pieces.map(p => {
      if (p.id === id) {
        const newQte = Math.max(1, quantite);
        // Vérifier si le stock est suffisant
        const stockInsuffisant = p.source === 'stock' && p.stock_disponible !== undefined && newQte > p.stock_disponible;
        return { 
          ...p, 
          quantite: newQte,
          source: stockInsuffisant ? 'commande' : p.source
        };
      }
      return p;
    }));
  };

  const updatePieceSource = (id: string, source: 'stock' | 'commande') => {
    setPieces(pieces.map(p => p.id === id ? { ...p, source } : p));
  };

  // Ajouter une pièce au panier
  const addPieceToPanier = (piece: PieceForm) => {
    addItem({
      article_id: piece.article_id,
      designation: piece.designation,
      reference: piece.reference,
      quantite: piece.quantite,
      source: 'commandes',
      notes: `Pour travaux: ${travaux?.titre || form.titre}`,
    });
    toast.success(`${piece.designation} ajouté au panier`);
  };

  // Calcul progression
  const calculerProgression = () => {
    if (taches.length === 0) return 0;
    const terminees = taches.filter(t => t.statut === 'termine').length;
    return Math.round((terminees / taches.length) * 100);
  };

  // Pièces à commander (stock insuffisant ou source = commande)
  const piecesACommander = pieces.filter(p => 
    p.source === 'commande' || 
    (p.stock_disponible !== undefined && p.quantite > p.stock_disponible)
  );

  const handleSubmit = () => {
    if (!form.titre) {
      toast.error('Le titre est requis');
      return;
    }
    onSave({
      ...form,
      devis_montant: form.devis_montant ? parseFloat(form.devis_montant as string) : undefined,
      date_butoir: form.date_butoir || null,
      taches: taches.map(t => ({
        id: t.id,
        description: t.description,
        statut: t.statut,
        ordre: t.ordre,
        remarque: t.remarque,
        photos: t.photos,
      })),
      pieces: pieces.map(p => ({
        id: p.id,
        article_id: p.article_id,
        designation: p.designation,
        reference: p.reference,
        quantite: p.quantite,
        source: p.source,
        consommee: p.consommee,
      })),
      progression: calculerProgression(),
    });
  };

  const getStatutIcon = (statut: TacheForm['statut']) => {
    switch (statut) {
      case 'termine': return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'en_cours': return <Clock className="w-5 h-5 text-amber-400" />;
      case 'non_conforme': return <AlertOctagon className="w-5 h-5 text-red-400" />;
      default: return <Circle className="w-5 h-5 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[750px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{travaux ? 'Modifier le travaux' : 'Nouveau travaux'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Informations de base */}
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
                rows={2}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Technicien assigné</label>
                <Select value={form.technicien_id} onChange={e => setForm({ ...form, technicien_id: e.target.value })}>
                  <option value="">Non assigné</option>
                  {techs.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block flex items-center gap-2">
                  <Route className="w-4 h-4 text-green-400" />
                  Tournée d'entretien
                </label>
                <Select value={form.tournee_id} onChange={e => setForm({ ...form, tournee_id: e.target.value })}>
                  <option value="">Aucune tournée</option>
                  {tournees?.map(t => <option key={t.id} value={t.id}>{t.nom} ({t.secteur})</option>)}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Date butoir</label>
                <input
                  type="date"
                  value={form.date_butoir}
                  onChange={e => setForm({ ...form, date_butoir: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              {travaux && (
                <div>
                  <label className="text-sm text-[var(--text-tertiary)] mb-1 block">Statut</label>
                  <Select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value as any })}>
                    {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </div>
              )}
            </div>

            {/* ===== SECTION TÂCHES ===== */}
            <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTaches(!showTaches)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-[var(--text-primary)]">Tâches à réaliser</span>
                  <Badge variant="gray">{taches.length}</Badge>
                  {taches.length > 0 && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      ({calculerProgression()}% terminé)
                    </span>
                  )}
                </div>
                {showTaches ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
              </button>

              {showTaches && (
                <div className="p-4 space-y-3">
                  {/* Liste des tâches */}
                  {taches.length > 0 && (
                    <div className="space-y-2">
                      {taches.map((tache, index) => (
                        <div key={tache.id} className="rounded-xl border border-[var(--border-secondary)] overflow-hidden">
                          {/* Ligne principale de la tâche */}
                          <div 
                            className={`flex items-center gap-3 p-3 ${
                              tache.statut === 'termine' 
                                ? 'bg-green-500/10' 
                                : tache.statut === 'en_cours'
                                ? 'bg-amber-500/10'
                                : tache.statut === 'non_conforme'
                                ? 'bg-red-500/10'
                                : 'bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            <span className="text-xs text-[var(--text-muted)] w-5">{index + 1}.</span>
                            
                            <button
                              onClick={() => {
                                const statuts: TacheForm['statut'][] = ['a_faire', 'en_cours', 'termine', 'non_conforme'];
                                const currentIndex = statuts.indexOf(tache.statut);
                                const nextStatut = statuts[(currentIndex + 1) % statuts.length];
                                updateTacheStatut(tache.id, nextStatut);
                              }}
                              className="flex-shrink-0"
                            >
                              {getStatutIcon(tache.statut)}
                            </button>
                            
                            <span className={`flex-1 text-sm ${tache.statut === 'termine' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                              {tache.description}
                            </span>
                            
                            <Select
                              value={tache.statut}
                              onChange={e => updateTacheStatut(tache.id, e.target.value as TacheForm['statut'])}
                              className="w-32 text-xs py-1"
                            >
                              {STATUT_TACHE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </Select>

                            {/* Bouton remarque */}
                            <button
                              onClick={() => setEditingTacheId(editingTacheId === tache.id ? null : tache.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                tache.remarque || (tache.photos && tache.photos.length > 0)
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)]'
                              }`}
                              title="Remarques et photos"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>

                            {/* Bouton photo */}
                            <label className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                              <Camera className="w-4 h-4" />
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handlePhotoUpload(tache.id, e)}
                              />
                            </label>
                            
                            <button
                              onClick={() => removeTache(tache.id)}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-[var(--text-muted)] hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Zone remarque et photos (dépliable) */}
                          {editingTacheId === tache.id && (
                            <div className="p-3 bg-[var(--bg-elevated)] border-t border-[var(--border-secondary)] space-y-3">
                              <div>
                                <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Remarque</label>
                                <textarea
                                  value={tache.remarque || ''}
                                  onChange={e => updateTacheRemarque(tache.id, e.target.value)}
                                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] placeholder-dark-500 focus:outline-none focus:border-blue-500 resize-none"
                                  rows={2}
                                  placeholder="Ajouter une remarque..."
                                />
                              </div>

                              {/* Photos */}
                              {tache.photos && tache.photos.length > 0 && (
                                <div>
                                  <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Photos ({tache.photos.length})</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {tache.photos.map((photo, photoIndex) => (
                                      <div key={photoIndex} className="relative group">
                                        <img 
                                          src={photo} 
                                          alt={`Photo ${photoIndex + 1}`} 
                                          className="w-20 h-20 object-cover rounded-lg border border-[var(--border-secondary)]"
                                        />
                                        <button
                                          onClick={() => removePhoto(tache.id, photoIndex)}
                                          className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ajouter une tâche */}
                  <div className="flex gap-2">
                    <Input
                      value={newTache}
                      onChange={e => setNewTache(e.target.value)}
                      placeholder="Nouvelle tâche..."
                      className="flex-1"
                      onKeyDown={e => e.key === 'Enter' && addTache()}
                    />
                    <Button variant="secondary" onClick={addTache} disabled={!newTache.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ===== SECTION PIÈCES ===== */}
            <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowPieces(!showPieces)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-[var(--text-primary)]">Pièces nécessaires</span>
                  <Badge variant="gray">{pieces.length}</Badge>
                  {piecesACommander.length > 0 && (
                    <Badge variant="amber" className="text-xs">
                      {piecesACommander.length} à commander
                    </Badge>
                  )}
                </div>
                {showPieces ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
              </button>

              {showPieces && (
                <div className="p-4 space-y-3">
                  {/* Liste des pièces */}
                  {pieces.length > 0 && (
                    <div className="space-y-2">
                      {pieces.map((piece) => {
                        const stockInsuffisant = piece.source === 'stock' && piece.stock_disponible !== undefined && piece.quantite > piece.stock_disponible;
                        const needsOrder = piece.source === 'commande' || stockInsuffisant;
                        
                        return (
                          <div 
                            key={piece.id} 
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              piece.consommee 
                                ? 'bg-green-500/10 border-green-500/30'
                                : needsOrder 
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-secondary)]'
                            }`}
                          >
                            <Package className={`w-4 h-4 flex-shrink-0 ${
                              piece.consommee ? 'text-green-400' :
                              needsOrder ? 'text-amber-400' : 'text-blue-400'
                            }`} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {piece.designation}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                {piece.reference && <span>Réf: {piece.reference}</span>}
                                {piece.stock_disponible !== undefined && (
                                  <span className={piece.stock_disponible < piece.quantite ? 'text-red-400' : 'text-green-400'}>
                                    Stock: {piece.stock_disponible}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Source: Stock ou Commande */}
                            <Select
                              value={piece.source}
                              onChange={e => updatePieceSource(piece.id, e.target.value as 'stock' | 'commande')}
                              className="w-28 text-xs py-1"
                              disabled={piece.consommee}
                            >
                              <option value="stock">En stock</option>
                              <option value="commande">À commander</option>
                            </Select>
                            
                            {/* Indicateur */}
                            {piece.consommee ? (
                              <Badge variant="green" className="text-xs">Consommé</Badge>
                            ) : (
                              <Badge variant={piece.type === 'stock' ? 'blue' : 'purple'} className="text-xs">
                                {piece.type === 'stock' ? 'Stock' : 'Manuel'}
                              </Badge>
                            )}
                            
                            {/* Quantité */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updatePieceQuantite(piece.id, piece.quantite - 1)}
                                className="p-1 hover:bg-[var(--bg-hover)] rounded"
                                disabled={piece.quantite <= 1 || piece.consommee}
                              >
                                <span className="text-[var(--text-tertiary)]">−</span>
                              </button>
                              <span className="w-8 text-center text-sm font-medium text-[var(--text-primary)]">
                                {piece.quantite}
                              </span>
                              <button
                                onClick={() => updatePieceQuantite(piece.id, piece.quantite + 1)}
                                className="p-1 hover:bg-[var(--bg-hover)] rounded"
                                disabled={piece.consommee}
                              >
                                <span className="text-[var(--text-tertiary)]">+</span>
                              </button>
                            </div>

                            {/* Bouton ajouter au panier */}
                            {needsOrder && !piece.consommee && (
                              <button
                                onClick={() => addPieceToPanier(piece)}
                                className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-cyan-400"
                                title="Ajouter au panier"
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => removePiece(piece.id)}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-[var(--text-muted)] hover:text-red-400"
                              disabled={piece.consommee}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Alerte pièces à commander */}
                  {piecesACommander.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{piecesACommander.length} pièce(s) à commander</span>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => {
                          piecesACommander.forEach(p => addPieceToPanier(p));
                          toast.success('Pièces ajoutées au panier');
                        }}
                      >
                        <ShoppingCart className="w-4 h-4" /> Tout ajouter au panier
                      </Button>
                    </div>
                  )}

                  {/* Formulaire ajout pièce */}
                  {showPieceForm ? (
                    <div className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-secondary)] space-y-3">
                      {/* Toggle mode */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPieceMode('stock')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            pieceMode === 'stock'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          Depuis le stock
                        </button>
                        <button
                          onClick={() => setPieceMode('manuel')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            pieceMode === 'manuel'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          Saisie manuelle
                        </button>
                      </div>

                      {pieceMode === 'stock' ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                            <Input
                              value={pieceSearch}
                              onChange={e => setPieceSearch(e.target.value)}
                              placeholder="Rechercher une pièce..."
                              className="pl-10"
                            />
                          </div>
                          {filteredArticles.length > 0 && (
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border-secondary)]">
                              {filteredArticles.map(article => (
                                <button
                                  key={article.id}
                                  onClick={() => addPieceFromStock(article)}
                                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
                                >
                                  <div>
                                    <div className="text-sm text-[var(--text-primary)]">{article.designation}</div>
                                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                      {article.reference && <span>Réf: {article.reference}</span>}
                                      <span className={article.quantite_stock > 0 ? 'text-green-400' : 'text-red-400'}>
                                        Stock: {article.quantite_stock}
                                      </span>
                                    </div>
                                  </div>
                                  {article.quantite_stock > 0 ? (
                                    <Plus className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <ShoppingCart className="w-4 h-4 text-amber-400" title="Stock épuisé - sera ajouté en commande" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {pieceSearch && filteredArticles.length === 0 && (
                            <p className="text-sm text-[var(--text-muted)] text-center py-2">
                              Aucun article trouvé
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={newPiece.designation}
                            onChange={e => setNewPiece({ ...newPiece, designation: e.target.value })}
                            placeholder="Désignation *"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              value={newPiece.reference}
                              onChange={e => setNewPiece({ ...newPiece, reference: e.target.value })}
                              placeholder="Référence"
                            />
                            <Input
                              type="number"
                              min="1"
                              value={newPiece.quantite}
                              onChange={e => setNewPiece({ ...newPiece, quantite: parseInt(e.target.value) || 1 })}
                              placeholder="Qté"
                            />
                            <Select
                              value={newPiece.source}
                              onChange={e => setNewPiece({ ...newPiece, source: e.target.value as 'stock' | 'commande' })}
                            >
                              <option value="stock">En stock</option>
                              <option value="commande">À commander</option>
                            </Select>
                          </div>
                          <Button variant="primary" size="sm" className="w-full" onClick={addPieceManuelle}>
                            <Plus className="w-4 h-4" /> Ajouter la pièce
                          </Button>
                        </div>
                      )}

                      <button
                        onClick={() => setShowPieceForm(false)}
                        className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <Button variant="secondary" className="w-full" onClick={() => setShowPieceForm(true)}>
                      <Plus className="w-4 h-4" /> Ajouter une pièce
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Boutons actions */}
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
