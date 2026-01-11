import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, Plus, X, Calendar, User, MapPin, Edit, CalendarCheck, Archive, Search,
  Building2, Zap, Settings, TestTube, ShieldCheck, CheckCircle, Loader2,
  FileText, Camera, Image, Clock, AlertTriangle, Play, Pause, Flag, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Select, Input, Textarea } from '@/components/ui';
import { getMiseEnServices, updateMiseEnService, getAscenseurs, archiveMiseEnService } from '@/services/api';
import { supabase } from '@/services/supabase';
import { ContextChat } from './ChatPage';
import { ContextNotes } from './NotesPage';
import { ArchiveModal } from './ArchivesPage';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Configuration des étapes
const ETAPES = [
  { num: 1, label: 'Préparation', field: 'etape1_preparation', icon: Settings, description: 'Vérification documents, outillage, accès' },
  { num: 2, label: 'Vérification électrique', field: 'etape2_verification_electrique', icon: Zap, description: 'Alimentation, tableau, câblage' },
  { num: 3, label: 'Vérification mécanique', field: 'etape3_verification_mecanique', icon: Settings, description: 'Rails, guides, contrepoids, câbles' },
  { num: 4, label: 'Essais à vide', field: 'etape4_essais_vide', icon: TestTube, description: 'Fonctionnement sans charge' },
  { num: 5, label: 'Essais en charge', field: 'etape5_essais_charge', icon: TestTube, description: 'Fonctionnement avec charge nominale' },
  { num: 6, label: 'Sécurités', field: 'etape6_securites', icon: ShieldCheck, description: 'Test des dispositifs de sécurité' },
  { num: 7, label: 'Validation finale', field: 'etape7_validation', icon: CheckCircle, description: 'Contrôle final et PV' },
];

const TYPES_APPAREIL = [
  { value: 'ascenseur', label: 'Ascenseur' },
  { value: 'monte_charge', label: 'Monte-charge' },
  { value: 'escalier_mecanique', label: 'Escalier mécanique' },
  { value: 'trottoir_roulant', label: 'Trottoir roulant' },
  { value: 'plateforme', label: 'Plateforme élévatrice' },
];

const MARQUES = ['OTIS', 'SCHINDLER', 'KONE', 'THYSSENKRUPP', 'MITSUBISHI', 'FUJITEC', 'ORONA', 'Autre'];

// =============================================
// COMPOSANT UPLOAD PHOTOS
// =============================================
function PhotoUpload({ photos, onChange, maxPhotos = 10 }: { photos: string[]; onChange: (p: string[]) => void; maxPhotos?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (photos.length >= maxPhotos) { toast.error(`Maximum ${maxPhotos} photos`); return; }
      if (!file.type.startsWith('image/')) { toast.error('Seules les images sont acceptées'); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
      const reader = new FileReader();
      reader.onload = () => onChange([...photos, reader.result as string]);
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      {photos.length === 0 ? (
        <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed border-[var(--border-primary)] rounded-lg p-4 text-center cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
          <Camera className="w-6 h-6 mx-auto mb-1 text-[var(--text-muted)]" />
          <p className="text-xs text-[var(--text-muted)]">Ajouter des photos</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden group">
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onChange(photos.filter((_, i) => i !== idx))} className="absolute top-0 right-0 p-0.5 bg-red-500 rounded-bl opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <button onClick={() => inputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center hover:border-orange-500/50">
              <Plus className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================
// MODAL FORMULAIRE CRÉATION/ÉDITION
// =============================================
function MESFormModal({ mes, onClose, onSave, isLoading }: { mes?: any; onClose: () => void; onSave: (data: any) => void; isLoading?: boolean }) {
  const [saisieManuelle, setSaisieManuelle] = useState(mes?.saisie_manuelle || !mes?.ascenseur_id);
  const [form, setForm] = useState({
    // Ascenseur existant
    ascenseur_id: mes?.ascenseur_id || '',
    // Saisie manuelle
    client_nom: mes?.client_nom || '',
    adresse: mes?.adresse || '',
    code_postal: mes?.code_postal || '',
    ville: mes?.ville || '',
    type_appareil: mes?.type_appareil || 'ascenseur',
    marque: mes?.marque || '',
    modele: mes?.modele || '',
    numero_serie: mes?.numero_serie || '',
    nb_niveaux: mes?.nb_niveaux || '',
    charge_nominale: mes?.charge_nominale || '',
    vitesse: mes?.vitesse || '',
    // Commun
    technicien_id: mes?.technicien_id || '',
    date_prevue: mes?.date_prevue || '',
    observations: mes?.observations || '',
    statut: mes?.statut || 'planifie',
  });

  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });
  const { data: techniciens } = useQuery({
    queryKey: ['techniciens'],
    queryFn: async () => {
      const { data } = await supabase.from('techniciens').select('*, role:roles(*)').eq('actif', true).order('nom');
      return data || [];
    },
  });

  const techs = techniciens?.filter(t => t.role?.code === 'technicien' || t.role?.code === 'chef_equipe') || [];

  const handleSubmit = () => {
    if (saisieManuelle) {
      if (!form.client_nom || !form.adresse || !form.ville) {
        toast.error('Client, adresse et ville sont requis');
        return;
      }
    } else {
      if (!form.ascenseur_id) {
        toast.error('Sélectionnez un ascenseur');
        return;
      }
    }
    onSave({ ...form, saisie_manuelle: saisieManuelle });
  };

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{mes ? 'Modifier la MES' : 'Nouvelle mise en service'}</h2>
                <p className="text-sm text-[var(--text-muted)]">{mes?.code || 'Renseignez les informations de l\'appareil'}</p>
              </div>
            </div>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-4">
            {/* Toggle Ascenseur existant / Saisie manuelle */}
            {!mes && (
              <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Source de l'appareil</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSaisieManuelle(false)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!saisieManuelle ? 'bg-orange-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
                    📋 Ascenseur existant
                  </button>
                  <button onClick={() => setSaisieManuelle(true)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${saisieManuelle ? 'bg-orange-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
                    ✏️ Saisie manuelle
                  </button>
                </div>
              </div>
            )}

            {/* ASCENSEUR EXISTANT */}
            {!saisieManuelle && (
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Ascenseur *</label>
                <Select value={form.ascenseur_id} onChange={e => updateField('ascenseur_id', e.target.value)}>
                  <option value="">Sélectionner un ascenseur...</option>
                  {ascenseurs?.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.adresse}, {a.ville} ({a.client?.nom})</option>
                  ))}
                </Select>
              </div>
            )}

            {/* SAISIE MANUELLE */}
            {saisieManuelle && (
              <div className="space-y-4 p-4 bg-orange-500/5 rounded-xl border border-orange-500/20">
                <div className="flex items-center gap-2 text-orange-400 mb-2">
                  <Building2 className="w-5 h-5" />
                  <span className="font-semibold">Informations appareil</span>
                </div>

                {/* Client */}
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Client / Propriétaire *</label>
                  <Input value={form.client_nom} onChange={e => updateField('client_nom', e.target.value)} placeholder="Nom du client ou syndic..." />
                </div>

                {/* Adresse */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Adresse *</label>
                    <Input value={form.adresse} onChange={e => updateField('adresse', e.target.value)} placeholder="Numéro et rue..." />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Code postal</label>
                    <Input value={form.code_postal} onChange={e => updateField('code_postal', e.target.value)} placeholder="63000" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Ville *</label>
                  <Input value={form.ville} onChange={e => updateField('ville', e.target.value)} placeholder="Clermont-Ferrand" />
                </div>

                {/* Type et marque */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Type d'appareil</label>
                    <Select value={form.type_appareil} onChange={e => updateField('type_appareil', e.target.value)}>
                      {TYPES_APPAREIL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Marque</label>
                    <Select value={form.marque} onChange={e => updateField('marque', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {MARQUES.map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                  </div>
                </div>

                {/* Modèle et N° série */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Modèle</label>
                    <Input value={form.modele} onChange={e => updateField('modele', e.target.value)} placeholder="Gen2, Synergy..." />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">N° de série</label>
                    <Input value={form.numero_serie} onChange={e => updateField('numero_serie', e.target.value)} placeholder="SN-XXXXX" />
                  </div>
                </div>

                {/* Caractéristiques techniques */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Nb niveaux</label>
                    <Input type="number" value={form.nb_niveaux} onChange={e => updateField('nb_niveaux', e.target.value)} placeholder="5" />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Charge (kg)</label>
                    <Input type="number" value={form.charge_nominale} onChange={e => updateField('charge_nominale', e.target.value)} placeholder="630" />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Vitesse (m/s)</label>
                    <Input value={form.vitesse} onChange={e => updateField('vitesse', e.target.value)} placeholder="1.0" />
                  </div>
                </div>
              </div>
            )}

            {/* Technicien et date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Technicien assigné</label>
                <Select value={form.technicien_id} onChange={e => updateField('technicien_id', e.target.value)}>
                  <option value="">Non assigné</option>
                  {techs.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date prévue</label>
                <Input type="date" value={form.date_prevue} onChange={e => updateField('date_prevue', e.target.value)} />
              </div>
            </div>

            {/* Statut (édition uniquement) */}
            {mes && (
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">Statut</label>
                <Select value={form.statut} onChange={e => updateField('statut', e.target.value)}>
                  <option value="planifie">Planifiée</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminée</option>
                </Select>
              </div>
            )}

            {/* Observations */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] mb-1 block">Observations générales</label>
              <Textarea value={form.observations} onChange={e => updateField('observations', e.target.value)} rows={2} placeholder="Notes préliminaires..." />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : mes ? 'Enregistrer' : 'Créer la MES'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL DÉTAIL MES
// =============================================
function MESDetailModal({ mes, onClose, onEdit, onArchive, onRefresh }: { mes: any; onClose: () => void; onEdit: () => void; onArchive: () => void; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [expandedEtape, setExpandedEtape] = useState<number | null>(null);
  const [etapeObservations, setEtapeObservations] = useState<Record<string, string>>({});
  const [etapePhotos, setEtapePhotos] = useState<Record<string, string[]>>({});

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMiseEnService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      onRefresh();
      toast.success('Mise à jour effectuée');
    },
  });

  const toggleEtape = (field: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const updateData: any = { [field]: newValue };
    
    // Si on complète l'étape, sauvegarder observations et photos
    if (newValue) {
      const etapeNum = field.replace('etape', '').split('_')[0];
      if (etapeObservations[field]) updateData[`${field}_observations`] = etapeObservations[field];
      if (etapePhotos[field]?.length) updateData[`${field}_photos`] = JSON.stringify(etapePhotos[field]);
    }
    
    // Calculer l'étape actuelle
    const completedSteps = ETAPES.filter(e => e.field === field ? newValue : mes[e.field]).length;
    updateData.etape_actuelle = completedSteps;
    
    // Si toutes les étapes sont complétées, passer en terminé
    if (completedSteps === 7 && mes.statut !== 'termine') {
      updateData.statut = 'termine';
      updateData.date_fin = new Date().toISOString();
    }
    
    // Si on démarre (première étape), passer en cours
    if (completedSteps === 1 && mes.statut === 'planifie') {
      updateData.statut = 'en_cours';
      updateData.date_debut = new Date().toISOString();
    }
    
    updateMutation.mutate({ id: mes.id, data: updateData });
  };

  const completedSteps = ETAPES.filter(e => mes[e.field]).length;
  const progress = Math.round((completedSteps / 7) * 100);

  // Infos appareil (depuis ascenseur ou saisie manuelle)
  const appareilInfo = mes.saisie_manuelle ? {
    client: mes.client_nom,
    adresse: mes.adresse,
    ville: mes.ville,
    codePostal: mes.code_postal,
    type: TYPES_APPAREIL.find(t => t.value === mes.type_appareil)?.label || mes.type_appareil,
    marque: mes.marque,
    modele: mes.modele,
    numeroSerie: mes.numero_serie,
    nbNiveaux: mes.nb_niveaux,
    charge: mes.charge_nominale,
    vitesse: mes.vitesse,
  } : mes.ascenseur ? {
    client: mes.ascenseur.client?.nom,
    adresse: mes.ascenseur.adresse,
    ville: mes.ascenseur.ville,
    codePostal: mes.ascenseur.code_postal,
    type: 'Ascenseur',
    marque: mes.ascenseur.marque,
    modele: mes.ascenseur.modele,
    numeroSerie: mes.ascenseur.numero_serie,
    nbNiveaux: mes.ascenseur.nb_niveaux,
    charge: mes.ascenseur.charge,
    vitesse: mes.ascenseur.vitesse,
  } : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-orange-400">{mes.code}</span>
                <Badge variant={mes.statut === 'termine' ? 'green' : mes.statut === 'en_cours' ? 'amber' : 'blue'}>
                  {mes.statut === 'termine' ? '✓ Terminée' : mes.statut === 'en_cours' ? '⏳ En cours' : '📅 Planifiée'}
                </Badge>
                {mes.saisie_manuelle && <Badge variant="purple">Saisie manuelle</Badge>}
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Mise en service</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onArchive} className="p-2 hover:bg-amber-500/20 rounded-lg" title="Archiver">
                <Archive className="w-5 h-5 text-[var(--text-tertiary)] hover:text-amber-400" />
              </button>
              <button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg" title="Modifier">
                <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
          </div>

          {/* Progression */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--text-secondary)]">Progression</span>
              <span className="text-lg font-bold text-orange-400">{progress}%</span>
            </div>
            <div className="h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              {ETAPES.map(e => (
                <div key={e.num} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${mes[e.field] ? 'bg-green-500 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {mes[e.field] ? <Check className="w-3 h-3" /> : e.num}
                </div>
              ))}
            </div>
          </div>

          {/* Infos appareil */}
          {appareilInfo && (
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4 space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold">
                <Building2 className="w-4 h-4" /> Informations appareil
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--text-muted)]">Client:</span> <span className="text-[var(--text-primary)] font-medium">{appareilInfo.client}</span></div>
                <div><span className="text-[var(--text-muted)]">Type:</span> <span className="text-[var(--text-primary)]">{appareilInfo.type}</span></div>
                <div className="col-span-2"><span className="text-[var(--text-muted)]">Adresse:</span> <span className="text-[var(--text-primary)]">{appareilInfo.adresse}, {appareilInfo.codePostal} {appareilInfo.ville}</span></div>
                {appareilInfo.marque && <div><span className="text-[var(--text-muted)]">Marque:</span> <span className="text-[var(--text-primary)]">{appareilInfo.marque}</span></div>}
                {appareilInfo.modele && <div><span className="text-[var(--text-muted)]">Modèle:</span> <span className="text-[var(--text-primary)]">{appareilInfo.modele}</span></div>}
                {appareilInfo.numeroSerie && <div><span className="text-[var(--text-muted)]">N° série:</span> <span className="text-[var(--text-primary)]">{appareilInfo.numeroSerie}</span></div>}
                {appareilInfo.nbNiveaux && <div><span className="text-[var(--text-muted)]">Niveaux:</span> <span className="text-[var(--text-primary)]">{appareilInfo.nbNiveaux}</span></div>}
                {appareilInfo.charge && <div><span className="text-[var(--text-muted)]">Charge:</span> <span className="text-[var(--text-primary)]">{appareilInfo.charge} kg</span></div>}
                {appareilInfo.vitesse && <div><span className="text-[var(--text-muted)]">Vitesse:</span> <span className="text-[var(--text-primary)]">{appareilInfo.vitesse} m/s</span></div>}
              </div>
            </div>
          )}

          {/* Technicien et dates */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {mes.technicien && (
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Technicien</div>
                <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  {mes.technicien.prenom} {mes.technicien.nom}
                </div>
              </div>
            )}
            {mes.date_prevue && (
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-xs text-[var(--text-muted)] mb-1">Date prévue</div>
                <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  {format(parseISO(mes.date_prevue), 'd MMM yyyy', { locale: fr })}
                </div>
              </div>
            )}
            {mes.date_fin && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-xs text-green-400 mb-1">Terminée le</div>
                <div className="font-medium text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {format(parseISO(mes.date_fin), 'd MMM yyyy', { locale: fr })}
                </div>
              </div>
            )}
          </div>

          {/* Étapes interactives */}
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-orange-400" />
              Étapes de mise en service
            </h3>
            <div className="space-y-2">
              {ETAPES.map((etape) => {
                const completed = mes[etape.field];
                const Icon = etape.icon;
                const isExpanded = expandedEtape === etape.num;
                
                return (
                  <div key={etape.num} className={`rounded-lg overflow-hidden border ${completed ? 'border-green-500/30 bg-green-500/10' : 'border-[var(--border-primary)] bg-[var(--bg-elevated)]'}`}>
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => toggleEtape(etape.field, completed)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${completed ? 'bg-green-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-orange-500/20'}`}
                        disabled={updateMutation.isPending}
                      >
                        {completed ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <div className={`font-medium ${completed ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>
                          {etape.num}. {etape.label}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{etape.description}</div>
                      </div>
                      {!completed && (
                        <button onClick={() => setExpandedEtape(isExpanded ? null : etape.num)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      {completed && <Badge variant="green">✓</Badge>}
                    </div>
                    
                    {/* Zone observations/photos (si étape non complétée et expandée) */}
                    {!completed && isExpanded && (
                      <div className="p-3 border-t border-[var(--border-primary)] space-y-3">
                        <div>
                          <label className="text-xs text-[var(--text-muted)] mb-1 block">Observations</label>
                          <Textarea
                            value={etapeObservations[etape.field] || ''}
                            onChange={e => setEtapeObservations({ ...etapeObservations, [etape.field]: e.target.value })}
                            rows={2}
                            placeholder="Notes pour cette étape..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-muted)] mb-1 block">Photos</label>
                          <PhotoUpload
                            photos={etapePhotos[etape.field] || []}
                            onChange={photos => setEtapePhotos({ ...etapePhotos, [etape.field]: photos })}
                            maxPhotos={5}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Observations générales */}
          {mes.observations && (
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl mb-4">
              <div className="text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Observations
              </div>
              <p className="text-[var(--text-primary)] whitespace-pre-wrap">{mes.observations}</p>
            </div>
          )}

          {/* Chat et notes */}
          <ContextChat contextType="mise_service" contextId={mes.id} contextLabel={mes.code} />
          <ContextNotes contextType="mise_service" contextId={mes.id} contextLabel={mes.code} />

          {/* Footer */}
          <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            {mes.statut !== 'termine' && progress === 100 && (
              <Button variant="success" className="flex-1" onClick={() => updateMutation.mutate({ id: mes.id, data: { statut: 'termine', date_fin: new Date().toISOString() } })}>
                <Flag className="w-4 h-4" /> Valider la MES
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function MiseEnServicePage() {
  const [showForm, setShowForm] = useState(false);
  const [editMES, setEditMES] = useState<any>(null);
  const [detailMES, setDetailMES] = useState<any>(null);
  const [archiveItem, setArchiveItem] = useState<any>(null);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  
  const { data: miseEnServices, isLoading, refetch } = useQuery({ 
    queryKey: ['mise-en-service'], 
    queryFn: () => getMiseEnServices() 
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const code = `MES-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { data: result, error } = await supabase.from('mise_en_service').insert({ ...data, code, etape_actuelle: 0 }).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Mise en service créée');
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateMiseEnService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Mise en service mise à jour');
      setEditMES(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveMiseEnService(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Mise en service archivée');
      setArchiveItem(null);
      setDetailMES(null);
    },
  });

  const filtered = useMemo(() => {
    return miseEnServices?.filter(m => {
      if (filterStatut !== 'all' && m.statut !== filterStatut) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return m.code.toLowerCase().includes(q) ||
               m.client_nom?.toLowerCase().includes(q) ||
               m.adresse?.toLowerCase().includes(q) ||
               m.ville?.toLowerCase().includes(q) ||
               m.ascenseur?.code?.toLowerCase().includes(q) ||
               m.ascenseur?.adresse?.toLowerCase().includes(q) ||
               m.technicien?.nom?.toLowerCase().includes(q);
      }
      return true;
    }) || [];
  }, [miseEnServices, filterStatut, searchQuery]);

  const getProgress = (mes: any) => {
    const completed = ETAPES.filter(e => mes[e.field]).length;
    return Math.round((completed / 7) * 100);
  };

  const stats = {
    total: miseEnServices?.length || 0,
    planifie: miseEnServices?.filter(m => m.statut === 'planifie').length || 0,
    en_cours: miseEnServices?.filter(m => m.statut === 'en_cours').length || 0,
    termine: miseEnServices?.filter(m => m.statut === 'termine').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-orange-400" /></div><div><div className="text-2xl font-extrabold">{stats.total}</div><div className="text-xs text-[var(--text-tertiary)]">Total</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Calendar className="w-6 h-6 text-blue-400" /></div><div><div className="text-2xl font-extrabold text-blue-400">{stats.planifie}</div><div className="text-xs text-[var(--text-tertiary)]">Planifiées</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"><Play className="w-6 h-6 text-amber-400" /></div><div><div className="text-2xl font-extrabold text-amber-400">{stats.en_cours}</div><div className="text-xs text-[var(--text-tertiary)]">En cours</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><Check className="w-6 h-6 text-green-400" /></div><div><div className="text-2xl font-extrabold text-green-400">{stats.termine}</div><div className="text-xs text-[var(--text-tertiary)]">Terminées</div></div></CardBody></Card>
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="pl-10 w-64" />
          </div>
          <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-40">
            <option value="all">Tous les statuts</option>
            <option value="planifie">Planifiées</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminées</option>
          </Select>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouvelle mise en service
        </Button>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {isLoading ? (
          <Card><CardBody className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardBody></Card>
        ) : filtered.length === 0 ? (
          <Card><CardBody className="text-center py-12">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
            <p className="text-[var(--text-muted)]">Aucune mise en service trouvée</p>
            <Button variant="primary" className="mt-4" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Créer une MES</Button>
          </CardBody></Card>
        ) : filtered.map(mes => {
          const progress = getProgress(mes);
          const appareilNom = mes.saisie_manuelle 
            ? `${mes.client_nom} - ${mes.adresse}, ${mes.ville}`
            : mes.ascenseur 
              ? `${mes.ascenseur.code} - ${mes.ascenseur.adresse}, ${mes.ascenseur.ville}`
              : 'Appareil non défini';
          
          return (
            <Card key={mes.id} className="hover:border-orange-500/30 transition-colors cursor-pointer" onClick={() => setDetailMES(mes)}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-orange-400">{mes.code}</span>
                      <Badge variant={mes.statut === 'termine' ? 'green' : mes.statut === 'en_cours' ? 'amber' : 'blue'}>
                        {mes.statut === 'termine' ? '✓ Terminée' : mes.statut === 'en_cours' ? '⏳ En cours' : '📅 Planifiée'}
                      </Badge>
                      {mes.saisie_manuelle && <Badge variant="purple">Manuel</Badge>}
                      {mes.date_prevue && (
                        <Badge variant="gray" className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(mes.date_prevue), 'd MMM', { locale: fr })}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-primary)] font-medium mb-1">{appareilNom}</div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      {mes.technicien && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {mes.technicien.prenom} {mes.technicien.nom}</span>
                      )}
                      {mes.saisie_manuelle && mes.marque && (
                        <span>{mes.marque} {mes.modele}</span>
                      )}
                      <span>{formatDistanceToNow(parseISO(mes.created_at), { addSuffix: true, locale: fr })}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold" style={{ color: progress === 100 ? '#22c55e' : progress > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {progress}%
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">{mes.etape_actuelle || 0}/7 étapes</div>
                  </div>
                </div>
                <div className="flex gap-1 mt-3">
                  {ETAPES.map(etape => (
                    <div key={etape.num} className={`flex-1 h-2 rounded-full ${mes[etape.field] ? 'bg-green-500' : 'bg-[var(--bg-elevated)]'}`} />
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Modals */}
      {showForm && <MESFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} isLoading={createMutation.isPending} />}
      {editMES && <MESFormModal mes={editMES} onClose={() => setEditMES(null)} onSave={data => updateMutation.mutate({ id: editMES.id, data })} isLoading={updateMutation.isPending} />}
      {detailMES && (
        <MESDetailModal 
          mes={detailMES} 
          onClose={() => setDetailMES(null)} 
          onEdit={() => { setEditMES(detailMES); setDetailMES(null); }}
          onArchive={() => setArchiveItem(detailMES)}
          onRefresh={() => refetch().then(r => r.data && setDetailMES(r.data.find((m: any) => m.id === detailMES.id)))}
        />
      )}
      {archiveItem && (
        <ArchiveModal
          type="mise_en_service"
          code={archiveItem.code}
          libelle={`MES ${archiveItem.code}`}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
