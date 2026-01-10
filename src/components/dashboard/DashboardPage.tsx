import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { 
  Plus, Settings, RotateCcw, Save, X, GripVertical, Check,
  LayoutDashboard
} from 'lucide-react';
import { Button, Card, CardBody, Badge } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { 
  WIDGET_DEFINITIONS, 
  WIDGET_CATEGORIES, 
  DEFAULT_LAYOUT,
  getWidgetDefinition,
  type WidgetInstance,
  type WidgetCategory 
} from './widgetDefinitions';
import {
  StatsCountersWidget,
  StatsProgressWidget,
  StatsStockCriticalWidget,
  StatsTransfersWidget,
  PlanningTodayWidget,
  PlanningWeekWidget,
  PlanningDeadlinesWidget,
  PlanningAstreintesWidget,
  TravauxMineWidget,
  TravauxUrgentWidget,
  MESProgressWidget,
  StockVehicleWidget,
  StockAlertsWidget,
  StockMovementsWidget,
  ChatRecentWidget,
  ChatUnreadWidget,
  NotesWidget,
  HoursWeekWidget,
  HoursSummaryWidget,
  VehicleInfoWidget,
  VehicleMaintenanceWidget,
  ChartActivityWidget,
  ChartTypesWidget,
  ChartTeamWidget,
  WeatherWidget,
  ClockWidget,
  QuickLinksWidget,
  ChecklistWidget,
} from './widgets';
import { NotificationsWidget } from '@/components/notifications';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Mapping type widget -> composant
const WIDGET_COMPONENTS: Record<string, React.FC<{ onRemove?: () => void }>> = {
  'stats-counters': StatsCountersWidget,
  'stats-progress': StatsProgressWidget,
  'stats-stock-critical': StatsStockCriticalWidget,
  'stats-transfers': StatsTransfersWidget,
  'planning-today': PlanningTodayWidget,
  'planning-week': PlanningWeekWidget,
  'planning-deadlines': PlanningDeadlinesWidget,
  'planning-astreintes': PlanningAstreintesWidget,
  'travaux-mine': TravauxMineWidget,
  'travaux-urgent': TravauxUrgentWidget,
  'mes-progress': MESProgressWidget,
  'stock-vehicle': StockVehicleWidget,
  'stock-alerts': StockAlertsWidget,
  'stock-movements': StockMovementsWidget,
  'chat-recent': ChatRecentWidget,
  'chat-unread': ChatUnreadWidget,
  'notes': NotesWidget,
  'notifications': NotificationsWidget,
  'hours-week': HoursWeekWidget,
  'hours-summary': HoursSummaryWidget,
  'vehicle-info': VehicleInfoWidget,
  'vehicle-maintenance': VehicleMaintenanceWidget,
  'chart-activity': ChartActivityWidget,
  'chart-types': ChartTypesWidget,
  'chart-team': ChartTeamWidget,
  'weather': WeatherWidget,
  'clock': ClockWidget,
  'quick-links': QuickLinksWidget,
  'checklist': ChecklistWidget,
};

// Modal pour ajouter des widgets
function AddWidgetModal({ 
  onClose, 
  onAdd, 
  activeWidgets 
}: { 
  onClose: () => void; 
  onAdd: (type: string) => void;
  activeWidgets: string[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filteredWidgets = useMemo(() => {
    return WIDGET_DEFINITIONS.filter(w => {
      const matchCategory = selectedCategory === 'all' || w.category === selectedCategory;
      const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
                         w.description.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, search]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-400" />
            Ajouter un widget
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[var(--border-primary)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un widget..."
            className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] placeholder-dark-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Catégories */}
          <div className="w-48 border-r border-[var(--border-primary)] p-3 overflow-y-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${
                selectedCategory === 'all' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Tous les widgets
            </button>
            {Object.entries(WIDGET_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as WidgetCategory)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 ${
                  selectedCategory === key 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Liste widgets */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {filteredWidgets.map(widget => {
                const isActive = activeWidgets.includes(widget.id);
                const Icon = widget.icon;
                const category = WIDGET_CATEGORIES[widget.category];
                
                return (
                  <button
                    key={widget.id}
                    onClick={() => !isActive && onAdd(widget.id)}
                    disabled={isActive}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'bg-[var(--bg-tertiary)]/50 border-[var(--border-primary)] opacity-50 cursor-not-allowed' 
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:border-purple-500 hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: category.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{widget.name}</span>
                          {isActive && (
                            <Badge variant="green" className="text-[10px]">Actif</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{widget.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="gray" className="text-[10px]">{widget.defaultSize}</Badge>
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${category.color}20`, color: category.color }}
                          >
                            {category.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [layout, setLayout] = useState<WidgetInstance[]>([]);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Charger la config du dashboard
  const { data: dashboardConfig, isLoading } = useQuery({
    queryKey: ['dashboard-config', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('dashboard_configs')
        .select('*')
        .eq('technicien_id', CURRENT_USER_ID)
        .single();
      return data;
    },
  });

  // Initialiser le layout
  useEffect(() => {
    if (dashboardConfig?.layout) {
      setLayout(dashboardConfig.layout);
    } else if (!isLoading) {
      setLayout(DEFAULT_LAYOUT);
    }
  }, [dashboardConfig, isLoading]);

  // Mesurer la largeur du conteneur
  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById('dashboard-container');
      if (container) {
        setContainerWidth(container.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Sauvegarder le layout
  const saveMutation = useMutation({
    mutationFn: async (newLayout: WidgetInstance[]) => {
      const { data: existing } = await supabase
        .from('dashboard_configs')
        .select('id')
        .eq('technicien_id', CURRENT_USER_ID)
        .single();

      if (existing) {
        await supabase
          .from('dashboard_configs')
          .update({ layout: newLayout, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('dashboard_configs')
          .insert({ technicien_id: CURRENT_USER_ID, layout: newLayout });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      toast.success('Dashboard sauvegardé');
      setIsEditing(false);
    },
  });

  // Gérer le changement de layout
  const handleLayoutChange = useCallback((newLayout: GridLayout.Layout[]) => {
    if (!isEditing) return;
    
    setLayout(prev => prev.map(widget => {
      const updated = newLayout.find(l => l.i === widget.i);
      if (updated) {
        return { ...widget, x: updated.x, y: updated.y, w: updated.w, h: updated.h };
      }
      return widget;
    }));
  }, [isEditing]);

  // Ajouter un widget
  const handleAddWidget = useCallback((type: string) => {
    const definition = getWidgetDefinition(type);
    if (!definition) return;

    const newWidget: WidgetInstance = {
      i: `w${Date.now()}`,
      type,
      x: 0,
      y: Infinity, // Place en bas
      w: definition.defaultW,
      h: definition.defaultH,
    };

    setLayout(prev => [...prev, newWidget]);
    setShowAddWidget(false);
  }, []);

  // Supprimer un widget
  const handleRemoveWidget = useCallback((widgetId: string) => {
    setLayout(prev => prev.filter(w => w.i !== widgetId));
  }, []);

  // Reset le layout
  const handleReset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  // Convertir layout pour react-grid-layout
  const gridLayout = useMemo(() => {
    return layout.map(w => {
      const def = getWidgetDefinition(w.type);
      return {
        i: w.i,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: def?.minW || 1,
        minH: def?.minH || 1,
        maxW: def?.maxW,
        maxH: def?.maxH,
      };
    });
  }, [layout]);

  // Liste des widgets actifs
  const activeWidgetTypes = useMemo(() => layout.map(w => w.type), [layout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-purple-400" />
          <span className="text-lg font-bold text-[var(--text-primary)]">Mon tableau de bord</span>
          {isEditing && (
            <Badge variant="amber" className="ml-2">Mode édition</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowAddWidget(true)}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
              <Button variant="secondary" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4" /> Annuler
              </Button>
              <Button variant="primary" size="sm" onClick={() => saveMutation.mutate(layout)}>
                <Save className="w-4 h-4" /> Sauvegarder
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              <Settings className="w-4 h-4" /> Personnaliser
            </Button>
          )}
        </div>
      </div>

      {/* Grille de widgets */}
      <div id="dashboard-container" className="relative">
        {isEditing && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div 
              className="w-full h-full"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${(containerWidth - 48) / 6}px 100px`,
              }}
            />
          </div>
        )}
        
        <GridLayout
          className="layout"
          layout={gridLayout}
          cols={6}
          rowHeight={100}
          width={containerWidth}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditing}
          isResizable={isEditing}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          preventCollision={false}
        >
          {layout.map(widget => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.type];
            const definition = getWidgetDefinition(widget.type);
            
            if (!WidgetComponent || !definition) {
              return (
                <div key={widget.i} className="bg-[var(--bg-secondary)] rounded-xl p-4">
                  <span className="text-[var(--text-tertiary)] text-sm">Widget inconnu: {widget.type}</span>
                </div>
              );
            }

            return (
              <div key={widget.i} className="relative group">
                {isEditing && (
                  <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="widget-drag-handle cursor-move p-1 bg-[var(--bg-elevated)] rounded hover:bg-dark-500">
                      <GripVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </div>
                    <button 
                      onClick={() => handleRemoveWidget(widget.i)}
                      className="p-1 bg-red-500/20 rounded hover:bg-red-500/40"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                )}
                <div className={`h-full ${isEditing ? 'pointer-events-none' : ''}`}>
                  <WidgetComponent onRemove={isEditing ? () => handleRemoveWidget(widget.i) : undefined} />
                </div>
              </div>
            );
          })}
        </GridLayout>
      </div>

      {/* Message si aucun widget */}
      {layout.length === 0 && (
        <Card className="p-12 text-center">
          <LayoutDashboard className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Dashboard vide</h3>
          <p className="text-[var(--text-tertiary)] mb-4">Personnalisez votre tableau de bord en ajoutant des widgets</p>
          <Button variant="primary" onClick={() => { setIsEditing(true); setShowAddWidget(true); }}>
            <Plus className="w-4 h-4" /> Ajouter des widgets
          </Button>
        </Card>
      )}

      {/* Modal ajout widget */}
      {showAddWidget && (
        <AddWidgetModal
          onClose={() => setShowAddWidget(false)}
          onAdd={handleAddWidget}
          activeWidgets={activeWidgetTypes}
        />
      )}
    </div>
  );
}
