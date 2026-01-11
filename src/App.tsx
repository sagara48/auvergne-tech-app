import { useState, useEffect } from 'react';
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
} from '@/components/modules';
import { useAppStore } from '@/stores/appStore';
import { useRealtimeSubscriptions } from '@/hooks/useRealtimeSubscriptions';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes (réduit car temps réel)
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
      default:
        return <DashboardPage />;
    }
  };

  // Styles du Toaster selon le thème
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
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Chargement...</p>
      </div>
    </div>
  );
}

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Afficher l'écran de chargement pendant la vérification de session
  if (loading) {
    return <LoadingScreen />;
  }

  // Si pas de session, afficher la page d'authentification
  if (!session) {
    return <AuthPage onAuthSuccess={() => {}} />;
  }

  // Utilisateur authentifié
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <AppContent />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
