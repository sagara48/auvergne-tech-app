import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function RealtimeStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Canal dédié pour surveiller la connexion
    const channel = supabase
      .channel('connection-monitor')
      .subscribe((state, err) => {
        if (state === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (state === 'CLOSED' || state === 'CHANNEL_ERROR') {
          setStatus('disconnected');
        } else if (state === 'TIMED_OUT') {
          setStatus('reconnecting');
        } else {
          setStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statusConfig = {
    connecting: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
      label: 'Connexion en cours...',
      animate: true,
    },
    connected: {
      icon: Wifi,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      label: 'Temps réel actif',
      animate: false,
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      label: 'Déconnecté - Tentative de reconnexion...',
      animate: false,
    },
    reconnecting: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
      label: 'Reconnexion en cours...',
      animate: true,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`p-1.5 rounded-lg ${config.bg} cursor-help`}>
        <Icon 
          className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
        />
      </div>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap z-50 bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-lg">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              status === 'connected' ? 'bg-green-400' : 
              status === 'disconnected' ? 'bg-red-400' : 'bg-amber-400'
            }`} />
            {config.label}
          </div>
        </div>
      )}
    </div>
  );
}
