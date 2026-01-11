import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, MapPin, AlertTriangle, Clock, Search, Filter, RefreshCw,
  LayoutGrid, List, Map, ChevronDown, ChevronUp, Phone, Wrench,
  Calendar, User, Activity, TrendingUp, Zap, Timer, AlertCircle,
  CheckCircle, XCircle, Settings, Eye, FileText, BarChart3, Play,
  Pause, RotateCcw, Database, Cloud, CloudOff, Loader2, History,
  Server, Wifi, WifiOff, Download, Upload, X
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, formatDistanceToNow, parseISO, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// CONFIGURATION SYNC API
// =============================================
const SYNC_API_URL = import.meta.env.VITE_SYNC_API_URL || '';

// =============================================
// TYPES
// =============================================
interface Ascenseur {
  id: string;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal: string;
  secteur: number;
  marque: string;
  modele: string;
  type_appareil: string;
  type_planning: string;
  nb_visites_an: number;
  en_arret: boolean;
  dernier_passage: string;
  localisation: string;
  tel_cabine: string;
}

interface Arret {
  id: string;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  date_appel: string;
  heure_appel: string;
  motif: string;
  demandeur: string;
}

interface Panne {
  id: string;
  id_panne: number;
  id_wsoucont: number;
  code_appareil: string;
  date_appel: string;
  motif: string;
  cause: string;
  depanneur: string;
  duree_minutes: number;
  etat: string;
}

interface SyncLog {
  id: string;
  sync_date: string;
  sync_type: string;
  status: string;
  equipements_count: number;
  pannes_count: number;
  arrets_count: number;
  duration_seconds: number;
  error_message?: string;
}

interface SyncStep {
  id: string;
  label: string;
  endpoint: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: any;
}

// =============================================
// API FUNCTIONS
// =============================================

// Récupérer les secteurs autorisés pour l'utilisateur connecté
const getUserSecteurs = async (): Promise<number[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('user_secteurs')
      .select('secteur')
      .eq('user_id', user.id);
    
    if (error || !data || data.length === 0) {
      // Si pas de secteurs assignés ou erreur, retourner vide (= tous les secteurs)
      return [];
    }
    
    return data.map(d => d.secteur);
  } catch {
    return [];
  }
};

const getAscenseurs = async (secteur?: number, userSecteurs?: number[]) => {
  try {
    let query = supabase
      .from('parc_ascenseurs')
      .select('*')
      .order('code_appareil');
    
    // Filtre par secteur spécifique
    if (secteur) {
      query = query.eq('secteur', secteur);
    } 
    // Filtre par secteurs de l'utilisateur (si définis)
    else if (userSecteurs && userSecteurs.length > 0) {
      query = query.in('secteur', userSecteurs);
    }
    
    const { data, error } = await query;
    if (error) {
      console.warn('Table parc_ascenseurs non disponible:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
};

const getArrets = async () => {
  try {
    const { data, error } = await supabase
      .from('parc_arrets')
      .select('*')
      .order('date_appel', { ascending: false });
    if (error) {
      console.warn('Table parc_arrets non disponible:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
};

const getPannesRecentes = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('parc_pannes')
      .select('*')
      .order('date_appel', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Table parc_pannes non disponible:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
};

const getSecteurs = async () => {
  try {
    const { data, error } = await supabase
      .from('parc_secteurs')
      .select('*')
      .order('numero');
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
};

const getLastSync = async (): Promise<SyncLog | null> => {
  try {
    const { data, error } = await supabase
      .from('parc_sync_logs')
      .select('*')
      .order('sync_date', { ascending: false })
      .limit(1)
      .maybeSingle(); // Utiliser maybeSingle au lieu de single pour éviter l'erreur si vide
    if (error) return null;
    return data;
  } catch {
    return null;
  }
};

const getStats = async () => {
  try {
    const [ascenseursRes, arretsRes, pannesRes] = await Promise.all([
      supabase.from('parc_ascenseurs').select('id', { count: 'exact', head: true }),
      supabase.from('parc_arrets').select('id', { count: 'exact', head: true }),
      supabase.from('parc_pannes').select('id', { count: 'exact', head: true }).gte('date_appel', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    ]);
    
    return {
      total: ascenseursRes.count || 0,
      arrets: arretsRes.count || 0,
      pannes30j: pannesRes.count || 0
    };
  } catch {
    return { total: 0, arrets: 0, pannes30j: 0 };
  }
};

const getSyncLogs = async (limit = 20): Promise<SyncLog[]> => {
  try {
    const { data, error } = await supabase
      .from('parc_sync_logs')
      .select('*')
      .order('sync_date', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Table parc_sync_logs non disponible:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
};

// =============================================
// COMPOSANT: MODAL SYNCHRONISATION
// =============================================
const SYNC_STEPS_FULL: SyncStep[] = [
  { id: 'step0', label: 'Types planning', endpoint: '?step=0', status: 'pending' },
  { id: 'step1', label: 'Arrêts en cours', endpoint: '?step=1', status: 'pending' },
  ...Array.from({ length: 22 }, (_, i) => ({ 
    id: `step2-${i}`, 
    label: `Équipements secteur ${i + 1}/22`, 
    endpoint: `?step=2&sector=${i}`, 
    status: 'pending' as const 
  })),
  ...Array.from({ length: 22 }, (_, i) => ({ 
    id: `step2b-${i}`, 
    label: `Passages secteur ${i + 1}/22`, 
    endpoint: `?step=2b&sector=${i}`, 
    status: 'pending' as const 
  })),
  ...Array.from({ length: 7 }, (_, i) => ({ 
    id: `step3-${i}`, 
    label: `Pannes période ${i + 1}/7`, 
    endpoint: `?step=3&period=${i}`, 
    status: 'pending' as const 
  })),
  { id: 'step4', label: 'Finalisation', endpoint: '?step=4', status: 'pending' },
];

function SyncModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'logs'>('status');
  const [syncMode, setSyncMode] = useState<'quick' | 'full'>('quick');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<SyncStep[]>([]);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [apiUrl, setApiUrl] = useState(SYNC_API_URL || localStorage.getItem('sync_api_url') || '');
  
  // Refs pour accéder aux valeurs actuelles dans les closures async
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  
  // Sync les refs avec les states
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  
  const { data: lastSync, refetch: refetchLastSync } = useQuery({
    queryKey: ['last-sync'],
    queryFn: getLastSync,
    refetchInterval: isRunning ? 5000 : false
  });
  
  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => getSyncLogs(20)
  });
  
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['parc-stats-sync'],
    queryFn: getStats
  });

  // Sauvegarder l'URL API
  useEffect(() => {
    if (apiUrl) {
      localStorage.setItem('sync_api_url', apiUrl);
    }
  }, [apiUrl]);

  const addLog = (message: string) => {
    const timestamp = format(new Date(), 'HH:mm:ss');
    setSyncLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const callSyncApi = async (endpoint: string): Promise<any> => {
    if (!apiUrl) {
      throw new Error('URL API non configurée');
    }
    
    const url = `${apiUrl.replace(/\/$/, '')}/api/sync${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  };

  const runQuickSync = async () => {
    setIsRunning(true);
    setSyncLog([]);
    addLog('🚀 Démarrage sync rapide...');
    
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/api/cron`;
      addLog(`📡 Appel ${url}`);
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.status === 'success' || result.status === 'partial') {
        addLog(`✅ Sync terminée en ${result.duration}s`);
        addLog(`   📊 Arrêts: ${result.stats?.arrets || 0}`);
        addLog(`   📊 Pannes: ${result.stats?.pannes || 0}`);
        toast.success('Synchronisation rapide terminée');
      } else {
        addLog(`❌ Erreur: ${result.message || 'Erreur inconnue'}`);
        toast.error('Erreur lors de la synchronisation');
      }
    } catch (error: any) {
      addLog(`❌ Erreur: ${error.message}`);
      toast.error(error.message);
    } finally {
      setIsRunning(false);
      refetchLastSync();
      refetchStats();
      refetchLogs();
      queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });
      queryClient.invalidateQueries({ queryKey: ['parc-arrets'] });
    }
  };

  const runFullSync = async () => {
    setIsRunning(true);
    isRunningRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentStepIndex(0);
    setSyncLog([]);
    
    const stepsToRun = [...SYNC_STEPS_FULL].map(s => ({ ...s, status: 'pending' as const }));
    setSteps(stepsToRun);
    
    addLog('🚀 Démarrage synchronisation complète...');
    addLog(`   ${stepsToRun.length} étapes à exécuter`);
    
    for (let i = 0; i < stepsToRun.length; i++) {
      // Vérifier si en pause (utiliser ref pour avoir la valeur actuelle)
      while (isPausedRef.current && isRunningRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Vérifier si arrêté (utiliser ref)
      if (!isRunningRef.current) {
        addLog('⏹️ Synchronisation annulée');
        break;
      }
      
      setCurrentStepIndex(i);
      const step = stepsToRun[i];
      
      setSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'running' } : s
      ));
      
      addLog(`▶️ ${step.label}...`);
      
      try {
        const result = await callSyncApi(step.endpoint);
        
        setSteps(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'success', result } : s
        ));
        
        if (result.upserted || result.inserted || result.updated) {
          addLog(`   ✓ ${result.upserted || result.inserted || result.updated} enregistrements`);
        }
        
        // Petit délai entre les étapes
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        setSteps(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'error' } : s
        ));
        addLog(`   ❌ Erreur: ${error.message}`);
      }
    }
    
    addLog('🏁 Synchronisation complète terminée');
    toast.success('Synchronisation complète terminée');
    setIsRunning(false);
    isRunningRef.current = false;
    refetchLastSync();
    refetchStats();
    refetchLogs();
    queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });
    queryClient.invalidateQueries({ queryKey: ['parc-arrets'] });
  };

  const togglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    isPausedRef.current = newPaused;
    addLog(newPaused ? '⏸️ Pause...' : '▶️ Reprise...');
  };

  const stopSync = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    addLog('⏹️ Arrêt demandé...');
  };

  const progress = steps.length > 0 
    ? Math.round((steps.filter(s => s.status === 'success').length / steps.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Synchronisation Progilift</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {stats?.total || 0} ascenseurs • {stats?.arrets || 0} arrêts • {stats?.pannes30j || 0} pannes (30j)
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2">
              {[
                { id: 'status', label: 'État', icon: Activity },
                { id: 'sync', label: 'Synchroniser', icon: RefreshCw },
                { id: 'logs', label: 'Historique', icon: History }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* TAB: État */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                {/* Dernière sync */}
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Dernière synchronisation
                  </h3>
                  {lastSync ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Date</p>
                        <p className="font-medium">
                          {format(parseISO(lastSync.sync_date), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatDistanceToNow(parseISO(lastSync.sync_date), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Type</p>
                        <Badge variant={lastSync.sync_type === 'cron' ? 'blue' : 'purple'}>
                          {lastSync.sync_type === 'cron' ? 'Rapide' : 'Complète'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Statut</p>
                        <Badge variant={lastSync.status === 'success' ? 'green' : lastSync.status === 'partial' ? 'orange' : 'red'}>
                          {lastSync.status === 'success' ? 'Succès' : lastSync.status === 'partial' ? 'Partiel' : 'Erreur'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Durée</p>
                        <p className="font-medium">{lastSync.duration_seconds}s</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[var(--text-muted)]">Aucune synchronisation enregistrée</p>
                  )}
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                    <Database className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    <p className="text-xs text-[var(--text-muted)]">Ascenseurs</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    <p className="text-2xl font-bold">{stats?.arrets || 0}</p>
                    <p className="text-xs text-[var(--text-muted)]">Arrêts</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                    <Wrench className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                    <p className="text-2xl font-bold">{stats?.pannes30j || 0}</p>
                    <p className="text-xs text-[var(--text-muted)]">Pannes (30j)</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                    <Server className="w-6 h-6 mx-auto mb-2 text-green-400" />
                    <p className="text-2xl font-bold">{syncLogs?.length || 0}</p>
                    <p className="text-xs text-[var(--text-muted)]">Syncs</p>
                  </div>
                </div>
                
                {/* Config API */}
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" />
                    Configuration API
                  </h3>
                  <div className="flex gap-2">
                    <Input 
                      value={apiUrl}
                      onChange={e => setApiUrl(e.target.value)}
                      placeholder="https://votre-projet.vercel.app"
                      className="flex-1"
                    />
                    <Button 
                      variant="secondary" 
                      onClick={async () => {
                        try {
                          const res = await fetch(`${apiUrl}/api/sync`);
                          const data = await res.json();
                          if (data.status === 'ready') {
                            toast.success('Connexion API OK');
                          } else {
                            toast.error('Réponse inattendue');
                          }
                        } catch {
                          toast.error('Connexion impossible');
                        }
                      }}
                    >
                      <Wifi className="w-4 h-4" /> Tester
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    URL de base de l'API Vercel (sans /api/sync)
                  </p>
                </div>
              </div>
            )}
            
            {/* TAB: Synchroniser */}
            {activeTab === 'sync' && (
              <div className="space-y-4">
                {/* Mode de sync */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setSyncMode('quick')}
                    disabled={isRunning}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      syncMode === 'quick' 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-[var(--border-primary)] hover:border-blue-500/50'
                    }`}
                  >
                    <Zap className={`w-8 h-8 mx-auto mb-2 ${syncMode === 'quick' ? 'text-blue-500' : 'text-[var(--text-muted)]'}`} />
                    <p className="font-semibold">Sync Rapide</p>
                    <p className="text-xs text-[var(--text-muted)]">Arrêts + Pannes récentes (~10s)</p>
                  </button>
                  <button
                    onClick={() => setSyncMode('full')}
                    disabled={isRunning}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      syncMode === 'full' 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-[var(--border-primary)] hover:border-purple-500/50'
                    }`}
                  >
                    <Database className={`w-8 h-8 mx-auto mb-2 ${syncMode === 'full' ? 'text-purple-500' : 'text-[var(--text-muted)]'}`} />
                    <p className="font-semibold">Sync Complète</p>
                    <p className="text-xs text-[var(--text-muted)]">Tout le parc (~30 min)</p>
                  </button>
                </div>
                
                {/* Boutons de contrôle */}
                <div className="flex gap-2">
                  {!isRunning ? (
                    <Button 
                      variant="primary" 
                      className="flex-1"
                      onClick={syncMode === 'quick' ? runQuickSync : runFullSync}
                      disabled={!apiUrl}
                    >
                      <Play className="w-4 h-4" />
                      Démarrer {syncMode === 'quick' ? 'sync rapide' : 'sync complète'}
                    </Button>
                  ) : (
                    <>
                      {syncMode === 'full' && (
                        <Button variant="secondary" onClick={togglePause}>
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          {isPaused ? 'Reprendre' : 'Pause'}
                        </Button>
                      )}
                      <Button variant="danger" onClick={stopSync}>
                        <XCircle className="w-4 h-4" /> Arrêter
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Progression (sync complète) */}
                {syncMode === 'full' && steps.length > 0 && (
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progression</span>
                      <span className="text-sm font-bold text-blue-400">{progress}%</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden mb-3">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {steps.filter(s => s.status === 'success').length} OK
                      </span>
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                        {steps.filter(s => s.status === 'running').length} En cours
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" />
                        {steps.filter(s => s.status === 'error').length} Erreur
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {steps.filter(s => s.status === 'pending').length} En attente
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Log console */}
                <div className="p-4 bg-black/80 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-green-400 font-mono">Console</span>
                    <button 
                      onClick={() => setSyncLog([])}
                      className="text-xs text-[var(--text-muted)] hover:text-white"
                    >
                      Effacer
                    </button>
                  </div>
                  <div className="h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5">
                    {syncLog.length === 0 ? (
                      <p className="text-gray-500">En attente...</p>
                    ) : (
                      syncLog.map((log, i) => (
                        <p key={i} className={log.includes('❌') ? 'text-red-400' : log.includes('✅') || log.includes('✓') ? 'text-green-400' : 'text-gray-300'}>
                          {log}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* TAB: Historique */}
            {activeTab === 'logs' && (
              <div className="space-y-2">
                {syncLogs && syncLogs.length > 0 ? (
                  syncLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        log.status === 'success' ? 'bg-green-500' : 
                        log.status === 'partial' ? 'bg-orange-500' : 'bg-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(parseISO(log.sync_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </span>
                          <Badge variant={log.sync_type === 'cron' ? 'blue' : 'purple'} className="text-[10px]">
                            {log.sync_type === 'cron' ? 'Rapide' : 'Complète'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                          {log.equipements_count > 0 && <span>📦 {log.equipements_count}</span>}
                          {log.pannes_count > 0 && <span>🔧 {log.pannes_count}</span>}
                          {log.arrets_count > 0 && <span>⚠️ {log.arrets_count}</span>}
                          <span>⏱️ {log.duration_seconds}s</span>
                        </div>
                      </div>
                      <Badge variant={log.status === 'success' ? 'green' : log.status === 'partial' ? 'orange' : 'red'}>
                        {log.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun historique</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// COMPOSANTS
// =============================================

// Widget Ascenseurs à l'arrêt
function ArretsWidget({ arrets }: { arrets: Arret[] }) {
  if (arrets.length === 0) {
    return (
      <Card className="bg-green-500/10 border-green-500/30">
        <CardBody className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">0</p>
              <p className="text-sm text-[var(--text-muted)]">Ascenseur à l'arrêt</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <Card className="bg-red-500/10 border-red-500/30">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{arrets.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Ascenseur{arrets.length > 1 ? 's' : ''} à l'arrêt</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {arrets.slice(0, 5).map(arret => {
            const dateAppel = arret.date_appel ? parseISO(arret.date_appel) : new Date();
            const heuresArret = differenceInHours(new Date(), dateAppel);
            
            return (
              <div key={arret.id} className="flex items-center gap-3 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{arret.code_appareil}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{arret.adresse}, {arret.ville}</p>
                </div>
                <div className="text-right">
                  <Badge variant="red" className="text-[10px]">{heuresArret}h</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// Carte Ascenseur
function AscenseurCard({ ascenseur, onClick }: { ascenseur: Ascenseur; onClick: () => void }) {
  return (
    <Card 
      className={`cursor-pointer hover:border-orange-500/50 transition-all ${ascenseur.en_arret ? 'border-red-500/50 bg-red-500/5' : ''}`}
      onClick={onClick}
    >
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
              <Building2 className={`w-5 h-5 ${ascenseur.en_arret ? 'text-red-500' : 'text-orange-500'}`} />
            </div>
            <div>
              <p className="font-bold">{ascenseur.code_appareil}</p>
              <p className="text-xs text-[var(--text-muted)]">Secteur {ascenseur.secteur}</p>
            </div>
          </div>
          {ascenseur.en_arret && (
            <Badge variant="red" className="animate-pulse">À L'ARRÊT</Badge>
          )}
        </div>
        
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="truncate">{ascenseur.adresse}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{ascenseur.ville} {ascenseur.code_postal}</span>
          </div>
          {ascenseur.marque && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{ascenseur.marque} {ascenseur.modele}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
          {ascenseur.type_planning && (
            <Badge variant="gray" className="text-[10px]">{ascenseur.type_planning}</Badge>
          )}
          {ascenseur.nb_visites_an && (
            <Badge variant="blue" className="text-[10px]">{ascenseur.nb_visites_an} visites/an</Badge>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Ligne Ascenseur (vue liste)
function AscenseurRow({ ascenseur, onClick }: { ascenseur: Ascenseur; onClick: () => void }) {
  return (
    <tr 
      className={`hover:bg-[var(--bg-secondary)] cursor-pointer ${ascenseur.en_arret ? 'bg-red-500/5' : ''}`}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-[var(--bg-tertiary)]'}`}>
            <Building2 className={`w-4 h-4 ${ascenseur.en_arret ? 'text-red-500' : 'text-[var(--text-muted)]'}`} />
          </div>
          <div>
            <p className="font-medium">{ascenseur.code_appareil}</p>
            {ascenseur.localisation && <p className="text-xs text-[var(--text-muted)]">{ascenseur.localisation}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{ascenseur.adresse}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.ville}</td>
      <td className="px-4 py-3 text-sm text-center">{ascenseur.secteur}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.marque}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.type_planning || '-'}</td>
      <td className="px-4 py-3 text-center">
        {ascenseur.en_arret ? (
          <Badge variant="red">Arrêt</Badge>
        ) : (
          <Badge variant="green">OK</Badge>
        )}
      </td>
    </tr>
  );
}

// Modal Détail Ascenseur
function AscenseurDetailModal({ ascenseur, onClose }: { ascenseur: Ascenseur; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'pannes' | 'visites' | 'controles'>('info');
  
  const { data: allPannes } = useQuery({
    queryKey: ['pannes-ascenseur', ascenseur.id_wsoucont],
    queryFn: async () => {
      const { data } = await supabase
        .from('parc_pannes')
        .select('*')
        .eq('id_wsoucont', ascenseur.id_wsoucont)
        .order('date_appel', { ascending: false })
        .limit(100);
      return data || [];
    }
  });
  
  // Séparer par type de cause
  const visites = allPannes?.filter((p: any) => p.cause === '99' || p.cause === 99) || [];
  const controles = allPannes?.filter((p: any) => p.cause === '0' || p.cause === 0 || p.cause === '00') || [];
  const pannes = allPannes?.filter((p: any) => {
    const cause = String(p.cause || '');
    return cause !== '99' && cause !== '0' && cause !== '00';
  }) || [];
  
  // Composant détaillé pour une visite d'entretien
  const VisiteCard = ({ item }: { item: any }) => (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold">
              {item.date_appel ? format(parseISO(item.date_appel), 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Visite d'entretien
            </p>
          </div>
        </div>
        <Badge variant="blue">Entretien</Badge>
      </div>
      
      {item.motif && (
        <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">{item.motif}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Technicien:</span>
          <span className="font-medium">{item.depanneur || '-'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Durée:</span>
          <span className="font-medium">{item.duree_minutes ? `${item.duree_minutes} min` : '-'}</span>
        </div>
        
        {item.heure_arrivee && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Arrivée:</span>
            <span className="font-medium">{item.heure_arrivee}</span>
          </div>
        )}
        
        {item.heure_depart && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Départ:</span>
            <span className="font-medium">{item.heure_depart}</span>
          </div>
        )}
      </div>
      
      {item.travaux && (
        <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Travaux effectués:</p>
          <p className="text-sm text-[var(--text-secondary)]">{item.travaux}</p>
        </div>
      )}
    </div>
  );
  
  // Composant détaillé pour une panne
  const PanneCard = ({ item }: { item: any }) => (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            item.personnes_bloquees > 0 ? 'bg-red-500/20' : 'bg-orange-500/20'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              item.personnes_bloquees > 0 ? 'text-red-500' : 'text-orange-500'
            }`} />
          </div>
          <div>
            <p className="font-semibold">
              {item.date_appel ? format(parseISO(item.date_appel), 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
            </p>
            {item.heure_appel && (
              <p className="text-xs text-[var(--text-muted)]">Appel à {item.heure_appel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.personnes_bloquees > 0 && (
            <Badge variant="red" className="animate-pulse">
              {item.personnes_bloquees} pers. bloquée{item.personnes_bloquees > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant={item.etat === 'termine' ? 'green' : 'orange'}>
            {item.etat || 'En cours'}
          </Badge>
        </div>
      </div>
      
      {/* Motif */}
      <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
        <p className="text-xs text-[var(--text-muted)] mb-1">Motif d'appel:</p>
        <p className="text-sm font-medium">{item.motif || '-'}</p>
      </div>
      
      {/* Cause */}
      {item.cause && item.cause !== '99' && item.cause !== '0' && (
        <div className="mb-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
          <p className="text-xs text-orange-400 mb-1">Cause identifiée:</p>
          <p className="text-sm text-[var(--text-secondary)]">{item.cause}</p>
        </div>
      )}
      
      {/* Infos intervention */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Dépanneur:</span>
          <span className="font-medium">{item.depanneur || '-'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Durée:</span>
          <span className="font-medium">{item.duree_minutes ? `${item.duree_minutes} min` : '-'}</span>
        </div>
        
        {item.demandeur && (
          <div className="flex items-center gap-2 col-span-2">
            <Phone className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Demandeur:</span>
            <span className="font-medium">{item.demandeur}</span>
          </div>
        )}
      </div>
      
      {/* Timeline intervention */}
      {(item.heure_arrivee || item.heure_depart) && (
        <div className="flex items-center gap-4 p-2 bg-[var(--bg-secondary)] rounded-lg text-xs">
          {item.heure_appel && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-muted)]">📞 Appel:</span>
              <span className="font-medium">{item.heure_appel}</span>
            </div>
          )}
          {item.heure_arrivee && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-muted)]">🚗 Arrivée:</span>
              <span className="font-medium">{item.heure_arrivee}</span>
            </div>
          )}
          {item.heure_depart && (
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-muted)]">✅ Départ:</span>
              <span className="font-medium">{item.heure_depart}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Travaux effectués */}
      {item.travaux && (
        <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Travaux effectués:</p>
          <p className="text-sm text-[var(--text-secondary)]">{item.travaux}</p>
        </div>
      )}
      
      {/* Type de panne */}
      {item.type_panne && (
        <div className="mt-2">
          <Badge variant="gray" className="text-[10px]">{item.type_panne}</Badge>
        </div>
      )}
    </div>
  );
  
  // Composant pour les contrôles câbles/parachute
  const ControleCard = ({ item }: { item: any }) => (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="font-semibold">
              {item.date_appel ? format(parseISO(item.date_appel), 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Contrôle câbles / parachute</p>
          </div>
        </div>
        <Badge variant="purple">Contrôle</Badge>
      </div>
      
      {item.motif && (
        <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">{item.motif}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Technicien:</span>
          <span className="font-medium">{item.depanneur || '-'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Durée:</span>
          <span className="font-medium">{item.duree_minutes ? `${item.duree_minutes} min` : '-'}</span>
        </div>
      </div>
      
      {item.travaux && (
        <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Observations:</p>
          <p className="text-sm text-[var(--text-secondary)]">{item.travaux}</p>
        </div>
      )}
    </div>
  );
  
  // Rendu générique pour liste vide
  const EmptyState = ({ icon: Icon, message }: { icon: any; message: string }) => (
    <div className="text-center py-8 text-[var(--text-muted)]">
      <Icon className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>{message}</p>
    </div>
  );
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
                  <Building2 className={`w-6 h-6 ${ascenseur.en_arret ? 'text-red-500' : 'text-orange-500'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{ascenseur.code_appareil}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{ascenseur.adresse}, {ascenseur.ville}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {[
                { id: 'info', label: 'Informations', icon: FileText, count: null },
                { id: 'visites', label: 'Visites', icon: Calendar, count: visites.length },
                { id: 'controles', label: 'Contrôles', icon: Eye, count: controles.length },
                { id: 'pannes', label: 'Pannes', icon: AlertTriangle, count: pannes.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== null && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === tab.id ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-400" /> Localisation
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Adresse</span>
                      <span className="font-medium">{ascenseur.adresse}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Ville</span>
                      <span className="font-medium">{ascenseur.ville} {ascenseur.code_postal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Secteur</span>
                      <span className="font-medium">{ascenseur.secteur}</span>
                    </div>
                    {ascenseur.localisation && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Localisation</span>
                        <span className="font-medium">{ascenseur.localisation}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" /> Caractéristiques
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Marque</span>
                      <span className="font-medium">{ascenseur.marque || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Modèle</span>
                      <span className="font-medium">{ascenseur.modele || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Type</span>
                      <span className="font-medium">{ascenseur.type_appareil || '-'}</span>
                    </div>
                    {ascenseur.tel_cabine && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Tél. cabine</span>
                        <span className="font-medium">{ascenseur.tel_cabine}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl col-span-2">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" /> Contrat & Maintenance
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Type planning</span>
                      <span className="font-medium">{ascenseur.type_planning || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Visites/an</span>
                      <span className="font-medium">{ascenseur.nb_visites_an || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Dernier passage</span>
                      <span className="font-medium">{ascenseur.dernier_passage ? format(parseISO(ascenseur.dernier_passage), 'dd/MM/yyyy') : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'visites' && (
              <div className="space-y-4">
                {visites.length > 0 ? (
                  visites.map((item: any) => <VisiteCard key={item.id} item={item} />)
                ) : (
                  <EmptyState icon={Calendar} message="Aucune visite d'entretien enregistrée" />
                )}
              </div>
            )}
            
            {activeTab === 'controles' && (
              <div className="space-y-4">
                {controles.length > 0 ? (
                  controles.map((item: any) => <ControleCard key={item.id} item={item} />)
                ) : (
                  <EmptyState icon={Eye} message="Aucun contrôle câbles/parachute enregistré" />
                )}
              </div>
            )}
            
            {activeTab === 'pannes' && (
              <div className="space-y-4">
                {pannes.length > 0 ? (
                  pannes.map((item: any) => <PanneCard key={item.id} item={item} />)
                ) : (
                  <EmptyState icon={CheckCircle} message="Aucune panne enregistrée" />
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function ParcAscenseursPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [secteurFilter, setSecteurFilter] = useState<string>('');
  const [showArretOnly, setShowArretOnly] = useState(false);
  const [selectedAscenseur, setSelectedAscenseur] = useState<Ascenseur | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Récupérer les secteurs autorisés de l'utilisateur
  const { data: userSecteurs } = useQuery({
    queryKey: ['user-secteurs'],
    queryFn: getUserSecteurs
  });
  
  const { data: ascenseurs, isLoading } = useQuery({
    queryKey: ['parc-ascenseurs', userSecteurs],
    queryFn: () => getAscenseurs(undefined, userSecteurs),
    enabled: userSecteurs !== undefined // Attendre que userSecteurs soit chargé
  });
  
  const { data: arrets } = useQuery({
    queryKey: ['parc-arrets'],
    queryFn: getArrets,
    refetchInterval: 60000 // Refresh toutes les minutes
  });
  
  // Filtrer les arrêts selon les secteurs de l'utilisateur
  const filteredArrets = useMemo(() => {
    if (!arrets) return [];
    if (!userSecteurs || userSecteurs.length === 0) return arrets;
    return arrets.filter((a: Arret) => userSecteurs.includes(a.secteur));
  }, [arrets, userSecteurs]);
  
  const { data: secteurs } = useQuery({
    queryKey: ['parc-secteurs'],
    queryFn: getSecteurs
  });
  
  // Filtrer les secteurs disponibles selon les droits de l'utilisateur
  const availableSecteurs = useMemo(() => {
    if (!secteurs) return [];
    if (!userSecteurs || userSecteurs.length === 0) return secteurs;
    return secteurs.filter((s: any) => userSecteurs.includes(s.numero));
  }, [secteurs, userSecteurs]);
  
  const { data: lastSync } = useQuery({
    queryKey: ['parc-last-sync'],
    queryFn: getLastSync
  });
  
  const { data: stats } = useQuery({
    queryKey: ['parc-stats'],
    queryFn: getStats
  });
  
  const filteredAscenseurs = useMemo(() => {
    if (!ascenseurs) return [];
    
    return ascenseurs.filter(a => {
      if (search) {
        const s = search.toLowerCase();
        if (!a.code_appareil?.toLowerCase().includes(s) &&
            !a.adresse?.toLowerCase().includes(s) &&
            !a.ville?.toLowerCase().includes(s)) {
          return false;
        }
      }
      if (secteurFilter && a.secteur?.toString() !== secteurFilter) return false;
      if (showArretOnly && !a.en_arret) return false;
      return true;
    });
  }, [ascenseurs, search, secteurFilter, showArretOnly]);
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Parc Ascenseurs</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Données synchronisées depuis Progilift
              {lastSync && (
                <span className="ml-2">
                  • Dernière sync: {formatDistanceToNow(parseISO(lastSync.sync_date), { addSuffix: true, locale: fr })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSyncModal(true)}>
              <Cloud className="w-4 h-4" /> Synchronisation
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ascenseurs?.length || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Ascenseurs</p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <ArretsWidget arrets={filteredArrets || []} />
          
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pannes30j || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Pannes (30j)</p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{availableSecteurs?.length || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Secteurs</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par code, adresse, ville..."
              className="pl-10"
            />
          </div>
          
          <Select value={secteurFilter} onChange={e => setSecteurFilter(e.target.value)} className="w-40">
            <option value="">Tous secteurs</option>
            {availableSecteurs?.map((s: any) => (
              <option key={s.numero} value={s.numero}>{s.nom}</option>
            ))}
          </Select>
          
          <Button
            variant={showArretOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowArretOnly(!showArretOnly)}
          >
            <AlertTriangle className="w-4 h-4" />
            À l'arrêt ({filteredArrets?.length || 0})
          </Button>
          
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded ${view === 'grid' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded ${view === 'list' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)]'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-[var(--text-muted)]">Chargement...</div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAscenseurs.map(ascenseur => (
              <AscenseurCard 
                key={ascenseur.id} 
                ascenseur={ascenseur}
                onClick={() => setSelectedAscenseur(ascenseur)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Adresse</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Ville</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Secteur</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Marque</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Planning</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredAscenseurs.map(ascenseur => (
                  <AscenseurRow 
                    key={ascenseur.id} 
                    ascenseur={ascenseur}
                    onClick={() => setSelectedAscenseur(ascenseur)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredAscenseurs.length === 0 && !isLoading && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun ascenseur trouvé</p>
          </div>
        )}
      </div>
      
      {/* Modal détail */}
      {selectedAscenseur && (
        <AscenseurDetailModal
          ascenseur={selectedAscenseur}
          onClose={() => setSelectedAscenseur(null)}
        />
      )}
      
      {/* Modal synchronisation */}
      {showSyncModal && (
        <SyncModal onClose={() => setShowSyncModal(false)} />
      )}
    </div>
  );
}
