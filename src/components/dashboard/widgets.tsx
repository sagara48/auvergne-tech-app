import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, Calendar, Check, ChevronRight, Clock, Package, 
  Hammer, FileCheck, Car, MessageCircle, Plus, Trash2, Cloud,
  Sun, CloudRain, CloudSnow, Wind, Droplets, X, ExternalLink, Truck
} from 'lucide-react';
import { Card, CardBody, Badge, ProgressBar, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { useAppStore } from '@/stores/appStore';
import { 
  format, parseISO, isToday, startOfWeek, addDays, getWeek, 
  differenceInDays, isBefore 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// ============================================
// COMPOSANT WRAPPER WIDGET
// ============================================
export function WidgetWrapper({ 
  title, 
  icon: Icon, 
  children, 
  color = '#6366f1',
  onRemove,
  compact = false
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode;
  color?: string;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <Card className="h-full flex flex-col overflow-hidden group">
      <div className={`flex items-center justify-between ${compact ? 'px-3 py-2' : 'px-4 py-3'} border-b border-[var(--border-primary)]`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className={`font-semibold text-[var(--text-primary)] ${compact ? 'text-xs' : 'text-sm'}`}>{title}</span>
        </div>
        {onRemove && (
          <button 
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-elevated)] rounded transition-opacity"
          >
            <X className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        )}
      </div>
      <div className={`flex-1 overflow-auto ${compact ? 'p-2' : 'p-3'}`}>
        {children}
      </div>
    </Card>
  );
}

// ============================================
// WIDGETS STATISTIQUES
// ============================================

export function StatsCountersWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [ascenseurs, travaux, mes, demandes] = await Promise.all([
        supabase.from('ascenseurs').select('statut'),
        supabase.from('travaux').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('mise_en_service').select('statut').in('statut', ['planifie', 'en_cours']),
        supabase.from('demandes').select('statut').eq('statut', 'en_attente'),
      ]);
      return {
        pannes: ascenseurs.data?.filter(a => a.statut === 'en_panne').length || 0,
        travaux: travaux.data?.length || 0,
        mes: mes.data?.length || 0,
        demandes: demandes.data?.length || 0,
      };
    },
  });

  const counters = [
    { label: 'En panne', value: stats?.pannes || 0, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Travaux', value: stats?.travaux || 0, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'MES', value: stats?.mes || 0, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Demandes', value: stats?.demandes || 0, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="h-full flex items-center justify-around gap-2">
      {counters.map((c, i) => (
        <div key={i} className={`flex-1 ${c.bg} rounded-xl p-3 text-center`}>
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-xs text-[var(--text-tertiary)]">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StatsProgressWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: travaux } = useQuery({
    queryKey: ['travaux-progress'],
    queryFn: async () => {
      const { data } = await supabase
        .from('travaux')
        .select('progression')
        .in('statut', ['planifie', 'en_cours']);
      return data || [];
    },
  });

  const avgProgress = travaux?.length 
    ? Math.round(travaux.reduce((acc, t) => acc + (t.progression || 0), 0) / travaux.length)
    : 0;

  return (
    <WidgetWrapper title="Progression travaux" icon={Hammer} color="#a855f7" onRemove={onRemove} compact>
      <div className="h-full flex flex-col justify-center">
        <div className="text-center mb-2">
          <span className="text-3xl font-bold text-[var(--text-primary)]">{avgProgress}%</span>
        </div>
        <ProgressBar value={avgProgress} variant="purple" />
        <div className="text-xs text-[var(--text-tertiary)] text-center mt-2">
          {travaux?.length || 0} travaux actifs
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function StatsStockCriticalWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: count } = useQuery({
    queryKey: ['stock-critical-count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_articles')
        .select('quantite_stock, seuil_critique')
        .eq('actif', true);
      return data?.filter(a => a.quantite_stock <= a.seuil_critique).length || 0;
    },
  });

  return (
    <WidgetWrapper title="Stock critique" icon={AlertTriangle} color="#ef4444" onRemove={onRemove} compact>
      <div className="h-full flex flex-col items-center justify-center">
        <div className={`text-4xl font-bold ${count && count > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {count || 0}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">articles</div>
      </div>
    </WidgetWrapper>
  );
}

export function StatsTransfersWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: count } = useQuery({
    queryKey: ['transfers-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('stock_transferts')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_attente');
      return count || 0;
    },
  });

  return (
    <WidgetWrapper title="Transferts" icon={Package} color="#f59e0b" onRemove={onRemove} compact>
      <div className="h-full flex flex-col items-center justify-center">
        <div className={`text-4xl font-bold ${count && count > 0 ? 'text-amber-400' : 'text-green-400'}`}>
          {count || 0}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">en attente</div>
      </div>
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS PLANNING
// ============================================

export function PlanningTodayWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: events } = useQuery({
    queryKey: ['planning-today', CURRENT_USER_ID],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('planning_events')
        .select('*, travaux(*), mise_en_service:mise_en_service(*), tournee:tournees(*)')
        .eq('technicien_id', CURRENT_USER_ID)
        .gte('date_debut', `${today}T00:00:00`)
        .lte('date_debut', `${today}T23:59:59`)
        .order('date_debut');
      return data || [];
    },
  });

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      travaux: 'bg-purple-500',
      tournee: 'bg-green-500',
      mise_service: 'bg-orange-500',
      formation: 'bg-blue-500',
      reunion: 'bg-pink-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <WidgetWrapper title="Mon planning du jour" icon={Calendar} color="#f59e0b" onRemove={onRemove}>
      {events?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucune intervention prévue
        </div>
      ) : (
        <div className="space-y-2">
          {events?.map(event => (
            <div 
              key={event.id}
              className="flex items-center gap-3 p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              onClick={() => setModuleActif('planning')}
            >
              <div className={`w-1 h-10 rounded-full ${getEventColor(event.type_event)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{event.titre}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {format(parseISO(event.date_debut), 'HH:mm')} - {format(parseISO(event.date_fin), 'HH:mm')}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function PlanningWeekWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: events } = useQuery({
    queryKey: ['planning-week', CURRENT_USER_ID],
    queryFn: async () => {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const { data } = await supabase
        .from('planning_events')
        .select('*')
        .eq('technicien_id', CURRENT_USER_ID)
        .gte('date_debut', start.toISOString())
        .lte('date_debut', end.toISOString());
      return data || [];
    },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
    const dayEvents = events?.filter(e => 
      format(parseISO(e.date_debut), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    ) || [];
    return { date, events: dayEvents };
  });

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      travaux: 'bg-purple-500',
      tournee: 'bg-green-500',
      mise_service: 'bg-orange-500',
    };
    return colors[type] || 'bg-blue-500';
  };

  return (
    <WidgetWrapper title={`Semaine ${getWeek(new Date(), { weekStartsOn: 1 })}`} icon={Calendar} color="#f59e0b" onRemove={onRemove}>
      <div className="grid grid-cols-7 gap-1 h-full">
        {days.map(({ date, events: dayEvents }, i) => (
          <div 
            key={i} 
            className={`flex flex-col rounded-lg p-1 ${
              isToday(date) ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[var(--bg-tertiary)]'
            }`}
          >
            <div className="text-center mb-1">
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase">
                {format(date, 'EEE', { locale: fr })}
              </div>
              <div className={`text-sm font-bold ${isToday(date) ? 'text-purple-400' : 'text-[var(--text-primary)]'}`}>
                {format(date, 'd')}
              </div>
            </div>
            <div className="flex-1 space-y-0.5 overflow-hidden">
              {dayEvents.slice(0, 3).map((e, j) => (
                <div 
                  key={j} 
                  className={`h-1.5 rounded-full ${getEventColor(e.type_event)}`}
                  title={e.titre}
                />
              ))}
              {dayEvents.length > 3 && (
                <div className="text-[8px] text-[var(--text-tertiary)] text-center">
                  +{dayEvents.length - 3}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}

export function PlanningDeadlinesWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: travaux } = useQuery({
    queryKey: ['travaux-deadlines'],
    queryFn: async () => {
      const { data } = await supabase
        .from('travaux')
        .select('*')
        .not('date_butoir', 'is', null)
        .in('statut', ['planifie', 'en_cours'])
        .order('date_butoir');
      return data || [];
    },
  });

  const getUrgencyColor = (dateButoir: string) => {
    const days = differenceInDays(parseISO(dateButoir), new Date());
    if (days < 0) return 'text-red-400 bg-red-500/20';
    if (days <= 3) return 'text-red-400 bg-red-500/10';
    if (days <= 7) return 'text-amber-400 bg-amber-500/10';
    return 'text-[var(--text-tertiary)] bg-[var(--bg-elevated)]';
  };

  const getUrgencyLabel = (dateButoir: string) => {
    const days = differenceInDays(parseISO(dateButoir), new Date());
    if (days < 0) return `Dépassé ${Math.abs(days)}j`;
    if (days === 0) return "Aujourd'hui";
    return `${days}j restants`;
  };

  return (
    <WidgetWrapper title="Échéances" icon={AlertTriangle} color="#ef4444" onRemove={onRemove}>
      {travaux?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucune échéance
        </div>
      ) : (
        <div className="space-y-2">
          {travaux?.slice(0, 5).map(t => (
            <div 
              key={t.id}
              className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              onClick={() => setModuleActif('travaux')}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-purple-400 font-semibold">{t.code}</div>
                <div className="text-sm text-[var(--text-primary)] truncate">{t.titre}</div>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full ${getUrgencyColor(t.date_butoir)}`}>
                {getUrgencyLabel(t.date_butoir)}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function PlanningAstreintesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: astreintes } = useQuery({
    queryKey: ['astreintes-upcoming', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('astreintes')
        .select('*')
        .eq('technicien_id', CURRENT_USER_ID)
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .order('date')
        .limit(3);
      return data || [];
    },
  });

  return (
    <WidgetWrapper title="Astreintes" icon={Clock} color="#14b8a6" onRemove={onRemove} compact>
      {astreintes?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
          Aucune astreinte prévue
        </div>
      ) : (
        <div className="space-y-1">
          {astreintes?.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-primary)]">{format(parseISO(a.date), 'd MMM', { locale: fr })}</span>
              <Badge variant={a.type === 'nuit' ? 'purple' : 'blue'} className="text-[10px]">
                {a.type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS TRAVAUX & MES
// ============================================

export function TravauxMineWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: travaux } = useQuery({
    queryKey: ['travaux-mine', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('travaux')
        .select('*, client:clients(raison_sociale)')
        .eq('technicien_id', CURRENT_USER_ID)
        .in('statut', ['planifie', 'en_cours'])
        .order('priorite', { ascending: false });
      return data || [];
    },
  });

  const priorityColor: Record<string, string> = {
    urgente: 'text-red-400',
    haute: 'text-amber-400',
    normale: 'text-blue-400',
    basse: 'text-gray-400',
  };

  return (
    <WidgetWrapper title="Mes travaux" icon={Hammer} color="#a855f7" onRemove={onRemove}>
      {travaux?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucun travaux assigné
        </div>
      ) : (
        <div className="space-y-2">
          {travaux?.map(t => (
            <div 
              key={t.id}
              className="p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              onClick={() => setModuleActif('travaux')}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-400 font-semibold">{t.code}</span>
                <span className={`text-xs ${priorityColor[t.priorite]}`}>●</span>
              </div>
              <div className="text-sm text-[var(--text-primary)] truncate mb-1">{t.titre}</div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)] truncate">{t.client?.raison_sociale}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{t.progression}%</span>
              </div>
              <ProgressBar value={t.progression} variant="purple" className="mt-1" />
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function TravauxUrgentWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: travaux } = useQuery({
    queryKey: ['travaux-urgent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('travaux')
        .select('*')
        .not('date_butoir', 'is', null)
        .in('statut', ['planifie', 'en_cours']);
      
      // Filtrer les urgents (< 7 jours)
      return (data || []).filter(t => {
        const days = differenceInDays(parseISO(t.date_butoir), new Date());
        return days <= 7;
      }).sort((a, b) => 
        new Date(a.date_butoir).getTime() - new Date(b.date_butoir).getTime()
      );
    },
  });

  const getUrgencyStyle = (dateButoir: string) => {
    const days = differenceInDays(parseISO(dateButoir), new Date());
    if (days < 0) return { bg: 'bg-red-500/20 border-red-500/50', text: 'text-red-400' };
    if (days <= 3) return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' };
    return { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' };
  };

  return (
    <WidgetWrapper title="Travaux urgents" icon={AlertTriangle} color="#ef4444" onRemove={onRemove}>
      {travaux?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-green-400 text-sm">
          ✓ Aucune urgence
        </div>
      ) : (
        <div className="space-y-2">
          {travaux?.slice(0, 4).map(t => {
            const style = getUrgencyStyle(t.date_butoir);
            const days = differenceInDays(parseISO(t.date_butoir), new Date());
            return (
              <div 
                key={t.id}
                className={`p-2 rounded-lg border cursor-pointer ${style.bg}`}
                onClick={() => setModuleActif('travaux')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-400">{t.code}</span>
                  <span className={`text-xs font-bold ${style.text}`}>
                    {days < 0 ? `${Math.abs(days)}j dépassé` : days === 0 ? "Aujourd'hui" : `${days}j`}
                  </span>
                </div>
                <div className="text-sm text-[var(--text-primary)] truncate">{t.titre}</div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function MESProgressWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: mes } = useQuery({
    queryKey: ['mes-progress'],
    queryFn: async () => {
      const { data } = await supabase
        .from('mise_en_service')
        .select('*, ascenseur:ascenseurs(code, adresse)')
        .in('statut', ['planifie', 'en_cours'])
        .order('etape_actuelle', { ascending: false });
      return data || [];
    },
  });

  return (
    <WidgetWrapper title="MES en cours" icon={FileCheck} color="#f97316" onRemove={onRemove}>
      {mes?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucune MES en cours
        </div>
      ) : (
        <div className="space-y-2">
          {mes?.slice(0, 4).map(m => {
            const progress = Math.round((m.etape_actuelle / 7) * 100);
            return (
              <div 
                key={m.id}
                className="p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
                onClick={() => setModuleActif('miseservice')}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-orange-400 font-semibold">{m.code}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">Étape {m.etape_actuelle}/7</span>
                </div>
                <div className="text-sm text-[var(--text-primary)] truncate mb-1">
                  {m.ascenseur?.code} - {m.ascenseur?.adresse}
                </div>
                <ProgressBar value={progress} variant="orange" />
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS STOCK
// ============================================

export function StockVehicleWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: stockVehicule } = useQuery({
    queryKey: ['stock-vehicle', CURRENT_USER_ID],
    queryFn: async () => {
      // Trouver le véhicule du technicien
      const { data: vehicule } = await supabase
        .from('vehicules')
        .select('id')
        .eq('technicien_id', CURRENT_USER_ID)
        .single();
      
      if (!vehicule) return [];
      
      const { data } = await supabase
        .from('stock_vehicule')
        .select('*, article:stock_articles(*)')
        .eq('vehicule_id', vehicule.id);
      return data || [];
    },
  });

  return (
    <WidgetWrapper title="Stock véhicule" icon={Package} color="#ef4444" onRemove={onRemove}>
      {stockVehicule?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucun stock véhicule
        </div>
      ) : (
        <div className="space-y-1">
          {stockVehicule?.slice(0, 6).map(item => {
            const isLow = item.quantite < (item.quantite_min || 0);
            return (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  isLow ? 'bg-red-500/10' : 'bg-[var(--bg-tertiary)]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--text-primary)] truncate">{item.article?.designation}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">{item.article?.reference}</div>
                </div>
                <Badge variant={isLow ? 'red' : 'gray'} className="text-xs">
                  {item.quantite}
                </Badge>
              </div>
            );
          })}
          {stockVehicule && stockVehicule.length > 6 && (
            <button 
              onClick={() => setModuleActif('stock')}
              className="w-full text-xs text-purple-400 hover:text-purple-300 py-1"
            >
              Voir tout ({stockVehicule.length})
            </button>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function StockAlertsWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: alerts } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_articles')
        .select('*')
        .eq('actif', true)
        .or(`quantite_stock.lte.seuil_alerte,quantite_stock.lte.seuil_critique`);
      return (data || []).filter(a => a.quantite_stock <= a.seuil_alerte);
    },
  });

  return (
    <WidgetWrapper title="Alertes stock" icon={AlertTriangle} color="#ef4444" onRemove={onRemove}>
      {alerts?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-green-400 text-sm">
          ✓ Stock OK
        </div>
      ) : (
        <div className="space-y-1">
          {alerts?.slice(0, 5).map(item => {
            const isCritical = item.quantite_stock <= item.seuil_critique;
            return (
              <div 
                key={item.id}
                className={`p-2 rounded-lg border cursor-pointer ${
                  isCritical ? 'bg-red-500/20 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                }`}
                onClick={() => setModuleActif('stock')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-primary)] truncate">{item.designation}</span>
                  <Badge variant={isCritical ? 'red' : 'amber'} className="text-[10px]">
                    {item.quantite_stock}/{item.seuil_alerte}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function StockMovementsWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_transferts')
        .select('*, article:stock_articles(designation, reference)')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const statusColors: Record<string, string> = {
    en_attente: 'text-amber-400',
    valide: 'text-green-400',
    refuse: 'text-red-400',
  };

  return (
    <WidgetWrapper title="Derniers mouvements" icon={Package} color="#f59e0b" onRemove={onRemove}>
      {movements?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucun mouvement
        </div>
      ) : (
        <div className="space-y-2">
          {movements?.map(m => (
            <div key={m.id} className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-400 font-semibold">{m.code}</span>
                <span className={`text-xs ${statusColors[m.statut]}`}>●</span>
              </div>
              <div className="text-xs text-[var(--text-primary)] truncate">{m.article?.designation}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Qté: {m.quantite}</div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS COMMUNICATION
// ============================================

export function ChatRecentWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: messages } = useQuery({
    queryKey: ['chat-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, sender:techniciens(prenom, nom), channel:chat_channels(nom, icone)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <WidgetWrapper title="Messages récents" icon={MessageCircle} color="#8b5cf6" onRemove={onRemove}>
      {messages?.length === 0 ? (
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
          Aucun message
        </div>
      ) : (
        <div className="space-y-2">
          {messages?.map(m => (
            <div 
              key={m.id}
              className="p-2 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-elevated)] cursor-pointer"
              onClick={() => setModuleActif('chat')}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{m.channel?.icone}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{m.channel?.nom}</span>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                  {format(parseISO(m.created_at), 'HH:mm')}
                </span>
              </div>
              <div className="text-xs text-[var(--text-primary)]">
                <span className="text-purple-400">{m.sender?.prenom}:</span> {m.content.substring(0, 50)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

export function ChatUnreadWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: count } = useQuery({
    queryKey: ['chat-unread-count', CURRENT_USER_ID],
    queryFn: async () => {
      // Simplification: compte tous les messages récents non lus
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('sender_id', CURRENT_USER_ID)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      return count || 0;
    },
  });

  return (
    <WidgetWrapper title="Non-lus" icon={MessageCircle} color="#8b5cf6" onRemove={onRemove} compact>
      <div 
        className="h-full flex flex-col items-center justify-center cursor-pointer"
        onClick={() => setModuleActif('chat')}
      >
        <div className={`text-4xl font-bold ${count && count > 0 ? 'text-purple-400' : 'text-[var(--text-tertiary)]'}`}>
          {count || 0}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">messages</div>
      </div>
    </WidgetWrapper>
  );
}

export function NotesWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: notes } = useQuery({
    queryKey: ['notes-widget', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .or(`technicien_id.eq.${CURRENT_USER_ID},partage.eq.true`)
        .eq('archive', false)
        .order('epingle', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const categoryColors: Record<string, string> = {
    perso: '#6366f1',
    technique: '#f59e0b',
    client: '#22c55e',
    urgent: '#ef4444',
  };

  return (
    <WidgetWrapper title="Notes récentes" icon={Clock} color="#eab308" onRemove={onRemove}>
      {notes?.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] text-sm">
          <span className="text-2xl mb-2">📝</span>
          Aucune note
        </div>
      ) : (
        <div className="space-y-2 h-full overflow-y-auto">
          {notes?.map(note => (
            <div 
              key={note.id}
              onClick={() => setModuleActif('notes')}
              className="p-2 bg-[var(--bg-tertiary)] rounded-lg border-l-2 hover:bg-[var(--bg-elevated)] cursor-pointer"
              style={{ borderLeftColor: note.couleur || categoryColors[note.categorie] }}
            >
              <div className="flex items-center gap-2 mb-1">
                {note.epingle && <span className="text-purple-400">📌</span>}
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">{note.titre}</span>
              </div>
              {note.contenu && (
                <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-2">{note.contenu}</p>
              )}
            </div>
          ))}
          <button 
            onClick={() => setModuleActif('notes')}
            className="w-full text-xs text-purple-400 hover:text-purple-300 py-1"
          >
            Voir toutes les notes →
          </button>
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS TEMPS
// ============================================

export function HoursWeekWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: hours } = useQuery({
    queryKey: ['hours-week', CURRENT_USER_ID],
    queryFn: async () => {
      const weekNum = getWeek(new Date(), { weekStartsOn: 1 });
      const year = new Date().getFullYear();
      
      const { data: semaine } = await supabase
        .from('semaines')
        .select('id')
        .eq('technicien_id', CURRENT_USER_ID)
        .eq('annee', year)
        .eq('numero_semaine', weekNum)
        .single();
      
      if (!semaine) return { total: 0, target: 39 };
      
      const { data: jours } = await supabase
        .from('jours')
        .select('heures_travail')
        .eq('semaine_id', semaine.id);
      
      const total = jours?.reduce((acc, j) => acc + (j.heures_travail || 0), 0) || 0;
      return { total, target: 39 };
    },
  });

  const progress = Math.min(100, Math.round(((hours?.total || 0) / (hours?.target || 39)) * 100));

  return (
    <WidgetWrapper title="Heures" icon={Clock} color="#14b8a6" onRemove={onRemove} compact>
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">{hours?.total || 0}h</div>
        <div className="text-[10px] text-[var(--text-tertiary)] mb-1">/ {hours?.target}h</div>
        <div className="w-full">
          <ProgressBar value={progress} variant={progress >= 100 ? 'green' : 'blue'} />
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function HoursSummaryWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: summary } = useQuery({
    queryKey: ['hours-summary', CURRENT_USER_ID],
    queryFn: async () => {
      const weekNum = getWeek(new Date(), { weekStartsOn: 1 });
      const year = new Date().getFullYear();
      
      const { data: semaine } = await supabase
        .from('semaines')
        .select('id, statut')
        .eq('technicien_id', CURRENT_USER_ID)
        .eq('annee', year)
        .eq('numero_semaine', weekNum)
        .single();
      
      if (!semaine) return { travail: 0, trajet: 0, rtt: 0, statut: 'brouillon' };
      
      const { data: jours } = await supabase
        .from('jours')
        .select('heures_travail, heures_trajet, heures_rtt')
        .eq('semaine_id', semaine.id);
      
      const travail = jours?.reduce((acc, j) => acc + (j.heures_travail || 0), 0) || 0;
      const trajet = jours?.reduce((acc, j) => acc + (j.heures_trajet || 0), 0) || 0;
      const rtt = jours?.reduce((acc, j) => acc + (j.heures_rtt || 0), 0) || 0;
      
      return { travail, trajet, rtt, statut: semaine.statut };
    },
  });

  const statusColors: Record<string, string> = {
    brouillon: 'text-gray-400',
    soumis: 'text-amber-400',
    valide: 'text-green-400',
  };

  return (
    <WidgetWrapper title="Feuille d'heures" icon={Clock} color="#14b8a6" onRemove={onRemove}>
      <div 
        className="h-full flex flex-col cursor-pointer"
        onClick={() => setModuleActif('heures')}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-tertiary)]">Semaine {getWeek(new Date(), { weekStartsOn: 1 })}</span>
          <span className={`text-xs capitalize ${statusColors[summary?.statut || 'brouillon']}`}>
            {summary?.statut}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[var(--text-primary)]">{summary?.travail || 0}h</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Travail</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-blue-400">{summary?.trajet || 0}h</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Trajet</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-purple-400">{summary?.rtt || 0}h</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">RTT</div>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS VEHICULE
// ============================================

export function VehicleInfoWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const { data: vehicule } = useQuery({
    queryKey: ['vehicle-info', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicules')
        .select('*')
        .eq('technicien_id', CURRENT_USER_ID)
        .single();
      return data;
    },
  });

  if (!vehicule) {
    return (
      <WidgetWrapper title="Mon véhicule" icon={Car} color="#22c55e" onRemove={onRemove} compact>
        <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
          Aucun véhicule assigné
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper title="Mon véhicule" icon={Car} color="#22c55e" onRemove={onRemove} compact>
      <div 
        className="h-full flex items-center gap-3 cursor-pointer"
        onClick={() => setModuleActif('vehicules')}
      >
        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
          <Car className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{vehicule.immatriculation}</div>
          <div className="text-xs text-[var(--text-tertiary)] truncate">{vehicule.marque} {vehicule.modele}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-[var(--text-primary)]">{vehicule.kilometrage?.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">km</div>
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function VehicleMaintenanceWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: vehicule } = useQuery({
    queryKey: ['vehicle-maintenance', CURRENT_USER_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicules')
        .select('prochaine_revision, date_ct')
        .eq('technicien_id', CURRENT_USER_ID)
        .single();
      return data;
    },
  });

  const getDateStatus = (dateStr?: string) => {
    if (!dateStr) return { color: 'text-[var(--text-tertiary)]', label: 'N/A' };
    const date = parseISO(dateStr);
    const days = differenceInDays(date, new Date());
    if (days < 0) return { color: 'text-red-400', label: 'Dépassé' };
    if (days <= 30) return { color: 'text-amber-400', label: `${days}j` };
    return { color: 'text-green-400', label: format(date, 'd MMM', { locale: fr }) };
  };

  const revision = getDateStatus(vehicule?.prochaine_revision);
  const ct = getDateStatus(vehicule?.date_ct);

  return (
    <WidgetWrapper title="Entretien" icon={Car} color="#22c55e" onRemove={onRemove} compact>
      <div className="h-full flex flex-col justify-center space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Révision</span>
          <span className={`text-xs font-semibold ${revision.color}`}>{revision.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">CT</span>
          <span className={`text-xs font-semibold ${ct.color}`}>{ct.label}</span>
        </div>
      </div>
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS GRAPHIQUES
// ============================================

export function ChartActivityWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: activity } = useQuery({
    queryKey: ['chart-activity'],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(new Date(), -6 + i);
        return format(date, 'yyyy-MM-dd');
      });
      
      const { data } = await supabase
        .from('planning_events')
        .select('date_debut, type_event')
        .gte('date_debut', `${days[0]}T00:00:00`)
        .lte('date_debut', `${days[6]}T23:59:59`);
      
      return days.map(d => {
        const dayEvents = data?.filter(e => e.date_debut.startsWith(d)) || [];
        return {
          day: format(parseISO(d), 'EEE', { locale: fr }),
          travaux: dayEvents.filter(e => e.type_event === 'travaux').length,
          tournees: dayEvents.filter(e => e.type_event === 'tournee').length,
          mes: dayEvents.filter(e => e.type_event === 'mise_service').length,
        };
      });
    },
  });

  return (
    <WidgetWrapper title="Activité 7 jours" icon={Calendar} color="#ec4899" onRemove={onRemove}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="travaux" stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
          <Bar dataKey="tournees" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="mes" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}

export function ChartTypesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: types } = useQuery({
    queryKey: ['chart-types'],
    queryFn: async () => {
      const { data } = await supabase
        .from('travaux')
        .select('type_travaux')
        .in('statut', ['planifie', 'en_cours']);
      
      const counts: Record<string, number> = {};
      data?.forEach(t => {
        counts[t.type_travaux] = (counts[t.type_travaux] || 0) + 1;
      });
      
      const labels: Record<string, string> = {
        reparation: 'Réparation',
        modernisation: 'Modernisation',
        installation: 'Installation',
        mise_conformite: 'Conformité',
        depannage: 'Dépannage',
      };
      
      return Object.entries(counts).map(([key, value]) => ({
        name: labels[key] || key,
        value,
      }));
    },
  });

  const COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <WidgetWrapper title="Types travaux" icon={Calendar} color="#ec4899" onRemove={onRemove}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={types}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={2}
            dataKey="value"
          >
            {types?.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {types?.map((t, i) => (
          <div key={t.name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[10px] text-[var(--text-tertiary)]">{t.name}</span>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}

export function ChartTeamWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: team } = useQuery({
    queryKey: ['chart-team'],
    queryFn: async () => {
      const { data: techs } = await supabase
        .from('techniciens')
        .select('id, prenom, nom')
        .eq('actif', true);
      
      const results = await Promise.all(
        (techs || []).slice(0, 5).map(async (tech) => {
          const { count: travaux } = await supabase
            .from('travaux')
            .select('*', { count: 'exact', head: true })
            .eq('technicien_id', tech.id)
            .eq('statut', 'termine');
          
          return {
            name: tech.prenom,
            travaux: travaux || 0,
          };
        })
      );
      
      return results;
    },
  });

  return (
    <WidgetWrapper title="Performance équipe" icon={Calendar} color="#ec4899" onRemove={onRemove}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={team} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
          />
          <Bar dataKey="travaux" fill="#a855f7" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS UTILITAIRES
// ============================================

export function WeatherWidget({ onRemove }: { onRemove?: () => void }) {
  // Simulation météo (en prod: API météo)
  const weather = {
    temp: 12,
    condition: 'cloudy',
    city: 'Clermont-Fd'
  };

  const icons: Record<string, any> = {
    sunny: Sun,
    cloudy: Cloud,
    rainy: CloudRain,
    snowy: CloudSnow,
  };
  const Icon = icons[weather.condition] || Cloud;

  return (
    <WidgetWrapper title="Météo" icon={Cloud} color="#6366f1" onRemove={onRemove} compact>
      <div className="h-full flex items-center justify-center gap-3">
        <Icon className="w-10 h-10 text-blue-400" />
        <div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{weather.temp}°</div>
          <div className="text-xs text-[var(--text-tertiary)]">{weather.city}</div>
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function ClockWidget({ onRemove }: { onRemove?: () => void }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <WidgetWrapper title="Horloge" icon={Clock} color="#6366f1" onRemove={onRemove} compact>
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-[var(--text-primary)] font-mono">
          {format(time, 'HH:mm')}
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {format(time, 'EEEE d MMMM', { locale: fr })}
        </div>
        <div className="text-[10px] text-purple-400 mt-1">
          Semaine {getWeek(time, { weekStartsOn: 1 })}
        </div>
      </div>
    </WidgetWrapper>
  );
}

export function QuickLinksWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  
  const links = [
    { id: 'planning', label: 'Planning', icon: Calendar, color: '#f59e0b' },
    { id: 'travaux', label: 'Travaux', icon: Hammer, color: '#a855f7' },
    { id: 'stock', label: 'Stock', icon: Package, color: '#ef4444' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, color: '#8b5cf6' },
  ];

  return (
    <WidgetWrapper title="Accès rapide" icon={ExternalLink} color="#6366f1" onRemove={onRemove} compact>
      <div className="h-full flex items-center justify-around">
        {links.map(link => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              onClick={() => setModuleActif(link.id)}
              className="flex flex-col items-center gap-1 p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <Icon className="w-5 h-5" style={{ color: link.color }} />
              <span className="text-[10px] text-[var(--text-tertiary)]">{link.label}</span>
            </button>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}

export function ChecklistWidget({ onRemove }: { onRemove?: () => void }) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');

  const { data: items } = useQuery({
    queryKey: ['checklist', CURRENT_USER_ID],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('technicien_id', CURRENT_USER_ID)
        .eq('date', today)
        .order('created_at');
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      await supabase.from('checklist_items').insert({
        technicien_id: CURRENT_USER_ID,
        text,
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      setNewItem('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await supabase.from('checklist_items').update({ completed }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('checklist_items').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist'] }),
  });

  const handleAdd = () => {
    if (newItem.trim()) {
      addMutation.mutate(newItem.trim());
    }
  };

  return (
    <WidgetWrapper title="Checklist du jour" icon={Check} color="#6366f1" onRemove={onRemove}>
      <div className="h-full flex flex-col">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nouvelle tâche..."
            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder-dark-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleAdd}
            className="p-1 bg-purple-600 hover:bg-purple-500 rounded text-[var(--text-primary)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto space-y-1">
          {items?.map(item => (
            <div 
              key={item.id}
              className={`flex items-center gap-2 p-1.5 rounded group ${
                item.completed ? 'bg-[var(--bg-tertiary)]/50' : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <button
                onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })}
                className={`w-4 h-4 rounded border flex items-center justify-center ${
                  item.completed 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-dark-500 hover:border-purple-500'
                }`}
              >
                {item.completed && <Check className="w-3 h-3 text-[var(--text-primary)]" />}
              </button>
              <span className={`flex-1 text-xs ${item.completed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                {item.text}
              </span>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-elevated)] rounded"
              >
                <Trash2 className="w-3 h-3 text-[var(--text-tertiary)]" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}

// ============================================
// WIDGETS SYNERGIES
// ============================================

import { TechnicienDashboard } from '@/components/integrations/TechnicienDashboard';
import { AlerteStock } from '@/components/integrations/AlerteStockReappro';
import { SuiviVehicule } from '@/components/integrations/SuiviVehicule';
import { PlanningTravaux } from '@/components/integrations/PlanningTravaux';

// Widget Dashboard Technicien
export function TechnicienDashboardWidget({ onRemove }: { onRemove?: () => void }) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardBody className="p-2 flex-1 overflow-auto">
        <TechnicienDashboard />
      </CardBody>
    </Card>
  );
}

// Widget Alertes Stock avec Réappro
export function AlertesStockReapproWidget({ onRemove }: { onRemove?: () => void }) {
  return (
    <WidgetWrapper title="Alertes Stock" icon={AlertTriangle} color="#f59e0b" onRemove={onRemove}>
      <div className="p-2 overflow-auto">
        <AlerteStock compact showCreateButton />
      </div>
    </WidgetWrapper>
  );
}

// Widget Suivi Véhicule
export function SuiviVehiculeWidget({ onRemove }: { onRemove?: () => void }) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardBody className="p-2 flex-1 overflow-auto">
        <SuiviVehicule />
      </CardBody>
    </Card>
  );
}

// Widget Planning Travaux
export function PlanningTravauxWidget({ onRemove }: { onRemove?: () => void }) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardBody className="p-2 flex-1 overflow-auto">
        <PlanningTravaux />
      </CardBody>
    </Card>
  );
}

// ============================================
// WIDGET PIÈCES REMPLACÉES
// ============================================

export function PiecesRemplaceesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-pieces-remplacees'],
    queryFn: async () => {
      // Récupérer les dernières pièces remplacées (30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateDebut = thirtyDaysAgo.toISOString();
      
      // 1. Depuis stock_mouvements (avec code_appareil)
      const { data: mouvements } = await supabase
        .from('stock_mouvements')
        .select(`
          id,
          date_mouvement,
          quantite,
          code_appareil,
          article:article_id(designation, reference)
        `)
        .eq('type_mouvement', 'sortie')
        .not('code_appareil', 'is', null)
        .gte('date_mouvement', dateDebut)
        .order('date_mouvement', { ascending: false })
        .limit(30);

      // 2. Depuis travaux terminés avec pièces consommées
      const { data: travaux } = await supabase
        .from('travaux')
        .select(`
          id,
          code,
          titre,
          pieces,
          updated_at,
          ascenseur:ascenseur_id(code_appareil)
        `)
        .eq('statut', 'termine')
        .not('pieces', 'is', null)
        .gte('updated_at', dateDebut)
        .order('updated_at', { ascending: false })
        .limit(30);

      // Combiner les résultats
      const allPieces: any[] = [];

      // Ajouter les mouvements
      (mouvements || []).forEach((m: any) => {
        allPieces.push({
          id: m.id,
          date: m.date_mouvement,
          code_appareil: m.code_appareil,
          designation: m.article?.designation || 'Article',
          quantite: m.quantite,
          source: 'mouvement',
        });
      });

      // Ajouter les pièces des travaux
      (travaux || []).forEach((t: any) => {
        if (t.pieces && Array.isArray(t.pieces)) {
          const codeAppareil = t.ascenseur?.code_appareil;
          if (!codeAppareil) return;

          t.pieces.forEach((p: any) => {
            if (!p.consommee) return;

            // Éviter les doublons
            const exists = allPieces.find(
              existing => 
                existing.code_appareil === codeAppareil &&
                existing.designation === p.designation &&
                existing.quantite === p.quantite &&
                existing.date?.substring(0, 10) === t.updated_at?.substring(0, 10)
            );

            if (!exists) {
              allPieces.push({
                id: `travaux-${t.id}-${p.id || p.designation}`,
                date: t.updated_at,
                code_appareil: codeAppareil,
                designation: p.designation,
                quantite: p.quantite,
                source: 'travaux',
              });
            }
          });
        }
      });

      // Trier par date
      allPieces.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Stats
      const totalPieces = allPieces.reduce((acc, p) => acc + p.quantite, 0);
      const appareilsUniques = new Set(allPieces.map(p => p.code_appareil)).size;
      
      // Aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      const piecesAujourdhui = allPieces
        .filter(p => p.date?.startsWith(today))
        .reduce((acc, p) => acc + p.quantite, 0);

      return {
        pieces: allPieces.slice(0, 20),
        stats: {
          total: totalPieces,
          appareils: appareilsUniques,
          aujourdhui: piecesAujourdhui,
        }
      };
    },
    refetchInterval: 60000, // Refresh toutes les minutes
  });

  return (
    <WidgetWrapper title="Pièces remplacées" icon={Package} color="#a855f7" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-purple-400">{data?.stats.aujourdhui || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Aujourd'hui</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{data?.stats.total || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">30 jours</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{data?.stats.appareils || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Appareils</p>
            </div>
          </div>

          {/* Liste des dernières pièces */}
          <div className="space-y-1.5 max-h-[300px] overflow-auto">
            {data?.pieces.length === 0 ? (
              <div className="text-center py-4 text-[var(--text-muted)] text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Aucune pièce remplacée
              </div>
            ) : (
              data?.pieces.slice(0, 10).map((p: any) => (
                <div 
                  key={p.id}
                  className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {p.designation}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      <span className="font-mono">{p.code_appareil}</span>
                      <span>•</span>
                      <span>{format(parseISO(p.date), 'dd/MM HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  <Badge variant="purple" className="text-[10px] ml-2">×{p.quantite}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGET TRAVAUX BLOQUÉS PAR STOCK
// ============================================

export function TravauxBloquesStockWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-travaux-bloques'],
    queryFn: async () => {
      // Récupérer les travaux non terminés avec des pièces
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code, titre, code_appareil, pieces, statut')
        .in('statut', ['planifie', 'en_cours'])
        .not('pieces', 'is', null);

      // Récupérer le stock actuel
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite_stock');

      const stockMap = new Map((articles || []).map((a: any) => [a.id, a]));

      // Identifier les pièces manquantes
      const manquantes: any[] = [];

      (travaux || []).forEach((t: any) => {
        if (t.pieces && Array.isArray(t.pieces)) {
          t.pieces.forEach((p: any) => {
            if (p.consommee) return;
            if (p.source !== 'stock') return;

            const article = p.article_id ? stockMap.get(p.article_id) : null;
            const stockDispo = article?.quantite_stock || 0;

            if (stockDispo < p.quantite) {
              manquantes.push({
                travaux_code: t.code,
                travaux_titre: t.titre,
                piece_designation: p.designation || article?.designation || 'Pièce',
                manquant: p.quantite - stockDispo,
                stock_disponible: stockDispo,
              });
            }
          });
        }
      });

      return {
        manquantes: manquantes.slice(0, 8),
        total: manquantes.length,
      };
    },
    refetchInterval: 60000,
  });

  return (
    <WidgetWrapper title="Travaux bloqués" icon={AlertTriangle} color="#ef4444" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Pièces manquantes</span>
            <Badge variant={data?.total ? 'red' : 'green'}>{data?.total || 0}</Badge>
          </div>

          {!data?.manquantes.length ? (
            <div className="text-center py-4 text-[var(--text-muted)]">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">Aucun blocage</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-auto">
              {data.manquantes.map((item: any, idx: number) => (
                <div key={idx} className="p-2 bg-red-500/10 rounded-lg">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {item.piece_designation}
                  </p>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                    <span>{item.travaux_code}</span>
                    <span className="text-red-400 font-bold">-{item.manquant}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGET TRAVAUX PAR TOURNÉE
// ============================================

export function TravauxParTourneeWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-travaux-tournee'],
    queryFn: async () => {
      // Récupérer les travaux non terminés
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code, titre, code_appareil, statut')
        .in('statut', ['planifie', 'en_cours'])
        .not('code_appareil', 'is', null);

      // Récupérer les ascenseurs avec tournées
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, secteur, ordre2')
        .not('ordre2', 'is', null)
        .gt('ordre2', 0);

      const ascMap = new Map((ascenseurs || []).map((a: any) => [a.code_appareil, a]));

      // Grouper par tournée
      const tourneesMap = new Map<string, { secteur: number; ordre2: number; count: number }>();

      (travaux || []).forEach((t: any) => {
        const asc = ascMap.get(t.code_appareil);
        if (!asc) return;

        const key = `${asc.secteur}-${asc.ordre2}`;
        if (!tourneesMap.has(key)) {
          tourneesMap.set(key, { secteur: asc.secteur, ordre2: asc.ordre2, count: 0 });
        }
        tourneesMap.get(key)!.count++;
      });

      const tournees = Array.from(tourneesMap.values())
        .filter(t => t.count > 0)
        .sort((a, b) => b.count - a.count);

      return {
        tournees: tournees.slice(0, 6),
        total: tournees.reduce((acc, t) => acc + t.count, 0),
      };
    },
    refetchInterval: 60000,
  });

  return (
    <WidgetWrapper title="Travaux / tournée" icon={Car} color="#22c55e" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Total travaux</span>
            <Badge variant="purple">{data?.total || 0}</Badge>
          </div>

          {!data?.tournees.length ? (
            <div className="text-center py-4 text-[var(--text-muted)]">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">Aucun travaux en tournée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.tournees.map((t: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-sm font-semibold text-lime-400">
                    S{t.secteur} - T{t.ordre2}
                  </span>
                  <Badge variant="amber">{t.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}

// ============================================
// WIDGET ANALYSE PRÉDICTIVE
// ============================================

export function AnalysePredictiveWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-analyse-predictive'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Récupérer les pannes des 6 derniers mois
      const { data: pannes } = await supabase
        .from('parc_pannes')
        .select('code_appareil, date_appel')
        .gte('date_appel', sixMonthsAgo.toISOString());

      // Compter par appareil
      const countMap = new Map<string, number>();
      (pannes || []).forEach((p: any) => {
        countMap.set(p.code_appareil, (countMap.get(p.code_appareil) || 0) + 1);
      });

      // Récupérer les infos des appareils à risque (>= 3 pannes)
      const risques = Array.from(countMap.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const codes = risques.map(r => r[0]);
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville')
        .in('code_appareil', codes);

      const ascMap = new Map((ascenseurs || []).map((a: any) => [a.code_appareil, a]));

      return {
        appareils: risques.map(([code, count]) => ({
          code_appareil: code,
          adresse: ascMap.get(code)?.adresse || '',
          ville: ascMap.get(code)?.ville || '',
          nb_pannes: count,
        })),
        totalARisque: risques.length,
      };
    },
    refetchInterval: 300000,
  });

  return (
    <WidgetWrapper title="Appareils à risque" icon={AlertTriangle} color="#f97316" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">≥3 pannes/6 mois</span>
            <Badge variant={data?.totalARisque ? 'red' : 'green'}>{data?.totalARisque || 0}</Badge>
          </div>

          {!data?.appareils.length ? (
            <div className="text-center py-4 text-[var(--text-muted)]">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">Aucun appareil à risque</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.appareils.map((a: any, idx: number) => (
                <div key={idx} className="p-2 bg-orange-500/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold text-[var(--text-primary)]">
                      {a.code_appareil}
                    </span>
                    <Badge variant="red">{a.nb_pannes} pannes</Badge>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {a.adresse}, {a.ville}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}


// ============================================
// WIDGET TRAVAUX PAR SECTEUR
// ============================================

export function TravauxParSecteurWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-travaux-par-secteur'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil, priorite')
        .in('statut', ['planifie', 'en_cours'])
        .not('code_appareil', 'is', null);

      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, secteur');

      if (!travaux || !ascenseurs) return [];

      const ascMap = new Map(ascenseurs.map((a: any) => [a.code_appareil, a.secteur]));
      
      // Compter par secteur
      const parSecteur: Record<number, { total: number; urgents: number }> = {};
      travaux.forEach((t: any) => {
        const secteur = ascMap.get(t.code_appareil);
        if (secteur) {
          if (!parSecteur[secteur]) parSecteur[secteur] = { total: 0, urgents: 0 };
          parSecteur[secteur].total++;
          if (t.priorite === 'urgente' || t.priorite === 'haute') {
            parSecteur[secteur].urgents++;
          }
        }
      });

      return Object.entries(parSecteur)
        .map(([secteur, data]) => ({ secteur: Number(secteur), ...data }))
        .sort((a, b) => b.urgents - a.urgents || b.total - a.total);
    },
  });

  return (
    <WidgetWrapper title="Travaux / Secteur" icon={Truck} color="#22c55e" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-4 text-[var(--text-muted)]">
          <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-sm">Aucun travaux en attente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 6).map((s: any) => (
            <div key={s.secteur} className="flex items-center justify-between text-sm p-2 bg-[var(--bg-tertiary)] rounded-lg">
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold">
                  S{s.secteur}
                </span>
                <span className="text-[var(--text-secondary)]">{s.total} travaux</span>
              </span>
              {s.urgents > 0 && (
                <Badge variant="red">{s.urgents}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}


// ============================================
// WIDGET STOCK ALERTES PRÉVENTIVES
// ============================================

export function StockAlertesPreventivesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-stock-alertes-preventives'],
    queryFn: async () => {
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, quantite_stock, seuil_alerte');

      const articlesBasStock = articles?.filter((a: any) => 
        a.quantite_stock <= (a.seuil_alerte || 5)
      ) || [];

      // Vérifier les travaux en attente de pièces
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil, pieces')
        .in('statut', ['planifie', 'en_cours'])
        .not('pieces', 'is', null);

      // Vérifier les appareils en panne
      const { data: pannes } = await supabase
        .from('parc_pannes')
        .select('code_appareil')
        .is('date_fin_panne', null);

      const pannesSet = new Set(pannes?.map((p: any) => p.code_appareil) || []);

      // Identifier les alertes critiques
      let critiques = 0;
      articlesBasStock.forEach((art: any) => {
        if (art.quantite_stock === 0) critiques++;
      });

      return {
        critiques,
        alertes: articlesBasStock.filter((a: any) => a.quantite_stock > 0).length,
        articles: articlesBasStock.slice(0, 5),
        pannesActives: pannes?.length || 0,
      };
    },
  });

  return (
    <WidgetWrapper title="Alertes stock" icon={Package} color="#f97316" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-red-500/10 rounded-lg">
              <p className="text-lg font-bold text-red-400">{data?.critiques || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Ruptures</p>
            </div>
            <div className="text-center p-2 bg-orange-500/10 rounded-lg">
              <p className="text-lg font-bold text-orange-400">{data?.alertes || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Stock bas</p>
            </div>
          </div>

          {data?.articles && data.articles.length > 0 && (
            <div className="space-y-1">
              {data.articles.map((art: any) => (
                <div key={art.id} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
                  <span className="truncate flex-1">{art.designation}</span>
                  <span className={`font-bold ml-2 ${art.quantite_stock === 0 ? 'text-red-400' : 'text-orange-400'}`}>
                    {art.quantite_stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}


// ============================================
// WIDGET TRAVAUX À PLANIFIER
// ============================================

export function TravauxAPlanifierWidget({ onRemove }: { onRemove?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-travaux-a-planifier'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code, titre, priorite, date_butoir')
        .in('statut', ['planifie', 'en_cours']);

      const { data: events } = await supabase
        .from('planning_events')
        .select('travaux_id')
        .not('travaux_id', 'is', null);

      const planifiesIds = new Set(events?.map((e: any) => e.travaux_id) || []);
      const nonPlanifies = travaux?.filter((t: any) => !planifiesIds.has(t.id)) || [];

      const urgents = nonPlanifies.filter((t: any) => 
        t.priorite === 'urgente' || t.priorite === 'haute'
      ).length;

      const now = new Date();
      const enRetard = nonPlanifies.filter((t: any) => {
        if (!t.date_butoir) return false;
        return new Date(t.date_butoir) < now;
      }).length;

      return {
        total: nonPlanifies.length,
        urgents,
        enRetard,
        travaux: nonPlanifies.slice(0, 5),
      };
    },
  });

  return (
    <WidgetWrapper title="À planifier" icon={Calendar} color="#3b82f6" onRemove={onRemove}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-blue-500/10 rounded-lg">
              <p className="text-lg font-bold text-blue-400">{data?.total || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Total</p>
            </div>
            <div className="text-center p-2 bg-orange-500/10 rounded-lg">
              <p className="text-lg font-bold text-orange-400">{data?.urgents || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Urgents</p>
            </div>
            <div className="text-center p-2 bg-red-500/10 rounded-lg">
              <p className="text-lg font-bold text-red-400">{data?.enRetard || 0}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Retard</p>
            </div>
          </div>

          {data?.travaux && data.travaux.length > 0 && (
            <div className="space-y-1">
              {data.travaux.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
                  <span className="font-mono text-purple-400">{t.code}</span>
                  <span className={`font-bold ${
                    t.priorite === 'urgente' ? 'text-red-400' : 
                    t.priorite === 'haute' ? 'text-orange-400' : 'text-[var(--text-muted)]'
                  }`}>
                    {t.priorite?.charAt(0).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
