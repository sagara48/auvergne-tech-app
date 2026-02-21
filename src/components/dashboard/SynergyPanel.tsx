import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, ChevronRight, ChevronDown, ChevronUp, Package, Hammer, Calendar, Car,
  Building2, Truck, Clock, MessageCircle, FileCheck, FolderOpen, StickyNote,
  AlertTriangle, Palmtree, TrendingDown, Link2, Bell,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import {
  getTravaux, getStockGlobal, getVehicules, getCommandes,
  getAscenseurs, getTravauxEnAttentePieces, getMiseEnServices,
  getDashboardStats, getPlanningEvents, getTechniciens,
} from '@/services/api';
import { cn } from '@/lib/utils';
import { format, addDays, isWithinInterval, parseISO, differenceInDays } from 'date-fns';
import { supabase } from '@/services/supabase';

interface Synergie {
  id: string;
  urgence: 'haute' | 'moyenne' | 'basse';
  titre: string;
  description: string;
  action: string;
  modulesConcernes: { id: string; label: string }[];
  actionModule: string;
  icon: any;
  details?: string[];
}

const URGENCE_COLORS = {
  haute: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500', badge: 'red' as const },
  moyenne: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500', badge: 'amber' as const },
  basse: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500', badge: 'blue' as const },
};

// Fetch congés
async function getConges() {
  try {
    const { data } = await supabase.from('planning_conges').select('*, technicien:technicien_id(prenom, nom)').gte('date_fin', new Date().toISOString());
    return data || [];
  } catch { return []; }
}

export function SynergyPanel() {
  const { setModuleActif } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [expandedSyn, setExpandedSyn] = useState<string | null>(null);

  // Queries cross-modules
  const { data: travaux } = useQuery({ queryKey: ['travaux'], queryFn: () => getTravaux() });
  const { data: stockGlobal } = useQuery({ queryKey: ['stock-global'], queryFn: () => getStockGlobal() });
  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: () => getVehicules() });
  const { data: commandes } = useQuery({ queryKey: ['commandes'], queryFn: () => getCommandes() });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: () => getAscenseurs() });
  const { data: travauxAttente } = useQuery({ queryKey: ['travaux-attente-pieces'], queryFn: () => getTravauxEnAttentePieces() });
  const { data: mesList } = useQuery({ queryKey: ['mes'], queryFn: () => getMiseEnServices() });
  const { data: techniciens } = useQuery({ queryKey: ['techniciens'], queryFn: getTechniciens });
  const { data: conges } = useQuery({ queryKey: ['conges-synergy'], queryFn: getConges });

  const now = new Date();
  const synergies: Synergie[] = [];

  // ═══ SYNERGIE 1: Stock ↔ Travaux ↔ Commandes ═══
  if (travauxAttente && travauxAttente.length > 0) {
    const enTransit = (commandes || []).filter((c: any) => ['commandee', 'expediee'].includes(c.statut));
    synergies.push({
      id: 'stock-travaux-chaine',
      urgence: 'haute',
      icon: Package,
      titre: `${travauxAttente.length} travaux bloqués — pièces manquantes`,
      description: enTransit.length > 0
        ? `${enTransit.length} commande(s) en transit pourraient débloquer des travaux. Vérifiez les correspondances.`
        : `Aucune commande en cours ne couvre ces besoins. Passez commande ou lancez un transfert.`,
      action: 'Gérer le stock',
      modulesConcernes: [
        { id: 'stock', label: 'Stock' },
        { id: 'travaux', label: 'Travaux' },
        { id: 'commandes', label: 'Commandes' },
      ],
      actionModule: 'stock',
      details: travauxAttente.slice(0, 4).map((t: any) => `${t.code || 'T-???'} — ${t.designation_piece || t.titre || 'Pièce manquante'}`),
    });
  }

  // ═══ SYNERGIE 2: Planning ↔ Stock véhicule ↔ Tournées (Pré-check départ) ═══
  if (stockGlobal) {
    const critiques = (stockGlobal as any[]).filter((s: any) => s.quantite !== undefined && s.quantite_min !== undefined && s.quantite <= s.quantite_min);
    if (critiques.length > 0) {
      const ruptures = critiques.filter((c: any) => c.quantite === 0);
      synergies.push({
        id: 'precheck-stock',
        urgence: ruptures.length > 0 ? 'haute' : 'moyenne',
        icon: AlertTriangle,
        titre: `Pré-check : ${critiques.length} articles critiques (${ruptures.length} ruptures)`,
        description: `Vérifiez avant de partir que votre véhicule contient les pièces nécessaires pour vos interventions du jour.`,
        action: 'Voir le stock',
        modulesConcernes: [
          { id: 'stock', label: 'Stock' },
          { id: 'planning', label: 'Planning' },
        ],
        actionModule: 'stock',
        details: critiques.slice(0, 5).map((c: any) => `${c.designation || c.article?.designation || '?'} — ${c.quantite}/${c.quantite_min} (${c.quantite === 0 ? '🔴 RUPTURE' : '⚠️ bas'})`),
      });
    }
  }

  // ═══ SYNERGIE 3: Ascenseurs ↔ Travaux ↔ Prédictif (pannes récurrentes) ═══
  if (ascenseurs && travaux) {
    // Compter les pannes par ascenseur sur les 6 derniers mois
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    const pannesParAsc: Record<string, { code: string; count: number; adresse: string }> = {};
    (travaux as any[]).forEach((t: any) => {
      if (t.ascenseur_id && t.type === 'depannage' && t.date_creation > sixMonthsAgo) {
        if (!pannesParAsc[t.ascenseur_id]) {
          const asc = (ascenseurs as any[]).find((a: any) => a.id === t.ascenseur_id);
          pannesParAsc[t.ascenseur_id] = { code: asc?.code_appareil || t.code, count: 0, adresse: asc?.adresse || '' };
        }
        pannesParAsc[t.ascenseur_id].count++;
      }
    });
    const recurrents = Object.values(pannesParAsc).filter(p => p.count >= 3).sort((a, b) => b.count - a.count);
    if (recurrents.length > 0) {
      synergies.push({
        id: 'pannes-recurrentes',
        urgence: 'haute',
        icon: TrendingDown,
        titre: `${recurrents.length} ascenseur(s) — pannes récurrentes détectées`,
        description: `Des ascenseurs cumulent 3+ dépannages en 6 mois. Envisagez un remplacement préventif des composants défaillants.`,
        action: 'Voir le parc',
        modulesConcernes: [
          { id: 'ascenseurs', label: 'Ascenseurs' },
          { id: 'travaux', label: 'Travaux' },
        ],
        actionModule: 'ascenseurs',
        details: recurrents.slice(0, 4).map(r => `${r.code} — ${r.count} dépannages (${r.adresse})`),
      });
    }
  }

  // ═══ SYNERGIE 5: Véhicules ↔ Planning (échéances CT/entretien) ═══
  if (vehicules) {
    const alertes: string[] = [];
    (vehicules as any[]).forEach((v: any) => {
      if (v.date_prochain_ct) {
        const dj = differenceInDays(new Date(v.date_prochain_ct), now);
        if (dj >= 0 && dj <= 30) alertes.push(`CT ${v.immatriculation} dans ${dj}j (${format(new Date(v.date_prochain_ct), 'dd/MM')})`);
      }
      if (v.km_prochain_entretien && v.km_actuel) {
        const kmRestants = v.km_prochain_entretien - v.km_actuel;
        if (kmRestants > 0 && kmRestants <= 2000) alertes.push(`Vidange ${v.immatriculation} dans ~${kmRestants} km`);
      }
    });
    if (alertes.length > 0) {
      synergies.push({
        id: 'vehicule-echeances',
        urgence: alertes.some(a => a.includes('dans 0j') || a.includes('dans 1j')) ? 'haute' : 'moyenne',
        icon: Car,
        titre: `${alertes.length} échéance(s) véhicule proche(s)`,
        description: `Planifiez les entretiens et contrôles techniques pour éviter les immobilisations.`,
        action: 'Voir véhicules',
        modulesConcernes: [
          { id: 'vehicules', label: 'Véhicules' },
          { id: 'planning', label: 'Planning' },
        ],
        actionModule: 'vehicules',
        details: alertes.slice(0, 4),
      });
    }
  }

  // ═══ SYNERGIE 6: MES ↔ GED ↔ Commandes (dossier MES complet) ═══
  if (mesList) {
    const mesEnCours = (mesList as any[]).filter((m: any) => !['terminee', 'annulee'].includes(m.statut));
    const mesAvecReserves = mesEnCours.filter((m: any) => m.nb_reserves > 0 || m.statut === 'en_attente_documents');
    if (mesEnCours.length > 0) {
      synergies.push({
        id: 'mes-completude',
        urgence: mesAvecReserves.length > 0 ? 'moyenne' : 'basse',
        icon: FileCheck,
        titre: `${mesEnCours.length} MES en cours${mesAvecReserves.length > 0 ? ` (${mesAvecReserves.length} avec réserves)` : ''}`,
        description: `Vérifiez que les documents bureau de contrôle, PV d'essais et photos sont bien uploadés avant de passer à l'étape suivante.`,
        action: 'Voir les MES',
        modulesConcernes: [
          { id: 'miseservice', label: 'MES' },
          { id: 'ged', label: 'Documents' },
        ],
        actionModule: 'miseservice',
        details: mesEnCours.slice(0, 3).map((m: any) => `${m.code} — ${m.adresse || '?'} — étape ${m.etape_actuelle || '?'}/${m.nb_etapes || '7'}`),
      });
    }
  }

  // ═══ SYNERGIE 7: Demandes ↔ Planning ↔ Heures (congés vs charge) ═══
  if (conges && conges.length > 0 && techniciens) {
    const congesProches = conges.filter((c: any) => {
      const dj = differenceInDays(new Date(c.date_debut), now);
      return dj >= 0 && dj <= 14;
    });
    if (congesProches.length > 0) {
      synergies.push({
        id: 'conges-planning',
        urgence: 'moyenne',
        icon: Palmtree,
        titre: `${congesProches.length} congé(s) dans les 14 prochains jours`,
        description: `Vérifiez que les interventions planifiées sont réassignées et que la charge est équilibrée dans l'équipe.`,
        action: 'Voir planning',
        modulesConcernes: [
          { id: 'demandes', label: 'Demandes' },
          { id: 'planning', label: 'Planning' },
          { id: 'heures', label: 'Heures' },
        ],
        actionModule: 'planning',
        details: congesProches.slice(0, 3).map((c: any) =>
          `${c.technicien?.prenom || '?'} ${c.technicien?.nom?.charAt(0) || ''} — du ${format(new Date(c.date_debut), 'dd/MM')} au ${format(new Date(c.date_fin), 'dd/MM')} (${c.type || 'congé'})`
        ),
      });
    }
  }

  // ═══ SYNERGIE 8: Notes ↔ Tout (notes contextuelles récentes) ═══
  // On détecte si des notes récentes sont liées à des ascenseurs en panne ou des travaux bloqués
  if (ascenseurs) {
    const enPanne = (ascenseurs as any[]).filter((a: any) => a.statut === 'en_panne');
    if (enPanne.length > 0) {
      synergies.push({
        id: 'notes-contexte',
        urgence: enPanne.length >= 3 ? 'haute' : 'moyenne',
        icon: Building2,
        titre: `${enPanne.length} ascenseur(s) en panne`,
        description: `Consultez les notes et l'historique de ces ascenseurs pour préparer les interventions. Pensez à laisser un retour pour l'équipe.`,
        action: 'Voir le parc',
        modulesConcernes: [
          { id: 'ascenseurs', label: 'Ascenseurs' },
          { id: 'notes', label: 'Notes' },
          { id: 'travaux', label: 'Travaux' },
        ],
        actionModule: 'ascenseurs',
        details: enPanne.slice(0, 4).map((a: any) => `${a.code_appareil} — ${a.adresse || '?'} ${a.ville || ''}`),
      });
    }
  }

  // ═══ SYNERGIE 9: Chat ↔ Travaux ↔ Stock (messages contextuels) ═══
  if (commandes) {
    const enTransit = (commandes as any[]).filter((c: any) => c.statut === 'expediee');
    if (enTransit.length > 0) {
      synergies.push({
        id: 'commandes-reception',
        urgence: 'basse',
        icon: Truck,
        titre: `${enTransit.length} commande(s) en livraison`,
        description: `Préparez la réception et informez l'équipe via le chat. Affectez les pièces aux travaux en attente dès réception.`,
        action: 'Voir commandes',
        modulesConcernes: [
          { id: 'commandes', label: 'Commandes' },
          { id: 'chat', label: 'Chat' },
          { id: 'stock', label: 'Stock' },
        ],
        actionModule: 'commandes',
        details: enTransit.slice(0, 3).map((c: any) => `${c.code || 'CMD-?'} — ${c.fournisseur || '?'} — ${c.nb_lignes || '?'} articles`),
      });
    }
  }

  // ═══ SYNERGIE 11: Tournées ↔ Stock ↔ Ascenseurs (pré-chargement) ═══
  if (stockGlobal) {
    const ruptures = (stockGlobal as any[]).filter((s: any) => s.quantite === 0 && s.quantite_min > 0);
    if (ruptures.length >= 3) {
      synergies.push({
        id: 'tournee-precheck',
        urgence: 'moyenne',
        icon: Truck,
        titre: `Pré-check tournée — ${ruptures.length} ruptures de stock`,
        description: `Plusieurs pièces courantes sont en rupture. Vérifiez les besoins avant les prochaines tournées d'entretien.`,
        action: 'Voir tournées',
        modulesConcernes: [
          { id: 'tournees', label: 'Tournées' },
          { id: 'stock', label: 'Stock' },
        ],
        actionModule: 'tournees',
        details: ruptures.slice(0, 3).map((r: any) => `${r.designation || r.article?.designation || '?'} — RUPTURE`),
      });
    }
  }

  // ═══ SYNERGIE 12: GED ↔ MES ↔ Ascenseurs (complétude documentaire) ═══
  if (mesList) {
    const mesEnCours = (mesList as any[]).filter((m: any) => !['terminee', 'annulee'].includes(m.statut));
    const sansDocuments = mesEnCours.filter((m: any) => !m.nb_documents || m.nb_documents < 3);
    if (sansDocuments.length > 0) {
      synergies.push({
        id: 'mes-completude-docs',
        urgence: sansDocuments.length >= 3 ? 'haute' : 'moyenne',
        icon: FolderOpen,
        titre: `${sansDocuments.length} MES — documents incomplets`,
        description: `Des mises en service n'ont pas tous les documents obligatoires (CE, PV, bureau de contrôle). Uploadez-les avant de passer à l'étape suivante.`,
        action: 'Voir GED',
        modulesConcernes: [
          { id: 'miseservice', label: 'MES' },
          { id: 'ged', label: 'Documents' },
          { id: 'ascenseurs', label: 'Ascenseurs' },
        ],
        actionModule: 'ged',
        details: sansDocuments.slice(0, 3).map((m: any) => `${m.code} — ${m.adresse || '?'} — ${m.nb_documents || 0} docs`),
      });
    }
  }

  // Tri par urgence
  const urgenceOrder = { haute: 0, moyenne: 1, basse: 2 };
  synergies.sort((a, b) => urgenceOrder[a.urgence] - urgenceOrder[b.urgence]);

  const nbUrgentes = synergies.filter(s => s.urgence === 'haute').length;
  const nbMoyennes = synergies.filter(s => s.urgence === 'moyenne').length;

  if (synergies.length === 0) return null;

  return (
    <Card className="overflow-hidden mb-4">
      {/* Header cliquable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)] bg-gradient-to-r from-amber-500/5 to-orange-500/5 hover:from-amber-500/8 hover:to-orange-500/8 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">Synergies intelligentes</span>
          <div className="flex gap-1.5 ml-1">
            {nbUrgentes > 0 && <Badge variant="red">{nbUrgentes} urgente{nbUrgentes > 1 ? 's' : ''}</Badge>}
            {nbMoyennes > 0 && <Badge variant="amber">{nbMoyennes} attention</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">{synergies.length} alerte{synergies.length > 1 ? 's' : ''}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
        </div>
      </button>

      {/* Liste des synergies */}
      {expanded && (
        <div className="divide-y divide-[var(--border-secondary)]">
          {synergies.map((syn) => {
            const colors = URGENCE_COLORS[syn.urgence];
            const Icon = syn.icon;
            const isExpanded = expandedSyn === syn.id;

            return (
              <div key={syn.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                <div
                  className="flex items-start gap-3 px-5 py-3 cursor-pointer"
                  onClick={() => setExpandedSyn(isExpanded ? null : syn.id)}
                >
                  {/* Icon */}
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", colors.bg)}>
                    <Icon className={cn("w-4 h-4", colors.text)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={colors.badge} className="text-[10px]">{syn.urgence}</Badge>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{syn.titre}</span>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] leading-relaxed">{syn.description}</div>

                    {/* Modules concernés */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Link2 className="w-3 h-3 text-[var(--text-muted)]" />
                      {syn.modulesConcernes.map((mod) => (
                        <button
                          key={mod.id}
                          onClick={(e) => { e.stopPropagation(); setModuleActif(mod.id); }}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          {mod.label}
                        </button>
                      ))}
                    </div>

                    {/* Détails expandables */}
                    {isExpanded && syn.details && syn.details.length > 0 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                        {syn.details.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 text-xs text-[var(--text-secondary)]">
                            <div className={cn("w-1 h-1 rounded-full flex-shrink-0", colors.dot)} />
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setModuleActif(syn.actionModule); }}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0",
                      colors.bg, colors.border, 'border', colors.text, 'hover:opacity-80'
                    )}
                  >
                    {syn.action}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default SynergyPanel;
