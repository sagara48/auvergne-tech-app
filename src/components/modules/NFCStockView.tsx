import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MapPin, Package, Plus, Minus, Check, X, Search,
  ShoppingCart, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input } from '@/components/ui';
import { 
  getStockArticles, createStockMouvement, createNFCScan
} from '@/services/api';
import { usePanierStore } from '@/stores/panierStore';
import type { StockArticle } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCStockViewProps {
  emplacement: string;
  tagId: string;
  onClose: () => void;
}

export function NFCStockView({ emplacement, tagId, onClose }: NFCStockViewProps) {
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<StockArticle | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [mode, setMode] = useState<'entree' | 'sortie'>('entree');
  const queryClient = useQueryClient();
  const { addItem: addToPanier } = usePanierStore();

  const { data: articles, isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: getStockArticles,
  });

  // Simuler des articles associés à cet emplacement
  // En prod, il faudrait une table stock_emplacements
  const emplacementArticles = articles?.filter(a => 
    a.designation?.toLowerCase().includes(search.toLowerCase()) ||
    a.reference?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const mouvementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedArticle) return;
      await createStockMouvement(
        selectedArticle.id,
        mode,
        quantite,
        `${mode === 'entree' ? 'Entrée' : 'Sortie'} via NFC - ${emplacement}`
      );
      // Log le scan
      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: mode === 'entree' ? 'inventaire' : 'sortie_stock',
        metadata: { 
          article_id: selectedArticle.id,
          designation: selectedArticle.designation,
          quantite,
          mode,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast.success(`${quantite}x ${selectedArticle?.designation} - ${mode === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
      setSelectedArticle(null);
      setQuantite(1);
    },
  });

  const handleAddToPanier = (article: StockArticle) => {
    addToPanier({
      article_id: article.id,
      code: article.reference,
      designation: article.designation,
      reference: article.reference,
      quantite: 1,
    });
    toast.success(`${article.designation} ajouté au panier`);
  };

  const getNiveauAlerte = (article: StockArticle) => {
    if (article.quantite_stock <= article.seuil_critique) return 'critique';
    if (article.quantite_stock <= article.seuil_alerte) return 'alerte';
    return 'ok';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-amber-400 text-lg">Emplacement Stock</div>
                <div className="text-sm text-[var(--text-primary)]">{emplacement}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Search + Mode */}
        <div className="p-4 border-b border-[var(--border-secondary)] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un article..."
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setMode('entree')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'entree' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-transparent'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" /> Entrée stock
            </button>
            <button
              onClick={() => setMode('sortie')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'sortie' 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-transparent'
              }`}
            >
              <Minus className="w-4 h-4 inline mr-2" /> Sortie stock
            </button>
          </div>
        </div>

        {/* Liste articles */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            </div>
          ) : !emplacementArticles?.length ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)]">Aucun article trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-secondary)]">
              {emplacementArticles.map(article => {
                const niveau = getNiveauAlerte(article);
                const isSelected = selectedArticle?.id === article.id;
                
                return (
                  <div key={article.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">
                            {article.designation}
                          </span>
                          {niveau === 'critique' && (
                            <Badge variant="red">
                              <AlertTriangle className="w-3 h-3" /> Critique
                            </Badge>
                          )}
                          {niveau === 'alerte' && (
                            <Badge variant="amber">Alerte</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-1">
                          <span>Réf: {article.reference}</span>
                          <span className={`font-semibold ${
                            niveau === 'critique' ? 'text-red-400' : 
                            niveau === 'alerte' ? 'text-amber-400' : 'text-green-400'
                          }`}>
                            Stock: {article.quantite_stock}
                          </span>
                        </div>
                      </div>
                      
                      {isSelected ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQuantite(Math.max(1, quantite - 1))}
                            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                          >
                            <Minus className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                          <span className="w-10 text-center font-medium text-[var(--text-primary)]">
                            {quantite}
                          </span>
                          <button
                            onClick={() => setQuantite(quantite + 1)}
                            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]"
                          >
                            <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                          <Button 
                            variant={mode === 'entree' ? 'success' : 'danger'}
                            size="sm"
                            onClick={() => mouvementMutation.mutate()}
                            disabled={mouvementMutation.isPending}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => { setSelectedArticle(null); setQuantite(1); }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddToPanier(article)}
                            className="p-2 hover:bg-cyan-500/20 rounded-lg"
                            title="Ajouter au panier"
                          >
                            <ShoppingCart className="w-4 h-4 text-cyan-400" />
                          </button>
                          <Button 
                            variant={mode === 'entree' ? 'success' : 'danger'}
                            size="sm"
                            onClick={() => setSelectedArticle(article)}
                            disabled={mode === 'sortie' && article.quantite_stock === 0}
                          >
                            {mode === 'entree' ? (
                              <><Plus className="w-4 h-4" /> Entrée</>
                            ) : (
                              <><Minus className="w-4 h-4" /> Sortie</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between text-sm text-[var(--text-tertiary)]">
            <span>{emplacementArticles?.length || 0} article(s) affiché(s)</span>
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
