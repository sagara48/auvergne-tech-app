import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderOpen, File, FileText, Image, FileSpreadsheet, Search, Upload, Grid, List, 
  Plus, Edit2, Trash2, X, FolderPlus, ChevronRight, Download, Eye, MoreVertical,
  Folder, Check, Tag, Filter, Calendar, SlidersHorizontal, Sparkles, Scan, Loader2,
  FileSearch, Copy, CheckCircle, Building2, ChevronDown
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { getDocuments, getGedDossiers, createGedDossier, updateGedDossier, deleteGedDossier, uploadDocument, deleteDocument, updateDocument } from '@/services/api';
import type { GedDossier } from '@/services/api';
import { supabase } from '@/services/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDocument, Document } from '@/types';
import toast from 'react-hot-toast';
import { 
  extractTextFromImage, 
  searchInText, 
  analyzeDocumentText,
  cacheOCRText,
  getCachedOCRText,
  searchAllDocuments
} from '@/services/ocrService';

const TYPE_CONFIG: Record<TypeDocument, { label: string; icon: any; color: string }> = {
  contrat: { label: 'Contrat', icon: FileText, color: '#3b82f6' },
  rapport: { label: 'Rapport', icon: FileText, color: '#22c55e' },
  photo: { label: 'Photo', icon: Image, color: '#f59e0b' },
  facture: { label: 'Facture', icon: FileSpreadsheet, color: '#ef4444' },
  devis: { label: 'Devis', icon: FileSpreadsheet, color: '#a855f7' },
  plan: { label: 'Plan', icon: FileText, color: '#06b6d4' },
  certificat: { label: 'Certificat', icon: FileText, color: '#ec4899' },
  autre: { label: 'Autre', icon: File, color: '#71717a' },
};

const COULEURS_DOSSIER = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#71717a'
];

// Modal Dossier
function DossierModal({ 
  dossier, 
  onClose, 
  onSave 
}: { 
  dossier?: GedDossier | null; 
  onClose: () => void; 
  onSave: (data: Partial<GedDossier>) => void;
}) {
  const [nom, setNom] = useState(dossier?.nom || '');
  const [description, setDescription] = useState(dossier?.description || '');
  const [couleur, setCouleur] = useState(dossier?.couleur || '#6366f1');

  const handleSubmit = () => {
    if (!nom.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    onSave({ nom, description, couleur });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FolderPlus className="w-6 h-6 text-indigo-400" />
              {dossier ? 'Modifier le dossier' : 'Nouveau dossier'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Nom du dossier *</label>
              <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Contrats 2026" />
            </div>
            
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description optionnelle" />
            </div>
            
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-2 block">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {COULEURS_DOSSIER.map(c => (
                  <button
                    key={c}
                    onClick={() => setCouleur(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${couleur === c ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit}>
                {dossier ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal Import
function ImportModal({ 
  dossiers,
  ascenseurs,
  defaultAscenseur,
  onClose, 
  onUpload 
}: { 
  dossiers: GedDossier[];
  ascenseurs: any[];
  defaultAscenseur?: string | null;
  onClose: () => void; 
  onUpload: (file: File, metadata: any) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [nom, setNom] = useState('');
  const [typeDocument, setTypeDocument] = useState<TypeDocument>('autre');
  const [dossierId, setDossierId] = useState('');
  const [codeAscenseur, setCodeAscenseur] = useState(defaultAscenseur || '');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!nom) setNom(droppedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!nom) setNom(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = () => {
    if (!file) {
      toast.error('Sélectionnez un fichier');
      return;
    }
    if (!nom.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    onUpload(file, { 
      nom, 
      type_document: typeDocument, 
      dossier_id: dossierId || undefined,
      dossier: dossiers.find(d => d.id === dossierId)?.nom,
      code_ascenseur: codeAscenseur || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Upload className="w-6 h-6 text-green-400" />
              Importer un document
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Zone de drop */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging ? 'border-green-500 bg-green-500/10' : 
                file ? 'border-green-500/50 bg-green-500/5' : 
                'border-[var(--border-primary)] hover:border-[var(--text-muted)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{file.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                  <div className="text-sm text-[var(--text-secondary)]">
                    Glissez un fichier ou cliquez pour sélectionner
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    PDF, Word, Excel, Images (max 10 MB)
                  </div>
                </>
              )}
            </div>
            
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Nom du document *</label>
              <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du document" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Type</label>
                <Select value={typeDocument} onChange={e => setTypeDocument(e.target.value as TypeDocument)}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Dossier</label>
                <Select value={dossierId} onChange={e => setDossierId(e.target.value)}>
                  <option value="">Sans dossier</option>
                  {dossiers.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </Select>
              </div>
            </div>
            
            {/* Liaison ascenseur */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">
                Lier à un ascenseur (optionnel)
              </label>
              <Select value={codeAscenseur} onChange={e => setCodeAscenseur(e.target.value)}>
                <option value="">Aucun ascenseur</option>
                {ascenseurs.map((asc: any) => (
                  <option key={asc.code_appareil} value={asc.code_appareil}>
                    {asc.code_appareil} - {asc.ville}
                  </option>
                ))}
              </Select>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={!file}>
                <Upload className="w-4 h-4" /> Importer
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal OCR - Extraction de texte
function OCRModal({ 
  document, 
  onClose 
}: { 
  document: Document; 
  onClose: () => void;
}) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  // Vérifier le cache au chargement
  useState(() => {
    const cached = getCachedOCRText(document.id);
    if (cached) {
      setExtractedText(cached.text);
      setMetadata(cached.metadata);
    }
  });

  const handleExtract = async () => {
    if (!document.url) {
      toast.error('URL du document non disponible');
      return;
    }

    setIsExtracting(true);
    setProgress(0);

    try {
      const isImage = document.type === 'photo' || 
                      document.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);

      let text = '';
      
      if (isImage) {
        const result = await extractTextFromImage(
          document.url,
          (p) => setProgress(Math.round(p * 100))
        );
        text = result.text;
      } else {
        // Pour les PDFs, on utiliserait extractTextFromPDF
        // mais cela nécessite le fichier original
        toast.error('OCR sur PDF non disponible - utilisez une image');
        setIsExtracting(false);
        return;
      }

      if (text) {
        setExtractedText(text);
        const meta = analyzeDocumentText(text);
        setMetadata(meta);
        
        // Mettre en cache
        cacheOCRText(document.id, text, meta);
        
        toast.success(`Texte extrait avec succès (${text.length} caractères)`);
      } else {
        toast.error('Aucun texte détecté dans le document');
      }
    } catch (error) {
      console.error('Erreur OCR:', error);
      toast.error('Erreur lors de l\'extraction du texte');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSearch = () => {
    if (extractedText && searchQuery) {
      const matches = searchInText(extractedText, searchQuery);
      setSearchMatches(matches);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Texte copié dans le presse-papier');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Scan className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Extraction OCR</h2>
                  <p className="text-sm text-[var(--text-muted)]">{document.nom}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!extractedText ? (
              <div className="text-center py-8">
                <Scan className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
                <p className="text-[var(--text-secondary)] mb-4">
                  Extraire le texte de ce document pour permettre la recherche full-text
                </p>
                <Button 
                  variant="primary" 
                  onClick={handleExtract}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Extraction... {progress}%
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      Lancer l'OCR
                    </>
                  )}
                </Button>
                {isExtracting && (
                  <div className="mt-4 w-64 mx-auto">
                    <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Métadonnées détectées */}
                {metadata && (metadata.type || metadata.date || metadata.montant || metadata.keywords?.length > 0) && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Métadonnées détectées
                    </h4>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {metadata.type && (
                        <Badge variant="purple">Type: {metadata.type}</Badge>
                      )}
                      {metadata.date && (
                        <Badge variant="blue">Date: {metadata.date}</Badge>
                      )}
                      {metadata.montant && (
                        <Badge variant="green">Montant: {metadata.montant.toFixed(2)}€</Badge>
                      )}
                      {metadata.reference && (
                        <Badge>Réf: {metadata.reference}</Badge>
                      )}
                    </div>
                    {metadata.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {metadata.keywords.map((kw: string) => (
                          <span key={kw} className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recherche dans le texte */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="Rechercher dans le texte extrait..."
                      className="pl-10"
                    />
                  </div>
                  <Button variant="secondary" onClick={handleSearch}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>

                {/* Résultats de recherche */}
                {searchMatches.length > 0 && (
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      {searchMatches.length} résultat{searchMatches.length > 1 ? 's' : ''} trouvé{searchMatches.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {searchMatches.map((match, idx) => (
                        <div key={idx} className="text-sm p-2 bg-[var(--bg-secondary)] rounded">
                          <span className="text-[var(--text-muted)]">...</span>
                          {match.context.split(match.highlight).map((part: string, i: number, arr: string[]) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <mark className="bg-yellow-500/30 text-yellow-300 px-0.5 rounded">
                                  {match.highlight}
                                </mark>
                              )}
                            </span>
                          ))}
                          <span className="text-[var(--text-muted)]">...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Texte extrait */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Texte extrait</h4>
                    <Button variant="secondary" size="sm" onClick={handleCopy}>
                      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copié' : 'Copier'}
                    </Button>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-[var(--text-secondary)]">
                      {extractedText}
                    </pre>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {extractedText.length} caractères • {extractedText.split(/\s+/).length} mots
                  </p>
                </div>

                {/* Bouton ré-extraction */}
                <Button variant="secondary" onClick={handleExtract} disabled={isExtracting}>
                  <Scan className="w-4 h-4" />
                  Ré-extraire le texte
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function GEDPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [selectedAscenseur, setSelectedAscenseur] = useState<string | null>(null);
  const [showAscenseurs, setShowAscenseurs] = useState(false);
  const [ascenseurSearch, setAscenseurSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingDossier, setEditingDossier] = useState<GedDossier | null>(null);
  const [contextMenu, setContextMenu] = useState<{ dossier: GedDossier; x: number; y: number } | null>(null);
  const [ocrDocument, setOcrDocument] = useState<Document | null>(null);
  const [fullTextSearch, setFullTextSearch] = useState(false);
  const [fullTextResults, setFullTextResults] = useState<any[]>([]);
  
  // États recherche avancée
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'nom' | 'taille'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: documents } = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const { data: dossiers } = useQuery({ queryKey: ['ged-dossiers'], queryFn: getGedDossiers });
  
  // Récupérer TOUS les ascenseurs du parc (pour créer les dossiers virtuels)
  const { data: tousLesAscenseurs } = useQuery({
    queryKey: ['tous-ascenseurs-parc'],
    queryFn: async () => {
      const { data } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville')
        .order('code_appareil');
      return data || [];
    }
  });
  
  // Compter les documents par ascenseur
  const docsParAscenseur = useMemo(() => {
    const counts: Record<string, number> = {};
    (documents || []).forEach((doc: any) => {
      if (doc.code_ascenseur) {
        counts[doc.code_ascenseur] = (counts[doc.code_ascenseur] || 0) + 1;
      }
    });
    return counts;
  }, [documents]);
  
  // Nombre total de documents liés à des ascenseurs
  const totalDocsAscenseurs = useMemo(() => {
    return (documents || []).filter((d: any) => d.code_ascenseur).length;
  }, [documents]);

  // Mutations dossiers
  const createDossierMutation = useMutation({
    mutationFn: createGedDossier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-dossiers'] });
      toast.success('Dossier créé');
      setShowDossierModal(false);
    },
    onError: () => toast.error('Erreur création dossier'),
  });

  const updateDossierMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GedDossier> }) => updateGedDossier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-dossiers'] });
      toast.success('Dossier modifié');
      setEditingDossier(null);
    },
  });

  const deleteDossierMutation = useMutation({
    mutationFn: deleteGedDossier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ged-dossiers'] });
      toast.success('Dossier supprimé');
      if (selectedDossier === contextMenu?.dossier.id) setSelectedDossier(null);
      setContextMenu(null);
    },
  });

  // Mutation upload
  const uploadMutation = useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: any }) => uploadDocument(file, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document importé');
      setShowImportModal(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur import'),
  });

  // Mutation suppression document
  const deleteDocMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document supprimé');
    },
  });

  // Fonction de normalisation pour la recherche
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Filtrage amélioré avec recherche avancée
  const filtered = useMemo(() => {
    let result = documents || [];
    
    // Filtre par recherche texte (nom, description, tags)
    if (search) {
      const searchNorm = normalizeText(search);
      result = result.filter(d => {
        const nomNorm = normalizeText(d.nom || '');
        const descNorm = normalizeText((d as any).description || '');
        const tagsNorm = ((d as any).tags || []).map((t: string) => normalizeText(t)).join(' ');
        return nomNorm.includes(searchNorm) || 
               descNorm.includes(searchNorm) || 
               tagsNorm.includes(searchNorm);
      });
    }
    
    // Filtre par type
    if (filterType !== 'all') {
      result = result.filter(d => d.type_document === filterType);
    }
    
    // Filtre par ascenseur spécifique
    if (selectedAscenseur) {
      result = result.filter(d => (d as any).code_ascenseur === selectedAscenseur);
    }
    // Filtre par dossier "ascenseurs" (tous les docs avec un code_ascenseur)
    else if (selectedDossier === 'ascenseurs') {
      result = result.filter(d => (d as any).code_ascenseur);
    }
    // Filtre par dossier classique
    else if (selectedDossier !== null) {
      if (selectedDossier === 'sans-dossier') {
        result = result.filter(d => !(d as any).dossier_id && !(d as any).code_ascenseur);
      } else {
        result = result.filter(d => (d as any).dossier_id === selectedDossier);
      }
    }
    
    // Filtre par date (recherche avancée)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(d => new Date(d.created_at) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59);
      result = result.filter(d => new Date(d.created_at) <= toDate);
    }
    
    // Filtre par tags sélectionnés
    if (selectedTags.length > 0) {
      result = result.filter(d => {
        const docTags = (d as any).tags || [];
        return selectedTags.some(tag => docTags.includes(tag));
      });
    }
    
    // Tri
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'nom':
          comparison = (a.nom || '').localeCompare(b.nom || '');
          break;
        case 'taille':
          comparison = ((a as any).taille || 0) - ((b as any).taille || 0);
          break;
        case 'date':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return result;
  }, [documents, search, filterType, selectedDossier, selectedAscenseur, dateFrom, dateTo, selectedTags, sortBy, sortOrder]);

  // Extraire tous les tags uniques
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    documents?.forEach(d => {
      ((d as any).tags || []).forEach((tag: string) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [documents]);

  // Stats
  const stats = {
    total: documents?.length || 0,
    dossiers: dossiers?.length || 0,
  };

  // Compte documents par dossier
  const getDocCountForDossier = (dossierId: string) => {
    return documents?.filter(d => (d as any).dossier_id === dossierId).length || 0;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDossierContextMenu = (e: React.MouseEvent, dossier: GedDossier) => {
    e.preventDefault();
    setContextMenu({ dossier, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Sidebar - Dossiers */}
      <div className="w-64 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Dossiers</h3>
          <button 
            onClick={() => setShowDossierModal(true)}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <Card className="flex-1 overflow-hidden">
          <CardBody className="p-2 h-full overflow-y-auto">
            {/* Tous les documents */}
            <button
              onClick={() => setSelectedDossier(null)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg mb-1 transition-colors ${
                selectedDossier === null ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm flex-1 text-left">Tous les documents</span>
              <Badge variant="purple" className="text-xs">{stats.total}</Badge>
            </button>
            
            {/* Sans dossier */}
            <button
              onClick={() => setSelectedDossier('sans-dossier')}
              className={`w-full flex items-center gap-3 p-2 rounded-lg mb-1 transition-colors ${
                selectedDossier === 'sans-dossier' ? 'bg-gray-500/20 text-gray-300' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
              }`}
            >
              <File className="w-4 h-4" />
              <span className="text-sm flex-1 text-left">Sans dossier</span>
              <Badge variant="gray" className="text-xs">
                {documents?.filter(d => !(d as any).dossier_id).length || 0}
              </Badge>
            </button>
            
            <div className="border-t border-[var(--border-primary)] my-2" />
            
            {/* Liste des dossiers */}
            {dossiers?.map(dossier => (
              <button
                key={dossier.id}
                onClick={() => setSelectedDossier(dossier.id)}
                onContextMenu={e => handleDossierContextMenu(e, dossier)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg mb-1 transition-colors group ${
                  selectedDossier === dossier.id ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: `${dossier.couleur}30` }}
                >
                  <Folder className="w-3.5 h-3.5" style={{ color: dossier.couleur }} />
                </div>
                <span className="text-sm flex-1 text-left text-[var(--text-primary)] truncate">{dossier.nom}</span>
                <span className="text-xs text-[var(--text-muted)]">{getDocCountForDossier(dossier.id)}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDossierContextMenu(e, dossier); }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-elevated)] rounded"
                >
                  <MoreVertical className="w-3 h-3 text-[var(--text-muted)]" />
                </button>
              </button>
            ))}
            
            {(!dossiers || dossiers.length === 0) && (
              <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                Aucun dossier
              </div>
            )}
            
            {/* Section Ascenseurs - Dossiers virtuels par code_appareil */}
            <div className="border-t border-[var(--border-primary)] my-2" />
            
            <button
              onClick={() => {
                setShowAscenseurs(!showAscenseurs);
                if (!showAscenseurs) {
                  // Quand on ouvre la section, on affiche tous les docs ascenseurs
                  setSelectedAscenseur(null);
                  setSelectedDossier('ascenseurs');
                }
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-lg mb-1 transition-colors ${
                selectedDossier === 'ascenseurs' && !selectedAscenseur
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
              }`}
            >
              <Building2 className="w-4 h-4 text-orange-400" />
              <span className="text-sm flex-1 text-left font-medium">Ascenseurs</span>
              <Badge variant="orange" className="text-xs mr-1">
                {totalDocsAscenseurs}
              </Badge>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAscenseurs ? 'rotate-180' : ''}`} />
            </button>
            
            {showAscenseurs && (
              <div className="ml-2 pl-2 border-l border-[var(--border-primary)]">
                {/* Recherche ascenseur */}
                <div className="mb-2">
                  <Input
                    placeholder="Rechercher un code..."
                    value={ascenseurSearch}
                    onChange={e => setAscenseurSearch(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                
                {/* Liste filtrée des ascenseurs */}
                <div className="max-h-64 overflow-y-auto">
                  {tousLesAscenseurs
                    ?.filter((asc: any) => {
                      if (!ascenseurSearch) return true;
                      const searchLower = ascenseurSearch.toLowerCase();
                      return asc.code_appareil.toLowerCase().includes(searchLower) ||
                             asc.ville?.toLowerCase().includes(searchLower) ||
                             asc.adresse?.toLowerCase().includes(searchLower);
                    })
                    .slice(0, 50) // Limiter à 50 pour la performance
                    .map((asc: any) => {
                      const nbDocs = docsParAscenseur[asc.code_appareil] || 0;
                      return (
                        <button
                          key={asc.code_appareil}
                          onClick={() => {
                            setSelectedAscenseur(asc.code_appareil);
                            setSelectedDossier('ascenseurs');
                          }}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 text-sm transition-colors ${
                            selectedAscenseur === asc.code_appareil 
                              ? 'bg-orange-500/20 text-orange-300' 
                              : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Folder className={`w-3 h-3 ${nbDocs > 0 ? 'text-orange-400' : 'text-[var(--text-muted)]'}`} />
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium truncate">{asc.code_appareil}</p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">
                              {asc.ville}
                            </p>
                          </div>
                          <span className={`text-xs ${nbDocs > 0 ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
                            {nbDocs}
                          </span>
                        </button>
                      );
                    })}
                  
                  {tousLesAscenseurs && tousLesAscenseurs.filter((asc: any) => {
                    if (!ascenseurSearch) return true;
                    const searchLower = ascenseurSearch.toLowerCase();
                    return asc.code_appareil.toLowerCase().includes(searchLower) ||
                           asc.ville?.toLowerCase().includes(searchLower);
                  }).length > 50 && (
                    <div className="text-center py-2 text-xs text-[var(--text-muted)]">
                      Affinez la recherche pour voir plus de résultats
                    </div>
                  )}
                </div>
                
                {(!tousLesAscenseurs || tousLesAscenseurs.length === 0) && (
                  <div className="text-center py-2 text-xs text-[var(--text-muted)]">
                    Aucun ascenseur dans le parc
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input 
                placeholder={fullTextSearch ? "Recherche dans le contenu OCR..." : "Rechercher..."} 
                value={search} 
                onChange={e => {
                  setSearch(e.target.value);
                  if (fullTextSearch && e.target.value.length >= 3) {
                    const results = searchAllDocuments(e.target.value);
                    setFullTextResults(results);
                  } else {
                    setFullTextResults([]);
                  }
                }} 
                className="pl-10 w-64" 
              />
            </div>
            <button
              onClick={() => setFullTextSearch(!fullTextSearch)}
              className={`p-2 rounded-lg border transition-colors ${
                fullTextSearch 
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Recherche full-text (dans le contenu OCR)"
            >
              <FileSearch className="w-4 h-4" />
            </button>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-40">
              <option value="all">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`p-2 rounded-lg border transition-colors ${
                showAdvancedSearch 
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' 
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Recherche avancée"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Tri */}
            <Select 
              value={`${sortBy}-${sortOrder}`} 
              onChange={e => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by as any);
                setSortOrder(order as any);
              }} 
              className="w-36 text-sm"
            >
              <option value="date-desc">Plus récents</option>
              <option value="date-asc">Plus anciens</option>
              <option value="nom-asc">Nom A-Z</option>
              <option value="nom-desc">Nom Z-A</option>
              <option value="taille-desc">Plus gros</option>
              <option value="taille-asc">Plus petits</option>
            </Select>
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button variant="primary" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4" /> Importer
            </Button>
          </div>
        </div>
        
        {/* Panneau recherche avancée */}
        {showAdvancedSearch && (
          <Card className="mb-4 border-indigo-500/30">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Recherche avancée
                </h4>
                <button 
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setSelectedTags([]);
                  }}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Réinitialiser
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                {/* Filtres par date */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Date début</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Date fin</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="text-sm"
                  />
                </div>
                
                {/* Tags */}
                <div className="col-span-2">
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Filtrer par tags</label>
                  <div className="flex flex-wrap gap-1 p-2 bg-[var(--bg-tertiary)] rounded-lg min-h-[38px]">
                    {allTags.length > 0 ? (
                      allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (selectedTags.includes(tag)) {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            } else {
                              setSelectedTags([...selectedTags, tag]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            selectedTags.includes(tag)
                              ? 'bg-indigo-500 text-white'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Tag className="w-3 h-3 inline mr-1" />{tag}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Aucun tag disponible</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Résumé filtres actifs */}
              {(dateFrom || dateTo || selectedTags.length > 0) && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-[var(--text-muted)]">Filtres actifs:</span>
                  {dateFrom && (
                    <Badge variant="gray" className="text-xs">
                      Depuis {format(new Date(dateFrom), 'dd/MM/yyyy')}
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge variant="gray" className="text-xs">
                      Jusqu'au {format(new Date(dateTo), 'dd/MM/yyyy')}
                    </Badge>
                  )}
                  {selectedTags.map(tag => (
                    <Badge key={tag} variant="blue" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <span className="text-sm font-medium text-indigo-400 ml-auto">
                    {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Titre du dossier sélectionné */}
        {selectedDossier && selectedDossier !== 'sans-dossier' && (
          <div className="flex items-center gap-2 mb-4">
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            {selectedDossier === 'ascenseurs' ? (
              <>
                <Building2 className="w-5 h-5 text-orange-400" />
                <span className="text-lg font-semibold text-[var(--text-primary)]">
                  Ascenseurs
                </span>
                {selectedAscenseur && (
                  <>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    <Folder className="w-5 h-5 text-orange-400" />
                    <span className="text-lg font-semibold text-orange-400">
                      {selectedAscenseur}
                    </span>
                    {tousLesAscenseurs?.find((a: any) => a.code_appareil === selectedAscenseur)?.ville && (
                      <span className="text-sm text-[var(--text-muted)]">
                        ({tousLesAscenseurs.find((a: any) => a.code_appareil === selectedAscenseur)?.ville})
                      </span>
                    )}
                  </>
                )}
              </>
            ) : (
              <span className="text-lg font-semibold text-[var(--text-primary)]">
                {dossiers?.find(d => d.id === selectedDossier)?.nom}
              </span>
            )}
          </div>
        )}

        {/* Liste des documents */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-4 gap-4">
              {filtered.map(doc => {
                const config = TYPE_CONFIG[doc.type_document];
                const Icon = config?.icon || File;
                const color = config?.color || '#71717a';
                return (
                  <Card key={doc.id} className="hover:border-indigo-500/50 transition-colors cursor-pointer group">
                    <CardBody className="text-center relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {(doc.type_document === 'photo' || doc.fichier_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOcrDocument(doc); }}
                            className="p-1.5 bg-[var(--bg-tertiary)] rounded hover:bg-purple-500/20"
                            title="Extraire le texte (OCR)"
                          >
                            <Scan className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                        )}
                        {doc.fichier_url && (
                          <a 
                            href={doc.fichier_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 bg-[var(--bg-tertiary)] rounded hover:bg-blue-500/20"
                            onClick={e => e.stopPropagation()}
                          >
                            <Download className="w-3.5 h-3.5 text-blue-400" />
                          </a>
                        )}
                        <button 
                          onClick={() => { if (confirm('Supprimer ce document ?')) deleteDocMutation.mutate(doc.id); }}
                          className="p-1.5 bg-[var(--bg-tertiary)] rounded hover:bg-red-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                      <div 
                        className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center" 
                        style={{ background: `${color}20` }}
                      >
                        <Icon className="w-8 h-8" style={{ color }} />
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">{doc.nom}</h3>
                      <p className="text-xs text-[var(--text-muted)] mb-3">{formatFileSize(doc.fichier_taille)}</p>
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="purple">{config?.label || 'Autre'}</Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <div className="divide-y divide-dark-600">
                {filtered.map(doc => {
                  const config = TYPE_CONFIG[doc.type_document];
                  const Icon = config?.icon || File;
                  const color = config?.color || '#71717a';
                  return (
                    <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-tertiary)]/30 group">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center" 
                        style={{ background: `${color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{doc.nom}</h3>
                        <p className="text-xs text-[var(--text-muted)]">{doc.dossier || 'Sans dossier'}</p>
                      </div>
                      <Badge variant="purple">{config?.label || 'Autre'}</Badge>
                      <span className="text-xs text-[var(--text-muted)] w-20 text-right">{formatFileSize(doc.fichier_taille)}</span>
                      <span className="text-xs text-[var(--text-muted)] w-24 text-right">
                        {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.fichier_url && (
                          <a 
                            href={doc.fichier_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-blue-500/20 rounded"
                          >
                            <Download className="w-4 h-4 text-blue-400" />
                          </a>
                        )}
                        <button 
                          onClick={() => { if (confirm('Supprimer ?')) deleteDocMutation.mutate(doc.id); }}
                          className="p-1.5 hover:bg-red-500/20 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {filtered.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
                <div className="text-[var(--text-muted)]">Aucun document trouvé</div>
                <Button variant="primary" className="mt-4" onClick={() => setShowImportModal(true)}>
                  <Upload className="w-4 h-4" /> Importer un document
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Menu contextuel dossier */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div 
            className="fixed z-50 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { setEditingDossier(contextMenu.dossier); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Edit2 className="w-4 h-4" /> Modifier
            </button>
            <button
              onClick={() => { 
                if (confirm(`Supprimer le dossier "${contextMenu.dossier.nom}" ?`)) {
                  deleteDossierMutation.mutate(contextMenu.dossier.id);
                } else {
                  setContextMenu(null);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      {(showDossierModal || editingDossier) && (
        <DossierModal
          dossier={editingDossier}
          onClose={() => { setShowDossierModal(false); setEditingDossier(null); }}
          onSave={data => {
            if (editingDossier) {
              updateDossierMutation.mutate({ id: editingDossier.id, data });
            } else {
              createDossierMutation.mutate(data);
            }
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          dossiers={dossiers || []}
          ascenseurs={tousLesAscenseurs || []}
          defaultAscenseur={selectedAscenseur}
          onClose={() => setShowImportModal(false)}
          onUpload={(file, metadata) => uploadMutation.mutate({ file, metadata })}
        />
      )}

      {ocrDocument && (
        <OCRModal
          document={ocrDocument}
          onClose={() => setOcrDocument(null)}
        />
      )}
    </div>
  );
}
