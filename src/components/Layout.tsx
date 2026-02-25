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
  MessageCircle,
  StickyNote,
  Sun,
  Moon,
  Archive,
  ShoppingCart,
  QrCode,
  WifiOff,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  Settings,
  Shield,
  Wrench,
  Search,
  Scissors,
  Radio,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { NotificationCenter } from '@/components/notifications';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { PanierButton, PanierDrawer } from '@/components/Panier';
import { QRScanner } from '@/components/QRScanner';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useStockAlerts } from '@/hooks/useStockAlerts';
import { supabase } from '@/services/supabase';
import { initAlertService } from '@/services/alertService';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks';

interface LayoutProps {
  children: ReactNode;
}

// ═══ Navigation groupée — monochrome icons (no per-item color) ═══
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    label: 'TERRAIN',
    items: [
      { id: 'planning', name: 'Planning', icon: Calendar },
      { id: 'travaux', name: 'Travaux', icon: Hammer },
      { id: 'miseservice', name: 'Mise en service', icon: FileCheck },
      { id: 'tolerie', name: 'Atelier Tôlerie', icon: Scissors },
    ],
  },
  {
    label: 'PARC',
    items: [
      { id: 'ascenseurs', name: 'Parc Ascenseurs', icon: Building2 },
      { id: 'controles', name: 'Contrôles Techniques', icon: Shield },
      { id: 'iot', name: 'IoT Sigma4Lifts', icon: Radio },
      { id: 'vehicules', name: 'Véhicules', icon: Car },
    ],
  },
  {
    label: 'STOCK',
    items: [
      { id: 'stock', name: 'Stock', icon: Package },
      { id: 'pieces', name: 'Pièces détachées', icon: Wrench },
      { id: 'commandes', name: 'Commandes', icon: ShoppingCart },
    ],
  },
  {
    label: 'COLLAB',
    items: [
      { id: 'chat', name: 'Messages', icon: MessageCircle },
      { id: 'notes', name: 'Notes', icon: StickyNote },
      { id: 'ged', name: 'Documents', icon: FolderOpen },
    ],
  },
  {
    label: 'RH',
    items: [
      { id: 'heures', name: "Feuilles d'heures", icon: Clock },
      { id: 'demandes', name: 'Demandes', icon: HelpCircle },
      { id: 'archives', name: 'Archives', icon: Archive },
    ],
  },
];

const allModules = NAV_GROUPS.flatMap(g => g.items);

export function Layout({ children }: LayoutProps) {
  const { moduleActif, setModuleActif, user, theme, toggleTheme } = useAppStore();
  const [showQRScan, setShowQRScan] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isOnline } = useOnlineStatus();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Breadcrumb
  const activeModule = allModules.find(m => m.id === moduleActif);
  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === moduleActif));
  const breadcrumbGroup = activeGroup?.label || null;

  useEffect(() => { initAlertService(); }, []);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
  const openScanner = () => setShowQRScan(true);
  
  useKeyboardShortcuts();
  useStockAlerts();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowUserMenu(false);
  };

  return (
    <div className="flex h-screen transition-theme bg-[var(--bg-primary)]">
      {/* ═══ SIDEBAR — 232px open / 60px collapsed ═══ */}
      <aside 
        className={cn(
          "flex flex-col transition-all duration-200 ease-in-out",
          "bg-[var(--bg-secondary)] border-r border-[var(--border-secondary)]",
          sidebarCollapsed ? "w-[60px]" : "w-[232px]"
        )}
      >
        {/* Logo — compact */}
        <div className={cn(
          "flex-shrink-0",
          sidebarCollapsed ? "p-2.5" : "px-3 py-3"
        )}>
          <div className={cn(
            "flex items-center",
            sidebarCollapsed ? "justify-center" : "gap-2.5"
          )}>
            <div
              className="w-[34px] h-[34px] bg-[#B91C1C] rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 2px 8px rgba(185,28,28,0.25)' }}
            >
              <span className="text-[13px] font-black text-white">AT</span>
            </div>
            {!sidebarCollapsed && (
              <h1 className="text-[14px] font-extrabold text-[var(--text-primary)] whitespace-nowrap" style={{ letterSpacing: '-0.03em' }}>
                AuvergneTech
              </h1>
            )}
          </div>
        </div>

        {/* Navigation — monochrome icons, tight spacing */}
        <nav className={cn(
          "flex-1 overflow-y-auto",
          sidebarCollapsed ? "px-1 py-0.5" : "px-1.5 py-0.5"
        )}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="mb-px">
              {/* Group label — semi-transparent */}
              {group.label && !sidebarCollapsed && (
                <div className="px-2.5 pt-2.5 pb-1 text-[9.5px] font-bold text-[var(--text-muted)] tracking-[0.08em] uppercase select-none opacity-60">
                  {group.label}
                </div>
              )}
              {group.label && sidebarCollapsed && (
                <div className="h-px bg-[var(--border-secondary)] mx-2 my-1 opacity-50" />
              )}

              {group.items.map((module) => {
                const Icon = module.icon;
                const isActive = moduleActif === module.id;

                return (
                  <div key={module.id} className="relative group">
                    <button
                      onClick={() => setModuleActif(module.id)}
                      className={cn(
                        'w-full flex items-center rounded-[10px] mb-px transition-all duration-150',
                        sidebarCollapsed ? 'justify-center p-[7px]' : 'gap-2 px-2.5 py-[7px]',
                        isActive
                          ? 'bg-[var(--accent-bg)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      )}
                      title={sidebarCollapsed ? module.name : undefined}
                    >
                      {/* Monochrome: accent when active, muted otherwise */}
                      <Icon
                        className={cn(
                          "w-[17px] h-[17px] flex-shrink-0 transition-colors duration-150",
                          isActive ? "text-[#B91C1C]" : "text-[var(--text-muted)]"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span
                          className={cn(
                            'text-[12.5px] whitespace-nowrap overflow-hidden flex-1 text-left transition-colors duration-150',
                            isActive 
                              ? 'text-[#B91C1C] font-bold' 
                              : 'text-[var(--text-secondary)] font-medium'
                          )}
                        >
                          {module.name}
                        </span>
                      )}
                    </button>
                    
                    {/* Tooltip — dark bg for contrast */}
                    {sidebarCollapsed && (
                      <div
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg text-[11px] font-semibold whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none"
                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                      >
                        {module.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom — Admin + User + Collapse */}
        <div className={cn(
          "border-t border-[var(--border-secondary)] flex-shrink-0",
          sidebarCollapsed ? "p-1.5" : "p-2"
        )}>
          <button
            onClick={() => setModuleActif('admin')}
            className={cn(
              "w-full flex items-center rounded-[10px] transition-all mb-1",
              sidebarCollapsed ? "justify-center p-[7px]" : "gap-2 px-2.5 py-[7px]",
              moduleActif === 'admin'
                ? 'bg-[var(--accent-bg)] text-[#B91C1C]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            )}
            title={sidebarCollapsed ? 'Administration' : undefined}
          >
            <Shield className="w-[17px] h-[17px]" />
            {!sidebarCollapsed && <span className="text-[12.5px] font-medium">Admin</span>}
          </button>

          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-[10px] bg-[var(--bg-primary)]">
              <div
                className="w-[28px] h-[28px] bg-[#B91C1C] rounded-[8px] flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0"
                style={{ boxShadow: '0 1px 4px rgba(185,28,28,0.2)' }}
              >
                {user?.avatar_initiales || 'NB'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[11.5px] font-bold text-[var(--text-primary)] truncate">{user?.prenom || 'Nicolas'} {user?.nom?.charAt(0) || 'B'}.</p>
                <p className="text-[9px] text-[var(--text-muted)]">Tech. principal</p>
              </div>
              <button
                onClick={toggleSidebar}
                className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
                title="Réduire"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center p-[7px] rounded-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
              title="Ouvrir le menu"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header — 48px ultra-compact, avatar-only user */}
        <header className="h-[48px] flex items-center justify-between px-4 transition-theme bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] flex-shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">AuvergneTech</span>
            {breadcrumbGroup && (
              <>
                <span className="text-[10px] text-[var(--border-primary)]">/</span>
                <span className="text-[11px] font-medium text-[var(--text-muted)]">{breadcrumbGroup}</span>
              </>
            )}
            <span className="text-[10px] text-[var(--border-primary)]">/</span>
            <span className="text-[13px] font-extrabold text-[var(--text-primary)]">
              {moduleActif === 'admin' ? 'Administration' : activeModule?.name || 'Tableau de bord'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Search */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="flex items-center gap-2 px-2.5 py-[5px] rounded-[9px] transition-theme bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] w-[200px]"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left text-[10.5px]">Rechercher...</span>
              <kbd className="text-[8px] font-mono bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-primary)] text-[#B91C1C] font-bold">⌘K</kbd>
            </button>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#EA580C]/12 border border-[#EA580C]/20 rounded-[9px] animate-pulse">
                <WifiOff className="w-3 h-3 text-[#EA580C]" />
                <span className="text-[9px] font-semibold text-[#EA580C]">Hors ligne</span>
              </div>
            )}

            {/* Grouped icon buttons — Scanner, Theme, Realtime */}
            <div className="flex items-center p-[2px] rounded-[9px] bg-[var(--bg-primary)] border border-[var(--border-primary)]">
              <button
                onClick={openScanner}
                className="w-[28px] h-[28px] flex items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--bg-hover)]"
                title="Scanner QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
              <button 
                onClick={toggleTheme}
                className="w-[28px] h-[28px] flex items-center justify-center rounded-[7px] transition-colors hover:bg-[var(--bg-hover)]"
                title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                )}
              </button>
              <RealtimeStatusIndicator />
            </div>

            <PanierButton />
            <NotificationCenter />

            {/* User — avatar only, dropdown on click */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-[30px] h-[30px] bg-[#B91C1C] rounded-[9px] flex items-center justify-center text-[10.5px] font-extrabold text-white transition-opacity hover:opacity-90"
                style={{ boxShadow: '0 2px 6px rgba(185,28,28,0.2)' }}
              >
                {user?.avatar_initiales || 'NB'}
              </button>
              
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div
                    className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl z-50 overflow-hidden"
                    style={{ boxShadow: '0 8px 24px rgba(30,27,46,0.12)' }}
                  >
                    <div className="px-3.5 py-2.5 border-b border-[var(--border-secondary)]">
                      <p className="text-[12px] font-bold text-[var(--text-primary)]">
                        {user?.prenom || 'Nicolas'} {user?.nom || 'Blanc'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {user?.email || 'nicolas@auvergne-tech.fr'}
                      </p>
                    </div>
                    
                    <div className="py-0.5">
                      <button 
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        Mon profil
                      </button>
                      <button 
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Paramètres
                      </button>
                      <button 
                        onClick={() => { setModuleActif('admin'); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-[#B91C1C]" />
                        Administration
                      </button>
                    </div>
                    
                    <div className="border-t border-[var(--border-secondary)] py-0.5">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[#EA580C] hover:bg-[#EA580C]/8 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 transition-theme bg-[var(--bg-primary)]">
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      <PanierDrawer />
      {showQRScan && (
        <QRScanner fullScreen autoStart onClose={() => setShowQRScan(false)} />
      )}
      <GlobalSearch />
    </div>
  );
}
