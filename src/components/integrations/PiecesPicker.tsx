// src/components/integrations/PiecesPicker.tsx
// Sélecteur de pièces détachées avec recherche catalogue
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package, Search, X, ShoppingCart, Plus, ExternalLink,
  Loader2, Check, Filter, Building2, Tag
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { usePanierStore } from '@/stores/panierStore';
import toast from 'react-hot-toast';

interface PieceCatalogue {
  id: string;
  reference: string;
  designation: string;
  description?: string;
  fournisseur_code?: string;
  marque_compatible?: string;
  categorie_code?: string;
  prix_ht?: number;
  photo_url?: string;
}

interface PiecesPickerProps {
  onClose: () => void;
  onSelect?: (pieces: Array<{ reference: string; designation: string; quantite: number; prix?: number; fournisseur?: string }>) => void;
  mode?: 'panier' | 'selection'; // panier = ajoute directement, selection = retourne les pièces
  multiSelect?: boolean;
  title?: string;
}

// URL fournisseur
function getUrlPieceFournisseur(fournisseur: string | undefined, reference: string): string | null {
  if (!fournisseur || !reference) return null;
  const ref = encodeURIComponent(reference);
  switch (fournisseur.toUpperCase()) {
    case 'SODIMAS': return `https://my.sodimas.com/fr/recherche?search=${ref}`;
    case 'HAUER': return `https://www.hfrepartition.com/catalogsearch/result/?q=${ref}`;
    case 'MGTI': return `https://www.mgti.fr/?s=${ref}&post_type=product`;
    case 'MP': return `https://www.mp-servicenter.com/portal/repuestos-ascensores-mp?search=${ref}`;
    default: return null;
  }
}

export function PiecesPicker({
  onClose,
  onSelect,
  mode = 'panier',
  multiSelect = true,
  title = 'Ajouter des pièces',
}: PiecesPickerProps) {
  const { addItem } = usePanierStore();
  const [search, setSearch] = useState('');
  const [filterFournisseur, setFilterFournisseur] = useState('');
  const [selectedPieces, setSelectedPieces] = useState<Map<string, number>>(new Map());

  // Recherche dans le catalogue
  const { data: pieces, isLoading } = useQuery({
    queryKey: ['pieces-picker', search, filterFournisseur],
    queryFn: async () => {
      let query = supabase
        .from('pieces_catalogue')
        .select('*')
        .limit(50);

      if (search.length >= 2) {
        query = query.or(`reference.ilike.%${search}%,designation.ilike.%${search}%`);
      }
      if (filterFournisseur) {
        query = query.eq('fournisseur_code', filterFournisseur);
      }

      const { data, error } = await query.order('reference');
      if (error) throw error;
      return data as PieceCatalogue[];
    },
    enabled: search.length >= 2 || filterFournisseur !== '',
  });

  // Pièces personnelles (mon_catalogue)
  const { data: piecesPerso } = useQuery({
    queryKey: ['mon-catalogue-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mon_catalogue')
        .select('*')
        .order('designation');
      if (error) throw error;
      return data;
    },
  });

  // Toggle sélection
  const toggleSelection = (piece: PieceCatalogue, quantite: number = 1) => {
    if (!multiSelect) {
      setSelectedPieces(new Map([[piece.id, quantite]]));
      return;
    }
    
    const newSelection = new Map(selectedPieces);
    if (newSelection.has(piece.id)) {
      newSelection.delete(piece.id);
    } else {
      newSelection.set(piece.id, quantite);
    }
    setSelectedPieces(newSelection);
  };

  // Mettre à jour quantité
  const updateQuantite = (pieceId: string, quantite: number) => {
    if (quantite <= 0) {
      const newSelection = new Map(selectedPieces);
      newSelection.delete(pieceId);
      setSelectedPieces(newSelection);
    } else {
      setSelectedPieces(new Map(selectedPieces).set(pieceId, quantite));
    }
  };

  // Ajouter au panier directement
  const ajouterAuPanier = (piece: PieceCatalogue, quantite: number = 1) => {
    addItem({
      reference: piece.reference,
      designation: piece.designation,
      quantite,
      fournisseur: piece.fournisseur_code,
    });
    toast.success(`${piece.reference} ajouté au panier`);
  };

  // Valider la sélection
  const handleValidate = () => {
    const allPieces = [...(pieces || []), ...(piecesPerso || [])];
    const selected = allPieces
      .filter(p => selectedPieces.has(p.id))
      .map(p => ({
        reference: p.reference,
        designation: p.designation,
        quantite: selectedPieces.get(p.id) || 1,
        prix: p.prix_ht,
        fournisseur: p.fournisseur_code,
      }));

    if (mode === 'panier') {
      selected.forEach(p => {
        addItem({
          reference: p.reference,
          designation: p.designation,
          quantite: p.quantite,
          fournisseur: p.fournisseur,
        });
      });
      toast.success(`${selected.length} pièce(s) ajoutée(s) au panier`);
      onClose();
    } else if (onSelect) {
      onSelect(selected);
      onClose();
    }
  };

  // Couleur badge fournisseur
  const getFournisseurColor = (f: string | undefined) => {
    switch (f?.toUpperCase()) {
      case 'HAUER': return 'purple';
      case 'SODIMAS': return 'blue';
      case 'MGTI': return 'green';
      case 'MP': return 'orange';
      default: return 'gray';
    }
  };

  const totalSelected = selectedPieces.size;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <CardBody className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Recherchez dans le catalogue de pièces détachées
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barre de recherche et filtres */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par référence ou désignation..."
                className="pl-10"
              />
            </div>
            <Select
              value={filterFournisseur}
              onChange={e => setFilterFournisseur(e.target.value)}
              className="w-40"
            >
              <option value="">Tous fournisseurs</option>
              <option value="HAUER">Hauer</option>
              <option value="SODIMAS">Sodimas</option>
              <option value="MGTI">MGTI</option>
              <option value="MP">MP Servicenter</option>
            </Select>
          </div>

          {/* Liste des pièces */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            )}

            {/* Mon catalogue (toujours visible) */}
            {piecesPerso && piecesPerso.length > 0 && search.length < 2 && !filterFournisseur && (
              <div className="mb-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Mon catalogue
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {piecesPerso.slice(0, 6).map(piece => (
                    <PieceCard
                      key={piece.id}
                      piece={piece}
                      selected={selectedPieces.has(piece.id)}
                      quantite={selectedPieces.get(piece.id) || 1}
                      onToggle={() => toggleSelection(piece)}
                      onQuantiteChange={(q) => updateQuantite(piece.id, q)}
                      onAddDirect={() => ajouterAuPanier(piece)}
                      showAddButton={mode === 'panier'}
                      getFournisseurColor={getFournisseurColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Résultats de recherche */}
            {search.length >= 2 && pieces && pieces.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  {pieces.length} résultat(s)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {pieces.map(piece => (
                    <PieceCard
                      key={piece.id}
                      piece={piece}
                      selected={selectedPieces.has(piece.id)}
                      quantite={selectedPieces.get(piece.id) || 1}
                      onToggle={() => toggleSelection(piece)}
                      onQuantiteChange={(q) => updateQuantite(piece.id, q)}
                      onAddDirect={() => ajouterAuPanier(piece)}
                      showAddButton={mode === 'panier'}
                      getFournisseurColor={getFournisseurColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {search.length >= 2 && pieces && pieces.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Aucune pièce trouvée</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Essayez avec d'autres mots-clés
                </p>
              </div>
            )}

            {search.length < 2 && !filterFournisseur && (!piecesPerso || piecesPerso.length === 0) && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)]">Recherchez une pièce</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Entrez au moins 2 caractères pour rechercher
                </p>
              </div>
            )}
          </div>

          {/* Footer avec sélection */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--border-primary)]">
            <div className="text-sm text-[var(--text-muted)]">
              {totalSelected > 0 ? (
                <span className="text-purple-400 font-medium">
                  {totalSelected} pièce(s) sélectionnée(s)
                </span>
              ) : (
                'Aucune sélection'
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              {multiSelect && totalSelected > 0 && (
                <Button variant="primary" onClick={handleValidate}>
                  <ShoppingCart className="w-4 h-4" />
                  {mode === 'panier' ? 'Ajouter au panier' : 'Valider'}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Carte de pièce
function PieceCard({
  piece,
  selected,
  quantite,
  onToggle,
  onQuantiteChange,
  onAddDirect,
  showAddButton,
  getFournisseurColor,
}: {
  piece: PieceCatalogue;
  selected: boolean;
  quantite: number;
  onToggle: () => void;
  onQuantiteChange: (q: number) => void;
  onAddDirect: () => void;
  showAddButton: boolean;
  getFournisseurColor: (f: string | undefined) => string;
}) {
  const urlFournisseur = getUrlPieceFournisseur(piece.fournisseur_code, piece.reference);

  return (
    <div
      className={`p-3 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'border-purple-500 bg-purple-500/10'
          : 'border-[var(--border-primary)] hover:border-purple-500/50 bg-[var(--bg-tertiary)]'
      }`}
      onClick={onToggle}
    >
      <div className="flex gap-3">
        {/* Image ou placeholder */}
        {piece.photo_url ? (
          <img
            src={piece.photo_url}
            alt={piece.designation}
            className="w-14 h-14 object-cover rounded-lg bg-[var(--bg-elevated)]"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
            <Package className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
        )}

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-purple-400">{piece.reference}</p>
            {selected && <Check className="w-4 h-4 text-green-400" />}
          </div>
          <p className="text-sm font-medium truncate">{piece.designation}</p>
          <div className="flex items-center gap-2 mt-1">
            {piece.fournisseur_code && (
              <Badge variant={getFournisseurColor(piece.fournisseur_code) as any} className="text-[10px]">
                {piece.fournisseur_code}
              </Badge>
            )}
            {piece.prix_ht && (
              <span className="text-xs text-green-400 font-medium">{piece.prix_ht.toFixed(2)} €</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1" onClick={e => e.stopPropagation()}>
          {selected ? (
            <div className="flex items-center gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
              <button
                onClick={() => onQuantiteChange(quantite - 1)}
                className="w-6 h-6 flex items-center justify-center hover:bg-[var(--bg-tertiary)] rounded"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-medium">{quantite}</span>
              <button
                onClick={() => onQuantiteChange(quantite + 1)}
                className="w-6 h-6 flex items-center justify-center hover:bg-[var(--bg-tertiary)] rounded"
              >
                +
              </button>
            </div>
          ) : showAddButton ? (
            <button
              onClick={(e) => { e.stopPropagation(); onAddDirect(); }}
              className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 transition-colors"
              title="Ajouter au panier"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : null}

          {urlFournisseur && (
            <a
              href={urlFournisseur}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-muted)] hover:text-blue-400 transition-colors"
              title={`Voir sur ${piece.fournisseur_code}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Export du bouton pour ajouter rapidement au panier
export function AddToPanierButton({
  piece,
  size = 'md',
  showLabel = false,
}: {
  piece: { reference: string; designation: string; fournisseur_code?: string; prix_ht?: number };
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const { addItem, openPanier } = usePanierStore();

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      reference: piece.reference,
      designation: piece.designation,
      quantite: 1,
      fournisseur: piece.fournisseur_code,
    });
    toast.success(`${piece.reference} ajouté au panier`);
  };

  return (
    <button
      onClick={handleAdd}
      className={`flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium rounded-lg transition-colors ${
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
      }`}
      title="Ajouter au panier"
    >
      <ShoppingCart className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {showLabel && <span>Panier</span>}
    </button>
  );
}
