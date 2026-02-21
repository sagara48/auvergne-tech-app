// src/hooks/useCentralizedHooks.ts
import { useEffect, useState, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';

// ============================================
// HOOK TRAVAUX
// ============================================
export function useTravaux(filters?: { statut?: string; technicien_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['travaux', filters],
    queryFn: async () => {
      let q = supabase
        .from('travaux')
        .select(`
          *,
          client:clients(*),
          ascenseur:ascenseurs(*),
          technicien:techniciens(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.statut) q = q.eq('statut', filters.statut);
      if (filters?.technicien_id) q = q.eq('technicien_id', filters.technicien_id);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const updateTravaux = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('travaux').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      toast.success('Travaux mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur: ' + error.message);
    },
  });

  return {
    travaux: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateTravaux: updateTravaux.mutate,
  };
}

// ============================================
// HOOK ASCENSEURS
// ============================================
export function useAscenseurs(filters?: { secteur?: string; statut?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ascenseurs', filters],
    queryFn: async () => {
      let q = supabase
        .from('ascenseurs')
        .select(`
          *,
          client:clients(*)
        `)
        .order('code');

      if (filters?.secteur) q = q.eq('secteur', filters.secteur);
      if (filters?.statut) q = q.eq('statut', filters.statut);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const updateAscenseur = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('ascenseurs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
      toast.success('Ascenseur mis à jour');
    },
  });

  return {
    ascenseurs: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateAscenseur: updateAscenseur.mutate,
  };
}

// ============================================
// HOOK PANNES
// ============================================
export function usePannes(filters?: { statut?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pannes', filters],
    queryFn: async () => {
      let q = supabase
        .from('pannes')
        .select(`
          *,
          ascenseur:ascenseurs(*),
          client:clients(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.statut) q = q.eq('statut', filters.statut);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const createPanne = useMutation({
    mutationFn: async (panne: Record<string, unknown>) => {
      const { error } = await supabase.from('pannes').insert(panne);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pannes'] });
      queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
      toast.success('Panne signalée');
    },
  });

  const resoudrePanne = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      const { error } = await supabase
        .from('pannes')
        .update({ statut: 'resolue', resolution, date_resolution: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pannes'] });
      queryClient.invalidateQueries({ queryKey: ['ascenseurs'] });
      toast.success('Panne résolue');
    },
  });

  return {
    pannes: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createPanne: createPanne.mutate,
    resoudrePanne: resoudrePanne.mutate,
  };
}

// ============================================
// HOOK STOCK
// ============================================
export function useStock(vehiculeId?: string) {
  const queryClient = useQueryClient();

  const stockVehicule = useQuery({
    queryKey: ['stock-vehicule', vehiculeId],
    queryFn: async () => {
      if (!vehiculeId) return [];
      const { data, error } = await supabase
        .from('stock_vehicule')
        .select(`
          *,
          article:stock_articles(*)
        `)
        .eq('vehicule_id', vehiculeId);
      if (error) throw error;
      return data;
    },
    enabled: !!vehiculeId,
  });

  const stockDepot = useQuery({
    queryKey: ['stock-depot'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_articles')
        .select('*')
        .order('designation');
      if (error) throw error;
      return data;
    },
  });

  const updateStock = useMutation({
    mutationFn: async ({ id, quantite }: { id: string; quantite: number }) => {
      const { error } = await supabase
        .from('stock_vehicule')
        .update({ quantite })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-vehicule'] });
      toast.success('Stock mis à jour');
    },
  });

  return {
    stockVehicule: stockVehicule.data || [],
    stockDepot: stockDepot.data || [],
    loading: stockVehicule.isLoading || stockDepot.isLoading,
    error: stockVehicule.error || stockDepot.error,
    refetch: () => {
      stockVehicule.refetch();
      stockDepot.refetch();
    },
    updateStock: updateStock.mutate,
  };
}

// ============================================
// HOOK NOTES
// ============================================
export function useNotes(technicienId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notes', technicienId],
    queryFn: async () => {
      let q = supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (technicienId) q = q.eq('technicien_id', technicienId);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const createNote = useMutation({
    mutationFn: async (note: Record<string, unknown>) => {
      const { error } = await supabase.from('notes').insert(note);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note créée');
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('notes').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note mise à jour');
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note supprimée');
    },
  });

  return {
    notes: query.data || [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createNote: createNote.mutate,
    updateNote: updateNote.mutate,
    deleteNote: deleteNote.mutate,
  };
}

// ============================================
// HOOK CHAT
// ============================================
export function useChat(channelId: string) {
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ['chat-messages', channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:techniciens(*)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, senderId }: { content: string; senderId: string }) => {
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_id: senderId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', channelId] });
    },
  });

  return {
    messages: messages.data || [],
    loading: messages.isLoading,
    error: messages.error,
    refetch: messages.refetch,
    sendMessage: sendMessage.mutate,
  };
}

// ============================================
// HOOK TECHNICIEN COURANT
// ============================================
export function useCurrentTechnicien() {
  const [technicien, setTechnicien] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTechnicien = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('techniciens')
          .select('*, vehicule:vehicules(*)')
          .eq('id', user.id)
          .single();
        setTechnicien(data);
      }
      setLoading(false);
    };
    fetchTechnicien();
  }, []);

  return { technicien, loading };
}

// ============================================
// HOOK DASHBOARD STATS
// ============================================
export function useDashboardStats(technicienId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', technicienId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Travaux du jour
      const { data: travaux } = await supabase
        .from('travaux')
        .select('statut', { count: 'exact' })
        .eq('technicien_id', technicienId)
        .gte('date_debut', today);

      // Pannes actives
      const { count: pannesActives } = await supabase
        .from('pannes')
        .select('*', { count: 'exact', head: true })
        .neq('statut', 'resolue');

      // Ascenseurs en panne
      const { count: ascenseursEnPanne } = await supabase
        .from('ascenseurs')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_panne');

      // Stock alertes
      const { data: stockAlertes } = await supabase
        .from('stock_vehicule')
        .select('id')
        .lte('quantite', 'seuil_alerte');

      return {
        travauxJour: travaux?.length || 0,
        pannesActives: pannesActives || 0,
        ascenseursEnPanne: ascenseursEnPanne || 0,
        stockAlertes: stockAlertes?.length || 0,
      };
    },
    enabled: !!technicienId,
    refetchInterval: 30000, // Rafraîchir toutes les 30s
  });
}
