import { useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Check, Calendar, TrendingUp } from 'lucide-react';
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

  const moisDebut = datesSemaine[0]?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const moisFin = datesSemaine[4]?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  return (
    <div className="flex gap-6">
      {/* Contenu principal */}
      <div className="flex-1 space-y-5">
        {/* Header avec navigation */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Bouton précédent */}
              <button
                onClick={() => naviguerSemaine('precedent')}
                className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:border-blue-500 transition-all group"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-blue-400" />
              </button>

              {/* Info semaine */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-[var(--text-primary)]">
                      Semaine {semaineActive}
                    </h1>
                    <span className="px-3 py-1 bg-[var(--bg-tertiary)] rounded-full text-sm font-medium text-[var(--text-secondary)]">
                      {anneeActive}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                    Du {moisDebut} au {moisFin}
                  </p>
                </div>
              </div>

              {/* Bouton suivant */}
              <button
                onClick={() => naviguerSemaine('suivant')}
                className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)] hover:border-blue-500 transition-all group"
              >
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-blue-400" />
              </button>
            </div>

            {/* Progression rapide */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-black text-[var(--text-primary)] font-mono">
                    {totaux.heures_travail.toFixed(1)}h
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">sur 39h</div>
                </div>
                <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${totaux.progression >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, totaux.progression)}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4" /> Exporter
                </Button>
                <Button variant="success" size="sm" onClick={handleValider}>
                  <Check className="w-4 h-4" /> Valider la semaine
                </Button>
              </div>
            </div>
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
