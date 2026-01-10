import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Hammer,
  FileCheck,
  Route,
  Building2,
  Package,
  Car,
  HelpCircle,
  FolderOpen,
  Clock,
  ChevronDown,
  MessageCircle,
  StickyNote,
  Sun,
  Moon,
  Archive,
  ShoppingCart,
  Nfc,
  Wifi,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { NotificationCenter } from '@/components/notifications';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PanierButton, PanierDrawer } from '@/components/Panier';
import { NFCScanner } from '@/components/NFCScanner';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const modules = [
  { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, color: '#3b82f6' },
  { id: 'planning', name: 'Planning', icon: Calendar, color: '#f59e0b' },
  { id: 'travaux', name: 'Travaux', icon: Hammer, color: '#a855f7' },
  { id: 'miseservice', name: 'Mise en service', icon: FileCheck, color: '#f97316' },
  { id: 'tournees', name: 'Tournées', icon: Route, color: '#84cc16' },
  { id: 'ascenseurs', name: 'Parc Ascenseurs', icon: Building2, color: '#06b6d4' },
  { id: 'stock', name: 'Stock', icon: Package, color: '#ef4444' },
  { id: 'commandes', name: 'Commandes', icon: ShoppingCart, color: '#06b6d4' },
  { id: 'vehicules', name: 'Véhicules', icon: Car, color: '#22c55e' },
  { id: 'demandes', name: 'Demandes', icon: HelpCircle, color: '#ec4899' },
  { id: 'ged', name: 'GED', icon: FolderOpen, color: '#6366f1' },
  { id: 'heures', name: "Feuilles d'heures", icon: Clock, color: '#14b8a6' },
  { id: 'notes', name: 'Notes', icon: StickyNote, color: '#eab308' },
  { id: 'chat', name: 'Messages', icon: MessageCircle, color: '#8b5cf6' },
  { id: 'nfc', name: 'Tags NFC', icon: Nfc, color: '#06b6d4' },
  { id: 'archives', name: 'Archives', icon: Archive, color: '#64748b' },
];

export function Layout({ children }: LayoutProps) {
  const { moduleActif, setModuleActif, user, theme, toggleTheme } = useAppStore();
  const [showNFCScan, setShowNFCScan] = useState(false);

  const openScanner = () => setShowNFCScan(true);

  return (
    <div className="flex h-screen transition-theme bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col transition-theme bg-[var(--bg-secondary)] border-r border-[var(--border-secondary)]">
        {/* Logo */}
        <div className="p-5 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">AuvergneTech</h1>
              <p className="text-xs text-[var(--text-tertiary)]">Gestion intégrée</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = moduleActif === module.id;

            return (
              <button
                key={module.id}
                onClick={() => setModuleActif(module.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/30'
                    : 'hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: module.color }}
                />
                <span
                  className={cn(
                    'text-sm',
                    isActive 
                      ? 'text-[var(--text-primary)] font-semibold' 
                      : 'text-[var(--text-secondary)]'
                  )}
                >
                  {module.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="p-3 border-t border-[var(--border-secondary)]">
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-sm">Mode clair</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm">Mode sombre</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 transition-theme bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {modules.find((m) => m.id === moduleActif)?.name}
          </h2>

          <div className="flex items-center gap-3">
            {/* Realtime Status Indicator */}
            <RealtimeStatusIndicator />

            {/* Theme Toggle (compact) */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500" />
              )}
            </button>

            {/* NFC Scanner */}
            <button
              onClick={openScanner}
              className="p-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
              title="Scanner NFC"
            >
              <Wifi className="w-5 h-5 text-cyan-400" />
            </button>

            {/* Panier */}
            <PanierButton />

            {/* Notifications */}
            <NotificationCenter />

            {/* User Menu */}
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow">
                {user?.avatar_initiales || 'NB'}
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {user?.prenom || 'Nicolas'} {user?.nom?.charAt(0) || 'B'}.
              </span>
              <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 transition-theme bg-[var(--bg-primary)]">
          {children}
        </div>
      </main>

      {/* Panier Drawer */}
      <PanierDrawer />

      {/* NFC Scanner Modal */}
      {showNFCScan && (
        <NFCScanner fullScreen autoStart onClose={() => setShowNFCScan(false)} />
      )}
    </div>
  );
}
