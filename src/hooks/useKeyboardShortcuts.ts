import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

const MODULE_KEYS: Record<string, string> = {
  '1': 'dashboard',
  '2': 'planning',
  '3': 'travaux',
  '4': 'ascenseurs',
  '5': 'stock',
  '6': 'chat',
  '7': 'vehicules',
  '8': 'tournees',
  '9': 'heures',
};

export function useKeyboardShortcuts() {
  const { setModuleActif } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorer si dans un input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        // Ctrl+1-9 = navigation modules
        if (MODULE_KEYS[e.key]) {
          e.preventDefault();
          setModuleActif(MODULE_KEYS[e.key]);
          return;
        }

        // Ctrl+K = search (handled by GlobalSearch)
        // Ctrl+N = nouveau (selon module)
        if (e.key === 'n' && !isInput) {
          e.preventDefault();
          // Dispatch custom event que les modules peuvent écouter
          window.dispatchEvent(new CustomEvent('app:new-item'));
          return;
        }

        // Ctrl+S = sauvegarder
        if (e.key === 's') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:save'));
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setModuleActif]);
}
