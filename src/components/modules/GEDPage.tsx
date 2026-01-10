import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, File, FileText, Image, FileSpreadsheet, Search, Upload, Grid, List, Filter } from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { getDocuments } from '@/services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDocument } from '@/types';

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

export function GEDPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDossier, setFilterDossier] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: documents } = useQuery({ queryKey: ['documents'], queryFn: getDocuments });

  const dossiers = [...new Set(documents?.map(d => d.dossier).filter(Boolean))] as string[];

  const filtered = documents?.filter(d => {
    const matchSearch = d.nom.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || d.type_document === filterType;
    const matchDossier = filterDossier === 'all' || d.dossier === filterDossier;
    return matchSearch && matchType && matchDossier;
  }) || [];

  const stats = {
    total: documents?.length || 0,
    contrats: documents?.filter(d => d.type_document === 'contrat').length || 0,
    rapports: documents?.filter(d => d.type_document === 'rapport').length || 0,
    photos: documents?.filter(d => d.type_document === 'photo').length || 0,
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Documents</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-blue-400">{stats.contrats}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Contrats</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-green-400">{stats.rapports}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Rapports</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Image className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">{stats.photos}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Photos</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
          </div>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-40">
            <option value="all">Tous les types</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select value={filterDossier} onChange={e => setFilterDossier(e.target.value)} className="w-40">
            <option value="all">Tous les dossiers</option>
            {dossiers.map(d => <option key={d} value={d}>{d}</option>)}
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
          <Button variant="primary"><Upload className="w-4 h-4" /> Importer</Button>
        </div>
      </div>

      {/* Liste en grille */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(doc => {
            const config = TYPE_CONFIG[doc.type_document];
            const Icon = config.icon;
            return (
              <Card key={doc.id} className="hover:border-indigo-500/50 transition-colors cursor-pointer">
                <CardBody className="text-center">
                  <div className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${config.color}20` }}>
                    <Icon className="w-8 h-8" style={{ color: config.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">{doc.nom}</h3>
                  <p className="text-xs text-[var(--text-muted)] mb-3">{formatFileSize(doc.fichier_taille)}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="purple">{config.label}</Badge>
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
              const Icon = config.icon;
              return (
                <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-[var(--bg-tertiary)]/30 cursor-pointer">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${config.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{doc.nom}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{doc.dossier}</p>
                  </div>
                  <Badge variant="purple">{config.label}</Badge>
                  <span className="text-xs text-[var(--text-muted)] w-20 text-right">{formatFileSize(doc.fichier_taille)}</span>
                  <span className="text-xs text-[var(--text-muted)] w-24 text-right">
                    {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card><CardBody className="text-center py-12 text-[var(--text-muted)]">Aucun document trouvé</CardBody></Card>
      )}
    </div>
  );
}
