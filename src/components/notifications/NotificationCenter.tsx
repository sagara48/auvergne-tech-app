import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Check, CheckCheck, X, Settings, Volume2,
  AlertTriangle, Hammer, MessageCircle, Package, Calendar, FileCheck,
  StickyNote, Info, Clock, Archive, AlertCircle
} from 'lucide-react';
import { Button, Badge, Switch } from '@/components/ui';
import { 
  getNotifications, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead, archiveNotification, getNotificationPreferences,
  updateNotificationPreferences
} from '@/services/api';
import {
  Alert,
  subscribeToAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  dismissAlert,
  clearAllAlerts,
} from '@/services/alertService';
import { useAppStore } from '@/stores/appStore';
import type { Notification, NotificationType, NotificationPreferences } from '@/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// ═══ Type config — shared for both sources ═══
const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { 
  icon: any; color: string; label: string; defaultIcon: string;
}> = {
  panne: { icon: AlertTriangle, color: '#ef4444', label: 'Panne', defaultIcon: '🚨' },
  travaux: { icon: Hammer, color: '#B91C1C', label: 'Travaux', defaultIcon: '🔧' },
  mise_service: { icon: FileCheck, color: '#f97316', label: 'Mise en service', defaultIcon: '📋' },
  stock: { icon: Package, color: '#f59e0b', label: 'Stock', defaultIcon: '📦' },
  message: { icon: MessageCircle, color: '#B91C1C', label: 'Message', defaultIcon: '💬' },
  planning: { icon: Calendar, color: '#3b82f6', label: 'Planning', defaultIcon: '📅' },
  note: { icon: StickyNote, color: '#eab308', label: 'Note', defaultIcon: '📝' },
  system: { icon: Info, color: '#6b7280', label: 'Système', defaultIcon: 'ℹ️' },
};

const ALERT_SEVERITY_CONFIG = {
  critical: { color: '#ef4444', icon: AlertTriangle, label: 'Critique' },
  warning: { color: '#f59e0b', icon: AlertCircle, label: 'Attention' },
  info: { color: '#3b82f6', icon: Info, label: 'Info' },
};

const PRIORITY_CONFIG = {
  urgent: { bg: 'bg-red-500/10', border: 'border-red-500/30', pulse: true },
  high: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', pulse: false },
  normal: { bg: 'bg-transparent', border: 'border-transparent', pulse: false },
  low: { bg: 'bg-transparent', border: 'border-transparent', pulse: false },
};

// ═══ Unified item type ═══
interface UnifiedItem {
  id: string;
  source: 'notification' | 'alert';
  title: string;
  message: string;
  icon: string;
  color: string;
  date: Date;
  read: boolean;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  // Original refs for actions
  notification?: Notification;
  alert?: Alert;
}

function mergeItems(notifications: Notification[], alerts: Alert[]): UnifiedItem[] {
  const notifItems: UnifiedItem[] = notifications.map(n => {
    const config = NOTIFICATION_TYPE_CONFIG[n.type];
    return {
      id: `notif-${n.id}`,
      source: 'notification' as const,
      title: n.titre,
      message: n.message || '',
      icon: n.icone || config.defaultIcon,
      color: config.color,
      date: parseISO(n.created_at),
      read: n.lue,
      priority: n.priority,
      notification: n,
    };
  });

  const alertItems: UnifiedItem[] = alerts.map(a => {
    const sev = ALERT_SEVERITY_CONFIG[a.severity];
    return {
      id: `alert-${a.id}`,
      source: 'alert' as const,
      title: a.title,
      message: a.message,
      icon: a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : 'ℹ️',
      color: sev.color,
      date: a.createdAt,
      read: a.read,
      priority: a.severity === 'critical' ? 'urgent' : a.severity === 'warning' ? 'high' : 'normal',
      alert: a,
    };
  });

  return [...notifItems, ...alertItems].sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ═══ Unified notification item ═══
function UnifiedNotifItem({ 
  item, onRead, onDismiss, onClick 
}: { 
  item: UnifiedItem; onRead: () => void; onDismiss: () => void; onClick: () => void;
}) {
  const isUrgent = item.priority === 'urgent';
  const priorityConfig = PRIORITY_CONFIG[item.priority];

  return (
    <div 
      className={`
        relative p-2.5 rounded-[10px] border cursor-pointer group transition-all
        ${priorityConfig.bg} ${priorityConfig.border}
        ${item.read ? 'opacity-50' : ''}
        hover:bg-[var(--bg-tertiary)]
      `}
      onClick={onClick}
    >
      {!item.read && (
        <div className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full`} style={{ background: item.color }} />
      )}
      {isUrgent && !item.read && (
        <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
      )}

      <div className="flex gap-2.5">
        <div 
          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 text-sm"
          style={{ backgroundColor: `${item.color}15` }}
        >
          {item.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[12px] font-semibold text-[var(--text-primary)] truncate ${item.read ? 'font-normal' : ''}`}>
              {item.title}
            </span>
            {isUrgent && !item.read && (
              <span className="text-[8px] font-bold text-red-500 bg-red-500/15 px-1.5 py-0.5 rounded">URGENT</span>
            )}
          </div>
          {item.message && (
            <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-1">
              {item.message}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
            <Clock className="w-2.5 h-2.5" />
            <span>{formatDistanceToNow(item.date, { addSuffix: true, locale: fr })}</span>
            <span className="opacity-40">·</span>
            <span style={{ color: item.color, fontWeight: 600 }}>
              {item.source === 'alert' ? 'Alerte' : 'Notification'}
            </span>
          </div>
        </div>

        {/* Actions on hover */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!item.read && (
            <button
              onClick={(e) => { e.stopPropagation(); onRead(); }}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[#059669]"
              title="Marquer comme lu"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[#EA580C]"
            title="Supprimer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ Preferences Modal ═══
function PreferencesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  
  const { data: prefs } = useQuery({
    queryKey: ['notification-prefs', CURRENT_USER_ID],
    queryFn: () => getNotificationPreferences(CURRENT_USER_ID),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<NotificationPreferences>) => 
      updateNotificationPreferences(CURRENT_USER_ID, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] });
      toast.success('Préférences sauvegardées');
    },
  });

  const togglePref = (key: keyof NotificationPreferences) => {
    if (prefs) {
      updateMutation.mutate({ [key]: !prefs[key] });
    }
  };

  const typePrefs = [
    { key: 'panne_enabled', label: 'Pannes', icon: '🚨', color: '#ef4444' },
    { key: 'travaux_enabled', label: 'Travaux', icon: '🔧', color: '#B91C1C' },
    { key: 'mise_service_enabled', label: 'Mises en service', icon: '📋', color: '#f97316' },
    { key: 'stock_enabled', label: 'Stock', icon: '📦', color: '#f59e0b' },
    { key: 'message_enabled', label: 'Messages', icon: '💬', color: '#B91C1C' },
    { key: 'planning_enabled', label: 'Planning', icon: '📅', color: '#3b82f6' },
    { key: 'note_enabled', label: 'Notes', icon: '📝', color: '#eab308' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="w-[380px] rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-secondary)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#B91C1C]" />
            Préférences
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-[8px]">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[55vh] overflow-y-auto">
          <div>
            <h4 className="text-[11px] font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
              Types de notifications
            </h4>
            <div className="space-y-1.5">
              {typePrefs.map(({ key, label, icon }) => (
                <div key={key} className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--bg-tertiary)]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{icon}</span>
                    <span className="text-[12px] text-[var(--text-primary)]">{label}</span>
                  </div>
                  <Switch
                    checked={prefs?.[key as keyof NotificationPreferences] as boolean ?? true}
                    onChange={() => togglePref(key as keyof NotificationPreferences)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
              Options
            </h4>
            <div className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-[12px] text-[var(--text-primary)]">Sons</span>
              </div>
              <Switch
                checked={prefs?.sound_enabled ?? true}
                onChange={() => togglePref('sound_enabled')}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border-secondary)]">
          <Button variant="secondary" className="w-full" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// UNIFIED NOTIFICATION CENTER
// ═══════════════════════════════════════════════════

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { setModuleActif } = useAppStore();

  // Subscribe to local alerts (from alertService)
  useEffect(() => {
    const unsubscribe = subscribeToAlerts(setLocalAlerts);
    return unsubscribe;
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Supabase notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications', CURRENT_USER_ID],
    queryFn: () => getNotifications(CURRENT_USER_ID, { limit: 20 }),
    refetchInterval: 30000,
  });

  const { data: dbUnreadCount } = useQuery({
    queryKey: ['notifications-unread-count', CURRENT_USER_ID],
    queryFn: () => getUnreadNotificationCount(CURRENT_USER_ID),
    refetchInterval: 15000,
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(CURRENT_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Combined unread count
  const alertUnreadCount = localAlerts.filter(a => !a.read).length;
  const totalUnread = (dbUnreadCount || 0) + alertUnreadCount;

  // Merge + filter
  const allItems = mergeItems(notifications || [], localAlerts);
  const filteredItems = filter === 'unread' ? allItems.filter(i => !i.read) : allItems;
  const urgentItems = filteredItems.filter(i => i.priority === 'urgent' && !i.read);
  const otherItems = filteredItems.filter(i => !(i.priority === 'urgent' && !i.read));

  // Handle mark all as read (both sources)
  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
    markAllAlertsAsRead();
    toast.success('Tout marqué comme lu');
  };

  // Handle item click
  const handleItemClick = (item: UnifiedItem) => {
    // Mark as read
    if (!item.read) {
      if (item.source === 'notification' && item.notification) {
        markReadMutation.mutate(item.notification.id);
      } else if (item.source === 'alert' && item.alert) {
        markAlertAsRead(item.alert.id);
      }
    }
    // Navigate
    if (item.notification?.lien_type) {
      const moduleMap: Record<string, string> = {
        ascenseur: 'ascenseurs', travaux: 'travaux', miseservice: 'miseservice',
        chat: 'chat', stock: 'stock', planning: 'planning', note: 'notes',
      };
      const module = moduleMap[item.notification.lien_type];
      if (module) {
        setModuleActif(module);
        setIsOpen(false);
      }
    } else if (item.alert?.actionUrl) {
      window.location.href = item.alert.actionUrl;
      setIsOpen(false);
    }
  };

  // Handle read single
  const handleRead = (item: UnifiedItem) => {
    if (item.source === 'notification' && item.notification) {
      markReadMutation.mutate(item.notification.id);
    } else if (item.source === 'alert' && item.alert) {
      markAlertAsRead(item.alert.id);
    }
  };

  // Handle dismiss
  const handleDismiss = (item: UnifiedItem) => {
    if (item.source === 'notification' && item.notification) {
      archiveMutation.mutate(item.notification.id);
    } else if (item.source === 'alert' && item.alert) {
      dismissAlert(item.alert.id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Single bell button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-1.5 rounded-[8px] transition-all
          hover:bg-[var(--bg-hover)]
          ${isOpen ? 'bg-[var(--bg-hover)]' : ''}
        `}
      >
        <Bell className={`w-4 h-4 ${totalUnread > 0 ? 'text-[#B91C1C]' : 'text-[var(--text-muted)]'}`} />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#B91C1C] rounded-full text-[9px] text-white font-bold flex items-center justify-center px-1">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-[360px] rounded-xl overflow-hidden z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
          style={{ boxShadow: '0 8px 30px rgba(30,27,46,0.15)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#B91C1C]" />
              <span className="text-[13px] font-bold text-[var(--text-primary)]">Notifications</span>
              {totalUnread > 0 && (
                <span className="text-[9px] font-bold text-[#B91C1C] bg-[#B91C1C]/10 px-1.5 py-0.5 rounded-md">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {totalUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 rounded-[7px] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[#059669]"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowPrefs(true)}
                className="p-1.5 rounded-[7px] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Préférences"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-1 p-1.5 border-b border-[var(--border-secondary)]">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  flex-1 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors
                  ${filter === f 
                    ? 'bg-[#B91C1C] text-white' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }
                `}
              >
                {f === 'all' ? 'Toutes' : `Non lues${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
              </button>
            ))}
          </div>

          {/* Items list */}
          <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                <p className="text-[12px] text-[var(--text-muted)]">
                  {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                </p>
              </div>
            ) : (
              <>
                {/* Urgent section */}
                {urgentItems.length > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Urgentes</span>
                    </div>
                    {urgentItems.map(item => (
                      <UnifiedNotifItem
                        key={item.id}
                        item={item}
                        onRead={() => handleRead(item)}
                        onDismiss={() => handleDismiss(item)}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                )}

                {/* Other items */}
                {otherItems.length > 0 && (
                  <div>
                    {urgentItems.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Récentes</span>
                      </div>
                    )}
                    {otherItems.map(item => (
                      <UnifiedNotifItem
                        key={item.id}
                        item={item}
                        onRead={() => handleRead(item)}
                        onDismiss={() => handleDismiss(item)}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// DASHBOARD WIDGET (unchanged API)
// ═══════════════════════════════════════════════════

export function NotificationsWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  const queryClient = useQueryClient();
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAlerts(setLocalAlerts);
    return unsubscribe;
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ['notifications-widget', CURRENT_USER_ID],
    queryFn: () => getNotifications(CURRENT_USER_ID, { limit: 5, includeRead: false }),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-widget'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Merge sources for widget
  const allItems = mergeItems(notifications || [], localAlerts.slice(0, 5))
    .filter(i => !i.read)
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#B91C1C]" />
          <span className="text-[12px] font-bold text-[var(--text-primary)]">Notifications</span>
          {allItems.length > 0 && (
            <span className="text-[9px] font-bold text-[#B91C1C] bg-[#B91C1C]/10 px-1.5 py-0.5 rounded-md">{allItems.length}</span>
          )}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
            <X className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {allItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Bell className="w-8 h-8 mb-2 text-[var(--text-muted)] opacity-40" />
            <p className="text-[11px] text-[var(--text-muted)]">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allItems.map(item => (
              <div 
                key={item.id}
                className={`
                  p-2 rounded-[8px] cursor-pointer transition-all
                  ${item.priority === 'urgent' ? 'bg-red-500/8 border border-red-500/20' : 'bg-[var(--bg-tertiary)]'}
                  hover:bg-[var(--bg-hover)]
                `}
                onClick={() => {
                  if (item.notification) markReadMutation.mutate(item.notification.id);
                  if (item.alert) markAlertAsRead(item.alert.id);
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                      {item.title}
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)]">
                      {formatDistanceToNow(item.date, { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
