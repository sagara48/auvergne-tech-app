import { useState } from 'react';
import {
  Home,
  MapPin,
  Coffee,
  LogOut,
  ClipboardList,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Car,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui';
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

// Composant TimeInput stylisé
function TimeField({ 
  value, 
  onChange, 
  disabled, 
  placeholder = "00:00" 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="time"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-[90px] px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm font-mono text-center text-[var(--text-primary)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

// Composant lieu stylisé
function LieuField({ 
  value, 
  onChange, 
  disabled, 
  placeholder = "Lieu" 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-[100px] px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
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
  const typeInfo = TYPES_JOUR_LABELS[jour.type_jour];

  const handleTypeChange = (value: string) => {
    onUpdateJour({ type_jour: value as TypeJour });
  };

  // Calcul du temps de trajet
  const calculateTrajet = (depart: string, arrivee: string) => {
    if (!depart || !arrivee) return null;
    const [dh, dm] = depart.split(':').map(Number);
    const [ah, am] = arrivee.split(':').map(Number);
    const diff = (ah * 60 + am) - (dh * 60 + dm);
    if (diff <= 0) return null;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  };

  const trajetMatin = calculateTrajet(jour.heure_depart || '', jour.heure_arrivee || '');
  const trajetSoir = calculateTrajet(jour.heure_fin || '', jour.heure_retour || '');

  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border rounded-2xl overflow-hidden transition-all duration-200',
        estAujourdhui ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-[var(--border-primary)]',
        !isTravail && 'opacity-70'
      )}
    >
      {/* En-tête du jour */}
      <div className={cn(
        'flex items-center gap-4 p-4',
        isTravail ? 'bg-[var(--bg-tertiary)]/30' : 'bg-[var(--bg-tertiary)]/50'
      )}>
        {/* Date */}
        <div className="flex items-center gap-3 min-w-[140px]">
          <div className={cn(
            'w-14 h-14 rounded-xl flex flex-col items-center justify-center',
            estAujourdhui ? 'bg-blue-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
          )}>
            <span className="text-2xl font-black leading-none">
              {new Date(jour.date).getDate()}
            </span>
            <span className="text-[10px] font-bold uppercase opacity-70">
              {config.nomCourt}
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{config.nom}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {estAujourdhui && <span className="text-blue-400 mr-1">Aujourd'hui •</span>}
              Base {config.heuresRef}h
            </div>
          </div>
        </div>

        {/* Type de jour */}
        <div className="relative">
          <select
            value={jour.type_jour}
            onChange={(e) => handleTypeChange(e.target.value)}
            className={cn(
              'appearance-none pl-8 pr-8 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors',
              jour.type_jour === 'travail' && 'bg-blue-500/20 border-blue-500/40 text-blue-400',
              jour.type_jour === 'conge' && 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
              jour.type_jour === 'rtt' && 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
              jour.type_jour === 'maladie' && 'bg-red-500/20 border-red-500/40 text-red-400',
              jour.type_jour === 'ferie' && 'bg-purple-500/20 border-purple-500/40 text-purple-400',
              jour.type_jour === 'formation' && 'bg-amber-500/20 border-amber-500/40 text-amber-400',
            )}
          >
            {Object.entries(TYPES_JOUR_LABELS).map(([key, { label, emoji }]) => (
              <option key={key} value={key}>
                {emoji} {label}
              </option>
            ))}
          </select>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base pointer-events-none">
            {typeInfo.emoji}
          </span>
        </div>

        {/* Totaux du jour */}
        <div className="flex items-center gap-2 ml-auto">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl',
            isTravail ? 'bg-blue-500/10' : 'bg-[var(--bg-tertiary)]'
          )}>
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-lg font-bold text-blue-400 font-mono">
              {isTravail ? (jour.heures_travail?.toFixed(1) || '0.0') : config.heuresRef.toFixed(1)}h
            </span>
            <span className="text-xs text-[var(--text-muted)]">travail</span>
          </div>
          
          {isTravail && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 rounded-xl">
              <Car className="w-4 h-4 text-purple-400" />
              <span className="text-lg font-bold text-purple-400 font-mono">
                {jour.heures_trajet?.toFixed(1) || '0.0'}h
              </span>
              <span className="text-xs text-[var(--text-muted)]">trajet</span>
            </div>
          )}

          {/* Bouton expand */}
          {isTravail && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Contenu détaillé - uniquement si travail et expanded */}
      {isTravail && isExpanded && (
        <div className="p-4 space-y-4">
          {/* Timeline des horaires */}
          <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Horaires de la journée
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Matin - Départ */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Home className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Départ matin</span>
                </div>
                <div className="flex gap-2">
                  <TimeField
                    value={jour.heure_depart || ''}
                    onChange={(v) => onUpdateJour({ heure_depart: v })}
                    disabled={isLoading}
                  />
                  <LieuField
                    value={jour.lieu_depart || ''}
                    onChange={(v) => onUpdateJour({ lieu_depart: v })}
                    disabled={isLoading}
                    placeholder="Domicile"
                  />
                </div>
              </div>

              {/* Flèche trajet matin */}
              <div className="flex flex-col items-center gap-1 px-2">
                <div className="flex items-center gap-1 text-purple-400">
                  <Car className="w-4 h-4" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                {trajetMatin && (
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {trajetMatin}
                  </span>
                )}
              </div>

              {/* Matin - Arrivée chantier */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Arrivée chantier</span>
                </div>
                <div className="flex gap-2">
                  <TimeField
                    value={jour.heure_arrivee || ''}
                    onChange={(v) => onUpdateJour({ heure_arrivee: v })}
                    disabled={isLoading}
                  />
                  <LieuField
                    value={jour.lieu_arrivee || ''}
                    onChange={(v) => onUpdateJour({ lieu_arrivee: v })}
                    disabled={isLoading}
                    placeholder="Chantier"
                  />
                </div>
              </div>

              {/* Séparateur */}
              <div className="h-16 w-px bg-[var(--border-primary)]" />

              {/* Pause */}
              <div className="w-24">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Coffee className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Pause</span>
                </div>
                <TimeField
                  value={jour.duree_pause?.slice(0, 5) || '01:00'}
                  onChange={(v) => onUpdateJour({ duree_pause: v + ':00' })}
                  disabled={isLoading}
                />
              </div>

              {/* Séparateur */}
              <div className="h-16 w-px bg-[var(--border-primary)]" />

              {/* Soir - Départ chantier */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Fin de journée</span>
                </div>
                <div className="flex gap-2">
                  <TimeField
                    value={jour.heure_fin || ''}
                    onChange={(v) => onUpdateJour({ heure_fin: v })}
                    disabled={isLoading}
                  />
                  <LieuField
                    value={jour.lieu_depart_soir || ''}
                    onChange={(v) => onUpdateJour({ lieu_depart_soir: v })}
                    disabled={isLoading}
                    placeholder="Chantier"
                  />
                </div>
              </div>

              {/* Flèche trajet soir */}
              <div className="flex flex-col items-center gap-1 px-2">
                <div className="flex items-center gap-1 text-purple-400">
                  <Car className="w-4 h-4" />
                  <ArrowRight className="w-4 h-4" />
                </div>
                {trajetSoir && (
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {trajetSoir}
                  </span>
                )}
              </div>

              {/* Soir - Arrivée */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <Home className="w-4 h-4 text-pink-400" />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Retour</span>
                </div>
                <div className="flex gap-2">
                  <TimeField
                    value={jour.heure_retour || ''}
                    onChange={(v) => onUpdateJour({ heure_retour: v })}
                    disabled={isLoading}
                  />
                  <LieuField
                    value={jour.lieu_arrivee_soir || ''}
                    onChange={(v) => onUpdateJour({ lieu_arrivee_soir: v })}
                    disabled={isLoading}
                    placeholder="Domicile"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tâches du jour */}
          <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Tâches du jour
                </span>
                <Badge variant="default" className="text-xs">
                  {taches.length}
                </Badge>
              </div>
              <button
                onClick={onAddTache}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter une tâche
              </button>
            </div>

            {taches.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune tâche pour ce jour</p>
                <p className="text-xs">Cliquez sur "Ajouter une tâche" pour commencer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {taches.map((tache, index) => (
                  <div
                    key={tache.id}
                    className="group flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] hover:border-blue-500/30 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                      {index + 1}
                    </span>
                    
                    <select
                      value={tache.periode}
                      onChange={(e) => onUpdateTache(tache.id, { periode: e.target.value as 'matin' | 'apres-midi' })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer',
                        tache.periode === 'matin' 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      )}
                    >
                      <option value="matin">🌅 Matin</option>
                      <option value="apres-midi">🌆 Après-midi</option>
                    </select>

                    <input
                      value={tache.description}
                      onChange={(e) => onUpdateTache(tache.id, { description: e.target.value })}
                      placeholder="Description de la tâche..."
                      className="flex-1 px-3 py-1.5 bg-transparent border-0 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-tertiary)] rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <input
                          type="time"
                          value={tache.duree?.slice(0, 5) || ''}
                          onChange={(e) => onUpdateTache(tache.id, { duree: e.target.value + ':00' })}
                          className="w-16 bg-transparent text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-tertiary)] rounded-lg">
                        <Car className="w-3.5 h-3.5 text-purple-400" />
                        <input
                          type="time"
                          value={tache.temps_trajet?.slice(0, 5) || ''}
                          onChange={(e) => onUpdateTache(tache.id, { temps_trajet: e.target.value + ':00' })}
                          className="w-16 bg-transparent text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTache(tache.id)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
