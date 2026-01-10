import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingCart, X, Trash2, Plus, Minus, Package, Send,
  AlertTriangle, Check
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { usePanierStore } from '@/stores/panierStore';
import { createCommande, addCommandeLigne } from '@/services/api';
import toast from 'react-hot-toast';

// ID utilisateur actuel
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const FOURNISSEURS = [
  'Otis Parts',
  'Schindler Supply',
  'Thyssen Parts',
  'Kone Express',
  'Mitsubishi Electric',
  'Autre',
];

// Bouton flottant du panier
export function PanierButton() {
  const { items, togglePanier } = usePanierStore();
  const itemCount = items.reduce((sum, item) => sum + item.quantite, 0);

  return (
    <button
      onClick={togglePanier}
      className="relative p-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
      title="Panier de commande"
    >
      <ShoppingCart className="w-5 h-5 text-cyan-400" />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500 text-white text-xs font-bold flex items-center justify-center">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}

// Modal d'ajout rapide au panier
export function AddToPanierModal({
  article,
  onClose,
}: {
  article?: {
    id?: string;
    code?: string;
    designation?: string;
    reference?: string;
  };
  onClose: () => void;
}) {
  const isManual = !article?.designation;
  const [designation, setDesignation] = useState(article?.designation || '');
  const [reference, setReference] = useState(article?.reference || '');
  const [quantite, setQuantite] = useState(1);
  const [fournisseur, setFournisseur] = useState('');
  const [notes, setNotes] = useState('');
  const { addItem } = usePanierStore();

  const handleAdd = () => {
    if (!designation.trim()) {
      toast.error('Veuillez saisir une désignation');
      return;
    }
    addItem({
      article_id: article?.id,
      code: article?.code,
      designation: designation.trim(),
      reference: reference.trim() || undefined,
      quantite,
      fournisseur: fournisseur || undefined,
      notes: notes.trim() || undefined,
    });
    toast.success(`${designation} ajouté au panier`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[420px]">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {isManual ? 'Ajouter un article au panier' : 'Ajouter au panier'}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {!isManual && (
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] mb-4">
              <div className="font-medium text-[var(--text-primary)]">{designation}</div>
              {reference && (
                <div className="text-sm text-[var(--text-tertiary)]">Réf: {reference}</div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {isManual && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Désignation *</label>
                  <Input
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder="Ex: Contacteur 40A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Référence</label>
                  <Input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Ex: CT-40A-01"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Quantité</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantite(Math.max(1, quantite - 1))}
                  className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                >
                  <Minus className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
                <Input
                  type="number"
                  min={1}
                  value={quantite}
                  onChange={e => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <button
                  onClick={() => setQuantite(quantite + 1)}
                  className="p-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                >
                  <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fournisseur (optionnel)</label>
              <Select value={fournisseur} onChange={e => setFournisseur(e.target.value)}>
                <option value="">Non spécifié</option>
                {FOURNISSEURS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes (optionnel)</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Remarques, urgence..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button variant="primary" className="flex-1" onClick={handleAdd}>
              <ShoppingCart className="w-4 h-4" /> Ajouter
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Drawer du panier
export function PanierDrawer() {
  const queryClient = useQueryClient();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { items, isOpen, closePanier, removeItem, updateQuantite, clearPanier } = usePanierStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [commandeNotes, setCommandeNotes] = useState('');
  const [selectedFournisseur, setSelectedFournisseur] = useState('');

  // Grouper par fournisseur
  const itemsByFournisseur = items.reduce((acc, item) => {
    const fournisseur = item.fournisseur || 'Non spécifié';
    if (!acc[fournisseur]) acc[fournisseur] = [];
    acc[fournisseur].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const totalItems = items.reduce((sum, item) => sum + item.quantite, 0);

  // Mutation pour créer la commande
  const createCommandeMutation = useMutation({
    mutationFn: async () => {
      // Créer la commande
      const commande = await createCommande({
        technicien_id: CURRENT_USER_ID,
        fournisseur: selectedFournisseur || Object.keys(itemsByFournisseur)[0] || 'Divers',
        statut: 'brouillon',
        priorite: 'normale',
        notes: commandeNotes,
      });

      // Ajouter les lignes
      for (const item of items) {
        await addCommandeLigne({
          commande_id: commande.id,
          article_id: item.article_id,
          designation: item.designation,
          reference: item.reference,
          quantite: item.quantite,
          notes: item.notes,
        });
      }

      return commande;
    },
    onSuccess: (commande) => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success(`Commande ${commande.code} créée avec ${items.length} article(s)`);
      clearPanier();
      setShowConfirm(false);
      setCommandeNotes('');
      closePanier();
    },
    onError: () => {
      toast.error('Erreur lors de la création de la commande');
    },
  });

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        closePanier();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanier]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50">
      <div 
        ref={drawerRef}
        className="absolute right-0 top-0 h-full w-[420px] bg-[var(--bg-primary)] border-l border-[var(--border-secondary)] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">Panier</h2>
              <p className="text-sm text-[var(--text-tertiary)]">{totalItems} article(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Vider le panier ?')) clearPanier();
                }}
                className="p-2 hover:bg-red-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-red-400"
                title="Vider le panier"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={closePanier} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package className="w-16 h-16 text-[var(--text-muted)] mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">Panier vide</h3>
              <p className="text-sm text-[var(--text-tertiary)]">
                Ajoutez des articles depuis le Stock<br />ou créez une commande manuelle
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(itemsByFournisseur).map(([fournisseur, fournisseurItems]) => (
                <div key={fournisseur}>
                  <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-2">
                    {fournisseur}
                  </div>
                  <div className="space-y-2">
                    {fournisseurItems.map(item => (
                      <div 
                        key={item.id}
                        className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text-primary)] truncate">
                              {item.designation}
                            </div>
                            {item.reference && (
                              <div className="text-xs text-[var(--text-tertiary)]">
                                Réf: {item.reference}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-xs text-amber-400 mt-1">
                                💬 {item.notes}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantite(item.id, item.quantite - 1)}
                              className="p-1 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                            >
                              <Minus className="w-3 h-3 text-[var(--text-secondary)]" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium text-[var(--text-primary)]">
                              {item.quantite}
                            </span>
                            <button
                              onClick={() => updateQuantite(item.id, item.quantite + 1)}
                              className="p-1 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                            >
                              <Plus className="w-3 h-3 text-[var(--text-secondary)]" />
                            </button>
                          </div>
                          <Badge variant="cyan">{item.quantite} pièce(s)</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer avec action */}
        {items.length > 0 && (
          <div className="p-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
            {!showConfirm ? (
              <Button 
                variant="primary" 
                className="w-full"
                onClick={() => setShowConfirm(true)}
              >
                <Send className="w-4 h-4" />
                Passer la commande ({totalItems} article{totalItems > 1 ? 's' : ''})
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--text-secondary)]">
                    Une commande va être créée avec {items.length} article(s)
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">
                    Fournisseur principal
                  </label>
                  <Select 
                    value={selectedFournisseur} 
                    onChange={e => setSelectedFournisseur(e.target.value)}
                    className="text-sm"
                  >
                    <option value="">Sélectionner...</option>
                    {FOURNISSEURS.map(f => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">
                    Notes (optionnel)
                  </label>
                  <Input
                    value={commandeNotes}
                    onChange={e => setCommandeNotes(e.target.value)}
                    placeholder="Remarques sur la commande..."
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={() => createCommandeMutation.mutate()}
                    disabled={createCommandeMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                    {createCommandeMutation.isPending ? 'Création...' : 'Confirmer'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
