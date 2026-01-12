import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Filter, Calendar, Tag, Clock, ChevronDown, ChevronUp,
  Pin, Share2, CheckSquare, AlertTriangle, Sparkles, History, Building2,
  SlidersHorizontal, RotateCcw
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { 
  searchNotes, 
  getSearchSuggestions, 
  saveRecentSearch, 
  getRecentSearches,
  clearRecentSearches,
  getNotesStats,
  type SearchFilters, 
  type SearchResult, 
  type SearchSuggestion 
} from '@/services/noteSearchService';
import { getAscenseurs } from '@/services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

interface AdvancedSearchProps {
  onSearch: (results: SearchResult[]) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
  isSearching?: boolean;
}

export function AdvancedNoteSearch({ onSearch, onFiltersChange, isSearching }: AdvancedSearchProps) {
  // États de base
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filtres avancés
  const [filters, setFilters] = useState<SearchFilters>({
    searchIn: ['titre', 'contenu', 'tags', 'checklist'],
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['notes-stats', CURRENT_USER_ID],
    queryFn: () => getNotesStats(CURRENT_USER_ID),
  });

  // Ascenseurs pour le filtre
  const { data: ascenseurs } = useQuery({
    queryKey: ['ascenseurs'],
    queryFn: getAscenseurs,
  });

  // Recherches récentes
  const [recentSearches] = useState(() => getRecentSearches());

  // Charger les suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      if (query.length >= 2) {
        const results = await getSearchSuggestions(query, CURRENT_USER_ID);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(loadSuggestions, 200);
    return () => clearTimeout(debounce);
  }, [query]);

  // Fermer les suggestions en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effectuer la recherche
  const doSearch = async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    
    if (q) {
      saveRecentSearch(q);
    }

    const searchFilters: SearchFilters = {
      ...filters,
      query: q,
    };

    const results = await searchNotes(CURRENT_USER_ID, searchFilters);
    onSearch(results);
    onFiltersChange?.(searchFilters);
    setShowSuggestions(false);
  };

  // Réinitialiser les filtres
  const resetFilters = () => {
    setQuery('');
    setFilters({
      searchIn: ['titre', 'contenu', 'tags', 'checklist'],
    });
    doSearch('');
  };

  // Nombre de filtres actifs
  const activeFiltersCount = [
    filters.categorie && filters.categorie !== 'all',
    filters.priorite && filters.priorite !== 'all',
    filters.statut && filters.statut !== 'all',
    filters.ascenseurId,
    filters.dateFrom,
    filters.dateTo,
    filters.hasEcheance,
    filters.echeanceDepassee,
    filters.echeanceProche,
    filters.hasChecklist,
    filters.hasTags,
    filters.tags && filters.tags.length > 0,
    filters.epingle,
    filters.partage,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Barre de recherche principale */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                doSearch();
              }
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Rechercher dans les notes..."
            className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); doSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-elevated)] rounded"
            >
              <X className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg z-50 overflow-hidden"
            >
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase px-2 mb-1">Suggestions</div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(s.value);
                        doSearch(s.value);
                      }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-left text-sm"
                    >
                      {s.type === 'note' && <Search className="w-3 h-3 text-purple-400" />}
                      {s.type === 'tag' && <Tag className="w-3 h-3 text-blue-400" />}
                      {s.type === 'recent' && <History className="w-3 h-3 text-gray-400" />}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggestions.length === 0 && recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Recherches récentes</span>
                    <button
                      onClick={() => { clearRecentSearches(); setShowSuggestions(false); }}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Effacer
                    </button>
                  </div>
                  {recentSearches.slice(0, 5).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(s);
                        doSearch(s);
                      }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-left text-sm"
                    >
                      <History className="w-3 h-3 text-gray-400" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Button variant="primary" onClick={() => doSearch()} disabled={isSearching}>
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant={showAdvanced ? 'primary' : 'secondary'}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <Badge variant="purple" className="ml-1 text-[10px]">{activeFiltersCount}</Badge>
          )}
        </Button>
      </div>

      {/* Stats rapides */}
      {stats && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setFilters({ ...filters, echeanceDepassee: !filters.echeanceDepassee, echeanceProche: false });
              setTimeout(() => doSearch(), 0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              filters.echeanceDepassee 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {stats.echeancesDepassees} en retard
          </button>
          <button
            onClick={() => {
              setFilters({ ...filters, echeanceProche: !filters.echeanceProche, echeanceDepassee: false });
              setTimeout(() => doSearch(), 0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              filters.echeanceProche 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Clock className="w-3 h-3" />
            {stats.echeancesProches} cette semaine
          </button>
          <button
            onClick={() => {
              setFilters({ ...filters, epingle: filters.epingle ? undefined : true });
              setTimeout(() => doSearch(), 0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              filters.epingle 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Pin className="w-3 h-3" />
            Épinglées
          </button>
          <button
            onClick={() => {
              setFilters({ ...filters, hasChecklist: !filters.hasChecklist });
              setTimeout(() => doSearch(), 0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              filters.hasChecklist 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <CheckSquare className="w-3 h-3" />
            Avec checklist
          </button>
          <button
            onClick={() => {
              setFilters({ ...filters, partage: filters.partage ? undefined : true });
              setTimeout(() => doSearch(), 0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              filters.partage 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Share2 className="w-3 h-3" />
            Partagées
          </button>
        </div>
      )}

      {/* Filtres avancés */}
      {showAdvanced && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-400" />
                Filtres avancés
              </h3>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="w-3 h-3 mr-1" />
                Réinitialiser
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {/* Catégorie */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Catégorie</label>
                <Select
                  value={filters.categorie || 'all'}
                  onChange={e => setFilters({ ...filters, categorie: e.target.value })}
                  className="w-full"
                >
                  <option value="all">Toutes</option>
                  <option value="perso">Personnel</option>
                  <option value="technique">Technique</option>
                  <option value="client">Client</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              {/* Priorité */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Priorité</label>
                <Select
                  value={filters.priorite || 'all'}
                  onChange={e => setFilters({ ...filters, priorite: e.target.value })}
                  className="w-full"
                >
                  <option value="all">Toutes</option>
                  <option value="urgente">Urgente</option>
                  <option value="haute">Haute</option>
                  <option value="normale">Normale</option>
                  <option value="basse">Basse</option>
                </Select>
              </div>

              {/* Statut */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Statut</label>
                <Select
                  value={filters.statut || 'all'}
                  onChange={e => setFilters({ ...filters, statut: e.target.value })}
                  className="w-full"
                >
                  <option value="all">Tous</option>
                  <option value="active">Active</option>
                  <option value="en_cours">En cours</option>
                  <option value="terminee">Terminée</option>
                  <option value="archivee">Archivée</option>
                </Select>
              </div>

              {/* Ascenseur */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Ascenseur</label>
                <Select
                  value={filters.ascenseurId || ''}
                  onChange={e => setFilters({ ...filters, ascenseurId: e.target.value || undefined })}
                  className="w-full"
                >
                  <option value="">Tous</option>
                  {ascenseurs?.slice(0, 50).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.code_appareil} - {a.ville}</option>
                  ))}
                </Select>
              </div>

              {/* Date de */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Date de</label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={e => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                />
              </div>

              {/* Date à */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Date à</label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={e => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                />
              </div>

              {/* Rechercher dans */}
              <div className="col-span-2">
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Rechercher dans</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'titre', label: 'Titre' },
                    { key: 'contenu', label: 'Contenu' },
                    { key: 'tags', label: 'Tags' },
                    { key: 'checklist', label: 'Checklist' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        const current = filters.searchIn || [];
                        const newSearchIn = current.includes(opt.key as any)
                          ? current.filter(s => s !== opt.key)
                          : [...current, opt.key as any];
                        setFilters({ ...filters, searchIn: newSearchIn });
                      }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        (filters.searchIn || []).includes(opt.key as any)
                          ? 'bg-purple-500 text-white'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags populaires */}
            {stats && stats.tagsPopulaires.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                <label className="text-xs text-[var(--text-muted)] mb-2 block">Tags populaires</label>
                <div className="flex gap-1 flex-wrap">
                  {stats.tagsPopulaires.slice(0, 10).map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => {
                        const currentTags = filters.tags || [];
                        const newTags = currentTags.includes(tag)
                          ? currentTags.filter(t => t !== tag)
                          : [...currentTags, tag];
                        setFilters({ ...filters, tags: newTags.length > 0 ? newTags : undefined });
                      }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        (filters.tags || []).includes(tag)
                          ? 'bg-blue-500 text-white'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      #{tag}
                      <span className="ml-1 opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bouton appliquer */}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAdvanced(false)}>
                Fermer
              </Button>
              <Button variant="primary" onClick={() => doSearch()}>
                <Sparkles className="w-4 h-4 mr-1" />
                Appliquer les filtres
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Résumé des filtres actifs */}
      {activeFiltersCount > 0 && !showAdvanced && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">Filtres actifs:</span>
          {filters.categorie && filters.categorie !== 'all' && (
            <Badge variant="purple" className="text-[10px]">
              {filters.categorie}
              <button onClick={() => setFilters({ ...filters, categorie: undefined })} className="ml-1">×</button>
            </Badge>
          )}
          {filters.priorite && filters.priorite !== 'all' && (
            <Badge variant="orange" className="text-[10px]">
              {filters.priorite}
              <button onClick={() => setFilters({ ...filters, priorite: undefined })} className="ml-1">×</button>
            </Badge>
          )}
          {filters.echeanceDepassee && (
            <Badge variant="red" className="text-[10px]">
              En retard
              <button onClick={() => setFilters({ ...filters, echeanceDepassee: undefined })} className="ml-1">×</button>
            </Badge>
          )}
          {filters.echeanceProche && (
            <Badge variant="orange" className="text-[10px]">
              Cette semaine
              <button onClick={() => setFilters({ ...filters, echeanceProche: undefined })} className="ml-1">×</button>
            </Badge>
          )}
          {(filters.tags || []).map(tag => (
            <Badge key={tag} variant="blue" className="text-[10px]">
              #{tag}
              <button onClick={() => setFilters({ ...filters, tags: filters.tags?.filter(t => t !== tag) })} className="ml-1">×</button>
            </Badge>
          ))}
          <button
            onClick={resetFilters}
            className="text-xs text-red-400 hover:underline"
          >
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );
}

export default AdvancedNoteSearch;
