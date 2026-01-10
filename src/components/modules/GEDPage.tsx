import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderOpen, File, FileText, Image, FileSpreadsheet, Search, Upload, Grid, List, 
  Plus, Edit2, Trash2, X, FolderPlus, ChevronRight, Download, Eye, MoreVertical,
  Folder, Check
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getDocuments, getGedDossiers, createGedDossier, updateGedDossier, deleteGedDossier, uploadDocument, deleteDocument, updateDocument } from '@/services/api';
import type { GedDossier } from '@/services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDocument, Document } from '@/types';
import toast from 'react-hot-toast';

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
  onClose, 
  onUpload 
}: { 
  dossiers: GedDossier[];
  onClose: () => void; 
  onUpload: (file: File, metadata: any) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [nom, setNom] = useState('');
  const [typeDocument, setTypeDocument] = useState<TypeDocument>('autre');
  const [dossierId, setDossierId] = useState('');
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
      dossier: dossiers.find(d => d.id === dossierId)?.nom
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

export function GEDPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingDossier, setEditingDossier] = useState<GedDossier | null>(null);
  const [contextMenu, setContextMenu] = useState<{ dossier: GedDossier; x: number; y: number } | null>(null);

  const { data: documents } = useQuery({ queryKey: ['documents'], queryFn: getDocuments });
  const { data: dossiers } = useQuery({ queryKey: ['ged-dossiers'], queryFn: getGedDossiers });

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

  // Filtrage
  const filtered = documents?.filter(d => {
    const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || d.type_document === filterType;
    const matchDossier = selectedDossier === null || (d as any).dossier_id === selectedDossier || 
      (!(d as any).dossier_id && selectedDossier === 'sans-dossier');
    return matchSearch && matchType && matchDossier;
  }) || [];

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
                placeholder="Rechercher..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-10 w-64" 
              />
            </div>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-40">
              <option value="all">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Titre du dossier sélectionné */}
        {selectedDossier && selectedDossier !== 'sans-dossier' && (
          <div className="flex items-center gap-2 mb-4">
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              {dossiers?.find(d => d.id === selectedDossier)?.nom}
            </span>
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
          onClose={() => setShowImportModal(false)}
          onUpload={(file, metadata) => uploadMutation.mutate({ file, metadata })}
        />
      )}
    </div>
  );
}
