import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2, Zap, Users, Activity } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useRealtimePresence } from '@/hooks/useRealtimeSubscriptions';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function RealtimeStatusIndicator({ showDetails = false }: { showDetails?: boolean }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [showTooltip, setShowTooltip] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [channelCount, setChannelCount] = useState(0);
  const onlineUsers = useRealtimePresence();

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    
    // Canal dédié pour surveiller la connexion
    const channel = supabase
      .channel('connection-monitor')
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('connected');
          
          // Mesurer la latence toutes les 30s
          const measureLatency = async () => {
            const start = Date.now();
            try {
              await supabase.from('techniciens').select('id').limit(1);
              setLatency(Date.now() - start);
            } catch {
              setLatency(null);
            }
          };
          
          measureLatency();
          pingInterval = setInterval(measureLatency, 30000);
          
        } else if (state === 'CLOSED' || state === 'CHANNEL_ERROR') {
          setStatus('disconnected');
          setLatency(null);
        } else if (state === 'TIMED_OUT') {
          setStatus('reconnecting');
        } else {
          setStatus('connecting');
        }
      });

    // Compter les canaux actifs
    const updateChannelCount = () => {
      const channels = supabase.getChannels();
      setChannelCount(channels.length);
    };
    
    updateChannelCount();
    const countInterval = setInterval(updateChannelCount, 5000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(countInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const statusConfig = {
    connecting: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      label: 'Connexion en cours...',
      animate: true,
    },
    connected: {
      icon: Zap,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
      label: 'Temps réel actif',
      animate: false,
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      border: 'border-red-500/30',
      label: 'Déconnecté',
      animate: false,
    },
    reconnecting: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      label: 'Reconnexion...',
      animate: true,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Version compacte (icône seule)
  if (!showDetails) {
    return (
      <div 
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`p-1.5 rounded-lg ${config.bg} cursor-help transition-all`}>
          <Icon 
            className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
          />
        </div>
        
        {/* Indicateur pulsant si connecté */}
        {status === 'connected' && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
        
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap z-50 bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-primary)] shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${
                status === 'connected' ? 'bg-green-400 animate-pulse' : 
                status === 'disconnected' ? 'bg-red-400' : 'bg-amber-400'
              }`} />
              <span className="font-medium">{config.label}</span>
            </div>
            {status === 'connected' && (
              <div className="space-y-1 text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3" />
                  <span>{channelCount} canaux actifs</span>
                </div>
                {latency && (
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3 h-3" />
                    <span>Latence: {latency}ms</span>
                  </div>
                )}
                {onlineUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    <span>{onlineUsers.length} en ligne</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Version détaillée (barre complète)
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
      
      {status === 'connected' && (
        <>
          <div className="w-px h-4 bg-[var(--border-primary)]" />
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {channelCount} canaux
            </span>
            {latency && (
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                {latency}ms
              </span>
            )}
            {onlineUsers.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {onlineUsers.length} en ligne
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Version badge minimaliste pour header
export function RealtimeBadge() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('rt-badge')
      .subscribe((state) => {
        setConnected(state === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
      connected 
        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
      {connected ? 'LIVE' : 'OFFLINE'}
    </span>
  );
}
