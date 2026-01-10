import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PanierItem {
  id: string;
  article_id?: string;
  code?: string;
  designation: string;
  reference?: string;
  quantite: number;
  fournisseur?: string;
  notes?: string;
  addedAt: string;
}

interface PanierState {
  items: PanierItem[];
  isOpen: boolean;
  
  // Actions
  addItem: (item: Omit<PanierItem, 'id' | 'addedAt'>) => void;
  removeItem: (id: string) => void;
  updateQuantite: (id: string, quantite: number) => void;
  clearPanier: () => void;
  togglePanier: () => void;
  openPanier: () => void;
  closePanier: () => void;
}

export const usePanierStore = create<PanierState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const existingItem = get().items.find(
          i => i.designation === item.designation && i.reference === item.reference
        );

        if (existingItem) {
          // Incrémenter la quantité si l'article existe déjà
          set(state => ({
            items: state.items.map(i =>
              i.id === existingItem.id
                ? { ...i, quantite: i.quantite + item.quantite }
                : i
            ),
            isOpen: true,
          }));
        } else {
          // Ajouter un nouvel article
          const newItem: PanierItem = {
            ...item,
            id: crypto.randomUUID(),
            addedAt: new Date().toISOString(),
          };
          set(state => ({
            items: [...state.items, newItem],
            isOpen: true,
          }));
        }
      },

      removeItem: (id) => {
        set(state => ({
          items: state.items.filter(i => i.id !== id),
        }));
      },

      updateQuantite: (id, quantite) => {
        if (quantite <= 0) {
          get().removeItem(id);
          return;
        }
        set(state => ({
          items: state.items.map(i =>
            i.id === id ? { ...i, quantite } : i
          ),
        }));
      },

      clearPanier: () => {
        set({ items: [] });
      },

      togglePanier: () => {
        set(state => ({ isOpen: !state.isOpen }));
      },

      openPanier: () => {
        set({ isOpen: true });
      },

      closePanier: () => {
        set({ isOpen: false });
      },
    }),
    {
      name: 'panier-storage',
      partialize: (state) => ({ items: state.items }), // Ne persiste que les items
    }
  )
);
