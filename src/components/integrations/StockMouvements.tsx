// src/components/integrations/StockMouvements.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCw, ArrowRightLeft,
  Search, Filter, Calendar, Package, Truck, User, FileText,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, formatDistanceToNow, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Mouvement {
  id: string;
  article_id: string;
  reference: string;
  designation: string;
  type_mouvement: string;
  type_libelle: string;
  type_color: string;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  motif?: string;
  reference_doc?: string;
  vehicule_id?: string;
  vehicule_immat?: string;
  emplacement: string;
  technicien_id?: string;
  technicien_nom?: string;
  created_at: string;
}

interface StockMouvementsProps {
  vehiculeId?: string;    // Filtrer par véhicule
  articleId?: string;     // Filtrer par article
  limit?: number;         // Nombre de mouvements à afficher
  compact?: boolean;      // Mode compact
  showFilters?: boolean;  // Afficher les filtres
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  entree: { icon: ArrowUpCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
  sortie: { icon: ArrowDownCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  inventaire: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  transfert_in: { icon: ArrowRightLeft, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  transfert_out: { icon: ArrowRightLeft, color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

export function StockMouvements({
  vehiculeId,
  articleId,
  limit = 50,
  compact = false,
  showFilters = true,
}: StockMouvementsProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriode, setFilterPeriode] = useState<string>('7');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Charger les mouvements
  const { data: mouvements, isLoading } = useQuery({
    queryKey: ['stock-mouvements', vehiculeId, articleId, filterPeriode],
    queryFn: async () => {
      let query = supabase
        .from('v_stock_mouvements_detail')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filtres
      if (vehiculeId) {
        query = query.eq('vehicule_id', vehiculeId);
      }
      if (articleId) {
        query = query.eq('article_id', articleId);
      }
      if (filterPeriode !== 'all') {
        const dateLimit = subDays(new Date(), parseInt(filterPeriode));
        query = query.gte('created_at', dateLimit.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Mouvement[];
    },
  });

  // Filtrage local
  const filteredMouvements = mouvements?.filter(m => {
    if (filterType !== 'all' && m.type_mouvement !== filterType) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (!m.reference?.toLowerCase().includes(searchLower) &&
          !m.designation?.toLowerCase().includes(searchLower) &&
          !m.motif?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  }) || [];

  // Stats
  const stats = {
    entrees: mouvements?.filter(m => m.type_mouvement === 'entree').reduce((sum, m) => sum + m.quantite, 0) || 0,
    sorties: mouvements?.filter(m => m.type_mouvement === 'sortie').reduce((sum, m) => sum + m.quantite, 0) || 0,
    transferts: mouvements?.filter(m => m.type_mouvement.startsWith('transfert')).length || 0,
  };

  // Mode compact (widget)
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <Clock className="w-4 h-4" />
          Derniers mouvements
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-4 text-[var(--text-muted)] text-sm">Chargement...</div>
          ) : filteredMouvements.slice(0, 5).map(m => {
            const config = TYPE_CONFIG[m.type_mouvement] || TYPE_CONFIG.entree;
            const Icon = config.icon;
            return (
              <div key={m.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="font-mono text-purple-400">{m.reference}</span>
                <span className={`font-medium ${m.type_mouvement === 'sortie' ? 'text-red-400' : 'text-green-400'}`}>
                  {m.type_mouvement === 'sortie' ? '-' : '+'}{m.quantite}
                </span>
                <span className="text-[var(--text-muted)] truncate flex-1">{m.emplacement}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {formatDistanceToNow(parseISO(m.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            );
          })}
          {filteredMouvements.length === 0 && (
            <div className="text-center py-4 text-[var(--text-muted)] text-sm">Aucun mouvement</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Mouvements de stock</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {filteredMouvements.length} mouvement(s) sur la période
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-green-400 font-bold">+{stats.entrees}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Entrées</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 font-bold">-{stats.sorties}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Sorties</div>
          </div>
          <div className="text-center">
            <div className="text-purple-400 font-bold">{stats.transferts}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Transferts</div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher référence, motif..."
              className="pl-10"
            />
          </div>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-36">
            <option value="all">Tous types</option>
            <option value="entree">Entrées</option>
            <option value="sortie">Sorties</option>
            <option value="inventaire">Inventaires</option>
            <option value="transfert_in">Transferts +</option>
            <option value="transfert_out">Transferts -</option>
          </Select>
          <Select value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)} className="w-36">
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">3 mois</option>
            <option value="all">Tout</option>
          </Select>
        </div>
      )}

      {/* Liste des mouvements */}
      {isLoading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>
      ) : filteredMouvements.length === 0 ? (
        <Card className="p-8 text-center">
          <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-[var(--text-tertiary)]">Aucun mouvement sur cette période</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-[var(--border-primary)]">
            {filteredMouvements.map(mouvement => {
              const config = TYPE_CONFIG[mouvement.type_mouvement] || TYPE_CONFIG.entree;
              const Icon = config.icon;
              const isExpanded = expanded === mouvement.id;

              return (
                <div key={mouvement.id} className="hover:bg-[var(--bg-tertiary)]/30">
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : mouvement.id)}
                  >
                    {/* Icône type */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Infos article */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-purple-400">{mouvement.reference}</span>
                        <Badge variant={mouvement.type_color as any}>{mouvement.type_libelle}</Badge>
                      </div>
                      <p className="text-sm text-[var(--text-tertiary)] truncate">{mouvement.designation}</p>
                    </div>

                    {/* Quantité */}
                    <div className="text-center">
                      <div className={`text-lg font-bold ${
                        mouvement.type_mouvement === 'sortie' || mouvement.type_mouvement === 'transfert_out'
                          ? 'text-red-400'
                          : 'text-green-400'
                      }`}>
                        {mouvement.type_mouvement === 'sortie' || mouvement.type_mouvement === 'transfert_out' ? '-' : '+'}
                        {mouvement.quantite}
                      </div>
                      {mouvement.quantite_avant !== null && mouvement.quantite_apres !== null && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {mouvement.quantite_avant} → {mouvement.quantite_apres}
                        </div>
                      )}
                    </div>

                    {/* Emplacement */}
                    <div className="text-right min-w-[100px]">
                      <div className="flex items-center gap-1 justify-end text-sm">
                        {mouvement.vehicule_id ? (
                          <Truck className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Package className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-[var(--text-primary)]">{mouvement.emplacement}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {format(parseISO(mouvement.created_at), 'dd/MM HH:mm', { locale: fr })}
                      </div>
                    </div>

                    {/* Expand */}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>

                  {/* Détails expandés */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg space-y-2 text-sm">
                        {mouvement.motif && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />
                            <div>
                              <span className="text-[var(--text-muted)]">Motif:</span>
                              <span className="ml-2 text-[var(--text-primary)]">{mouvement.motif}</span>
                            </div>
                          </div>
                        )}
                        {mouvement.reference_doc && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)]">Référence:</span>
                            <span className="text-purple-400 font-mono">{mouvement.reference_doc}</span>
                          </div>
                        )}
                        {mouvement.technicien_nom && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)]">Par:</span>
                            <span className="text-[var(--text-primary)]">{mouvement.technicien_nom}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-[var(--text-muted)]">Date:</span>
                          <span className="text-[var(--text-primary)]">
                            {format(parseISO(mouvement.created_at), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// Export widget compact pour intégration rapide
export function StockMouvementsWidget({ vehiculeId, articleId }: { vehiculeId?: string; articleId?: string }) {
  return (
    <StockMouvements
      vehiculeId={vehiculeId}
      articleId={articleId}
      limit={5}
      compact={true}
      showFilters={false}
    />
  );
}
