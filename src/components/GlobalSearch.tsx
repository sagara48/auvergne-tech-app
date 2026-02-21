import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Building2, Hammer, Package, User, Route, Car, FileCheck,
  Calendar, MessageCircle, Clock, ChevronRight, Command, CornerDownLeft,
  ArrowUp, ArrowDown, StickyNote, FolderOpen, QrCode,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/services/supabase';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'ascenseur' | 'travaux' | 'stock' | 'technicien' | 'tournee' | 'vehicule' | 'mes' | 'commande' | 'module';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';
  module: string;
  icon: any;
  color: string;
}

const MODULE_SHORTCUTS = [
  { id: 'dashboard', name: 'Dashboard', icon: Calendar, color: '#3b82f6', keys: '1' },
  { id: 'planning', name: 'Planning', icon: Calendar, color: '#3b82f6', keys: '2' },
  { id: 'travaux', name: 'Travaux', icon: Hammer, color: '#B91C1C', keys: '3' },
  { id: 'ascenseurs', name: 'Parc Ascenseurs', icon: Building2, color: '#06b6d4', keys: '4' },
  { id: 'stock', name: 'Stock', icon: Package, color: '#f59e0b', keys: '5' },
  { id: 'chat', name: 'Messages', icon: MessageCircle, color: '#B91C1C', keys: '6' },
  { id: 'vehicules', name: 'Véhicules', icon: Car, color: '#22c55e', keys: '7' },
  { id: 'tournees', name: 'Tournées', icon: Route, color: '#84cc16', keys: '8' },
  { id: 'heures', name: "Feuilles d'heures", icon: Clock, color: '#14b8a6', keys: '9' },
];

export function GlobalSearch() {
  const { setModuleActif } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Fetch data for search
  const { data: ascenseurs } = useQuery({
    queryKey: ['search-ascenseurs'],
    queryFn: async () => {
      const { data } = await supabase.from('parc_ascenseurs').select('id, code_appareil, adresse, ville, statut').limit(500);
      return data || [];
    },
    enabled: open,
    staleTime: 60000,
  });

  const { data: travaux } = useQuery({
    queryKey: ['search-travaux'],
    queryFn: async () => {
      const { data } = await supabase.from('travaux').select('id, code, titre, statut, type').eq('archive', false).limit(200);
      return data || [];
    },
    enabled: open,
    staleTime: 30000,
  });

  const { data: articles } = useQuery({
    queryKey: ['search-articles'],
    queryFn: async () => {
      const { data } = await supabase.from('stock_articles').select('id, designation, reference, categorie').limit(300);
      return data || [];
    },
    enabled: open,
    staleTime: 60000,
  });

  const { data: techniciens } = useQuery({
    queryKey: ['search-techniciens'],
    queryFn: async () => {
      const { data } = await supabase.from('techniciens').select('id, prenom, nom, email, avatar_initiales').limit(50);
      return data || [];
    },
    enabled: open,
    staleTime: 120000,
  });

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) {
      // Show module shortcuts when empty
      return MODULE_SHORTCUTS.map(m => ({
        id: `mod-${m.id}`,
        type: 'module' as const,
        title: m.name,
        subtitle: `Ctrl+${m.keys}`,
        module: m.id,
        icon: m.icon,
        color: m.color,
      }));
    }

    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // Modules
    MODULE_SHORTCUTS.forEach(m => {
      if (m.name.toLowerCase().includes(q) || m.id.includes(q)) {
        results.push({
          id: `mod-${m.id}`, type: 'module', title: m.name, subtitle: `Ctrl+${m.keys}`,
          module: m.id, icon: m.icon, color: m.color,
        });
      }
    });

    // Ascenseurs
    ascenseurs?.forEach((a: any) => {
      if (a.code_appareil?.toLowerCase().includes(q) || a.adresse?.toLowerCase().includes(q) || a.ville?.toLowerCase().includes(q)) {
        results.push({
          id: a.id, type: 'ascenseur', title: a.code_appareil,
          subtitle: `${a.adresse || ''} ${a.ville || ''}`.trim(),
          badge: a.statut === 'en_panne' ? 'En panne' : a.statut === 'en_service' ? 'OK' : a.statut,
          badgeColor: a.statut === 'en_panne' ? 'red' : 'green',
          module: 'ascenseurs', icon: Building2, color: '#06b6d4',
        });
      }
    });

    // Travaux
    travaux?.forEach((t: any) => {
      if (t.code?.toLowerCase().includes(q) || t.titre?.toLowerCase().includes(q)) {
        results.push({
          id: t.id, type: 'travaux', title: t.code || 'T-???',
          subtitle: t.titre || '', badge: t.statut,
          badgeColor: t.statut === 'en_cours' ? 'blue' : t.statut === 'termine' ? 'green' : 'gray',
          module: 'travaux', icon: Hammer, color: '#B91C1C',
        });
      }
    });

    // Articles stock
    articles?.forEach((a: any) => {
      if (a.designation?.toLowerCase().includes(q) || a.reference?.toLowerCase().includes(q)) {
        results.push({
          id: a.id, type: 'stock', title: a.designation || '?',
          subtitle: a.reference ? `Réf: ${a.reference}` : a.categorie || '',
          module: 'stock', icon: Package, color: '#f59e0b',
        });
      }
    });

    // Techniciens
    techniciens?.forEach((t: any) => {
      if (t.prenom?.toLowerCase().includes(q) || t.nom?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)) {
        results.push({
          id: t.id, type: 'technicien', title: `${t.prenom || ''} ${t.nom || ''}`.trim(),
          subtitle: t.email || '', module: 'planning', icon: User, color: '#B91C1C',
        });
      }
    });

    return results.slice(0, 15);
  }, [query, ascenseurs, travaux, articles, techniciens]);

  const handleSelect = useCallback((result: SearchResult) => {
    setModuleActif(result.module);
    setOpen(false);
    setQuery('');
  }, [setModuleActif]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      // Scroll into view
      const el = listRef.current?.children[Math.min(selectedIndex + 1, results.length - 1)] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Search dialog */}
      <div className="relative w-full max-w-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un ascenseur, travaux, pièce, technicien..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {!query && (
            <div className="px-4 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Navigation rapide
            </div>
          )}
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              Aucun résultat pour « {query} »
            </div>
          )}
          {results.map((result, i) => {
            const Icon = result.icon;
            return (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === selectedIndex ? "bg-blue-500/10" : "hover:bg-[var(--bg-tertiary)]"
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${result.color}20` }}>
                  <Icon className="w-4 h-4" style={{ color: result.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{result.title}</div>
                  {result.subtitle && (
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{result.subtitle}</div>
                  )}
                </div>
                {result.badge && (
                  <Badge variant={result.badgeColor || 'gray'} className="text-[9px] flex-shrink-0">{result.badge}</Badge>
                )}
                {result.type === 'module' && result.subtitle && (
                  <kbd className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-primary)]">
                    {result.subtitle}
                  </kbd>
                )}
                {i === selectedIndex && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> naviguer
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <CornerDownLeft className="w-3 h-3" /> ouvrir
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span className="font-mono">esc</span> fermer
          </div>
        </div>
      </div>
    </div>
  );
}
