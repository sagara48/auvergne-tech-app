import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, Camera, Upload, ExternalLink, Package, Cpu, DoorOpen, 
  Cog, Shield, Cable, Box, CircleDot, History, Plus, X, Loader2,
  Sparkles, Eye, Bookmark, BookmarkCheck, ChevronRight, Image,
  Building2, Filter, RefreshCw, Trash2, Download, Copy, Check,
  AlertCircle, Info, Tag, Clock, Wrench, FileText, Heart
} from 'lucide-react';
import { MonCatalogue } from './MonCatalogue';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import {
  getFournisseurs,
  getCategoriesPieces,
  searchPieces,
  analyserPhotoPiece,
  sauvegarderRecherchePhoto,
  getHistoriqueRecherchesPhoto,
  getPiecesPersonnelles,
  ajouterPiecePersonnelle,
  supprimerPiecePersonnelle,
  getUrlRechercheFournisseur,
  uploadPhotoPiece,
  fileToBase64,
  MARQUES_ASCENSEURS,
  TYPES_PIECES,
  type AnalysePhotoResult,
  type PieceCatalogue,
  type PiecePersonnelle,
  type Fournisseur,
} from '@/services/piecesService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Icônes par catégorie
const CATEGORY_ICONS: Record<string, any> = {
  'MACHINERIE': Cog,
  'PORTES_PALIERES': DoorOpen,
  'PORTES_CABINE': DoorOpen,
  'CABINE': Box,
  'BOUTONS_SIGNAL': CircleDot,
  'ELECTRONIQUE': Cpu,
  'SECURITE': Shield,
  'CABLAGE': Cable,
  'DIVERS': Package,
};

// Fonction pour générer l'URL vers le site fournisseur
function getUrlPieceFournisseur(fournisseur: string | undefined, reference: string): string | null {
  if (!fournisseur || !reference) return null;
  
  const ref = encodeURIComponent(reference);
  
  switch (fournisseur.toUpperCase()) {
    case 'SODIMAS':
      return `https://my.sodimas.com/fr/recherche?search=${ref}`;
    case 'HAUER':
      return `https://www.hfrepartition.com/catalogsearch/result/?q=${ref}`;
    case 'MGTI':
      return `https://www.mgti.fr/?s=${ref}&post_type=product`;
    case 'MP':
      return `https://www.mp-servicenter.com/portal/repuestos-ascensores-mp?search=${ref}`;
    default:
      return `https://www.google.com/search?q=${ref}+${encodeURIComponent(fournisseur)}+ascenseur`;
  }
}

// Modal détail pièce catalogue
function DetailPieceModal({
  piece,
  onClose,
}: {
  piece: PieceCatalogue;
  onClose: () => void;
}) {
  const urlFournisseur = getUrlPieceFournisseur(piece.fournisseur_code, piece.reference);

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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <Card className="w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
        <CardBody>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-purple-400" />
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
                {piece.photo_url ? (
                  <img
                    src={piece.photo_url}
                    alt={piece.designation}
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
                  <Badge variant="blue" className="text-xs">
                    📚 Catalogue
                  </Badge>
                </div>
              </div>
              
              {/* Bouton principal accès site fournisseur */}
              {urlFournisseur && (
                <a
                  href={urlFournisseur}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="w-5 h-5" />
                  Voir sur {piece.fournisseur_code}
                </a>
              )}
              
              {/* Liens rapides vers autres fournisseurs */}
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Rechercher ailleurs
                </p>
                <div className="flex flex-wrap gap-2">
                  {['SODIMAS', 'HAUER', 'MGTI', 'MP'].map(f => {
                    const url = getUrlPieceFournisseur(f, piece.reference);
                    const isActive = f === piece.fournisseur_code?.toUpperCase();
                    return (
                      <a
                        key={f}
                        href={url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                          isActive 
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
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
                  <p className="font-mono text-2xl font-bold text-purple-400 flex-1">{piece.reference}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(piece.reference);
                      toast.success('Référence copiée !');
                    }}
                    className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
                    title="Copier la référence"
                  >
                    <Copy className="w-5 h-5 text-purple-400" />
                  </button>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Désignation</p>
                <p className="text-lg text-[var(--text-primary)]">{piece.designation}</p>
              </div>

              {/* Description si disponible */}
              {piece.description && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-[var(--text-secondary)]">{piece.description}</p>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getFournisseurColor(piece.fournisseur_code) as any}>
                  {piece.fournisseur_code || 'Non spécifié'}
                </Badge>
                {piece.marque_compatible && (
                  <Badge variant="cyan">{piece.marque_compatible}</Badge>
                )}
                {piece.categorie_code && (
                  <Badge variant="amber">{piece.categorie_code.replace(/_/g, ' ')}</Badge>
                )}
              </div>

              {/* Prix */}
              {piece.prix_ht && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-xs text-green-400 uppercase tracking-wide mb-1">Prix indicatif HT</p>
                  <p className="text-2xl font-bold text-green-400">{piece.prix_ht.toFixed(2)} €</p>
                </div>
              )}

              {/* Informations techniques */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <p className="text-xs text-[var(--text-muted)]">Fournisseur</p>
                  <p className="font-semibold">{piece.fournisseur_code || '-'}</p>
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <p className="text-xs text-[var(--text-muted)]">Marque compatible</p>
                  <p className="font-semibold">{piece.marque_compatible || '-'}</p>
                </div>
              </div>

              {/* Caractéristiques techniques si disponibles */}
              {piece.caracteristiques && Object.keys(piece.caracteristiques).length > 0 && (
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Caractéristiques</p>
                  <div className="space-y-1">
                    {Object.entries(piece.caracteristiques).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{key}</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-primary)]">
            {urlFournisseur && (
              <a
                href={urlFournisseur}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">
                  <ExternalLink className="w-4 h-4" />
                  Ouvrir sur {piece.fournisseur_code}
                </Button>
              </a>
            )}
            <Button variant="primary" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal d'analyse photo
function AnalysePhotoModal({
  onClose,
  onResultat,
  codeAscenseur,
  marqueAscenseur,
}: {
  onClose: () => void;
  onResultat: (result: AnalysePhotoResult, photoUrl?: string) => void;
  codeAscenseur?: string;
  marqueAscenseur?: string;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [marque, setMarque] = useState(marqueAscenseur || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyser = async () => {
    if (!photo) {
      toast.error('Sélectionnez une photo');
      return;
    }

    setIsAnalysing(true);
    try {
      // Convertir en base64
      const base64 = await fileToBase64(photo);
      
      // Analyser avec Claude Vision
      const result = await analyserPhotoPiece(base64, {
        marqueAscenseur: marque || undefined,
        codeAscenseur,
      });

      // Upload la photo
      let photoUrl: string | undefined;
      try {
        photoUrl = await uploadPhotoPiece(photo);
      } catch (e) {
        console.warn('Erreur upload photo:', e);
      }

      // Sauvegarder dans l'historique
      if (result.confiance > 0) {
        await sauvegarderRecherchePhoto(photoUrl || null, result, codeAscenseur);
      }

      onResultat(result, photoUrl);
      toast.success('Analyse terminée !');
    } catch (error) {
      console.error('Erreur analyse:', error);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Camera className="w-6 h-6 text-purple-400" />
              Identifier une pièce par photo
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Zone photo */}
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Pièce à identifier" 
                  className="w-full h-64 object-contain bg-[var(--bg-tertiary)] rounded-xl"
                />
                <button
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-lg hover:bg-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Prendre une photo */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                >
                  <Camera className="w-10 h-10 text-purple-400" />
                  <span className="text-sm font-medium">Prendre une photo</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </button>

                {/* Importer une image */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                >
                  <Upload className="w-10 h-10 text-blue-400" />
                  <span className="text-sm font-medium">Importer une image</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </button>
              </div>
            )}

            {/* Contexte optionnel */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">
                Marque de l'ascenseur (optionnel)
              </label>
              <Select value={marque} onChange={e => setMarque(e.target.value)}>
                <option value="">Non spécifié</option>
                {MARQUES_ASCENSEURS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>

            {codeAscenseur && (
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm">Ascenseur : <strong>{codeAscenseur}</strong></span>
              </div>
            )}

            {/* Bouton analyser */}
            <Button
              variant="primary"
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
              onClick={handleAnalyser}
              disabled={!photo || isAnalysing}
            >
              {isAnalysing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analyser avec l'IA
                </>
              )}
            </Button>

            <p className="text-xs text-[var(--text-muted)] text-center">
              L'IA va identifier le type de pièce, lire les références visibles et proposer des suggestions de recherche.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal résultat d'analyse
function ResultatAnalyseModal({
  resultat,
  photoUrl,
  onClose,
  onRechercher,
  onSauvegarder,
}: {
  resultat: AnalysePhotoResult;
  photoUrl?: string;
  onClose: () => void;
  onRechercher: (terme: string, fournisseur: string) => void;
  onSauvegarder: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const { data: fournisseurs } = useQuery({ queryKey: ['fournisseurs'], queryFn: getFournisseurs });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copié !');
  };

  const confianceColor = resultat.confiance > 0.7 ? 'text-green-400' : 
                         resultat.confiance > 0.4 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <Card className="w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
        <CardBody className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              Résultat de l'analyse
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Photo + Identification */}
            <div className="flex gap-4">
              {photoUrl && (
                <img 
                  src={photoUrl} 
                  alt="Pièce" 
                  className="w-32 h-32 object-cover rounded-xl bg-[var(--bg-tertiary)]"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    {resultat.type_piece}
                  </h3>
                  <span className={`text-sm ${confianceColor}`}>
                    ({Math.round(resultat.confiance * 100)}% confiance)
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {resultat.description}
                </p>
                {resultat.marque_detectee && (
                  <Badge variant="blue" className="mt-2">
                    {resultat.marque_detectee}
                  </Badge>
                )}
              </div>
            </div>

            {/* Références lues */}
            {resultat.references_lues.length > 0 && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-400" />
                  Références détectées
                </h4>
                <div className="flex flex-wrap gap-2">
                  {resultat.references_lues.map((ref, i) => (
                    <button
                      key={i}
                      onClick={() => handleCopy(ref)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      <span className="font-mono text-sm">{ref}</span>
                      {copied === ref ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caractéristiques */}
            {resultat.caracteristiques.length > 0 && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Caractéristiques
                </h4>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                  {resultat.caracteristiques.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Conseil technique */}
            {resultat.conseil_technique && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  Conseil technique
                </h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  {resultat.conseil_technique}
                </p>
              </div>
            )}

            {/* Rechercher chez les fournisseurs */}
            <div className="border-t border-[var(--border-primary)] pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-400" />
                Rechercher chez les fournisseurs
              </h4>
              
              {/* Suggestions de recherche */}
              <div className="flex flex-wrap gap-2 mb-3">
                {resultat.suggestions_recherche.map((terme, i) => (
                  <Badge key={i} variant="purple" className="cursor-pointer hover:opacity-80">
                    {terme}
                  </Badge>
                ))}
              </div>

              {/* Boutons fournisseurs */}
              <div className="grid grid-cols-3 gap-2">
                {['SODIMAS', 'HAUER', 'MGTI'].map(code => {
                  const searchTerm = resultat.references_lues[0] || resultat.suggestions_recherche[0] || resultat.type_piece;
                  return (
                    <Button
                      key={code}
                      variant="secondary"
                      className="justify-center"
                      onClick={async () => {
                        const url = await getUrlRechercheFournisseur(code, searchTerm);
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      {code}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Fermer
              </Button>
              <Button 
                variant="primary" 
                className="flex-1"
                onClick={onSauvegarder}
              >
                <Bookmark className="w-4 h-4" />
                Sauvegarder
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal ajout pièce personnelle
function AjoutPieceModal({
  onClose,
  onSave,
  initialData,
}: {
  onClose: () => void;
  onSave: (data: Partial<PiecePersonnelle>) => void;
  initialData?: Partial<PiecePersonnelle>;
}) {
  const [reference, setReference] = useState(initialData?.reference || '');
  const [designation, setDesignation] = useState(initialData?.designation || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [fournisseur, setFournisseur] = useState(initialData?.fournisseur_prefere || '');
  const [prix, setPrix] = useState(initialData?.prix_achat?.toString() || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');

  const handleSubmit = () => {
    if (!reference.trim() || !designation.trim()) {
      toast.error('Référence et désignation requises');
      return;
    }
    onSave({
      reference: reference.trim(),
      designation: designation.trim(),
      description: description.trim() || undefined,
      fournisseur_prefere: fournisseur || undefined,
      prix_achat: prix ? parseFloat(prix) : undefined,
      notes: notes.trim() || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      photo_url: initialData?.photo_url,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-green-400" />
              Ajouter au catalogue
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Référence *</label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ex: 38BU042P00001" />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Désignation *</label>
              <Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Ex: Contacteur de porte" />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description détaillée..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Fournisseur</label>
                <Select value={fournisseur} onChange={e => setFournisseur(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  <option value="SODIMAS">Sodimas</option>
                  <option value="HAUER">Hauer</option>
                  <option value="MGTI">MGTI</option>
                  <option value="MP">MP Servicenter</option>
                  <option value="AUTRE">Autre</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Prix HT (€)</label>
                <Input type="number" step="0.01" value={prix} onChange={e => setPrix(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Tags (séparés par virgules)</label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="porte, contacteur, schindler" />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Notes</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes personnelles..." />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                <Check className="w-4 h-4" /> Sauvegarder
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export function PiecesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'recherche' | 'catalogue' | 'historique'>('recherche');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [analyseResultat, setAnalyseResultat] = useState<{ result: AnalysePhotoResult; photoUrl?: string } | null>(null);
  const [showAjoutModal, setShowAjoutModal] = useState(false);
  const [pieceAEditer, setPieceAEditer] = useState<Partial<PiecePersonnelle> | null>(null);
  const [filterFournisseur, setFilterFournisseur] = useState('');
  const [filterMarque, setFilterMarque] = useState('');
  const [pieceDetail, setPieceDetail] = useState<PieceCatalogue | null>(null);

  // Queries
  const { data: fournisseurs } = useQuery({ queryKey: ['fournisseurs'], queryFn: getFournisseurs });
  const { data: piecesPerso } = useQuery({ queryKey: ['pieces-personnelles'], queryFn: getPiecesPersonnelles });
  const { data: historiqueRecherches } = useQuery({ 
    queryKey: ['historique-recherches-photo'], 
    queryFn: () => getHistoriqueRecherchesPhoto(undefined, 50) 
  });

  // Recherche dans le catalogue
  const { data: resultatsRecherche, isLoading: isSearching } = useQuery({
    queryKey: ['recherche-pieces', search, filterFournisseur, filterMarque],
    queryFn: () => searchPieces(search, { 
      fournisseur: filterFournisseur || undefined,
      marque: filterMarque || undefined,
      limit: 100
    }),
    enabled: search.length >= 2,
  });

  // Mutations
  const ajouterPieceMutation = useMutation({
    mutationFn: ajouterPiecePersonnelle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-personnelles'] });
      toast.success('Pièce ajoutée au catalogue');
      setShowAjoutModal(false);
      setPieceAEditer(null);
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const supprimerPieceMutation = useMutation({
    mutationFn: supprimerPiecePersonnelle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces-personnelles'] });
      toast.success('Pièce supprimée');
    },
  });

  // Handler résultat analyse
  const handleAnalyseResultat = (result: AnalysePhotoResult, photoUrl?: string) => {
    setShowPhotoModal(false);
    setAnalyseResultat({ result, photoUrl });
    queryClient.invalidateQueries({ queryKey: ['historique-recherches-photo'] });
  };

  // Sauvegarder depuis résultat analyse
  const handleSauvegarderFromAnalyse = () => {
    if (!analyseResultat) return;
    setPieceAEditer({
      reference: analyseResultat.result.references_lues[0] || '',
      designation: analyseResultat.result.type_piece,
      description: analyseResultat.result.description,
      photo_url: analyseResultat.photoUrl,
      tags: analyseResultat.result.suggestions_recherche,
    });
    setAnalyseResultat(null);
    setShowAjoutModal(true);
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pièces détachées</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Recherche par photo, catalogue et historique
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="bg-gradient-to-r from-purple-500 to-indigo-500"
            onClick={() => setShowPhotoModal(true)}
          >
            <Camera className="w-5 h-5" />
            Identifier par photo
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setPieceAEditer(null); setShowAjoutModal(true); }}
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-2">
        <button
          onClick={() => setActiveTab('recherche')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'recherche' 
              ? 'bg-purple-500/20 text-purple-300' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Recherche
        </button>
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'catalogue' 
              ? 'bg-pink-500/20 text-pink-300' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Heart className="w-4 h-4 inline mr-2" />
          Mon catalogue
          {piecesPerso && piecesPerso.length > 0 && (
            <Badge variant="green" className="ml-2">{piecesPerso.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('historique')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'historique' 
              ? 'bg-blue-500/20 text-blue-300' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />
          Historique
          {historiqueRecherches && historiqueRecherches.length > 0 && (
            <Badge variant="blue" className="ml-2">{historiqueRecherches.length}</Badge>
          )}
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto">
        {/* Onglet Recherche */}
        {activeTab === 'recherche' && (
          <div className="space-y-4">
            {/* Barre de recherche */}
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher par référence, désignation, marque..."
                      className="pl-11 text-lg"
                    />
                  </div>
                  <Select value={filterFournisseur} onChange={e => setFilterFournisseur(e.target.value)} className="w-40">
                    <option value="">Tous fournisseurs</option>
                    {fournisseurs?.map(f => (
                      <option key={f.code} value={f.code}>{f.nom}</option>
                    ))}
                  </Select>
                  <Select value={filterMarque} onChange={e => setFilterMarque(e.target.value)} className="w-40">
                    <option value="">Toutes marques</option>
                    {MARQUES_ASCENSEURS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>
              </CardBody>
            </Card>

            {/* Liens rapides fournisseurs */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-[var(--text-muted)]">Rechercher sur :</span>
              {['SODIMAS', 'HAUER', 'MGTI', 'MP'].map(code => (
                <Button
                  key={code}
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const url = await getUrlRechercheFournisseur(code, search || 'ascenseur');
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  {code}
                </Button>
              ))}
            </div>

            {/* Résultats */}
            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            )}

            {search.length >= 2 && resultatsRecherche && resultatsRecherche.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resultatsRecherche.map(piece => {
                  const urlFournisseur = getUrlPieceFournisseur(piece.fournisseur_code, piece.reference);
                  return (
                    <Card 
                      key={piece.id} 
                      className="hover:border-purple-500/50 transition-colors cursor-pointer group"
                      onClick={() => setPieceDetail(piece)}
                    >
                      <CardBody>
                        <div className="flex gap-3">
                          {piece.photo_url ? (
                            <img src={piece.photo_url} alt={piece.designation} className="w-20 h-20 object-cover rounded-lg bg-[var(--bg-tertiary)]" />
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                              <Package className="w-8 h-8 text-[var(--text-muted)]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm text-purple-400">{piece.reference}</p>
                            <p className="font-medium truncate">{piece.designation}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {piece.marque_compatible && <Badge variant="blue">{piece.marque_compatible}</Badge>}
                              {piece.fournisseur_code && <Badge variant="gray">{piece.fournisseur_code}</Badge>}
                            </div>
                            {piece.prix_ht && (
                              <p className="text-sm text-green-400 font-semibold mt-1">{piece.prix_ht.toFixed(2)} € HT</p>
                            )}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPieceDetail(piece);
                            }}
                            className="flex-1 py-2 px-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-3 h-3" />
                            Détails
                          </button>
                          {urlFournisseur && (
                            <a
                              href={urlFournisseur}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex-1 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {piece.fournisseur_code}
                            </a>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}

            {search.length >= 2 && resultatsRecherche && resultatsRecherche.length === 0 && !isSearching && (
              <Card>
                <CardBody className="text-center py-12">
                  <Package className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)]">Aucune pièce trouvée dans le catalogue</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Essayez de rechercher sur les sites des fournisseurs
                  </p>
                </CardBody>
              </Card>
            )}

            {search.length < 2 && (
              <Card>
                <CardBody className="text-center py-12">
                  <Camera className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Identifiez vos pièces par photo</h3>
                  <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-4">
                    Prenez une photo de la pièce à identifier. L'IA analysera l'image, lira les références et vous proposera des suggestions de recherche.
                  </p>
                  <Button
                    variant="primary"
                    className="bg-gradient-to-r from-purple-500 to-indigo-500"
                    onClick={() => setShowPhotoModal(true)}
                  >
                    <Camera className="w-5 h-5" />
                    Commencer
                  </Button>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {/* Onglet Catalogue personnel - Mon Catalogue */}
        {activeTab === 'catalogue' && (
          <MonCatalogue />
        )}

        {/* Onglet Historique */}
        {activeTab === 'historique' && (
          <div className="space-y-4">
            {historiqueRecherches && historiqueRecherches.length > 0 ? (
              <div className="space-y-3">
                {historiqueRecherches.map(recherche => (
                  <Card key={recherche.id}>
                    <CardBody>
                      <div className="flex gap-4">
                        {recherche.photo_url ? (
                          <img src={recherche.photo_url} alt="Recherche" className="w-24 h-24 object-cover rounded-lg bg-[var(--bg-tertiary)]" />
                        ) : (
                          <div className="w-24 h-24 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                            <Image className="w-8 h-8 text-[var(--text-muted)]" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{recherche.analyse_ia.type_piece}</h4>
                            <span className="text-xs text-[var(--text-muted)]">
                              {format(new Date(recherche.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                            {recherche.analyse_ia.description}
                          </p>
                          {recherche.analyse_ia.references_lues.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {recherche.analyse_ia.references_lues.map((ref, i) => (
                                <Badge key={i} variant="purple">{ref}</Badge>
                              ))}
                            </div>
                          )}
                          {recherche.code_ascenseur && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)]">
                              <Building2 className="w-3 h-3" />
                              Ascenseur: {recherche.code_ascenseur}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardBody className="text-center py-12">
                  <History className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--text-secondary)]">Aucune recherche dans l'historique</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Vos recherches par photo apparaîtront ici
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPhotoModal && (
        <AnalysePhotoModal
          onClose={() => setShowPhotoModal(false)}
          onResultat={handleAnalyseResultat}
        />
      )}

      {analyseResultat && (
        <ResultatAnalyseModal
          resultat={analyseResultat.result}
          photoUrl={analyseResultat.photoUrl}
          onClose={() => setAnalyseResultat(null)}
          onRechercher={(terme, fournisseur) => {
            setSearch(terme);
            setFilterFournisseur(fournisseur);
            setAnalyseResultat(null);
            setActiveTab('recherche');
          }}
          onSauvegarder={handleSauvegarderFromAnalyse}
        />
      )}

      {showAjoutModal && (
        <AjoutPieceModal
          onClose={() => { setShowAjoutModal(false); setPieceAEditer(null); }}
          onSave={data => ajouterPieceMutation.mutate(data)}
          initialData={pieceAEditer || undefined}
        />
      )}

      {pieceDetail && (
        <DetailPieceModal
          piece={pieceDetail}
          onClose={() => setPieceDetail(null)}
        />
      )}
    </div>
  );
}
