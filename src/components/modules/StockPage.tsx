import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Search, AlertTriangle, TrendingDown, TrendingUp, Plus, Minus, ArrowLeftRight, Check, X, Car, Warehouse, ShoppingCart } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getStockArticles, createStockMouvement, getStockGlobal, getTransferts, validerTransfert } from '@/services/api';
import { STATUT_TRANSFERT_CONFIG } from '@/types';
import { AddToPanierModal } from '@/components/Panier';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function StockPage() {
  const [search, setSearch] = useState('');
  const [filterAlerte, setFilterAlerte] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'depot' | 'global' | 'transferts'>('depot');
  const [filterTransfert, setFilterTransfert] = useState('en_attente');
  const [panierArticle, setPanierArticle] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: articles } = useQuery({ queryKey: ['stock'], queryFn: getStockArticles });
  const { data: stockGlobal } = useQuery({ queryKey: ['stock-global'], queryFn: getStockGlobal });
  const { data: transferts } = useQuery({ queryKey: ['transferts', filterTransfert], queryFn: () => getTransferts(filterTransfert) });

  const mouvementMutation = useMutation({
    mutationFn: ({ articleId, type, quantite }: { articleId: string; type: string; quantite: number }) =>
      createStockMouvement(articleId, type, quantite, type === 'entree' ? 'Entrée manuelle' : 'Sortie manuelle'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-global'] });
      toast.success('Stock mis à jour');
    },
  });

  const validerMutation = useMutation({
    mutationFn: ({ id, approuve }: { id: string; approuve: boolean }) => 
      validerTransfert(id, '44444444-4444-4444-4444-444444444444', approuve), // TODO: user courant
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferts'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-global'] });
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
      toast.success('Transfert traité');
    },
  });

  const getNiveauAlerte = (a: any) => {
    if (a.quantite_stock <= a.seuil_critique) return 'critique';
    if (a.quantite_stock <= a.seuil_alerte) return 'alerte';
    return 'ok';
  };

  const filtered = articles?.filter(a => {
    const matchSearch = a.reference.toLowerCase().includes(search.toLowerCase()) || a.designation.toLowerCase().includes(search.toLowerCase());
    const niveau = getNiveauAlerte(a);
    const matchAlerte = filterAlerte === 'all' || (filterAlerte === 'alerte' && niveau !== 'ok') || (filterAlerte === 'critique' && niveau === 'critique');
    return matchSearch && matchAlerte;
  }) || [];

  const stats = {
    total: articles?.length || 0,
    critique: articles?.filter(a => getNiveauAlerte(a) === 'critique').length || 0,
    alerte: articles?.filter(a => getNiveauAlerte(a) === 'alerte').length || 0,
    transferts_attente: transferts?.filter(t => t.statut === 'en_attente').length || 0,
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
            <div><div className="text-2xl font-extrabold text-red-400">{stats.critique}</div><div className="text-xs text-[var(--text-tertiary)]">Critique</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"><TrendingDown className="w-6 h-6 text-amber-400" /></div>
            <div><div className="text-2xl font-extrabold text-amber-400">{stats.alerte}</div><div className="text-xs text-[var(--text-tertiary)]">En alerte</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-green-400" /></div>
            <div><div className="text-2xl font-extrabold text-green-400">{stats.total - stats.critique - stats.alerte}</div><div className="text-xs text-[var(--text-tertiary)]">Stock OK</div></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><ArrowLeftRight className="w-6 h-6 text-purple-400" /></div>
            <div><div className="text-2xl font-extrabold text-purple-400">{stats.transferts_attente}</div><div className="text-xs text-[var(--text-tertiary)]">Transferts</div></div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-2">
        {[
          { id: 'depot', label: 'Stock dépôt', icon: Warehouse },
          { id: 'global', label: 'Vue globale', icon: Package },
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
                <option value="critique">Critique</option>
              </Select>
            </div>
            <Button variant="primary"><Plus className="w-4 h-4" /> Nouvel article</Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Référence</th>
                    <th className="text-left p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Désignation</th>
                    <th className="text-left p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Marque</th>
                    <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Dépôt</th>
                    <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Seuils</th>
                    <th className="text-right p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Prix</th>
                    <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(article => {
                    const niveau = getNiveauAlerte(article);
                    return (
                      <tr key={article.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]/30">
                        <td className="p-4"><span className="font-mono text-sm font-semibold text-blue-400">{article.reference}</span></td>
                        <td className="p-4">
                          <div className="text-sm text-[var(--text-primary)]">{article.designation}</div>
                          {article.categorie && <div className="text-xs text-[var(--text-muted)]">{article.categorie.nom}</div>}
                        </td>
                        <td className="p-4 text-sm text-[var(--text-secondary)]">{article.marque || '-'}</td>
                        <td className="p-4 text-center">
                          <span className={`text-lg font-bold ${niveau === 'critique' ? 'text-red-400' : niveau === 'alerte' ? 'text-amber-400' : 'text-green-400'}`}>
                            {article.quantite_stock}
                          </span>
                        </td>
                        <td className="p-4 text-center text-xs text-[var(--text-tertiary)]">
                          <span className="text-amber-400">{article.seuil_alerte}</span> / <span className="text-red-400">{article.seuil_critique}</span>
                        </td>
                        <td className="p-4 text-right text-sm text-[var(--text-primary)] font-mono">{article.prix_unitaire ? `${article.prix_unitaire.toFixed(2)} €` : '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setPanierArticle(article)} 
                              className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/30"
                              title="Ajouter au panier"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            <button onClick={() => mouvementMutation.mutate({ articleId: article.id, type: 'sortie', quantite: 1 })} disabled={article.quantite_stock <= 0} className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 disabled:opacity-50"><Minus className="w-4 h-4" /></button>
                            <button onClick={() => mouvementMutation.mutate({ articleId: article.id, type: 'entree', quantite: 1 })} className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30"><Plus className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                  <th className="text-left p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Référence</th>
                  <th className="text-left p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Désignation</th>
                  <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase"><Warehouse className="w-4 h-4 inline" /> Dépôt</th>
                  <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase"><Car className="w-4 h-4 inline" /> Véhicules</th>
                  <th className="text-center p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Total</th>
                  <th className="text-right p-4 text-xs font-semibold text-[var(--text-tertiary)] uppercase">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {stockGlobal?.map((item: any) => (
                  <tr key={item.article_id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]/30">
                    <td className="p-4"><span className="font-mono text-sm font-semibold text-blue-400">{item.reference}</span></td>
                    <td className="p-4 text-sm text-[var(--text-primary)]">{item.designation}</td>
                    <td className="p-4 text-center"><Badge variant="blue">{item.stock_depot}</Badge></td>
                    <td className="p-4 text-center"><Badge variant="green">{item.stock_vehicules}</Badge></td>
                    <td className="p-4 text-center text-lg font-bold text-[var(--text-primary)]">{item.stock_total}</td>
                    <td className="p-4 text-right text-sm text-[var(--text-primary)] font-mono">{item.prix_unitaire ? `${(item.stock_total * item.prix_unitaire).toFixed(2)} €` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <ArrowLeftRight className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-purple-400">{t.code}</span>
                          <Badge variant={STATUT_TRANSFERT_CONFIG[t.statut as keyof typeof STATUT_TRANSFERT_CONFIG].color}>
                            {STATUT_TRANSFERT_CONFIG[t.statut as keyof typeof STATUT_TRANSFERT_CONFIG].label}
                          </Badge>
                        </div>
                        <div className="text-sm text-[var(--text-primary)] mb-1">
                          <span className="font-semibold">{t.article?.reference}</span> - {t.article?.designation}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                          <span className={t.source_type === 'depot' ? 'text-blue-400' : 'text-green-400'}>
                            {t.source_type === 'depot' ? 'Dépôt' : t.source_vehicule?.immatriculation}
                          </span>
                          <span>→</span>
                          <span className={t.destination_type === 'depot' ? 'text-blue-400' : 'text-green-400'}>
                            {t.destination_type === 'depot' ? 'Dépôt' : t.destination_vehicule?.immatriculation}
                          </span>
                          <span className="mx-2">•</span>
                          <span>Qté: <strong>{t.quantite}</strong></span>
                          <span className="mx-2">•</span>
                          <span>Par: {t.demandeur?.prenom} {t.demandeur?.nom}</span>
                          <span className="mx-2">•</span>
                          <span>{format(new Date(t.date_demande), 'd MMM HH:mm', { locale: fr })}</span>
                        </div>
                      </div>
                    </div>

                    {t.statut === 'en_attente' && (
                      <div className="flex items-center gap-2">
                        <Button variant="success" size="sm" onClick={() => validerMutation.mutate({ id: t.id, approuve: true })}>
                          <Check className="w-4 h-4" /> Valider
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => validerMutation.mutate({ id: t.id, approuve: false })}>
                          <X className="w-4 h-4" /> Refuser
                        </Button>
                      </div>
                    )}
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

      {/* Modal ajout au panier */}
      {panierArticle && (
        <AddToPanierModal
          article={{
            id: panierArticle.id,
            code: panierArticle.reference,
            designation: panierArticle.designation,
            reference: panierArticle.reference,
          }}
          onClose={() => setPanierArticle(null)}
        />
      )}
    </div>
  );
}
