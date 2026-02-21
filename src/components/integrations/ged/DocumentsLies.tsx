// components/ged/DocumentsLies.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Upload, Download, Eye, Trash2, Link2,
  AlertTriangle, Clock, CheckCircle, Filter, Search,
  FolderOpen, Image, File, Plus, X, Calendar, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Document {
  id: string;
  nom: string;
  description: string | null;
  fichier_url: string;
  fichier_nom: string | null;
  fichier_taille: number | null;
  date_document: string | null;
  date_expiration: string | null;
  numero_document: string | null;
  type_code: string | null;
  type_libelle: string | null;
  categorie: string | null;
  statut_expiration: 'valide' | 'expire_bientot' | 'expire';
  jours_avant_expiration: number | null;
  version: number;
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
  entiteType: 'ascenseur' | 'intervention' | 'travaux' | 'mes' | 'client';
  entiteId: string;
  entiteNom?: string;
  readOnly?: boolean;
}

const CATEGORIE_ICONS: Record<string, React.ElementType> = {
  reglementaire: FileText,
  technique: File,
  administratif: FolderOpen,
  photo: Image,
};

const EXPIRATION_COLORS = {
  valide: 'text-green-600 bg-green-50',
  expire_bientot: 'text-orange-600 bg-orange-50',
  expire: 'text-red-600 bg-red-50',
};

export function DocumentsLies({ entiteType, entiteId, entiteNom, readOnly = false }: DocumentsLiesProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [typesDocument, setTypesDocument] = useState<TypeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Charger les types de documents
  useEffect(() => {
    async function loadTypes() {
      const { data } = await supabase
        .from('ged_types_documents')
        .select('*')
        .eq('actif', true)
        .order('ordre_affichage');
      if (data) setTypesDocument(data);
    }
    loadTypes();
  }, []);

  // Charger les documents
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('v_documents_ascenseur')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrer selon le type d'entité
      if (entiteType === 'ascenseur') {
        query = query.eq('ascenseur_id', entiteId);
      }
      // Pour les autres types, on utilise une requête différente
      // TODO: Adapter selon les vues disponibles

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    } finally {
      setLoading(false);
    }
  }, [entiteType, entiteId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Upload de fichier
  const handleUpload = async (file: File, typeId: string, metadata: any) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Upload vers Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${entiteType}/${entiteId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Créer l'entrée en base
      const documentData: any = {
        nom: metadata.nom || file.name,
        description: metadata.description,
        type_document_id: typeId || null,
        fichier_url: publicUrl,
        fichier_nom: file.name,
        fichier_taille: file.size,
        fichier_mime: file.type,
        date_document: metadata.date_document,
        date_expiration: metadata.date_expiration,
        numero_document: metadata.numero_document,
        cree_par: user.id,
      };

      // Ajouter la liaison selon le type d'entité
      if (entiteType === 'ascenseur') {
        documentData.ascenseur_ids = [entiteId];
      } else if (entiteType === 'travaux') {
        documentData.travaux_id = entiteId;
      } else if (entiteType === 'mes') {
        documentData.mise_en_service_id = entiteId;
      }

      const { error: dbError } = await supabase
        .from('ged_documents')
        .insert(documentData);

      if (dbError) throw dbError;

      setShowUploadModal(false);
      loadDocuments();
    } catch (err: any) {
      console.error('Erreur upload:', err);
      alert('Erreur: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Supprimer un document
  const handleDelete = async (docId: string) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      const { error } = await supabase
        .from('ged_documents')
        .update({ statut: 'supprime' })
        .eq('id', docId);

      if (error) throw error;
      loadDocuments();
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  // Filtrage
  const documentsFiltres = documents.filter(doc => {
    if (filtreCategorie && doc.categorie !== filtreCategorie) return false;
    if (search) {
      const s = search.toLowerCase();
      return doc.nom.toLowerCase().includes(s) ||
             doc.type_libelle?.toLowerCase().includes(s) ||
             doc.numero_document?.toLowerCase().includes(s);
    }
    return true;
  });

  // Grouper par catégorie
  const documentsParCategorie = documentsFiltres.reduce((acc, doc) => {
    const cat = doc.categorie || 'autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // Stats
  const stats = {
    total: documents.length,
    expires: documents.filter(d => d.statut_expiration === 'expire').length,
    expireBientot: documents.filter(d => d.statut_expiration === 'expire_bientot').length,
  };

  const categories = [...new Set(documents.map(d => d.categorie).filter(Boolean))];

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              Documents
              {entiteNom && <span className="text-gray-400 font-normal">- {entiteNom}</span>}
            </h3>
            <p className="text-sm text-gray-500">
              {stats.total} document{stats.total > 1 ? 's' : ''}
              {stats.expires > 0 && (
                <span className="text-red-600 ml-2">• {stats.expires} expiré{stats.expires > 1 ? 's' : ''}</span>
              )}
              {stats.expireBientot > 0 && (
                <span className="text-orange-600 ml-2">• {stats.expireBientot} expire bientôt</span>
              )}
            </p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
          <select
            value={filtreCategorie || ''}
            onChange={(e) => setFiltreCategorie(e.target.value || null)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">Toutes catégories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste documents */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : documentsFiltres.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-2" />
            <p>Aucun document</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(documentsParCategorie).map(([categorie, docs]) => {
              const CatIcon = CATEGORIE_ICONS[categorie] || File;
              return (
                <div key={categorie}>
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <CatIcon className="w-4 h-4" />
                    {categorie} ({docs.length})
                  </h4>
                  <div className="space-y-2">
                    {docs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {/* Icône type */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          doc.categorie === 'photo' ? 'bg-[#FEE2E2]' : 'bg-blue-100'
                        }`}>
                          {doc.categorie === 'photo' ? (
                            <Image className="w-5 h-5 text-[#B91C1C]" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-600" />
                          )}
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{doc.nom}</p>
                            {doc.version > 1 && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded">v{doc.version}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {doc.type_libelle && <span>{doc.type_libelle}</span>}
                            {doc.numero_document && <span>#{doc.numero_document}</span>}
                            <span>{formatFileSize(doc.fichier_taille)}</span>
                          </div>
                        </div>

                        {/* Expiration */}
                        {doc.date_expiration && (
                          <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${EXPIRATION_COLORS[doc.statut_expiration]}`}>
                            {doc.statut_expiration === 'expire' ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : doc.statut_expiration === 'expire_bientot' ? (
                              <Clock className="w-3 h-3" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {doc.statut_expiration === 'expire' 
                              ? 'Expiré' 
                              : doc.statut_expiration === 'expire_bientot'
                                ? `${doc.jours_avant_expiration}j`
                                : formatDate(doc.date_expiration)
                            }
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <a
                            href={doc.fichier_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                            title="Voir"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <a
                            href={doc.fichier_url}
                            download={doc.fichier_nom}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {!readOnly && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Upload */}
      {showUploadModal && (
        <UploadDocumentModal
          typesDocument={typesDocument}
          onUpload={handleUpload}
          onClose={() => setShowUploadModal(false)}
          uploading={uploading}
        />
      )}
    </div>
  );
}

// Modal d'upload
function UploadDocumentModal({
  typesDocument,
  onUpload,
  onClose,
  uploading,
}: {
  typesDocument: TypeDocument[];
  onUpload: (file: File, typeId: string, metadata: any) => void;
  onClose: () => void;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [dateDocument, setDateDocument] = useState('');
  const [dateExpiration, setDateExpiration] = useState('');
  const [numeroDocument, setNumeroDocument] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!nom) setNom(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    onUpload(file, typeId, {
      nom,
      description,
      date_document: dateDocument || null,
      date_expiration: dateExpiration || null,
      numero_document: numeroDocument || null,
    });
  };

  // Grouper types par catégorie
  const typesParCategorie = typesDocument.reduce((acc, t) => {
    if (!acc[t.categorie]) acc[t.categorie] = [];
    acc[t.categorie].push(t);
    return acc;
  }, {} as Record<string, TypeDocument[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Ajouter un document</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Zone de drop */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Cliquer pour sélectionner</p>
                <p className="text-sm text-gray-400">ou glisser-déposer</p>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Type de document */}
          <div>
            <label className="block text-sm font-medium mb-1">Type de document</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Sélectionner --</option>
              {Object.entries(typesParCategorie).map(([cat, types]) => (
                <optgroup key={cat} label={cat.toUpperCase()}>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.libelle} {t.obligatoire && '*'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium mb-1">Nom du document *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: Certificat de conformité 2026"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
            />
          </div>

          {/* Dates et numéro */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date document</label>
              <input
                type="date"
                value={dateDocument}
                onChange={(e) => setDateDocument(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date expiration</label>
              <input
                type="date"
                value={dateExpiration}
                onChange={(e) => setDateExpiration(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">N° de référence</label>
            <input
              type="text"
              value={numeroDocument}
              onChange={(e) => setNumeroDocument(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: CT-2026-0456"
            />
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !nom || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
