import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, RotateCcw, Printer, FileText, Palmtree, Clock, Settings, X, Save, Lock, Unlock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardBody, ProgressBar, Button, Input } from '@/components/ui';
import { getSoldeConges, updateSoldeConges, verrouillerSoldes, deverrouillerSoldes, getAnneeConges } from '@/services/api';
import type { Technicien, TotauxSemaine } from '@/types';
import toast from 'react-hot-toast';

interface SidebarResumeProps {
  technicien: Technicien | null;
  totaux: TotauxSemaine;
  annee: number;
  semaine: number;
  onDupliquer?: () => void;
  onReinitialiser?: () => void;
  onImprimer?: () => void;
}

const DEMO_TECHNICIEN_ID = '11111111-1111-1111-1111-111111111111';

export function SidebarResume({
  technicien,
  totaux,
  annee,
  semaine,
  onDupliquer,
  onReinitialiser,
  onImprimer,
}: SidebarResumeProps) {
  const queryClient = useQueryClient();
  const progressionColor = totaux.progression >= 100 ? 'green' : 'amber';
  const technicienId = technicien?.id || DEMO_TECHNICIEN_ID;
  const anneeConges = getAnneeConges();
  const isAdmin = technicien?.role === 'admin';

  const [showSoldesModal, setShowSoldesModal] = useState(false);
  const [editForm, setEditForm] = useState({
    conges_initial: 0,
    rtt_initial: 0,
    rtt_acquis: 0,
  });

  // Récupérer les soldes
  const { data: soldes } = useQuery({
    queryKey: ['soldes-conges', technicienId, anneeConges],
    queryFn: () => getSoldeConges(technicienId, anneeConges),
  });

  const isVerrouille = soldes?.verrouille || false;

  // Mutation pour mettre à jour les soldes
  const updateMutation = useMutation({
    mutationFn: (data: any) => updateSoldeConges(technicienId, anneeConges, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldes-conges'] });
      toast.success('Soldes mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  // Mutation pour verrouiller
  const verrouillerMutation = useMutation({
    mutationFn: () => verrouillerSoldes(technicienId, anneeConges, technicienId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldes-conges'] });
      toast.success('Soldes validés et verrouillés');
      setShowSoldesModal(false);
    },
    onError: () => toast.error('Erreur lors du verrouillage'),
  });

  // Mutation pour déverrouiller (admin)
  const deverrouillerMutation = useMutation({
    mutationFn: () => deverrouillerSoldes(technicienId, anneeConges, technicienId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldes-conges'] });
      toast.success('Soldes déverrouillés - Modification autorisée');
    },
    onError: () => toast.error('Erreur lors du déverrouillage'),
  });

  const openSoldesModal = () => {
    if (isVerrouille && !isAdmin) {
      toast.error('Les soldes sont verrouillés. Contactez un administrateur.');
      return;
    }
    setEditForm({
      conges_initial: soldes?.conges_initial || 0,
      rtt_initial: soldes?.rtt_initial || 0,
      rtt_acquis: soldes?.rtt_acquis || 0,
    });
    setShowSoldesModal(true);
  };

  const handleSaveSoldes = () => {
    updateMutation.mutate(editForm);
  };

  const handleValiderEtVerrouiller = () => {
    // D'abord sauvegarder, puis verrouiller
    updateMutation.mutate(editForm, {
      onSuccess: () => {
        verrouillerMutation.mutate();
      }
    });
  };

  const handleDeverrouiller = () => {
    if (confirm('Êtes-vous sûr de vouloir déverrouiller les soldes ? Le technicien pourra les modifier.')) {
      deverrouillerMutation.mutate();
    }
  };

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

      {/* Soldes Congés / RTT */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Soldes congés / RTT
              </h4>
              {isVerrouille && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                  <Lock className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] text-green-400 font-medium">Validé</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Bouton déverrouiller (admin seulement) */}
              {isVerrouille && isAdmin && (
                <button 
                  onClick={handleDeverrouiller}
                  className="p-1.5 hover:bg-amber-500/20 rounded text-amber-400 hover:text-amber-300"
                  title="Déverrouiller (admin)"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              )}
              {/* Bouton modifier (si non verrouillé ou admin) */}
              {(!isVerrouille || isAdmin) && (
                <button 
                  onClick={openSoldesModal}
                  className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  title={isVerrouille ? "Modifier (admin)" : "Modifier les soldes initiaux"}
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Congés */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-4 text-center border border-cyan-500/30">
              <Palmtree className="w-5 h-5 mx-auto text-cyan-400 mb-2" />
              <div className="text-2xl font-extrabold text-cyan-400 font-mono">
                {soldes?.conges_solde?.toFixed(1) || '0'}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">Congés restants</div>
              <div className="text-[9px] text-[var(--text-muted)] mt-1">
                {soldes?.conges_pris || 0} pris / {((soldes?.conges_initial || 0) + (soldes?.conges_acquis || 0)).toFixed(1)} acquis
              </div>
            </div>

            {/* RTT */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl p-4 text-center border border-emerald-500/30">
              <Clock className="w-5 h-5 mx-auto text-emerald-400 mb-2" />
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                {soldes?.rtt_solde?.toFixed(1) || '0'}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase mt-1">RTT restants</div>
              <div className="text-[9px] text-[var(--text-muted)] mt-1">
                {soldes?.rtt_pris || 0} pris / {((soldes?.rtt_initial || 0) + (soldes?.rtt_acquis || 0)).toFixed(1)} acquis
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-center text-[var(--text-muted)]">
            Période : mai {anneeConges} → avril {anneeConges + 1}
          </div>
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

      {/* Modal Soldes */}
      {showSoldesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-[420px]">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Soldes initiaux {anneeConges}/{anneeConges + 1}
                </h3>
                <button onClick={() => setShowSoldesModal(false)}>
                  <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
              </div>

              {isVerrouille && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div className="text-sm text-amber-400">
                    Mode administrateur : les soldes étaient verrouillés
                  </div>
                </div>
              )}

              <p className="text-sm text-[var(--text-muted)] mb-4">
                Définissez vos soldes de départ (report année précédente) et RTT acquis.
                {!isVerrouille && (
                  <span className="text-amber-400 block mt-1">
                    ⚠️ Une fois validés, les soldes seront verrouillés.
                  </span>
                )}
              </p>

              <div className="space-y-4">
                {/* Congés initial */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-2">
                    <Palmtree className="w-4 h-4 text-cyan-400" />
                    Congés report (jours)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.conges_initial}
                    onChange={e => setEditForm({ ...editForm, conges_initial: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Congés non utilisés reportés de l'année précédente
                  </p>
                </div>

                {/* RTT initial */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    RTT report (jours)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.rtt_initial}
                    onChange={e => setEditForm({ ...editForm, rtt_initial: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    RTT non utilisés reportés de l'année précédente
                  </p>
                </div>

                {/* RTT acquis */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    RTT acquis cette année (jours)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.rtt_acquis}
                    onChange={e => setEditForm({ ...editForm, rtt_acquis: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Nombre de RTT attribués pour cette année
                  </p>
                </div>

                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Palmtree className="w-4 h-4" />
                    <span>Congés acquis automatiquement : {soldes?.conges_acquis?.toFixed(2) || 0} j</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Calculé à 2,08 j/mois depuis mai {anneeConges}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowSoldesModal(false)}>
                    Annuler
                  </Button>
                  {isVerrouille ? (
                    // Si déjà verrouillé (admin qui modifie), juste sauvegarder
                    <Button variant="primary" className="flex-1" onClick={handleSaveSoldes}>
                      <Save className="w-4 h-4" /> Enregistrer
                    </Button>
                  ) : (
                    // Première fois : valider et verrouiller
                    <Button 
                      variant="success" 
                      className="flex-1" 
                      onClick={handleValiderEtVerrouiller}
                    >
                      <Lock className="w-4 h-4" /> Valider et verrouiller
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
