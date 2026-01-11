import { ReactNode, useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  StickyNote,
  Sun,
  Moon,
  Archive,
  ShoppingCart,
  Nfc,
  Wifi,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  Settings,
  Shield,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { NotificationCenter } from '@/components/notifications';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PanierButton, PanierDrawer } from '@/components/Panier';
import { NFCScanner } from '@/components/NFCScanner';
import { supabase } from '@/services/supabase';
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
  { id: 'admin', name: 'Administration', icon: Shield, color: '#a855f7' },
];

export function Layout({ children }: LayoutProps) {
  const { moduleActif, setModuleActif, user, theme, toggleTheme } = useAppStore();
  const [showNFCScan, setShowNFCScan] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // État de la sidebar (persisté dans localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Persister l'état de la sidebar
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const openScanner = () => setShowNFCScan(true);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowUserMenu(false);
  };

  return (
    <div className="flex h-screen transition-theme bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          "bg-[var(--bg-secondary)] border-r border-[var(--border-secondary)]",
          sidebarCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "border-b border-[var(--border-secondary)]",
          sidebarCollapsed ? "p-3" : "p-5"
        )}>
          <div className={cn(
            "flex items-center",
            sidebarCollapsed ? "justify-center" : "gap-3"
          )}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="text-lg font-bold text-[var(--text-primary)] whitespace-nowrap">AuvergneTech</h1>
                <p className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">Gestion intégrée</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto",
          sidebarCollapsed ? "p-2" : "p-3"
        )}>
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = moduleActif === module.id;

            return (
              <div key={module.id} className="relative group">
                <button
                  onClick={() => setModuleActif(module.id)}
                  className={cn(
                    'w-full flex items-center rounded-xl mb-1 transition-all',
                    sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-500/30'
                      : 'hover:bg-[var(--bg-tertiary)]'
                  )}
                  title={sidebarCollapsed ? module.name : undefined}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: module.color }}
                  />
                  {!sidebarCollapsed && (
                    <span
                      className={cn(
                        'text-sm whitespace-nowrap overflow-hidden',
                        isActive 
                          ? 'text-[var(--text-primary)] font-semibold' 
                          : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {module.name}
                    </span>
                  )}
                </button>
                
                {/* Tooltip en mode collapsed */}
                {sidebarCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                    {module.name}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className={cn(
          "border-t border-[var(--border-secondary)]",
          sidebarCollapsed ? "p-2" : "p-3"
        )}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center rounded-xl transition-all mb-2",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              sidebarCollapsed ? "justify-center p-3" : "justify-center gap-2 px-4 py-2.5"
            )}
            title={sidebarCollapsed ? (theme === 'dark' ? 'Mode clair' : 'Mode sombre') : undefined}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                {!sidebarCollapsed && <span className="text-sm">Mode clair</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-500" />
                {!sidebarCollapsed && <span className="text-sm">Mode sombre</span>}
              </>
            )}
          </button>

          {/* Toggle Sidebar Button */}
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center rounded-xl transition-all",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              sidebarCollapsed ? "justify-center p-3" : "justify-center gap-2 px-4 py-2.5"
            )}
            title={sidebarCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span className="text-sm">Réduire</span>
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
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow">
                  {user?.avatar_initiales || 'NB'}
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.prenom || 'Nicolas'} {user?.nom?.charAt(0) || 'B'}.
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 text-[var(--text-tertiary)] transition-transform",
                  showUserMenu && "rotate-180"
                )} />
              </button>
              
              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  {/* Overlay pour fermer le menu */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Infos utilisateur */}
                    <div className="px-4 py-3 border-b border-[var(--border-secondary)]">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {user?.prenom || 'Nicolas'} {user?.nom || 'Blanc'}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {user?.email || 'nicolas@auvergne-tech.fr'}
                      </p>
                    </div>
                    
                    {/* Options */}
                    <div className="py-1">
                      <button 
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Mon profil
                      </button>
                      <button 
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Paramètres
                      </button>
                    </div>
                    
                    {/* Déconnexion */}
                    <div className="border-t border-[var(--border-secondary)] py-1">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
