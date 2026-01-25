// src/components/integrations/DocumentsLies.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Upload, X, Download, Eye, Trash2, AlertTriangle, 
  CheckCircle, Clock, Filter, Search, FolderOpen, Image, File,
  Calendar, Shield, Plus, ExternalLink
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface DocumentLie {
  id: string;
  nom: string;
  type_document: string;
  type_code?: string;
  type_libelle?: string;
  categorie?: string;
  fichier_url?: string;
  fichier_taille?: number;
  date_document?: string;
  date_expiration?: string;
  numero_document?: string;
  statut_expiration?: 'valide' | 'expire_bientot' | 'expire';
  jours_avant_expiration?: number;
  version?: number;
  created_at: string;
}

interface TypeDocument {
  id: string;
  code: string;
  libelle: string;
  categorie: string;
  obligatoire: boolean;
}

interface DocumentsLiesProps {
  entiteType: 'ascenseur' | 'client' | 'travaux' | 'mise_service';
  entiteId: string;
  codeAscenseur?: string; // Pour liaison par code_ascenseur
  entiteNom?: string;
  compact?: boolean;
}

const CATEGORIES_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  reglementaire: { label: 'Réglementaire', icon: Shield, color: '#ef4444' },
  technique: { label: 'Technique', icon: FileText, color: '#3b82f6' },
  administratif: { label: 'Administratif', icon: FolderOpen, color: '#22c55e' },
  photo: { label: 'Photos', icon: Image, color: '#a855f7' },
};

const STATUT_EXPIRATION_CONFIG = {
  valide: { label: 'Valide', color: 'green', icon: CheckCircle },
  expire_bientot: { label: 'Expire bientôt', color: 'amber', icon: Clock },
  expire: { label: 'Expiré', color: 'red', icon: AlertTriangle },
};

export function DocumentsLies({ 
  entiteType, 
  entiteId, 
  codeAscenseur,
  entiteNom,
  compact = false 
}: DocumentsLiesProps) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<string>('all');
  const [dragOver, setDragOver] = useState(false);

  // Charger les documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-lies', entiteType, entiteId, codeAscenseur],
    queryFn: async () => {
      let query = supabase
        .from('v_documents_expiration')
        .select('*');
      
      if (entiteType === 'ascenseur') {
        if (codeAscenseur) {
          query = query.eq('code_ascenseur', codeAscenseur);
        } else {
          query = query.eq('ascenseur_id', entiteId);
        }
      } else if (entiteType === 'client') {
        query = query.eq('client_id', entiteId);
      } else if (entiteType === 'travaux') {
        query = query.eq('travaux_id', entiteId);
      } else if (entiteType === 'mise_service') {
        query = query.eq('mise_service_id', entiteId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as DocumentLie[];
    },
  });

  // Charger les types de documents
  const { data: typesDocuments } = useQuery({
    queryKey: ['types-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ged_types_documents')
        .select('*')
        .eq('actif', true)
        .order('ordre_affichage');
      if (error) throw error;
      return data as TypeDocument[];
    },
  });

  // Upload document
  const uploadMutation = useMutation({
    mutationFn: async (formData: { file: File; typeDocumentId: string; dateExpiration?: string; numeroDocument?: string }) => {
      const { file, typeDocumentId, dateExpiration, numeroDocument } = formData;
      
      // Upload fichier
      const fileName = `${entiteType}/${entiteId}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Obtenir URL publique
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
      
      // Créer entrée document
      const docData: any = {
        nom: file.name,
        type_document: typesDocuments?.find(t => t.id === typeDocumentId)?.code || 'autre',
        type_document_id: typeDocumentId,
        fichier_url: publicUrl,
        fichier_taille: file.size,
        date_document: new Date().toISOString().split('T')[0],
        date_expiration: dateExpiration || null,
        numero_document: numeroDocument || null,
      };
      
      // Ajouter liaison selon type
      if (entiteType === 'ascenseur') {
        if (codeAscenseur) docData.code_ascenseur = codeAscenseur;
        else docData.ascenseur_id = entiteId;
      } else {
        docData[`${entiteType}_id`] = entiteId;
      }
      
      const { error } = await supabase.from('documents').insert(docData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-lies'] });
      toast.success('Document uploadé');
      setShowUpload(false);
    },
    onError: () => toast.error('Erreur lors de l\'upload'),
  });

  // Supprimer document
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-lies'] });
      toast.success('Document supprimé');
    },
  });

  // Filtrage
  const filteredDocs = documents?.filter(d => {
    if (filterCategorie !== 'all' && d.categorie !== filterCategorie) return false;
    if (search && !d.nom.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  // Grouper par catégorie
  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    const cat = doc.categorie || 'autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, DocumentLie[]>);

  // Stats
  const stats = {
    total: documents?.length || 0,
    expires: documents?.filter(d => d.statut_expiration === 'expire').length || 0,
    expireBientot: documents?.filter(d => d.statut_expiration === 'expire_bientot').length || 0,
  };

  // Mode compact
  if (compact) {
    return (
      <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
            <FileText className="w-4 h-4" />
            Documents
            <Badge variant="gray" className="text-[10px]">{stats.total}</Badge>
            {stats.expires > 0 && <Badge variant="red" className="text-[10px]">{stats.expires} expiré(s)</Badge>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowUpload(true)}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {documents?.slice(0, 3).map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
              <File className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="flex-1 truncate text-[var(--text-primary)]">{doc.nom}</span>
              {doc.statut_expiration === 'expire' && <AlertTriangle className="w-3 h-3 text-red-400" />}
            </div>
          ))}
          {(documents?.length || 0) > 3 && (
            <button className="text-xs text-purple-400 hover:underline">
              Voir tous ({documents?.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Documents {entiteNom && `- ${entiteNom}`}</h3>
            <p className="text-xs text-[var(--text-muted)]">{stats.total} document(s)</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowUpload(true)}>
          <Upload className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Alertes expiration */}
      {(stats.expires > 0 || stats.expireBientot > 0) && (
        <div className={`p-3 rounded-xl flex items-center gap-3 ${
          stats.expires > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
          <AlertTriangle className={`w-5 h-5 ${stats.expires > 0 ? 'text-red-400' : 'text-amber-400'}`} />
          <div className="flex-1">
            {stats.expires > 0 && (
              <span className="text-sm text-red-400 font-medium">{stats.expires} document(s) expiré(s)</span>
            )}
            {stats.expireBientot > 0 && (
              <span className={`text-sm ${stats.expires > 0 ? 'text-[var(--text-muted)] ml-2' : 'text-amber-400 font-medium'}`}>
                {stats.expireBientot} expire(nt) bientôt
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Rechercher..." 
            className="pl-10"
          />
        </div>
        <Select value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)} className="w-40">
          <option value="all">Toutes catégories</option>
          {Object.entries(CATEGORIES_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
      </div>

      {/* Liste documents par catégorie */}
      {isLoading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>
      ) : filteredDocs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-[var(--text-tertiary)]">Aucun document</p>
          <Button variant="secondary" className="mt-3" onClick={() => setShowUpload(true)}>
            <Plus className="w-4 h-4" /> Ajouter un document
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedDocs).map(([categorie, docs]) => {
            const config = CATEGORIES_CONFIG[categorie] || { label: categorie, icon: File, color: '#6366f1' };
            const Icon = config.icon;
            
            return (
              <Card key={categorie}>
                <div className="p-3 border-b border-[var(--border-primary)] flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                  <span className="font-medium text-[var(--text-primary)]">{config.label}</span>
                  <Badge variant="gray" className="text-[10px]">{docs.length}</Badge>
                </div>
                <div className="divide-y divide-[var(--border-primary)]">
                  {docs.map(doc => {
                    const expConfig = doc.statut_expiration ? STATUT_EXPIRATION_CONFIG[doc.statut_expiration] : null;
                    const ExpIcon = expConfig?.icon;
                    
                    return (
                      <div key={doc.id} className="p-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)]/50">
                        <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
                          {doc.type_document?.includes('photo') || doc.nom.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <Image className="w-5 h-5 text-purple-400" />
                          ) : (
                            <FileText className="w-5 h-5 text-[var(--text-muted)]" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--text-primary)] truncate">{doc.nom}</span>
                            {doc.version && doc.version > 1 && (
                              <Badge variant="gray" className="text-[10px]">v{doc.version}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            {doc.type_libelle && <span>{doc.type_libelle}</span>}
                            {doc.date_document && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(doc.date_document), 'd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Statut expiration */}
                        {expConfig && doc.date_expiration && (
                          <Badge variant={expConfig.color as any} className="flex items-center gap-1">
                            {ExpIcon && <ExpIcon className="w-3 h-3" />}
                            {doc.jours_avant_expiration !== undefined && doc.jours_avant_expiration > 0 
                              ? `${doc.jours_avant_expiration}j`
                              : expConfig.label
                            }
                          </Badge>
                        )}
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {doc.fichier_url && (
                            <>
                              <a 
                                href={doc.fichier_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
                              >
                                <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                              </a>
                              <a 
                                href={doc.fichier_url} 
                                download
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
                              >
                                <Download className="w-4 h-4 text-[var(--text-muted)]" />
                              </a>
                            </>
                          )}
                          <button 
                            onClick={() => deleteMutation.mutate(doc.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Upload */}
      {showUpload && (
        <UploadModal 
          typesDocuments={typesDocuments || []}
          onClose={() => setShowUpload(false)}
          onUpload={(data) => uploadMutation.mutate(data)}
          isLoading={uploadMutation.isPending}
        />
      )}
    </div>
  );
}

// Modal Upload
function UploadModal({ 
  typesDocuments, 
  onClose, 
  onUpload,
  isLoading 
}: { 
  typesDocuments: TypeDocument[];
  onClose: () => void;
  onUpload: (data: { file: File; typeDocumentId: string; dateExpiration?: string; numeroDocument?: string }) => void;
  isLoading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [typeDocumentId, setTypeDocumentId] = useState('');
  const [dateExpiration, setDateExpiration] = useState('');
  const [numeroDocument, setNumeroDocument] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !typeDocumentId) {
      toast.error('Veuillez sélectionner un fichier et un type');
      return;
    }
    onUpload({ file, typeDocumentId, dateExpiration: dateExpiration || undefined, numeroDocument: numeroDocument || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px] max-h-[90vh] overflow-y-auto">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Ajouter un document</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Zone drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-purple-500 bg-purple-500/10' : 'border-[var(--border-primary)]'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-purple-400" />
                  <div className="text-left">
                    <p className="font-medium text-[var(--text-primary)]">{file.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} Ko</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="p-1 hover:bg-red-500/20 rounded">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-[var(--text-tertiary)]">Glissez un fichier ici ou</p>
                  <label className="inline-block mt-2 px-4 py-2 bg-purple-500 text-white rounded-lg cursor-pointer hover:bg-purple-600">
                    Parcourir
                    <input type="file" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                  </label>
                </>
              )}
            </div>

            {/* Type document */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Type de document *</label>
              <Select value={typeDocumentId} onChange={e => setTypeDocumentId(e.target.value)} required>
                <option value="">Sélectionner...</option>
                {typesDocuments.map(t => (
                  <option key={t.id} value={t.id}>{t.libelle}</option>
                ))}
              </Select>
            </div>

            {/* Date expiration */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date d'expiration</label>
              <Input type="date" value={dateExpiration} onChange={e => setDateExpiration(e.target.value)} />
            </div>

            {/* Numéro document */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Numéro/Référence</label>
              <Input value={numeroDocument} onChange={e => setNumeroDocument(e.target.value)} placeholder="Ex: CT-2024-001" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Annuler</Button>
              <Button variant="primary" type="submit" disabled={isLoading || !file} className="flex-1">
                {isLoading ? 'Upload...' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
