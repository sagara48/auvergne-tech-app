import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, Check, CheckCheck, X, Settings, Volume2,
  AlertTriangle, Hammer, MessageCircle, Package, Calendar, FileCheck,
  StickyNote, Info, Clock, Archive, Car, Send, Timer
} from 'lucide-react';
import { Button, Badge, Switch } from '@/components/ui';
import { 
  getNotifications, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead, archiveNotification, getNotificationPreferences,
  updateNotificationPreferences
} from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import type { Notification, NotificationType, NotificationPreferences } from '@/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Configuration des types de notification (étendue)
type ExtendedNotificationType = NotificationType | 'vehicule' | 'demande' | 'feuille_heures';

const NOTIFICATION_TYPE_CONFIG: Record<ExtendedNotificationType, { 
  icon: any; 
  color: string; 
  label: string;
  defaultIcon: string;
}> = {
  panne: { icon: AlertTriangle, color: '#ef4444', label: 'Panne', defaultIcon: '🚨' },
  travaux: { icon: Hammer, color: '#a855f7', label: 'Travaux', defaultIcon: '🔧' },
  mise_service: { icon: FileCheck, color: '#f97316', label: 'Mise en service', defaultIcon: '📋' },
  stock: { icon: Package, color: '#f59e0b', label: 'Stock', defaultIcon: '📦' },
  message: { icon: MessageCircle, color: '#8b5cf6', label: 'Message', defaultIcon: '💬' },
  planning: { icon: Calendar, color: '#3b82f6', label: 'Planning', defaultIcon: '📅' },
  note: { icon: StickyNote, color: '#eab308', label: 'Note', defaultIcon: '📝' },
  system: { icon: Info, color: '#6b7280', label: 'Système', defaultIcon: 'ℹ️' },
  vehicule: { icon: Car, color: '#06b6d4', label: 'Véhicule', defaultIcon: '🚐' },
  demande: { icon: Send, color: '#ec4899', label: 'Demande', defaultIcon: '📩' },
  feuille_heures: { icon: Timer, color: '#10b981', label: 'Heures', defaultIcon: '⏱️' },
};

const PRIORITY_CONFIG = {
  urgent: { bg: 'bg-red-500/20', border: 'border-red-500/50', pulse: true },
  high: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', pulse: false },
  normal: { bg: 'bg-transparent', border: 'border-transparent', pulse: false },
  low: { bg: 'bg-transparent', border: 'border-transparent', pulse: false },
};

// Composant notification individuelle
function NotificationItem({ 
  notification, 
  onRead, 
  onArchive,
  onClick 
}: { 
  notification: Notification;
  onRead: () => void;
  onArchive: () => void;
  onClick: () => void;
}) {
  const config = NOTIFICATION_TYPE_CONFIG[notification.type as ExtendedNotificationType] || NOTIFICATION_TYPE_CONFIG.system;
  const priorityConfig = PRIORITY_CONFIG[notification.priority];
  const Icon = config.icon;

  return (
    <div 
      className={`
        relative p-3 rounded-xl border cursor-pointer group transition-all
        ${priorityConfig.bg} ${priorityConfig.border}
        ${notification.lue ? 'opacity-60' : ''}
        hover:bg-[var(--bg-tertiary)]
      `}
      onClick={onClick}
    >
      {/* Indicateur non-lu */}
      {!notification.lue && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
      )}
      
      {/* Pulse pour urgent */}
      {priorityConfig.pulse && !notification.lue && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-ping" />
      )}

      <div className="flex gap-3">
        {/* Icône */}
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          {notification.icone || config.defaultIcon}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {notification.titre}
            </span>
            {notification.priority === 'urgent' && (
              <Badge variant="red" className="text-[10px] py-0">Urgent</Badge>
            )}
          </div>
          {notification.message && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-1">
              {notification.message}
            </p>
          )}
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true, locale: fr })}</span>
            <span>•</span>
            <span style={{ color: config.color }}>{config.label}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.lue && (
            <button
              onClick={(e) => { e.stopPropagation(); onRead(); }}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-green-400"
              title="Marquer comme lu"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            title="Archiver"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal préférences
function PreferencesModal({ 
  onClose 
}: { 
  onClose: () => void;
}) {
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
    { key: 'travaux_enabled', label: 'Travaux', icon: '🔧', color: '#a855f7' },
    { key: 'mise_service_enabled', label: 'Mises en service', icon: '📋', color: '#f97316' },
    { key: 'stock_enabled', label: 'Stock', icon: '📦', color: '#f59e0b' },
    { key: 'message_enabled', label: 'Messages', icon: '💬', color: '#8b5cf6' },
    { key: 'planning_enabled', label: 'Planning', icon: '📅', color: '#3b82f6' },
    { key: 'note_enabled', label: 'Notes', icon: '📝', color: '#eab308' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="w-[400px] rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-secondary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
            Préférences
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Types de notification */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Types de notifications
            </h4>
            <div className="space-y-2">
              {typePrefs.map(({ key, label, icon, color }) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-[var(--text-primary)]">{label}</span>
                  </div>
                  <Switch
                    checked={prefs?.[key as keyof NotificationPreferences] as boolean ?? true}
                    onChange={() => togglePref(key as keyof NotificationPreferences)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Options générales */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Options
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">Sons</span>
                </div>
                <Switch
                  checked={prefs?.sound_enabled ?? true}
                  onChange={() => togglePref('sound_enabled')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border-secondary)]">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

// Composant principal NotificationCenter
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { setModuleActif } = useAppStore();

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Query notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications', CURRENT_USER_ID],
    queryFn: () => getNotifications(CURRENT_USER_ID, { limit: 20 }),
    refetchInterval: 30000, // Refresh toutes les 30s
  });

  // Query compteur non-lus
  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread-count', CURRENT_USER_ID],
    queryFn: () => getUnreadNotificationCount(CURRENT_USER_ID),
    refetchInterval: 15000,
  });

  // Note: Le temps réel est géré globalement par useRealtimeSubscriptions

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
      toast.success('Toutes les notifications marquées comme lues');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Filtrer les notifications
  const filteredNotifications = notifications?.filter(n => {
    if (filter === 'unread') return !n.lue;
    return true;
  }) || [];

  // Séparer urgentes et autres
  const urgentNotifications = filteredNotifications.filter(n => 
    n.priority === 'urgent' && !n.lue
  );
  const otherNotifications = filteredNotifications.filter(n => 
    !(n.priority === 'urgent' && !n.lue)
  );

  // Navigation vers le lien
  const handleNotificationClick = (notification: Notification) => {
    // Marquer comme lue
    if (!notification.lue) {
      markReadMutation.mutate(notification.id);
    }
    
    // Navigation selon le type de lien
    if (notification.lien_type) {
      const moduleMap: Record<string, string> = {
        ascenseur: 'ascenseurs',
        travaux: 'travaux',
        miseservice: 'miseservice',
        chat: 'chat',
        stock: 'stock',
        planning: 'planning',
        note: 'notes',
      };
      const module = moduleMap[notification.lien_type];
      if (module) {
        setModuleActif(module);
        setIsOpen(false);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton notification */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2 rounded-lg transition-all
          bg-[var(--bg-tertiary)] border border-[var(--border-primary)]
          hover:bg-[var(--bg-hover)]
          ${isOpen ? 'ring-2 ring-[var(--accent-primary)]' : ''}
        `}
      >
        <Bell className={`w-5 h-5 ${unreadCount ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-2xl overflow-hidden shadow-2xl z-50 bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[var(--accent-primary)]" />
              <span className="font-semibold text-[var(--text-primary)]">Notifications</span>
              {unreadCount !== undefined && unreadCount > 0 && (
                <Badge variant="purple" className="text-[10px]">{unreadCount}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-green-400"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowPrefs(true)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                title="Préférences"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex gap-1 p-2 border-b border-[var(--border-secondary)]">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === f 
                    ? 'bg-[var(--accent-primary)] text-white' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }
                `}
              >
                {f === 'all' ? 'Toutes' : 'Non lues'}
              </button>
            ))}
          </div>

          {/* Liste des notifications */}
          <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-tertiary)]">
                  {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                </p>
              </div>
            ) : (
              <>
                {/* Urgentes */}
                {urgentNotifications.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] font-semibold text-red-400 uppercase">Urgentes</span>
                    </div>
                    <div className="space-y-2">
                      {urgentNotifications.map(notif => (
                        <NotificationItem
                          key={notif.id}
                          notification={notif}
                          onRead={() => markReadMutation.mutate(notif.id)}
                          onArchive={() => archiveMutation.mutate(notif.id)}
                          onClick={() => handleNotificationClick(notif)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Autres */}
                {otherNotifications.length > 0 && (
                  <div className="space-y-2">
                    {urgentNotifications.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <Clock className="w-3 h-3 text-[var(--text-tertiary)]" />
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase">
                          Récentes
                        </span>
                      </div>
                    )}
                    {otherNotifications.map(notif => (
                      <NotificationItem
                        key={notif.id}
                        notification={notif}
                        onRead={() => markReadMutation.mutate(notif.id)}
                        onArchive={() => archiveMutation.mutate(notif.id)}
                        onClick={() => handleNotificationClick(notif)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal préférences */}
      {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}
    </div>
  );
}

// Widget pour le dashboard
export function NotificationsWidget({ onRemove }: { onRemove?: () => void }) {
  const { setModuleActif } = useAppStore();
  const queryClient = useQueryClient();

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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
          {notifications && notifications.length > 0 && (
            <Badge variant="red" className="text-[10px]">{notifications.length}</Badge>
          )}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
            <X className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        {notifications?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Bell className="w-8 h-8 mb-2 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-tertiary)]">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications?.map(notif => {
              const config = NOTIFICATION_TYPE_CONFIG[notif.type];
              return (
                <div 
                  key={notif.id}
                  className={`
                    p-2 rounded-lg cursor-pointer group transition-all
                    ${notif.priority === 'urgent' ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--bg-tertiary)]'}
                    hover:bg-[var(--bg-hover)]
                  `}
                  onClick={() => markReadMutation.mutate(notif.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{notif.icone || config.defaultIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {notif.titre}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">
                        {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
