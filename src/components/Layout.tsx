import { ReactNode, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Hammer,
  FileCheck,
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
  QrCode,
  Wifi,
  WifiOff,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  Settings,
  Shield,
  Wrench,
  Route,
  Mic,
  Search,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { NotificationCenter } from '@/components/notifications';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PanierButton, PanierDrawer } from '@/components/Panier';
import { QRScanner } from '@/components/QRScanner';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useStockAlerts } from '@/hooks/useStockAlerts';
import { AlertCenter } from '@/components/AlertCenter';
import { supabase } from '@/services/supabase';
import { initAlertService } from '@/services/alertService';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks';

interface LayoutProps {
  children: ReactNode;
}

// ═══ Navigation groupée par domaine ═══
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, color: '#3b82f6' },
    ],
  },
  {
    label: 'TERRAIN',
    items: [
      { id: 'planning', name: 'Planning', icon: Calendar, color: '#f59e0b' },
      { id: 'travaux', name: 'Travaux', icon: Hammer, color: '#B91C1C' },
      { id: 'miseservice', name: 'Mise en service', icon: FileCheck, color: '#f97316' },
      { id: 'tournees', name: 'Tournées', icon: Route, color: '#84cc16' },
    ],
  },
  {
    label: 'PARC',
    items: [
      { id: 'ascenseurs', name: 'Parc Ascenseurs', icon: Building2, color: '#06b6d4' },
      { id: 'vehicules', name: 'Véhicules', icon: Car, color: '#22c55e' },
      { id: 'nfc', name: 'QR Codes', icon: QrCode, color: '#06b6d4' },
    ],
  },
  {
    label: 'STOCK',
    items: [
      { id: 'stock', name: 'Stock', icon: Package, color: '#ef4444' },
      { id: 'pieces', name: 'Pièces détachées', icon: Wrench, color: '#6366f1' },
      { id: 'commandes', name: 'Commandes', icon: ShoppingCart, color: '#06b6d4' },
    ],
  },
  {
    label: 'COLLAB',
    items: [
      { id: 'chat', name: 'Messages', icon: MessageCircle, color: '#2563eb' },
      { id: 'notes', name: 'Notes', icon: StickyNote, color: '#eab308' },
      { id: 'ged', name: 'Documents', icon: FolderOpen, color: '#6366f1' },
    ],
  },
  {
    label: 'RH',
    items: [
      { id: 'heures', name: "Feuilles d'heures", icon: Clock, color: '#14b8a6' },
      { id: 'demandes', name: 'Demandes', icon: HelpCircle, color: '#ec4899' },
      { id: 'archives', name: 'Archives', icon: Archive, color: '#64748b' },
    ],
  },
];

// Flat list for title lookup
const allModules = NAV_GROUPS.flatMap(g => g.items);

export function Layout({ children }: LayoutProps) {
  const { moduleActif, setModuleActif, user, theme, toggleTheme } = useAppStore();
  const [showNFCScan, setShowNFCScan] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isOnline } = useOnlineStatus();
  
  // État de la sidebar (persisté dans localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // État épinglé (persisté)
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('sidebar-pinned');
    return saved !== 'false'; // par défaut épinglée
  });

  // Persister l'état de la sidebar
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Persister l'état épinglé
  useEffect(() => {
    localStorage.setItem('sidebar-pinned', String(sidebarPinned));
  }, [sidebarPinned]);

  // Breadcrumb: trouver le groupe du module actif
  const activeModule = allModules.find(m => m.id === moduleActif);
  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === moduleActif));
  const breadcrumbGroup = activeGroup?.label || null;

  // Initialiser le service d'alertes
  useEffect(() => {
    initAlertService();
  }, []);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const openScanner = () => setShowNFCScan(true);
  
  // Raccourcis clavier
  useKeyboardShortcuts();
  
  // Alertes stock push
  useStockAlerts();
  
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
          "bg-[var(--bg-elevated)] border-r border-[var(--border-secondary)]",
          sidebarCollapsed ? "w-[68px]" : "w-[248px]"
        )}
      >
        {/* Logo + Pin */}
        <div className={cn(
          "border-b border-[var(--border-secondary)]",
          sidebarCollapsed ? "p-3" : "px-4 py-4"
        )}>
          <div className={cn(
            "flex items-center",
            sidebarCollapsed ? "justify-center" : "gap-3"
          )}>
            <div className="w-10 h-10 bg-[#B91C1C] rounded-[14px] flex items-center justify-center shadow-lg flex-shrink-0" style={{ boxShadow: '0 4px 16px rgba(185, 28, 28, 0.3)' }}>
              <span className="text-[15px] font-black text-white">AT</span>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="overflow-hidden flex-1">
                  <h1 className="text-[16px] font-extrabold text-[var(--text-primary)] whitespace-nowrap tracking-tight">AuvergneTech</h1>
                  <p className="text-[9px] font-semibold text-[var(--text-muted)] whitespace-nowrap tracking-[0.1em]">ASCENSEURS</p>
                </div>
                <button
                  onClick={() => setSidebarPinned(!sidebarPinned)}
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all text-[11px] font-extrabold",
                    sidebarPinned 
                      ? "bg-[var(--accent-bg)] border-[#B91C1C]/20 text-[#B91C1C]" 
                      : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                  title={sidebarPinned ? 'Libérer la sidebar' : 'Épingler la sidebar'}
                >
                  {sidebarPinned ? '◉' : '○'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation groupée */}
        <nav className={cn(
          "flex-1 overflow-y-auto",
          sidebarCollapsed ? "px-1.5 py-1" : "px-2.5 py-1"
        )}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="mb-0.5">
              {/* Label de groupe */}
              {group.label && !sidebarCollapsed && (
                <div className="px-2.5 pt-3 pb-1 text-[9px] font-bold text-[var(--text-muted)] tracking-[1.2px] uppercase select-none">
                  {group.label}
                </div>
              )}
              {group.label && sidebarCollapsed && (
                <div className="h-px bg-[var(--border-secondary)] mx-2 my-1.5" />
              )}

              {/* Items du groupe */}
              {group.items.map((module) => {
                const Icon = module.icon;
                const isActive = moduleActif === module.id;

                return (
                  <div key={module.id} className="relative group">
                    <button
                      onClick={() => setModuleActif(module.id)}
                      className={cn(
                        'w-full flex items-center rounded-xl mb-px transition-all duration-150',
                        sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-[9px]',
                        isActive
                          ? 'bg-[var(--accent-bg)] border border-[#B91C1C]/15'
                          : 'hover:bg-[var(--bg-tertiary)]'
                      )}
                      title={sidebarCollapsed ? module.name : undefined}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3.5 rounded-r-sm bg-[#B91C1C]",
                          sidebarCollapsed && "-left-1.5"
                        )} />
                      )}
                      <Icon
                        className="w-[18px] h-[18px] flex-shrink-0"
                        style={{ color: module.color }}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span
                            className={cn(
                              'text-[13px] whitespace-nowrap overflow-hidden flex-1',
                              isActive 
                                ? 'text-[#B91C1C] font-bold' 
                                : 'text-[var(--text-secondary)] font-medium'
                            )}
                          >
                            {module.name}
                          </span>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] flex-shrink-0" style={{ boxShadow: '0 0 8px rgba(185, 28, 28, 0.5)' }} />
                          )}
                        </>
                      )}
                    </button>
                    
                    {/* Tooltip en mode collapsed */}
                    {sidebarCollapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                        {module.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className={cn(
          "border-t border-[var(--border-secondary)]",
          sidebarCollapsed ? "p-2" : "p-3"
        )}>
          {/* Admin */}
          <button
            onClick={() => setModuleActif('admin')}
            className={cn(
              "w-full flex items-center rounded-xl transition-all mb-1.5",
              sidebarCollapsed ? "justify-center p-2" : "gap-2.5 px-3 py-[9px]",
              moduleActif === 'admin'
                ? 'bg-[var(--accent-bg)] text-[#B91C1C]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            )}
            title={sidebarCollapsed ? 'Administration' : undefined}
          >
            <Shield className="w-[18px] h-[18px]" />
            {!sidebarCollapsed && <span className="text-[13px] font-medium">Admin</span>}
          </button>

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

          {/* User profile */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 mt-2 px-2 py-2 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="w-8 h-8 bg-[#B91C1C] rounded-xl flex items-center justify-center text-xs font-bold text-white shadow flex-shrink-0" style={{ boxShadow: '0 2px 8px rgba(185,28,28,0.2)' }}>
                {user?.avatar_initiales || 'NB'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{user?.prenom || 'Nicolas'} {user?.nom?.charAt(0) || 'B'}.</p>
                <p className="text-[9px] text-[var(--text-muted)]">Tech. principal</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#059669] flex-shrink-0" style={{ boxShadow: '0 0 6px rgba(5,150,105,0.4)' }} />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar with Breadcrumb */}
        <header className="h-[60px] flex items-center justify-between px-6 transition-theme bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">AuvergneTech</span>
            {breadcrumbGroup && (
              <>
                <span className="text-[11px] text-[var(--border-primary)]">/</span>
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">{breadcrumbGroup}</span>
              </>
            )}
            <span className="text-[11px] text-[var(--border-primary)]">/</span>
            <span className="text-[14px] font-extrabold text-[var(--text-primary)]">
              {moduleActif === 'admin' ? 'Administration' : activeModule?.name || 'Tableau de bord'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Recherche globale */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] w-[250px]"
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left text-xs">Rechercher...</span>
              <kbd className="text-[9px] font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded-md border border-[var(--border-primary)] text-[#B91C1C] font-bold">⌘K</kbd>
            </button>

            {/* Realtime Status Indicator */}
            <RealtimeStatusIndicator />
            
            {/* Indicateur Online/Offline */}
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EA580C]/20 border border-[#EA580C]/30 rounded-xl animate-pulse">
                <WifiOff className="w-4 h-4 text-[#EA580C]" />
                <span className="text-xs font-medium text-[#EA580C]">Hors ligne</span>
              </div>
            )}

            {/* Theme Toggle (compact) */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500" />
              )}
            </button>

            {/* Dictée vocale */}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              title="Dictée vocale"
            >
              <Mic className="w-3.5 h-3.5" />
              Dictée
            </button>

            {/* QR Scanner */}
            <button
              onClick={openScanner}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              title="Scanner QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              Scanner
            </button>

            {/* Panier */}
            <PanierButton />

            {/* Alertes intelligentes */}
            <AlertCenter />

            {/* Notifications */}
            <NotificationCenter />

            {/* User Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl transition-theme bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]"
              >
                <div className="w-8 h-8 bg-[#B91C1C] rounded-xl flex items-center justify-center text-sm font-bold text-white shadow" style={{ boxShadow: '0 2px 8px rgba(185,28,28,0.2)' }}>
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
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl shadow-xl z-50 overflow-hidden">
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
                      <button 
                        onClick={() => {
                          setModuleActif('admin');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Shield className="w-4 h-4 text-[#B91C1C]" />
                        Administration
                      </button>
                    </div>
                    
                    {/* Déconnexion */}
                    <div className="border-t border-[var(--border-secondary)] py-1">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EA580C] hover:bg-[#EA580C]/10 transition-colors"
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
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      {/* Panier Drawer */}
      <PanierDrawer />

      {/* QR Scanner Modal */}
      {showNFCScan && (
        <QRScanner fullScreen autoStart onClose={() => setShowNFCScan(false)} />
      )}

      {/* Recherche globale (Ctrl+K) */}
      <GlobalSearch />
    </div>
  );
}
