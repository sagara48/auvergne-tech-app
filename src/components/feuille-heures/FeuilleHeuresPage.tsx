import { useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Check } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { JourRow } from './JourRow';
import { AstreintesList } from './AstreintesList';
import { SidebarResume } from './SidebarResume';
import { useAppStore } from '@/stores/appStore';
import {
  useSemaine,
  useUpdateJour,
  useCreerTache,
  useUpdateTache,
  useDeleteTache,
  useCreerAstreinte,
  useUpdateAstreinte,
  useDeleteAstreinte,
  useValiderSemaine,
} from '@/hooks/useFeuilleHeures';
import { JOURS_CONFIG, type TotauxSemaine } from '@/types';
import { getDatesSemaine } from '@/services/api';

// Technicien temporaire pour la démo
const DEMO_TECHNICIEN_ID = '11111111-1111-1111-1111-111111111111';

export function FeuilleHeuresPage() {
  const { user, anneeActive, semaineActive, naviguerSemaine } = useAppStore();
  const technicienId = user?.id || DEMO_TECHNICIEN_ID;

  // Requête principale
  const { data: semaine, isLoading, error } = useSemaine(technicienId, anneeActive, semaineActive);

  // Mutations
  const updateJour = useUpdateJour();
  const creerTache = useCreerTache();
  const updateTache = useUpdateTache();
  const deleteTache = useDeleteTache();
  const creerAstreinte = useCreerAstreinte();
  const updateAstreinte = useUpdateAstreinte();
  const deleteAstreinte = useDeleteAstreinte();
  const validerSemaine = useValiderSemaine();

  // Dates de la semaine
  const datesSemaine = useMemo(
    () => getDatesSemaine(anneeActive, semaineActive),
    [anneeActive, semaineActive]
  );

  // Calcul des totaux
  const totaux = useMemo<TotauxSemaine>(() => {
    if (!semaine) {
      return {
        heures_travail: 0,
        heures_trajet: 0,
        heures_rtt: 0,
        heures_astreinte_rtt: 0,
        heures_astreinte_paye: 0,
        progression: 0,
      };
    }
    return semaine.totaux;
  }, [semaine]);

  // Handlers
  const handleUpdateJour = useCallback(
    (jourId: string) => (data: Partial<any>) => {
      updateJour.mutate({ jourId, data });
    },
    [updateJour]
  );

  const handleAddTache = useCallback(
    (jourId: string) => () => {
      creerTache.mutate({
        jourId,
        data: {
          periode: 'matin',
          description: '',
          duree: '01:00:00',
          temps_trajet: '00:00:00',
        },
      });
    },
    [creerTache]
  );

  const handleUpdateTache = useCallback(
    (tacheId: string, data: Partial<any>) => {
      updateTache.mutate({ tacheId, data });
    },
    [updateTache]
  );

  const handleDeleteTache = useCallback(
    (tacheId: string) => {
      deleteTache.mutate(tacheId);
    },
    [deleteTache]
  );

  const handleAddAstreinte = useCallback(() => {
    if (!semaine) return;
    creerAstreinte.mutate({
      semaineId: semaine.id,
      data: {
        type_astreinte: 'samedi_jour',
        heure_depart: '',
        temps_trajet: '00:00:00',
        motif: '',
        temps_site: '00:00:00',
      },
    });
  }, [semaine, creerAstreinte]);

  const handleUpdateAstreinte = useCallback(
    (astreinteId: string, data: Partial<any>) => {
      updateAstreinte.mutate({ astreinteId, data });
    },
    [updateAstreinte]
  );

  const handleDeleteAstreinte = useCallback(
    (astreinteId: string) => {
      deleteAstreinte.mutate(astreinteId);
    },
    [deleteAstreinte]
  );

  const handleValider = useCallback(() => {
    if (!semaine) return;
    validerSemaine.mutate({ semaineId: semaine.id, validePar: technicienId });
  }, [semaine, technicienId, validerSemaine]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="w-80 space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-400 mb-4">Erreur lors du chargement des données</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Contenu principal */}
      <div className="flex-1 space-y-5">
        {/* Navigation semaine */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => naviguerSemaine('precedent')}
              className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:border-blue-500 transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                Semaine {semaineActive} — {anneeActive}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">
                Du {datesSemaine[0]?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au{' '}
                {datesSemaine[4]?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            <button
              onClick={() => naviguerSemaine('suivant')}
              className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:border-blue-500 transition-all"
            >
              <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary">
              <Download className="w-4 h-4" /> Exporter
            </Button>
            <Button variant="success" onClick={handleValider}>
              <Check className="w-4 h-4" /> Valider
            </Button>
          </div>
        </div>

        {/* Jours */}
        <div className="space-y-4">
          {semaine?.jours?.map((jour) => (
            <JourRow
              key={jour.id}
              jour={jour}
              config={JOURS_CONFIG[jour.jour_semaine]}
              taches={jour.taches || []}
              onUpdateJour={handleUpdateJour(jour.id)}
              onAddTache={handleAddTache(jour.id)}
              onUpdateTache={handleUpdateTache}
              onDeleteTache={handleDeleteTache}
              isLoading={updateJour.isPending}
            />
          ))}
        </div>

        {/* Astreintes */}
        <AstreintesList
          astreintes={semaine?.astreintes || []}
          onAdd={handleAddAstreinte}
          onUpdate={handleUpdateAstreinte}
          onDelete={handleDeleteAstreinte}
          isLoading={creerAstreinte.isPending || updateAstreinte.isPending}
        />
      </div>

      {/* Sidebar */}
      <SidebarResume
        technicien={user}
        totaux={totaux}
        annee={anneeActive}
        semaine={semaineActive}
      />
    </div>
  );
}
