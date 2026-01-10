import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSemaine,
  updateSemaine,
  updateJour,
  creerTache,
  updateTache,
  deleteTache,
  creerAstreinte,
  updateAstreinte,
  deleteAstreinte,
  validerSemaine,
} from '@/services/api';
import type { JourFormData, TacheFormData, AstreinteFormData } from '@/types';
import toast from 'react-hot-toast';

// ================================================
// HOOK: useSemaine
// ================================================
export function useSemaine(technicienId: string, annee: number, numeroSemaine: number) {
  return useQuery({
    queryKey: ['semaine', technicienId, annee, numeroSemaine],
    queryFn: () => getSemaine(technicienId, annee, numeroSemaine),
    enabled: !!technicienId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ================================================
// HOOK: useUpdateSemaine (astreintes cochées)
// ================================================
export function useUpdateSemaine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ semaineId, data }: { 
      semaineId: string; 
      data: { 
        astreinte_semaine?: boolean; 
        astreinte_weekend?: boolean; 
        astreinte_ferie?: boolean;
      } 
    }) => updateSemaine(semaineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// ================================================
// HOOK: useUpdateJour
// ================================================
export function useUpdateJour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jourId, data }: { jourId: string; data: Partial<JourFormData> }) =>
      updateJour(jourId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// ================================================
// HOOK: useTaches
// ================================================
export function useCreerTache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jourId, data }: { jourId: string; data: TacheFormData }) =>
      creerTache(jourId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
      toast.success('Tâche ajoutée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useUpdateTache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tacheId, data }: { tacheId: string; data: Partial<TacheFormData> }) =>
      updateTache(tacheId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useDeleteTache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tacheId: string) => deleteTache(tacheId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
      toast.success('Tâche supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// ================================================
// HOOK: useAstreintes
// ================================================
export function useCreerAstreinte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ semaineId, data }: { semaineId: string; data: AstreinteFormData }) =>
      creerAstreinte(semaineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
      toast.success('Astreinte ajoutée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useUpdateAstreinte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ astreinteId, data }: { astreinteId: string; data: Partial<AstreinteFormData> }) =>
      updateAstreinte(astreinteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useDeleteAstreinte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (astreinteId: string) => deleteAstreinte(astreinteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
      toast.success('Astreinte supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// ================================================
// HOOK: useValiderSemaine
// ================================================
export function useValiderSemaine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ semaineId, validePar }: { semaineId: string; validePar: string }) =>
      validerSemaine(semaineId, validePar),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['semaine'] });
      queryClient.invalidateQueries({ queryKey: ['soldes-conges'] });
      
      if (result.deduction_rtt > 0) {
        toast.success(
          `Semaine validée • ${result.deduction_rtt.toFixed(1)}h déduit des RTT`,
          { duration: 5000 }
        );
      } else {
        toast.success('Semaine validée avec succès');
      }
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}
