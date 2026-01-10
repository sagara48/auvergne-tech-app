import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { FeuilleHeuresPage } from '@/components/feuille-heures';
import { DashboardPage } from '@/components/dashboard';
import {
  PlanningPage,
  TravauxPage,
  MiseEnServicePage,
  TourneesPage,
  AscenseursPage,
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
        return <AscenseursPage />;
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <AppContent />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
