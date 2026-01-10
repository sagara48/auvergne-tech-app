import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Technicien, SemaineAvecDetails } from '@/types';

type Theme = 'dark' | 'light';

interface AppState {
  // Utilisateur
  user: Technicien | null;
  setUser: (user: Technicien | null) => void;
  
  // Semaine active
  semaine: SemaineAvecDetails | null;
  setSemaine: (semaine: SemaineAvecDetails | null) => void;
  
  // Navigation semaine
  anneeActive: number;
  semaineActive: number;
  setAnneeActive: (annee: number) => void;
  setSemaineActive: (semaine: number) => void;
  naviguerSemaine: (direction: 'precedent' | 'suivant') => void;
  
  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Module actif
  moduleActif: string;
  setModuleActif: (module: string) => void;
  
  // Thème
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const now = new Date();
const currentYear = now.getFullYear();
const currentWeek = getWeekNumber(now);

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Appliquer le thème au document
function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Utilisateur
      user: null,
      setUser: (user) => set({ user }),
      
      // Semaine
      semaine: null,
      setSemaine: (semaine) => set({ semaine }),
      
      // Navigation
      anneeActive: currentYear,
      semaineActive: currentWeek,
      setAnneeActive: (annee) => set({ anneeActive: annee }),
      setSemaineActive: (semaine) => set({ semaineActive: semaine }),
      naviguerSemaine: (direction) => {
        const { anneeActive, semaineActive } = get();
        if (direction === 'precedent') {
          if (semaineActive === 1) {
            set({ anneeActive: anneeActive - 1, semaineActive: 52 });
          } else {
            set({ semaineActive: semaineActive - 1 });
          }
        } else {
          if (semaineActive === 52) {
            set({ anneeActive: anneeActive + 1, semaineActive: 1 });
          } else {
            set({ semaineActive: semaineActive + 1 });
          }
        }
      },
      
      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Module
      moduleActif: 'heures',
      setModuleActif: (module) => set({ moduleActif: module }),
      
      // Thème
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        applyTheme(newTheme);
      },
    }),
    {
      name: 'auvergne-tech-storage',
      partialize: (state) => ({
        anneeActive: state.anneeActive,
        semaineActive: state.semaineActive,
        moduleActif: state.moduleActif,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // Appliquer le thème au chargement
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    }
  )
);
