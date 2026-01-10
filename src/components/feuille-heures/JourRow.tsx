import { useState } from 'react';
import {
  Home,
  MapPin,
  Coffee,
  LogOut,
  ClipboardList,
  Plus,
  X,
} from 'lucide-react';
import { Button, TimeInput, Input, Select, IconButton, Badge } from '@/components/ui';
import { cn, isToday } from '@/lib/utils';
import type { Jour, Tache, TypeJour, JourConfig } from '@/types';
import { TYPES_JOUR_LABELS } from '@/types';

interface JourRowProps {
  jour: Jour;
  config: JourConfig;
  taches: Tache[];
  onUpdateJour: (data: Partial<Jour>) => void;
  onAddTache: () => void;
  onUpdateTache: (tacheId: string, data: Partial<Tache>) => void;
  onDeleteTache: (tacheId: string) => void;
  isLoading?: boolean;
}

export function JourRow({
  jour,
  config,
  taches,
  onUpdateJour,
  onAddTache,
  onUpdateTache,
  onDeleteTache,
  isLoading,
}: JourRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isTravail = jour.type_jour === 'travail';
  const estAujourdhui = isToday(jour.date);

  const handleTypeChange = (value: string) => {
    onUpdateJour({ type_jour: value as TypeJour });
  };

  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden transition-all',
        estAujourdhui && 'border-blue-500 shadow-lg shadow-blue-500/20',
        !isTravail && 'opacity-60'
      )}
    >
      {/* En-tête du jour */}
      <div className="flex items-center gap-5 p-4 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-primary)]">
        {/* Date */}
        <div className="flex items-center gap-4 min-w-[180px]">
          <div className="w-14 h-14 bg-[var(--bg-tertiary)] rounded-xl flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {new Date(jour.date).getDate()}
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase">
              {config.nomCourt}
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{config.nom}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Base {config.heuresRef}h</div>
          </div>
        </div>

        {/* Type de jour */}
        <Select
          value={jour.type_jour}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-32"
        >
          {Object.entries(TYPES_JOUR_LABELS).map(([key, { label, emoji }]) => (
            <option key={key} value={key}>
              {emoji} {label}
            </option>
          ))}
        </Select>

        {/* Horaires */}
        <div className="flex items-center gap-3 flex-1">
          {/* Départ domicile */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Home className="w-4 h-4 text-green-400" />
            </div>
            <TimeInput
              value={jour.heure_depart || ''}
              onChange={(e) => onUpdateJour({ heure_depart: e.target.value })}
              disabled={!isTravail || isLoading}
              className="w-20"
            />
          </div>

          {/* Arrivée chantier */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-400" />
            </div>
            <TimeInput
              value={jour.heure_arrivee || ''}
              onChange={(e) => onUpdateJour({ heure_arrivee: e.target.value })}
              disabled={!isTravail || isLoading}
              className="w-20"
            />
            <Input
              value={jour.lieu_arrivee || ''}
              onChange={(e) => onUpdateJour({ lieu_arrivee: e.target.value })}
              disabled={!isTravail || isLoading}
              placeholder="Lieu"
              className="w-28 text-xs"
            />
          </div>

          {/* Pause */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-amber-400" />
            </div>
            <TimeInput
              value={jour.duree_pause?.slice(0, 5) || '01:00'}
              onChange={(e) => onUpdateJour({ duree_pause: e.target.value + ':00' })}
              disabled={!isTravail || isLoading}
              className="w-20"
            />
          </div>

          {/* Fin */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-orange-400" />
            </div>
            <TimeInput
              value={jour.heure_fin || ''}
              onChange={(e) => onUpdateJour({ heure_fin: e.target.value })}
              disabled={!isTravail || isLoading}
              className="w-20"
            />
          </div>

          {/* Retour domicile */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Home className="w-4 h-4 text-purple-400" />
            </div>
            <TimeInput
              value={jour.heure_retour || ''}
              onChange={(e) => onUpdateJour({ heure_retour: e.target.value })}
              disabled={!isTravail || isLoading}
              className="w-20"
            />
          </div>
        </div>

        {/* Totaux du jour */}
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-[var(--bg-tertiary)] rounded-lg min-w-[70px]">
            <div className="text-lg font-bold text-blue-400 font-mono">
              {jour.heures_travail?.toFixed(1) || '0.0'}h
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Travail</div>
          </div>
          <div className="text-center px-4 py-2 bg-[var(--bg-tertiary)] rounded-lg min-w-[70px]">
            <div className="text-lg font-bold text-purple-400 font-mono">
              {jour.heures_trajet?.toFixed(1) || '0.0'}h
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] uppercase">Trajet</div>
          </div>
          <div className="text-center px-4 py-2 bg-[var(--bg-tertiary)] rounded-lg min-w-[70px]">
            <div className="text-lg font-bold text-green-400 font-mono">
              {jour.heures_rtt?.toFixed(1) || '0.0'}h
            </div>
            <div className="text-[9px] text-[var(--text-tertiary)] uppercase">RTT</div>
          </div>
        </div>
      </div>

      {/* Tâches du jour */}
      {isTravail && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-xs font-semibold">
              <ClipboardList className="w-4 h-4" />
              Tâches du jour ({taches.length})
            </div>
            <button
              onClick={onAddTache}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--text-tertiary)] border border-dashed border-dark-500 rounded-lg hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>

          {taches.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)] text-sm">
              Aucune tâche — Cliquez sur "Ajouter" pour en créer une
            </div>
          ) : (
            <div className="space-y-2">
              {taches.map((tache) => (
                <div
                  key={tache.id}
                  className="grid grid-cols-[100px_1fr_90px_90px_40px] gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg items-center hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <Select
                    value={tache.periode}
                    onChange={(e) => onUpdateTache(tache.id, { periode: e.target.value as 'matin' | 'apres-midi' })}
                    className="text-xs"
                  >
                    <option value="matin">Matin</option>
                    <option value="apres-midi">Après-midi</option>
                  </Select>
                  <Input
                    value={tache.description}
                    onChange={(e) => onUpdateTache(tache.id, { description: e.target.value })}
                    placeholder="Description de la tâche..."
                    className="text-xs"
                  />
                  <Input
                    value={tache.duree?.slice(0, 5) || ''}
                    onChange={(e) => onUpdateTache(tache.id, { duree: e.target.value + ':00' })}
                    placeholder="Durée"
                    className="text-xs text-center font-mono"
                  />
                  <Input
                    value={tache.temps_trajet?.slice(0, 5) || ''}
                    onChange={(e) => onUpdateTache(tache.id, { temps_trajet: e.target.value + ':00' })}
                    placeholder="Trajet"
                    className="text-xs text-center font-mono"
                  />
                  <IconButton
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteTache(tache.id)}
                  >
                    <X className="w-4 h-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
