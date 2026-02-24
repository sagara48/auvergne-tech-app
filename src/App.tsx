import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { AuthPage } from '@/components/AuthPage';
import { FeuilleHeuresPage } from '@/components/feuille-heures';
import { DashboardPage } from '@/components/dashboard';
import {
  PlanningPage,
  TravauxPage,
  MiseEnServicePage,
  TourneesPage,
  AscenseursPage,
  ParcAscenseursPage,
  StockPage,
  VehiculesPage,
  DemandesPage,
  GEDPage,
  ChatPage,
  NotesPage,
  ArchivesPage,
  CommandesPage,
  NFCPage,
  AdminPage,
  PiecesPage,
  AtelierToleriePage,
  ControlesPage,
  IoTSigmaPage,
} from '@/components/modules';
import { useAppStore } from '@/stores/appStore';
import { useRealtimeSubscriptions } from '@/hooks/useRealtimeSubscriptions';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// ═══ SÉCURITÉ : Timeout d'inactivité ═══
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
});

// Composant qui gère les subscriptions temps réel
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSubscriptions();
  return <>{children}</>;
}

function AppContent() {
  const { moduleActif, theme } = useAppStore();

  const renderModule = () => {
    switch (moduleActif) {
      case 'dashboard':
        return <DashboardPage />;
      case 'planning':
        return <PlanningPage />;
      case 'travaux':
        return <TravauxPage />;
      case 'miseservice':
        return <MiseEnServicePage />;
      case 'tournees':
        return <TourneesPage />;
      case 'ascenseurs':
        return <ParcAscenseursPage />;
      case 'stock':
        return <StockPage />;
      case 'vehicules':
        return <VehiculesPage />;
      case 'demandes':
        return <DemandesPage />;
      case 'ged':
        return <GEDPage />;
      case 'heures':
        return <FeuilleHeuresPage />;
      case 'chat':
        return <ChatPage />;
      case 'notes':
        return <NotesPage />;
      case 'archives':
        return <ArchivesPage />;
      case 'commandes':
        return <CommandesPage />;
      case 'nfc':
        return <NFCPage />;
      case 'pieces':
        return <PiecesPage />;
      case 'tolerie':
        return <AtelierToleriePage />;
      case 'controles':
        return <ControlesPage />;
      case 'iot':
        return <IoTSigmaPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <DashboardPage />;
    }
  };

  const toastStyles = theme === 'dark' 
    ? {
        background: '#27272a',
        color: '#fafafa',
        border: '1px solid #3f3f46',
      }
    : {
        background: '#ffffff',
        color: '#18181b',
        border: '1px solid #e4e4e7',
      };

  return (
    <>
      <Layout>
        {renderModule()}
      </Layout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: toastStyles,
          success: {
            iconTheme: { primary: '#22c55e', secondary: theme === 'dark' ? '#fafafa' : '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: theme === 'dark' ? '#fafafa' : '#ffffff' },
          },
          duration: 4000,
        }}
      />
    </>
  );
}

// Écran de chargement
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#B91C1C] animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Chargement…</p>
      </div>
    </div>
  );
}

// ═══ HOOK : Session timeout par inactivité ═══

function useInactivityTimeout(session: Session | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    if (!session) return;
    try {
      await supabase.auth.signOut();
      toast('Session expirée par inactivité', { icon: '🔒', duration: 5000 });
    } catch {
      // signOut échoue silencieusement si déjà déconnecté
    }
  }, [session]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (session) {
      timerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT_MS);
    }
  }, [session, handleLogout]);

  useEffect(() => {
    if (!session) return;

    // Reset au montage
    resetTimer();

    // Écouter les événements d'activité
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handler, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handler));
    };
  }, [session, resetTimer]);
}

// ═══ APP PRINCIPALE ═══

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      // Déconnexion forcée si le token est invalidé
      if (event === 'TOKEN_REFRESHED' && !session) {
        setSession(null);
      }
      if (event === 'SIGNED_OUT') {
        // Vider le cache React Query à la déconnexion
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Timeout d'inactivité
  useInactivityTimeout(session);

  // Écran de chargement
  if (loading) {
    return <LoadingScreen />;
  }

  // Pas authentifié → page de connexion
  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  // Authentifié
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <AppContent />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
