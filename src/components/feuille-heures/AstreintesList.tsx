import { Moon, Plus, X, Clock, Car, MapPin, AlertCircle } from 'lucide-react';
import { Button, Input, Select, IconButton, Badge, Card, CardHeader, CardBody } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Astreinte, TypeAstreinte, AstreinteFormData } from '@/types';
import { TYPES_ASTREINTE_LABELS } from '@/types';

interface AstreintesListProps {
  astreintes: Astreinte[];
  onAdd: () => void;
  onUpdate: (astreinteId: string, data: Partial<AstreinteFormData>) => void;
  onDelete: (astreinteId: string) => void;
  isLoading?: boolean;
}

function getComptage(type: TypeAstreinte): 'rtt' | 'paye' {
  return type === 'samedi_jour' ? 'rtt' : 'paye';
}

const TYPE_COLORS: Record<TypeAstreinte, string> = {
  samedi_jour: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  samedi_nuit: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  dimanche_jour: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  dimanche_nuit: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400',
  nuit_semaine: 'bg-pink-500/20 border-pink-500/40 text-pink-400',
};

export function AstreintesList({
  astreintes,
  onAdd,
  onUpdate,
  onDelete,
  isLoading,
}: AstreintesListProps) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)]/30 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
            <Moon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Astreintes</h3>
            <p className="text-xs text-[var(--text-muted)]">Interventions hors horaires</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Règles */}
      <div className="px-4 py-3 bg-gradient-to-r from-pink-500/5 to-purple-500/5 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-pink-400" />
          <span className="text-[var(--text-muted)]">
            <span className="text-pink-400 font-semibold">Règles de comptage :</span>
            {' '}Samedi jour → <span className="text-emerald-400">RTT</span>
            {' • '}Samedi nuit / Dimanche / Nuit semaine → <span className="text-pink-400">Payé</span>
          </span>
        </div>
      </div>

      {/* Liste */}
      <div className="p-4">
        {astreintes.length === 0 ? (
          <div className="text-center py-10">
            <Moon className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
            <p className="text-[var(--text-muted)] text-sm">Aucune astreinte cette semaine</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">Cliquez sur "Ajouter" pour enregistrer une intervention</p>
          </div>
        ) : (
          <div className="space-y-3">
            {astreintes.map((astreinte) => {
              const comptage = getComptage(astreinte.type_astreinte);
              return (
                <div
                  key={astreinte.id}
                  className="group bg-[var(--bg-tertiary)]/50 rounded-xl p-4 border border-[var(--border-primary)] hover:border-pink-500/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Type d'astreinte */}
                    <select
                      value={astreinte.type_astreinte}
                      onChange={(e) => onUpdate(astreinte.id, { type_astreinte: e.target.value as TypeAstreinte })}
                      disabled={isLoading}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium border appearance-none cursor-pointer min-w-[140px]',
                        TYPE_COLORS[astreinte.type_astreinte]
                      )}
                    >
                      {Object.entries(TYPES_ASTREINTE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>

                    {/* Heure de départ */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Départ</div>
                        <input
                          type="time"
                          value={astreinte.heure_depart || ''}
                          onChange={(e) => onUpdate(astreinte.id, { heure_depart: e.target.value })}
                          disabled={isLoading}
                          className="w-[90px] px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs font-mono text-center"
                        />
                      </div>
                    </div>

                    {/* Temps trajet */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Car className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Trajet</div>
                        <input
                          type="time"
                          value={astreinte.temps_trajet?.slice(0, 5) || ''}
                          onChange={(e) => onUpdate(astreinte.id, { temps_trajet: e.target.value + ':00' })}
                          disabled={isLoading}
                          className="w-[90px] px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs font-mono text-center"
                        />
                      </div>
                    </div>

                    {/* Temps sur site */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Sur site</div>
                        <input
                          type="time"
                          value={astreinte.temps_site?.slice(0, 5) || ''}
                          onChange={(e) => onUpdate(astreinte.id, { temps_site: e.target.value + ':00' })}
                          disabled={isLoading}
                          className="w-[90px] px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs font-mono text-center"
                        />
                      </div>
                    </div>

                    {/* Motif */}
                    <div className="flex-1">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Motif d'intervention</div>
                      <input
                        type="text"
                        value={astreinte.motif || ''}
                        onChange={(e) => onUpdate(astreinte.id, { motif: e.target.value })}
                        disabled={isLoading}
                        placeholder="Description de l'intervention..."
                        className="w-full px-3 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs"
                      />
                    </div>

                    {/* Comptage */}
                    <div className={cn(
                      'px-3 py-2 rounded-lg text-xs font-bold',
                      comptage === 'rtt' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-pink-500/20 text-pink-400'
                    )}>
                      {comptage === 'rtt' ? '→ RTT' : '→ Payé'}
                    </div>

                    {/* Supprimer */}
                    <button
                      onClick={() => onDelete(astreinte.id)}
                      disabled={isLoading}
                      className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
