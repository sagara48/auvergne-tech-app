import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, MapPin, AlertTriangle, Clock, Search, Filter, RefreshCw,
  LayoutGrid, List, Map, ChevronDown, ChevronUp, Phone, Wrench,
  Calendar, User, Activity, TrendingUp, Zap, Timer, AlertCircle,
  CheckCircle, XCircle, Settings, Eye, FileText, BarChart3, Play,
  Pause, RotateCcw, Database, Cloud, CloudOff, Loader2, History,
  Server, Wifi, WifiOff, Download, Upload, X, Route, FileDown,
  Navigation, Compass, Globe, MessageSquare, Send, Plus, Minus,
  FolderOpen, File, Image, FileSpreadsheet, Trash2, Package
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { generateRapportMensuel, generateRapportAscenseur } from '@/services/pdfService';
import { getDocumentsByCodeAscenseur, uploadDocumentForAscenseur } from '@/services/api';
import { 
  optimizeRoute, 
  generateGoogleMapsUrl, 
  generateWazeUrl,
  formatDuration, 
  formatDistance,
  type Location,
  type OptimizedRoute
} from '@/services/routeOptimizer';
import { geocodeAndUpdateAll } from '@/services/geocodingService';
import { PiecesRemplaceesParc, PiecesRemplaceesByAscenseur } from '@/components/integrations/PiecesRemplacees';
import { format, formatDistanceToNow, parseISO, differenceInHours, differenceInDays } from 'date-fns';
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

// Récupérer les types de planning avec nb de visites
const getTypesPlanning = async (): Promise<Record<string, number>> => {
  try {
    const { data, error } = await supabase
      .from('parc_type_planning')
      .select('code, nb_visites');
    
    if (error || !data) return {};
    
    // Créer un map code -> nb_visites
    const map: Record<string, number> = {};
    data.forEach((tp: any) => {
      if (tp.code) {
        map[tp.code] = tp.nb_visites || 0;
      }
    });
    return map;
  } catch {
    return {};
  }
};

const getAscenseurs = async (secteur?: number, userSecteurs?: number[]) => {
  try {
    // Pagination pour récupérer tous les ascenseurs (Supabase limite à 1000 par requête)
    const allAscenseurs: any[] = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      let query = supabase
        .from('parc_ascenseurs')
        .select('*')
        .order('code_appareil')
        .range(from, from + batchSize - 1);
      
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
        break;
      }
      
      if (data && data.length > 0) {
        allAscenseurs.push(...data);
        from += batchSize;
        if (data.length < batchSize) break; // Plus de données
      } else {
        break;
      }
    }
    
    console.log(`Ascenseurs récupérés: ${allAscenseurs.length}`);
    return allAscenseurs;
  } catch (err) {
    console.error('Erreur getAscenseurs:', err);
    return [];
  }
};

// Récupérer TOUS les ascenseurs pour l'enrichissement (sans filtre secteur)
const getAllAscenseursForEnrichment = async () => {
  try {
    // Supabase limite à 1000 par requête, on doit paginer
    const allAscenseurs: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('parc_ascenseurs')
        .select('id_wsoucont, code_appareil, adresse, ville, secteur, marque, type_planning')
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.warn('Erreur récupération ascenseurs batch:', error.message);
        break;
      }
      
      if (data && data.length > 0) {
        allAscenseurs.push(...data);
        from += batchSize;
        hasMore = data.length === batchSize; // Continuer si on a reçu un batch complet
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Ascenseurs pour enrichissement: ${allAscenseurs.length} (chargés en ${Math.ceil(allAscenseurs.length / batchSize)} batches)`);
    return allAscenseurs;
  } catch (err) {
    console.error('Erreur getAllAscenseursForEnrichment:', err);
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

const getPannesRecentes = async () => {
  try {
    // Récupérer les pannes avec pagination (Supabase limite à 1000 par requête)
    // On exclut les visites (cause 99) côté serveur
    // Le filtrage par secteurs se fait côté client après enrichissement
    const allPannes: any[] = [];
    let from = 0;
    const batchSize = 1000;
    const maxPannes = 10000; // Récupérer jusqu'à 10000 pannes
    
    while (allPannes.length < maxPannes) {
      const { data: pannes, error } = await supabase
        .from('parc_pannes')
        .select('*')
        .not('data_wpanne->>CAUSE', 'eq', '99')  // Exclure visites
        .order('date_appel', { ascending: false, nullsFirst: false })
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.warn('Erreur parc_pannes:', error.message);
        break;
      }
      
      if (pannes && pannes.length > 0) {
        allPannes.push(...pannes);
        from += batchSize;
        if (pannes.length < batchSize) break; // Plus de données
      } else {
        break;
      }
    }
    
    console.log(`Pannes récupérées: ${allPannes.length} (en ${Math.ceil(from / batchSize)} batches, max ${maxPannes})`);
    
    // Debug: afficher les dates des 5 premières pannes
    if (allPannes.length > 0) {
      console.log('5 premières pannes (plus récentes):');
      allPannes.slice(0, 5).forEach((p: any, i: number) => {
        const data = p.data_wpanne || {};
        console.log(`  ${i+1}. date=${p.date_appel}, cause=${data.CAUSE}, motif=${String(p.motif || '').substring(0, 30)}...`);
      });
    }
    
    return allPannes;
  } catch (err) {
    console.error('Erreur getPannesRecentes:', err);
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

// Widget Ascenseurs à l'arrêt (compact)
function ArretsWidget({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count === 0) {
    return (
      <Card className="bg-green-500/10 border-green-500/30">
        <CardBody className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-500">0</p>
              <p className="text-[10px] text-[var(--text-muted)]">À l'arrêt</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <Card 
      className="bg-red-500/10 border-red-500/30 cursor-pointer hover:bg-red-500/15 transition-all" 
      onClick={onClick}
    >
      <CardBody className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{count}</p>
            <p className="text-[10px] text-[var(--text-muted)]">À l'arrêt</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Modal Détail Panne
function PanneDetailModal({ panne, onClose }: { panne: any; onClose: () => void }) {
  const data = panne.data_wpanne || {};
  
  // Fonction pour formater une date YYYYMMDD (peut être string ou number)
  const formatDateYYYYMMDD = (dateVal: string | number | null) => {
    if (!dateVal) return null;
    const dateStr = String(dateVal);
    if (dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  };
  
  // Fonction pour formater une heure HHMM (peut être string ou number)
  const formatHeureHHMM = (heureVal: string | number | null) => {
    if (!heureVal && heureVal !== 0) return null;
    const h = String(heureVal).padStart(4, '0');
    return `${h.substring(0, 2)}h${h.substring(2, 4)}`;
  };
  
  // Fonction pour décoder les entités HTML
  const decodeHtml = (text: string | null) => {
    if (!text) return null;
    return String(text)
      .replace(/&#13;/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };
  
  // Calculer la durée d'intervention
  const calcDuree = (debut: string | number | null, fin: string | number | null) => {
    if (!debut || !fin) return null;
    const d = String(debut).padStart(4, '0');
    const f = String(fin).padStart(4, '0');
    const debutMin = parseInt(d.substring(0, 2)) * 60 + parseInt(d.substring(2, 4));
    const finMin = parseInt(f.substring(0, 2)) * 60 + parseInt(f.substring(2, 4));
    const duree = finMin - debutMin;
    if (duree <= 0) return null;
    const h = Math.floor(duree / 60);
    const m = duree % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  };
  
  const datePanne = formatDateYYYYMMDD(data.DATE) || (panne.date_appel ? parseISO(panne.date_appel) : null);
  const heureAppel = formatHeureHHMM(data.APPEL);
  const heureInter = formatHeureHHMM(data.INTER);
  const heureFinInter = formatHeureHHMM(data.HRFININTER);
  const dureeInter = calcDuree(data.INTER, data.HRFININTER);
  const technicien = data.DEPANNEUR || data.CLEPERSO || panne.depanneur;
  const notes = decodeHtml(data.NOTE2);
  const motifAppel = data.Libelle || panne.motif;
  const typePanne = data.PANNES;
  const ensemble = data.ENSEMBLE;
  const demandeur = data.DEMAND || panne.demandeur;
  const telDemandeur = data.TELDEMAND;
  const causeCode = data.CAUSE;
  const persBloquees = data.NOMBRE || panne.personnes_bloquees || 0;
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                persBloquees > 0 ? 'bg-red-500/20' : 'bg-orange-500/20'
              }`}>
                <Wrench className={`w-6 h-6 ${persBloquees > 0 ? 'text-red-500' : 'text-orange-500'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{panne.code_appareil}</h2>
                <p className="text-sm text-[var(--text-muted)]">{panne.adresse}, {panne.ville}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {persBloquees > 0 && (
                <Badge variant="red" className="animate-pulse">
                  {persBloquees} pers. bloquée{persBloquees > 1 ? 's' : ''}
                </Badge>
              )}
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Date et heure */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" /> Date & Horaires
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Date</p>
                  <p className="font-medium">
                    {datePanne ? format(datePanne, 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
                  </p>
                </div>
                {heureAppel && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Heure d'appel</p>
                    <p className="font-medium">{heureAppel}</p>
                  </div>
                )}
              </div>
              
              {/* Timeline intervention */}
              {(heureAppel || heureInter || heureFinInter) && (
                <div className="mt-4 pt-4 border-t border-[var(--border-secondary)]">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Timeline</p>
                  <div className="flex items-center gap-2 text-sm">
                    {heureAppel && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary)] rounded">
                        <Phone className="w-3 h-3 text-blue-400" />
                        <span>{heureAppel}</span>
                      </div>
                    )}
                    {heureInter && (
                      <>
                        <span className="text-[var(--text-muted)]">→</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary)] rounded">
                          <User className="w-3 h-3 text-green-400" />
                          <span>{heureInter}</span>
                        </div>
                      </>
                    )}
                    {heureFinInter && (
                      <>
                        <span className="text-[var(--text-muted)]">→</span>
                        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary)] rounded">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>{heureFinInter}</span>
                        </div>
                      </>
                    )}
                    {dureeInter && (
                      <Badge variant="blue" className="ml-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {dureeInter}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Motif d'appel */}
            {motifAppel && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400" /> Motif d'appel
                </h3>
                <p className="text-sm">{motifAppel}</p>
              </div>
            )}
            
            {/* Type de panne */}
            {typePanne && (
              <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-400" /> Type de panne
                </h3>
                <p className="text-sm font-medium">{typePanne}</p>
                {ensemble && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">Ensemble : {ensemble}</p>
                )}
              </div>
            )}
            
            {/* Demandeur et technicien */}
            <div className="grid grid-cols-2 gap-4">
              {demandeur && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-purple-400" /> Demandeur
                  </h3>
                  <p className="text-sm font-medium">{demandeur}</p>
                  {telDemandeur && (
                    <p className="text-xs text-[var(--text-muted)]">{telDemandeur}</p>
                  )}
                </div>
              )}
              
              {technicien && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-green-400" /> Technicien
                  </h3>
                  <p className="text-sm font-medium">{technicien}</p>
                </div>
              )}
            </div>
            
            {/* Notes / Travaux */}
            {notes && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-yellow-400" /> Notes / Travaux effectués
                </h3>
                <p className="text-sm whitespace-pre-line text-[var(--text-secondary)]">{notes}</p>
              </div>
            )}
            
            {/* Infos techniques */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="gray">Secteur {panne.secteur}</Badge>
              {panne.marque && <Badge variant="gray">{panne.marque}</Badge>}
              {panne.type_planning && <Badge variant="blue">{panne.type_planning}</Badge>}
              {causeCode && <Badge variant="orange">Cause {causeCode}</Badge>}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Carte Ascenseur
function AscenseurCard({ ascenseur, onClick }: { ascenseur: any; onClick: () => void }) {
  const isHorsContrat = !ascenseur.type_planning;
  
  return (
    <Card 
      className={`cursor-pointer hover:border-orange-500/50 transition-all ${
        ascenseur.en_arret ? 'border-red-500/50 bg-red-500/5' : 
        isHorsContrat ? 'border-gray-500/30 bg-gray-500/5' : ''
      }`}
      onClick={onClick}
    >
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              ascenseur.en_arret ? 'bg-red-500/20' : 
              isHorsContrat ? 'bg-gray-500/20' : 'bg-orange-500/20'
            }`}>
              <Building2 className={`w-5 h-5 ${
                ascenseur.en_arret ? 'text-red-500' : 
                isHorsContrat ? 'text-gray-500' : 'text-orange-500'
              }`} />
            </div>
            <div>
              <p className="font-bold">{ascenseur.code_appareil}</p>
              <p className="text-xs text-[var(--text-muted)]">Secteur {ascenseur.secteur}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {ascenseur.en_arret && (
              <Badge variant="red" className="animate-pulse">À L'ARRÊT</Badge>
            )}
            {isHorsContrat && (
              <Badge variant="gray" className="text-[10px]">Hors contrat</Badge>
            )}
          </div>
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
          {ascenseur.type_planning ? (
            <>
              <Badge variant="green" className="text-[10px]">{ascenseur.type_planning}</Badge>
              <Badge variant="blue" className="text-[10px]">{ascenseur.nb_visites_an || 0} visites/an</Badge>
            </>
          ) : (
            <span className="text-xs text-[var(--text-muted)] italic">Aucun contrat de maintenance</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Ligne Ascenseur (vue liste)
function AscenseurRow({ ascenseur, onClick }: { ascenseur: any; onClick: () => void }) {
  const isHorsContrat = !ascenseur.type_planning;
  
  return (
    <tr 
      className={`hover:bg-[var(--bg-secondary)] cursor-pointer ${
        ascenseur.en_arret ? 'bg-red-500/5' : 
        isHorsContrat ? 'bg-gray-500/5' : ''
      }`}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            ascenseur.en_arret ? 'bg-red-500/20' : 
            isHorsContrat ? 'bg-gray-500/20' : 'bg-[var(--bg-tertiary)]'
          }`}>
            <Building2 className={`w-4 h-4 ${
              ascenseur.en_arret ? 'text-red-500' : 
              isHorsContrat ? 'text-gray-500' : 'text-[var(--text-muted)]'
            }`} />
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
      <td className="px-4 py-3 text-sm">{ascenseur.marque || '-'}</td>
      <td className="px-4 py-3 text-sm">
        {ascenseur.type_planning ? (
          <span>{ascenseur.type_planning} ({ascenseur.nb_visites_an || 0} vis/an)</span>
        ) : (
          <span className="text-gray-500 italic">Hors contrat</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {ascenseur.en_arret ? (
          <Badge variant="red">Arrêt</Badge>
        ) : isHorsContrat ? (
          <Badge variant="gray">HC</Badge>
        ) : (
          <Badge variant="green">OK</Badge>
        )}
      </td>
    </tr>
  );
}

// Modal Signaler Pièces Remplacées
interface ArticleStockVehicule {
  id: string;
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
  categorie?: string;
}

interface PieceRemplacee {
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
  disponible: number;
}

interface TechnicienAvecVehicule {
  id: string;
  prenom: string;
  nom: string;
  vehicule_id?: string;
  vehicule_immatriculation?: string;
  vehicule_marque?: string;
  vehicule_modele?: string;
}

function SignalerPiecesModal({ 
  ascenseur, 
  onClose 
}: { 
  ascenseur: Ascenseur; 
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [piecesRemplacees, setPiecesRemplacees] = useState<PieceRemplacee[]>([]);
  const [searchPiece, setSearchPiece] = useState('');
  const [notePieces, setNotePieces] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehiculeId, setVehiculeId] = useState<string | null>(null);
  const [stockVehicule, setStockVehicule] = useState<ArticleStockVehicule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [techniciens, setTechniciens] = useState<TechnicienAvecVehicule[]>([]);
  const [selectedTechnicienId, setSelectedTechnicienId] = useState<string>('');

  // Charger les infos utilisateur et techniciens
  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Chercher le technicien par ID ou par email
        let technicienData = null;
        let roleCode = null;

        // Essai 1: chercher par ID
        const { data: techById } = await supabase
          .from('techniciens')
          .select('id, email, role:roles(code)')
          .eq('id', user.id)
          .maybeSingle();

        if (techById) {
          technicienData = techById;
          roleCode = (techById.role as any)?.code;
        } else if (user.email) {
          // Essai 2: chercher par email
          const { data: techByEmail } = await supabase
            .from('techniciens')
            .select('id, email, role:roles(code)')
            .eq('email', user.email)
            .maybeSingle();

          if (techByEmail) {
            technicienData = techByEmail;
            roleCode = (techByEmail.role as any)?.code;
          }
        }

        // Vérifier si admin
        const userIsAdmin = roleCode === 'admin' || roleCode === 'superadmin' || roleCode === 'administrateur';
        setIsAdmin(userIsAdmin);
        
        console.log('User admin check:', { 
          userId: user.id, 
          email: user.email, 
          isAdmin: userIsAdmin, 
          technicien: technicienData,
          roleCode 
        });

        if (userIsAdmin) {
          // Charger tous les véhicules avec leur technicien
          const { data: vehiculesData, error: vehiculesError } = await supabase
            .from('vehicules')
            .select(`
              id, 
              immatriculation, 
              marque, 
              modele, 
              technicien_id
            `)
            .order('immatriculation');
          
          console.log('Véhicules chargés:', vehiculesData?.length, vehiculesError);

          // Récupérer les noms des techniciens depuis la table techniciens
          const technicienIds = (vehiculesData || [])
            .map((v: any) => v.technicien_id)
            .filter(Boolean);

          let techniciensMap: Record<string, { prenom: string; nom: string }> = {};
          
          if (technicienIds.length > 0) {
            const { data: techniciens } = await supabase
              .from('techniciens')
              .select('id, prenom, nom')
              .in('id', technicienIds);

            techniciensMap = (techniciens || []).reduce((acc: any, t: any) => {
              acc[t.id] = { prenom: t.prenom || '', nom: t.nom || '' };
              return acc;
            }, {});
          }

          // Construire la liste des techniciens avec véhicule + véhicules non assignés
          const techniciensList: TechnicienAvecVehicule[] = (vehiculesData || [])
            .filter((v: any) => v.technicien_id) // Véhicules avec technicien
            .map((v: any) => {
              const tech = techniciensMap[v.technicien_id];
              return {
                id: v.technicien_id,
                prenom: tech?.prenom || 'Technicien',
                nom: tech?.nom || v.technicien_id.slice(0, 8),
                vehicule_id: v.id,
                vehicule_immatriculation: v.immatriculation,
                vehicule_marque: v.marque,
                vehicule_modele: v.modele,
              };
            });

          // Ajouter les véhicules non assignés comme entrées spéciales
          const vehiculesNonAssignes = (vehiculesData || [])
            .filter((v: any) => !v.technicien_id)
            .map((v: any) => ({
              id: `vehicule_${v.id}`, // Préfixe pour distinguer
              prenom: '🚐',
              nom: `${v.immatriculation} (non assigné)`,
              vehicule_id: v.id,
              vehicule_immatriculation: v.immatriculation,
              vehicule_marque: v.marque,
              vehicule_modele: v.modele,
            }));

          setTechniciens([...techniciensList, ...vehiculesNonAssignes]);
          setIsLoading(false);
        } else {
          // Non-admin : charger uniquement son véhicule
          const { data: vehicule } = await supabase
            .from('vehicules')
            .select('id')
            .eq('technicien_id', user.id)
            .maybeSingle();

          if (vehicule) {
            setVehiculeId(vehicule.id);
            setSelectedTechnicienId(user.id);
            await loadStockVehicule(vehicule.id);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erreur chargement initial:', error);
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Charger le stock d'un véhicule spécifique
  const loadStockVehicule = async (vehId: string) => {
    console.log('loadStockVehicule appelé avec:', vehId);
    try {
      const { data: stock, error } = await supabase
        .from('stock_vehicule')
        .select(`
          id,
          article_id,
          quantite,
          article:article_id(id, designation, reference, categorie:categorie_id(nom))
        `)
        .eq('vehicule_id', vehId)
        .gt('quantite', 0);

      if (error) {
        console.error('ERREUR stock_vehicule:', error.message, error.code, error.details, error.hint);
        
        // Essayer une requête plus simple si la jointure pose problème
        console.log('Tentative requête simplifiée...');
        const { data: stockSimple, error: errorSimple } = await supabase
          .from('stock_vehicule')
          .select('id, article_id, quantite')
          .eq('vehicule_id', vehId)
          .gt('quantite', 0);
        
        if (errorSimple) {
          console.error('ERREUR requête simplifiée:', errorSimple.message);
          setStockVehicule([]);
          return;
        }
        
        console.log('Stock simplifié récupéré:', stockSimple?.length, 'articles');
        
        // Récupérer les articles séparément si on a des résultats
        if (stockSimple && stockSimple.length > 0) {
          const articleIds = stockSimple.map((s: any) => s.article_id);
          const { data: articles } = await supabase
            .from('articles')
            .select('id, designation, reference')
            .in('id', articleIds);
          
          const articlesMap: Record<string, any> = {};
          (articles || []).forEach((a: any) => {
            articlesMap[a.id] = a;
          });
          
          const formattedArticles: ArticleStockVehicule[] = stockSimple.map((s: any) => ({
            id: s.id,
            article_id: s.article_id,
            designation: articlesMap[s.article_id]?.designation || 'Article inconnu',
            reference: articlesMap[s.article_id]?.reference,
            quantite: s.quantite,
            categorie: undefined,
          }));
          
          console.log('Articles formatés (méthode alternative):', formattedArticles.length);
          setStockVehicule(formattedArticles);
          setVehiculeId(vehId);
          setPiecesRemplacees([]);
          return;
        }
        
        setStockVehicule([]);
        return;
      }

      console.log('Stock récupéré:', stock?.length, 'articles');

      const articles: ArticleStockVehicule[] = (stock || []).map((s: any) => ({
        id: s.id,
        article_id: s.article_id,
        designation: s.article?.designation || 'Article inconnu',
        reference: s.article?.reference,
        quantite: s.quantite,
        categorie: s.article?.categorie?.nom,
      }));

      console.log('Articles formatés:', articles.length);
      setStockVehicule(articles);
      setVehiculeId(vehId);
      setPiecesRemplacees([]);
    } catch (error) {
      console.error('Erreur chargement stock véhicule:', error);
      setStockVehicule([]);
    }
  };

  // Quand l'admin sélectionne un technicien/véhicule
  const handleTechnicienChange = async (techId: string) => {
    console.log('handleTechnicienChange appelé avec:', techId);
    setSelectedTechnicienId(techId);
    
    if (techId) {
      // Cas 1: Véhicule non assigné (préfixé par "vehicule_")
      if (techId.startsWith('vehicule_')) {
        const realVehiculeId = techId.replace('vehicule_', '');
        console.log('Véhicule non assigné, ID réel:', realVehiculeId);
        await loadStockVehicule(realVehiculeId);
      } else {
        // Cas 2: Technicien avec véhicule
        const technicien = techniciens.find(t => t.id === techId);
        console.log('Technicien trouvé:', technicien);
        if (technicien?.vehicule_id) {
          await loadStockVehicule(technicien.vehicule_id);
        } else {
          console.log('Pas de vehicule_id trouvé pour ce technicien');
          setStockVehicule([]);
          setVehiculeId(null);
        }
      }
    } else {
      setStockVehicule([]);
      setVehiculeId(null);
    }
  };

  // Filtrer les articles par recherche
  const articlesFiltres = stockVehicule.filter(a => 
    !searchPiece || 
    a.designation.toLowerCase().includes(searchPiece.toLowerCase()) ||
    a.reference?.toLowerCase().includes(searchPiece.toLowerCase())
  );

  // Ajouter une pièce à la liste
  const ajouterPiece = (article: ArticleStockVehicule) => {
    const exists = piecesRemplacees.find(p => p.article_id === article.article_id);
    if (exists) {
      setPiecesRemplacees(prev => prev.map(p => 
        p.article_id === article.article_id 
          ? { ...p, quantite: Math.min(p.quantite + 1, p.disponible) }
          : p
      ));
    } else {
      setPiecesRemplacees(prev => [...prev, {
        article_id: article.article_id,
        designation: article.designation,
        reference: article.reference,
        quantite: 1,
        disponible: article.quantite,
      }]);
    }
  };

  // Modifier la quantité
  const modifierQuantite = (articleId: string, delta: number) => {
    setPiecesRemplacees(prev => prev.map(p => {
      if (p.article_id === articleId) {
        const newQty = Math.max(1, Math.min(p.quantite + delta, p.disponible));
        return { ...p, quantite: newQty };
      }
      return p;
    }));
  };

  // Retirer une pièce
  const retirerPiece = (articleId: string) => {
    setPiecesRemplacees(prev => prev.filter(p => p.article_id !== articleId));
  };

  // Enregistrer les pièces
  const enregistrerPieces = async () => {
    if (!vehiculeId || piecesRemplacees.length === 0) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      for (const piece of piecesRemplacees) {
        // Décrémenter le stock véhicule
        const { data: stockActuel } = await supabase
          .from('stock_vehicule')
          .select('quantite')
          .eq('vehicule_id', vehiculeId)
          .eq('article_id', piece.article_id)
          .single();

        if (stockActuel) {
          const nouvelleQuantite = Math.max(0, stockActuel.quantite - piece.quantite);
          await supabase
            .from('stock_vehicule')
            .update({ quantite: nouvelleQuantite, updated_at: now })
            .eq('vehicule_id', vehiculeId)
            .eq('article_id', piece.article_id);
        }

        // Créer le mouvement de stock
        // Pour les véhicules non assignés, utiliser l'id de l'admin
        const effectiveTechnicienId = selectedTechnicienId?.startsWith('vehicule_') 
          ? user?.id 
          : (selectedTechnicienId || user?.id);
          
        await supabase.from('stock_mouvements').insert({
          article_id: piece.article_id,
          type_mouvement: 'sortie',
          quantite: piece.quantite,
          motif: `Remplacement sur ${ascenseur.code_appareil}`,
          reference_doc: ascenseur.code_appareil,
          vehicule_id: vehiculeId,
          technicien_id: effectiveTechnicienId,
          created_at: now,
        });
      }

      // Mettre à jour le dernier passage
      await supabase
        .from('parc_ascenseurs')
        .update({ dernier_passage: now })
        .eq('id_wsoucont', ascenseur.id_wsoucont);

      // Créer une intervention rapide (si table existe)
      const piecesListe = piecesRemplacees.map(p => `${p.quantite}x ${p.designation}`).join(', ');
      const technicienInfo = techniciens.find(t => t.id === selectedTechnicienId);
      const effectiveTechnicienIdFinal = selectedTechnicienId?.startsWith('vehicule_') 
        ? user?.id 
        : (selectedTechnicienId || user?.id);
        
      const { error: interventionError } = await supabase.from('interventions_rapides').insert({
        code_appareil: ascenseur.code_appareil,
        id_wsoucont: ascenseur.id_wsoucont,
        adresse: ascenseur.adresse,
        ville: ascenseur.ville,
        secteur: ascenseur.secteur,
        date_intervention: now,
        type_intervention: 'remplacement_pieces',
        description: notePieces || 'Remplacement de pièces',
        pieces_utilisees: piecesListe,
        pieces_detail: piecesRemplacees,
        technicien_id: effectiveTechnicienIdFinal,
        technicien_info: technicienInfo ? `${technicienInfo.prenom} ${technicienInfo.nom}` : null,
      });
      
      if (interventionError) {
        console.log('Note: Table interventions_rapides peut ne pas exister:', interventionError.message);
      }

      toast.success(`${piecesRemplacees.length} pièce(s) enregistrée(s)`);
      queryClient.invalidateQueries({ queryKey: ['stock-vehicules'] });
      onClose();
    } catch (error) {
      console.error('Erreur enregistrement pièces:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trouver le technicien sélectionné pour afficher ses infos
  const technicienSelectionne = techniciens.find(t => t.id === selectedTechnicienId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Pièces remplacées
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {ascenseur.code_appareil} - {ascenseur.adresse}, {ascenseur.ville}
          </p>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : isAdmin && techniciens.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Aucun véhicule actif trouvé</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Vérifiez que des véhicules sont configurés</p>
            </div>
          ) : !isAdmin && !vehiculeId ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Aucun véhicule assigné</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Contactez votre responsable</p>
            </div>
          ) : (
            <>
              {/* Sélecteur de véhicule par technicien pour admin */}
              {isAdmin && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <label className="text-xs font-semibold text-purple-400 mb-2 block flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Technicien / Véhicule
                  </label>
                  <Select
                    value={selectedTechnicienId}
                    onChange={e => handleTechnicienChange(e.target.value)}
                    className="w-full"
                  >
                    <option value="">-- Sélectionner --</option>
                    {/* Techniciens avec véhicule */}
                    {techniciens.filter(t => !t.id.startsWith('vehicule_')).length > 0 && (
                      <optgroup label="👤 Techniciens">
                        {techniciens
                          .filter(t => !t.id.startsWith('vehicule_'))
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.prenom} {t.nom} — {t.vehicule_immatriculation}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Véhicules non assignés */}
                    {techniciens.filter(t => t.id.startsWith('vehicule_')).length > 0 && (
                      <optgroup label="🚐 Véhicules non assignés">
                        {techniciens
                          .filter(t => t.id.startsWith('vehicule_'))
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.vehicule_immatriculation} {t.vehicule_marque && `(${t.vehicule_marque})`}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </Select>
                  {technicienSelectionne && (
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      {technicienSelectionne.id.startsWith('vehicule_') ? (
                        <>Stock véhicule <strong>{technicienSelectionne.vehicule_immatriculation}</strong> (non assigné)</>
                      ) : (
                        <>Stock véhicule de <strong>{technicienSelectionne.prenom} {technicienSelectionne.nom}</strong> ({technicienSelectionne.vehicule_immatriculation})</>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Pièces sélectionnées */}
              {piecesRemplacees.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--text-muted)]">
                    Pièces à enregistrer ({piecesRemplacees.length})
                  </h4>
                  {piecesRemplacees.map(piece => (
                    <div key={piece.article_id} className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{piece.designation}</p>
                        {piece.reference && (
                          <p className="text-[10px] text-[var(--text-muted)]">{piece.reference}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => modifierQuantite(piece.article_id, -1)}
                          className="w-6 h-6 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{piece.quantite}</span>
                        <button
                          onClick={() => modifierQuantite(piece.article_id, 1)}
                          className="w-6 h-6 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center"
                          disabled={piece.quantite >= piece.disponible}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => retirerPiece(piece.article_id)}
                          className="w-6 h-6 rounded bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center ml-1"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recherche - uniquement si véhicule sélectionné */}
              {vehiculeId && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <Input
                      value={searchPiece}
                      onChange={e => setSearchPiece(e.target.value)}
                      placeholder="Rechercher une pièce..."
                      className="pl-9"
                    />
                  </div>

                  {/* Liste du stock véhicule */}
                  {articlesFiltres.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-[var(--text-muted)]">
                        {searchPiece ? 'Aucun résultat' : 'Stock véhicule vide'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      <h4 className="text-xs font-semibold text-[var(--text-muted)] sticky top-0 bg-[var(--bg-primary)] py-1">
                        Stock véhicule ({articlesFiltres.length})
                      </h4>
                      {articlesFiltres.slice(0, 30).map(article => {
                        const dejaAjoute = piecesRemplacees.find(p => p.article_id === article.article_id);
                        return (
                          <button
                            key={article.id}
                            onClick={() => ajouterPiece(article)}
                            disabled={dejaAjoute && dejaAjoute.quantite >= article.quantite}
                            className={`w-full text-left p-2 rounded-lg border transition-colors ${
                              dejaAjoute 
                                ? 'bg-purple-500/5 border-purple-500/30' 
                                : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-purple-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{article.designation}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {article.reference && (
                                    <span className="text-[10px] text-[var(--text-muted)]">{article.reference}</span>
                                  )}
                                  {article.categorie && (
                                    <Badge variant="gray" className="text-[8px]">{article.categorie}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={article.quantite > 2 ? 'green' : article.quantite > 0 ? 'orange' : 'red'} className="text-[10px]">
                                  {article.quantite} dispo
                                </Badge>
                                <Plus className={`w-4 h-4 ${dejaAjoute ? 'text-purple-400' : 'text-[var(--text-muted)]'}`} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Note */}
                  {piecesRemplacees.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">
                        Note (optionnel)
                      </label>
                      <Textarea
                        value={notePieces}
                        onChange={e => setNotePieces(e.target.value)}
                        placeholder="Ex: Remplacement suite usure normale..."
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Message si admin n'a pas sélectionné de technicien */}
              {isAdmin && !vehiculeId && (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sélectionnez un technicien pour voir le stock de son véhicule</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-primary)] flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            variant="primary" 
            className="flex-1"
            onClick={enregistrerPieces}
            disabled={piecesRemplacees.length === 0 || isSubmitting || !vehiculeId}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Enregistrer ({piecesRemplacees.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

// Modal Détail Ascenseur
function AscenseurDetailModal({ ascenseur, onClose }: { ascenseur: Ascenseur; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'pannes' | 'visites' | 'controles' | 'historique' | 'analyse' | 'notes' | 'documents' | 'pieces' | 'travaux'>('info');
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [showPiecesModal, setShowPiecesModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Récupérer les travaux liés à cet ascenseur
  const { data: travauxAscenseur } = useQuery({
    queryKey: ['travaux-ascenseur', ascenseur.code_appareil],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('travaux')
          .select('*, technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)')
          .eq('code_appareil', ascenseur.code_appareil)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.warn('Erreur récupération travaux:', error.message);
          return [];
        }
        return data || [];
      } catch (error) {
        console.warn('Exception travaux:', error);
        return [];
      }
    },
  });
  
  // Récupérer les notes publiques liées à cet ascenseur
  const { data: notesAscenseur, refetch: refetchNotes } = useQuery({
    queryKey: ['notes-ascenseur', ascenseur.code_appareil],
    queryFn: async () => {
      try {
        // D'abord chercher par code_ascenseur exact
        const { data: notesByCode, error: error1 } = await supabase
          .from('notes')
          .select('*')
          .eq('partage', true)
          .eq('code_ascenseur', ascenseur.code_appareil)
          .order('created_at', { ascending: false });
        
        // Ensuite chercher dans le contenu/titre
        const { data: notesByContent, error: error2 } = await supabase
          .from('notes')
          .select('*')
          .eq('partage', true)
          .or(`titre.ilike.%${ascenseur.code_appareil}%,contenu.ilike.%${ascenseur.code_appareil}%`)
          .order('created_at', { ascending: false });
        
        // Fusionner et dédupliquer
        const allNotes = [...(notesByCode || []), ...(notesByContent || [])];
        const uniqueNotes = allNotes.filter((note, index, self) => 
          index === self.findIndex(n => n.id === note.id)
        );
        
        // Trier par date décroissante
        uniqueNotes.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        return uniqueNotes;
      } catch (error) {
        console.warn('Erreur récupération notes:', error);
        return [];
      }
    }
  });
  
  // Récupérer les documents liés à cet ascenseur
  const { data: documentsAscenseur, refetch: refetchDocs } = useQuery({
    queryKey: ['documents-ascenseur', ascenseur.code_appareil],
    queryFn: async () => {
      try {
        return await getDocumentsByCodeAscenseur(ascenseur.code_appareil);
      } catch (error) {
        console.warn('Erreur récupération documents:', error);
        return [];
      }
    }
  });
  
  // Fonction d'upload de document
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingDoc(true);
    try {
      // Déterminer le type de document
      let typeDoc = 'autre';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) typeDoc = 'photo';
      else if (['pdf'].includes(ext || '')) typeDoc = 'rapport';
      else if (['xls', 'xlsx', 'csv'].includes(ext || '')) typeDoc = 'facture';
      
      await uploadDocumentForAscenseur(file, ascenseur.code_appareil, typeDoc);
      toast.success('Document ajouté');
      refetchDocs();
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
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
  
  // Fonction pour extraire la date d'une panne
  const getPanneDate = (p: any): Date | null => {
    const data = p.data_wpanne || {};
    if (data.DATE) {
      const dateStr = String(data.DATE);
      if (dateStr.length === 8) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
      }
    }
    if (p.date_appel) {
      const d = new Date(p.date_appel);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };
  
  // Fonction pour trier par date décroissante
  const sortByDateDesc = (items: any[]) => {
    return [...items].sort((a, b) => {
      const dateA = getPanneDate(a);
      const dateB = getPanneDate(b);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA; // Plus récent en premier
    });
  };
  
  // Debug: afficher les champs disponibles
  if (allPannes && allPannes.length > 0) {
    const sample = allPannes[0];
    console.log('=== DEBUG MODAL ASCENSEUR ===');
    console.log('Champs disponibles:', Object.keys(sample));
    
    // Analyser toutes les causes et motifs
    const causeCounts: Record<string, number> = {};
    const motifCounts: Record<string, number> = {};
    allPannes.forEach((p: any) => {
      const cause = String(p.data_wpanne?.CAUSE ?? p.cause ?? 'vide');
      const motif = String(p.motif ?? 'vide').substring(0, 30);
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;
      motifCounts[motif] = (motifCounts[motif] || 0) + 1;
    });
    console.log('Répartition causes:', causeCounts);
    console.log('Répartition motifs (30 premiers chars):', motifCounts);
  }
  
  // Séparer par type basé sur la CAUSE et MOTIF
  // Visites = cause 99
  const visites = sortByDateDesc(allPannes?.filter((p: any) => {
    const cause = String(p.data_wpanne?.CAUSE ?? p.cause ?? '').trim();
    return cause === '99';
  }) || []);
  
  // Contrôles = motif commence par "CONTROLE" (cause=0 est la valeur par défaut, pas un contrôle)
  const controles = sortByDateDesc(allPannes?.filter((p: any) => {
    const motif = String(p.motif ?? '').toUpperCase().trim();
    return motif.startsWith('CONTROLE');
  }) || []);
  
  // Pannes = tout ce qui n'est ni visite ni contrôle
  const pannes = sortByDateDesc(allPannes?.filter((p: any) => {
    const cause = String(p.data_wpanne?.CAUSE ?? p.cause ?? '').trim();
    const motif = String(p.motif ?? '').toUpperCase().trim();
    const isVisite = cause === '99';
    const isControle = motif.startsWith('CONTROLE');
    return !isVisite && !isControle;
  }) || []);
  
  // Debug final
  console.log(`Modal: ${allPannes?.length || 0} total → ${visites.length} visites, ${controles.length} contrôles, ${pannes.length} pannes`);
  
  // Fonction pour formater une date YYYYMMDD (peut être string ou number)
  const formatDateYYYYMMDD = (dateVal: string | number | null) => {
    if (!dateVal) return null;
    const dateStr = String(dateVal);
    if (dateStr.length !== 8) return null;
    try {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    } catch {
      return null;
    }
  };
  
  // Fonction pour formater une heure HHMM ou HMM (peut être string ou number)
  const formatHeureHHMM = (heureVal: string | number | null) => {
    if (!heureVal && heureVal !== 0) return null;
    const h = String(heureVal).padStart(4, '0');
    return `${h.substring(0, 2)}h${h.substring(2, 4)}`;
  };
  
  // Fonction pour décoder les entités HTML
  const decodeHtml = (text: string | number | null) => {
    if (!text && text !== 0) return null;
    return String(text)
      .replace(/&#13;/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };
  
  // Composant détaillé pour une visite d'entretien
  const VisiteCard = ({ item }: { item: any }) => {
    const data = item.data_wpanne || {};
    const dateVisite = formatDateYYYYMMDD(data.DATE) || (item.date_appel ? parseISO(item.date_appel) : null);
    const heureInter = formatHeureHHMM(data.INTER);
    const heureFinInter = formatHeureHHMM(data.HRFININTER);
    const technicien = data.DEPANNEUR || data.CLEPERSO || item.depanneur;
    const notes = decodeHtml(data.NOTE2);
    const motif = data.Libelle || data.PANNES || item.motif;
    
    return (
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold">
                {dateVisite ? format(dateVisite, 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Visite d'entretien
              </p>
            </div>
          </div>
          <Badge variant="blue">Entretien</Badge>
        </div>
        
        {motif && (
          <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)]">{motif}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Technicien:</span>
            <span className="font-medium">{technicien || '-'}</span>
          </div>
          
          {heureInter && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Intervention:</span>
              <span className="font-medium">{heureInter}</span>
            </div>
          )}
          
          {heureFinInter && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Fin:</span>
              <span className="font-medium">{heureFinInter}</span>
            </div>
          )}
          
          {heureInter && heureFinInter && (
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Durée:</span>
              <span className="font-medium">
                {(() => {
                  const debut = parseInt(data.INTER || '0');
                  const fin = parseInt(data.HRFININTER || '0');
                  const debutMin = Math.floor(debut / 100) * 60 + (debut % 100);
                  const finMin = Math.floor(fin / 100) * 60 + (fin % 100);
                  const duree = finMin - debutMin;
                  return duree > 0 ? `${Math.floor(duree / 60)}h${(duree % 60).toString().padStart(2, '0')}` : '-';
                })()}
              </span>
            </div>
          )}
        </div>
        
        {notes && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Notes / Travaux effectués:</p>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{notes}</p>
          </div>
        )}
      </div>
    );
  };
  
  // Composant détaillé pour une panne
  const PanneCard = ({ item }: { item: any }) => {
    const data = item.data_wpanne || {};
    const datePanne = formatDateYYYYMMDD(data.DATE) || (item.date_appel ? parseISO(item.date_appel) : null);
    const heureAppel = formatHeureHHMM(data.APPEL);
    const heureInter = formatHeureHHMM(data.INTER);
    const heureFinInter = formatHeureHHMM(data.HRFININTER);
    const technicien = data.DEPANNEUR || data.CLEPERSO || item.depanneur;
    const notes = decodeHtml(data.NOTE2);
    const motifAppel = data.Libelle || item.motif;
    const typePanne = data.PANNES;
    const demandeur = data.DEMAND || item.demandeur;
    const telDemandeur = data.TELDEMAND;
    const causeCode = data.CAUSE;
    const persBloquees = item.personnes_bloquees || 0;
    
    return (
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              persBloquees > 0 ? 'bg-red-500/20' : 'bg-orange-500/20'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                persBloquees > 0 ? 'text-red-500' : 'text-orange-500'
              }`} />
            </div>
            <div>
              <p className="font-semibold">
                {datePanne ? format(datePanne, 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
              </p>
              {heureAppel && (
                <p className="text-xs text-[var(--text-muted)]">Appel à {heureAppel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {persBloquees > 0 && (
              <Badge variant="red" className="animate-pulse">
                {persBloquees} pers. bloquée{persBloquees > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant={item.etat === 'termine' ? 'green' : 'orange'}>
              {item.etat || 'En cours'}
            </Badge>
          </div>
        </div>
        
        {/* Motif d'appel */}
        {motifAppel && (
          <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-xs text-[var(--text-muted)] mb-1">Motif d'appel:</p>
            <p className="text-sm font-medium">{motifAppel}</p>
          </div>
        )}
        
        {/* Type de panne */}
        {typePanne && (
          <div className="mb-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <p className="text-xs text-orange-400 mb-1">Type de panne:</p>
            <p className="text-sm text-[var(--text-secondary)]">{typePanne}</p>
          </div>
        )}
        
        {/* Infos intervention */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Dépanneur:</span>
            <span className="font-medium">{technicien || '-'}</span>
          </div>
          
          {demandeur && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Demandeur:</span>
              <span className="font-medium">{demandeur} {telDemandeur ? `(${telDemandeur})` : ''}</span>
            </div>
          )}
          
          {causeCode && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Code cause:</span>
              <span className="font-medium">{causeCode}</span>
            </div>
          )}
        </div>
        
        {/* Timeline intervention */}
        {(heureAppel || heureInter || heureFinInter) && (
          <div className="flex items-center gap-4 p-2 bg-[var(--bg-secondary)] rounded-lg text-xs mb-3">
            {heureAppel && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">📞 Appel:</span>
                <span className="font-medium">{heureAppel}</span>
              </div>
            )}
            {heureInter && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">🚗 Arrivée:</span>
                <span className="font-medium">{heureInter}</span>
              </div>
            )}
            {heureFinInter && (
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">✅ Fin:</span>
                <span className="font-medium">{heureFinInter}</span>
              </div>
            )}
            {heureInter && heureFinInter && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[var(--text-muted)]">⏱️ Durée:</span>
                <span className="font-medium">
                  {(() => {
                    const debut = parseInt(data.INTER || '0');
                    const fin = parseInt(data.HRFININTER || '0');
                    const debutMin = Math.floor(debut / 100) * 60 + (debut % 100);
                    const finMin = Math.floor(fin / 100) * 60 + (fin % 100);
                    const duree = finMin - debutMin;
                    return duree > 0 ? `${Math.floor(duree / 60)}h${(duree % 60).toString().padStart(2, '0')}` : '-';
                  })()}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Notes / Travaux effectués */}
        {notes && (
          <div className="pt-3 border-t border-[var(--border-primary)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Notes / Travaux effectués:</p>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{notes}</p>
          </div>
        )}
      </div>
    );
  };
  
  // Composant pour les contrôles câbles/parachute
  const ControleCard = ({ item }: { item: any }) => {
    const data = item.data_wpanne || {};
    const dateControle = formatDateYYYYMMDD(data.DATE) || (item.date_appel ? parseISO(item.date_appel) : null);
    const heureInter = formatHeureHHMM(data.INTER);
    const heureFinInter = formatHeureHHMM(data.HRFININTER);
    const technicien = data.DEPANNEUR || data.CLEPERSO || item.depanneur;
    const notes = decodeHtml(data.NOTE2);
    const motif = data.Libelle || data.PANNES || item.motif;
    
    return (
      <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold">
                {dateControle ? format(dateControle, 'EEEE dd MMMM yyyy', { locale: fr }) : '-'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Contrôle câbles / parachute</p>
            </div>
          </div>
          <Badge variant="purple">Contrôle</Badge>
        </div>
        
        {motif && (
          <div className="mb-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-sm text-[var(--text-secondary)]">{motif}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Technicien:</span>
            <span className="font-medium">{technicien || '-'}</span>
          </div>
          
          {heureInter && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Intervention:</span>
              <span className="font-medium">{heureInter}</span>
            </div>
          )}
          
          {heureFinInter && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Fin:</span>
              <span className="font-medium">{heureFinInter}</span>
            </div>
          )}
        </div>
        
        {notes && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Observations:</p>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{notes}</p>
          </div>
        )}
      </div>
    );
  };
  
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowPiecesModal(true)}
                  className="p-2 hover:bg-purple-500/20 rounded-lg"
                  title="Signaler pièces remplacées"
                >
                  <Package className="w-5 h-5 text-purple-500" />
                </button>
                <button 
                  onClick={() => {
                    try {
                      generateRapportAscenseur({ ascenseur, pannes, visites, controles });
                      toast.success('Fiche PDF générée');
                    } catch (e) {
                      toast.error('Erreur génération PDF');
                    }
                  }}
                  className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
                  title="Exporter en PDF"
                >
                  <FileDown className="w-5 h-5 text-orange-500" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {[
                { id: 'info', label: 'Infos', icon: FileText, count: null },
                { id: 'historique', label: 'Historique', icon: History, count: visites.length + controles.length + pannes.length },
                { id: 'analyse', label: 'Analyse', icon: TrendingUp, count: null },
                { id: 'visites', label: 'Visites', icon: Calendar, count: visites.length },
                { id: 'controles', label: 'Contrôles', icon: Eye, count: controles.length },
                { id: 'pannes', label: 'Pannes', icon: AlertTriangle, count: pannes.length },
                { id: 'travaux', label: 'Travaux', icon: Wrench, count: travauxAscenseur?.length || 0 },
                { id: 'pieces', label: 'Pièces', icon: Package, count: null },
                { id: 'notes', label: 'Notes', icon: MessageSquare, count: notesAscenseur?.length || 0 },
                { id: 'documents', label: 'Documents', icon: FolderOpen, count: documentsAscenseur?.length || 0 }
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
                
                <div className={`p-4 rounded-xl col-span-2 ${
                  ascenseur.type_planning 
                    ? 'bg-[var(--bg-tertiary)]' 
                    : 'bg-gray-500/10 border border-gray-500/30'
                }`}>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" /> Contrat & Maintenance
                    {!ascenseur.type_planning && (
                      <Badge variant="gray" className="ml-2">Hors contrat</Badge>
                    )}
                  </h3>
                  {ascenseur.type_planning ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Type planning</span>
                        <span className="font-medium">{ascenseur.type_planning}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Visites/an</span>
                        <span className="font-medium text-blue-500">{ascenseur.nb_visites_an || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Dernier passage</span>
                        <span className="font-medium">{ascenseur.dernier_passage ? format(parseISO(ascenseur.dernier_passage), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] italic">
                      Cet appareil n'est pas sous contrat de maintenance.
                    </p>
                  )}
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
            
            {activeTab === 'historique' && (
              <div className="space-y-4">
                {(() => {
                  // Combiner toutes les interventions et trier par date
                  const allEvents: any[] = [];
                  
                  // Ajouter les visites
                  visites.forEach((v: any) => {
                    const data = v.data_wpanne || {};
                    let date: Date | null = null;
                    if (data.DATE) {
                      const ds = String(data.DATE);
                      if (ds.length === 8) {
                        date = new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                      }
                    }
                    allEvents.push({ type: 'visite', date, data: v, icon: Calendar, color: 'blue' });
                  });
                  
                  // Ajouter les contrôles
                  controles.forEach((c: any) => {
                    const data = c.data_wpanne || {};
                    let date: Date | null = null;
                    if (data.DATE) {
                      const ds = String(data.DATE);
                      if (ds.length === 8) {
                        date = new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                      }
                    }
                    allEvents.push({ type: 'controle', date, data: c, icon: Eye, color: 'purple' });
                  });
                  
                  // Ajouter les pannes
                  pannes.forEach((p: any) => {
                    const data = p.data_wpanne || {};
                    let date: Date | null = null;
                    if (data.DATE) {
                      const ds = String(data.DATE);
                      if (ds.length === 8) {
                        date = new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                      }
                    }
                    allEvents.push({ type: 'panne', date, data: p, icon: AlertTriangle, color: 'orange' });
                  });
                  
                  // Trier par date décroissante
                  allEvents.sort((a, b) => {
                    if (!a.date && !b.date) return 0;
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return b.date.getTime() - a.date.getTime();
                  });
                  
                  if (allEvents.length === 0) {
                    return <EmptyState icon={History} message="Aucun historique disponible" />;
                  }
                  
                  // Grouper par année
                  const eventsByYear: Record<number, any[]> = {};
                  allEvents.forEach(e => {
                    const year = e.date ? e.date.getFullYear() : 0;
                    if (!eventsByYear[year]) eventsByYear[year] = [];
                    eventsByYear[year].push(e);
                  });
                  
                  const years = Object.keys(eventsByYear).map(Number).sort((a,b) => b - a);
                  
                  return (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[var(--border-primary)]"></div>
                      
                      {years.map(year => (
                        <div key={year} className="mb-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center z-10">
                              <span className="text-sm font-bold">{year || '?'}</span>
                            </div>
                            <span className="text-sm text-[var(--text-muted)]">
                              {eventsByYear[year].length} intervention{eventsByYear[year].length > 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="space-y-3 ml-2">
                            {eventsByYear[year].map((event: any, idx: number) => {
                              const data = event.data.data_wpanne || {};
                              const Icon = event.icon;
                              const colorClass = event.color === 'blue' ? 'bg-blue-500' : 
                                                 event.color === 'purple' ? 'bg-purple-500' : 'bg-orange-500';
                              const borderClass = event.color === 'blue' ? 'border-blue-500/30' : 
                                                  event.color === 'purple' ? 'border-purple-500/30' : 'border-orange-500/30';
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`flex items-start gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border ${borderClass} cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors`}
                                  onClick={() => setSelectedIntervention(event)}
                                >
                                  <div className={`w-8 h-8 rounded-full ${colorClass}/20 flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-4 h-4 text-${event.color}-400`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-sm capitalize">
                                        {event.type === 'visite' ? 'Visite d\'entretien' : 
                                         event.type === 'controle' ? 'Contrôle technique' : 'Panne'}
                                      </span>
                                      {event.date && (
                                        <span className="text-xs text-[var(--text-muted)]">
                                          {format(event.date, 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                      )}
                                    </div>
                                    {data.Libelle && (
                                      <p className="text-sm text-[var(--text-muted)] truncate">{data.Libelle}</p>
                                    )}
                                    {data.DEPANNEUR && (
                                      <p className="text-xs text-[var(--text-muted)] mt-1">
                                        <User className="w-3 h-3 inline mr-1" />{data.DEPANNEUR}
                                      </p>
                                    )}
                                    <p className="text-xs text-blue-400 mt-1">Cliquer pour voir le détail →</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                
                {/* Panel de détail de l'intervention sélectionnée */}
                {selectedIntervention && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setSelectedIntervention(null)}>
                    <div className="bg-[var(--bg-secondary)] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                      <div className="p-4 bg-[var(--bg-tertiary)] flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          {selectedIntervention.type === 'visite' && <Calendar className="w-5 h-5 text-blue-400" />}
                          {selectedIntervention.type === 'controle' && <Eye className="w-5 h-5 text-purple-400" />}
                          {selectedIntervention.type === 'panne' && <AlertTriangle className="w-5 h-5 text-orange-400" />}
                          {selectedIntervention.type === 'visite' ? 'Visite d\'entretien' : 
                           selectedIntervention.type === 'controle' ? 'Contrôle technique' : 'Panne'}
                          {selectedIntervention.date && (
                            <span className="text-sm text-[var(--text-muted)] ml-2">
                              {format(selectedIntervention.date, 'dd MMMM yyyy', { locale: fr })}
                            </span>
                          )}
                        </h3>
                        <button onClick={() => setSelectedIntervention(null)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto max-h-[60vh]">
                        {(() => {
                          const data = selectedIntervention.data?.data_wpanne || selectedIntervention.data || {};
                          const rawData = selectedIntervention.data || {};
                          
                          return (
                            <div className="space-y-4">
                              {/* Informations principales */}
                              <div className="grid grid-cols-2 gap-4">
                                {data.DATE && (
                                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                    <p className="text-xs text-[var(--text-muted)]">Date</p>
                                    <p className="font-medium">{String(data.DATE).replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}</p>
                                  </div>
                                )}
                                {(data.HEURE || data.HEURE_DEBUT) && (
                                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                    <p className="text-xs text-[var(--text-muted)]">Heure</p>
                                    <p className="font-medium">{String(data.HEURE || data.HEURE_DEBUT).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1h$2')}</p>
                                  </div>
                                )}
                                {data.DEPANNEUR && (
                                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                    <p className="text-xs text-[var(--text-muted)]">Technicien</p>
                                    <p className="font-medium">{data.DEPANNEUR}</p>
                                  </div>
                                )}
                                {data.CAUSE && (
                                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                    <p className="text-xs text-[var(--text-muted)]">Cause</p>
                                    <p className="font-medium">{data.CAUSE}</p>
                                  </div>
                                )}
                                {rawData.motif && (
                                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg col-span-2">
                                    <p className="text-xs text-[var(--text-muted)]">Motif</p>
                                    <p className="font-medium">{rawData.motif}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Libellé / Description */}
                              {data.Libelle && (
                                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                  <p className="text-xs text-[var(--text-muted)] mb-1">Description</p>
                                  <p className="text-sm whitespace-pre-wrap">{decodeHtml(data.Libelle)}</p>
                                </div>
                              )}
                              
                              {/* Ensemble / Organe */}
                              {(data.ENSEMBLE || data.ORGANE) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {data.ENSEMBLE && (
                                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                      <p className="text-xs text-[var(--text-muted)]">Ensemble</p>
                                      <p className="font-medium">{data.ENSEMBLE}</p>
                                    </div>
                                  )}
                                  {data.ORGANE && (
                                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                      <p className="text-xs text-[var(--text-muted)]">Organe</p>
                                      <p className="font-medium">{data.ORGANE}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Actions / Travaux */}
                              {(data.TRAVAUX || data.ACTION) && (
                                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                  <p className="text-xs text-[var(--text-muted)] mb-1">Travaux effectués</p>
                                  <p className="text-sm whitespace-pre-wrap">{decodeHtml(data.TRAVAUX || data.ACTION)}</p>
                                </div>
                              )}
                              
                              {/* Observations */}
                              {data.OBSERVATIONS && (
                                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                  <p className="text-xs text-[var(--text-muted)] mb-1">Observations</p>
                                  <p className="text-sm whitespace-pre-wrap">{decodeHtml(data.OBSERVATIONS)}</p>
                                </div>
                              )}
                              
                              {/* Durée */}
                              {(data.DUREE || (data.HEURE_DEBUT && data.HEURE_FIN)) && (
                                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                  <p className="text-xs text-[var(--text-muted)]">Durée</p>
                                  <p className="font-medium">
                                    {data.DUREE ? `${data.DUREE} min` : 
                                      `${String(data.HEURE_DEBUT).padStart(4,'0').replace(/(\d{2})(\d{2})/,'$1h$2')} - ${String(data.HEURE_FIN).padStart(4,'0').replace(/(\d{2})(\d{2})/,'$1h$2')}`}
                                  </p>
                                </div>
                              )}
                              
                              {/* Note technique (NOTE2) */}
                              {data.NOTE2 && (
                                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                                  <p className="text-xs text-[var(--text-muted)] mb-1">Notes techniques</p>
                                  <p className="text-sm whitespace-pre-wrap">{decodeHtml(data.NOTE2)}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'analyse' && (
              <div className="space-y-6">
                {(() => {
                  // Statistiques de l'ascenseur
                  const totalInterventions = visites.length + controles.length + pannes.length;
                  
                  // Pannes par type (ensemble/organe)
                  const pannesParType: Record<string, number> = {};
                  pannes.forEach((p: any) => {
                    const data = p.data_wpanne || {};
                    const ensemble = data.ENSEMBLE || data.PANNES || 'Non défini';
                    pannesParType[ensemble] = (pannesParType[ensemble] || 0) + 1;
                  });
                  const topPanneTypes = Object.entries(pannesParType)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5);
                  
                  // Détection de pannes récurrentes (même type dans les 6 derniers mois)
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  
                  const pannesRecentes = pannes.filter((p: any) => {
                    const data = p.data_wpanne || {};
                    if (data.DATE) {
                      const ds = String(data.DATE);
                      if (ds.length === 8) {
                        const d = new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                        return d >= sixMonthsAgo;
                      }
                    }
                    return false;
                  });
                  
                  const pannesRecentesParType: Record<string, number> = {};
                  pannesRecentes.forEach((p: any) => {
                    const data = p.data_wpanne || {};
                    const ensemble = data.ENSEMBLE || data.PANNES || 'Non défini';
                    pannesRecentesParType[ensemble] = (pannesRecentesParType[ensemble] || 0) + 1;
                  });
                  
                  const pannesRecurrentes = Object.entries(pannesRecentesParType)
                    .filter(([, count]) => count >= 2)
                    .sort(([,a], [,b]) => b - a);
                  
                  // Temps moyen entre pannes
                  let tempsMoyenEntrePannes: number | null = null;
                  if (pannes.length >= 2) {
                    const datesPannes = pannes
                      .map((p: any) => {
                        const data = p.data_wpanne || {};
                        if (data.DATE) {
                          const ds = String(data.DATE);
                          if (ds.length === 8) {
                            return new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                          }
                        }
                        return null;
                      })
                      .filter(Boolean)
                      .sort((a: any, b: any) => a.getTime() - b.getTime());
                    
                    if (datesPannes.length >= 2) {
                      let totalJours = 0;
                      for (let i = 1; i < datesPannes.length; i++) {
                        totalJours += (datesPannes[i].getTime() - datesPannes[i-1].getTime()) / (1000 * 60 * 60 * 24);
                      }
                      tempsMoyenEntrePannes = Math.round(totalJours / (datesPannes.length - 1));
                    }
                  }
                  
                  // Taux de disponibilité estimé (basé sur les arrêts)
                  const dernierAn = new Date();
                  dernierAn.setFullYear(dernierAn.getFullYear() - 1);
                  const pannesDernierAn = pannes.filter((p: any) => {
                    const data = p.data_wpanne || {};
                    if (data.DATE) {
                      const ds = String(data.DATE);
                      if (ds.length === 8) {
                        const d = new Date(parseInt(ds.substring(0,4)), parseInt(ds.substring(4,6))-1, parseInt(ds.substring(6,8)));
                        return d >= dernierAn;
                      }
                    }
                    return false;
                  });
                  
                  return (
                    <>
                      {/* KPIs ascenseur */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                          <p className="text-2xl font-bold text-blue-400">{totalInterventions}</p>
                          <p className="text-xs text-[var(--text-muted)]">Total interventions</p>
                        </div>
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                          <p className="text-2xl font-bold text-orange-400">{pannes.length}</p>
                          <p className="text-xs text-[var(--text-muted)]">Pannes totales</p>
                        </div>
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl text-center">
                          <p className="text-2xl font-bold text-red-400">{pannesDernierAn.length}</p>
                          <p className="text-xs text-[var(--text-muted)]">Pannes (12 mois)</p>
                        </div>
                      </div>
                      
                      {/* Temps moyen entre pannes */}
                      {tempsMoyenEntrePannes !== null && (
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Timer className="w-5 h-5 text-purple-400" />
                              </div>
                              <div>
                                <p className="font-medium">Temps moyen entre pannes</p>
                                <p className="text-sm text-[var(--text-muted)]">Basé sur l'historique complet</p>
                              </div>
                            </div>
                            <p className="text-2xl font-bold text-purple-400">{tempsMoyenEntrePannes}j</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Pannes récurrentes */}
                      {pannesRecurrentes.length > 0 && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                          <h4 className="font-semibold flex items-center gap-2 mb-3 text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            Pannes récurrentes détectées (6 derniers mois)
                          </h4>
                          <div className="space-y-2">
                            {pannesRecurrentes.map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg">
                                <span className="text-sm truncate flex-1">{type}</span>
                                <Badge variant="red">{count} fois</Badge>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-3">
                            💡 Ces pannes répétées peuvent indiquer un problème sous-jacent nécessitant une intervention approfondie.
                          </p>
                        </div>
                      )}
                      
                      {/* Top types de pannes */}
                      {topPanneTypes.length > 0 && (
                        <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                          <h4 className="font-semibold flex items-center gap-2 mb-3">
                            <BarChart3 className="w-5 h-5 text-orange-400" />
                            Types de pannes les plus fréquents
                          </h4>
                          <div className="space-y-2">
                            {topPanneTypes.map(([type, count], idx) => {
                              const maxCount = topPanneTypes[0][1] as number;
                              return (
                                <div key={type} className="flex items-center gap-3">
                                  <span className="text-sm w-6 font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm truncate">{type}</span>
                                      <span className="text-sm font-semibold">{count}</span>
                                    </div>
                                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                                      <div 
                                        className="h-full bg-orange-500 rounded-full"
                                        style={{ width: `${(count / maxCount) * 100}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {pannes.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                          <p>Excellent ! Aucune panne enregistrée pour cet ascenseur.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            
            {/* Onglet Notes */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                {/* Formulaire d'ajout de note */}
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Plus className="w-4 h-4 text-indigo-400" />
                    Ajouter une note publique
                  </h4>
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Écrire une note sur cet ascenseur..."
                    className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!newNoteContent.trim() || isAddingNote}
                      onClick={async () => {
                        if (!newNoteContent.trim()) return;
                        setIsAddingNote(true);
                        try {
                          const { error } = await supabase
                            .from('notes')
                            .insert({
                              titre: `Note - ${ascenseur.code_appareil}`,
                              contenu: newNoteContent.trim(),
                              code_ascenseur: ascenseur.code_appareil,
                              partage: true,
                              couleur: '#f97316' // Orange pour les notes ascenseur
                            });
                          
                          if (error) throw error;
                          
                          toast.success('Note ajoutée');
                          setNewNoteContent('');
                          refetchNotes();
                        } catch (e) {
                          console.error('Erreur ajout note:', e);
                          toast.error('Erreur lors de l\'ajout');
                        } finally {
                          setIsAddingNote(false);
                        }
                      }}
                    >
                      {isAddingNote ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Publier
                    </Button>
                  </div>
                </div>
                
                {/* Liste des notes */}
                {notesAscenseur && notesAscenseur.length > 0 ? (
                  <div className="space-y-3">
                    {notesAscenseur.map((note: any) => (
                      <div 
                        key={note.id} 
                        className="p-4 rounded-xl border-l-4"
                        style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          borderLeftColor: note.couleur || '#f97316'
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold">{note.titre}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {note.created_at ? format(parseISO(note.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}
                            </p>
                          </div>
                          {note.epingle && (
                            <Badge variant="yellow" className="text-[10px]">
                              📌 Épinglé
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                          {note.contenu}
                        </p>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {note.tags.map((tag: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-[var(--bg-secondary)] rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune note publique pour cet ascenseur</p>
                    <p className="text-xs mt-1">Ajoutez une note ci-dessus pour la partager avec l'équipe</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Onglet Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                {/* Zone d'upload */}
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Upload className="w-4 h-4 text-blue-400" />
                    Ajouter un document
                  </h4>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleUploadDocument}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingDoc}
                    className="w-full p-6 border-2 border-dashed border-[var(--border-primary)] rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-colors flex flex-col items-center gap-2"
                  >
                    {isUploadingDoc ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        <span className="text-sm text-[var(--text-muted)]">Upload en cours...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-muted)]">Cliquez pour ajouter un fichier</span>
                        <span className="text-xs text-[var(--text-muted)]">PDF, Images, Word, Excel...</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Liste des documents */}
                {documentsAscenseur && documentsAscenseur.length > 0 ? (
                  <div className="space-y-3">
                    {documentsAscenseur.map((doc: any) => {
                      // Déterminer l'icône selon le type
                      const ext = doc.nom?.split('.').pop()?.toLowerCase() || '';
                      let DocIcon = File;
                      let iconColor = 'text-gray-400';
                      
                      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                        DocIcon = Image;
                        iconColor = 'text-orange-400';
                      } else if (['pdf'].includes(ext)) {
                        DocIcon = FileText;
                        iconColor = 'text-red-400';
                      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                        DocIcon = FileSpreadsheet;
                        iconColor = 'text-green-400';
                      } else if (['doc', 'docx', 'txt'].includes(ext)) {
                        DocIcon = FileText;
                        iconColor = 'text-blue-400';
                      }
                      
                      return (
                        <div 
                          key={doc.id} 
                          className="p-4 bg-[var(--bg-tertiary)] rounded-xl flex items-center gap-4"
                        >
                          <div className={`w-12 h-12 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center ${iconColor}`}>
                            <DocIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.nom}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {doc.created_at ? format(parseISO(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}
                              {doc.fichier_taille && ` • ${(doc.fichier_taille / 1024).toFixed(1)} Ko`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.fichier_url && (
                              <>
                                <a
                                  href={doc.fichier_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg"
                                  title="Voir"
                                >
                                  <Eye className="w-4 h-4 text-blue-400" />
                                </a>
                                <a
                                  href={doc.fichier_url}
                                  download={doc.nom}
                                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg"
                                  title="Télécharger"
                                >
                                  <Download className="w-4 h-4 text-green-400" />
                                </a>
                              </>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm('Supprimer ce document ?')) return;
                                try {
                                  const { error } = await supabase
                                    .from('documents')
                                    .delete()
                                    .eq('id', doc.id);
                                  if (error) throw error;
                                  toast.success('Document supprimé');
                                  refetchDocs();
                                } catch (e) {
                                  toast.error('Erreur lors de la suppression');
                                }
                              }}
                              className="p-2 hover:bg-red-500/10 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun document pour cet ascenseur</p>
                    <p className="text-xs mt-1">Ajoutez des photos, rapports, certificats...</p>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Pièces remplacées */}
            {activeTab === 'travaux' && (
              <div className="space-y-4">
                {/* En-tête */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-purple-400" />
                    Travaux sur cet appareil
                  </h3>
                  <span className="text-sm text-[var(--text-muted)]">
                    {travauxAscenseur?.length || 0} travaux
                  </span>
                </div>

                {/* Liste des travaux */}
                {!travauxAscenseur || travauxAscenseur.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun travaux enregistré sur cet appareil</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {travauxAscenseur.map((t: any) => {
                      const statutConfig: Record<string, { label: string; color: string; bg: string }> = {
                        planifie: { label: 'Planifié', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        en_cours: { label: 'En cours', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        termine: { label: 'Terminé', color: 'text-green-400', bg: 'bg-green-500/10' },
                        annule: { label: 'Annulé', color: 'text-gray-400', bg: 'bg-gray-500/10' },
                      };
                      const statut = statutConfig[t.statut] || statutConfig.planifie;
                      
                      const prioriteConfig: Record<string, { label: string; color: string }> = {
                        basse: { label: 'Basse', color: 'text-gray-400' },
                        normale: { label: 'Normale', color: 'text-blue-400' },
                        haute: { label: 'Haute', color: 'text-amber-400' },
                        urgente: { label: 'Urgente', color: 'text-red-400' },
                      };
                      const priorite = prioriteConfig[t.priorite] || prioriteConfig.normale;

                      return (
                        <div 
                          key={t.id}
                          className={`p-4 rounded-xl border ${statut.bg} border-[var(--border-primary)]`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-mono font-bold text-purple-400">{t.code}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statut.bg} ${statut.color}`}>
                                  {statut.label}
                                </span>
                                <span className={`text-xs ${priorite.color}`}>
                                  {priorite.label}
                                </span>
                              </div>
                              <h4 className="font-semibold text-[var(--text-primary)] mb-1">{t.titre}</h4>
                              {t.description && (
                                <p className="text-sm text-[var(--text-muted)] mb-2 line-clamp-2">{t.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                                {t.technicien && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {t.technicien.prenom} {t.technicien.nom}
                                  </span>
                                )}
                                {t.date_butoir && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(parseISO(t.date_butoir), 'd MMM yyyy', { locale: fr })}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(t.created_at), 'd MMM yyyy', { locale: fr })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-[var(--text-primary)]">{t.progression || 0}%</div>
                              <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mt-1">
                                <div 
                                  className={`h-full ${t.progression >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                                  style={{ width: `${t.progression || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Tâches si présentes */}
                          {t.taches && t.taches.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                              <p className="text-xs text-[var(--text-muted)] mb-2">
                                {t.taches.filter((tache: any) => tache.statut === 'termine').length}/{t.taches.length} tâches terminées
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {t.taches.slice(0, 5).map((tache: any, idx: number) => (
                                  <span 
                                    key={idx}
                                    className={`text-[10px] px-2 py-0.5 rounded ${
                                      tache.statut === 'termine' 
                                        ? 'bg-green-500/10 text-green-400 line-through' 
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {tache.description?.substring(0, 30)}{tache.description?.length > 30 ? '...' : ''}
                                  </span>
                                ))}
                                {t.taches.length > 5 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                    +{t.taches.length - 5}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Pièces si présentes */}
                          {t.pieces && t.pieces.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                              <p className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {t.pieces.length} pièce(s)
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {t.pieces.slice(0, 3).map((piece: any, idx: number) => (
                                  <span 
                                    key={idx}
                                    className={`text-[10px] px-2 py-0.5 rounded ${
                                      piece.consommee 
                                        ? 'bg-green-500/10 text-green-400' 
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {piece.designation?.substring(0, 25)}{piece.designation?.length > 25 ? '...' : ''} ×{piece.quantite}
                                  </span>
                                ))}
                                {t.pieces.length > 3 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                    +{t.pieces.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pieces' && (
              <div className="space-y-4">
                <PiecesRemplaceesByAscenseur codeAppareil={ascenseur.code_appareil} />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Modal Signaler Pièces */}
      {showPiecesModal && (
        <SignalerPiecesModal
          ascenseur={ascenseur}
          onClose={() => setShowPiecesModal(false)}
        />
      )}
    </div>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function ParcAscenseursPage() {
  const [mainTab, setMainTab] = useState<'parc' | 'arrets' | 'pannes' | 'tournees' | 'stats' | 'carte' | 'pieces'>('parc');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [secteurFilter, setSecteurFilter] = useState<string>('');
  const [contratFilter, setContratFilter] = useState<'all' | 'contrat' | 'hors_contrat'>('all');
  const [showArretOnly, setShowArretOnly] = useState(false);
  const [selectedAscenseur, setSelectedAscenseur] = useState<Ascenseur | null>(null);
  const [selectedPanne, setSelectedPanne] = useState<any | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // État pour la période des statistiques (en mois)
  const [statsPeriod, setStatsPeriod] = useState<6 | 12 | 24 | 36>(6);
  
  // États pour l'optimisation des tournées
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    secteur: number;
    points: number;
    distanceActuelle: number;
    distanceOptimisee: number;
    tempsGagne: number;
    totalDuration?: number;
    heureDepart: string;
    heureArrivee: string;
    optimizedRoute?: OptimizedRoute;
  } | null>(null);
  
  // États pour la carte et le planning des tournées
  const [tourneeMapModal, setTourneeMapModal] = useState<{
    secteur: number;
    ordre: number;
    ascenseurs: any[];
  } | null>(null);
  
  const [tourneePlanningModal, setTourneePlanningModal] = useState<{
    secteur: number;
    ordre: number;
    ascenseurs: any[];
  } | null>(null);
  
  // État pour le géocodage
  const [showGeocodingModal, setShowGeocodingModal] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState<{
    isRunning: boolean;
    current: number;
    total: number;
    success: number;
    failed: number;
    lastCode?: string;
    lastSuccess?: boolean;
    failures?: Array<{ id: number; code: string; adresse: string; ville: string; error: string }>;
  }>({ isRunning: false, current: 0, total: 0, success: 0, failed: 0 });
  
  const queryClient = useQueryClient();
  
  // Fonction de géocodage en masse
  const runGeocoding = async (forceAll: boolean = false) => {
    setGeocodingProgress({
      isRunning: true,
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      failures: []
    });
    
    try {
      let successCount = 0;
      let failedCount = 0;
      
      const result = await geocodeAndUpdateAll((current, total, lastResult) => {
        // Compter les succès et échecs
        if (lastResult.success) {
          successCount++;
        } else {
          failedCount++;
        }
        
        setGeocodingProgress(prev => ({
          ...prev,
          isRunning: true,
          current,
          total,
          success: successCount,
          failed: failedCount,
          lastCode: lastResult.code,
          lastSuccess: lastResult.success
        }));
      }, forceAll);
      
      setGeocodingProgress({
        isRunning: false,
        current: result.total,
        total: result.total,
        success: result.success,
        failed: result.failed,
        lastCode: undefined,
        lastSuccess: undefined,
        failures: result.failures || []
      });
      
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['parc-ascenseurs'] });
      
      toast.success(`Géocodage terminé: ${result.success} succès, ${result.failed} échecs`);
    } catch (error) {
      console.error('Erreur géocodage:', error);
      setGeocodingProgress(prev => ({ ...prev, isRunning: false }));
      toast.error('Erreur lors du géocodage');
    }
  };
  
  // Récupérer les secteurs autorisés de l'utilisateur
  const { data: userSecteurs } = useQuery({
    queryKey: ['user-secteurs'],
    queryFn: getUserSecteurs
  });
  
  // Récupérer les types de planning pour le nb de visites
  const { data: typesPlanning } = useQuery({
    queryKey: ['parc-types-planning'],
    queryFn: getTypesPlanning
  });
  
  const { data: ascenseursRaw, isLoading } = useQuery({
    queryKey: ['parc-ascenseurs', userSecteurs],
    queryFn: () => getAscenseurs(undefined, userSecteurs),
    enabled: userSecteurs !== undefined // Attendre que userSecteurs soit chargé
  });
  
  // Enrichir les ascenseurs avec le nb de visites depuis types planning
  const ascenseurs = useMemo(() => {
    if (!ascenseursRaw) return [];
    if (!typesPlanning) return ascenseursRaw;
    
    return ascenseursRaw.map((a: any) => ({
      ...a,
      nb_visites_an: a.type_planning ? (typesPlanning[a.type_planning] || 0) : 0,
      hors_contrat: !a.type_planning
    }));
  }, [ascenseursRaw, typesPlanning]);
  
  const { data: arrets } = useQuery({
    queryKey: ['parc-arrets'],
    queryFn: getArrets,
    refetchInterval: 60000 // Refresh toutes les minutes
  });
  
  // Pannes récentes (le filtrage par secteurs se fait côté client après enrichissement)
  const { data: pannesRecentes } = useQuery({
    queryKey: ['parc-pannes-recentes'],
    queryFn: getPannesRecentes
  });
  
  // TOUS les ascenseurs pour l'enrichissement des pannes (sans filtre secteur)
  const { data: allAscenseurs } = useQuery({
    queryKey: ['parc-all-ascenseurs-enrichment'],
    queryFn: getAllAscenseursForEnrichment
  });
  
  // Enrichir les arrêts avec les données des ascenseurs (utiliser TOUS les ascenseurs)
  const enrichedArrets = useMemo(() => {
    if (!arrets || !allAscenseurs) return [];
    
    // Créer un map id_wsoucont -> ascenseur
    const ascenseursMap: Record<number, any> = {};
    allAscenseurs.forEach((a: any) => {
      if (a.id_wsoucont) {
        ascenseursMap[a.id_wsoucont] = a;
      }
    });
    
    return arrets.map((arret: any) => {
      const asc = ascenseursMap[arret.id_wsoucont];
      return {
        ...arret,
        // Enrichir avec les données de l'ascenseur (priorité à l'ascenseur car arret peut avoir des valeurs null)
        code_appareil: asc?.code_appareil || arret.code_appareil,
        adresse: asc?.adresse || arret.adresse,
        ville: asc?.ville || arret.ville,
        code_postal: asc?.code_postal || arret.code_postal,
        secteur: asc?.secteur || arret.secteur,
        marque: asc?.marque || arret.marque,
        modele: asc?.modele || arret.modele,
        type_planning: asc?.type_planning || arret.type_planning,
        nb_visites_an: asc?.nb_visites_an || 0,
        localisation: asc?.localisation || arret.localisation,
        tel_cabine: asc?.tel_cabine,
        type_appareil: asc?.type_appareil,
        hors_contrat: !asc?.type_planning
      };
    });
  }, [arrets, allAscenseurs]);
  
  // Filtrer les arrêts selon les secteurs de l'utilisateur
  const filteredArrets = useMemo(() => {
    if (!enrichedArrets) return [];
    if (!userSecteurs || userSecteurs.length === 0) return enrichedArrets;
    return enrichedArrets.filter((a: Arret) => userSecteurs.includes(a.secteur));
  }, [enrichedArrets, userSecteurs]);
  
  // Enrichir les pannes avec les données des ascenseurs (utiliser TOUS les ascenseurs)
  const enrichedPannes = useMemo(() => {
    if (!pannesRecentes || !allAscenseurs) {
      console.log('enrichedPannes: données manquantes', { pannes: pannesRecentes?.length, asc: allAscenseurs?.length });
      return [];
    }
    
    console.log(`enrichedPannes: ${pannesRecentes.length} pannes à enrichir avec ${allAscenseurs.length} ascenseurs`);
    
    // Créer un map des ascenseurs par id_wsoucont (essayer plusieurs types de clé)
    const ascenseursMapNum: Record<number, any> = {};
    const ascenseursMapStr: Record<string, any> = {};
    allAscenseurs.forEach((a: any) => {
      if (a.id_wsoucont !== null && a.id_wsoucont !== undefined) {
        ascenseursMapNum[Number(a.id_wsoucont)] = a;
        ascenseursMapStr[String(a.id_wsoucont)] = a;
      }
    });
    
    // Debug: afficher quelques id_wsoucont avec leurs types
    const sampleAsc = allAscenseurs.slice(0, 3);
    const samplePanne = pannesRecentes.slice(0, 3);
    console.log('Sample ascenseurs:', sampleAsc.map((a: any) => ({ id: a.id_wsoucont, type: typeof a.id_wsoucont, code: a.code_appareil })));
    console.log('Sample pannes:', samplePanne.map((p: any) => ({ id: p.id_wsoucont, type: typeof p.id_wsoucont, code: p.code_appareil })));
    
    let matchCount = 0;
    const result = pannesRecentes.map((panne: any) => {
      // Essayer les deux types de clé
      const asc = ascenseursMapNum[Number(panne.id_wsoucont)] || ascenseursMapStr[String(panne.id_wsoucont)];
      if (asc) matchCount++;
      return {
        ...panne,
        code_appareil: asc?.code_appareil || panne.code_appareil || 'Inconnu',
        adresse: asc?.adresse || '',
        ville: asc?.ville || '',
        secteur: asc?.secteur,
        marque: asc?.marque || '',
        type_planning: asc?.type_planning || ''
      };
    });
    
    console.log(`enrichedPannes: ${matchCount}/${pannesRecentes.length} pannes ont trouvé leur ascenseur`);
    
    return result;
  }, [pannesRecentes, allAscenseurs]);
  
  // Filtrer les vraies pannes : exclure visites (cause 99) et contrôles (motif contient CONTROLE)
  const vraisPannes = useMemo(() => {
    if (!enrichedPannes || enrichedPannes.length === 0) return [];
    
    // Fonction pour extraire la date (priorité data_wpanne.DATE format YYYYMMDD)
    const getDateFromPanne = (p: any): Date | null => {
      const data = p.data_wpanne || {};
      // Essayer data_wpanne.DATE (format YYYYMMDD)
      if (data.DATE) {
        const dateStr = String(data.DATE);
        if (dateStr.length === 8) {
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          return new Date(year, month, day);
        }
      }
      // Fallback sur date_appel (format ISO ou autre)
      if (p.date_appel) {
        const d = new Date(p.date_appel);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };
    
    // Debug: afficher des exemples de causes et motifs
    if (enrichedPannes.length > 0) {
      const causeCounts: Record<string, number> = {};
      const motifSample: string[] = [];
      enrichedPannes.slice(0, 50).forEach((p: any) => {
        const cause = String(p.data_wpanne?.CAUSE ?? p.cause ?? 'vide');
        causeCounts[cause] = (causeCounts[cause] || 0) + 1;
        if (motifSample.length < 3 && p.motif) motifSample.push(String(p.motif).substring(0, 30));
      });
      console.log('Répartition causes:', causeCounts);
      if (motifSample.length > 0) console.log('Exemples motifs:', motifSample);
    }
    
    // Exclure visites (cause 99) et contrôles (motif commence par CONTROLE)
    let filtered = enrichedPannes.filter((p: any) => {
      const cause = String(p.data_wpanne?.CAUSE ?? p.cause ?? '').trim();
      const motif = String(p.motif ?? '').toUpperCase().trim();
      const isVisite = cause === '99';
      const isControle = motif.startsWith('CONTROLE');
      return !isVisite && !isControle;
    });
    
    console.log(`Filtrage: ${enrichedPannes.length} → ${filtered.length} après exclusion visites/contrôles`);
    
    // Filtrer par secteurs autorisés si définis
    if (userSecteurs && userSecteurs.length > 0) {
      const avecSecteur = filtered.filter((p: any) => p.secteur !== undefined && p.secteur !== null);
      
      if (avecSecteur.length < filtered.length * 0.1) {
        console.warn('Enrichissement incomplet - filtrage secteur ignoré');
      } else {
        const avantFiltrage = filtered.length;
        filtered = filtered.filter((p: any) => p.secteur && userSecteurs.includes(p.secteur));
        console.log(`Filtrage secteurs ${userSecteurs.join(',')}: ${avantFiltrage} → ${filtered.length}`);
      }
    }
    
    // Trier par date décroissante (les plus récentes en premier)
    const sorted = filtered.sort((a: any, b: any) => {
      const dateA = getDateFromPanne(a);
      const dateB = getDateFromPanne(b);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA; // Décroissant
    });
    
    if (sorted.length > 0) {
      const firstDate = getDateFromPanne(sorted[0]);
      console.log(`vraisPannes: ${sorted.length} pannes (plus récente: ${firstDate?.toISOString().split('T')[0]})`);
    } else {
      console.log('vraisPannes: 0 pannes après filtrage');
    }
    
    return sorted;
  }, [enrichedPannes, userSecteurs]);
  
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
  
  // Stats sous contrat / hors contrat
  const contratStats = useMemo(() => {
    if (!ascenseurs) return { sousContrat: 0, horsContrat: 0 };
    const sousContrat = ascenseurs.filter((a: any) => a.type_planning).length;
    const horsContrat = ascenseurs.filter((a: any) => !a.type_planning).length;
    return { sousContrat, horsContrat };
  }, [ascenseurs]);
  
  // Compter les vraies pannes des 30 derniers jours
  const pannes30j = useMemo(() => {
    if (!vraisPannes || vraisPannes.length === 0) {
      console.log('pannes30j: vraisPannes vide');
      return 0;
    }
    
    // Fonction pour extraire la date
    const getDateFromPanne = (p: any): Date | null => {
      const data = p.data_wpanne || {};
      if (data.DATE) {
        const dateStr = String(data.DATE);
        if (dateStr.length === 8) {
          const year = parseInt(dateStr.substring(0, 4));
          const month = parseInt(dateStr.substring(4, 6)) - 1;
          const day = parseInt(dateStr.substring(6, 8));
          return new Date(year, month, day);
        }
      }
      if (p.date_appel) {
        return new Date(p.date_appel);
      }
      return null;
    };
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const count = vraisPannes.filter((p: any) => {
      const dateAppel = getDateFromPanne(p);
      if (!dateAppel) return false;
      return dateAppel >= thirtyDaysAgo;
    }).length;
    
    console.log(`pannes30j: ${count} pannes sur les 30 derniers jours (depuis ${thirtyDaysAgo.toISOString().split('T')[0]})`);
    return count;
  }, [vraisPannes]);
  
  // Compter les ascenseurs avec tournée (ordre2 défini) - uniquement sous contrat et dans les secteurs accessibles
  const ascenseursAvecTourneeCount = useMemo(() => {
    if (!ascenseurs) return 0;
    return ascenseurs.filter((a: any) => {
      const hasOrdre = a.ordre2 !== null && a.ordre2 !== undefined && a.ordre2 > 0;
      const secteurAccessible = !userSecteurs || userSecteurs.length === 0 || userSecteurs.includes(a.secteur);
      const sousContrat = a.type_planning; // Exclure les hors contrat
      return hasOrdre && secteurAccessible && sousContrat;
    }).length;
  }, [ascenseurs, userSecteurs]);
  
  const filteredAscenseurs = useMemo(() => {
    if (!ascenseurs) return [];
    
    return ascenseurs.filter((a: any) => {
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
      
      // Filtre contrat
      if (contratFilter === 'contrat' && !a.type_planning) return false;
      if (contratFilter === 'hors_contrat' && a.type_planning) return false;
      
      return true;
    });
  }, [ascenseurs, search, secteurFilter, showArretOnly, contratFilter]);
  
  // Fonction utilitaire pour formater la durée d'arrêt
  const formatDureeArret = (dateAppel: Date) => {
    const jours = differenceInDays(new Date(), dateAppel);
    if (jours === 0) {
      const heures = differenceInHours(new Date(), dateAppel);
      return `${heures}h`;
    }
    return `${jours}j`;
  };
  
  // Fonction pour décoder les entités HTML (peut être string ou number)
  const decodeHtml = (text: string | number | null) => {
    if (!text && text !== 0) return null;
    return String(text)
      .replace(/&#13;/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };
  
  // Fonction pour formater une heure HHMM (peut être string ou number)
  const formatHeureHHMM = (heureVal: string | number | null) => {
    if (!heureVal && heureVal !== 0) return null;
    const h = String(heureVal).padStart(4, '0');
    return `${h.substring(0, 2)}h${h.substring(2, 4)}`;
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
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
            <Button variant="secondary" size="sm" onClick={() => setShowGeocodingModal(true)}>
              <Globe className="w-4 h-4" /> GPS
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSyncModal(true)}>
              <Cloud className="w-4 h-4" /> Sync
            </Button>
          </div>
        </div>
        
        {/* Stats Cards Compacts + Onglets */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats compactes */}
          <div className="flex items-center gap-2">
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardBody className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{ascenseurs?.length || 0}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Total</p>
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <ArretsWidget 
              count={filteredArrets?.length || 0} 
              onClick={() => setMainTab('arrets')}
            />
            
            <Card 
              className={`cursor-pointer transition-all ${contratFilter === 'contrat' ? 'border-green-500 bg-green-500/15' : 'bg-green-500/5'}`}
              onClick={() => {
                setMainTab('parc');
                setContratFilter(contratFilter === 'contrat' ? 'all' : 'contrat');
              }}
            >
              <CardBody className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-500">{contratStats.sousContrat}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Contrat</p>
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all ${contratFilter === 'hors_contrat' ? 'border-gray-500 bg-gray-500/15' : 'bg-gray-500/5'}`}
              onClick={() => {
                setMainTab('parc');
                setContratFilter(contratFilter === 'hors_contrat' ? 'all' : 'hors_contrat');
              }}
            >
              <CardBody className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-400">{contratStats.horsContrat}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">HC</p>
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card 
              className="cursor-pointer hover:bg-orange-500/15 transition-all"
              onClick={() => setMainTab('pannes')}
            >
              <CardBody className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{pannes30j}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Pannes 30j</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
          
          {/* Séparateur */}
          <div className="h-10 w-px bg-[var(--border-primary)]" />
          
          {/* Onglets principaux */}
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setMainTab('parc')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'parc' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-1" />
              Parc
            </button>
            <button
              onClick={() => setMainTab('arrets')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'arrets' ? 'bg-red-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Arrêts ({filteredArrets?.length || 0})
            </button>
            <button
              onClick={() => setMainTab('pannes')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'pannes' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Wrench className="w-4 h-4 inline mr-1" />
              Pannes
            </button>
            <button
              onClick={() => setMainTab('tournees')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'tournees' ? 'bg-lime-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Route className="w-4 h-4 inline mr-1" />
              Tournées ({ascenseursAvecTourneeCount})
            </button>
            <button
              onClick={() => setMainTab('stats')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'stats' ? 'bg-purple-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Stats
            </button>
            <button
              onClick={() => setMainTab('carte')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'carte' ? 'bg-emerald-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Map className="w-4 h-4 inline mr-1" />
              Carte
            </button>
            <button
              onClick={() => setMainTab('pieces')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainTab === 'pieces' ? 'bg-purple-500 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Package className="w-4 h-4 inline mr-1" />
              Pièces
            </button>
          </div>
        </div>
        
        {/* Filters - seulement pour l'onglet Parc */}
        {mainTab === 'parc' && (
          <div className="flex items-center gap-3 flex-wrap mt-3">
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
            
            <Select value={contratFilter} onChange={e => setContratFilter(e.target.value as any)} className="w-40">
              <option value="all">Tous contrats</option>
              <option value="contrat">Sous contrat</option>
              <option value="hors_contrat">Hors contrat</option>
            </Select>
            
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
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Onglet Parc */}
        {mainTab === 'parc' && (
          <>
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
          </>
        )}
        
        {/* Onglet Arrêts */}
        {mainTab === 'arrets' && (
          <div className="space-y-3">
            {filteredArrets.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p className="text-green-500 font-medium">Aucun ascenseur à l'arrêt</p>
                <p className="text-sm">Tous les appareils sont en fonctionnement</p>
              </div>
            ) : (
              filteredArrets.map((arret: any) => {
                const data = arret.data_warret || {};
                const dateAppel = arret.date_appel ? parseISO(arret.date_appel) : new Date();
                const dureeArret = formatDureeArret(dateAppel);
                const heureAppel = formatHeureHHMM(data.APPEL || arret.heure_appel);
                const motif = data.Libelle || arret.motif;
                const demandeur = data.DEMAND || arret.demandeur;
                const notes = decodeHtml(data.NOTE2);
                
                return (
                  <Card key={arret.id} className="border-red-500/30">
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-bold">{arret.code_appareil}</p>
                            <p className="text-sm text-[var(--text-muted)]">{arret.adresse}, {arret.ville}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {arret.hors_contrat && (
                            <Badge variant="gray">Hors contrat</Badge>
                          )}
                          <Badge variant="red" className="animate-pulse">
                            À l'arrêt depuis {dureeArret}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                          <p className="text-[10px] text-[var(--text-muted)]">Date appel</p>
                          <p className="text-sm font-medium">{format(dateAppel, 'dd/MM/yyyy', { locale: fr })}</p>
                        </div>
                        {heureAppel && (
                          <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)]">Heure</p>
                            <p className="text-sm font-medium">{heureAppel}</p>
                          </div>
                        )}
                        {demandeur && (
                          <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-[10px] text-[var(--text-muted)]">Demandeur</p>
                            <p className="text-sm font-medium truncate">{demandeur}</p>
                          </div>
                        )}
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                          <p className="text-[10px] text-[var(--text-muted)]">Secteur</p>
                          <p className="text-sm font-medium">{arret.secteur}</p>
                        </div>
                      </div>
                      
                      {motif && (
                        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 mb-3">
                          <p className="text-[10px] text-red-400">Motif</p>
                          <p className="text-sm">{motif}</p>
                        </div>
                      )}
                      
                      {notes && (
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                          <p className="text-[10px] text-[var(--text-muted)]">Notes</p>
                          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{notes}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {arret.marque && <Badge variant="gray" className="text-[10px]">{arret.marque}</Badge>}
                        {arret.type_planning && (
                          <Badge variant="blue" className="text-[10px]">{arret.type_planning} - {arret.nb_visites_an || 0} vis/an</Badge>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        )}
        
        {/* Onglet Pannes */}
        {mainTab === 'pannes' && (
          <div className="space-y-3">
            <div className="text-sm text-[var(--text-muted)] mb-4">
              {Math.min(vraisPannes.length, 30)} dernières pannes (filtrées par vos secteurs)
            </div>
            
            {vraisPannes.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune panne enregistrée</p>
              </div>
            ) : (
              vraisPannes.slice(0, 30).map((panne: any) => {
                const data = panne.data_wpanne || {};
                
                // Extraire la date depuis data.DATE (YYYYMMDD) ou date_appel
                let dateAppel: Date | null = null;
                if (data.DATE) {
                  const dateStr = String(data.DATE);
                  if (dateStr.length === 8) {
                    const year = parseInt(dateStr.substring(0, 4));
                    const month = parseInt(dateStr.substring(4, 6)) - 1;
                    const day = parseInt(dateStr.substring(6, 8));
                    dateAppel = new Date(year, month, day);
                  }
                } else if (panne.date_appel) {
                  dateAppel = parseISO(panne.date_appel);
                }
                
                const heureAppel = formatHeureHHMM(data.APPEL);
                const motif = data.Libelle || panne.motif;
                const panneType = data.PANNES;
                const depanneur = data.DEPANNEUR;
                const persBloquees = data.NOMBRE || panne.personnes_bloquees || 0;
                
                return (
                  <Card 
                    key={panne.id} 
                    className="cursor-pointer hover:border-orange-500/50 transition-all"
                    onClick={() => setSelectedPanne(panne)}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            persBloquees > 0 ? 'bg-red-500/20' : 'bg-orange-500/20'
                          }`}>
                            <Wrench className={`w-5 h-5 ${
                              persBloquees > 0 ? 'text-red-500' : 'text-orange-500'
                            }`} />
                          </div>
                          <div>
                            <p className="font-bold">{panne.code_appareil}</p>
                            <p className="text-sm text-[var(--text-muted)]">{panne.adresse}, {panne.ville}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          {persBloquees > 0 && (
                            <Badge variant="red" className="text-[10px] animate-pulse">
                              {persBloquees} bloqué{persBloquees > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {dateAppel && (
                            <p className="text-sm font-medium">{format(dateAppel, 'dd/MM/yyyy', { locale: fr })}</p>
                          )}
                          {heureAppel && (
                            <p className="text-xs text-[var(--text-muted)]">{heureAppel}</p>
                          )}
                        </div>
                      </div>
                      
                      {motif && (
                        <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg mb-2">
                          <p className="text-sm truncate">{motif}</p>
                        </div>
                      )}
                      
                      {panneType && (
                        <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20 mb-2">
                          <p className="text-sm truncate">{panneType}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="gray" className="text-[10px]">Secteur {panne.secteur}</Badge>
                        {depanneur && <Badge variant="blue" className="text-[10px]">{depanneur}</Badge>}
                      </div>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        )}
        
        {/* Onglet Tournées */}
        {mainTab === 'tournees' && (
          <div className="space-y-6">
            {(() => {
              // Grouper les ascenseurs par secteur et trier par ordre2
              const ascenseursBySecteur: Record<number, any[]> = {};
              
              // Filtrer les ascenseurs qui ont un ordre2 défini (font partie d'une tournée)
              // ET qui sont dans les secteurs accessibles par le technicien
              // ET qui sont sous contrat (ont un type_planning)
              const ascenseursAvecTournee = (ascenseurs || []).filter((a: any) => {
                const hasOrdre = a.ordre2 !== null && a.ordre2 !== undefined && a.ordre2 > 0;
                const secteurAccessible = !userSecteurs || userSecteurs.length === 0 || userSecteurs.includes(a.secteur);
                const sousContrat = a.type_planning; // Exclure les hors contrat
                return hasOrdre && secteurAccessible && sousContrat;
              });
              
              console.log(`Tournées: ${ascenseursAvecTournee.length} ascenseurs avec ordre2 sur ${ascenseurs?.length || 0} total`);
              
              ascenseursAvecTournee.forEach((a: any) => {
                const secteur = a.secteur || 0;
                if (!ascenseursBySecteur[secteur]) {
                  ascenseursBySecteur[secteur] = [];
                }
                ascenseursBySecteur[secteur].push(a);
              });
              
              // Trier chaque groupe par ordre2
              Object.keys(ascenseursBySecteur).forEach(secteur => {
                ascenseursBySecteur[Number(secteur)].sort((a: any, b: any) => {
                  return (a.ordre2 || 999) - (b.ordre2 || 999);
                });
              });
              
              // Trier les secteurs numériquement
              const secteursTriees = Object.keys(ascenseursBySecteur)
                .map(Number)
                .sort((a, b) => a - b);
              
              // Fonction d'optimisation avec le service réel
              const optimiserSecteur = async (secteur: number) => {
                const points = ascenseursBySecteur[secteur];
                if (!points || points.length < 2) {
                  toast.error('Il faut au moins 2 points pour optimiser');
                  return;
                }
                
                setIsOptimizing(true);
                
                try {
                  // Convertir en format Location
                  const locations: Location[] = points.map((p: any) => ({
                    id: p.id_wsoucont,
                    code: p.code_appareil,
                    adresse: p.adresse || '',
                    ville: p.ville || '',
                    codePostal: p.code_postal,
                    priorite: p.en_arret ? 1 : 0, // Priorité aux arrêts
                    tempsIntervention: 30 // 30 min par défaut
                  }));
                  
                  // Lancer l'optimisation
                  const result = await optimizeRoute(locations, new Date());
                  
                  setOptimizationResult({
                    secteur,
                    points: points.length,
                    distanceActuelle: result.totalDistance + (result.savings?.distance || 0),
                    distanceOptimisee: result.totalDistance,
                    tempsGagne: result.savings?.duration || 0,
                    totalDuration: result.totalDuration,
                    heureDepart: '08:00',
                    heureArrivee: format(result.estimatedEndTime, 'HH:mm'),
                    optimizedRoute: result
                  });
                  
                  if (result.savings && result.savings.distance > 0) {
                    toast.success(`Itinéraire optimisé ! ${formatDistance(result.savings.distance)} économisés`);
                  } else {
                    toast.success('Itinéraire calculé');
                  }
                } catch (error) {
                  console.error('Erreur optimisation:', error);
                  toast.error('Erreur lors de l\'optimisation');
                } finally {
                  setIsOptimizing(false);
                }
              };
              
              // Ouvrir Google Maps avec itinéraire
              const openItineraire = (secteur: number) => {
                const points = ascenseursBySecteur[secteur];
                if (!points || points.length === 0) return;
                
                const waypoints = points
                  .slice(0, 10)
                  .map((p: any) => encodeURIComponent(`${p.adresse}, ${p.ville}, France`))
                  .join('/');
                
                window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
              };
              
              if (secteursTriees.length === 0) {
                return (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun ascenseur avec tournée définie dans vos secteurs</p>
                    <p className="text-sm mt-2">Les tournées sont définies par le champ "ordre2" dans Progilift</p>
                  </div>
                );
              }
              
              return (
                <>
                  {/* Header avec stats globales */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-gradient-to-br from-lime-500/20 to-lime-600/10 border-lime-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-2xl font-bold text-lime-400">{secteursTriees.length}</p>
                        <p className="text-xs text-[var(--text-muted)]">Secteurs</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-2xl font-bold text-blue-400">{ascenseursAvecTournee.length}</p>
                        <p className="text-xs text-[var(--text-muted)]">Ascenseurs planifiés</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-2xl font-bold text-orange-400">
                          {ascenseursAvecTournee.filter((a: any) => a.en_arret).length}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">En arrêt</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400">
                          {Math.round(ascenseursAvecTournee.length / secteursTriees.length)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">Moy. par secteur</p>
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Résultat optimisation */}
                  {optimizationResult && (
                    <Card className="mb-6 border-lime-500/30 bg-lime-500/5">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold flex items-center gap-2 text-lime-400">
                            <Navigation className="w-5 h-5" />
                            Itinéraire optimisé - Secteur {optimizationResult.secteur}
                          </h4>
                          <button 
                            onClick={() => setOptimizationResult(null)}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-5 gap-4 text-center mb-4">
                          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-2xl font-bold text-[var(--text-primary)]">{optimizationResult.points}</p>
                            <p className="text-xs text-[var(--text-muted)]">Arrêts</p>
                          </div>
                          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-2xl font-bold text-blue-400">
                              {formatDistance(optimizationResult.distanceOptimisee)}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">Distance</p>
                          </div>
                          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-2xl font-bold text-purple-400">
                              {optimizationResult.totalDuration ? formatDuration(optimizationResult.totalDuration) : '-'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">Durée totale</p>
                          </div>
                          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-2xl font-bold text-green-400">
                              {optimizationResult.tempsGagne > 0 ? `-${optimizationResult.tempsGagne} min` : '-'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">Économisé</p>
                          </div>
                          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-2xl font-bold text-orange-400">{optimizationResult.heureArrivee}</p>
                            <p className="text-xs text-[var(--text-muted)]">Fin estimée</p>
                          </div>
                        </div>
                        
                        {/* Ordre optimisé */}
                        {optimizationResult.optimizedRoute && optimizationResult.optimizedRoute.locations.length > 0 && (
                          <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Ordre de passage optimisé :</p>
                            <div className="flex flex-wrap gap-2">
                              {optimizationResult.optimizedRoute.locations.map((loc, idx) => (
                                <div key={loc.id} className="flex items-center gap-1">
                                  <span className="w-5 h-5 rounded-full bg-lime-500/30 text-lime-400 text-xs font-bold flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm">{loc.code}</span>
                                  {idx < optimizationResult.optimizedRoute!.locations.length - 1 && (
                                    <span className="text-[var(--text-muted)] mx-1">→</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => openItineraire(optimizationResult.secteur)}
                          >
                            <Map className="w-4 h-4 mr-1" />
                            Google Maps
                          </Button>
                          {optimizationResult.optimizedRoute && optimizationResult.optimizedRoute.locations[0] && (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => {
                                const url = generateWazeUrl(optimizationResult.optimizedRoute!.locations[0]);
                                window.open(url, '_blank');
                              }}
                            >
                              <Navigation className="w-4 h-4 mr-1" />
                              Waze (1er arrêt)
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  )}
                  
                  {/* Liste des secteurs */}
                  {secteursTriees.map(secteur => {
                    const ascenseursDuSecteur = ascenseursBySecteur[secteur];
                    const nbSousContrat = ascenseursDuSecteur.filter((a: any) => a.type_planning).length;
                    const nbEnArret = ascenseursDuSecteur.filter((a: any) => a.en_arret).length;
                    
                    // Grouper les ascenseurs par ordre2
                    const ascenseursByOrdre2: Record<number, any[]> = {};
                    ascenseursDuSecteur.forEach((asc: any) => {
                      const ordre = asc.ordre2 || 0;
                      if (!ascenseursByOrdre2[ordre]) {
                        ascenseursByOrdre2[ordre] = [];
                      }
                      ascenseursByOrdre2[ordre].push(asc);
                    });
                    
                    // Trier les ordres
                    const ordresTriees = Object.keys(ascenseursByOrdre2)
                      .map(Number)
                      .sort((a, b) => a - b);
                    
                    return (
                      <Card key={secteur} className="overflow-hidden mb-4">
                        <CardBody className="p-0">
                          <div className="p-4 bg-[var(--bg-tertiary)] flex items-center justify-between">
                            <h3 className="text-lg font-semibold flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-lime-500/20 flex items-center justify-center">
                                <Route className="w-5 h-5 text-lime-400" />
                              </div>
                              <div>
                                <span>Secteur {secteur}</span>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="blue" className="text-[10px]">
                                    {ascenseursDuSecteur.length} asc.
                                  </Badge>
                                  <Badge variant="purple" className="text-[10px]">
                                    {ordresTriees.length} tournées
                                  </Badge>
                                  <Badge variant="green" className="text-[10px]">
                                    {nbSousContrat} contrat
                                  </Badge>
                                  {nbEnArret > 0 && (
                                    <Badge variant="red" className="text-[10px] animate-pulse">
                                      {nbEnArret} arrêt
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </h3>
                            <div className="flex gap-2">
                              <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => optimiserSecteur(secteur)}
                                disabled={isOptimizing}
                              >
                                {isOptimizing ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Compass className="w-4 h-4 mr-1" />
                                )}
                                {isOptimizing ? 'Calcul...' : 'Optimiser'}
                              </Button>
                              <Button 
                                variant="primary" 
                                size="sm"
                                onClick={() => openItineraire(secteur)}
                              >
                                <Map className="w-4 h-4 mr-1" />
                                Itinéraire
                              </Button>
                            </div>
                          </div>
                          
                          {/* Volets par ordre2 */}
                          <div className="p-2 space-y-2">
                            {ordresTriees.map(ordre => {
                              const ascenseursOrdre = ascenseursByOrdre2[ordre];
                              const nbArretOrdre = ascenseursOrdre.filter((a: any) => a.en_arret).length;
                              
                              // Compter par catégorie de visites (9, 4, 2)
                              const nb9 = ascenseursOrdre.filter((a: any) => (a.nb_visites_an || 9) >= 6).length;
                              const nb4 = ascenseursOrdre.filter((a: any) => (a.nb_visites_an || 9) >= 3 && (a.nb_visites_an || 9) < 6).length;
                              const nb2 = ascenseursOrdre.filter((a: any) => (a.nb_visites_an || 9) < 3).length;
                              
                              return (
                                <details 
                                  key={ordre} 
                                  className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden group"
                                  open={nbArretOrdre > 0} // Ouvrir par défaut si arrêt
                                >
                                  <summary className="p-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-lime-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lime-400 font-bold text-sm">{ordre}</span>
                                      </div>
                                      <div>
                                        <p className="font-semibold">Tournée {ordre}</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className="text-xs text-[var(--text-muted)]">{ascenseursOrdre.length} asc.</span>
                                          {nb9 > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                              {nb9}×9v
                                            </span>
                                          )}
                                          {nb4 > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                              {nb4}×4v
                                            </span>
                                          )}
                                          {nb2 > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                              {nb2}×2v
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {nbArretOrdre > 0 && (
                                        <Badge variant="red" className="text-[10px] animate-pulse">
                                          {nbArretOrdre} arrêt
                                        </Badge>
                                      )}
                                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                                    </div>
                                  </summary>
                                  
                                  {/* Boutons d'action pour la tournée */}
                                  <div className="px-3 py-2 bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)] flex gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Ouverture carte tournée', { secteur, ordre, ascenseurs: ascenseursOrdre.length });
                                        setTourneeMapModal({ secteur, ordre, ascenseurs: ascenseursOrdre });
                                      }}
                                    >
                                      <Map className="w-4 h-4 mr-1" />
                                      Carte
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTourneePlanningModal({ secteur, ordre, ascenseurs: ascenseursOrdre });
                                      }}
                                    >
                                      <Calendar className="w-4 h-4 mr-1" />
                                      Planning
                                    </Button>
                                  </div>
                                  
                                  <div className="divide-y divide-[var(--border-primary)] border-t border-[var(--border-primary)]">
                                    {ascenseursOrdre.map((asc: any) => (
                                      <div 
                                        key={asc.id}
                                        className="flex items-center gap-3 p-3 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                        onClick={() => setSelectedAscenseur(asc)}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className="font-semibold truncate">{asc.code_appareil}</p>
                                            {asc.en_arret && (
                                              <Badge variant="red" className="text-[10px] animate-pulse">Arrêt</Badge>
                                            )}
                                          </div>
                                          <p className="text-sm text-[var(--text-muted)] truncate">
                                            {asc.adresse}, {asc.ville}
                                          </p>
                                        </div>
                                        
                                        <div className="text-right flex-shrink-0">
                                          {(() => {
                                            const nbVisites = asc.nb_visites_an || 9;
                                            const effectif = nbVisites >= 6 ? 9 : nbVisites >= 3 ? 4 : 2;
                                            const variant = effectif === 9 ? 'purple' : effectif === 4 ? 'blue' : 'yellow';
                                            return (
                                              <Badge variant={variant} className="text-[10px]">
                                                {effectif}v/an
                                              </Badge>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
        
        {/* Onglet Stats */}
        {mainTab === 'stats' && (
          <div className="space-y-6">
            {(() => {
              // Fonction pour obtenir la date de début selon la période
              const getStartDate = (months: number) => {
                const d = new Date();
                d.setMonth(d.getMonth() - months);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
                return d;
              };
              
              const startDate = getStartDate(statsPeriod);
              
              // Fonction pour extraire la date d'une panne
              const getPanneDate = (p: any): Date | null => {
                const data = p.data_wpanne || {};
                if (data.DATE) {
                  const dateStr = String(data.DATE);
                  if (dateStr.length === 8) {
                    return new Date(
                      parseInt(dateStr.substring(0, 4)),
                      parseInt(dateStr.substring(4, 6)) - 1,
                      parseInt(dateStr.substring(6, 8))
                    );
                  }
                }
                if (p.date_appel) return new Date(p.date_appel);
                return null;
              };
              
              // Filtrer les pannes sur la période sélectionnée
              const pannesPeriode = vraisPannes.filter((p: any) => {
                const date = getPanneDate(p);
                return date && date >= startDate;
              });
              
              // Calculs des statistiques
              const totalAscenseurs = ascenseurs?.length || 0;
              const ascenseursEnArret = ascenseurs?.filter((a: any) => a.en_arret).length || 0;
              const tauxDisponibilite = totalAscenseurs > 0 
                ? ((totalAscenseurs - ascenseursEnArret) / totalAscenseurs * 100).toFixed(1)
                : 0;
              
              // Alertes : arrêts > 24h et > 72h
              const now = new Date();
              const arretsDetails = (filteredArrets || []).map((arret: any) => {
                const data = arret.data_warret || {};
                let dateArret: Date | null = null;
                if (data.DATE) {
                  const dateStr = String(data.DATE);
                  if (dateStr.length === 8) {
                    dateArret = new Date(
                      parseInt(dateStr.substring(0, 4)),
                      parseInt(dateStr.substring(4, 6)) - 1,
                      parseInt(dateStr.substring(6, 8))
                    );
                  }
                }
                const heures = dateArret ? Math.floor((now.getTime() - dateArret.getTime()) / (1000 * 60 * 60)) : 0;
                return { ...arret, dateArret, heuresArret: heures };
              });
              
              const arretsCritiques = arretsDetails.filter((a: any) => a.heuresArret > 72);
              const arretsWarning = arretsDetails.filter((a: any) => a.heuresArret > 24 && a.heuresArret <= 72);
              
              // Pannes avec personnes bloquées (sur la période)
              const pannesBloquees = pannesPeriode.filter((p: any) => {
                const data = p.data_wpanne || {};
                return (data.NOMBRE || 0) > 0;
              }).slice(0, 10);
              
              // Total alertes
              const totalAlertes = arretsCritiques.length + arretsWarning.length + pannesBloquees.length;
              
              // Top 10 ascenseurs les plus en panne (sur la période)
              const pannesParAscenseur: Record<string, { count: number; code: string; adresse: string; ville: string; secteur: number }> = {};
              pannesPeriode.forEach((p: any) => {
                const key = p.id_wsoucont;
                if (!key) return;
                if (!pannesParAscenseur[key]) {
                  pannesParAscenseur[key] = { 
                    count: 0, 
                    code: p.code_appareil || '', 
                    adresse: p.adresse || '',
                    ville: p.ville || '',
                    secteur: p.secteur || 0
                  };
                }
                pannesParAscenseur[key].count++;
              });
              const top10Pannes = Object.entries(pannesParAscenseur)
                .sort(([, a], [, b]) => b.count - a.count)
                .slice(0, 10);
              
              // Évolution des pannes par mois (selon la période)
              const pannesParMois: Record<string, number> = {};
              const moisLabels: string[] = [];
              for (let i = statsPeriod - 1; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = statsPeriod <= 12 
                  ? d.toLocaleDateString('fr-FR', { month: 'short' })
                  : d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
                pannesParMois[key] = 0;
                moisLabels.push(label);
              }
              
              pannesPeriode.forEach((p: any) => {
                const data = p.data_wpanne || {};
                if (data.DATE) {
                  const dateStr = String(data.DATE);
                  if (dateStr.length === 8) {
                    const key = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}`;
                    if (pannesParMois[key] !== undefined) {
                      pannesParMois[key]++;
                    }
                  }
                }
              });
              
              const pannesMoisData = Object.values(pannesParMois);
              const maxPannesMois = Math.max(...pannesMoisData, 1);
              const totalPannesPeriode = pannesMoisData.reduce((a, b) => a + b, 0);
              const moyennePannesMois = (totalPannesPeriode / statsPeriod).toFixed(1);
              
              // Répartition par secteur (sur la période)
              const pannesParSecteur: Record<number, number> = {};
              pannesPeriode.forEach((p: any) => {
                const secteur = p.secteur || 0;
                pannesParSecteur[secteur] = (pannesParSecteur[secteur] || 0) + 1;
              });
              const secteursSorted = Object.entries(pannesParSecteur)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8);
              const maxPannesSecteur = secteursSorted.length > 0 ? secteursSorted[0][1] : 1;
              
              // Fonction export PDF
              const handleExportPDF = () => {
                try {
                  const moisActuel = format(new Date(), 'MMMM yyyy', { locale: fr });
                  
                  const rapportData = {
                    mois: moisActuel,
                    totalAscenseurs,
                    tauxDisponibilite: parseFloat(String(tauxDisponibilite)),
                    pannes30j: totalPannesPeriode,
                    arretsEnCours: ascenseursEnArret,
                    pannesParSecteur: Object.fromEntries(
                      Object.entries(pannesParSecteur).map(([k, v]) => [k, v])
                    ),
                    top10Pannes: top10Pannes.map(([, data]) => data),
                    arretsLongs: [...arretsCritiques, ...arretsWarning].map((a: any) => ({
                      code: a.code_appareil || '',
                      ville: a.ville || '',
                      heures: a.heuresArret
                    })),
                    pannesBloquees: pannesBloquees.map((p: any) => {
                      const data = p.data_wpanne || {};
                      let dateStr = '';
                      if (data.DATE) {
                        const ds = String(data.DATE);
                        if (ds.length === 8) {
                          dateStr = `${ds.substring(6, 8)}/${ds.substring(4, 6)}/${ds.substring(0, 4)}`;
                        }
                      }
                      return {
                        code: p.code_appareil || '',
                        ville: p.ville || '',
                        personnes: data.NOMBRE || 0,
                        date: dateStr
                      };
                    })
                  };
                  
                  generateRapportMensuel(rapportData);
                  toast.success('Rapport PDF généré avec succès');
                } catch (error) {
                  console.error('Erreur génération PDF:', error);
                  toast.error('Erreur lors de la génération du PDF');
                }
              };
              
              return (
                <>
                  {/* Header avec filtre période et export */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold">Statistiques du parc</h2>
                      <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                        {[
                          { value: 6, label: '6 mois' },
                          { value: 12, label: '1 an' },
                          { value: 24, label: '2 ans' },
                          { value: 36, label: '3 ans' },
                        ].map(p => (
                          <button
                            key={p.value}
                            onClick={() => setStatsPeriod(p.value as any)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                              statsPeriod === p.value 
                                ? 'bg-purple-500 text-white' 
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button variant="secondary" onClick={handleExportPDF}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                  
                  {/* KPIs principaux */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-blue-400">{totalAscenseurs}</p>
                        <p className="text-sm text-[var(--text-muted)]">Ascenseurs</p>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-400">{tauxDisponibilite}%</p>
                        <p className="text-sm text-[var(--text-muted)]">Disponibilité</p>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-purple-400">{totalPannesPeriode}</p>
                        <p className="text-sm text-[var(--text-muted)]">Pannes ({statsPeriod}m)</p>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-orange-400">{moyennePannesMois}</p>
                        <p className="text-sm text-[var(--text-muted)]">Moy/mois</p>
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-400">{ascenseursEnArret}</p>
                        <p className="text-sm text-[var(--text-muted)]">En arrêt</p>
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Alertes et Notifications regroupées */}
                  {totalAlertes > 0 && (
                    <Card className="border-red-500/30">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Alertes & Notifications
                            <Badge variant="red" className="ml-2">{totalAlertes}</Badge>
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Arrêts critiques > 72h */}
                          <div className={`p-4 rounded-lg ${arretsCritiques.length > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--bg-tertiary)]'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-3 h-3 rounded-full ${arretsCritiques.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                              <span className={`font-semibold text-sm ${arretsCritiques.length > 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                                Arrêts critiques (&gt;72h)
                              </span>
                              <Badge variant={arretsCritiques.length > 0 ? 'red' : 'gray'} className="ml-auto">
                                {arretsCritiques.length}
                              </Badge>
                            </div>
                            {arretsCritiques.length > 0 ? (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {arretsCritiques.slice(0, 5).map((arret: any) => (
                                  <div key={arret.id} className="flex items-center justify-between text-xs">
                                    <span className="truncate flex-1">{arret.code_appareil}</span>
                                    <Badge variant="red" className="text-[10px] ml-2">{Math.floor(arret.heuresArret / 24)}j</Badge>
                                  </div>
                                ))}
                                {arretsCritiques.length > 5 && (
                                  <p className="text-[10px] text-[var(--text-muted)]">+ {arretsCritiques.length - 5} autres</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-muted)]">Aucun arrêt critique</p>
                            )}
                          </div>
                          
                          {/* Arrêts warning > 24h */}
                          <div className={`p-4 rounded-lg ${arretsWarning.length > 0 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-[var(--bg-tertiary)]'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-3 h-3 rounded-full ${arretsWarning.length > 0 ? 'bg-orange-500' : 'bg-gray-500'}`}></div>
                              <span className={`font-semibold text-sm ${arretsWarning.length > 0 ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
                                Arrêts &gt;24h
                              </span>
                              <Badge variant={arretsWarning.length > 0 ? 'orange' : 'gray'} className="ml-auto">
                                {arretsWarning.length}
                              </Badge>
                            </div>
                            {arretsWarning.length > 0 ? (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {arretsWarning.slice(0, 5).map((arret: any) => (
                                  <div key={arret.id} className="flex items-center justify-between text-xs">
                                    <span className="truncate flex-1">{arret.code_appareil}</span>
                                    <Badge variant="orange" className="text-[10px] ml-2">{arret.heuresArret}h</Badge>
                                  </div>
                                ))}
                                {arretsWarning.length > 5 && (
                                  <p className="text-[10px] text-[var(--text-muted)]">+ {arretsWarning.length - 5} autres</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-muted)]">Aucun arrêt &gt;24h</p>
                            )}
                          </div>
                          
                          {/* Pannes avec personnes bloquées */}
                          <div className={`p-4 rounded-lg ${pannesBloquees.length > 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--bg-tertiary)]'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-3 h-3 rounded-full ${pannesBloquees.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                              <span className={`font-semibold text-sm ${pannesBloquees.length > 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                                Pers. bloquées
                              </span>
                              <Badge variant={pannesBloquees.length > 0 ? 'red' : 'gray'} className="ml-auto">
                                {pannesBloquees.length}
                              </Badge>
                            </div>
                            {pannesBloquees.length > 0 ? (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {pannesBloquees.slice(0, 5).map((panne: any) => {
                                  const data = panne.data_wpanne || {};
                                  return (
                                    <div key={panne.id} className="flex items-center justify-between text-xs">
                                      <span className="truncate flex-1">{panne.code_appareil}</span>
                                      <Badge variant="red" className="text-[10px] ml-2 animate-pulse">
                                        {data.NOMBRE} bloqué{data.NOMBRE > 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-muted)]">Aucune sur la période</p>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                  
                  {/* Graphiques */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Évolution des pannes par mois */}
                    <Card>
                      <CardBody className="p-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-purple-500" />
                          Évolution des pannes ({statsPeriod} mois)
                        </h3>
                        <div className="flex items-end gap-1 h-40 overflow-x-auto">
                          {pannesMoisData.map((count, index) => (
                            <div key={index} className="flex flex-col items-center gap-1" style={{ minWidth: statsPeriod > 12 ? '24px' : '40px', flex: 1 }}>
                              <span className="text-[10px] font-semibold">{count}</span>
                              <div 
                                className="w-full bg-purple-500 rounded-t transition-all"
                                style={{ height: `${(count / maxPannesMois) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                              ></div>
                              <span className="text-[9px] text-[var(--text-muted)] whitespace-nowrap">{moisLabels[index]}</span>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                    
                    {/* Répartition par secteur */}
                    <Card>
                      <CardBody className="p-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-500" />
                          Pannes par secteur ({statsPeriod}m)
                        </h3>
                        <div className="space-y-2">
                          {secteursSorted.map(([secteur, count]) => (
                            <div key={secteur} className="flex items-center gap-3">
                              <span className="text-sm w-20">Secteur {secteur}</span>
                              <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-4 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                                  style={{ width: `${(count / maxPannesSecteur) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold w-8 text-right">{count}</span>
                            </div>
                          ))}
                          {secteursSorted.length === 0 && (
                            <p className="text-[var(--text-muted)] text-center py-4">Aucune panne sur la période</p>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Top 10 ascenseurs les plus en panne */}
                  <Card>
                    <CardBody className="p-4">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        Top 10 - Ascenseurs les plus en panne ({statsPeriod} mois)
                      </h3>
                      {top10Pannes.length === 0 ? (
                        <p className="text-[var(--text-muted)] text-center py-4">Aucune panne enregistrée</p>
                      ) : (
                        <div className="space-y-2">
                          {top10Pannes.map(([id, data], index) => (
                            <div 
                              key={id} 
                              className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors"
                              onClick={() => {
                                const asc = ascenseurs?.find((a: any) => a.id_wsoucont === Number(id));
                                if (asc) setSelectedAscenseur(asc);
                              }}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                index < 3 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{data.code}</p>
                                <p className="text-sm text-[var(--text-muted)] truncate">{data.adresse}, {data.ville}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant={index < 3 ? 'red' : 'orange'}>
                                  {data.count} panne{data.count > 1 ? 's' : ''}
                                </Badge>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Secteur {data.secteur}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </>
              );
            })()}
          </div>
        )}
        
        {/* Onglet Carte */}
        {mainTab === 'carte' && (
          <div className="space-y-4">
            {(() => {
              // Grouper les ascenseurs par ville
              const ascenseursParVille: Record<string, any[]> = {};
              
              (ascenseurs || []).forEach((a: any) => {
                const ville = a.ville || 'Non défini';
                if (!ascenseursParVille[ville]) {
                  ascenseursParVille[ville] = [];
                }
                ascenseursParVille[ville].push(a);
              });
              
              // Trier par nombre d'ascenseurs décroissant
              const villesSorted = Object.entries(ascenseursParVille)
                .sort(([, a], [, b]) => b.length - a.length);
              
              // Fonction pour ouvrir Google Maps
              const openGoogleMaps = (adresse: string, ville: string) => {
                const query = encodeURIComponent(`${adresse}, ${ville}, France`);
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
              };
              
              // Fonction pour ouvrir itinéraire tournée
              const openItineraire = (ascenseursListe: any[]) => {
                if (ascenseursListe.length === 0) return;
                
                // Créer l'URL Google Maps avec waypoints
                const waypoints = ascenseursListe
                  .slice(0, 10) // Limite Google Maps
                  .map(a => encodeURIComponent(`${a.adresse}, ${a.ville}, France`))
                  .join('/');
                
                window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
              };
              
              const totalVilles = villesSorted.length;
              const totalAscenseurs = ascenseurs?.length || 0;
              const ascenseursEnArret = ascenseurs?.filter((a: any) => a.en_arret) || [];
              
              return (
                <>
                  {/* Stats rapides */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-emerald-400">{totalVilles}</p>
                        <p className="text-sm text-[var(--text-muted)]">Villes</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-blue-400">{totalAscenseurs}</p>
                        <p className="text-sm text-[var(--text-muted)]">Ascenseurs</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
                      <CardBody className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-400">{ascenseursEnArret.length}</p>
                        <p className="text-sm text-[var(--text-muted)]">En arrêt</p>
                      </CardBody>
                    </Card>
                  </div>
                  
                  {/* Liste par ville avec carte */}
                  <div className="space-y-4">
                    {villesSorted.map(([ville, ascenseursVille]) => {
                      const enArret = ascenseursVille.filter((a: any) => a.en_arret);
                      const triParOrdre = [...ascenseursVille].sort((a, b) => (a.ordre2 || 999) - (b.ordre2 || 999));
                      
                      return (
                        <Card key={ville} className="overflow-hidden">
                          <CardBody className="p-0">
                            {/* Header ville */}
                            <div className="p-4 bg-[var(--bg-tertiary)] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                  <MapPin className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                  <h3 className="font-bold">{ville}</h3>
                                  <p className="text-sm text-[var(--text-muted)]">
                                    {ascenseursVille.length} ascenseur{ascenseursVille.length > 1 ? 's' : ''}
                                    {enArret.length > 0 && (
                                      <span className="text-red-400 ml-2">• {enArret.length} en arrêt</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openGoogleMaps('', ville)}
                                >
                                  <Map className="w-4 h-4 mr-1" />
                                  Voir sur carte
                                </Button>
                                {ascenseursVille.length > 1 && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => openItineraire(triParOrdre)}
                                  >
                                    <Route className="w-4 h-4 mr-1" />
                                    Itinéraire
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {/* Liste des ascenseurs */}
                            <div className="divide-y divide-[var(--border-primary)]">
                              {triParOrdre.slice(0, 5).map((asc: any) => (
                                <div 
                                  key={asc.id}
                                  className="p-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                  onClick={() => setSelectedAscenseur(asc)}
                                >
                                  {asc.ordre2 > 0 && (
                                    <div className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center flex-shrink-0">
                                      <span className="text-lime-400 text-xs font-bold">{asc.ordre2}</span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{asc.code_appareil}</span>
                                      {asc.en_arret && (
                                        <Badge variant="red" className="text-[10px] animate-pulse">Arrêt</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] truncate">{asc.adresse}</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openGoogleMaps(asc.adresse, asc.ville);
                                    }}
                                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg"
                                    title="Ouvrir dans Google Maps"
                                  >
                                    <MapPin className="w-4 h-4 text-emerald-400" />
                                  </button>
                                </div>
                              ))}
                              {ascenseursVille.length > 5 && (
                                <div className="p-2 text-center text-sm text-[var(--text-muted)]">
                                  + {ascenseursVille.length - 5} autres ascenseurs
                                </div>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* Modal carte de la tournée */}
      {tourneeMapModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setTourneeMapModal(null)}>
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Map className="w-5 h-5 text-lime-400" />
                Carte - Secteur {tourneeMapModal.secteur} / Tournée {tourneeMapModal.ordre}
              </h2>
              <button onClick={() => setTourneeMapModal(null)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {(() => {
                // Filtrer les ascenseurs avec coordonnées GPS
                const ascenseursAvecGPS = tourneeMapModal.ascenseurs.filter(
                  (a: any) => a.latitude && a.longitude
                );
                const ascenseursSansGPS = tourneeMapModal.ascenseurs.filter(
                  (a: any) => !a.latitude || !a.longitude
                );
                
                // Calculer le centre de la carte
                let centerLat = 45.7833; // Clermont-Ferrand par défaut
                let centerLng = 3.0833;
                let zoom = 12;
                
                if (ascenseursAvecGPS.length > 0) {
                  const lats = ascenseursAvecGPS.map((a: any) => a.latitude);
                  const lngs = ascenseursAvecGPS.map((a: any) => a.longitude);
                  centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                  centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                  
                  // Ajuster le zoom selon l'étendue
                  const latDiff = Math.max(...lats) - Math.min(...lats);
                  const lngDiff = Math.max(...lngs) - Math.min(...lngs);
                  const maxDiff = Math.max(latDiff, lngDiff);
                  if (maxDiff > 0.5) zoom = 10;
                  else if (maxDiff > 0.2) zoom = 11;
                  else if (maxDiff > 0.1) zoom = 12;
                  else if (maxDiff > 0.05) zoom = 13;
                  else zoom = 14;
                }
                
                return (
                  <div className="space-y-4">
                    {/* Stats rapides */}
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        {ascenseursAvecGPS.length} avec GPS
                      </span>
                      {ascenseursSansGPS.length > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                          {ascenseursSansGPS.length} sans GPS
                        </span>
                      )}
                    </div>
                    
                    {/* Carte */}
                    {ascenseursAvecGPS.length > 0 ? (
                      <div 
                        id="tournee-map-container"
                        className="h-[400px] rounded-lg overflow-hidden border border-[var(--border-primary)]"
                        ref={(el) => {
                          if (el && !el.hasAttribute('data-map-initialized')) {
                            el.setAttribute('data-map-initialized', 'true');
                            
                            // Charger Leaflet CSS
                            if (!document.getElementById('leaflet-css')) {
                              const link = document.createElement('link');
                              link.id = 'leaflet-css';
                              link.rel = 'stylesheet';
                              link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                              document.head.appendChild(link);
                            }
                            
                            // Charger Leaflet JS et initialiser la carte
                            const initMap = () => {
                              const L = (window as any).L;
                              if (!L) return;
                              
                              // Créer la carte
                              const map = L.map(el).setView([centerLat, centerLng], zoom);
                              
                              // Ajouter les tuiles OpenStreetMap
                              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                attribution: '© OpenStreetMap'
                              }).addTo(map);
                              
                              // Ajouter les marqueurs
                              const markers: any[] = [];
                              ascenseursAvecGPS.forEach((asc: any, idx: number) => {
                                const marker = L.marker([asc.latitude, asc.longitude])
                                  .addTo(map)
                                  .bindPopup(`
                                    <div style="min-width: 150px">
                                      <strong>${idx + 1}. ${asc.code_appareil}</strong><br/>
                                      <span style="font-size: 12px; color: #666">${asc.adresse}<br/>${asc.ville}</span>
                                    </div>
                                  `);
                                markers.push(marker);
                              });
                              
                              // Tracer la ligne de l'itinéraire
                              if (ascenseursAvecGPS.length > 1) {
                                const latlngs = ascenseursAvecGPS.map((a: any) => [a.latitude, a.longitude]);
                                L.polyline(latlngs, { color: '#84cc16', weight: 3, opacity: 0.7 }).addTo(map);
                              }
                              
                              // Ajuster la vue pour montrer tous les marqueurs
                              if (markers.length > 1) {
                                const group = L.featureGroup(markers);
                                map.fitBounds(group.getBounds().pad(0.1));
                              }
                            };
                            
                            // Charger Leaflet JS si nécessaire
                            if (!(window as any).L) {
                              const script = document.createElement('script');
                              script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                              script.onload = () => setTimeout(initMap, 100);
                              document.head.appendChild(script);
                            } else {
                              setTimeout(initMap, 100);
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="h-[300px] rounded-lg bg-[var(--bg-secondary)] flex flex-col items-center justify-center text-[var(--text-muted)]">
                        <Map className="w-12 h-12 mb-2 opacity-50" />
                        <p>Aucune coordonnée GPS disponible</p>
                        <p className="text-sm mt-1">Lancez le géocodage pour obtenir les positions</p>
                      </div>
                    )}
                    
                    {/* Liste des ascenseurs */}
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {tourneeMapModal.ascenseurs.map((asc: any, idx: number) => (
                        <div key={asc.id} className="p-2 bg-[var(--bg-secondary)] rounded-lg flex items-center gap-2 text-sm">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            asc.latitude && asc.longitude 
                              ? 'bg-lime-500/20 text-lime-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{asc.code_appareil}</span>
                            <span className="text-[var(--text-muted)] ml-2 truncate">{asc.adresse}, {asc.ville}</span>
                          </div>
                          {asc.en_arret && <Badge variant="red" className="text-[10px]">Arrêt</Badge>}
                        </div>
                      ))}
                    </div>
                    
                    {/* Boutons d'action */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={() => {
                          // Utiliser les coordonnées GPS si disponibles
                          const points = tourneeMapModal.ascenseurs.map((a: any) => {
                            if (a.latitude && a.longitude) {
                              return `${a.latitude},${a.longitude}`;
                            }
                            return encodeURIComponent(`${a.adresse}, ${a.ville}, France`);
                          });
                          const url = `https://www.google.com/maps/dir/${points.join('/')}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <Map className="w-4 h-4 mr-2" />
                        Google Maps
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const first = tourneeMapModal.ascenseurs[0];
                          if (first) {
                            if (first.latitude && first.longitude) {
                              window.open(`https://waze.com/ul?ll=${first.latitude},${first.longitude}&navigate=yes`, '_blank');
                            } else {
                              window.open(`https://waze.com/ul?q=${encodeURIComponent(first.adresse + ', ' + first.ville)}&navigate=yes`, '_blank');
                            }
                          }
                        }}
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Waze
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal planning de la tournée */}
      {tourneePlanningModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setTourneePlanningModal(null)}>
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Planning - Secteur {tourneePlanningModal.secteur} / Tournée {tourneePlanningModal.ordre}
              </h2>
              <button onClick={() => setTourneePlanningModal(null)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {(() => {
                // La tournée est effectuée toutes les 6 semaines = 9 passages/an
                const CYCLE_WEEKS = 6;
                const NB_PASSAGES = 9;
                
                // La semaine de départ dans le cycle dépend du numéro de tournée (ordre2)
                const semaineDepart = ((tourneePlanningModal.ordre - 1) % CYCLE_WEEKS) + 1;
                
                // Calculer les 9 semaines de passage de la tournée
                const semainesPassage: number[] = [];
                for (let i = 0; i < NB_PASSAGES; i++) {
                  semainesPassage.push(semaineDepart + (i * CYCLE_WEEKS));
                }
                
                // Obtenir le numéro de semaine actuel
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const currentWeek = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
                
                // ========== REGROUPEMENT PAR SITE ==========
                // Clé de site = adresse normalisée + ville (ou code_client si disponible)
                const getSiteKey = (asc: any): string => {
                  // Priorité au code_client s'il existe
                  if (asc.code_client) {
                    return `client_${asc.code_client}`;
                  }
                  // Sinon, utiliser adresse + ville normalisées
                  const adresse = (asc.adresse || '').toLowerCase().trim().replace(/\s+/g, ' ');
                  const ville = (asc.ville || '').toLowerCase().trim();
                  return `${adresse}_${ville}`;
                };
                
                // Regrouper les ascenseurs par site
                const siteMap: Record<string, any[]> = {};
                tourneePlanningModal.ascenseurs.forEach((asc: any) => {
                  const key = getSiteKey(asc);
                  if (!siteMap[key]) siteMap[key] = [];
                  siteMap[key].push(asc);
                });
                
                // Convertir en tableau de sites
                const sites = Object.entries(siteMap).map(([key, ascenseurs]) => {
                  // La fréquence du site = fréquence MAX des ascenseurs (pour ne pas manquer de visites)
                  const maxVisites = Math.max(...ascenseurs.map((a: any) => a.nb_visites_an || 9));
                  const frequence = maxVisites >= 6 ? 9 : maxVisites >= 3 ? 4 : 2;
                  
                  return {
                    key,
                    ascenseurs,
                    adresse: ascenseurs[0].adresse,
                    ville: ascenseurs[0].ville,
                    codeClient: ascenseurs[0].code_client,
                    nbAscenseurs: ascenseurs.length,
                    frequence,
                    maxVisites
                  };
                });
                
                // Trier les sites par fréquence décroissante puis par nombre d'ascenseurs
                sites.sort((a, b) => b.frequence - a.frequence || b.nbAscenseurs - a.nbAscenseurs);
                
                // ========== CALCUL DES SEMAINES DE VISITE PAR SITE ==========
                // Fonction pour calculer les semaines selon la fréquence
                const getSemainesVisite = (frequence: number, offset: number = 0): number[] => {
                  if (frequence === 9) {
                    return [...semainesPassage];
                  } else if (frequence === 4) {
                    // 4 visites réparties : passages 1, 3, 5, 7 (décalés selon offset)
                    const indices = [0, 2, 4, 7].map(i => (i + offset) % NB_PASSAGES);
                    return indices.map(i => semainesPassage[i]).sort((a, b) => a - b);
                  } else {
                    // 2 visites : passages 1, 5 (décalés selon offset)
                    const indices = [0, 4].map(i => (i + offset) % NB_PASSAGES);
                    return indices.map(i => semainesPassage[i]).sort((a, b) => a - b);
                  }
                };
                
                // Compteurs pour répartir équitablement les sites 4 et 2 visites
                let offset4 = 0;
                let offset2 = 0;
                
                // Calculer les semaines pour chaque site
                const sitesAvecPlanning = sites.map(site => {
                  let semaines: number[];
                  if (site.frequence === 9) {
                    semaines = getSemainesVisite(9);
                  } else if (site.frequence === 4) {
                    semaines = getSemainesVisite(4, offset4);
                    offset4++;
                  } else {
                    semaines = getSemainesVisite(2, offset2);
                    offset2++;
                  }
                  
                  return {
                    ...site,
                    semaines,
                    // Marquer chaque ascenseur du site avec les mêmes semaines
                    ascenseurs: site.ascenseurs.map((asc: any) => ({
                      ...asc,
                      semaines,
                      frequenceEffective: site.frequence
                    }))
                  };
                });
                
                // Calculer les visites par passage (compte les ascenseurs, pas les sites)
                const visitesParPassage: Record<number, { sites: any[], ascenseurs: any[] }> = {};
                semainesPassage.forEach(s => { visitesParPassage[s] = { sites: [], ascenseurs: [] }; });
                
                sitesAvecPlanning.forEach(site => {
                  site.semaines.forEach((s: number) => {
                    if (visitesParPassage[s]) {
                      visitesParPassage[s].sites.push(site);
                      visitesParPassage[s].ascenseurs.push(...site.ascenseurs);
                    }
                  });
                });
                
                // Statistiques
                const nbSites = sites.length;
                const nbAscenseurs = tourneePlanningModal.ascenseurs.length;
                const sites9 = sites.filter(s => s.frequence === 9);
                const sites4 = sites.filter(s => s.frequence === 4);
                const sites2 = sites.filter(s => s.frequence === 2);
                const totalVisitesAn = sitesAvecPlanning.reduce((sum, s) => sum + s.ascenseurs.length * s.frequence, 0);
                
                // Prochain passage
                const prochainPassage = semainesPassage.find(s => s >= currentWeek) || semainesPassage[0];
                
                return (
                  <div className="space-y-6">
                    {/* Info principale */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-blue-400">
                            Tournée toutes les {CYCLE_WEEKS} semaines
                          </p>
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            <strong>{nbSites} sites</strong> • {nbAscenseurs} ascenseurs • {totalVisitesAn} visites/an
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[var(--text-muted)]">Semaine actuelle</p>
                          <p className="text-2xl font-bold">S{currentWeek}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Répartition par fréquence de visite */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card className={`border-2 ${sites9.length > 0 ? 'border-purple-500/50 bg-purple-500/10' : 'border-[var(--border-primary)]'}`}>
                        <CardBody className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-purple-400">{sites9.length}</p>
                              <p className="text-xs text-[var(--text-muted)]">sites ({sites9.reduce((s, x) => s + x.nbAscenseurs, 0)} asc.)</p>
                            </div>
                            <Badge variant="purple" className="text-sm">9 vis/an</Badge>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">Tous les passages</p>
                        </CardBody>
                      </Card>
                      <Card className={`border-2 ${sites4.length > 0 ? 'border-blue-500/50 bg-blue-500/10' : 'border-[var(--border-primary)]'}`}>
                        <CardBody className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-blue-400">{sites4.length}</p>
                              <p className="text-xs text-[var(--text-muted)]">sites ({sites4.reduce((s, x) => s + x.nbAscenseurs, 0)} asc.)</p>
                            </div>
                            <Badge variant="blue" className="text-sm">4 vis/an</Badge>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">1 passage sur 2</p>
                        </CardBody>
                      </Card>
                      <Card className={`border-2 ${sites2.length > 0 ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-[var(--border-primary)]'}`}>
                        <CardBody className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-bold text-yellow-400">{sites2.length}</p>
                              <p className="text-xs text-[var(--text-muted)]">sites ({sites2.reduce((s, x) => s + x.nbAscenseurs, 0)} asc.)</p>
                            </div>
                            <Badge variant="yellow" className="text-sm">2 vis/an</Badge>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1">1 passage sur 4</p>
                        </CardBody>
                      </Card>
                    </div>
                    
                    {/* Calendrier des 9 passages */}
                    <Card>
                      <CardBody className="p-4">
                        <h3 className="font-semibold mb-3">Calendrier des {NB_PASSAGES} passages</h3>
                        <div className="grid grid-cols-9 gap-2">
                          {semainesPassage.map((semaine, index) => {
                            const isPast = semaine < currentWeek;
                            const isCurrent = semaine === currentWeek;
                            const isNext = semaine === prochainPassage && !isCurrent;
                            const data = visitesParPassage[semaine];
                            const nbSitesPassage = data?.sites.length || 0;
                            const nbAscPassage = data?.ascenseurs.length || 0;
                            
                            return (
                              <div 
                                key={index}
                                className={`p-2 rounded-lg text-center ${
                                  isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-300' :
                                  isNext ? 'bg-orange-500/20 border-2 border-orange-500' :
                                  isPast ? 'bg-green-500/20' :
                                  'bg-[var(--bg-tertiary)]'
                                }`}
                              >
                                <p className="text-lg font-bold">S{semaine}</p>
                                <p className={`text-xl font-bold ${
                                  isCurrent ? 'text-white' :
                                  isPast ? 'text-green-400' :
                                  isNext ? 'text-orange-400' : ''
                                }`}>
                                  {nbAscPassage}
                                </p>
                                <p className="text-[10px] opacity-70">{nbSitesPassage} site{nbSitesPassage > 1 ? 's' : ''}</p>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Légende */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-green-500/30"></span> Effectué
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-blue-500"></span> Cette semaine
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded border-2 border-orange-500"></span> Prochain
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                    
                    {/* Détail par site */}
                    <Card>
                      <CardBody className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                          Planning par site ({nbSites} sites)
                        </h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {sitesAvecPlanning.map((site, siteIndex) => {
                            const badgeVariant = site.frequence === 9 ? 'purple' : site.frequence === 4 ? 'blue' : 'yellow';
                            
                            return (
                              <div 
                                key={site.key}
                                className="p-3 bg-[var(--bg-secondary)] rounded-lg"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {siteIndex + 1}
                                      </span>
                                      <p className="font-medium truncate">{site.adresse}</p>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] ml-8">{site.ville}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant={badgeVariant}>{site.frequence}v/an</Badge>
                                    <span className="text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                                      {site.nbAscenseurs} asc.
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Ascenseurs du site */}
                                <div className="ml-8 flex flex-wrap gap-1 mb-2">
                                  {site.ascenseurs.map((asc: any) => (
                                    <span 
                                      key={asc.id}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        asc.en_arret ? 'bg-red-500/20 text-red-400' : 'bg-[var(--bg-tertiary)]'
                                      }`}
                                    >
                                      {asc.code_appareil}
                                      {asc.en_arret && ' ⚠️'}
                                    </span>
                                  ))}
                                </div>
                                
                                {/* Semaines de visite */}
                                <div className="ml-8 flex flex-wrap gap-1">
                                  {site.semaines.map((s: number, i: number) => {
                                    const isPast = s < currentWeek;
                                    const isCurrent = s === currentWeek;
                                    return (
                                      <span 
                                        key={i} 
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          isCurrent ? 'bg-blue-500 text-white' :
                                          isPast ? 'bg-green-500/20 text-green-400' :
                                          'bg-[var(--bg-tertiary)]'
                                        }`}
                                      >
                                        S{s}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Pièces remplacées */}
      {mainTab === 'pieces' && (
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-purple-400" />
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Pièces remplacées</h2>
                  <p className="text-sm text-[var(--text-muted)]">Historique des remplacements sur tous les appareils</p>
                </div>
              </div>
              <PiecesRemplaceesParc secteurs={[1, 2, 3, 4, 5, 6, 7, 8]} />
            </CardBody>
          </Card>
        </div>
      )}
      
      {/* Modal détail ascenseur */}
      {selectedAscenseur && (
        <AscenseurDetailModal
          ascenseur={selectedAscenseur}
          onClose={() => setSelectedAscenseur(null)}
        />
      )}
      
      {/* Modal détail panne */}
      {selectedPanne && (
        <PanneDetailModal
          panne={selectedPanne}
          onClose={() => setSelectedPanne(null)}
        />
      )}
      
      {/* Modal synchronisation */}
      {showSyncModal && (
        <SyncModal onClose={() => setShowSyncModal(false)} />
      )}
      
      {/* Modal géocodage GPS */}
      {showGeocodingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => !geocodingProgress.isRunning && setShowGeocodingModal(false)}>
          <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                Géocodage GPS
              </h2>
              {!geocodingProgress.isRunning && (
                <button onClick={() => setShowGeocodingModal(false)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {!geocodingProgress.isRunning && geocodingProgress.total === 0 ? (
                <>
                  {/* État initial */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-[var(--text-secondary)] mb-2">
                      Récupérer les coordonnées GPS des ascenseurs.
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Utilise l'API Adresse + Nominatim (OpenStreetMap) en fallback.
                    </p>
                  </div>
                  
                  {/* Stats actuelles */}
                  {(() => {
                    const sansGPS = (ascenseurs || []).filter((a: any) => !a.latitude || !a.longitude).length;
                    const avecGPS = (ascenseurs || []).filter((a: any) => a.latitude && a.longitude).length;
                    const total = (ascenseurs || []).length;
                    
                    return (
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-400">{total}</p>
                          <p className="text-xs text-[var(--text-muted)]">Total</p>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-400">{avecGPS}</p>
                          <p className="text-xs text-[var(--text-muted)]">Avec GPS</p>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
                          <p className="text-2xl font-bold text-orange-400">{sansGPS}</p>
                          <p className="text-xs text-[var(--text-muted)]">Sans GPS</p>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Stratégies utilisées */}
                  <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                    <p className="font-semibold text-blue-400 mb-2">Stratégies de géocodage :</p>
                    <ol className="list-decimal list-inside text-[var(--text-muted)] space-y-1 text-xs">
                      <li>Adresse complète + ville + code postal</li>
                      <li>Numéro + rue + ville</li>
                      <li>Rue + ville (sans numéro)</li>
                      <li>Nom du bâtiment + ville</li>
                      <li>Ville seule (approximatif)</li>
                      <li>Nominatim (OpenStreetMap) en fallback</li>
                    </ol>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => runGeocoding(false)}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Géocoder les manquants
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => runGeocoding(true)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Forcer tout
                    </Button>
                  </div>
                </>
              ) : geocodingProgress.isRunning ? (
                <>
                  {/* En cours */}
                  <div className="text-center mb-4">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-spin" />
                    <p className="font-semibold">Géocodage en cours...</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {geocodingProgress.current} / {geocodingProgress.total}
                    </p>
                  </div>
                  
                  {/* Barre de progression */}
                  <div className="mb-4">
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                        style={{ width: `${geocodingProgress.total > 0 ? (geocodingProgress.current / geocodingProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Stats en temps réel */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-green-500/10 rounded-lg text-center border border-green-500/20">
                      <p className="text-2xl font-bold text-green-400">{geocodingProgress.success}</p>
                      <p className="text-xs text-[var(--text-muted)]">Succès</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-lg text-center border border-red-500/20">
                      <p className="text-2xl font-bold text-red-400">{geocodingProgress.failed}</p>
                      <p className="text-xs text-[var(--text-muted)]">Échecs</p>
                    </div>
                  </div>
                  
                  {/* Dernier traité */}
                  {geocodingProgress.lastCode && (
                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                      geocodingProgress.lastSuccess ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {geocodingProgress.lastSuccess ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="truncate">{geocodingProgress.lastCode}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Terminé */}
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="font-semibold text-lg">Géocodage terminé !</p>
                  </div>
                  
                  {/* Résultats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-4 bg-green-500/10 rounded-lg text-center border border-green-500/20">
                      <p className="text-3xl font-bold text-green-400">{geocodingProgress.success}</p>
                      <p className="text-sm text-[var(--text-muted)]">Ascenseurs géocodés</p>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-lg text-center border border-red-500/20">
                      <p className="text-3xl font-bold text-red-400">{geocodingProgress.failed}</p>
                      <p className="text-sm text-[var(--text-muted)]">Échecs</p>
                    </div>
                  </div>
                  
                  {/* Liste des échecs avec options */}
                  {geocodingProgress.failures && geocodingProgress.failures.length > 0 && (
                    <div className="mb-4">
                      <p className="font-semibold mb-2 flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        Adresses non trouvées ({geocodingProgress.failures.length})
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-2 bg-[var(--bg-secondary)] rounded-lg p-2">
                        {geocodingProgress.failures.map((f, idx) => (
                          <div key={f.id || idx} className="p-2 bg-[var(--bg-tertiary)] rounded text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{f.code}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    // Ouvrir Google Maps pour chercher l'adresse
                                    const query = encodeURIComponent(`${f.adresse}, ${f.ville}, France`);
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                  }}
                                  className="text-xs text-blue-400 hover:underline"
                                >
                                  🗺️ Maps
                                </button>
                                <button
                                  onClick={async () => {
                                    // Demander les coordonnées manuellement
                                    const coords = prompt(
                                      `Saisir les coordonnées GPS pour ${f.code}:\n(format: latitude, longitude)\nEx: 45.7772, 3.0870`,
                                      ''
                                    );
                                    if (coords) {
                                      const match = coords.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
                                      if (match) {
                                        const lat = parseFloat(match[1]);
                                        const lng = parseFloat(match[2]);
                                        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                          // Mettre à jour en base
                                          const { error } = await supabase
                                            .from('parc_ascenseurs')
                                            .update({
                                              latitude: lat,
                                              longitude: lng,
                                              geocoded_at: new Date().toISOString()
                                            })
                                            .eq('id', f.id);
                                          
                                          if (error) {
                                            toast.error('Erreur lors de la mise à jour');
                                          } else {
                                            toast.success(`GPS mis à jour pour ${f.code}`);
                                            // Retirer de la liste des échecs
                                            setGeocodingProgress(prev => ({
                                              ...prev,
                                              failures: prev.failures?.filter(x => x.id !== f.id),
                                              success: prev.success + 1,
                                              failed: prev.failed - 1
                                            }));
                                          }
                                        } else {
                                          toast.error('Coordonnées invalides');
                                        }
                                      } else {
                                        toast.error('Format invalide. Utilisez: latitude, longitude');
                                      }
                                    }
                                  }}
                                  className="text-xs text-green-400 hover:underline"
                                >
                                  ✏️ Saisir GPS
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {f.adresse}, {f.ville}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        💡 Cliquez sur "Maps" pour localiser l'adresse, puis "Saisir GPS" pour entrer les coordonnées manuellement.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setGeocodingProgress({ isRunning: false, current: 0, total: 0, success: 0, failed: 0, failures: [] });
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Relancer
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => {
                        setShowGeocodingModal(false);
                        setGeocodingProgress({ isRunning: false, current: 0, total: 0, success: 0, failed: 0, failures: [] });
                      }}
                    >
                      Fermer
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
