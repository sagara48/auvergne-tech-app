import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, Wrench, Building2, MapPin, User, Calendar, Clock,
  AlertTriangle, FileText, CheckCircle, ChevronDown, Loader2
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface ArretOuPanne {
  id: string;
  id_panne?: number;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal?: string;
  secteur: number;
  date_appel: string;
  heure_appel?: string;
  motif: string;
  cause?: string;
  demandeur?: string;
  depanneur?: string;
  etat?: string;
  type: 'arret' | 'panne';
}

interface CreerTravauxDepuisArretProps {
  arretOuPanne: ArretOuPanne;
  onClose: () => void;
  onSuccess?: (travauxId: string) => void;
}

interface Client {
  id: string;
  raison_sociale: string;
}

interface Technicien {
  id: string;
  prenom: string;
  nom: string;
  secteur?: string;
}

// Générer un code travaux
function genererCodeTravaux(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `T-${year}-${random}`;
}

// Récupérer les techniciens
async function getTechniciens(): Promise<Technicien[]> {
  const { data, error } = await supabase
    .from('techniciens')
    .select('id, prenom, nom, secteur')
    .eq('actif', true)
    .order('nom');

  if (error) return [];
  return data || [];
}

// Récupérer les clients
async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, raison_sociale')
    .order('raison_sociale');

  if (error) return [];
  return data || [];
}

// Créer les travaux
async function creerTravaux(data: {
  code: string;
  titre: string;
  description: string;
  type_travaux: string;
  priorite: string;
  client_id?: string;
  technicien_id?: string;
  adresse_intervention: string;
  date_prevue?: string;
  arret_id?: string;
  panne_id?: string;
  ascenseur_code?: string;
  planifier_auto?: boolean;
}): Promise<string> {
  // Créer le travaux
  const { data: travaux, error } = await supabase
    .from('travaux')
    .insert({
      code: data.code,
      titre: data.titre,
      description: data.description,
      type_travaux: data.type_travaux,
      priorite: data.priorite,
      statut: 'planifie',
      client_id: data.client_id,
      technicien_id: data.technicien_id,
      adresse_intervention: data.adresse_intervention,
      date_prevue: data.date_prevue,
      // Métadonnées pour lier à l'arrêt/panne
      metadata: {
        source: data.arret_id ? 'arret' : 'panne',
        arret_id: data.arret_id,
        panne_id: data.panne_id,
        ascenseur_code: data.ascenseur_code,
      },
    })
    .select()
    .single();

  if (error) throw error;

  // Si planification auto, créer l'événement planning
  if (data.planifier_auto && data.technicien_id && data.date_prevue) {
    const dateDebut = new Date(data.date_prevue);
    dateDebut.setHours(8, 0, 0, 0);
    const dateFin = new Date(data.date_prevue);
    dateFin.setHours(17, 0, 0, 0);

    await supabase.from('planning_events').insert({
      titre: data.code,
      technicien_id: data.technicien_id,
      type_event: 'travaux',
      date_debut: dateDebut.toISOString(),
      date_fin: dateFin.toISOString(),
      travaux_id: travaux.id,
      couleur: '#8b5cf6', // Violet pour travaux
      description: data.titre,
      lieu: data.adresse_intervention,
    });
  }

  return travaux.id;
}

export function CreerTravauxDepuisArret({ arretOuPanne, onClose, onSuccess }: CreerTravauxDepuisArretProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [code, setCode] = useState(genererCodeTravaux());
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [typeTravaux, setTypeTravaux] = useState('depannage');
  const [priorite, setPriorite] = useState('urgente');
  const [clientId, setClientId] = useState<string>('');
  const [technicienId, setTechnicienId] = useState<string>('');
  const [datePrevue, setDatePrevue] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [planifierAuto, setPlanifierAuto] = useState(true);
  const [lierArret, setLierArret] = useState(true);

  // Queries
  const { data: techniciens } = useQuery({
    queryKey: ['techniciens'],
    queryFn: getTechniciens,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  });

  // Pré-remplir depuis l'arrêt/panne
  useEffect(() => {
    // Titre basé sur le motif
    const motif = arretOuPanne.motif || arretOuPanne.cause || '';
    setTitre(`Intervention ${arretOuPanne.code_appareil} - ${motif.slice(0, 50)}`);

    // Description complète
    const lines = [
      `Suite ${arretOuPanne.type === 'arret' ? 'arrêt' : 'panne'} du ${format(new Date(arretOuPanne.date_appel), 'd MMMM yyyy', { locale: fr })}`,
      '',
      `Motif: ${motif}`,
    ];
    if (arretOuPanne.demandeur) lines.push(`Demandeur: ${arretOuPanne.demandeur}`);
    if (arretOuPanne.cause) lines.push(`Cause: ${arretOuPanne.cause}`);
    
    setDescription(lines.join('\n'));

    // Pré-sélectionner le technicien du secteur
    if (techniciens && arretOuPanne.secteur) {
      const techSecteur = techniciens.find(t => 
        t.secteur && parseInt(t.secteur) === arretOuPanne.secteur
      );
      if (techSecteur) setTechnicienId(techSecteur.id);
    }
  }, [arretOuPanne, techniciens]);

  // Mutation
  const mutation = useMutation({
    mutationFn: () => creerTravaux({
      code,
      titre,
      description,
      type_travaux: typeTravaux,
      priorite,
      client_id: clientId || undefined,
      technicien_id: technicienId || undefined,
      adresse_intervention: `${arretOuPanne.adresse}, ${arretOuPanne.code_postal || ''} ${arretOuPanne.ville}`,
      date_prevue: datePrevue,
      arret_id: arretOuPanne.type === 'arret' ? arretOuPanne.id : undefined,
      panne_id: arretOuPanne.type === 'panne' ? arretOuPanne.id : undefined,
      ascenseur_code: arretOuPanne.code_appareil,
      planifier_auto: planifierAuto,
    }),
    onSuccess: (travauxId) => {
      toast.success('Intervention créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['travaux'] });
      queryClient.invalidateQueries({ queryKey: ['planning'] });
      onSuccess?.(travauxId);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la création');
    },
  });

  const adresseComplete = `${arretOuPanne.adresse}, ${arretOuPanne.code_postal || ''} ${arretOuPanne.ville}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-primary)]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Nouvelle intervention</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Depuis {arretOuPanne.type === 'arret' ? 'arrêt' : 'panne'} #{arretOuPanne.id_panne || arretOuPanne.id.slice(0, 8)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Infos source */}
          <Card className="mt-4 border-orange-500/30 bg-orange-500/5">
            <CardBody className="p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="purple">{arretOuPanne.code_appareil}</Badge>
                    <Badge variant="orange">Secteur {arretOuPanne.secteur}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      {format(new Date(arretOuPanne.date_appel), 'd MMM yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{arretOuPanne.motif || arretOuPanne.cause}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {adresseComplete}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Formulaire scrollable */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Code et titre */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Code
              </label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="T-2025-0001"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Titre
              </label>
              <Input
                value={titre}
                onChange={e => setTitre(e.target.value)}
                placeholder="Titre de l'intervention"
              />
            </div>
          </div>

          {/* Type et priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Type d'intervention
              </label>
              <Select
                value={typeTravaux}
                onChange={e => setTypeTravaux(e.target.value)}
              >
                <option value="depannage">🔧 Dépannage</option>
                <option value="reparation">🛠️ Réparation</option>
                <option value="modernisation">⬆️ Modernisation</option>
                <option value="maintenance">📋 Maintenance</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Priorité
              </label>
              <Select
                value={priorite}
                onChange={e => setPriorite(e.target.value)}
              >
                <option value="urgente">🔴 Urgente</option>
                <option value="haute">🟠 Haute</option>
                <option value="normale">🟢 Normale</option>
                <option value="basse">⚪ Basse</option>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Détails de l'intervention..."
            />
          </div>

          {/* Client et Technicien */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Client (optionnel)
              </label>
              <Select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              >
                <option value="">-- Sélectionner --</option>
                {clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.raison_sociale}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Technicien assigné
              </label>
              <Select
                value={technicienId}
                onChange={e => setTechnicienId(e.target.value)}
              >
                <option value="">-- Sélectionner --</option>
                {techniciens?.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.prenom} {t.nom} {t.secteur ? `(S${t.secteur})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Date prévue
              </label>
              <Input
                type="date"
                value={datePrevue}
                onChange={e => setDatePrevue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Adresse intervention
              </label>
              <Input
                value={adresseComplete}
                disabled
                className="bg-[var(--bg-tertiary)]"
              />
            </div>
          </div>

          {/* Options */}
          <div className="p-4 bg-[var(--bg-secondary)] rounded-xl space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={planifierAuto}
                onChange={e => setPlanifierAuto(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-primary)] text-lime-500 focus:ring-lime-500"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Planifier automatiquement dans le planning
              </span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lierArret}
                onChange={e => setLierArret(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-primary)] text-lime-500 focus:ring-lime-500"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Lier à l'{arretOuPanne.type} (mise à jour automatique du statut)
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-primary)] flex items-center justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            {technicienId && planifierAuto && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Sera planifié le {format(new Date(datePrevue), 'd MMM', { locale: fr })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              variant="primary"
              onClick={() => mutation.mutate()}
              disabled={!titre.trim() || mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Créer intervention
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bouton d'action pour utiliser sur les cartes arrêts/pannes
export function BoutonCreerTravaux({ 
  arretOuPanne, 
  variant = 'secondary',
  size = 'sm',
  className = '' 
}: { 
  arretOuPanne: ArretOuPanne;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        className={className}
        onClick={() => setShowModal(true)}
      >
        <Wrench className="w-4 h-4 mr-1" />
        Créer intervention
      </Button>

      {showModal && (
        <CreerTravauxDepuisArret
          arretOuPanne={arretOuPanne}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
