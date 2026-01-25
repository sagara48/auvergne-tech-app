import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, AlertTriangle, Package, Truck, ArrowRight, Check, 
  Bell, RefreshCw, ShoppingCart, Warehouse, Plus, Minus
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';

interface ArticleSousSeuil {
  id: string;
  article_id: string;
  designation: string;
  reference?: string;
  quantite_stock: number;
  seuil_minimum: number;
  quantite_recommandee: number;
  stock_depot?: number;
  categorie?: string;
}

interface ReapprovisionnementAutoProps {
  vehicule: {
    id: string;
    immatriculation: string;
    marque?: string;
    modele?: string;
    technicien?: { id: string; prenom: string; nom: string };
  };
  onClose: () => void;
}

// Récupérer les articles sous le seuil pour un véhicule
async function getArticlesSousSeuil(vehiculeId: string): Promise<ArticleSousSeuil[]> {
  // Récupérer le stock du véhicule
  const { data: stockVehicule, error: svError } = await supabase
    .from('stock_vehicules')
    .select(`
      id,
      article_id,
      quantite,
      seuil_minimum,
      article:article_id(id, designation, reference, categorie_id, categorie:categorie_id(nom))
    `)
    .eq('vehicule_id', vehiculeId);

  if (svError) {
    console.error('Erreur récupération stock véhicule:', svError);
    return [];
  }

  // Récupérer le stock dépôt pour comparaison
  const articleIds = (stockVehicule || []).map((s: any) => s.article_id).filter(Boolean);
  
  let stockDepot: Record<string, number> = {};
  if (articleIds.length > 0) {
    const { data: depotData } = await supabase
      .from('stock_articles')
      .select('id, quantite_stock')
      .in('id', articleIds);
    
    (depotData || []).forEach((d: any) => {
      stockDepot[d.id] = d.quantite_stock;
    });
  }

  // Filtrer les articles sous le seuil
  const sousSeuil: ArticleSousSeuil[] = [];
  
  (stockVehicule || []).forEach((sv: any) => {
    const seuil = sv.seuil_minimum || 0;
    if (sv.quantite < seuil && sv.article) {
      sousSeuil.push({
        id: sv.id,
        article_id: sv.article_id,
        designation: sv.article.designation,
        reference: sv.article.reference,
        quantite_stock: sv.quantite,
        seuil_minimum: seuil,
        quantite_recommandee: Math.max(seuil - sv.quantite, seuil), // Au moins remonter au seuil
        stock_depot: stockDepot[sv.article_id] || 0,
        categorie: sv.article.categorie?.nom,
      });
    }
  });

  return sousSeuil.sort((a, b) => {
    // Trier par criticité (ratio stock/seuil)
    const ratioA = a.quantite_stock / a.seuil_minimum;
    const ratioB = b.quantite_stock / b.seuil_minimum;
    return ratioA - ratioB;
  });
}

// Créer une demande de transfert
async function creerDemandeTransfert(
  vehiculeId: string,
  technicienId: string,
  articles: { article_id: string; quantite: number; designation: string }[],
  note?: string
): Promise<void> {
  // Créer le transfert principal
  const { data: transfert, error: tError } = await supabase
    .from('stock_transferts')
    .insert({
      type: 'depot_vers_vehicule',
      vehicule_destination_id: vehiculeId,
      statut: 'en_attente',
      demandeur_id: technicienId,
      note: note || 'Réapprovisionnement automatique - Stock sous seuil',
    })
    .select()
    .single();

  if (tError) throw tError;

  // Créer les lignes de transfert
  const lignes = articles.map(a => ({
    transfert_id: transfert.id,
    article_id: a.article_id,
    quantite_demandee: a.quantite,
    designation: a.designation,
  }));

  const { error: lError } = await supabase
    .from('stock_transfert_lignes')
    .insert(lignes);

  if (lError) throw lError;

  // Créer une notification pour le responsable stock
  await supabase.from('notifications').insert({
    type: 'transfert',
    titre: 'Demande de réapprovisionnement',
    message: `${articles.length} article(s) demandé(s) pour réappro véhicule`,
    priorite: 'normale',
    lien: `/stock?transfert=${transfert.id}`,
  });
}

// Composant ligne article
function ArticleLine({ 
  article, 
  quantite, 
  onQuantiteChange, 
  selected, 
  onToggle 
}: { 
  article: ArticleSousSeuil;
  quantite: number;
  onQuantiteChange: (qty: number) => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const criticite = article.quantite_stock === 0 ? 'critique' : article.quantite_stock < article.seuil_minimum / 2 ? 'urgent' : 'normal';
  const disponible = (article.stock_depot || 0) >= quantite;

  return (
    <div className={`p-3 rounded-lg border transition-all ${
      selected 
        ? 'bg-lime-500/10 border-lime-500/50' 
        : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--border-hover)]'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
            selected ? 'bg-lime-500 border-lime-500' : 'border-[var(--border-primary)]'
          }`}
        >
          {selected && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Infos article */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {article.designation}
            </span>
            {criticite === 'critique' && (
              <Badge variant="red" className="text-[10px] animate-pulse">Rupture</Badge>
            )}
            {criticite === 'urgent' && (
              <Badge variant="orange" className="text-[10px]">Critique</Badge>
            )}
          </div>
          
          {article.reference && (
            <p className="text-xs text-[var(--text-muted)]">{article.reference}</p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className={`${article.quantite_stock === 0 ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
              Stock: <strong>{article.quantite_stock}</strong> / {article.seuil_minimum} min
            </span>
            <span className={disponible ? 'text-green-400' : 'text-orange-400'}>
              Dépôt: <strong>{article.stock_depot || 0}</strong>
              {!disponible && ' ⚠️'}
            </span>
          </div>
        </div>

        {/* Quantité */}
        {selected && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantiteChange(Math.max(1, quantite - 1))}
              className="w-7 h-7 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              value={quantite}
              onChange={e => onQuantiteChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 h-7 text-center text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded"
            />
            <button
              onClick={() => onQuantiteChange(quantite + 1)}
              className="w-7 h-7 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReapprovisionnementAuto({ vehicule, onClose }: ReapprovisionnementAutoProps) {
  const queryClient = useQueryClient();
  const [selectedArticles, setSelectedArticles] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [source, setSource] = useState<'depot' | 'commande'>('depot');

  const { data: articlesSousSeuil, isLoading } = useQuery({
    queryKey: ['articles-sous-seuil', vehicule.id],
    queryFn: () => getArticlesSousSeuil(vehicule.id),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vehicule.technicien?.id) throw new Error('Technicien non défini');
      
      const articles = Object.entries(selectedArticles).map(([articleId, quantite]) => {
        const article = articlesSousSeuil?.find(a => a.article_id === articleId);
        return {
          article_id: articleId,
          quantite,
          designation: article?.designation || '',
        };
      });

      await creerDemandeTransfert(vehicule.id, vehicule.technicien.id, articles, note);
    },
    onSuccess: () => {
      toast.success('Demande de réapprovisionnement créée');
      queryClient.invalidateQueries({ queryKey: ['stock-transferts'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const toggleArticle = (articleId: string, quantiteRecommandee: number) => {
    setSelectedArticles(prev => {
      const next = { ...prev };
      if (next[articleId]) {
        delete next[articleId];
      } else {
        next[articleId] = quantiteRecommandee;
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!articlesSousSeuil) return;
    const all: Record<string, number> = {};
    articlesSousSeuil.forEach(a => {
      all[a.article_id] = a.quantite_recommandee;
    });
    setSelectedArticles(all);
  };

  const selectedCount = Object.keys(selectedArticles).length;
  const totalArticles = articlesSousSeuil?.length || 0;

  // Vérifier disponibilité totale
  const tousDisponibles = useMemo(() => {
    if (!articlesSousSeuil) return true;
    return Object.entries(selectedArticles).every(([articleId, qty]) => {
      const article = articlesSousSeuil.find(a => a.article_id === articleId);
      return (article?.stock_depot || 0) >= qty;
    });
  }, [selectedArticles, articlesSousSeuil]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Réapprovisionnement</h2>
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                  <Truck className="w-4 h-4" />
                  {vehicule.marque} {vehicule.modele} - {vehicule.immatriculation}
                </p>
                {vehicule.technicien && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Technicien: {vehicule.technicien.prenom} {vehicule.technicien.nom}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alerte */}
          {totalArticles > 0 && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center gap-3">
              <Bell className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <p className="text-sm text-orange-300">
                <strong>{totalArticles} article{totalArticles > 1 ? 's' : ''}</strong> sous le seuil minimum
              </p>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 animate-spin text-lime-500" />
            </div>
          ) : totalArticles === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 text-green-400 opacity-50" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Stock OK</h3>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                Tous les articles sont au-dessus du seuil minimum
              </p>
            </div>
          ) : (
            <>
              {/* Actions */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={selectAll}>
                    <Check className="w-4 h-4 mr-1" />
                    Tout sélectionner
                  </Button>
                  {selectedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedArticles({})}>
                      Désélectionner
                    </Button>
                  )}
                </div>
                <Badge variant={selectedCount > 0 ? 'lime' : 'gray'}>
                  {selectedCount} / {totalArticles} sélectionné{selectedCount > 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Liste des articles */}
              <div className="space-y-2 mb-4">
                {articlesSousSeuil?.map(article => (
                  <ArticleLine
                    key={article.article_id}
                    article={article}
                    quantite={selectedArticles[article.article_id] || article.quantite_recommandee}
                    onQuantiteChange={qty => setSelectedArticles(prev => ({ ...prev, [article.article_id]: qty }))}
                    selected={!!selectedArticles[article.article_id]}
                    onToggle={() => toggleArticle(article.article_id, article.quantite_recommandee)}
                  />
                ))}
              </div>

              {/* Options */}
              {selectedCount > 0 && (
                <Card className="mb-4">
                  <CardBody className="p-4 space-y-4">
                    {/* Source */}
                    <div>
                      <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                        Source
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSource('depot')}
                          className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                            source === 'depot'
                              ? 'bg-lime-500/20 border-lime-500 text-lime-400'
                              : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <Warehouse className="w-5 h-5 mx-auto mb-1" />
                          Stock dépôt
                        </button>
                        <button
                          onClick={() => setSource('commande')}
                          className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                            source === 'commande'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                              : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          <ShoppingCart className="w-5 h-5 mx-auto mb-1" />
                          Commande fournisseur
                        </button>
                      </div>
                    </div>

                    {/* Alerte disponibilité */}
                    {source === 'depot' && !tousDisponibles && (
                      <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <p className="text-xs text-orange-300">
                          ⚠️ Certains articles ne sont pas disponibles en quantité suffisante au dépôt
                        </p>
                      </div>
                    )}

                    {/* Note */}
                    <div>
                      <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                        Note (optionnel)
                      </label>
                      <Textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Ex: Besoin urgent pour intervention lundi..."
                        rows={2}
                      />
                    </div>
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selectedCount > 0 && (
          <div className="p-4 border-t border-[var(--border-primary)] flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">
              {selectedCount} article{selectedCount > 1 ? 's' : ''} • 
              {source === 'depot' ? ' Transfert depuis dépôt' : ' Commande fournisseur'}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button 
                variant="primary" 
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {source === 'depot' ? 'Créer demande transfert' : 'Créer commande'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Composant Badge d'alerte pour le tableau véhicules
export function VehiculeStockAlertBadge({ vehiculeId }: { vehiculeId: string }) {
  const { data: count } = useQuery({
    queryKey: ['articles-sous-seuil-count', vehiculeId],
    queryFn: async () => {
      const articles = await getArticlesSousSeuil(vehiculeId);
      return articles.length;
    },
    staleTime: 60000, // Cache 1 minute
  });

  if (!count || count === 0) return null;

  return (
    <Badge variant="orange" className="text-[10px] animate-pulse">
      {count} article{count > 1 ? 's' : ''} bas
    </Badge>
  );
}
