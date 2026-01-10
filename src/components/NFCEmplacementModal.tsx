import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, X, Package, Plus, Minus, Check, Truck, MapPin,
  ClipboardList, RefreshCw, AlertTriangle, Search
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input } from '@/components/ui';
import {
  getStockArticles, createStockMouvement, createNFCScan,
  getStockVehicule
} from '@/services/api';
import type { NFCTag, StockArticle, StockVehicule } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface NFCEmplacementModalProps {
  tag: NFCTag;
  onClose: () => void;
}

type ActionType = 'view' | 'inventaire' | 'mouvement';

export function NFCEmplacementModal({ tag, onClose }: NFCEmplacementModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ActionType>('view');
  const [search, setSearch] = useState('');

  // Si c'est un emplacement véhicule, charger le stock véhicule
  const isVehicule = !!tag.vehicule_id;

  const { data: stockVehicule, isLoading: loadingVehicule } = useQuery({
    queryKey: ['stock-vehicule', tag.vehicule_id],
    queryFn: () => getStockVehicule(tag.vehicule_id!),
    enabled: isVehicule,
  });

  // Sinon, charger tous les articles (stock dépôt)
  const { data: allArticles, isLoading: loadingArticles } = useQuery({
    queryKey: ['stock'],
    queryFn: getStockArticles,
    enabled: !isVehicule,
  });

  const articles = isVehicule
    ? stockVehicule?.map(sv => ({
        ...sv.article!,
        quantite_emplacement: sv.quantite,
        stock_vehicule_id: sv.id,
      })) || []
    : allArticles?.filter(a =>
        a.emplacement?.toLowerCase().includes(tag.emplacement_code?.toLowerCase() || '')
      ) || [];

  const filteredArticles = articles.filter(a =>
    a.reference?.toLowerCase().includes(search.toLowerCase()) ||
    a.designation?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[650px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
                {isVehicule ? (
                  <Truck className="w-7 h-7 text-amber-400" />
                ) : (
                  <Box className="w-7 h-7 text-amber-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-400">{tag.emplacement_code}</h2>
                <div className="text-sm text-[var(--text-primary)]">
                  {tag.emplacement_description || tag.label}
                </div>
                {tag.vehicule && (
                  <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mt-1">
                    <Truck className="w-3 h-3" />
                    {tag.vehicule.immatriculation}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Actions rapides */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant={action === 'view' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAction('view')}
            >
              <Package className="w-4 h-4" /> Contenu
            </Button>
            <Button
              variant={action === 'inventaire' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAction('inventaire')}
            >
              <ClipboardList className="w-4 h-4" /> Inventaire
            </Button>
            <Button
              variant={action === 'mouvement' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAction('mouvement')}
            >
              <RefreshCw className="w-4 h-4" /> Mouvement
            </Button>
          </div>
        </div>

        {/* Recherche */}
        <div className="p-4 border-b border-[var(--border-secondary)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un article..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {(loadingVehicule || loadingArticles) ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : action === 'view' ? (
            <ViewContent articles={filteredArticles} emplacementCode={tag.emplacement_code || ''} />
          ) : action === 'inventaire' ? (
            <InventaireContent
              articles={filteredArticles}
              tagId={tag.id}
              emplacementCode={tag.emplacement_code || ''}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['stock'] });
                queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
                setAction('view');
              }}
            />
          ) : (
            <MouvementContent
              articles={filteredArticles}
              tagId={tag.id}
              emplacementCode={tag.emplacement_code || ''}
              isVehicule={isVehicule}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['stock'] });
                queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-secondary)] flex justify-between items-center">
          <div className="text-sm text-[var(--text-tertiary)]">
            {filteredArticles.length} article(s) à cet emplacement
          </div>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </Card>
    </div>
  );
}

// Vue du contenu
function ViewContent({ articles, emplacementCode }: { articles: any[]; emplacementCode: string }) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <Box className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucun article à cet emplacement</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {articles.map(article => (
        <div
          key={article.id}
          className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-purple-400" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">{article.designation}</div>
              <div className="text-xs text-[var(--text-tertiary)]">{article.reference}</div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={article.quantite_emplacement > 0 || article.quantite_stock > 0 ? 'green' : 'red'}>
              {article.quantite_emplacement ?? article.quantite_stock ?? 0} unité(s)
            </Badge>
            {article.seuil_critique && (article.quantite_emplacement ?? article.quantite_stock) <= article.seuil_critique && (
              <div className="text-xs text-amber-400 mt-1 flex items-center gap-1 justify-end">
                <AlertTriangle className="w-3 h-3" /> Stock critique
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mode inventaire
function InventaireContent({
  articles,
  tagId,
  emplacementCode,
  onComplete
}: {
  articles: any[];
  tagId: string;
  emplacementCode: string;
  onComplete: () => void;
}) {
  const [inventaire, setInventaire] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    articles.forEach(a => {
      init[a.id] = a.quantite_emplacement ?? a.quantite_stock ?? 0;
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const hasChanges = articles.some(a => {
    const original = a.quantite_emplacement ?? a.quantite_stock ?? 0;
    return inventaire[a.id] !== original;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Pour chaque article modifié, créer un mouvement d'ajustement
      for (const article of articles) {
        const original = article.quantite_emplacement ?? article.quantite_stock ?? 0;
        const nouveau = inventaire[article.id];
        const diff = nouveau - original;

        if (diff !== 0) {
          await createStockMouvement(
            article.id,
            diff > 0 ? 'entree' : 'sortie',
            Math.abs(diff),
            `Inventaire ${emplacementCode}`
          );
        }
      }

      // Enregistrer le scan inventaire
      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: 'inventaire',
        metadata: { inventaire, emplacementCode },
        device_info: 'web',
      });

      toast.success('Inventaire enregistré');
      onComplete();
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
        Mode inventaire : ajustez les quantités puis validez
      </div>

      <div className="space-y-2">
        {articles.map(article => {
          const original = article.quantite_emplacement ?? article.quantite_stock ?? 0;
          const current = inventaire[article.id] ?? 0;
          const changed = current !== original;

          return (
            <div
              key={article.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                changed ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{article.designation}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {article.reference} • Avant: {original}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInventaire({ ...inventaire, [article.id]: Math.max(0, current - 1) })}
                  className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  value={current}
                  onChange={e => setInventaire({ ...inventaire, [article.id]: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-20 text-center"
                />
                <button
                  onClick={() => setInventaire({ ...inventaire, [article.id]: current + 1 })}
                  className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {articles.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges || saving}>
            <Check className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Valider l\'inventaire'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Mode mouvement
function MouvementContent({
  articles,
  tagId,
  emplacementCode,
  isVehicule,
  onComplete
}: {
  articles: any[];
  tagId: string;
  emplacementCode: string;
  isVehicule: boolean;
  onComplete: () => void;
}) {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [mouvementType, setMouvementType] = useState<'entree' | 'sortie'>('sortie');
  const [quantite, setQuantite] = useState(1);
  const [motif, setMotif] = useState('');
  const [saving, setSaving] = useState(false);

  const handleMouvement = async () => {
    if (!selectedArticle) return;

    setSaving(true);
    try {
      await createStockMouvement(
        selectedArticle.id,
        mouvementType,
        quantite,
        motif || `${mouvementType === 'entree' ? 'Entrée' : 'Sortie'} ${emplacementCode}`
      );

      await createNFCScan({
        tag_id: tagId,
        technicien_id: CURRENT_USER_ID,
        action: mouvementType === 'entree' ? 'entree_stock' : 'sortie_stock',
        article_id: selectedArticle.id,
        quantite,
        metadata: { motif, emplacementCode },
        device_info: 'web',
      });

      toast.success(`${mouvementType === 'entree' ? 'Entrée' : 'Sortie'} enregistrée`);
      setSelectedArticle(null);
      setQuantite(1);
      setMotif('');
      onComplete();
    } catch (error) {
      toast.error('Erreur lors du mouvement');
    } finally {
      setSaving(false);
    }
  };

  const maxQty = selectedArticle
    ? (selectedArticle.quantite_emplacement ?? selectedArticle.quantite_stock ?? 0)
    : 1;

  return (
    <div className="space-y-4">
      {/* Type de mouvement */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMouvementType('sortie')}
          className={`p-3 rounded-lg border-2 transition-colors ${
            mouvementType === 'sortie'
              ? 'border-red-500 bg-red-500/10'
              : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <Minus className="w-6 h-6 mx-auto mb-1 text-red-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Sortie</span>
        </button>
        <button
          onClick={() => setMouvementType('entree')}
          className={`p-3 rounded-lg border-2 transition-colors ${
            mouvementType === 'entree'
              ? 'border-green-500 bg-green-500/10'
              : 'border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <Plus className="w-6 h-6 mx-auto mb-1 text-green-400" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Entrée</span>
        </button>
      </div>

      {/* Sélection article */}
      {!selectedArticle ? (
        <div className="space-y-2">
          <div className="text-sm text-[var(--text-secondary)] mb-2">Sélectionnez un article :</div>
          {articles.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              Aucun article disponible
            </div>
          ) : (
            articles.map(article => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{article.designation}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{article.reference}</div>
                  </div>
                </div>
                <Badge variant="gray">
                  {article.quantite_emplacement ?? article.quantite_stock ?? 0} en stock
                </Badge>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Article sélectionné */}
          <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-[var(--text-primary)]">{selectedArticle.designation}</div>
                <div className="text-sm text-[var(--text-tertiary)]">{selectedArticle.reference}</div>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded"
              >
                <X className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
            </div>

            <div className="text-sm text-[var(--text-secondary)]">
              Stock actuel: <span className="font-semibold text-[var(--text-primary)]">{maxQty}</span>
            </div>
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Quantité</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantite(Math.max(1, quantite - 1))}
                className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <Input
                type="number"
                value={quantite}
                onChange={e => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantite(mouvementType === 'sortie' ? Math.min(maxQty, Math.max(1, val)) : Math.max(1, val));
                }}
                className="w-24 text-center"
              />
              <button
                onClick={() => setQuantite(mouvementType === 'sortie' ? Math.min(maxQty, quantite + 1) : quantite + 1)}
                className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Motif */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Motif (optionnel)</label>
            <Input
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Ex: Réparation ASC-0042"
            />
          </div>

          {/* Validation */}
          <Button
            variant="primary"
            className="w-full"
            onClick={handleMouvement}
            disabled={saving || (mouvementType === 'sortie' && quantite > maxQty)}
          >
            <Check className="w-4 h-4" />
            {saving ? 'Enregistrement...' : `Confirmer ${mouvementType === 'entree' ? 'l\'entrée' : 'la sortie'}`}
          </Button>
        </div>
      )}
    </div>
  );
}
