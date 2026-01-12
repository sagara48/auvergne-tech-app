import { useState, useEffect } from 'react';
import { 
  Bell, X, CheckCheck, Trash2, AlertTriangle, AlertCircle, 
  Info, ChevronRight, Clock
} from 'lucide-react';
import { 
  Alert, 
  subscribeToAlerts, 
  markAlertAsRead, 
  markAllAlertsAsRead,
  dismissAlert,
  clearAllAlerts,
  getUnreadCount
} from '@/services/alertService';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function AlertCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  
  useEffect(() => {
    const unsubscribe = subscribeToAlerts(setAlerts);
    return unsubscribe;
  }, []);
  
  const unreadCount = alerts.filter(a => !a.read).length;
  const filteredAlerts = filter === 'unread' ? alerts.filter(a => !a.read) : alerts;
  
  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          badge: 'bg-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-orange-500/10 border-orange-500/30',
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
          badge: 'bg-orange-500'
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30',
          icon: <Info className="w-5 h-5 text-blue-500" />,
          badge: 'bg-blue-500'
        };
    }
  };
  
  return (
    <div className="relative">
      {/* Bouton d'ouverture */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
        title="Alertes"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-orange-500' : 'text-[var(--text-muted)]'}`} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Panel des alertes */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-96 max-h-[80vh] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Alertes
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Filtres et actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
                  <button
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1 text-sm rounded ${
                      filter === 'unread' 
                        ? 'bg-orange-500 text-white' 
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Non lues
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 text-sm rounded ${
                      filter === 'all' 
                        ? 'bg-orange-500 text-white' 
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Toutes
                  </button>
                </div>
                
                <div className="flex gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAlertsAsRead}
                      className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg"
                      title="Tout marquer comme lu"
                    >
                      <CheckCheck className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  {alerts.length > 0 && (
                    <button
                      onClick={clearAllAlerts}
                      className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg"
                      title="Effacer tout"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Liste des alertes */}
            <div className="flex-1 overflow-y-auto">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune alerte {filter === 'unread' ? 'non lue' : ''}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {filteredAlerts.map(alert => {
                    const styles = getSeverityStyles(alert.severity);
                    
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer ${
                          !alert.read ? styles.bg : ''
                        }`}
                        onClick={() => {
                          markAlertAsRead(alert.id);
                          if (alert.actionUrl) {
                            window.location.href = alert.actionUrl;
                            setIsOpen(false);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {styles.icon}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-medium text-sm ${!alert.read ? '' : 'text-[var(--text-muted)]'}`}>
                                {alert.title}
                              </p>
                              {!alert.read && (
                                <span className={`w-2 h-2 rounded-full ${styles.badge}`}></span>
                              )}
                            </div>
                            
                            <p className="text-sm text-[var(--text-muted)] line-clamp-2">
                              {alert.message}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: fr })}
                              </span>
                              
                              {alert.actionUrl && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-orange-500">
                                    Voir détails <ChevronRight className="w-3 h-3" />
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            className="p-1 hover:bg-[var(--bg-secondary)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4 text-[var(--text-muted)]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
