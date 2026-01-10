import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Archive, Search, Filter, RotateCcw, Trash2, Eye, Calendar,
  Hammer, FileCheck, HelpCircle, ChevronRight, X, AlertTriangle,
  Clock, User, FileText, ShoppingCart
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { 
  getArchives, unarchiveTravaux, unarchiveMiseEnService, 
  unarchiveDemande, unarchiveCommande, getArchiveStats 
} from '@/services/api';
import { supabase } from '@/services/supabase';
import type { ArchiveItem } from '@/services/api';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Configuration des types d'archives
const TYPE_CONFIG: Record<string, { 
  label: string; 
  icon: any; 
  color: string;
  bgColor: string;
}> = {
  travaux: { 
    label: 'Travaux', 
    icon: Hammer, 
    color: '#a855f7',
    bgColor: 'bg-purple-500/20'
  },
  mise_en_service: { 
    label: 'Mise en service', 
    icon: FileCheck, 
    color: '#f97316',
    bgColor: 'bg-orange-500/20'
  },
  demande: { 
    label: 'Demande', 
    icon: HelpCircle, 
    color: '#ec4899',
    bgColor: 'bg-pink-500/20'
  },
  commande: { 
    label: 'Commande', 
    icon: ShoppingCart, 
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/20'
  },
};

// Modal de confirmation de restauration
function RestoreModal({ 
  item, 
  onClose, 
  onConfirm,
  isLoading
}: { 
  item: ArchiveItem;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Restaurer depuis les archives
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {config.label} • {item.code}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] mb-4">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2">{item.libelle}</h4>
            <div className="space-y-1 text-sm text-[var(--text-secondary)]">
              <p>Archivé {formatDistanceToNow(parseISO(item.archive_date), { addSuffix: true, locale: fr })}</p>
              {item.archive_par_nom && (
                <p>Par {item.archive_par_nom}</p>
              )}
              {item.archive_raison && (
                <p className="italic">"{item.archive_raison}"</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)]">
              Cet élément sera restauré et redeviendra visible dans la liste principale.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              onClick={onConfirm}
              disabled={isLoading}
            >
              <RotateCcw className="w-4 h-4" />
              {isLoading ? 'Restauration...' : 'Restaurer'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Modal de détails
function DetailsModal({ 
  item, 
  onClose 
}: { 
  item: ArchiveItem;
  onClose: () => void;
}) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[500px]">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                <Icon className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{item.code}</h3>
                <Badge 
                  variant="gray" 
                  className="mt-1"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  {config.label}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Libellé</label>
              <p className="text-[var(--text-primary)] mt-1">{item.libelle}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Statut final</label>
                <p className="text-[var(--text-primary)] mt-1 capitalize">{item.statut?.replace('_', ' ') || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Créé le</label>
                <p className="text-[var(--text-primary)] mt-1">
                  {format(parseISO(item.created_at), 'dd/MM/yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            {item.date_cloture && (
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Clôturé le</label>
                <p className="text-[var(--text-primary)] mt-1">
                  {format(parseISO(item.date_cloture), 'dd/MM/yyyy', { locale: fr })}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-[var(--border-secondary)]">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase">Archivage</label>
              <div className="mt-2 p-3 rounded-lg bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <Archive className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>
                    {format(parseISO(item.archive_date), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
                {item.archive_par_nom && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mt-1">
                    <User className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <span>Par {item.archive_par_nom}</span>
                  </div>
                )}
                {item.archive_raison && (
                  <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)] mt-2">
                    <FileText className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                    <span className="italic">"{item.archive_raison}"</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border-secondary)]">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Composant ligne d'archive
function ArchiveRow({ 
  item, 
  onRestore, 
  onViewDetails 
}: { 
  item: ArchiveItem;
  onRestore: () => void;
  onViewDetails: () => void;
}) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] hover:border-[var(--border-primary)] transition-all group">
      {/* Icône type */}
      <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" style={{ color: config.color }} />
      </div>

      {/* Infos principales */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[var(--text-primary)]">{item.code}</span>
          <Badge 
            variant="gray" 
            className="text-[10px]"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)] truncate">{item.libelle}</p>
      </div>

      {/* Date d'archivage */}
      <div className="text-right flex-shrink-0 hidden md:block">
        <div className="text-sm text-[var(--text-primary)]">
          {format(parseISO(item.archive_date), 'dd/MM/yyyy', { locale: fr })}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {formatDistanceToNow(parseISO(item.archive_date), { addSuffix: true, locale: fr })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onViewDetails}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Voir les détails"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={onRestore}
          className="p-2 rounded-lg hover:bg-green-500/20 text-[var(--text-tertiary)] hover:text-green-400"
          title="Restaurer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Page principale Archives
export function ArchivesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [restoreItem, setRestoreItem] = useState<ArchiveItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<ArchiveItem | null>(null);

  // Query archives
  const { data: archives, isLoading } = useQuery({
    queryKey: ['archives'],
    queryFn: () => getArchives(),
  });

  // Query stats
  const { data: stats } = useQuery({
    queryKey: ['archive-stats'],
    queryFn: () => getArchiveStats(),
  });

  // Mutations de restauration
  const restoreMutation = useMutation({
    mutationFn: async (item: ArchiveItem) => {
      switch (item.type) {
        case 'travaux':
          return unarchiveTravaux(item.id);
        case 'mise_en_service':
          return unarchiveMiseEnService(item.id);
        case 'demande':
          return unarchiveDemande(item.id);
        case 'commande':
          return unarchiveCommande(item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      queryClient.invalidateQueries({ queryKey: ['archive-stats'] });
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Élément restauré avec succès');
      setRestoreItem(null);
    },
    onError: () => {
      toast.error('Erreur lors de la restauration');
    },
  });

  // Filtrage
  const filteredArchives = useMemo(() => {
    if (!archives) return [];
    
    return archives.filter(item => {
      // Filtre recherche
      if (search) {
        const searchLower = search.toLowerCase();
        if (!item.code.toLowerCase().includes(searchLower) && 
            !item.libelle.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Filtre type
      if (filterType !== 'all' && item.type !== filterType) {
        return false;
      }
      
      return true;
    });
  }, [archives, search, filterType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Archive className="w-7 h-7 text-[var(--accent-primary)]" />
            Archives
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Éléments archivés : travaux, mises en service et demandes
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/20 flex items-center justify-center">
              <Archive className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats?.total || 0}</div>
              <div className="text-sm text-[var(--text-secondary)]">Total archivés</div>
            </div>
          </CardBody>
        </Card>

        {Object.entries(TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          const count = stats?.[type as keyof typeof stats] || 0;
          return (
            <Card key={type}>
              <CardBody className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" style={{ color: config.color }} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[var(--text-primary)]">{count}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{config.label}</div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par code ou libellé..."
                className="pl-10"
              />
            </div>

            {/* Filtre type */}
            <Select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-48"
            >
              <option value="all">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>{config.label}</option>
              ))}
            </Select>

            {/* Compteur résultats */}
            <div className="text-sm text-[var(--text-tertiary)]">
              {filteredArchives.length} résultat{filteredArchives.length > 1 ? 's' : ''}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Liste des archives */}
      {isLoading ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Chargement des archives...</p>
          </CardBody>
        </Card>
      ) : filteredArchives.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Archive className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {search || filterType !== 'all' ? 'Aucun résultat' : 'Aucune archive'}
            </h3>
            <p className="text-[var(--text-secondary)]">
              {search || filterType !== 'all' 
                ? 'Essayez de modifier vos filtres de recherche'
                : 'Les éléments archivés apparaîtront ici'
              }
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredArchives.map(item => (
            <ArchiveRow
              key={`${item.type}-${item.id}`}
              item={item}
              onRestore={() => setRestoreItem(item)}
              onViewDetails={() => setDetailsItem(item)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {restoreItem && (
        <RestoreModal
          item={restoreItem}
          onClose={() => setRestoreItem(null)}
          onConfirm={() => restoreMutation.mutate(restoreItem)}
          isLoading={restoreMutation.isPending}
        />
      )}

      {detailsItem && (
        <DetailsModal
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANT MODAL D'ARCHIVAGE (réutilisable)
// ============================================
export function ArchiveModal({ 
  type,
  code,
  libelle,
  onClose, 
  onConfirm,
  isLoading
}: { 
  type: 'travaux' | 'mise_en_service' | 'demande' | 'commande';
  code: string;
  libelle: string;
  onClose: () => void;
  onConfirm: (raison: string) => void;
  isLoading: boolean;
}) {
  const [raison, setRaison] = useState('');
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[450px]">
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Archiver cet élément
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {config.label} • {code}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] mb-4">
            <p className="text-sm text-[var(--text-primary)]">{libelle}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Raison de l'archivage (optionnel)
            </label>
            <textarea
              value={raison}
              onChange={e => setRaison(e.target.value)}
              placeholder="Ex: Travaux terminé et facturé..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)]">
              Cet élément sera déplacé dans les archives et ne sera plus visible dans la liste principale. 
              Vous pourrez le restaurer à tout moment.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              onClick={() => onConfirm(raison)}
              disabled={isLoading}
            >
              <Archive className="w-4 h-4" />
              {isLoading ? 'Archivage...' : 'Archiver'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
