// src/components/integrations/TravauxPiecesEtapes.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Trash2, CheckCircle, Circle, Clock, AlertTriangle,
  ShoppingCart, Play, Pause, Check, X, ChevronDown, ChevronUp,
  GripVertical, Loader2, Search, AlertOctagon
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select, ProgressBar } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { usePanierStore } from '@/stores/panierStore';
import toast from 'react-hot-toast';

interface TravauxPiece {
  id: string;
  travaux_id: string;
  article_id?: string;
  reference: string;
  designation?: string;
  quantite_prevue: number;
  quantite_reservee: number;
  quantite_utilisee: number;
  source: string;
  prix_unitaire_ht?: number;
  prix_vente_ht?: number;
  statut: string;
}

interface TravauxEtape {
  id: string;
  travaux_id: string;
  numero: number;
  titre: string;
  description?: string;
  statut: string;
  pourcentage: number;
  duree_prevue_heures?: number;
  duree_reelle_heures?: number;
  technicien_id?: string;
  technicien?: { prenom: string; nom: string };
  date_debut_prevue?: string;
  date_fin_prevue?: string;
}

const STATUT_PIECE_CONFIG: Record<string, { label: string; color: 'gray' | 'blue' | 'amber' | 'purple' | 'green' }> = {
  a_commander: { label: 'À commander', color: 'gray' },
  reserve: { label: 'Réservé', color: 'blue' },
  commande: { label: 'Commandé', color: 'amber' },
  recu: { label: 'Reçu', color: 'purple' },
  installe: { label: 'Installé', color: 'green' },
};

const STATUT_ETAPE_CONFIG: Record<string, { label: string; color: 'gray' | 'blue' | 'amber' | 'green' | 'red'; icon: any }> = {
  a_faire: { label: 'À faire', color: 'gray', icon: Circle },
  en_cours: { label: 'En cours', color: 'amber', icon: Clock },
  en_pause: { label: 'En pause', color: 'blue', icon: Pause },
  termine: { label: 'Terminé', color: 'green', icon: CheckCircle },
  annule: { label: 'Annulé', color: 'red', icon: AlertOctagon },
};

const SOURCE_CONFIG: Record<string, string> = {
  a_definir: 'À définir',
  stock_depot: 'Stock dépôt',
  stock_vehicule: 'Stock véhicule',
  commande: 'Commande',
  fourni_client: 'Fourni client',
};

// ====================================
// COMPOSANT PIÈCES TRAVAUX
// ====================================
export function TravauxPieces({ travauxId }: { travauxId: string }) {
  const queryClient = useQueryClient();
  const { addItem } = usePanierStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');

  // Charger les pièces
  const { data: pieces, isLoading } = useQuery({
    queryKey: ['travaux-pieces', travauxId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travaux_pieces')
        .select('*')
        .eq('travaux_id', travauxId)
        .order('created_at');
      if (error) throw error;
      return data as TravauxPiece[];
    },
  });

  // Charger les articles stock
  const { data: articles } = useQuery({
    queryKey: ['stock-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_articles')
        .select('id, reference, designation, prix_unitaire, quantite_stock')
        .eq('actif', true)
        .order('reference');
      if (error) throw error;
      return data;
    },
  });

  // Ajouter pièce
  const addPieceMutation = useMutation({
    mutationFn: async (piece: Partial<TravauxPiece>) => {
      const { error } = await supabase.from('travaux_pieces').insert({
        travaux_id: travauxId,
        ...piece,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux-pieces', travauxId] });
      toast.success('Pièce ajoutée');
      setShowAddForm(false);
    },
  });

  // Mettre à jour statut pièce
  const updateStatutMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const updates: any = { statut };
      if (statut === 'installe') {
        const piece = pieces?.find(p => p.id === id);
        if (piece) updates.quantite_utilisee = piece.quantite_prevue;
      }
      const { error } = await supabase.from('travaux_pieces').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux-pieces', travauxId] });
      toast.success('Statut mis à jour');
    },
  });

  // Supprimer pièce
  const deletePieceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('travaux_pieces').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux-pieces', travauxId] });
      toast.success('Pièce supprimée');
    },
  });

  // Réserver depuis stock
  const reserverStockMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('travaux_reserver_pieces', { p_travaux_id: travauxId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['travaux-pieces', travauxId] });
      const reserves = data?.filter((r: any) => r.statut === 'reserve').length || 0;
      const aCommander = data?.filter((r: any) => r.statut === 'a_commander').length || 0;
      toast.success(`${reserves} réservée(s), ${aCommander} à commander`);
    },
    onError: () => toast.error('Erreur lors de la réservation'),
  });

  // Ajouter au panier les pièces à commander
  const ajouterAuPanier = () => {
    const piecesACommander = pieces?.filter(p => p.statut === 'a_commander') || [];
    piecesACommander.forEach(p => {
      addItem({
        id: p.article_id || p.id,
        reference: p.reference,
        designation: p.designation || '',
        quantite: p.quantite_prevue - p.quantite_reservee,
        prix_unitaire: p.prix_unitaire_ht || 0,
        fournisseur: 'Stock',
      });
    });
    toast.success(`${piecesACommander.length} pièce(s) ajoutée(s) au panier`);
  };

  // Stats
  const stats = {
    total: pieces?.length || 0,
    aCommander: pieces?.filter(p => p.statut === 'a_commander').length || 0,
    installees: pieces?.filter(p => p.statut === 'installe').length || 0,
    coutPrevu: pieces?.reduce((sum, p) => sum + (p.quantite_prevue * (p.prix_unitaire_ht || 0)), 0) || 0,
    coutReel: pieces?.reduce((sum, p) => sum + (p.quantite_utilisee * (p.prix_unitaire_ht || 0)), 0) || 0,
  };

  const filteredPieces = pieces?.filter(p => 
    !search || p.reference.toLowerCase().includes(search.toLowerCase()) || 
    p.designation?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-[var(--text-primary)]">Pièces nécessaires</span>
          <Badge variant="gray">{stats.total}</Badge>
          {stats.aCommander > 0 && (
            <Badge variant="amber">{stats.aCommander} à commander</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stats.aCommander > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={() => reserverStockMutation.mutate()} disabled={reserverStockMutation.isPending}>
                {reserverStockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Réserver stock
              </Button>
              <Button variant="secondary" size="sm" onClick={ajouterAuPanier}>
                <ShoppingCart className="w-4 h-4" />
                Ajouter au panier
              </Button>
            </>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alerte pièces à commander */}
      {stats.aCommander > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-amber-400">
            {stats.aCommander} pièce(s) à commander ou réserver
          </span>
        </div>
      )}

      {/* Liste pièces */}
      {isLoading ? (
        <div className="text-center py-4 text-[var(--text-muted)]">Chargement...</div>
      ) : filteredPieces.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Aucune pièce</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPieces.map(piece => {
            const statutConfig = STATUT_PIECE_CONFIG[piece.statut] || STATUT_PIECE_CONFIG.a_commander;
            
            return (
              <div key={piece.id} className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-purple-400">{piece.reference}</span>
                    <Badge variant={statutConfig.color}>{statutConfig.label}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{SOURCE_CONFIG[piece.source]}</span>
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] truncate">{piece.designation}</p>
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {piece.quantite_utilisee}/{piece.quantite_prevue}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">utilisé/prévu</div>
                </div>
                
                {piece.prix_unitaire_ht && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      {(piece.quantite_prevue * piece.prix_unitaire_ht).toFixed(2)}€
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{piece.prix_unitaire_ht}€/u</div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Select 
                    value={piece.statut} 
                    onChange={e => updateStatutMutation.mutate({ id: piece.id, statut: e.target.value })}
                    className="text-xs w-28"
                  >
                    {Object.entries(STATUT_PIECE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </Select>
                  <button 
                    onClick={() => deletePieceMutation.mutate(piece.id)}
                    className="p-1 hover:bg-red-500/20 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totaux */}
      {pieces && pieces.length > 0 && (
        <div className="flex items-center justify-end gap-6 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-sm">
            <span className="text-[var(--text-muted)]">Coût prévu:</span>
            <span className="ml-2 font-semibold text-[var(--text-primary)]">{stats.coutPrevu.toFixed(2)}€</span>
          </div>
          <div className="text-sm">
            <span className="text-[var(--text-muted)]">Coût réel:</span>
            <span className="ml-2 font-semibold text-green-400">{stats.coutReel.toFixed(2)}€</span>
          </div>
        </div>
      )}

      {/* Modal ajout pièce */}
      {showAddForm && (
        <AddPieceModal 
          articles={articles || []}
          onClose={() => setShowAddForm(false)}
          onAdd={(data) => addPieceMutation.mutate(data)}
          isLoading={addPieceMutation.isPending}
        />
      )}
    </div>
  );
}

// Modal ajout pièce
function AddPieceModal({ 
  articles, 
  onClose, 
  onAdd, 
  isLoading 
}: { 
  articles: any[];
  onClose: () => void;
  onAdd: (data: Partial<TravauxPiece>) => void;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<'stock' | 'manuel'>('stock');
  const [articleId, setArticleId] = useState('');
  const [reference, setReference] = useState('');
  const [designation, setDesignation] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [prixUnitaire, setPrixUnitaire] = useState(0);
  const [source, setSource] = useState('stock_depot');

  const selectedArticle = articles.find(a => a.id === articleId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      article_id: mode === 'stock' ? articleId : undefined,
      reference: mode === 'stock' ? selectedArticle?.reference : reference,
      designation: mode === 'stock' ? selectedArticle?.designation : designation,
      quantite_prevue: quantite,
      prix_unitaire_ht: mode === 'stock' ? selectedArticle?.prix_unitaire : prixUnitaire,
      source,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--text-primary)]">Ajouter une pièce</h3>
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode */}
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant={mode === 'stock' ? 'primary' : 'secondary'}
                onClick={() => setMode('stock')}
                className="flex-1"
              >
                Depuis stock
              </Button>
              <Button 
                type="button" 
                variant={mode === 'manuel' ? 'primary' : 'secondary'}
                onClick={() => setMode('manuel')}
                className="flex-1"
              >
                Manuel
              </Button>
            </div>

            {mode === 'stock' ? (
              <Select value={articleId} onChange={e => setArticleId(e.target.value)} required>
                <option value="">Sélectionner un article...</option>
                {articles.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.reference} - {a.designation} (stock: {a.quantite_stock})
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <Input 
                  value={reference} 
                  onChange={e => setReference(e.target.value)} 
                  placeholder="Référence *" 
                  required 
                />
                <Input 
                  value={designation} 
                  onChange={e => setDesignation(e.target.value)} 
                  placeholder="Désignation" 
                />
                <Input 
                  type="number" 
                  step="0.01"
                  value={prixUnitaire} 
                  onChange={e => setPrixUnitaire(parseFloat(e.target.value))} 
                  placeholder="Prix unitaire HT" 
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Quantité</label>
                <Input 
                  type="number" 
                  min="1"
                  value={quantite} 
                  onChange={e => setQuantite(parseInt(e.target.value))} 
                  required 
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Source</label>
                <Select value={source} onChange={e => setSource(e.target.value)}>
                  {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
              <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
                {isLoading ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ====================================
// COMPOSANT ÉTAPES TRAVAUX
// ====================================
export function TravauxEtapes({ travauxId }: { travauxId: string }) {
  const queryClient = useQueryClient();
  const [expandedEtape, setExpandedEtape] = useState<string | null>(null);

  // Charger les étapes
  const { data: etapes, isLoading } = useQuery({
    queryKey: ['travaux-etapes', travauxId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travaux_etapes')
        .select('*, technicien:technicien_id(prenom, nom)')
        .eq('travaux_id', travauxId)
        .order('numero');
      if (error) throw error;
      return data as TravauxEtape[];
    },
  });

  // Mettre à jour statut étape
  const updateStatutMutation = useMutation({
    mutationFn: async ({ id, statut, pourcentage }: { id: string; statut: string; pourcentage?: number }) => {
      const updates: any = { statut };
      if (pourcentage !== undefined) updates.pourcentage = pourcentage;
      if (statut === 'en_cours' && !updates.date_debut_reelle) {
        updates.date_debut_reelle = new Date().toISOString().split('T')[0];
      }
      if (statut === 'termine') {
        updates.pourcentage = 100;
        updates.date_fin_reelle = new Date().toISOString().split('T')[0];
      }
      const { error } = await supabase.from('travaux_etapes').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux-etapes', travauxId] });
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
    },
  });

  // Stats
  const stats = {
    total: etapes?.length || 0,
    terminees: etapes?.filter(e => e.statut === 'termine').length || 0,
    enCours: etapes?.filter(e => e.statut === 'en_cours').length || 0,
    pourcentageGlobal: etapes && etapes.length > 0 
      ? Math.round(etapes.reduce((sum, e) => sum + (e.pourcentage || 0), 0) / etapes.length)
      : 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="font-semibold text-[var(--text-primary)]">Étapes</span>
          <Badge variant="gray">{stats.terminees}/{stats.total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">{stats.pourcentageGlobal}%</span>
          <div className="w-24">
            <ProgressBar value={stats.pourcentageGlobal} variant={stats.pourcentageGlobal >= 100 ? 'green' : 'amber'} />
          </div>
        </div>
      </div>

      {/* Liste étapes */}
      {isLoading ? (
        <div className="text-center py-4 text-[var(--text-muted)]">Chargement...</div>
      ) : etapes?.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Aucune étape définie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {etapes?.map(etape => {
            const statutConfig = STATUT_ETAPE_CONFIG[etape.statut] || STATUT_ETAPE_CONFIG.a_faire;
            const StatutIcon = statutConfig.icon;
            const isExpanded = expandedEtape === etape.id;
            
            return (
              <div key={etape.id} className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                <div 
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--bg-tertiary)]/50 ${
                    etape.statut === 'termine' ? 'bg-green-500/5' : etape.statut === 'en_cours' ? 'bg-amber-500/5' : ''
                  }`}
                  onClick={() => setExpandedEtape(isExpanded ? null : etape.id)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    etape.statut === 'termine' ? 'bg-green-500/20' : 
                    etape.statut === 'en_cours' ? 'bg-amber-500/20' : 'bg-[var(--bg-tertiary)]'
                  }`}>
                    <span className="text-sm font-bold">{etape.numero}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{etape.titre}</span>
                      <Badge variant={statutConfig.color} className="flex items-center gap-1">
                        <StatutIcon className="w-3 h-3" />
                        {statutConfig.label}
                      </Badge>
                    </div>
                    {etape.technicien && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {etape.technicien.prenom} {etape.technicien.nom}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{etape.pourcentage}%</div>
                      <div className="w-16">
                        <ProgressBar value={etape.pourcentage} variant={etape.statut === 'termine' ? 'green' : 'amber'} />
                      </div>
                    </div>
                    
                    {/* Actions rapides */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {etape.statut === 'a_faire' && (
                        <button 
                          onClick={() => updateStatutMutation.mutate({ id: etape.id, statut: 'en_cours' })}
                          className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg"
                          title="Démarrer"
                        >
                          <Play className="w-4 h-4 text-amber-400" />
                        </button>
                      )}
                      {etape.statut === 'en_cours' && (
                        <>
                          <button 
                            onClick={() => updateStatutMutation.mutate({ id: etape.id, statut: 'en_pause' })}
                            className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4 text-blue-400" />
                          </button>
                          <button 
                            onClick={() => updateStatutMutation.mutate({ id: etape.id, statut: 'termine' })}
                            className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg"
                            title="Terminer"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                        </>
                      )}
                      {etape.statut === 'en_pause' && (
                        <button 
                          onClick={() => updateStatutMutation.mutate({ id: etape.id, statut: 'en_cours' })}
                          className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg"
                          title="Reprendre"
                        >
                          <Play className="w-4 h-4 text-amber-400" />
                        </button>
                      )}
                    </div>
                    
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </div>
                
                {/* Détails étape */}
                {isExpanded && (
                  <div className="p-3 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border-primary)]">
                    {etape.description && (
                      <p className="text-sm text-[var(--text-tertiary)] mb-3">{etape.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      {etape.duree_prevue_heures && (
                        <span>Durée prévue: {etape.duree_prevue_heures}h</span>
                      )}
                      {etape.duree_reelle_heures && (
                        <span>Durée réelle: {etape.duree_reelle_heures}h</span>
                      )}
                    </div>
                    
                    {/* Slider progression */}
                    {etape.statut === 'en_cours' && (
                      <div className="mt-3">
                        <label className="text-xs text-[var(--text-muted)]">Progression</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="5"
                          value={etape.pourcentage}
                          onChange={e => updateStatutMutation.mutate({ 
                            id: etape.id, 
                            statut: 'en_cours', 
                            pourcentage: parseInt(e.target.value) 
                          })}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
