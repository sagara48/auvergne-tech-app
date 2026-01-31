// src/components/integrations/synergiesV4.tsx
// Synergies V4: Stock Véhicule ↔ Tournée, Récurrence Pannes ↔ Alertes

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, Truck, AlertTriangle, CheckCircle2, XCircle, MapPin,
  Calendar, Clock, ArrowRight, ChevronRight, RefreshCw, TrendingUp,
  AlertCircle, Activity, Zap, Shield, BarChart3, Repeat, Target,
  Navigation, Box, ClipboardList, CircleAlert, Eye, Send, Check,
  Wrench, Building2, History, Flame, ThermometerSun, User
} from 'lucide-react';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';


// =============================================
// 1. STOCK VÉHICULE ↔ TOURNÉE DU JOUR
// Vérification des pièces avant départ
// =============================================

interface TravailPlanifie {
  id: string;
  code: string;
  titre: string;
  code_appareil: string;
  adresse?: string;
  ville?: string;
  pieces: PieceTravail[];
  priorite: string;
  heure_debut?: string;
}

interface PieceTravail {
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
}

interface ArticleVehicule {
  article_id: string;
  designation: string;
  reference?: string;
  quantite: number;
}

interface PieceManquante {
  article_id: string;
  designation: string;
  reference?: string;
  quantite_requise: number;
  quantite_vehicule: number;
  quantite_manquante: number;
  travaux: { id: string; code: string; titre: string }[];
}

interface VerificationTournee {
  technicien_id: string;
  technicien_nom: string;
  vehicule_id: string;
  vehicule_immat: string;
  date: string;
  travaux_planifies: TravailPlanifie[];
  pieces_manquantes: PieceManquante[];
  stock_vehicule: ArticleVehicule[];
  statut: 'ok' | 'alerte' | 'critique';
}

export function StockVehiculeTournee({ 
  technicienId,
  date = new Date().toISOString().split('T')[0],
  compact = false
}: { 
  technicienId?: string;
  date?: string;
  compact?: boolean;
}) {
  const [selectedTech, setSelectedTech] = useState<string | null>(technicienId || null);
  const queryClient = useQueryClient();

  // Récupérer les techniciens avec véhicule
  const { data: techniciens } = useQuery({
    queryKey: ['techniciens-vehicules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('techniciens')
        .select('id, prenom, nom, vehicule:vehicules!vehicules_technicien_id_fkey(id, immatriculation)')
        .eq('actif', true)
        .not('vehicule', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Vérification complète pour un technicien
  const { data: verification, isLoading, refetch } = useQuery({
    queryKey: ['verification-tournee', selectedTech, date],
    queryFn: async (): Promise<VerificationTournee | null> => {
      if (!selectedTech) return null;

      // Info technicien + véhicule
      const { data: tech } = await supabase
        .from('techniciens')
        .select('id, prenom, nom, vehicule:vehicules!vehicules_technicien_id_fkey(id, immatriculation)')
        .eq('id', selectedTech)
        .single();

      if (!tech?.vehicule?.[0]) return null;

      const vehicule = tech.vehicule[0];

      // Travaux planifiés pour cette date
      const dateDebut = startOfDay(parseISO(date)).toISOString();
      const dateFin = endOfDay(parseISO(date)).toISOString();

      const { data: events } = await supabase
        .from('planning_events')
        .select('travaux_id')
        .eq('technicien_id', selectedTech)
        .gte('date_debut', dateDebut)
        .lte('date_debut', dateFin)
        .not('travaux_id', 'is', null);

      const travauxIds = events?.map(e => e.travaux_id).filter(Boolean) || [];

      // Récupérer les travaux avec pièces
      let travauxPlanifies: TravailPlanifie[] = [];
      if (travauxIds.length > 0) {
        const { data: travaux } = await supabase
          .from('travaux')
          .select('id, code, titre, code_appareil, pieces, priorite')
          .in('id', travauxIds)
          .in('statut', ['planifie', 'en_cours']);

        // Enrichir avec adresses
        for (const t of travaux || []) {
          const { data: asc } = await supabase
            .from('parc_ascenseurs')
            .select('adresse, ville')
            .eq('code_appareil', t.code_appareil)
            .single();

          travauxPlanifies.push({
            ...t,
            adresse: asc?.adresse,
            ville: asc?.ville,
            pieces: (t.pieces as any[]) || [],
          });
        }
      }

      // Stock du véhicule
      const { data: stockVehicule } = await supabase
        .from('stock_vehicule')
        .select('article_id, quantite, article:stock_articles(designation, reference)')
        .eq('vehicule_id', vehicule.id);

      const stockMap = new Map<string, ArticleVehicule>();
      stockVehicule?.forEach(s => {
        stockMap.set(s.article_id, {
          article_id: s.article_id,
          designation: s.article?.designation || '',
          reference: s.article?.reference,
          quantite: s.quantite,
        });
      });

      // Calculer les pièces manquantes
      const besoinsMap = new Map<string, PieceManquante>();

      travauxPlanifies.forEach(t => {
        t.pieces?.forEach(p => {
          if (!p.article_id) return;
          
          const existing = besoinsMap.get(p.article_id);
          if (existing) {
            existing.quantite_requise += p.quantite || 1;
            existing.travaux.push({ id: t.id, code: t.code, titre: t.titre });
          } else {
            const stockVeh = stockMap.get(p.article_id);
            besoinsMap.set(p.article_id, {
              article_id: p.article_id,
              designation: p.designation || stockVeh?.designation || 'Article inconnu',
              reference: p.reference || stockVeh?.reference,
              quantite_requise: p.quantite || 1,
              quantite_vehicule: stockVeh?.quantite || 0,
              quantite_manquante: Math.max(0, (p.quantite || 1) - (stockVeh?.quantite || 0)),
              travaux: [{ id: t.id, code: t.code, titre: t.titre }],
            });
          }
        });
      });

      // Recalculer les manquants
      const piecesManquantes: PieceManquante[] = [];
      besoinsMap.forEach(besoin => {
        const stockVeh = stockMap.get(besoin.article_id);
        besoin.quantite_vehicule = stockVeh?.quantite || 0;
        besoin.quantite_manquante = Math.max(0, besoin.quantite_requise - besoin.quantite_vehicule);
        if (besoin.quantite_manquante > 0) {
          piecesManquantes.push(besoin);
        }
      });

      // Déterminer le statut
      let statut: 'ok' | 'alerte' | 'critique' = 'ok';
      if (piecesManquantes.length > 0) {
        const urgentes = travauxPlanifies.filter(t => 
          t.priorite === 'urgente' && 
          t.pieces?.some(p => piecesManquantes.some(pm => pm.article_id === p.article_id))
        );
        statut = urgentes.length > 0 ? 'critique' : 'alerte';
      }

      return {
        technicien_id: tech.id,
        technicien_nom: `${tech.prenom} ${tech.nom}`,
        vehicule_id: vehicule.id,
        vehicule_immat: vehicule.immatriculation,
        date,
        travaux_planifies: travauxPlanifies,
        pieces_manquantes: piecesManquantes,
        stock_vehicule: Array.from(stockMap.values()),
        statut,
      };
    },
    enabled: !!selectedTech,
  });

  // Mutation pour demander réappro
  const demanderReappro = useMutation({
    mutationFn: async (pieces: PieceManquante[]) => {
      const { error } = await supabase.from('stock_demandes_reappro').insert(
        pieces.map(p => ({
          vehicule_id: verification?.vehicule_id,
          article_id: p.article_id,
          quantite_demandee: p.quantite_manquante,
          motif: `Tournée du ${format(parseISO(date), 'd MMMM', { locale: fr })}`,
          statut: 'en_attente',
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Demande de réapprovisionnement envoyée');
      queryClient.invalidateQueries({ queryKey: ['demandes-reappro'] });
    },
  });

  const statutConfig = {
    ok: { label: 'Prêt', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
    alerte: { label: 'Pièces manquantes', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
    critique: { label: 'Critique', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">Stock Tournée</span>
        </div>
        
        {!selectedTech ? (
          <select
            onChange={e => setSelectedTech(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm"
          >
            <option value="">Sélectionner technicien</option>
            {techniciens?.map(t => (
              <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
            ))}
          </select>
        ) : verification ? (
          <div className="space-y-2">
            <div className={`p-2 rounded-lg ${statutConfig[verification.statut].bg}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{verification.technicien_nom}</span>
                <Badge variant={verification.statut === 'ok' ? 'green' : verification.statut === 'alerte' ? 'amber' : 'red'}>
                  {statutConfig[verification.statut].label}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {verification.travaux_planifies.length} travaux • {verification.pieces_manquantes.length} pièces manquantes
              </p>
            </div>
            {verification.pieces_manquantes.slice(0, 3).map(p => (
              <div key={p.article_id} className="flex items-center justify-between text-xs p-2 bg-[var(--bg-tertiary)] rounded">
                <span className="truncate">{p.designation}</span>
                <Badge variant="red">-{p.quantite_manquante}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--text-muted)] text-sm">Chargement...</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Vérification Stock Tournée</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={() => {}}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-sm"
          />
          <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Sélection technicien */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {techniciens?.map(t => {
          const isSelected = selectedTech === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTech(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected 
                  ? 'bg-blue-500/20 border-blue-500/50' 
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:border-blue-500/30'
              }`}
            >
              <p className="font-medium text-sm">{t.prenom} {t.nom}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.vehicule?.[0]?.immatriculation}</p>
            </button>
          );
        })}
      </div>

      {/* Résultat vérification */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : verification ? (
        <div className="space-y-4">
          {/* Statut global */}
          <div className={`p-4 rounded-xl ${statutConfig[verification.statut].bg}`}>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = statutConfig[verification.statut].icon;
                return <Icon className={`w-8 h-8 ${statutConfig[verification.statut].color}`} />;
              })()}
              <div>
                <p className={`font-bold text-lg ${statutConfig[verification.statut].color}`}>
                  {statutConfig[verification.statut].label}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {verification.travaux_planifies.length} travaux planifiés • {verification.vehicule_immat}
                </p>
              </div>
            </div>
          </div>

          {/* Travaux planifiés */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Travaux du jour ({verification.travaux_planifies.length})
            </h4>
            <div className="space-y-2">
              {verification.travaux_planifies.map(t => {
                const hasMissing = t.pieces?.some(p => 
                  verification.pieces_manquantes.some(pm => pm.article_id === p.article_id)
                );
                return (
                  <div 
                    key={t.id} 
                    className={`p-3 rounded-lg border ${hasMissing ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{t.code}</span>
                          {hasMissing && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{t.titre}</p>
                        <p className="text-xs text-[var(--text-muted)]">{t.adresse}, {t.ville}</p>
                      </div>
                      <Badge variant={t.priorite === 'urgente' ? 'red' : t.priorite === 'haute' ? 'orange' : 'blue'}>
                        {t.priorite}
                      </Badge>
                    </div>
                    {t.pieces && t.pieces.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.pieces.map((p, i) => {
                          const isMissing = verification.pieces_manquantes.some(pm => pm.article_id === p.article_id);
                          return (
                            <span 
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded ${isMissing ? 'bg-red-500/20 text-red-400' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}
                            >
                              {p.designation} x{p.quantite}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pièces manquantes */}
          {verification.pieces_manquantes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium flex items-center gap-2 text-amber-400">
                  <Package className="w-4 h-4" />
                  Pièces à charger ({verification.pieces_manquantes.length})
                </h4>
                <button
                  onClick={() => demanderReappro.mutate(verification.pieces_manquantes)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 text-sm"
                >
                  <Send className="w-4 h-4" />
                  Demander réappro
                </button>
              </div>
              <div className="space-y-2">
                {verification.pieces_manquantes.map(p => (
                  <div key={p.article_id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{p.designation}</p>
                        {p.reference && <p className="text-xs font-mono text-[var(--text-muted)]">{p.reference}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-red-400 font-bold">{p.quantite_vehicule}</span>
                          <span className="text-[var(--text-muted)]"> / {p.quantite_requise} requis</span>
                        </p>
                        <Badge variant="red">Manque {p.quantite_manquante}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      Travaux: {p.travaux.map(t => t.code).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {verification.statut === 'ok' && (
            <div className="text-center py-4 text-green-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
              <p className="font-medium">Tout est prêt pour la tournée !</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sélectionnez un technicien pour vérifier son stock</p>
        </div>
      )}
    </div>
  );
}


// =============================================
// 2. RÉCURRENCE PANNES ↔ ALERTES
// Détecter les ascenseurs problématiques
// =============================================

interface AscenseurRecurrence {
  code_appareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  marque?: string;
  type_machine?: string;
  date_installation?: string;
  pannes_count: number;
  pannes_6_mois: number;
  pannes_3_mois: number;
  derniere_panne?: string;
  motifs_frequents: { motif: string; count: number }[];
  pieces_frequentes: { designation: string; count: number }[];
  score_recurrence: number; // 0-100
  tendance: 'stable' | 'amelioration' | 'degradation';
  alerte_niveau: 'critique' | 'surveiller' | 'normal';
}

export function RecurrencePannes({ 
  seuilAlerte = 3,  // Pannes en 3 mois
  seuilCritique = 5, // Pannes en 3 mois
  compact = false
}: { 
  seuilAlerte?: number;
  seuilCritique?: number;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'critique' | 'surveiller'>('all');
  const [selectedAsc, setSelectedAsc] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recurrence-pannes', seuilAlerte, seuilCritique],
    queryFn: async () => {
      const now = new Date();
      const date3Mois = subMonths(now, 3).toISOString();
      const date6Mois = subMonths(now, 6).toISOString();
      const date12Mois = subMonths(now, 12).toISOString();

      // Toutes les pannes des 12 derniers mois
      const { data: pannes } = await supabase
        .from('parc_pannes')
        .select('code_appareil, date_appel, motif_panne')
        .gte('date_appel', date12Mois)
        .order('date_appel', { ascending: false });

      // Grouper par ascenseur
      const pannesParAsc = new Map<string, any[]>();
      pannes?.forEach(p => {
        const list = pannesParAsc.get(p.code_appareil) || [];
        list.push(p);
        pannesParAsc.set(p.code_appareil, list);
      });

      // Infos ascenseurs
      const codes = Array.from(pannesParAsc.keys());
      const { data: ascenseurs } = await supabase
        .from('parc_ascenseurs')
        .select('code_appareil, adresse, ville, secteur, marque, type_machine, date_installation')
        .in('code_appareil', codes);

      // Pièces remplacées par ascenseur (via travaux)
      const { data: travaux } = await supabase
        .from('travaux')
        .select('code_appareil, pieces')
        .in('code_appareil', codes)
        .eq('statut', 'termine')
        .gte('created_at', date12Mois);

      const piecesParAsc = new Map<string, Map<string, number>>();
      travaux?.forEach(t => {
        const pieces = t.pieces as any[];
        pieces?.forEach(p => {
          if (!p.designation) return;
          const map = piecesParAsc.get(t.code_appareil) || new Map();
          map.set(p.designation, (map.get(p.designation) || 0) + 1);
          piecesParAsc.set(t.code_appareil, map);
        });
      });

      // Construire les données de récurrence
      const resultats: AscenseurRecurrence[] = [];

      ascenseurs?.forEach(asc => {
        const pannesAsc = pannesParAsc.get(asc.code_appareil) || [];
        const pannes3Mois = pannesAsc.filter(p => p.date_appel >= date3Mois).length;
        const pannes6Mois = pannesAsc.filter(p => p.date_appel >= date6Mois).length;

        // Motifs fréquents
        const motifsCount = new Map<string, number>();
        pannesAsc.forEach(p => {
          const motif = p.motif_panne || 'Non spécifié';
          motifsCount.set(motif, (motifsCount.get(motif) || 0) + 1);
        });
        const motifs_frequents = Array.from(motifsCount.entries())
          .map(([motif, count]) => ({ motif, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        // Pièces fréquentes
        const piecesMap = piecesParAsc.get(asc.code_appareil);
        const pieces_frequentes = piecesMap 
          ? Array.from(piecesMap.entries())
              .map(([designation, count]) => ({ designation, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
          : [];

        // Score de récurrence (0-100)
        // Basé sur: pannes 3 mois (50%), pannes 6 mois (30%), total (20%)
        const score_recurrence = Math.min(100, Math.round(
          (pannes3Mois / seuilCritique) * 50 +
          (pannes6Mois / (seuilCritique * 2)) * 30 +
          (pannesAsc.length / 10) * 20
        ));

        // Tendance (comparer 3 derniers mois vs 3-6 mois)
        const pannes3a6Mois = pannesAsc.filter(p => p.date_appel >= date6Mois && p.date_appel < date3Mois).length;
        let tendance: 'stable' | 'amelioration' | 'degradation' = 'stable';
        if (pannes3Mois > pannes3a6Mois + 1) tendance = 'degradation';
        else if (pannes3Mois < pannes3a6Mois - 1) tendance = 'amelioration';

        // Niveau d'alerte
        let alerte_niveau: 'critique' | 'surveiller' | 'normal' = 'normal';
        if (pannes3Mois >= seuilCritique) alerte_niveau = 'critique';
        else if (pannes3Mois >= seuilAlerte) alerte_niveau = 'surveiller';

        resultats.push({
          code_appareil: asc.code_appareil,
          adresse: asc.adresse,
          ville: asc.ville,
          secteur: asc.secteur,
          marque: asc.marque,
          type_machine: asc.type_machine,
          date_installation: asc.date_installation,
          pannes_count: pannesAsc.length,
          pannes_6_mois: pannes6Mois,
          pannes_3_mois: pannes3Mois,
          derniere_panne: pannesAsc[0]?.date_appel,
          motifs_frequents,
          pieces_frequentes,
          score_recurrence,
          tendance,
          alerte_niveau,
        });
      });

      // Trier par score décroissant
      return resultats.sort((a, b) => b.score_recurrence - a.score_recurrence);
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.filter(d => d.alerte_niveau !== 'normal');
    return data.filter(d => d.alerte_niveau === filter);
  }, [data, filter]);

  const stats = useMemo(() => {
    if (!data) return { critique: 0, surveiller: 0, total: 0 };
    return {
      critique: data.filter(d => d.alerte_niveau === 'critique').length,
      surveiller: data.filter(d => d.alerte_niveau === 'surveiller').length,
      total: data.length,
    };
  }, [data]);

  const tendanceConfig = {
    stable: { label: 'Stable', color: 'text-gray-400', icon: Activity },
    amelioration: { label: 'Amélioration', color: 'text-green-400', icon: TrendingUp },
    degradation: { label: 'Dégradation', color: 'text-red-400', icon: Flame },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-red-400" />
          <span className="font-semibold text-sm">Récurrence Pannes</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-red-400">{stats.critique}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Critiques</p>
          </div>
          <div className="p-2 bg-amber-500/10 rounded-lg text-center">
            <p className="text-lg font-bold text-amber-400">{stats.surveiller}</p>
            <p className="text-[10px] text-[var(--text-muted)]">À surveiller</p>
          </div>
        </div>
        <div className="space-y-1 max-h-32 overflow-auto">
          {filtered.slice(0, 3).map(asc => (
            <div key={asc.code_appareil} className={`p-2 rounded text-xs ${asc.alerte_niveau === 'critique' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold">{asc.code_appareil}</span>
                <Badge variant={asc.alerte_niveau === 'critique' ? 'red' : 'amber'}>
                  {asc.pannes_3_mois} pannes/3m
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Récurrence des Pannes</h3>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-red-500/10 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.critique}</p>
          <p className="text-xs text-[var(--text-muted)]">Critiques (≥{seuilCritique}/3m)</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.surveiller}</p>
          <p className="text-xs text-[var(--text-muted)]">À surveiller (≥{seuilAlerte}/3m)</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
          <p className="text-xs text-[var(--text-muted)]">Ascenseurs analysés</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Tous problématiques' },
          { id: 'critique', label: 'Critiques' },
          { id: 'surveiller', label: 'À surveiller' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filter === f.id 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-green-400" />
          <p>Aucun ascenseur avec récurrence anormale</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(asc => {
            const TendanceIcon = tendanceConfig[asc.tendance].icon;
            const isSelected = selectedAsc === asc.code_appareil;

            return (
              <div
                key={asc.code_appareil}
                className={`rounded-xl border transition-all ${
                  asc.alerte_niveau === 'critique' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedAsc(isSelected ? null : asc.code_appareil)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-lg">{asc.code_appareil}</span>
                        <Badge variant={asc.alerte_niveau === 'critique' ? 'red' : 'amber'}>
                          {asc.alerte_niveau === 'critique' ? 'Critique' : 'Surveiller'}
                        </Badge>
                        <div className={`flex items-center gap-1 text-xs ${tendanceConfig[asc.tendance].color}`}>
                          <TendanceIcon className="w-3 h-3" />
                          {tendanceConfig[asc.tendance].label}
                        </div>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{asc.adresse}, {asc.ville}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Secteur {asc.secteur} • {asc.marque} {asc.type_machine}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-400">{asc.pannes_3_mois}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">3 mois</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-amber-400">{asc.pannes_6_mois}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">6 mois</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-[var(--text-secondary)]">{asc.pannes_count}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">Total</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score visuel */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--text-muted)]">Score récurrence</span>
                      <span className={asc.score_recurrence >= 70 ? 'text-red-400' : asc.score_recurrence >= 40 ? 'text-amber-400' : 'text-green-400'}>
                        {asc.score_recurrence}/100
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          asc.score_recurrence >= 70 ? 'bg-red-500' : 
                          asc.score_recurrence >= 40 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${asc.score_recurrence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Détails expandables */}
                {isSelected && (
                  <div className="px-4 pb-4 border-t border-[var(--border-primary)] pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Motifs fréquents */}
                      <div>
                        <h5 className="text-xs font-medium text-[var(--text-muted)] mb-2">Motifs fréquents</h5>
                        <div className="space-y-1">
                          {asc.motifs_frequents.map((m, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="truncate">{m.motif}</span>
                              <Badge variant="gray">{m.count}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Pièces fréquentes */}
                      <div>
                        <h5 className="text-xs font-medium text-[var(--text-muted)] mb-2">Pièces remplacées</h5>
                        <div className="space-y-1">
                          {asc.pieces_frequentes.length > 0 ? (
                            asc.pieces_frequentes.map((p, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="truncate">{p.designation}</span>
                                <Badge variant="blue">{p.count}x</Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[var(--text-muted)]">Aucune donnée</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {asc.derniere_panne && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Dernière panne: {format(parseISO(asc.derniere_panne), 'd MMMM yyyy', { locale: fr })}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 text-sm">
                        Voir fiche complète
                      </button>
                      <button className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-400 text-sm">
                        Créer travaux préventif
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// =============================================
// WIDGETS DASHBOARD
// =============================================

export function StockTourneeWidget({ onRemove }: { onRemove?: () => void }) {
  const { data } = useQuery({
    queryKey: ['stock-tournee-widget'],
    queryFn: async () => {
      // Simplification: compter les techniciens avec pièces manquantes
      // (logique complète dans le composant principal)
      return { alertes: 0, ok: 0 }; // Placeholder
    },
  });

  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">Stock Tournées</span>
        </div>
        <StockVehiculeTournee compact />
      </CardBody>
    </Card>
  );
}

export function RecurrencePannesWidget({ onRemove }: { onRemove?: () => void }) {
  return (
    <Card className="h-full">
      <CardBody className="p-3">
        <RecurrencePannes compact />
      </CardBody>
    </Card>
  );
}
