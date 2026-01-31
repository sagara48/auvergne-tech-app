// src/components/integrations/synergiesAvancees.tsx
// Synergies avancées entre modules

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Phone, Clock, User, MapPin, AlertTriangle, Calendar,
  Truck, Package, Route, CheckCircle2, XCircle, ArrowRight,
  Zap, Target, TrendingUp, FileText, Wrench, Navigation,
  Timer, Users, BarChart3, Activity, Bell, Settings,
  ChevronRight, Plus, Eye, Building2, Car
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays, differenceInHours, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';


// =============================================
// 1. ASTREINTES ↔ PANNES
// Assigne automatiquement le technicien d'astreinte aux nouvelles pannes
// =============================================

interface TechnicienAstreinte {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  date_debut: string;
  date_fin: string;
}

export function AstreintesPannes() {
  const { data: astreinteActuelle, isLoading: loadingAstreinte } = useQuery({
    queryKey: ['astreinte-actuelle'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('planning_astreintes')
        .select(`
          *,
          technicien:techniciens(id, prenom, nom, telephone)
        `)
        .lte('date_debut', now)
        .gte('date_fin', now)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: pannesSansAssignation } = useQuery({
    queryKey: ['pannes-sans-assignation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_pannes')
        .select(`
          *,
          ascenseur:parc_ascenseurs!code_appareil(adresse, ville, secteur)
        `)
        .is('date_fin_panne', null)
        .is('technicien_id', null)
        .order('date_appel', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const queryClient = useQueryClient();

  const assignerMutation = useMutation({
    mutationFn: async ({ panneId, technicienId }: { panneId: string; technicienId: string }) => {
      const { error } = await supabase
        .from('parc_pannes')
        .update({ technicien_id: technicienId })
        .eq('id', panneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pannes'] });
      toast.success('Technicien assigné');
    },
  });

  return (
    <div className="space-y-4">
      {/* Technicien d'astreinte actuel */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Astreinte en cours</h3>
        </div>
        
        {loadingAstreinte ? (
          <div className="animate-pulse h-12 bg-[var(--bg-tertiary)] rounded" />
        ) : astreinteActuelle ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg text-amber-400">
                {astreinteActuelle.technicien?.prenom} {astreinteActuelle.technicien?.nom}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {astreinteActuelle.technicien?.telephone}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Jusqu'au {format(parseISO(astreinteActuelle.date_fin), 'EEEE d MMMM HH:mm', { locale: fr })}
              </p>
            </div>
            <a 
              href={`tel:${astreinteActuelle.technicien?.telephone}`}
              className="p-3 bg-amber-500 hover:bg-amber-600 rounded-xl text-white"
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        ) : (
          <p className="text-[var(--text-muted)]">Aucune astreinte définie actuellement</p>
        )}
      </div>

      {/* Pannes sans assignation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Pannes sans technicien
          </h3>
          <Badge variant={pannesSansAssignation && pannesSansAssignation.length > 0 ? 'red' : 'green'}>
            {pannesSansAssignation?.length || 0}
          </Badge>
        </div>

        {!pannesSansAssignation || pannesSansAssignation.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)]">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" />
            <p>Toutes les pannes ont un technicien assigné</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pannesSansAssignation.map((panne: any) => (
              <div key={panne.id} className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-bold text-[var(--text-primary)]">{panne.code_appareil}</p>
                    <p className="text-sm text-[var(--text-muted)]">{panne.motif_panne}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {panne.ascenseur?.adresse}, {panne.ascenseur?.ville}
                    </p>
                    <p className="text-xs text-red-400 mt-1">
                      Depuis {format(parseISO(panne.date_appel), 'HH:mm', { locale: fr })} 
                      ({differenceInHours(new Date(), parseISO(panne.date_appel))}h)
                    </p>
                  </div>
                  {astreinteActuelle && (
                    <button
                      onClick={() => assignerMutation.mutate({ 
                        panneId: panne.id, 
                        technicienId: astreinteActuelle.technicien?.id 
                      })}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      Assigner
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// =============================================
// 2. CHARGE DE TRAVAIL TECHNICIENS
// Vue consolidée de la charge par technicien
// =============================================

interface ChargeTechnicien {
  technicien: {
    id: string;
    prenom: string;
    nom: string;
  };
  travauxEnCours: number;
  travauxUrgents: number;
  interventions7jours: number;
  heuresSemaine: number;
  secteurs: number[];
  disponible: boolean;
}

export function ChargeTravailTechniciens() {
  const { data: charges, isLoading } = useQuery({
    queryKey: ['charge-travail-techniciens'],
    queryFn: async () => {
      // Techniciens actifs
      const { data: techniciens } = await supabase
        .from('techniciens')
        .select('id, prenom, nom')
        .eq('actif', true);

      if (!techniciens) return [];

      // Travaux en cours
      const { data: travaux } = await supabase
        .from('travaux')
        .select('technicien_id, priorite')
        .in('statut', ['planifie', 'en_cours']);

      // Interventions récentes
      const weekStart = startOfWeek(new Date(), { locale: fr });
      const { data: interventions } = await supabase
        .from('interventions_rapides')
        .select('technicien_id')
        .gte('date_intervention', weekStart.toISOString());

      // Absences
      const now = new Date().toISOString();
      const { data: absences } = await supabase
        .from('planning_conges')
        .select('technicien_id')
        .lte('date_debut', now)
        .gte('date_fin', now);

      const absentsIds = new Set(absences?.map(a => a.technicien_id) || []);

      // Secteurs par technicien
      const { data: secteurs } = await supabase
        .from('user_secteurs')
        .select('user_id, secteur');

      const secteursMap = new Map<string, number[]>();
      secteurs?.forEach(s => {
        const existing = secteursMap.get(s.user_id) || [];
        existing.push(s.secteur);
        secteursMap.set(s.user_id, existing);
      });

      // Calcul des charges
      return techniciens.map(tech => {
        const mesTravaux = travaux?.filter(t => t.technicien_id === tech.id) || [];
        const mesInterventions = interventions?.filter(i => i.technicien_id === tech.id) || [];

        return {
          technicien: tech,
          travauxEnCours: mesTravaux.length,
          travauxUrgents: mesTravaux.filter(t => t.priorite === 'urgente' || t.priorite === 'haute').length,
          interventions7jours: mesInterventions.length,
          heuresSemaine: 0, // À calculer depuis feuille_heures
          secteurs: secteursMap.get(tech.id) || [],
          disponible: !absentsIds.has(tech.id),
        };
      }).sort((a, b) => b.travauxEnCours - a.travauxEnCours);
    },
    refetchInterval: 2 * 60 * 1000,
  });

  const getChargeColor = (charge: ChargeTechnicien) => {
    if (!charge.disponible) return 'bg-gray-500/10 border-gray-500/30';
    if (charge.travauxUrgents > 0) return 'bg-red-500/10 border-red-500/30';
    if (charge.travauxEnCours >= 5) return 'bg-orange-500/10 border-orange-500/30';
    if (charge.travauxEnCours >= 3) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-green-500/10 border-green-500/30';
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
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-[var(--text-primary)]">Charge de travail équipe</h3>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-lg bg-green-500/10 text-center">
          <p className="text-lg font-bold text-green-400">
            {charges?.filter(c => c.disponible && c.travauxEnCours < 3).length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Disponibles</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-500/10 text-center">
          <p className="text-lg font-bold text-amber-400">
            {charges?.filter(c => c.disponible && c.travauxEnCours >= 3 && c.travauxEnCours < 5).length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Chargés</p>
        </div>
        <div className="p-2 rounded-lg bg-red-500/10 text-center">
          <p className="text-lg font-bold text-red-400">
            {charges?.filter(c => c.disponible && c.travauxEnCours >= 5).length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Surchargés</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-500/10 text-center">
          <p className="text-lg font-bold text-gray-400">
            {charges?.filter(c => !c.disponible).length || 0}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Absents</p>
        </div>
      </div>

      {/* Liste techniciens */}
      <div className="space-y-2">
        {charges?.map(charge => (
          <div key={charge.technicien.id} className={`p-3 rounded-xl border ${getChargeColor(charge)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                  charge.disponible ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {charge.technicien.prenom[0]}{charge.technicien.nom[0]}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {charge.technicien.prenom} {charge.technicien.nom}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {!charge.disponible && <Badge variant="gray">Absent</Badge>}
                    {charge.secteurs.length > 0 && (
                      <span>Secteurs: {charge.secteurs.map(s => `S${s}`).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className={`text-lg font-bold ${
                    charge.travauxEnCours >= 5 ? 'text-red-400' : 
                    charge.travauxEnCours >= 3 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {charge.travauxEnCours}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">travaux</p>
                </div>
                {charge.travauxUrgents > 0 && (
                  <Badge variant="red">{charge.travauxUrgents} urgent{charge.travauxUrgents > 1 ? 's' : ''}</Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// =============================================
// 3. COMMANDES ↔ STOCK ↔ TRAVAUX BLOQUÉS
// Chaîne d'approvisionnement complète
// =============================================

interface ChaineAppro {
  article: {
    id: string;
    designation: string;
    reference: string;
    quantite_stock: number;
  };
  travauxBloques: {
    id: string;
    code: string;
    titre: string;
    code_appareil: string;
  }[];
  commandeEnCours?: {
    id: string;
    code: string;
    statut: string;
    quantite: number;
    date_prevue: string;
  };
}

export function ChaineApprovisionnement() {
  const { data: chaines, isLoading } = useQuery({
    queryKey: ['chaine-approvisionnement'],
    queryFn: async () => {
      // Articles en rupture ou stock bas
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, designation, reference, quantite_stock, seuil_alerte');

      const articlesEnAlerte = articles?.filter(a => 
        a.quantite_stock <= (a.seuil_alerte || 5)
      ) || [];

      if (articlesEnAlerte.length === 0) return [];

      // Travaux avec pièces manquantes
      const { data: travaux } = await supabase
        .from('travaux')
        .select('id, code, titre, code_appareil, pieces')
        .in('statut', ['planifie', 'en_cours'])
        .not('pieces', 'is', null);

      // Commandes en cours
      const { data: commandes } = await supabase
        .from('commandes')
        .select('id, code, statut, date_livraison_prevue, lignes')
        .in('statut', ['en_attente', 'commandee', 'en_transit']);

      // Construire la chaîne
      const chaines: ChaineAppro[] = articlesEnAlerte.map(article => {
        // Travaux qui ont besoin de cette pièce
        const travauxBloques = (travaux || []).filter(t => {
          const pieces = t.pieces as any[];
          return pieces?.some(p => 
            p.article_id === article.id || 
            p.designation?.toLowerCase().includes(article.designation?.toLowerCase()?.substring(0, 15))
          );
        }).map(t => ({
          id: t.id,
          code: t.code,
          titre: t.titre,
          code_appareil: t.code_appareil,
        }));

        // Commande en cours pour cet article
        const commandeEnCours = commandes?.find(c => {
          const lignes = c.lignes as any[];
          return lignes?.some(l => l.article_id === article.id);
        });

        return {
          article: {
            id: article.id,
            designation: article.designation,
            reference: article.reference,
            quantite_stock: article.quantite_stock,
          },
          travauxBloques,
          commandeEnCours: commandeEnCours ? {
            id: commandeEnCours.id,
            code: commandeEnCours.code,
            statut: commandeEnCours.statut,
            quantite: (commandeEnCours.lignes as any[])?.find(l => l.article_id === article.id)?.quantite || 0,
            date_prevue: commandeEnCours.date_livraison_prevue,
          } : undefined,
        };
      }).filter(c => c.travauxBloques.length > 0 || c.article.quantite_stock === 0);

      return chaines.sort((a, b) => b.travauxBloques.length - a.travauxBloques.length);
    },
  });

  const statutCommande: Record<string, { label: string; color: string }> = {
    en_attente: { label: 'En attente', color: 'text-gray-400' },
    commandee: { label: 'Commandée', color: 'text-blue-400' },
    en_transit: { label: 'En transit', color: 'text-amber-400' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Chaîne d'approvisionnement</h3>
        </div>
        <Badge variant={chaines && chaines.length > 0 ? 'orange' : 'green'}>
          {chaines?.length || 0} blocages
        </Badge>
      </div>

      {!chaines || chaines.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-green-400" />
          <p>Aucun blocage d'approvisionnement</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chaines.map(chaine => (
            <div key={chaine.article.id} className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              {/* Article */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{chaine.article.designation}</p>
                  {chaine.article.reference && (
                    <p className="text-xs font-mono text-[var(--text-muted)]">Réf: {chaine.article.reference}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-lg font-bold ${
                  chaine.article.quantite_stock === 0 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  Stock: {chaine.article.quantite_stock}
                </div>
              </div>

              {/* Flux visuel */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 p-2 bg-red-500/10 rounded text-center">
                  <Package className="w-4 h-4 mx-auto mb-1 text-red-400" />
                  <p className="text-red-400 font-semibold">{chaine.article.quantite_stock}</p>
                  <p className="text-[var(--text-muted)]">En stock</p>
                </div>

                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />

                <div className="flex-1 p-2 bg-orange-500/10 rounded text-center">
                  <Wrench className="w-4 h-4 mx-auto mb-1 text-orange-400" />
                  <p className="text-orange-400 font-semibold">{chaine.travauxBloques.length}</p>
                  <p className="text-[var(--text-muted)]">Travaux</p>
                </div>

                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />

                <div className={`flex-1 p-2 rounded text-center ${
                  chaine.commandeEnCours ? 'bg-blue-500/10' : 'bg-gray-500/10'
                }`}>
                  <Truck className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  {chaine.commandeEnCours ? (
                    <>
                      <p className="text-blue-400 font-semibold">+{chaine.commandeEnCours.quantite}</p>
                      <p className={statutCommande[chaine.commandeEnCours.statut]?.color || ''}>
                        {statutCommande[chaine.commandeEnCours.statut]?.label}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400 font-semibold">-</p>
                      <p className="text-[var(--text-muted)]">Aucune cmd</p>
                    </>
                  )}
                </div>
              </div>

              {/* Travaux bloqués */}
              {chaine.travauxBloques.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                  <p className="text-[10px] text-[var(--text-muted)] mb-2">Travaux en attente:</p>
                  <div className="flex flex-wrap gap-1">
                    {chaine.travauxBloques.slice(0, 5).map(t => (
                      <span key={t.id} className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                        {t.code} ({t.code_appareil})
                      </span>
                    ))}
                    {chaine.travauxBloques.length > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                        +{chaine.travauxBloques.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// =============================================
// 4. HISTORIQUE INTERVENTION ↔ KILOMÉTRAGE VÉHICULE
// Suivi automatique des kilomètres par intervention
// =============================================

export function SuiviKilometrage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['suivi-kilometrage'],
    queryFn: async () => {
      // Récupérer les véhicules avec techniciens
      const { data: vehicules } = await supabase
        .from('vehicules')
        .select(`
          *,
          technicien:techniciens(id, prenom, nom)
        `)
        .not('technicien_id', 'is', null);

      if (!vehicules) return [];

      // Calculer les stats par véhicule
      const weekStart = startOfWeek(new Date(), { locale: fr });
      const weekEnd = endOfWeek(new Date(), { locale: fr });

      const { data: interventions } = await supabase
        .from('interventions_rapides')
        .select('technicien_id, km_parcourus')
        .gte('date_intervention', weekStart.toISOString())
        .lte('date_intervention', weekEnd.toISOString())
        .not('km_parcourus', 'is', null);

      return vehicules.map(v => {
        const kmSemaine = interventions
          ?.filter(i => i.technicien_id === v.technicien_id)
          .reduce((sum, i) => sum + (i.km_parcourus || 0), 0) || 0;

        const prochainEntretien = v.prochain_entretien_km 
          ? v.prochain_entretien_km - v.kilometrage
          : null;

        return {
          vehicule: v,
          kmSemaine,
          prochainEntretien,
          alerteEntretien: prochainEntretien !== null && prochainEntretien < 500,
        };
      }).sort((a, b) => b.kmSemaine - a.kmSemaine);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Car className="w-5 h-5 text-green-400" />
        <h3 className="font-semibold text-[var(--text-primary)]">Suivi kilométrage véhicules</h3>
      </div>

      <div className="space-y-2">
        {stats?.map(({ vehicule, kmSemaine, prochainEntretien, alerteEntretien }) => (
          <div 
            key={vehicule.id} 
            className={`p-3 rounded-xl border ${
              alerteEntretien ? 'bg-red-500/10 border-red-500/30' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Car className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{vehicule.immatriculation}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {vehicule.technicien?.prenom} {vehicule.technicien?.nom}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {vehicule.kilometrage?.toLocaleString()} km
                </p>
                <p className="text-xs text-green-400">
                  +{kmSemaine} km cette semaine
                </p>
              </div>
            </div>

            {alerteEntretien && (
              <div className="mt-2 pt-2 border-t border-red-500/30 flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Entretien dans {prochainEntretien} km</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// =============================================
// 5. NOTES CROISÉES
// Recherche de notes liées à un ascenseur/travaux/intervention
// =============================================

export function NotesContextuelles({ 
  codeAppareil,
  travauxId,
  limit = 5 
}: { 
  codeAppareil?: string;
  travauxId?: string;
  limit?: number;
}) {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes-contextuelles', codeAppareil, travauxId],
    queryFn: async () => {
      let query = supabase
        .from('notes')
        .select('*, technicien:techniciens(prenom, nom)')
        .eq('partage', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (codeAppareil) {
        query = query.or(`code_ascenseur.eq.${codeAppareil},contenu.ilike.%${codeAppareil}%,titre.ilike.%${codeAppareil}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!codeAppareil || !!travauxId,
  });

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-[var(--bg-tertiary)] rounded-xl" />;
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="text-center py-4 text-[var(--text-muted)] text-sm">
        <FileText className="w-6 h-6 mx-auto mb-1 opacity-30" />
        <p>Aucune note liée</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map(note => (
        <div key={note.id} className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">{note.titre}</p>
              <p className="text-xs text-[var(--text-muted)] line-clamp-2">{note.contenu}</p>
            </div>
            <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
              {format(parseISO(note.created_at), 'd MMM', { locale: fr })}
            </span>
          </div>
          {note.technicien && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
              Par {note.technicien.prenom} {note.technicien.nom}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}


// =============================================
// WIDGETS DASHBOARD
// =============================================

export function AstreintePannesWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({
    queryKey: ['astreinte-pannes-widget'],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const [{ data: astreinte }, { data: pannes }] = await Promise.all([
        supabase
          .from('planning_astreintes')
          .select('technicien:techniciens(prenom, nom, telephone)')
          .lte('date_debut', now)
          .gte('date_fin', now)
          .maybeSingle(),
        supabase
          .from('parc_pannes')
          .select('id')
          .is('date_fin_panne', null)
          .is('technicien_id', null),
      ]);

      return {
        technicien: astreinte?.technicien,
        pannesSansAssignation: pannes?.length || 0,
      };
    },
    refetchInterval: 60000,
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm">Astreinte</span>
        </div>

        {data?.technicien ? (
          <div className="space-y-2">
            <p className="text-lg font-bold text-amber-400">
              {data.technicien.prenom} {data.technicien.nom}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{data.technicien.telephone}</p>
            {data.pannesSansAssignation > 0 && (
              <Badge variant="red">{data.pannesSansAssignation} panne(s) à assigner</Badge>
            )}
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">Pas d'astreinte</p>
        )}
      </CardBody>
    </Card>
  );
}

export function ChargeTechWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({
    queryKey: ['charge-tech-widget'],
    queryFn: async () => {
      const { data: travaux } = await supabase
        .from('travaux')
        .select('technicien_id, priorite')
        .in('statut', ['planifie', 'en_cours']);

      const parTech: Record<string, { total: number; urgents: number }> = {};
      travaux?.forEach(t => {
        if (!t.technicien_id) return;
        if (!parTech[t.technicien_id]) parTech[t.technicien_id] = { total: 0, urgents: 0 };
        parTech[t.technicien_id].total++;
        if (t.priorite === 'urgente' || t.priorite === 'haute') {
          parTech[t.technicien_id].urgents++;
        }
      });

      const values = Object.values(parTech);
      return {
        surcharges: values.filter(v => v.total >= 5).length,
        charges: values.filter(v => v.total >= 3 && v.total < 5).length,
        disponibles: values.filter(v => v.total < 3).length,
      };
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">Charge équipe</span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="p-1.5 bg-green-500/10 rounded">
            <p className="text-lg font-bold text-green-400">{data?.disponibles || 0}</p>
            <p className="text-[9px] text-[var(--text-muted)]">Dispo</p>
          </div>
          <div className="p-1.5 bg-amber-500/10 rounded">
            <p className="text-lg font-bold text-amber-400">{data?.charges || 0}</p>
            <p className="text-[9px] text-[var(--text-muted)]">Chargé</p>
          </div>
          <div className="p-1.5 bg-red-500/10 rounded">
            <p className="text-lg font-bold text-red-400">{data?.surcharges || 0}</p>
            <p className="text-[9px] text-[var(--text-muted)]">Surch.</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function ChaineApproWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({
    queryKey: ['chaine-appro-widget'],
    queryFn: async () => {
      const { data: articles } = await supabase
        .from('stock_articles')
        .select('id, quantite_stock, seuil_alerte');

      const ruptures = articles?.filter(a => a.quantite_stock === 0).length || 0;
      const alertes = articles?.filter(a => 
        a.quantite_stock > 0 && a.quantite_stock <= (a.seuil_alerte || 5)
      ).length || 0;

      const { data: commandes } = await supabase
        .from('commandes')
        .select('id')
        .in('statut', ['en_attente', 'commandee', 'en_transit']);

      return {
        ruptures,
        alertes,
        commandesEnCours: commandes?.length || 0,
      };
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-sm">Appro</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Ruptures</span>
            <Badge variant="red">{data?.ruptures || 0}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Alertes</span>
            <Badge variant="orange">{data?.alertes || 0}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Commandes</span>
            <Badge variant="blue">{data?.commandesEnCours || 0}</Badge>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
