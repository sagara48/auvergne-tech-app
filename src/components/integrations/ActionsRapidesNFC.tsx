import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Zap, StickyNote, FileText, AlertTriangle, History, 
  Camera, Check, X, Loader2, Send, Plus, Clock,
  Wrench, MessageSquare, Package, Upload
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Textarea, Select } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// =============================================
// TYPES
// =============================================
interface Ascenseur {
  id?: string;
  id_wsoucont?: number;
  code_appareil: string;
  adresse?: string;
  ville?: string;
}

interface ActionRapideProps {
  ascenseur: Ascenseur;
  onSuccess?: () => void;
  onClose?: () => void;
}

// =============================================
// ACTION: Créer une Note Rapide
// =============================================
export function ActionNoteRapide({ ascenseur, onSuccess, onClose }: ActionRapideProps) {
  const [contenu, setContenu] = useState('');
  const [priorite, setPriorite] = useState<'basse' | 'normale' | 'haute'>('normale');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!contenu.trim()) {
      toast.error('Veuillez saisir un contenu');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('notes').insert({
        titre: `Note - ${ascenseur.code_appareil}`,
        contenu: contenu.trim(),
        priorite,
        statut: 'active',
        auteur_id: user?.id,
        tags: [ascenseur.code_appareil],
        metadata: {
          code_appareil: ascenseur.code_appareil,
          adresse: ascenseur.adresse,
          created_via: 'nfc_action_rapide',
        },
      });

      toast.success('Note créée');
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-amber-400">
          <StickyNote className="w-5 h-5" />
          <h4 className="font-semibold">Note rapide</h4>
        </div>

        <Textarea
          value={contenu}
          onChange={e => setContenu(e.target.value)}
          placeholder="Votre note sur cet ascenseur..."
          rows={3}
        />

        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">Priorité:</span>
          {(['basse', 'normale', 'haute'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorite(p)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                priorite === p
                  ? p === 'haute' ? 'bg-red-500/20 text-red-400' :
                    p === 'normale' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span className="ml-2">Créer</span>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================
// ACTION: Signaler un Problème
// =============================================
export function ActionSignalerProbleme({ ascenseur, onSuccess, onClose }: ActionRapideProps) {
  const [description, setDescription] = useState('');
  const [typeProbleme, setTypeProbleme] = useState('panne');
  const [urgence, setUrgence] = useState<'normale' | 'haute' | 'urgente'>('normale');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typesProbleme = [
    { value: 'panne', label: '🔴 Panne', color: 'red' },
    { value: 'anomalie', label: '🟠 Anomalie', color: 'orange' },
    { value: 'bruit', label: '🔊 Bruit anormal', color: 'amber' },
    { value: 'securite', label: '⚠️ Sécurité', color: 'red' },
    { value: 'esthetique', label: '🎨 Esthétique', color: 'blue' },
    { value: 'autre', label: '📝 Autre', color: 'gray' },
  ];

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Veuillez décrire le problème');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Créer une demande d'intervention
      await supabase.from('demandes').insert({
        type: 'intervention',
        priorite: urgence,
        statut: 'en_attente',
        demandeur_id: user?.id,
        titre: `Problème signalé - ${ascenseur.code_appareil}`,
        description: `Type: ${typesProbleme.find(t => t.value === typeProbleme)?.label}\n\n${description}`,
        metadata: {
          code_appareil: ascenseur.code_appareil,
          adresse: ascenseur.adresse,
          type_probleme: typeProbleme,
          created_via: 'nfc_action_rapide',
        },
      });

      // Créer une notification pour les admins
      await supabase.from('notifications').insert({
        user_id: user?.id,
        type: 'panne',
        priority: urgence === 'urgente' ? 'urgent' : urgence === 'haute' ? 'high' : 'normal',
        titre: 'Problème signalé',
        message: `${typeProbleme} sur ${ascenseur.code_appareil}`,
        lue: false,
        metadata: { code_appareil: ascenseur.code_appareil },
      });

      toast.success('Problème signalé');
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error('Erreur lors du signalement');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-red-500/30">
      <CardBody className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <h4 className="font-semibold">Signaler un problème</h4>
        </div>

        <div>
          <label className="text-sm text-[var(--text-muted)] mb-2 block">Type de problème</label>
          <div className="grid grid-cols-3 gap-2">
            {typesProbleme.map(type => (
              <button
                key={type.value}
                onClick={() => setTypeProbleme(type.value)}
                className={`p-2 rounded-lg text-xs transition-colors ${
                  typeProbleme === type.value
                    ? `bg-${type.color}-500/20 border-${type.color}-500/50 border`
                    : 'bg-[var(--bg-secondary)] border border-transparent'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Décrivez le problème..."
          rows={3}
        />

        <div>
          <label className="text-sm text-[var(--text-muted)] mb-2 block">Urgence</label>
          <div className="flex gap-2">
            {([
              { value: 'normale', label: 'Normale', color: 'blue' },
              { value: 'haute', label: 'Haute', color: 'amber' },
              { value: 'urgente', label: 'Urgente', color: 'red' },
            ] as const).map(u => (
              <button
                key={u.value}
                onClick={() => setUrgence(u.value)}
                className={`flex-1 p-2 rounded-lg text-sm transition-colors ${
                  urgence === u.value
                    ? `bg-${u.color}-500/20 text-${u.color}-400 border border-${u.color}-500/50`
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="ml-2">Signaler</span>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================
// ACTION: Demander des Travaux
// =============================================
export function ActionDemanderTravaux({ ascenseur, onSuccess, onClose }: ActionRapideProps) {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<'normale' | 'haute' | 'urgente'>('normale');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!titre.trim() || !description.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Créer une demande de travaux
      await supabase.from('demandes').insert({
        type: 'materiel',
        priorite,
        statut: 'en_attente',
        demandeur_id: user?.id,
        titre: `Travaux demandés - ${ascenseur.code_appareil}`,
        description: `${titre}\n\n${description}`,
        metadata: {
          code_appareil: ascenseur.code_appareil,
          adresse: ascenseur.adresse,
          type_demande: 'travaux',
          created_via: 'nfc_action_rapide',
        },
      });

      toast.success('Demande de travaux créée');
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-purple-500/30">
      <CardBody className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-purple-400">
          <Wrench className="w-5 h-5" />
          <h4 className="font-semibold">Demander des travaux</h4>
        </div>

        <Input
          value={titre}
          onChange={e => setTitre(e.target.value)}
          placeholder="Titre des travaux..."
        />

        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description détaillée..."
          rows={3}
        />

        <div>
          <label className="text-sm text-[var(--text-muted)] mb-2 block">Priorité</label>
          <div className="flex gap-2">
            {([
              { value: 'normale', label: 'Normale' },
              { value: 'haute', label: 'Haute' },
              { value: 'urgente', label: 'Urgente' },
            ] as const).map(p => (
              <button
                key={p.value}
                onClick={() => setPriorite(p.value)}
                className={`flex-1 p-2 rounded-lg text-sm ${
                  priorite === p.value
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="ml-2">Créer demande</span>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================
// COMPOSANT PRINCIPAL: Menu Actions Rapides
// =============================================
interface ActionsRapidesNFCProps {
  ascenseur: Ascenseur;
  onActionComplete?: () => void;
}

export function ActionsRapidesNFC({ ascenseur, onActionComplete }: ActionsRapidesNFCProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const actions = [
    {
      id: 'note',
      label: 'Note rapide',
      icon: StickyNote,
      color: 'amber',
      description: 'Ajouter une note',
    },
    {
      id: 'probleme',
      label: 'Signaler',
      icon: AlertTriangle,
      color: 'red',
      description: 'Signaler un problème',
    },
    {
      id: 'travaux',
      label: 'Travaux',
      icon: Wrench,
      color: 'purple',
      description: 'Demander des travaux',
    },
    {
      id: 'historique',
      label: 'Historique',
      icon: History,
      color: 'blue',
      description: 'Voir l\'historique',
    },
  ];

  const handleSuccess = () => {
    setActiveAction(null);
    onActionComplete?.();
  };

  // Afficher le formulaire de l'action sélectionnée
  if (activeAction === 'note') {
    return (
      <ActionNoteRapide 
        ascenseur={ascenseur} 
        onSuccess={handleSuccess}
        onClose={() => setActiveAction(null)}
      />
    );
  }

  if (activeAction === 'probleme') {
    return (
      <ActionSignalerProbleme 
        ascenseur={ascenseur} 
        onSuccess={handleSuccess}
        onClose={() => setActiveAction(null)}
      />
    );
  }

  if (activeAction === 'travaux') {
    return (
      <ActionDemanderTravaux 
        ascenseur={ascenseur} 
        onSuccess={handleSuccess}
        onClose={() => setActiveAction(null)}
      />
    );
  }

  // Menu des actions
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h4 className="font-semibold">Actions rapides</h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map(action => {
          const Icon = action.icon;
          const colorClasses = {
            amber: 'hover:bg-amber-500/10 hover:border-amber-500/50',
            red: 'hover:bg-red-500/10 hover:border-red-500/50',
            purple: 'hover:bg-purple-500/10 hover:border-purple-500/50',
            blue: 'hover:bg-blue-500/10 hover:border-blue-500/50',
          };

          return (
            <button
              key={action.id}
              onClick={() => setActiveAction(action.id)}
              className={`p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] transition-all ${colorClasses[action.color as keyof typeof colorClasses]}`}
            >
              <div className={`w-10 h-10 rounded-lg bg-${action.color}-500/20 flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-5 h-5 text-${action.color}-400`} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{action.label}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{action.description}</p>
            </button>
          );
        })}
      </div>

      {/* Info ascenseur */}
      <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
        <p className="text-xs text-[var(--text-muted)]">Ascenseur</p>
        <p className="font-mono font-bold text-[var(--text-primary)]">{ascenseur.code_appareil}</p>
        {ascenseur.adresse && (
          <p className="text-xs text-[var(--text-muted)] truncate">{ascenseur.adresse}</p>
        )}
      </div>
    </div>
  );
}

export default ActionsRapidesNFC;
