import { Copy, RotateCcw, Printer, FileText } from 'lucide-react';
import { Card, CardBody, ProgressBar, Button } from '@/components/ui';
import type { Technicien, TotauxSemaine } from '@/types';

interface SidebarResumeProps {
  technicien: Technicien | null;
  totaux: TotauxSemaine;
  annee: number;
  semaine: number;
  onDupliquer?: () => void;
  onReinitialiser?: () => void;
  onImprimer?: () => void;
}

export function SidebarResume({
  technicien,
  totaux,
  annee,
  semaine,
  onDupliquer,
  onReinitialiser,
  onImprimer,
}: SidebarResumeProps) {
  const progressionColor = totaux.progression >= 100 ? 'green' : 'amber';

  return (
    <div className="w-80 flex-shrink-0 space-y-5">
      {/* Profil */}
      <Card>
        <CardBody className="text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-2xl font-bold text-[var(--text-primary)] mb-4">
            {technicien?.avatar_initiales || 'NB'}
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {technicien ? `${technicien.prenom} ${technicien.nom}` : 'Nicolas Bonnet'}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)]">
            {technicien?.role === 'admin' ? 'Administrateur' : 'Technicien ascensoriste'}
          </p>
        </CardBody>
      </Card>

      {/* Résumé */}
      <Card>
        <CardBody>
          <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Résumé semaine
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 text-center">
              <div className="text-2xl font-extrabold text-blue-400 font-mono">
                {totaux.heures_travail.toFixed(1)}h
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">Travail</div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 text-center">
              <div className="text-2xl font-extrabold text-purple-400 font-mono">
                {totaux.heures_trajet.toFixed(1)}h
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">Trajets</div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 text-center">
              <div className="text-2xl font-extrabold text-green-400 font-mono">
                {(totaux.heures_rtt + totaux.heures_astreinte_rtt).toFixed(1)}h
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">RTT</div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 text-center">
              <div className="text-2xl font-extrabold text-pink-400 font-mono">
                {totaux.heures_astreinte_paye.toFixed(1)}h
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">Payées</div>
            </div>
          </div>

          {/* Progression */}
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-secondary)]">Progression</span>
              <span className={`font-bold ${progressionColor === 'green' ? 'text-green-400' : 'text-amber-400'}`}>
                {totaux.progression.toFixed(0)}%
              </span>
            </div>
            <ProgressBar value={totaux.progression} variant={progressionColor} />
            <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2">
              <span>{totaux.heures_travail.toFixed(1)}h</span>
              <span>39h objectif</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Détails */}
      <Card>
        <CardBody>
          <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Détail semaine
          </h4>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-secondary)]">Heures travail</span>
              <span className="text-sm font-bold text-blue-400 font-mono">
                {totaux.heures_travail.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-secondary)]">Heures trajet</span>
              <span className="text-sm font-bold text-purple-400 font-mono">
                {totaux.heures_trajet.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-secondary)]">RTT semaine</span>
              <span className="text-sm font-bold text-green-400 font-mono">
                {totaux.heures_rtt.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-secondary)]">RTT astreinte</span>
              <span className="text-sm font-bold text-green-400 font-mono">
                {totaux.heures_astreinte_rtt.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-secondary)]">Heures payées</span>
              <span className="text-sm font-bold text-pink-400 font-mono">
                {totaux.heures_astreinte_paye.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between py-3 bg-[var(--bg-tertiary)] rounded-lg px-3 -mx-1">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Base 39h</span>
              <span className={`text-sm font-bold font-mono ${progressionColor === 'green' ? 'text-green-400' : 'text-amber-400'}`}>
                {totaux.heures_travail.toFixed(1)} / 39h
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      <Card>
        <CardBody className="space-y-2">
          <button
            onClick={onDupliquer}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Copy className="w-4 h-4" /> Dupliquer semaine
          </button>
          <button
            onClick={onReinitialiser}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </button>
          <button
            onClick={onImprimer}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
