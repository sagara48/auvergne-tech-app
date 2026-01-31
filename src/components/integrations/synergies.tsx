import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, TrendingUp, Package, Calendar, MapPin, Wrench,
  ChevronRight, Clock, Building2, User, CheckCircle2, XCircle,
  Zap, Target, Route, ArrowRight, Plus, Eye, AlertCircle,
  ShoppingCart, Truck, CalendarPlus, Activity
} from 'lucide-react';
import { Card, CardBody, Badge, Button, ProgressBar } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays, subMonths, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// 1. ANALYSE PRÉDICTIVE DES PANNES
// =============================================

interface RisqueAppareil {
  code_appareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  ordre2: number;
  scoreRisque: number;
  facteurs: {
    pannesRecentes: number;
    frequencePannes: number;
    joursDepuisVisite: number;
    ageEquipement: number;
    travauxEnAttente: number;
  };
  derniereVisite?: string;
  dernierePanne?: string;
  totalPannes: number;
}

export function AnalysePredictivePannes({ 
  limit = 10,
  onSelectAscenseur 
}: { 
  limit?: number;
  onSelectAscenseur?: (codeAppareil: string) => void;
}) {
  const [periodeMois, setPeriodeMois] = useState<6 | 12 | 24>(12);

  const { data: analysePannes, isLoading } = useQuery({
    queryKey: ['analyse-predictive-pannes', periodeMois],
    queryFn: async () => {
      const dateDebut = subMonths(new Date(), periodeMois);

      // Récupérer tous les ascenseurs
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville, secteur, ordre2, date_installation')
        .not('type_planning', 'is', null);

      if (!ascenseurs) return [];

      // Récupérer les pannes
      const { data: pannes } = await supabase
        .from('parc_pannes')
        .select('code_appareil, date_panne, date_fin_panne')
        .gte('date_panne', dateDebut.toISOString());

      // Récupérer les visites
      const { data: visites } = await supabase
        .from('parc_visites')
        .select('code_appareil, date_visite')
        .order('date_visite', { ascending: false });

      // Récupérer les travaux en attente
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil')
        .in('statut', ['planifie', 'en_cours']);

      // Calculer le score de risque pour chaque ascenseur
      const risques: RisqueAppareil[] = ascenseurs.map(asc => {
        // Pannes de cet appareil
        const pannesAppareil = pannes?.filter(p => p.code_appareil === asc.code_appareil) || [];
        const pannesRecentes = pannesAppareil.filter(p => 
          isAfter(parseISO(p.date_panne), subMonths(new Date(), 3))
        ).length;

        // Dernière visite
        const visitesAppareil = visites?.filter(v => v.code_appareil === asc.code_appareil) || [];
        const derniereVisite = visitesAppareil[0]?.date_visite;
        const joursDepuisVisite = derniereVisite 
          ? differenceInDays(new Date(), parseISO(derniereVisite))
          : 365;

        // Âge équipement
        const ageEquipement = asc.date_installation 
          ? Math.floor(differenceInDays(new Date(), parseISO(asc.date_installation)) / 365)
          : 15; // Valeur par défaut

        // Travaux en attente
        const travauxEnAttente = travaux?.filter(t => t.code_appareil === asc.code_appareil).length || 0;

        // Calcul du score de risque (0-100)
        const facteurs = {
          pannesRecentes: Math.min(pannesRecentes * 20, 40), // Max 40 points
          frequencePannes: Math.min((pannesAppareil.length / periodeMois) * 30, 25), // Max 25 points
          joursDepuisVisite: Math.min((joursDepuisVisite / 60) * 15, 15), // Max 15 points
          ageEquipement: Math.min((ageEquipement / 20) * 10, 10), // Max 10 points
          travauxEnAttente: Math.min(travauxEnAttente * 5, 10), // Max 10 points
        };

        const scoreRisque = Math.round(
          facteurs.pannesRecentes + 
          facteurs.frequencePannes + 
          facteurs.joursDepuisVisite + 
          facteurs.ageEquipement + 
          facteurs.travauxEnAttente
        );

        return {
          code_appareil: asc.code_appareil,
          adresse: asc.adresse,
          ville: asc.ville,
          secteur: asc.secteur,
          ordre2: asc.ordre2,
          scoreRisque,
          facteurs,
          derniereVisite,
          dernierePanne: pannesAppareil[0]?.date_panne,
          totalPannes: pannesAppareil.length,
        };
      });

      // Trier par score de risque décroissant
      return risques
        .filter(r => r.scoreRisque > 20) // Seulement ceux avec risque significatif
        .sort((a, b) => b.scoreRisque - a.scoreRisque)
        .slice(0, limit);
    },
    refetchInterval: 5 * 60 * 1000, // Rafraîchir toutes les 5 minutes
  });

  const getRisqueColor = (score: number) => {
    if (score >= 70) return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' };
    if (score >= 50) return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' };
    if (score >= 30) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
    return { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' };
  };

  const getRisqueLabel = (score: number) => {
    if (score >= 70) return 'Critique';
    if (score >= 50) return 'Élevé';
    if (score >= 30) return 'Modéré';
    return 'Faible';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête avec sélecteur de période */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Analyse prédictive des pannes
          </h3>
        </div>
        <select
          value={periodeMois}
          onChange={e => setPeriodeMois(Number(e.target.value) as 6 | 12 | 24)}
          className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm"
        >
          <option value={6}>6 mois</option>
          <option value={12}>12 mois</option>
          <option value={24}>24 mois</option>
        </select>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Critiques', count: analysePannes?.filter(a => a.scoreRisque >= 70).length || 0, color: 'red' },
          { label: 'Élevés', count: analysePannes?.filter(a => a.scoreRisque >= 50 && a.scoreRisque < 70).length || 0, color: 'orange' },
          { label: 'Modérés', count: analysePannes?.filter(a => a.scoreRisque >= 30 && a.scoreRisque < 50).length || 0, color: 'amber' },
          { label: 'Surveillés', count: analysePannes?.length || 0, color: 'purple' },
        ].map((stat, idx) => (
          <div key={idx} className={`p-3 rounded-xl bg-${stat.color}-500/10 text-center`}>
            <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.count}</p>
            <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Liste des appareils à risque */}
      {!analysePannes || analysePannes.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-400" />
          <p>Aucun appareil à risque détecté</p>
          <p className="text-xs mt-1">Tous les appareils sont en bon état</p>
        </div>
      ) : (
        <div className="space-y-2">
          {analysePannes.map(appareil => {
            const colors = getRisqueColor(appareil.scoreRisque);
            return (
              <div
                key={appareil.code_appareil}
                onClick={() => onSelectAscenseur?.(appareil.code_appareil)}
                className={`p-3 rounded-xl border ${colors.bg} ${colors.border} cursor-pointer hover:brightness-110 transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {appareil.code_appareil}
                      </span>
                      <Badge variant={appareil.scoreRisque >= 70 ? 'red' : appareil.scoreRisque >= 50 ? 'orange' : 'amber'}>
                        {getRisqueLabel(appareil.scoreRisque)}
                      </Badge>
                      <span className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                        S{appareil.secteur} T{appareil.ordre2}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {appareil.adresse}, {appareil.ville}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {appareil.totalPannes} pannes
                      </span>
                      {appareil.derniereVisite && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Visite: {format(parseISO(appareil.derniereVisite), 'd MMM', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${colors.text}`}>
                      {appareil.scoreRisque}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">Score risque</p>
                  </div>
                </div>

                {/* Détail des facteurs */}
                <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {appareil.facteurs.pannesRecentes > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                        Pannes récentes: +{Math.round(appareil.facteurs.pannesRecentes)}
                      </span>
                    )}
                    {appareil.facteurs.joursDepuisVisite > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        Visite ancienne: +{Math.round(appareil.facteurs.joursDepuisVisite)}
                      </span>
                    )}
                    {appareil.facteurs.travauxEnAttente > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                        Travaux en attente: +{Math.round(appareil.facteurs.travauxEnAttente)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Widget compact pour le dashboard
export function AnalysePredictiveWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: risques } = useQuery({
    queryKey: ['analyse-predictive-widget'],
    queryFn: async () => {
      const dateDebut = subMonths(new Date(), 6);

      const [{ data: ascenseurs }, { data: pannes }] = await Promise.all([
        supabase.from('parc_ascenseurs').select('code_appareil, adresse, ville').not('type_planning', 'is', null),
        supabase.from('parc_pannes').select('code_appareil, date_panne').gte('date_panne', dateDebut.toISOString()),
      ]);

      if (!ascenseurs || !pannes) return { critiques: 0, eleves: 0, total: 0, top: [] };

      // Compter les pannes par appareil
      const pannesParAppareil: Record<string, number> = {};
      pannes.forEach(p => {
        pannesParAppareil[p.code_appareil] = (pannesParAppareil[p.code_appareil] || 0) + 1;
      });

      // Calculer les scores
      const scores = ascenseurs.map(asc => ({
        ...asc,
        pannes: pannesParAppareil[asc.code_appareil] || 0,
        score: Math.min((pannesParAppareil[asc.code_appareil] || 0) * 25, 100),
      })).filter(a => a.score > 20).sort((a, b) => b.score - a.score);

      return {
        critiques: scores.filter(s => s.score >= 70).length,
        eleves: scores.filter(s => s.score >= 50 && s.score < 70).length,
        total: scores.length,
        top: scores.slice(0, 5),
      };
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-sm">Risque pannes</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-red-500/10 rounded-lg">
            <p className="text-lg font-bold text-red-400">{risques?.critiques || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Critiques</p>
          </div>
          <div className="text-center p-2 bg-orange-500/10 rounded-lg">
            <p className="text-lg font-bold text-orange-400">{risques?.eleves || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Élevés</p>
          </div>
          <div className="text-center p-2 bg-purple-500/10 rounded-lg">
            <p className="text-lg font-bold text-purple-400">{risques?.total || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Surveillés</p>
          </div>
        </div>

        {risques?.top && risques.top.length > 0 && (
          <div className="space-y-1">
            {risques.top.map(asc => (
              <div key={asc.code_appareil} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
                <span className="font-mono">{asc.code_appareil}</span>
                <span className={`font-bold ${asc.score >= 70 ? 'text-red-400' : 'text-orange-400'}`}>
                  {asc.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}


// =============================================
// 2. TOURNÉES ↔ TRAVAUX À PROXIMITÉ
// =============================================

interface TravauxProximite {
  id: string;
  code: string;
  titre: string;
  code_appareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  ordre2: number;
  priorite: string;
  statut: string;
  progression: number;
  technicien?: { prenom: string; nom: string };
}

export function TourneeTravauxProximite({ 
  secteur,
  onPlanifier
}: { 
  secteur: number;
  onPlanifier?: (travaux: TravauxProximite, date: string) => void;
}) {
  const { data: travauxSecteur, isLoading } = useQuery({
    queryKey: ['travaux-proximite', secteur],
    queryFn: async () => {
      // Récupérer les travaux non terminés du secteur
      const { data: travaux } = await supabase
        .from('travaux')
        .select(`
          id, code, titre, code_appareil, priorite, statut, progression,
          technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)
        `)
        .in('statut', ['planifie', 'en_cours'])
        .not('code_appareil', 'is', null);

      if (!travaux) return [];

      // Récupérer les infos des ascenseurs
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville, secteur, ordre2')
        .eq('secteur', secteur);

      const ascenseursMap = new Map(ascenseurs?.map(a => [a.code_appareil, a]) || []);

      // Filtrer et enrichir les travaux
      return travaux
        .filter(t => {
          const asc = ascenseursMap.get(t.code_appareil);
          return asc !== undefined;
        })
        .map(t => {
          const asc = ascenseursMap.get(t.code_appareil)!;
          return {
            ...t,
            adresse: asc.adresse,
            ville: asc.ville,
            secteur: asc.secteur,
            ordre2: asc.ordre2,
          };
        })
        .sort((a, b) => {
          // Trier par priorité puis par ordre dans la tournée
          const prioriteOrder = { urgente: 0, haute: 1, normale: 2, basse: 3 };
          const pA = prioriteOrder[a.priorite as keyof typeof prioriteOrder] ?? 2;
          const pB = prioriteOrder[b.priorite as keyof typeof prioriteOrder] ?? 2;
          if (pA !== pB) return pA - pB;
          return (a.ordre2 || 999) - (b.ordre2 || 999);
        });
    },
  });

  const prioriteConfig: Record<string, { label: string; color: string; bg: string }> = {
    urgente: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-500/10' },
    haute: { label: 'Haute', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    normale: { label: 'Normale', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    basse: { label: 'Basse', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Travaux secteur {secteur}
          </h3>
        </div>
        <Badge variant="green">{travauxSecteur?.length || 0} travaux</Badge>
      </div>

      {!travauxSecteur || travauxSecteur.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" />
          <p>Aucun travaux en attente sur ce secteur</p>
        </div>
      ) : (
        <div className="space-y-2">
          {travauxSecteur.map(travaux => {
            const prio = prioriteConfig[travaux.priorite] || prioriteConfig.normale;
            return (
              <div
                key={travaux.id}
                className={`p-3 rounded-xl border ${prio.bg} border-[var(--border-primary)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-purple-400">{travaux.code}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${prio.bg} ${prio.color}`}>
                        {prio.label}
                      </span>
                      <span className="text-[10px] bg-lime-500/20 text-lime-400 px-1.5 py-0.5 rounded">
                        T{travaux.ordre2}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{travaux.titre}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      <span className="font-mono">{travaux.code_appareil}</span> - {travaux.adresse}, {travaux.ville}
                    </p>
                    {travaux.technicien && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {travaux.technicien.prenom} {travaux.technicien.nom}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <span className="text-sm font-bold">{travaux.progression}%</span>
                      <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-purple-500"
                          style={{ width: `${travaux.progression}%` }}
                        />
                      </div>
                    </div>
                    {onPlanifier && (
                      <button
                        onClick={() => onPlanifier(travaux, new Date().toISOString())}
                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded text-green-400"
                        title="Planifier"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Widget pour le dashboard - Travaux par secteur
export function TravauxParSecteurWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: travauxParSecteur } = useQuery({
    queryKey: ['travaux-par-secteur-widget'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil, priorite')
        .in('statut', ['planifie', 'en_cours'])
        .not('code_appareil', 'is', null);

      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, secteur');

      if (!travaux || !ascenseurs) return [];

      const ascMap = new Map(ascenseurs.map(a => [a.code_appareil, a.secteur]));
      
      // Compter par secteur
      const parSecteur: Record<number, { total: number; urgents: number }> = {};
      travaux.forEach(t => {
        const secteur = ascMap.get(t.code_appareil);
        if (secteur) {
          if (!parSecteur[secteur]) parSecteur[secteur] = { total: 0, urgents: 0 };
          parSecteur[secteur].total++;
          if (t.priorite === 'urgente' || t.priorite === 'haute') {
            parSecteur[secteur].urgents++;
          }
        }
      });

      return Object.entries(parSecteur)
        .map(([secteur, data]) => ({ secteur: Number(secteur), ...data }))
        .sort((a, b) => b.urgents - a.urgents || b.total - a.total);
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Route className="w-4 h-4 text-green-400" />
          <span className="font-semibold text-sm">Travaux / Secteur</span>
        </div>

        {!travauxParSecteur || travauxParSecteur.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-sm py-4">
            Aucun travaux en attente
          </p>
        ) : (
          <div className="space-y-2">
            {travauxParSecteur.slice(0, 6).map(s => (
              <div key={s.secteur} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold">
                    S{s.secteur}
                  </span>
                  <span className="text-[var(--text-secondary)]">{s.total} travaux</span>
                </span>
                {s.urgents > 0 && (
                  <Badge variant="red" className="text-[10px]">{s.urgents} urgent{s.urgents > 1 ? 's' : ''}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}


// =============================================
// 3. STOCK ↔ ALERTES PRÉVENTIVES
// =============================================

interface AlerteStock {
  id: string;
  article: {
    id: string;
    designation: string;
    reference: string;
    quantite_stock: number;
    seuil_alerte: number;
  };
  appareilsConcernes: {
    code_appareil: string;
    adresse: string;
    ville: string;
    enPanne: boolean;
    travauxEnCours: boolean;
  }[];
  urgence: 'critique' | 'haute' | 'moyenne';
}

export function StockAlertesPreventives({ 
  onCommander 
}: { 
  onCommander?: (articleId: string) => void;
}) {
  const { data: alertes, isLoading } = useQuery({
    queryKey: ['stock-alertes-preventives'],
    queryFn: async () => {
      // Récupérer les articles en stock bas
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite_stock, seuil_alerte')
        .lte('quantite_stock', supabase.rpc('get_seuil_alerte_col'));

      // Alternative: récupérer tous et filtrer
      const { data: allArticles } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite_stock, seuil_alerte');

      const articlesBasStock = allArticles?.filter(a => 
        a.quantite_stock <= (a.seuil_alerte || 5)
      ) || [];

      if (articlesBasStock.length === 0) return [];

      // Récupérer les appareils en panne
      const { data: pannes } = await supabase
        .from('parc_pannes')
        .select('code_appareil, motif_panne')
        .is('date_fin_panne', null);

      // Récupérer les travaux avec pièces en attente
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil, pieces')
        .in('statut', ['planifie', 'en_cours'])
        .not('pieces', 'is', null);

      // Récupérer les infos ascenseurs
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville');

      const ascMap = new Map(ascenseurs?.map(a => [a.code_appareil, a]) || []);
      const pannesSet = new Set(pannes?.map(p => p.code_appareil) || []);

      // Construire les alertes
      const alertes: AlerteStock[] = articlesBasStock.map(article => {
        // Trouver les appareils qui ont besoin de cette pièce
        const appareilsConcernes: AlerteStock['appareilsConcernes'] = [];

        travaux?.forEach(t => {
          if (!t.pieces || !Array.isArray(t.pieces)) return;
          const needsPiece = t.pieces.some((p: any) => 
            p.article_id === article.id || 
            p.designation?.toLowerCase().includes(article.designation?.toLowerCase()?.substring(0, 10))
          );
          if (needsPiece && t.code_appareil) {
            const asc = ascMap.get(t.code_appareil);
            if (asc && !appareilsConcernes.find(a => a.code_appareil === t.code_appareil)) {
              appareilsConcernes.push({
                code_appareil: t.code_appareil,
                adresse: asc.adresse,
                ville: asc.ville,
                enPanne: pannesSet.has(t.code_appareil),
                travauxEnCours: true,
              });
            }
          }
        });

        // Déterminer l'urgence
        let urgence: AlerteStock['urgence'] = 'moyenne';
        if (article.quantite_stock === 0) urgence = 'critique';
        else if (appareilsConcernes.some(a => a.enPanne)) urgence = 'critique';
        else if (appareilsConcernes.length > 0) urgence = 'haute';

        return {
          id: article.id,
          article,
          appareilsConcernes,
          urgence,
        };
      });

      // Trier par urgence
      const urgenceOrder = { critique: 0, haute: 1, moyenne: 2 };
      return alertes.sort((a, b) => urgenceOrder[a.urgence] - urgenceOrder[b.urgence]);
    },
  });

  const urgenceConfig = {
    critique: { label: 'Critique', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    haute: { label: 'Haute', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    moyenne: { label: 'Moyenne', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Alertes stock préventives
          </h3>
        </div>
        <Badge variant={alertes && alertes.length > 0 ? 'red' : 'green'}>
          {alertes?.length || 0} alertes
        </Badge>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-red-500/10 text-center">
          <p className="text-lg font-bold text-red-400">
            {alertes?.filter(a => a.urgence === 'critique').length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Critiques</p>
        </div>
        <div className="p-2 rounded-lg bg-orange-500/10 text-center">
          <p className="text-lg font-bold text-orange-400">
            {alertes?.filter(a => a.urgence === 'haute').length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Hautes</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-500/10 text-center">
          <p className="text-lg font-bold text-amber-400">
            {alertes?.filter(a => a.urgence === 'moyenne').length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Moyennes</p>
        </div>
      </div>

      {/* Liste des alertes */}
      {!alertes || alertes.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" />
          <p>Stock suffisant pour tous les besoins</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertes.map(alerte => {
            const config = urgenceConfig[alerte.urgence];
            return (
              <div
                key={alerte.id}
                className={`p-3 rounded-xl border ${config.bg} ${config.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {alerte.article.designation}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    {alerte.article.reference && (
                      <p className="text-xs font-mono text-[var(--text-muted)]">
                        Réf: {alerte.article.reference}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-sm font-bold ${alerte.article.quantite_stock === 0 ? 'text-red-400' : 'text-orange-400'}`}>
                        Stock: {alerte.article.quantite_stock}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        (seuil: {alerte.article.seuil_alerte || 5})
                      </span>
                    </div>

                    {/* Appareils concernés */}
                    {alerte.appareilsConcernes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                        <p className="text-[10px] text-[var(--text-muted)] mb-1">
                          Appareils en attente de cette pièce:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {alerte.appareilsConcernes.slice(0, 3).map(app => (
                            <span
                              key={app.code_appareil}
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                app.enPanne ? 'bg-red-500/20 text-red-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                              }`}
                            >
                              {app.code_appareil}
                              {app.enPanne && ' 🔴'}
                            </span>
                          ))}
                          {alerte.appareilsConcernes.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                              +{alerte.appareilsConcernes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {onCommander && (
                    <button
                      onClick={() => onCommander(alerte.article.id)}
                      className="p-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-400"
                      title="Commander"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Widget compact
export function StockAlertesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: alertes } = useQuery({
    queryKey: ['stock-alertes-widget'],
    queryFn: async () => {
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, quantite_stock, seuil_alerte');

      const articlesBasStock = articles?.filter(a => 
        a.quantite_stock <= (a.seuil_alerte || 5)
      ) || [];

      return {
        critiques: articlesBasStock.filter(a => a.quantite_stock === 0).length,
        alertes: articlesBasStock.filter(a => a.quantite_stock > 0).length,
        articles: articlesBasStock.slice(0, 5),
      };
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-sm">Alertes stock</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="text-center p-2 bg-red-500/10 rounded-lg">
            <p className="text-lg font-bold text-red-400">{alertes?.critiques || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Ruptures</p>
          </div>
          <div className="text-center p-2 bg-orange-500/10 rounded-lg">
            <p className="text-lg font-bold text-orange-400">{alertes?.alertes || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Stock bas</p>
          </div>
        </div>

        {alertes?.articles && alertes.articles.length > 0 && (
          <div className="space-y-1">
            {alertes.articles.map(art => (
              <div key={art.id} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
                <span className="truncate flex-1">{art.designation}</span>
                <span className={`font-bold ml-2 ${art.quantite_stock === 0 ? 'text-red-400' : 'text-orange-400'}`}>
                  {art.quantite_stock}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}


// =============================================
// 4. TRAVAUX ↔ PLANNING INTÉGRATION
// =============================================

interface TravauxAPlanifier {
  id: string;
  code: string;
  titre: string;
  code_appareil: string;
  priorite: string;
  statut: string;
  date_butoir?: string;
  technicien_id?: string;
  technicien?: { prenom: string; nom: string };
  adresse?: string;
  ville?: string;
  secteur?: number;
  joursRestants?: number;
}

export function TravauxPlanningIntegration({
  onPlanifier,
  technicienId
}: {
  onPlanifier?: (travaux: TravauxAPlanifier, date: string, technicienId: string) => void;
  technicienId?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: travauxNonPlanifies, isLoading } = useQuery({
    queryKey: ['travaux-non-planifies', technicienId],
    queryFn: async () => {
      let query = supabase
        .from('travaux')
        .select(`
          id, code, titre, code_appareil, priorite, statut, date_butoir, technicien_id,
          technicien:techniciens!travaux_technicien_id_fkey(prenom, nom)
        `)
        .in('statut', ['planifie', 'en_cours']);

      if (technicienId) {
        query = query.eq('technicien_id', technicienId);
      }

      const { data: travaux } = await query;
      if (!travaux) return [];

      // Vérifier lesquels ne sont pas encore dans le planning
      const { data: events } = await supabase
        .from('planning_events')
        .select('travaux_id')
        .not('travaux_id', 'is', null);

      const planifiesIds = new Set(events?.map(e => e.travaux_id) || []);

      // Récupérer infos ascenseurs
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville, secteur');

      const ascMap = new Map(ascenseurs?.map(a => [a.code_appareil, a]) || []);

      return travaux
        .filter(t => !planifiesIds.has(t.id))
        .map(t => {
          const asc = ascMap.get(t.code_appareil);
          const joursRestants = t.date_butoir 
            ? differenceInDays(parseISO(t.date_butoir), new Date())
            : null;
          return {
            ...t,
            adresse: asc?.adresse,
            ville: asc?.ville,
            secteur: asc?.secteur,
            joursRestants,
          };
        })
        .sort((a, b) => {
          // Urgents d'abord, puis par date butoir
          const prioriteOrder = { urgente: 0, haute: 1, normale: 2, basse: 3 };
          const pA = prioriteOrder[a.priorite as keyof typeof prioriteOrder] ?? 2;
          const pB = prioriteOrder[b.priorite as keyof typeof prioriteOrder] ?? 2;
          if (pA !== pB) return pA - pB;
          if (a.joursRestants !== null && b.joursRestants !== null) {
            return a.joursRestants - b.joursRestants;
          }
          return 0;
        });
    },
  });

  const { data: techniciens } = useQuery({
    queryKey: ['techniciens-planning'],
    queryFn: async () => {
      const { data } = await supabase
        .from('techniciens')
        .select('id, prenom, nom')
        .eq('actif', true);
      return data || [];
    },
  });

  const prioriteConfig: Record<string, { label: string; color: string; bg: string }> = {
    urgente: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-500/10' },
    haute: { label: 'Haute', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    normale: { label: 'Normale', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    basse: { label: 'Basse', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Travaux à planifier
          </h3>
        </div>
        <Badge variant="blue">{travauxNonPlanifies?.length || 0}</Badge>
      </div>

      {/* Sélecteur de date rapide */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm flex-1"
        />
        <div className="flex gap-1">
          {['Aujourd\'hui', 'Demain', 'Semaine'].map((label, idx) => (
            <button
              key={label}
              onClick={() => {
                const d = new Date();
                if (idx === 1) d.setDate(d.getDate() + 1);
                if (idx === 2) d.setDate(d.getDate() + 7);
                setSelectedDate(format(d, 'yyyy-MM-dd'));
              }}
              className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] rounded"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des travaux */}
      {!travauxNonPlanifies || travauxNonPlanifies.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" />
          <p>Tous les travaux sont planifiés</p>
        </div>
      ) : (
        <div className="space-y-2">
          {travauxNonPlanifies.map(travaux => {
            const prio = prioriteConfig[travaux.priorite] || prioriteConfig.normale;
            const urgent = travaux.joursRestants !== null && travaux.joursRestants <= 3;

            return (
              <div
                key={travaux.id}
                className={`p-3 rounded-xl border ${prio.bg} border-[var(--border-primary)] ${urgent ? 'ring-2 ring-red-500/50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-purple-400">{travaux.code}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${prio.bg} ${prio.color}`}>
                        {prio.label}
                      </span>
                      {travaux.joursRestants !== null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          travaux.joursRestants <= 0 ? 'bg-red-500/20 text-red-400' :
                          travaux.joursRestants <= 3 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                        }`}>
                          {travaux.joursRestants <= 0 ? 'En retard!' : `J-${travaux.joursRestants}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{travaux.titre}</p>
                    {travaux.code_appareil && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        <span className="font-mono">{travaux.code_appareil}</span>
                        {travaux.adresse && ` - ${travaux.adresse}, ${travaux.ville}`}
                      </p>
                    )}
                    {travaux.technicien && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {travaux.technicien.prenom} {travaux.technicien.nom}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    {onPlanifier && (
                      <button
                        onClick={() => onPlanifier(
                          travaux, 
                          selectedDate, 
                          travaux.technicien_id || ''
                        )}
                        className="flex items-center gap-1 px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 text-xs"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        Planifier
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Widget compact
export function TravauxAPlanifierWidget({ onRemove }: { onRemove?: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ['travaux-a-planifier-widget'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code, titre, priorite, date_butoir')
        .in('statut', ['planifie', 'en_cours']);

      const { data: events } = await supabase
        .from('planning_events')
        .select('travaux_id')
        .not('travaux_id', 'is', null);

      const planifiesIds = new Set(events?.map(e => e.travaux_id) || []);
      const nonPlanifies = travaux?.filter(t => !planifiesIds.has(t.id)) || [];

      const urgents = nonPlanifies.filter(t => 
        t.priorite === 'urgente' || t.priorite === 'haute'
      ).length;

      const enRetard = nonPlanifies.filter(t => {
        if (!t.date_butoir) return false;
        return differenceInDays(parseISO(t.date_butoir), new Date()) < 0;
      }).length;

      return {
        total: nonPlanifies.length,
        urgents,
        enRetard,
        travaux: nonPlanifies.slice(0, 5),
      };
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">À planifier</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-blue-500/10 rounded-lg">
            <p className="text-lg font-bold text-blue-400">{stats?.total || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Total</p>
          </div>
          <div className="text-center p-2 bg-orange-500/10 rounded-lg">
            <p className="text-lg font-bold text-orange-400">{stats?.urgents || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Urgents</p>
          </div>
          <div className="text-center p-2 bg-red-500/10 rounded-lg">
            <p className="text-lg font-bold text-red-400">{stats?.enRetard || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)]">En retard</p>
          </div>
        </div>

        {stats?.travaux && stats.travaux.length > 0 && (
          <div className="space-y-1">
            {stats.travaux.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs p-1.5 bg-[var(--bg-tertiary)] rounded">
                <span className="font-mono text-purple-400">{t.code}</span>
                <span className={`font-bold ${
                  t.priorite === 'urgente' ? 'text-red-400' : 
                  t.priorite === 'haute' ? 'text-orange-400' : 'text-[var(--text-muted)]'
                }`}>
                  {t.priorite.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}


// =============================================
// EXPORTS
// =============================================

export {
  // Types
  type RisqueAppareil,
  type TravauxProximite,
  type AlerteStock,
  type TravauxAPlanifier,
};
