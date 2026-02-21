import { useState } from 'react';
import {
  Wrench,
  Camera,
  FileText,
  AlertTriangle,
  Package,
  Clock,
  CheckCircle,
  Phone,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ActionsRapidesNFCProps {
  ascenseur: {
    code_appareil: string;
    adresse: string;
  };
  onActionComplete: () => void;
}

const ACTIONS_RAPIDES = [
  {
    id: 'visite',
    label: 'Visite maintenance',
    description: 'Enregistrer une visite d\'entretien',
    icon: CheckCircle,
    color: '#22c55e',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'depannage',
    label: 'Dépannage',
    description: 'Signaler et démarrer un dépannage',
    icon: Wrench,
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'photo',
    label: 'Prendre photo',
    description: 'Ajouter une photo à la fiche',
    icon: Camera,
    color: '#3b82f6',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'rapport',
    label: 'Créer rapport',
    description: 'Rédiger un rapport d\'intervention',
    icon: FileText,
    color: '#8b5cf6',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'signaler',
    label: 'Signaler problème',
    description: 'Remonter un dysfonctionnement',
    icon: AlertTriangle,
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
  },
  {
    id: 'stock',
    label: 'Besoin pièce',
    description: 'Demander une pièce détachée',
    icon: Package,
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/10',
  },
  {
    id: 'pointage',
    label: 'Pointer arrivée/départ',
    description: 'Enregistrer le temps de travail',
    icon: Clock,
    color: '#14b8a6',
    bgColor: 'bg-teal-500/10',
  },
  {
    id: 'appel',
    label: 'Appeler syndic',
    description: 'Contacter le gestionnaire',
    icon: Phone,
    color: '#ec4899',
    bgColor: 'bg-pink-500/10',
  },
];

export function ActionsRapidesNFC({ ascenseur, onActionComplete }: ActionsRapidesNFCProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (actionId: string) => {
    setLoading(actionId);
    
    // Simuler un traitement
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setLoading(null);
    onActionComplete();
  };

  return (
    <div>
      <div className="mb-3">
        <Badge variant="blue">{ascenseur.code_appareil}</Badge>
        <span className="text-xs text-[var(--text-tertiary)] ml-2">{ascenseur.adresse}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS_RAPIDES.map((action) => {
          const Icon = action.icon;
          const isLoading = loading === action.id;

          return (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={isLoading}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border border-[var(--border-primary)] transition-all text-left',
                'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-primary)]',
                'disabled:opacity-50 disabled:cursor-wait',
                action.bgColor
              )}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${action.color}20` }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: action.color }} />
                ) : (
                  <Icon className="w-4 h-4" style={{ color: action.color }} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {action.label}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                  {action.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
