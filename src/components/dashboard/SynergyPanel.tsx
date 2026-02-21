import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  AlertTriangle,
  ChevronRight,
  Package,
  Hammer,
  Calendar,
  Car,
  Building2,
  TrendingUp,
  Clock,
  Truck,
  RefreshCw,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { useAppStore } from '@/stores/appStore';
import {
  getTravaux,
  getStockArticles,
  getVehicules,
  getCommandes,
  getStockGlobal,
  getAscenseurs,
  getTravauxEnAttentePieces,
} from '@/services/api';
import { cn } from '@/lib/utils';

interface Synergie {
  id: string;
  type: string;
  urgence: 'haute' | 'moyenne' | 'basse';
  titre: string;
  description: string;
  action: string;
  modulesConcernes: string[];
  actionModule: string;
}

// Couleurs par urgence
const URGENCE_COLORS = {
  haute: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
  moyenne: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  basse: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
};

// Icônes par module
const MODULE_ICONS: Record<string, any> = {
  stock: Package,
  travaux: Hammer,
  planning: Calendar,
  vehicules: Car,
  ascenseurs: Building2,
  commandes: Truck,
};

export function SynergyPanel() {
  const { setModuleActif } = useAppStore();

  // Fetch des données cross-modules
  const { data: travaux } = useQuery({ queryKey: ['travaux'], queryFn: () => getTravaux() });
  const { data: stockArticles } = useQuery({ queryKey: ['stock-articles'], queryFn: () => getStockArticles() });
  const { data: stockGlobal } = useQuery({ queryKey: ['stock-global'], queryFn: () => getStockGlobal() });
  const { data: vehicules } = useQuery({ queryKey: ['vehicules'], queryFn: () => getVehicules() });
  const { data: commandes } = useQuery({ queryKey: ['commandes'], queryFn: () => getCommandes() });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: () => getAscenseurs() });
  const { data: travauxEnAttente } = useQuery({ queryKey: ['travaux-attente-pieces'], queryFn: () => getTravauxEnAttentePieces() });

  // Calcul dynamique des synergies
  const synergies: Synergie[] = [];

  // 1. Stock ↔ Travaux : travaux bloqués par rupture stock
  if (travauxEnAttente && travauxEnAttente.length > 0) {
    synergies.push({
      id: 'stock-travaux-bloque',
      type: 'stock-travaux',
      urgence: 'haute',
      titre: `${travauxEnAttente.length} travaux en attente de pièces`,
      description: `Des travaux sont bloqués en attente de pièces. Vérifiez les commandes en cours et les transferts disponibles.`,
      action: 'Voir les travaux',
      modulesConcernes: ['stock', 'travaux', 'commandes'],
      actionModule: 'travaux',
    });
  }

  // 2. Stock critique : articles sous seuil
  if (stockGlobal) {
    const critiques = (stockGlobal as any[]).filter(
      (s: any) => s.quantite !== undefined && s.quantite_min !== undefined && s.quantite <= s.quantite_min
    );
    if (critiques.length > 0) {
      synergies.push({
        id: 'stock-critique',
        type: 'stock-commandes',
        urgence: critiques.some((c: any) => c.quantite === 0) ? 'haute' : 'moyenne',
        titre: `${critiques.length} articles en stock critique`,
        description: `${critiques.filter((c: any) => c.quantite === 0).length} rupture(s) de stock. Passez commande ou demandez un transfert.`,
        action: 'Voir le stock',
        modulesConcernes: ['stock', 'commandes'],
        actionModule: 'stock',
      });
    }
  }

  // 3. Véhicules : entretien proche
  if (vehicules) {
    const now = Date.now();
    const vehiculesUrgents = (vehicules as any[]).filter((v: any) => {
      if (!v.date_prochain_ct) return false;
      const dj = Math.round((new Date(v.date_prochain_ct).getTime() - now) / 86400000);
      return dj >= 0 && dj <= 30;
    });
    if (vehiculesUrgents.length > 0) {
      const plusProche = vehiculesUrgents.reduce((min: any, v: any) => {
        const dj = Math.round((new Date(v.date_prochain_ct).getTime() - now) / 86400000);
        return dj < min.dj ? { v, dj } : min;
      }, { v: null, dj: 999 });
      synergies.push({
        id: 'vehicule-ct',
        type: 'vehicule-planning',
        urgence: plusProche.dj <= 14 ? 'haute' : 'moyenne',
        titre: `CT véhicule dans ${plusProche.dj} jours`,
        description: `${plusProche.v?.immatriculation || 'Véhicule'} — contrôle technique le ${new Date(plusProche.v?.date_prochain_ct).toLocaleDateString('fr-FR')}. Planifiez un créneau.`,
        action: 'Voir véhicules',
        modulesConcernes: ['vehicules', 'planning'],
        actionModule: 'vehicules',
      });
    }
  }

  // 4. Ascenseurs : pannes récurrentes (si données dispo)
  if (ascenseurs) {
    const enPanne = (ascenseurs as any[]).filter((a: any) => a.statut === 'en_panne');
    if (enPanne.length > 0) {
      synergies.push({
        id: 'ascenseur-pannes',
        type: 'ascenseur-travaux',
        urgence: 'haute',
        titre: `${enPanne.length} ascenseur(s) en panne`,
        description: `Des ascenseurs nécessitent une intervention urgente. Vérifiez la disponibilité des pièces et planifiez.`,
        action: 'Voir le parc',
        modulesConcernes: ['ascenseurs', 'travaux'],
        actionModule: 'ascenseurs',
      });
    }
  }

  // 5. Commandes en transit
  if (commandes) {
    const enTransit = (commandes as any[]).filter(
      (c: any) => c.statut === 'commandee' || c.statut === 'expediee'
    );
    if (enTransit.length > 0) {
      synergies.push({
        id: 'commandes-transit',
        type: 'commandes-stock',
        urgence: 'basse',
        titre: `${enTransit.length} commande(s) en transit`,
        description: `Des commandes sont en cours d'acheminement. Préparez la réception pour alimenter le stock.`,
        action: 'Voir commandes',
        modulesConcernes: ['commandes', 'stock'],
        actionModule: 'commandes',
      });
    }
  }

  // Tri par urgence
  const urgenceOrder = { haute: 0, moyenne: 1, basse: 2 };
  synergies.sort((a, b) => urgenceOrder[a.urgence] - urgenceOrder[b.urgence]);

  const nbUrgentes = synergies.filter(s => s.urgence === 'haute').length;

  if (synergies.length === 0) return null;

  return (
    <Card className="overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)] bg-gradient-to-r from-amber-500/5 to-orange-500/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">Synergies intelligentes</span>
          {nbUrgentes > 0 && (
            <Badge variant="red">{nbUrgentes} urgente{nbUrgentes > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">
          {synergies.length} alerte{synergies.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Liste des synergies */}
      <div className="divide-y divide-[var(--border-secondary)]">
        {synergies.map((syn) => {
          const colors = URGENCE_COLORS[syn.urgence];
          return (
            <div
              key={syn.id}
              className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              onClick={() => setModuleActif(syn.actionModule)}
            >
              {/* Dot urgence */}
              <div className={cn("w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0", colors.dot)} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                  {syn.titre}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-2">
                  {syn.description}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {syn.modulesConcernes.map((mod) => (
                    <span
                      key={mod}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModuleActif(syn.actionModule);
                }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0",
                  colors.bg, colors.border, 'border', colors.text,
                  'hover:opacity-80'
                )}
              >
                {syn.action}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default SynergyPanel;
