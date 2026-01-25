/**
 * Module "Mon Catalogue" - Favoris et Dossiers de pièces détachées
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Package, X, Plus, Heart, FolderPlus, Grid3X3, List,
  ChevronRight, Trash2, FolderInput, StickyNote, ExternalLink,
  Loader2, FolderHeart, Star, Zap, Truck, Building2, ShoppingCart,
  Bookmark, Tag, Box, Wrench, AlertCircle, Clock, Settings, Folder,
  Check, Edit2, Copy, Globe
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { usePanierStore } from '@/stores/panierStore';
import {
  getDossiers,
  creerDossier,
  modifierDossier,
  supprimerDossier,
  getFavoris,
  retirerFavori,
  deplacerFavori,
  modifierNotesFavori,
  getStatsFavoris,
  searchPieces,
  ajouterFavori,
  COULEURS_DOSSIERS,
  ICONES_DOSSIERS,
  type Dossier,
  type Favori,
  type StatsFavoris,
  type PieceCatalogue,
} from '@/services/piecesService';
import toast from 'react-hot-toast';

// Map des icônes
const ICON_MAP: Record<string, any> = {
  Folder, Star, Zap, Truck, Building2, ShoppingCart, Bookmark, Tag, Box, Wrench, Heart, AlertCircle, Clock, Settings
};

// ============================================
// COMPOSANTS MODAUX
// ============================================

// Modal nouveau dossier
function NouveauDossierModal({
  onClose,
  onSave,
  initialData,
}: {
  onClose: () => void;
  onSave: (data: Partial<Dossier>) => void;
  initialData?: Partial<Dossier>;
}) {
  const [nom, setNom] = useState(initialData?.nom || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [couleur, setCouleur] = useState(initialData?.couleur || '#3b82f6');
  const [icone, setIcone] = useState(initialData?.icone || 'Folder');

  const handleSubmit = () => {
    if (!nom.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    onSave({ nom: nom.trim(), description, couleur, icone });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderPlus className="w-6 h-6 text-blue-400" />
              {initialData ? 'Modifier le dossier' : 'Nouveau dossier'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Nom du dossier *</label>
              <Input
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex: Pièces SCHINDLER"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description optionnelle..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {COULEURS_DOSSIERS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCouleur(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${couleur === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">Icône</label>
              <div className="flex flex-wrap gap-2">
                {ICONES_DOSSIERS.map(i => {
                  const IconComponent = ICON_MAP[i];
                  return (
                    <button
                      key={i}
                      onClick={() => setIcone(i)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        icone === i
                          ? 'bg-blue-500/20 ring-2 ring-blue-500'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {IconComponent && <IconComponent className="w-5 h-5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                <Check className="w-4 h-4" />
                {initialData ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Fonction pour générer l'URL vers le site fournisseur
function getUrlPieceFournisseur(fournisseur: string | undefined, reference: string): string | null {
  if (!fournisseur || !reference) return null;
  
  const ref = encodeURIComponent(reference);
  
  switch (fournisseur.toUpperCase()) {
    case 'SODIMAS':
      // Sodimas: recherche par référence
      return `https://my.sodimas.com/recherche?q=${ref}`;
    case 'HAUER':
      // Hauer (HF Répartition): recherche par référence
      return `https://www.hfrepartition.com/catalogsearch/result/?q=${ref}`;
    case 'MGTI':
      // MGTI: recherche par référence
      return `https://www.mgti.fr/?s=${ref}&post_type=product`;
    case 'MP':
      // MP Servicenter: recherche par référence
      return `https://www.mp-servicenter.com/portal/repuestos-ascensores-mp?search=${ref}`;
    default:
      // Recherche Google générique
      return `https://www.google.com/search?q=${ref}+${encodeURIComponent(fournisseur)}+ascenseur`;
  }
}

// Modal détail pièce favorite
function DetailFavoriModal({
  favori,
  dossiers,
  onClose,
  onDeplacer,
  onModifierNotes,
  onSupprimer,
}: {
  favori: Favori;
  dossiers: Dossier[];
  onClose: () => void;
  onDeplacer: (dossierId: string | null) => void;
  onModifierNotes: (notes: string) => void;
  onSupprimer: () => void;
}) {
  const [notes, setNotes] = useState(favori.favori_notes || '');
  const [editNotes, setEditNotes] = useState(false);
  
  // URL vers le site fournisseur
  const urlFournisseur = getUrlPieceFournisseur(favori.fournisseur, favori.reference);

  // Couleur du fournisseur
  const getFournisseurColor = (f: string | undefined) => {
    switch (f?.toUpperCase()) {
      case 'HAUER': return 'purple';
      case 'SODIMAS': return 'blue';
      case 'MGTI': return 'green';
      case 'MP': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <Card className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
        <CardBody className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-400" />
              Détail de la pièce
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne gauche - Image */}
            <div className="space-y-4">
              <div className="aspect-square bg-[var(--bg-tertiary)] rounded-xl flex items-center justify-center overflow-hidden relative">
                {favori.photo_url ? (
                  <img
                    src={favori.photo_url}
                    alt={favori.designation}
                    className="max-w-[90%] max-h-[90%] object-contain"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div className="text-center">
                    <Package className="w-16 h-16 text-[var(--text-muted)] mx-auto" />
                    <p className="text-sm text-[var(--text-muted)] mt-2">Pas d'image</p>
                  </div>
                )}
                
                {/* Badge source */}
                <div className="absolute top-2 right-2">
                  <Badge variant={favori.source === 'catalogue' ? 'blue' : 'purple'} className="text-xs">
                    {favori.source === 'catalogue' ? '📚 Catalogue' : '👤 Personnel'}
                  </Badge>
                </div>
              </div>
              
              {/* Bouton principal accès site fournisseur */}
              {urlFournisseur && (
                <a
                  href={urlFournisseur}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="w-5 h-5" />
                  Voir sur {favori.fournisseur}
                </a>
              )}
              
              {/* Liens rapides vers autres fournisseurs */}
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Rechercher ailleurs
                </p>
                <div className="flex flex-wrap gap-2">
                  {['SODIMAS', 'HAUER', 'MGTI', 'MP'].map(f => {
                    const url = getUrlPieceFournisseur(f, favori.reference);
                    const isActive = f === favori.fournisseur?.toUpperCase();
                    return (
                      <a
                        key={f}
                        href={url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                          isActive 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {f}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Colonne droite - Infos */}
            <div className="space-y-4">
              {/* Référence et désignation */}
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Référence</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-2xl font-bold text-blue-400 flex-1">{favori.reference}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(favori.reference);
                      toast.success('Référence copiée !');
                    }}
                    className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                    title="Copier la référence"
                  >
                    <Copy className="w-5 h-5 text-blue-400" />
                  </button>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Désignation</p>
                <p className="text-lg text-[var(--text-primary)]">{favori.designation}</p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getFournisseurColor(favori.fournisseur) as any}>
                  {favori.fournisseur || 'Non spécifié'}
                </Badge>
                <Badge variant="gray">
                  {favori.source === 'catalogue' ? 'Catalogue officiel' : 'Ajout manuel'}
                </Badge>
                {favori.marque_compatible && (
                  <Badge variant="cyan">{favori.marque_compatible}</Badge>
                )}
                {favori.categorie_code && (
                  <Badge variant="amber">{favori.categorie_code}</Badge>
                )}
              </div>

              {/* Prix */}
              {favori.prix_ht && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-xs text-green-400 uppercase tracking-wide mb-1">Prix indicatif HT</p>
                  <p className="text-2xl font-bold text-green-400">{favori.prix_ht.toFixed(2)} €</p>
                </div>
              )}

              {/* Description si disponible */}
              {favori.description && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-[var(--text-secondary)]">{favori.description}</p>
                </div>
              )}

              {/* Informations techniques */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <p className="text-xs text-[var(--text-muted)]">Fournisseur</p>
                  <p className="font-semibold">{favori.fournisseur || '-'}</p>
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <p className="text-xs text-[var(--text-muted)]">Marque compatible</p>
                  <p className="font-semibold">{favori.marque_compatible || '-'}</p>
                </div>
              </div>

              {/* Dossier */}
              <div>
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 block">
                  Dossier de classement
                </label>
                <Select
                  value={favori.dossier_id || ''}
                  onChange={e => onDeplacer(e.target.value || null)}
                >
                  <option value="">Non classé</option>
                  {dossiers.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </Select>
              </div>

              {/* Notes personnelles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                    Notes personnelles
                  </label>
                  {!editNotes && (
                    <button
                      onClick={() => setEditNotes(true)}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Modifier
                    </button>
                  )}
                </div>
                {editNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Ajouter une note (délai, stock habituel, remarques...)"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { setNotes(favori.favori_notes || ''); setEditNotes(false); }}>
                        Annuler
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => { onModifierNotes(notes); setEditNotes(false); }}>
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm text-amber-300 italic">
                      {favori.favori_notes || 'Aucune note - Cliquez sur Modifier pour ajouter'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-between gap-3 mt-6 pt-4 border-t border-[var(--border-primary)]">
            <Button variant="danger" onClick={onSupprimer}>
              <Trash2 className="w-4 h-4" />
              Retirer des favoris
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30"
                onClick={() => {
                  usePanierStore.getState().addItem({
                    reference: favori.reference,
                    designation: favori.designation,
                    quantite: 1,
                    fournisseur: favori.fournisseur,
                  });
                  toast.success(`${favori.reference} ajouté au panier`);
                }}
              >
                <ShoppingCart className="w-4 h-4" />
                Ajouter au panier
              </Button>
              {urlFournisseur && (
                <a
                  href={urlFournisseur}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary">
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir sur {favori.fournisseur}
                  </Button>
                </a>
              )}
              <Button variant="primary" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal recherche catalogue
function RechercheCatalogueModal({
  onClose,
  onAjouter,
}: {
  onClose: () => void;
  onAjouter: (piece: PieceCatalogue, dossierId?: string) => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [fournisseur, setFournisseur] = useState('');

  const { data: resultats, isLoading } = useQuery({
    queryKey: ['recherche-catalogue-modal', recherche, fournisseur],
    queryFn: () => searchPieces(recherche, { fournisseur: fournisseur || undefined, limit: 50 }),
    enabled: recherche.length >= 2,
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-6 h-6 text-purple-400" />
              Rechercher dans le catalogue
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <Input
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Rechercher par référence, désignation..."
                className="pl-11"
                autoFocus
              />
            </div>
            <Select value={fournisseur} onChange={e => setFournisseur(e.target.value)} className="w-40">
              <option value="">Tous</option>
              <option value="SODIMAS">Sodimas</option>
              <option value="HAUER">Hauer</option>
              <option value="MGTI">MGTI</option>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : recherche.length < 2 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Saisissez au moins 2 caractères pour rechercher</p>
            </div>
          ) : resultats && resultats.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resultats.map(piece => (
                <Card key={piece.id} className="group cursor-pointer hover:border-blue-500/50">
                  <CardBody className="p-3">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {piece.photo_url ? (
                          <img
                            src={piece.photo_url}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                            onError={e => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <Package className="w-6 h-6 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-bold text-blue-400 truncate">{piece.reference}</p>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{piece.designation}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="gray" className="text-xs">{piece.fournisseur_code}</Badge>
                          <button
                            onClick={() => onAjouter(piece)}
                            className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune pièce trouvée</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function MonCatalogue() {
  const queryClient = useQueryClient();
  
  // États
  const [recherche, setRecherche] = useState('');
  const [dossierActif, setDossierActif] = useState<string | null>(null); // null = tous
  const [fournisseurFiltre, setFournisseurFiltre] = useState('');
  const [vueGrille, setVueGrille] = useState(true);
  const [showNewDossier, setShowNewDossier] = useState(false);
  const [dossierAEditer, setDossierAEditer] = useState<Dossier | null>(null);
  const [favoriDetail, setFavoriDetail] = useState<Favori | null>(null);
  const [showRechercheCatalogue, setShowRechercheCatalogue] = useState(false);

  // Queries
  const { data: dossiers = [], isLoading: loadingDossiers } = useQuery({
    queryKey: ['pieces-dossiers'],
    queryFn: getDossiers,
  });

  const { data: favoris = [], isLoading: loadingFavoris } = useQuery({
    queryKey: ['pieces-favoris', dossierActif, fournisseurFiltre, recherche],
    queryFn: () => getFavoris({
      dossierId: dossierActif || undefined,
      fournisseur: fournisseurFiltre || undefined,
      recherche: recherche || undefined,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['pieces-stats-favoris'],
    queryFn: getStatsFavoris,
  });

  // Mutations
  const creerDossierMutation = useMutation({
    mutationFn: creerDossier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-dossiers'] });
      toast.success('Dossier créé');
      setShowNewDossier(false);
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const modifierDossierMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Dossier> }) => modifierDossier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-dossiers'] });
      toast.success('Dossier modifié');
      setDossierAEditer(null);
    },
  });

  const supprimerDossierMutation = useMutation({
    mutationFn: supprimerDossier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['pieces-favoris'] });
      toast.success('Dossier supprimé');
      if (dossierActif) setDossierActif(null);
    },
  });

  const deplacerFavoriMutation = useMutation({
    mutationFn: ({ id, dossierId }: { id: string; dossierId: string | null }) => deplacerFavori(id, dossierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-favoris'] });
      queryClient.invalidateQueries({ queryKey: ['pieces-stats-favoris'] });
    },
  });

  const modifierNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => modifierNotesFavori(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-favoris'] });
      toast.success('Notes enregistrées');
    },
  });

  const retirerFavoriMutation = useMutation({
    mutationFn: retirerFavori,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-favoris'] });
      queryClient.invalidateQueries({ queryKey: ['pieces-stats-favoris'] });
      toast.success('Retiré des favoris');
      setFavoriDetail(null);
    },
  });

  const ajouterFavoriMutation = useMutation({
    mutationFn: (piece: PieceCatalogue) => ajouterFavori(piece.id, undefined, dossierActif || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-favoris'] });
      queryClient.invalidateQueries({ queryKey: ['pieces-stats-favoris'] });
      toast.success('Ajouté aux favoris');
    },
    onError: () => toast.error('Déjà dans les favoris'),
  });

  // Calcul des counts par dossier
  const dossiersAvecCounts = useMemo(() => {
    return dossiers.map(d => ({
      ...d,
      count: stats?.par_dossier?.[d.nom] || 0,
    }));
  }, [dossiers, stats]);

  // Fournisseurs uniques
  const fournisseursUniques = useMemo(() => {
    return [...new Set(favoris.map(f => f.fournisseur).filter(Boolean))];
  }, [favoris]);

  // Info dossier actif
  const dossierInfo = dossierActif ? dossiers.find(d => d.id === dossierActif) : null;

  return (
    <div className="h-full flex gap-6">
      {/* Sidebar gauche - Dossiers */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
        {/* Card dossiers */}
        <Card>
          <div className="p-3 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--bg-tertiary)]">
            <span className="font-semibold flex items-center gap-2">
              <FolderHeart className="w-5 h-5 text-pink-400" />
              Mes Dossiers
            </span>
            <Button variant="ghost" size="icon" onClick={() => setShowNewDossier(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-2">
            {/* Tous les favoris */}
            <button
              onClick={() => setDossierActif(null)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                dossierActif === null
                  ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/30'
                  : 'hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Star className="w-4 h-4 text-blue-400" />
              </div>
              <span className="flex-1 text-left text-sm">Tous les favoris</span>
              <Badge variant="blue">{stats?.total_favoris || 0}</Badge>
            </button>

            {/* Dossiers */}
            {loadingDossiers ? (
              <div className="p-4 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" />
              </div>
            ) : (
              dossiersAvecCounts.map(d => {
                const IconComponent = ICON_MAP[d.icone] || Folder;
                return (
                  <div
                    key={d.id}
                    className={`group flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                      dossierActif === d.id
                        ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/30'
                        : 'hover:bg-[var(--bg-tertiary)]'
                    }`}
                    onClick={() => setDossierActif(d.id)}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${d.couleur}20` }}
                    >
                      <IconComponent className="w-4 h-4" style={{ color: d.couleur }} />
                    </div>
                    <span className="flex-1 text-sm truncate">{d.nom}</span>
                    <span className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] rounded-full text-[var(--text-muted)]">
                      {d.count}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('Supprimer ce dossier ? Les pièces seront déplacées vers "Non classé".')) {
                          supprimerDossierMutation.mutate(d.id);
                        }
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Stats */}
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Statistiques</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[var(--bg-tertiary)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{stats?.total_favoris || 0}</p>
                <p className="text-xs text-[var(--text-muted)]">Favoris</p>
              </div>
              <div className="bg-[var(--bg-tertiary)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{stats?.total_dossiers || 0}</p>
                <p className="text-xs text-[var(--text-muted)]">Dossiers</p>
              </div>
              <div className="bg-[var(--bg-tertiary)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{stats?.par_fournisseur?.['HAUER'] || 0}</p>
                <p className="text-xs text-[var(--text-muted)]">Hauer</p>
              </div>
              <div className="bg-[var(--bg-tertiary)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{stats?.par_fournisseur?.['SODIMAS'] || 0}</p>
                <p className="text-xs text-[var(--text-muted)]">Sodimas</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Bouton recherche catalogue */}
        <Button
          variant="primary"
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
          onClick={() => setShowRechercheCatalogue(true)}
        >
          <Search className="w-5 h-5" />
          Rechercher catalogue
        </Button>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Barre de recherche et filtres */}
        <Card>
          <CardBody className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <Input
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Rechercher par référence, désignation, notes..."
                className="pl-11"
              />
              {recherche && (
                <button
                  onClick={() => setRecherche('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select
              value={fournisseurFiltre}
              onChange={e => setFournisseurFiltre(e.target.value)}
              className="w-40"
            >
              <option value="">Tous fournisseurs</option>
              {fournisseursUniques.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>

            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setVueGrille(true)}
                className={`p-2 rounded-lg transition-colors ${vueGrille ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVueGrille(false)}
                className={`p-2 rounded-lg transition-colors ${!vueGrille ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Breadcrumb */}
        {dossierActif && dossierInfo && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <button onClick={() => setDossierActif(null)} className="hover:text-[var(--text-primary)]">
              Tous les favoris
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="flex items-center gap-2 font-semibold" style={{ color: dossierInfo.couleur }}>
              {ICON_MAP[dossierInfo.icone] && (
                <span>{React.createElement(ICON_MAP[dossierInfo.icone], { className: 'w-4 h-4' })}</span>
              )}
              {dossierInfo.nom}
            </span>
            <span>({favoris.length} pièces)</span>
          </div>
        )}

        {/* Contenu - Grille ou Liste */}
        <div className="flex-1 overflow-y-auto">
          {loadingFavoris ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : favoris.length > 0 ? (
            vueGrille ? (
              // Vue grille
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {favoris.map(favori => {
                  const dossier = dossiers.find(d => d.id === favori.dossier_id);
                  const DossierIcon = dossier ? ICON_MAP[dossier.icone] : null;
                  
                  return (
                    <Card
                      key={favori.favori_id}
                      className="group cursor-pointer hover:border-blue-500/30 transition-all"
                      onClick={() => setFavoriDetail(favori)}
                    >
                      <div className="aspect-square bg-[var(--bg-tertiary)] relative flex items-center justify-center overflow-hidden">
                        {favori.photo_url ? (
                          <img
                            src={favori.photo_url}
                            alt={favori.designation}
                            className="max-w-[90%] max-h-[90%] object-contain"
                            onError={e => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <Package className="w-12 h-12 text-[var(--text-muted)]" />
                        )}

                        {/* Badge dossier */}
                        {dossier && (
                          <div
                            className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                            style={{ backgroundColor: dossier.couleur, color: 'white' }}
                          >
                            {DossierIcon && <DossierIcon className="w-3 h-3" />}
                            {dossier.nom}
                          </div>
                        )}

                        {/* Bouton favori */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm('Retirer des favoris ?')) {
                              retirerFavoriMutation.mutate(favori.favori_id);
                            }
                          }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Heart className="w-4 h-4 text-white fill-white" />
                        </button>

                        {/* Actions au survol */}
                        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Lien vers le site fournisseur */}
                          {favori.fournisseur && (
                            <a
                              href={getUrlPieceFournisseur(favori.fournisseur, favori.reference) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="w-8 h-8 bg-black/70 rounded-lg flex items-center justify-center hover:bg-green-500 transition-colors"
                              title={`Voir sur ${favori.fournisseur}`}
                            >
                              <ExternalLink className="w-4 h-4 text-white" />
                            </a>
                          )}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setFavoriDetail(favori);
                            }}
                            className="w-8 h-8 bg-black/70 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-colors"
                            title="Détails"
                          >
                            <FolderInput className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>

                      <CardBody className="p-3">
                        <p className="font-mono text-sm font-bold text-blue-400 truncate">{favori.reference}</p>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1">{favori.designation}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="gray">{favori.fournisseur}</Badge>
                          {favori.favori_notes && (
                            <span className="text-amber-400 flex items-center gap-1 text-xs">
                              <StickyNote className="w-3 h-3" />
                              Note
                            </span>
                          )}
                        </div>
                        {/* Boutons actions */}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              usePanierStore.getState().addItem({
                                reference: favori.reference,
                                designation: favori.designation,
                                quantite: 1,
                                fournisseur: favori.fournisseur,
                              });
                              toast.success(`${favori.reference} ajouté au panier`);
                            }}
                            className="flex-1 py-2 px-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            Panier
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFavoriDetail(favori);
                            }}
                            className="flex-1 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Détails
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // Vue liste
              <div className="space-y-2">
                {favoris.map(favori => {
                  const dossier = dossiers.find(d => d.id === favori.dossier_id);
                  
                  return (
                    <Card
                      key={favori.favori_id}
                      className="cursor-pointer hover:border-blue-500/30 transition-all"
                      onClick={() => setFavoriDetail(favori)}
                    >
                      <CardBody className="p-3 flex items-center gap-4">
                        <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {favori.photo_url ? (
                            <img
                              src={favori.photo_url}
                              alt=""
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="w-28 font-mono font-bold text-blue-400">{favori.reference}</div>
                        <div className="flex-1 text-sm text-[var(--text-secondary)] truncate">{favori.designation}</div>
                        <Badge variant="gray">{favori.fournisseur}</Badge>
                        {dossier && (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: dossier.couleur }}
                            />
                            {dossier.nom}
                          </div>
                        )}
                        {favori.favori_notes && (
                          <span className="text-amber-400 text-xs truncate max-w-[100px]">{favori.favori_notes}</span>
                        )}
                        {/* Bouton panier */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            usePanierStore.getState().addItem({
                              reference: favori.reference,
                              designation: favori.designation,
                              quantite: 1,
                              fournisseur: favori.fournisseur,
                            });
                            toast.success(`${favori.reference} ajouté au panier`);
                          }}
                          className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Panier
                        </button>
                        {/* Bouton voir détails */}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setFavoriDetail(favori);
                          }}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Package className="w-3 h-3" />
                          Détails
                        </button>
                        {/* Lien vers le site fournisseur */}
                        {favori.fournisseur && (
                          <a
                            href={getUrlPieceFournisseur(favori.fournisseur, favori.reference) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title={`Voir sur ${favori.fournisseur}`}
                          >
                            <ExternalLink className="w-4 h-4 text-blue-400" />
                          </a>
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm('Retirer des favoris ?')) {
                              retirerFavoriMutation.mutate(favori.favori_id);
                            }
                          }}
                          className="p-2 hover:bg-red-500/20 rounded-lg"
                        >
                          <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                        </button>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            // État vide
            <Card>
              <CardBody className="py-16 text-center">
                <Heart className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
                <h3 className="text-lg font-semibold mb-2">Aucun favori</h3>
                <p className="text-[var(--text-muted)] mb-4">
                  {recherche
                    ? "Aucun résultat pour cette recherche"
                    : "Ajoutez des pièces à vos favoris depuis le catalogue"}
                </p>
                <Button
                  variant="primary"
                  className="bg-gradient-to-r from-purple-500 to-indigo-500"
                  onClick={() => setShowRechercheCatalogue(true)}
                >
                  <Search className="w-5 h-5" />
                  Rechercher des pièces
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Modaux */}
      {showNewDossier && (
        <NouveauDossierModal
          onClose={() => setShowNewDossier(false)}
          onSave={data => creerDossierMutation.mutate(data)}
        />
      )}

      {dossierAEditer && (
        <NouveauDossierModal
          initialData={dossierAEditer}
          onClose={() => setDossierAEditer(null)}
          onSave={data => modifierDossierMutation.mutate({ id: dossierAEditer.id, data })}
        />
      )}

      {favoriDetail && (
        <DetailFavoriModal
          favori={favoriDetail}
          dossiers={dossiers}
          onClose={() => setFavoriDetail(null)}
          onDeplacer={dossierId => {
            deplacerFavoriMutation.mutate({ id: favoriDetail.favori_id, dossierId });
            setFavoriDetail({ ...favoriDetail, dossier_id: dossierId || undefined });
          }}
          onModifierNotes={notes => modifierNotesMutation.mutate({ id: favoriDetail.favori_id, notes })}
          onSupprimer={() => retirerFavoriMutation.mutate(favoriDetail.favori_id)}
        />
      )}

      {showRechercheCatalogue && (
        <RechercheCatalogueModal
          onClose={() => setShowRechercheCatalogue(false)}
          onAjouter={piece => ajouterFavoriMutation.mutate(piece)}
        />
      )}
    </div>
  );
}

export default MonCatalogue;
