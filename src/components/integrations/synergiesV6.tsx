// src/components/integrations/synergiesV6.tsx
// Synergies V6: Dictée Vocale, Scan NFC, Mode Hors-ligne, Absences ↔ Réaffectation

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Mic, MicOff, Square, Play, Pause, Volume2, FileText, Send, Loader2,
  Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, X, AlertTriangle,
  Smartphone, Nfc, Building2, History, Wrench, AlertCircle, Eye,
  Calendar, User, UserX, Users, ArrowRight, Clock, MapPin, Zap,
  ChevronRight, ChevronDown, Edit, Trash2, Download, Upload, Database
} from 'lucide-react';
import { Card, CardBody, Badge } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';


// =============================================
// 1. DICTÉE VOCALE
// =============================================

export function DicteeVocale({ 
  onTranscription,
  placeholder = "Appuyez sur le micro pour dicter...",
  initialValue = '',
  travauxId,
  compact = false
}: { 
  onTranscription?: (text: string) => void;
  placeholder?: string;
  initialValue?: string;
  travauxId?: string;
  compact?: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(initialValue);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => prev + final);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError("Microphone non autorisé");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [isRecording]);

  const startRecording = () => {
    if (!recognitionRef.current) return;
    setError(null);
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      setError("Impossible de démarrer");
    }
  };

  const stopRecording = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsRecording(false);
    setInterimTranscript('');
    if (onTranscription) onTranscription(transcript);
  };

  const saveReport = useMutation({
    mutationFn: async () => {
      if (!travauxId || !transcript.trim()) return;
      const { error } = await supabase
        .from('travaux')
        .update({ rapport_intervention: transcript })
        .eq('id', travauxId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rapport sauvegardé');
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
    },
  });

  if (!isSupported) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
        <MicOff className="w-8 h-8 mx-auto mb-2 text-red-400" />
        <p className="text-sm text-red-400">Reconnaissance vocale non supportée</p>
        <p className="text-xs text-[var(--text-muted)]">Utilisez Chrome, Edge ou Safari</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-3 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-400'}`}
        >
          {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <span className="text-sm text-[var(--text-muted)]">
          {isRecording ? 'Enregistrement...' : transcript ? `${transcript.split(' ').length} mots` : 'Dicter'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold">Dictée Vocale</h3>
        {isRecording && <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />REC</span>}
      </div>

      <textarea
        value={transcript + interimTranscript}
        onChange={e => setTranscript(e.target.value)}
        placeholder={placeholder}
        className="w-full h-40 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-sm resize-none"
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!isRecording ? (
            <button onClick={startRecording} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm">
              <Mic className="w-4 h-4" />Commencer
            </button>
          ) : (
            <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm">
              <Square className="w-4 h-4" />Arrêter
            </button>
          )}
        </div>
        {transcript && (
          <div className="flex gap-2">
            <button onClick={() => setTranscript('')} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]">
              <Trash2 className="w-4 h-4" />
            </button>
            {travauxId && (
              <button onClick={() => saveReport.mutate()} disabled={saveReport.isPending} className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-sm">
                {saveReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Sauvegarder
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>}
      {transcript && <p className="text-xs text-[var(--text-muted)]">{transcript.split(' ').filter(Boolean).length} mots • {transcript.length} caractères</p>}
    </div>
  );
}


// =============================================
// 2. SCAN NFC
// =============================================

export function ScanNFC({ 
  onScan,
  compact = false
}: { 
  onScan?: (code: string, data: any) => void;
  compact?: boolean;
}) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{ serial: string; code?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported('NDEFReader' in window);
  }, []);

  const { data: ascenseur } = useQuery({
    queryKey: ['nfc-ascenseur', lastScan?.code],
    queryFn: async () => {
      if (!lastScan?.code) return null;
      const { data } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville, marque, en_arret')
        .eq('code_appareil', lastScan.code)
        .single();
      return data;
    },
    enabled: !!lastScan?.code,
  });

  const startScan = async () => {
    if (!isSupported) return;
    try {
      setError(null);
      setIsScanning(true);
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();

      ndef.onreading = (event: any) => {
        let code: string | undefined;
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const text = new TextDecoder().decode(record.data);
            if (text.match(/^\d{5,6}$/)) code = text;
          }
        }
        setLastScan({ serial: event.serialNumber, code });
        setIsScanning(false);
        if (code && onScan) onScan(code, { serial: event.serialNumber });
        toast.success('Tag NFC détecté !');
        if ('vibrate' in navigator) navigator.vibrate(200);
      };

      ndef.onreadingerror = () => {
        setError("Erreur de lecture NFC");
        setIsScanning(false);
      };
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? "Permission NFC refusée" : `Erreur: ${err.message}`);
      setIsScanning(false);
    }
  };

  // Simulation pour test
  const simulateScan = () => {
    const codes = ['123456', '234567', '345678'];
    const code = codes[Math.floor(Math.random() * codes.length)];
    setLastScan({ serial: `SIM-${Date.now()}`, code });
    if (onScan) onScan(code, { simulated: true });
    toast.success(`[Test] Code ${code}`);
  };

  if (isSupported === false) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
        <Smartphone className="w-8 h-8 mx-auto mb-2 text-amber-400" />
        <p className="text-sm text-amber-400">NFC non disponible</p>
        <p className="text-xs text-[var(--text-muted)]">Utilisez Chrome sur Android</p>
        <button onClick={simulateScan} className="mt-2 px-3 py-1 bg-blue-500/20 rounded text-blue-400 text-xs">Simuler scan</button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={isScanning ? () => setIsScanning(false) : startScan}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl w-full ${isScanning ? 'bg-blue-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-400'}`}
      >
        <Nfc className="w-5 h-5" />
        {isScanning ? 'Approchez le tag...' : 'Scanner NFC'}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Nfc className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold">Scan NFC</h3>
      </div>

      <button
        onClick={isScanning ? () => setIsScanning(false) : startScan}
        className={`w-full p-6 rounded-xl border-2 border-dashed ${isScanning ? 'bg-blue-500/20 border-blue-500 animate-pulse' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}`}
      >
        <Nfc className={`w-12 h-12 mx-auto mb-3 ${isScanning ? 'text-blue-400' : 'text-[var(--text-muted)]'}`} />
        <p className="text-sm font-medium">{isScanning ? 'Approchez le tag NFC...' : 'Appuyez pour scanner'}</p>
      </button>

      <div className="flex gap-2">
        <button onClick={simulateScan} className="flex-1 py-2 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)] text-sm">Mode test</button>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>}

      {lastScan && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-400" />
            <span className="font-medium text-green-400">Tag détecté</span>
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)]">SN: {lastScan.serial}</p>
          
          {ascenseur && (
            <div className="mt-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-lg">{ascenseur.code_appareil}</span>
                {ascenseur.en_arret && <Badge variant="red">À l'arrêt</Badge>}
              </div>
              <p className="text-sm">{ascenseur.adresse}, {ascenseur.ville}</p>
              <p className="text-xs text-[var(--text-muted)]">{ascenseur.marque}</p>
              <button className="w-full mt-3 py-2 bg-blue-500/20 rounded-lg text-blue-400 text-sm">Voir fiche</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================
// 3. MODE HORS-LIGNE
// =============================================

interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: string;
  synced: boolean;
}

export function ModeHorsLigne({ compact = false }: { compact?: boolean }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('Connexion rétablie'); syncPending(); };
    const handleOffline = () => { setIsOnline(false); toast('Mode hors-ligne', { icon: '📴' }); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const stored = localStorage.getItem('offline_actions');
    if (stored) setPendingActions(JSON.parse(stored));
    setLastSync(localStorage.getItem('last_sync'));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('offline_actions', JSON.stringify(pendingActions));
  }, [pendingActions]);

  const syncPending = async () => {
    if (!navigator.onLine || pendingActions.length === 0) return;
    setIsSyncing(true);
    let success = 0;

    for (const action of pendingActions.filter(a => !a.synced)) {
      try {
        if (action.type === 'create') await supabase.from(action.table).insert(action.data);
        else if (action.type === 'update') await supabase.from(action.table).update(action.data.updates).eq('id', action.data.id);
        else if (action.type === 'delete') await supabase.from(action.table).delete().eq('id', action.data.id);
        
        setPendingActions(prev => prev.map(a => a.id === action.id ? { ...a, synced: true } : a));
        success++;
      } catch (err) {
        console.error('Sync error:', err);
      }
    }

    setPendingActions(prev => prev.filter(a => !a.synced));
    const now = new Date().toISOString();
    setLastSync(now);
    localStorage.setItem('last_sync', now);
    setIsSyncing(false);
    queryClient.invalidateQueries();
    if (success > 0) toast.success(`${success} action(s) synchronisée(s)`);
  };

  const pendingCount = pendingActions.filter(a => !a.synced).length;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isOnline ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
          <span className={`text-sm ${isOnline ? 'text-green-400' : 'text-red-400'}`}>{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
        </div>
        {pendingCount > 0 && <Badge variant="amber">{pendingCount}</Badge>}
        {isOnline && pendingCount > 0 && (
          <button onClick={syncPending} disabled={isSyncing} className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? <Cloud className="w-5 h-5 text-green-400" /> : <CloudOff className="w-5 h-5 text-red-400" />}
          <h3 className="font-semibold">Mode Hors-ligne</h3>
        </div>
        <Badge variant={isOnline ? 'green' : 'red'}>{isOnline ? 'Connecté' : 'Hors-ligne'}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] text-center">
          <p className="text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-[var(--text-muted)]">En attente</p>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] text-center">
          <p className="text-sm font-medium">{lastSync ? format(parseISO(lastSync), 'HH:mm') : '-'}</p>
          <p className="text-xs text-[var(--text-muted)]">Dernière sync</p>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] text-center">
          <p className="text-sm font-medium">{(new Blob([JSON.stringify(pendingActions)]).size / 1024).toFixed(1)} KB</p>
          <p className="text-xs text-[var(--text-muted)]">Cache</p>
        </div>
      </div>

      <button
        onClick={syncPending}
        disabled={!isOnline || isSyncing || pendingCount === 0}
        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl text-blue-400 text-sm disabled:opacity-50"
      >
        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Synchroniser
      </button>

      {isOnline && pendingCount === 0 && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
          <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-sm text-green-400">Tout est synchronisé</p>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="space-y-2 max-h-40 overflow-auto">
          {pendingActions.filter(a => !a.synced).map(action => (
            <div key={action.id} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={action.type === 'create' ? 'green' : action.type === 'update' ? 'blue' : 'red'}>{action.type}</Badge>
                <span className="font-mono text-xs">{action.table}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{format(parseISO(action.timestamp), 'HH:mm')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook export
export function useOfflineMode() {
  const addAction = useCallback((type: 'create' | 'update' | 'delete', table: string, data: any) => {
    const action: OfflineAction = {
      id: `offline-${Date.now()}`,
      type, table, data,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    const stored = localStorage.getItem('offline_actions');
    const actions = stored ? JSON.parse(stored) : [];
    actions.push(action);
    localStorage.setItem('offline_actions', JSON.stringify(actions));
    return action.id;
  }, []);

  return { isOnline: navigator.onLine, addAction };
}


// =============================================
// 4. ABSENCES ↔ RÉAFFECTATION
// =============================================

interface Absence {
  id: string;
  technicien_id: string;
  technicien_nom: string;
  date_debut: string;
  date_fin: string;
  type: string;
  travaux: { id: string; code: string; titre: string; date_prevue: string; priorite: string; code_appareil: string }[];
}

export function AbsencesReaffectation({ compact = false }: { compact?: boolean }) {
  const [selectedAbsence, setSelectedAbsence] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: absences, isLoading, refetch } = useQuery({
    queryKey: ['absences-reaffectation'],
    queryFn: async () => {
      const now = new Date();
      const { data: conges } = await supabase
        .from('planning_conges')
        .select('id, technicien_id, date_debut, date_fin, type, technicien:techniciens(prenom, nom)')
        .gte('date_fin', now.toISOString())
        .lte('date_debut', addDays(now, 30).toISOString())
        .eq('statut', 'valide');

      const result: Absence[] = [];
      for (const c of conges || []) {
        const { data: travaux } = await supabase
          .from('travaux')
          .select('id, code, titre, date_planifiee, priorite, code_appareil')
          .eq('technicien_id', c.technicien_id)
          .gte('date_planifiee', c.date_debut)
          .lte('date_planifiee', c.date_fin)
          .in('statut', ['planifie', 'en_cours']);

        result.push({
          id: c.id,
          technicien_id: c.technicien_id,
          technicien_nom: c.technicien ? `${c.technicien.prenom} ${c.technicien.nom}` : 'Inconnu',
          date_debut: c.date_debut,
          date_fin: c.date_fin,
          type: c.type || 'conge',
          travaux: (travaux || []).map(t => ({ ...t, date_prevue: t.date_planifiee })),
        });
      }
      return result.sort((a, b) => b.travaux.length - a.travaux.length);
    },
  });

  const { data: techniciensDispo } = useQuery({
    queryKey: ['techniciens-dispo', selectedAbsence],
    queryFn: async () => {
      const absence = absences?.find(a => a.id === selectedAbsence);
      if (!absence) return [];
      const { data: techs } = await supabase
        .from('techniciens')
        .select('id, prenom, nom')
        .eq('actif', true)
        .neq('id', absence.technicien_id);

      const result = [];
      for (const t of techs || []) {
        const { data: travaux } = await supabase
          .from('travaux')
          .select('id')
          .eq('technicien_id', t.id)
          .gte('date_planifiee', absence.date_debut)
          .lte('date_planifiee', absence.date_fin)
          .in('statut', ['planifie', 'en_cours']);
        result.push({ id: t.id, nom: `${t.prenom} ${t.nom}`, charge: travaux?.length || 0 });
      }
      return result.sort((a, b) => a.charge - b.charge);
    },
    enabled: !!selectedAbsence,
  });

  const reaffecter = useMutation({
    mutationFn: async ({ travauxId, techId }: { travauxId: string; techId: string }) => {
      const { error } = await supabase.from('travaux').update({ technicien_id: techId }).eq('id', travauxId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Réaffecté');
      queryClient.invalidateQueries({ queryKey: ['absences-reaffectation'] });
    },
  });

  const reaffecterTousAuto = useMutation({
    mutationFn: async (absenceId: string) => {
      const absence = absences?.find(a => a.id === absenceId);
      if (!absence || !techniciensDispo?.length) return;
      for (let i = 0; i < absence.travaux.length; i++) {
        const tech = techniciensDispo[i % techniciensDispo.length];
        await supabase.from('travaux').update({ technicien_id: tech.id }).eq('id', absence.travaux[i].id);
      }
    },
    onSuccess: () => {
      toast.success('Tous réaffectés');
      queryClient.invalidateQueries({ queryKey: ['absences-reaffectation'] });
      setSelectedAbsence(null);
    },
  });

  const stats = useMemo(() => ({
    absences: absences?.length || 0,
    travaux: absences?.reduce((s, a) => s + a.travaux.length, 0) || 0,
    urgents: absences?.reduce((s, a) => s + a.travaux.filter(t => t.priorite === 'urgente').length, 0) || 0,
  }), [absences]);

  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    conge: { label: 'Congé', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    maladie: { label: 'Maladie', color: 'text-red-400', bg: 'bg-red-500/10' },
    formation: { label: 'Formation', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    autre: { label: 'Autre', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>;

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm">Réaffectation</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-amber-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-amber-400">{stats.absences}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Absences</p>
          </div>
          <div className="p-2 bg-red-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-red-400">{stats.travaux}</p>
            <p className="text-[10px] text-[var(--text-muted)]">À réaffecter</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserX className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold">Absences & Réaffectation</h3>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-amber-500/10 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.absences}</p>
          <p className="text-xs text-[var(--text-muted)]">Absences (30j)</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.travaux}</p>
          <p className="text-xs text-[var(--text-muted)]">Travaux impactés</p>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.urgents}</p>
          <p className="text-xs text-[var(--text-muted)]">Urgents</p>
        </div>
      </div>

      {!absences?.length ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune absence avec travaux à réaffecter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {absences.map(abs => {
            const isSelected = selectedAbsence === abs.id;
            const cfg = typeConfig[abs.type] || typeConfig.autre;

            return (
              <div key={abs.id} className={`rounded-xl border ${isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)]'}`}>
                <div className="p-4 cursor-pointer" onClick={() => setSelectedAbsence(isSelected ? null : abs.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="font-medium">{abs.technicien_nom}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">
                        {format(parseISO(abs.date_debut), 'd MMM', { locale: fr })} → {format(parseISO(abs.date_fin), 'd MMM', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {abs.travaux.length > 0 ? (
                        <Badge variant={abs.travaux.some(t => t.priorite === 'urgente') ? 'red' : 'amber'}>{abs.travaux.length} travaux</Badge>
                      ) : (
                        <Badge variant="green">OK</Badge>
                      )}
                      <ChevronRight className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>

                {isSelected && abs.travaux.length > 0 && (
                  <div className="px-4 pb-4 border-t border-[var(--border-primary)] pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">Travaux à réaffecter</h4>
                      <button
                        onClick={() => reaffecterTousAuto.mutate(abs.id)}
                        disabled={reaffecterTousAuto.isPending || !techniciensDispo?.length}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 rounded-lg text-green-400 text-xs disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3" />Auto
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-auto">
                      {abs.travaux.map(t => (
                        <div key={t.id} className="p-3 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm">{t.code}</span>
                              <Badge variant={t.priorite === 'urgente' ? 'red' : 'blue'}>{t.priorite}</Badge>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">{t.titre}</p>
                            <p className="text-xs text-[var(--text-muted)]">{format(parseISO(t.date_prevue), 'd MMM', { locale: fr })} • {t.code_appareil}</p>
                          </div>
                          <select
                            onChange={e => e.target.value && reaffecter.mutate({ travauxId: t.id, techId: e.target.value })}
                            className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-xs"
                          >
                            <option value="">Réaffecter à...</option>
                            {techniciensDispo?.map(tech => (
                              <option key={tech.id} value={tech.id}>{tech.nom} ({tech.charge})</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// =============================================
// WIDGETS
// =============================================

export function DicteeVocaleWidget() {
  return <Card className="h-full"><CardBody className="p-3"><DicteeVocale compact /></CardBody></Card>;
}

export function ScanNFCWidget() {
  return <Card className="h-full"><CardBody className="p-3"><ScanNFC compact /></CardBody></Card>;
}

export function ModeHorsLigneWidget() {
  return <Card className="h-full"><CardBody className="p-3"><ModeHorsLigne compact /></CardBody></Card>;
}

export function AbsencesWidget() {
  return <Card className="h-full"><CardBody className="p-3"><AbsencesReaffectation compact /></CardBody></Card>;
}
