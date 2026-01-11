import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  HelpCircle, Search, Check, X, Clock, Package, Calendar, GraduationCap, Plus, User, 
  Archive, Eye, AlertTriangle, MessageSquare, History, Wrench, Receipt,
  AlertCircle, Send, Paperclip, Image, Camera,
  CalendarDays, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { 
  getDemandes, createDemande, traiterDemande, getDemandeHistorique,
  checkConflitsConges, calculerJoursOuvres, getDemandesStats, getSoldeConges, getAnneeConges,
  getStockArticles, getAscenseurs, archiveDemande
} from '@/services/api';
import { ArchiveModal } from './ArchivesPage';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDemande, StatutDemande, Priorite, Demande, CategorieRemboursement } from '@/types';
import toast from 'react-hot-toast';

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const IS_ADMIN = true;

const TYPE_CONFIG: Record<TypeDemande, { label: string; icon: any; color: string; bgColor: string }> = {
  piece: { label: 'Pièce détachée', icon: Package, color: '#3b82f6', bgColor: 'bg-blue-500/20' },
  conge: { label: 'Congé payé', icon: Calendar, color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  rtt: { label: 'RTT', icon: CalendarDays, color: '#10b981', bgColor: 'bg-emerald-500/20' },
  formation: { label: 'Formation', icon: GraduationCap, color: '#a855f7', bgColor: 'bg-purple-500/20' },
  materiel: { label: 'Matériel/Outillage', icon: Wrench, color: '#f59e0b', bgColor: 'bg-amber-500/20' },
  intervention: { label: 'Intervention urgente', icon: AlertCircle, color: '#ef4444', bgColor: 'bg-red-500/20' },
  remboursement: { label: 'Remboursement', icon: Receipt, color: '#ec4899', bgColor: 'bg-pink-500/20' },
  autre: { label: 'Autre', icon: HelpCircle, color: '#71717a', bgColor: 'bg-gray-500/20' },
};

const STATUT_CONFIG: Record<StatutDemande, { label: string; color: 'gray' | 'amber' | 'green' | 'red' | 'blue' | 'purple' }> = {
  brouillon: { label: 'Brouillon', color: 'gray' },
  en_attente: { label: 'En attente', color: 'amber' },
  approuve: { label: 'Approuvée', color: 'green' },
  refuse: { label: 'Refusée', color: 'red' },
  en_cours: { label: 'En cours', color: 'blue' },
  termine: { label: 'Terminée', color: 'purple' },
};

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: 'gray' | 'blue' | 'amber' | 'red' }> = {
  basse: { label: 'Basse', color: 'gray' },
  normale: { label: 'Normale', color: 'blue' },
  haute: { label: 'Haute', color: 'amber' },
  urgente: { label: 'Urgente', color: 'red' },
};

const CATEGORIE_REMBOURSEMENT: Record<CategorieRemboursement, string> = {
  carburant: '⛽ Carburant', peage: '🛣️ Péage', parking: '🅿️ Parking', repas: '🍽️ Repas',
  hotel: '🏨 Hôtel', transport: '🚄 Transport', materiel: '🔧 Matériel', autre: '📦 Autre',
};

// =============================================
// COMPOSANT UPLOAD PHOTOS
// =============================================
interface PhotoUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

function PhotoUpload({ photos, onChange, maxPhotos = 5 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (photos.length >= maxPhotos) {
        toast.error(`Maximum ${maxPhotos} photos`);
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Seules les images sont acceptées');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image trop volumineuse (max 5 Mo)');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onChange([...photos, base64]);
      };
      reader.readAsDataURL(file);
    });

    if (inputRef.current) inputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
          <Camera className="w-4 h-4" /> Photos ({photos.length}/{maxPhotos})
        </label>
        {photos.length < maxPhotos && (
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Plus className="w-4 h-4" /> Ajouter
          </Button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {photos.length === 0 ? (
        <div 
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border-primary)] rounded-xl p-6 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
        >
          <Image className="w-10 h-10 mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Cliquez ou glissez vos photos ici</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">JPG, PNG • Max 5 Mo par photo</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden">
              <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <button
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
            >
              <Plus className="w-6 h-6 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================
// COMPOSANT FORMULAIRE DEMANDE
// =============================================
function DemandeFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [formData, setFormData] = useState<Partial<Demande> & { 
    photos?: string[];
    saisie_manuelle?: boolean;
    designation_piece?: string;
    reference_piece?: string;
  }>({
    technicien_id: CURRENT_USER_ID, type_demande: undefined, objet: '', description: '', 
    priorite: 'normale', statut: 'en_attente', photos: [], saisie_manuelle: false,
    designation_piece: '', reference_piece: '',
  });
  const [conflits, setConflits] = useState<Demande[]>([]);

  const { data: articles } = useQuery({ queryKey: ['stock-articles'], queryFn: getStockArticles });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });
  const anneeConges = getAnneeConges(new Date());
  const { data: soldes } = useQuery({ 
    queryKey: ['soldes-conges', CURRENT_USER_ID, anneeConges], 
    queryFn: () => getSoldeConges(CURRENT_USER_ID, anneeConges),
    enabled: formData.type_demande === 'conge' || formData.type_demande === 'rtt'
  });

  const createMutation = useMutation({
    mutationFn: createDemande,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success('Demande créée avec succès');
      onSuccess();
    },
    onError: (error: any) => toast.error(error.message || 'Erreur lors de la création'),
  });

  const nbJours = useMemo(() => {
    if (formData.date_debut && formData.date_fin) {
      return calculerJoursOuvres(formData.date_debut, formData.date_fin, formData.demi_journee_debut, formData.demi_journee_fin);
    }
    return 0;
  }, [formData.date_debut, formData.date_fin, formData.demi_journee_debut, formData.demi_journee_fin]);

  const checkConflitsAsync = async () => {
    if (formData.date_debut && formData.date_fin) {
      const result = await checkConflitsConges(CURRENT_USER_ID, formData.date_debut, formData.date_fin);
      setConflits(result.conflits);
    }
  };

  const handleSelectType = (type: TypeDemande) => { setFormData({ ...formData, type_demande: type }); setStep('details'); };
  
  const handleSubmit = () => {
    if (!formData.objet) { toast.error('Veuillez renseigner l\'objet'); return; }
    if (formData.type_demande === 'piece' && formData.saisie_manuelle && !formData.designation_piece) {
      toast.error('Veuillez renseigner la désignation de la pièce'); return;
    }
    
    const data: any = { ...formData };
    if ((formData.type_demande === 'conge' || formData.type_demande === 'rtt') && nbJours) data.nb_jours = nbJours;
    
    // Saisie manuelle : inclure dans description
    if (formData.type_demande === 'piece' && formData.saisie_manuelle) {
      const pieceInfo = `[SAISIE MANUELLE]\nDésignation: ${formData.designation_piece}${formData.reference_piece ? `\nRéférence: ${formData.reference_piece}` : ''}`;
      data.description = pieceInfo + (data.description ? `\n\n${data.description}` : '');
    }
    
    // Photos en JSON
    if (formData.photos && formData.photos.length > 0) {
      data.photos_json = JSON.stringify(formData.photos);
    }
    
    createMutation.mutate(data);
  };

  const updateField = (field: string, value: any) => setFormData({ ...formData, [field]: value });

  // Étape 1 : Sélection du type
  if (step === 'type') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <Card className="w-[600px]">
          <CardBody>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center"><Plus className="w-6 h-6 text-pink-400" /></div>
                <div><h2 className="text-xl font-bold text-[var(--text-primary)]">Nouvelle demande</h2><p className="text-sm text-[var(--text-muted)]">Sélectionnez le type</p></div>
              </div>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button key={key} onClick={() => handleSelectType(key as TypeDemande)} className={`flex items-center gap-3 p-4 rounded-xl border-2 border-transparent hover:border-[var(--border-secondary)] ${config.bgColor} transition-all text-left`}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}30` }}><Icon className="w-5 h-5" style={{ color: config.color }} /></div>
                    <div className="font-semibold text-[var(--text-primary)]">{config.label}</div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const typeConfig = TYPE_CONFIG[formData.type_demande!];
  const TypeIcon = typeConfig?.icon || HelpCircle;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${typeConfig?.bgColor} flex items-center justify-center`}><TypeIcon className="w-6 h-6" style={{ color: typeConfig?.color }} /></div>
              <div><h2 className="text-xl font-bold text-[var(--text-primary)]">{typeConfig?.label}</h2><button onClick={() => setStep('type')} className="text-sm text-blue-400 hover:underline">← Changer</button></div>
            </div>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
          
          <div className="space-y-4">
            <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Objet *</label><Input value={formData.objet} onChange={e => updateField('objet', e.target.value)} placeholder="Résumé..." /></div>
            
            {/* CONGÉ / RTT */}
            {(formData.type_demande === 'conge' || formData.type_demande === 'rtt') && (<>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Date début *</label><Input type="date" value={formData.date_debut || ''} onChange={e => { updateField('date_debut', e.target.value); setTimeout(checkConflitsAsync, 100); }} /><label className="flex items-center gap-2 mt-2 text-sm text-[var(--text-muted)]"><input type="checkbox" checked={formData.demi_journee_debut || false} onChange={e => updateField('demi_journee_debut', e.target.checked)} className="rounded" />Après-midi</label></div>
                <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Date fin *</label><Input type="date" value={formData.date_fin || ''} onChange={e => { updateField('date_fin', e.target.value); setTimeout(checkConflitsAsync, 100); }} /><label className="flex items-center gap-2 mt-2 text-sm text-[var(--text-muted)]"><input type="checkbox" checked={formData.demi_journee_fin || false} onChange={e => updateField('demi_journee_fin', e.target.checked)} className="rounded" />Matin</label></div>
              </div>
              {nbJours > 0 && <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 flex justify-between"><span>Durée</span><span className="text-xl font-bold">{nbJours} jour(s)</span></div>}
              {soldes && <div className={`rounded-xl p-4 ${formData.type_demande === 'conge' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}><div className="flex items-center gap-2 mb-2">{formData.type_demande === 'conge' ? <Calendar className="w-4 h-4 text-cyan-400" /> : <CalendarDays className="w-4 h-4 text-emerald-400" />}<span className="text-sm font-semibold">Solde actuel</span></div>{formData.type_demande === 'conge' ? <div className="text-lg font-bold text-cyan-400">{soldes.conges_solde?.toFixed(1) || 0} jours</div> : <div className="text-lg font-bold text-emerald-400">{soldes.rtt_solde?.toFixed(1) || 0}h</div>}</div>}
              {conflits.length > 0 && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"><div className="flex items-center gap-2 text-amber-400 mb-2"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-semibold">Conflits détectés</span></div>{conflits.map(c => <div key={c.id} className="text-sm text-[var(--text-muted)]">{c.technicien?.prenom} : {format(new Date(c.date_debut!), 'dd/MM')} - {format(new Date(c.date_fin!), 'dd/MM')}</div>)}</div>}
            </>)}

            {/* PIÈCE DÉTACHÉE */}
            {formData.type_demande === 'piece' && (
              <div className="space-y-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400"><Package className="w-5 h-5" /><span className="font-semibold">Informations pièce</span></div>

                {/* Ascenseur */}
                <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Ascenseur concerné</label><Select value={formData.ascenseur_id || ''} onChange={e => updateField('ascenseur_id', e.target.value)}><option value="">Sélectionner un ascenseur...</option>{ascenseurs?.map(a => <option key={a.id} value={a.id}>{a.code} - {a.client?.nom}</option>)}</Select></div>

                {/* Toggle Catalogue / Saisie manuelle */}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Mode de saisie</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateField('saisie_manuelle', false)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!formData.saisie_manuelle ? 'bg-blue-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>📋 Catalogue</button>
                    <button onClick={() => updateField('saisie_manuelle', true)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${formData.saisie_manuelle ? 'bg-blue-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>✏️ Saisie libre</button>
                  </div>
                </div>

                {/* Sélection catalogue */}
                {!formData.saisie_manuelle && (
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Article du catalogue</label>
                    <Select value={formData.article_id || ''} onChange={e => updateField('article_id', e.target.value)}>
                      <option value="">Rechercher un article...</option>
                      {articles?.map(a => <option key={a.id} value={a.id}>{a.reference} - {a.designation} (stock: {a.quantite_stock})</option>)}
                    </Select>
                    <p className="text-xs text-[var(--text-muted)] mt-1">💡 Article non trouvé ? Passez en "Saisie libre"</p>
                  </div>
                )}

                {/* Saisie manuelle */}
                {formData.saisie_manuelle && (
                  <div className="space-y-3">
                    <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Désignation de la pièce *</label><Input value={formData.designation_piece || ''} onChange={e => updateField('designation_piece', e.target.value)} placeholder="Ex: Contacteur de niveau, Bouton palier..." /></div>
                    <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Référence (si connue)</label><Input value={formData.reference_piece || ''} onChange={e => updateField('reference_piece', e.target.value)} placeholder="Ex: REF-XYZ-123, N° fabricant..." /></div>
                  </div>
                )}

                {/* Quantité */}
                <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Quantité</label><Input type="number" min={1} value={formData.quantite || 1} onChange={e => updateField('quantite', parseInt(e.target.value) || 1)} className="w-32" /></div>

                {/* Photos */}
                <div className="pt-3 border-t border-[var(--border-primary)]">
                  <PhotoUpload photos={formData.photos || []} onChange={(photos) => updateField('photos', photos)} maxPhotos={5} />
                  <p className="text-xs text-[var(--text-muted)] mt-2">📸 Prenez en photo la pièce défectueuse, l'étiquette, la plaque signalétique...</p>
                </div>
              </div>
            )}

            {/* FORMATION */}
            {formData.type_demande === 'formation' && (<>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Organisme</label><Input value={formData.organisme_formation || ''} onChange={e => updateField('organisme_formation', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Durée</label><Input value={formData.duree_formation || ''} onChange={e => updateField('duree_formation', e.target.value)} placeholder="2 jours..." /></div><div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Coût (€)</label><Input type="number" value={formData.cout_estime || ''} onChange={e => updateField('cout_estime', parseFloat(e.target.value) || 0)} /></div></div>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Objectif</label><Textarea value={formData.objectif_formation || ''} onChange={e => updateField('objectif_formation', e.target.value)} rows={2} /></div>
            </>)}

            {/* MATÉRIEL */}
            {formData.type_demande === 'materiel' && (<>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Désignation</label><Input value={formData.designation_materiel || ''} onChange={e => updateField('designation_materiel', e.target.value)} /></div>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Référence</label><Input value={formData.reference_materiel || ''} onChange={e => updateField('reference_materiel', e.target.value)} /></div>
            </>)}

            {/* INTERVENTION */}
            {formData.type_demande === 'intervention' && (<>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Motif urgence *</label><Input value={formData.motif_urgence || ''} onChange={e => updateField('motif_urgence', e.target.value)} /></div>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Adresse</label><Input value={formData.adresse_intervention || ''} onChange={e => updateField('adresse_intervention', e.target.value)} /></div>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Ascenseur</label><Select value={formData.ascenseur_id || ''} onChange={e => updateField('ascenseur_id', e.target.value)}><option value="">Sélectionner...</option>{ascenseurs?.map(a => <option key={a.id} value={a.id}>{a.code} - {a.client?.nom}</option>)}</Select></div>
            </>)}

            {/* REMBOURSEMENT */}
            {formData.type_demande === 'remboursement' && (<>
              <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Catégorie *</label><Select value={formData.categorie_remboursement || ''} onChange={e => updateField('categorie_remboursement', e.target.value)}><option value="">Sélectionner...</option>{Object.entries(CATEGORIE_REMBOURSEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Montant (€) *</label><Input type="number" step="0.01" value={formData.montant || ''} onChange={e => updateField('montant', parseFloat(e.target.value) || 0)} /></div><div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Date dépense</label><Input type="date" value={formData.date_depense || ''} onChange={e => updateField('date_depense', e.target.value)} /></div></div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2 text-amber-400 text-sm"><Paperclip className="w-4 h-4" />Joindre justificatif</div>
            </>)}

            {/* Priorité */}
            <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Priorité</label><div className="flex gap-2">{Object.entries(PRIORITE_CONFIG).map(([key, config]) => <button key={key} onClick={() => updateField('priorite', key)} className={`flex-1 py-2 rounded-lg border-2 transition-all ${formData.priorite === key ? 'border-blue-500 bg-blue-500/20' : 'border-[var(--border-primary)]'}`}><Badge variant={config.color}>{config.label}</Badge></button>)}</div></div>
            
            {/* Description */}
            <div><label className="text-sm text-[var(--text-secondary)] mb-1 block">Description</label><Textarea value={formData.description || ''} onChange={e => updateField('description', e.target.value)} rows={2} placeholder="Détails supplémentaires..." /></div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]"><Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button><Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer</>}</Button></div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// COMPOSANT DÉTAIL DEMANDE
// =============================================
function DemandeDetailModal({ demande, onClose }: { demande: Demande; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [commentaire, setCommentaire] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [showRefus, setShowRefus] = useState(false);

  const { data: historique } = useQuery({
    queryKey: ['demande-historique', demande.id],
    queryFn: () => getDemandeHistorique(demande.id),
  });

  const traiterMutation = useMutation({
    mutationFn: ({ statut, motif }: { statut: StatutDemande; motif?: string }) => 
      traiterDemande(demande.id, statut, CURRENT_USER_ID, commentaire || undefined, motif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success('Demande traitée');
      onClose();
    },
  });

  const typeConfig = TYPE_CONFIG[demande.type_demande];
  const TypeIcon = typeConfig?.icon || HelpCircle;
  const photos = (demande as any).photos_json ? JSON.parse((demande as any).photos_json) : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${typeConfig?.bgColor} flex items-center justify-center`}><TypeIcon className="w-7 h-7" style={{ color: typeConfig?.color }} /></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-pink-400">{demande.code}</span>
                  <Badge variant={STATUT_CONFIG[demande.statut].color}>{STATUT_CONFIG[demande.statut].label}</Badge>
                  <Badge variant={PRIORITE_CONFIG[demande.priorite].color}>{PRIORITE_CONFIG[demande.priorite].label}</Badge>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{demande.objet}</h2>
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-1">
                  <User className="w-3 h-3" />{demande.technicien?.prenom} {demande.technicien?.nom} • {format(new Date(demande.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                </div>
              </div>
            </div>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-4">
            {demande.description && <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><div className="text-sm text-[var(--text-secondary)] mb-2">Description</div><p className="text-[var(--text-primary)] whitespace-pre-wrap">{demande.description}</p></div>}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="text-sm text-[var(--text-secondary)] mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Photos jointes ({photos.length})</div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((photo: string, idx: number) => (
                    <a key={idx} href={photo} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
                      <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Infos congé/RTT */}
            {(demande.type_demande === 'conge' || demande.type_demande === 'rtt') && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg"><div className="text-xs text-[var(--text-muted)]">Du</div><div className="font-semibold">{demande.date_debut && format(new Date(demande.date_debut), 'd MMM yyyy', { locale: fr })}</div></div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg"><div className="text-xs text-[var(--text-muted)]">Au</div><div className="font-semibold">{demande.date_fin && format(new Date(demande.date_fin), 'd MMM yyyy', { locale: fr })}</div></div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg"><div className="text-xs text-[var(--text-muted)]">Durée</div><div className="font-semibold">{demande.nb_jours} jour(s)</div></div>
              </div>
            )}

            {/* Infos pièce */}
            {demande.type_demande === 'piece' && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                {demande.article && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-blue-400" /><span className="font-medium">{demande.article.reference} - {demande.article.designation}</span><Badge variant="blue">Qté: {demande.quantite}</Badge></div>}
                {demande.ascenseur && <div className="text-sm text-[var(--text-muted)]">Ascenseur: {demande.ascenseur.code} - {demande.ascenseur.client?.nom}</div>}
              </div>
            )}

            {/* Infos remboursement */}
            {demande.type_demande === 'remboursement' && demande.montant && (
              <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">{CATEGORIE_REMBOURSEMENT[demande.categorie_remboursement!]}</span>
                <span className="text-2xl font-bold text-pink-400">{demande.montant.toFixed(2)} €</span>
              </div>
            )}

            {/* Motif refus */}
            {demande.statut === 'refuse' && demande.motif_refus && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-400 mb-2"><XCircle className="w-4 h-4" /><span className="font-semibold">Motif du refus</span></div>
                <p className="text-[var(--text-primary)]">{demande.motif_refus}</p>
              </div>
            )}

            {/* Historique */}
            {historique && historique.length > 0 && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-3"><History className="w-4 h-4" /><span className="font-semibold">Historique</span></div>
                <div className="space-y-3">
                  {historique.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="font-medium text-[var(--text-primary)]">{h.action}</span>{h.nouveau_statut && <Badge variant={STATUT_CONFIG[h.nouveau_statut as StatutDemande]?.color || 'gray'}>{STATUT_CONFIG[h.nouveau_statut as StatutDemande]?.label}</Badge>}</div>
                        {h.commentaire && <p className="text-sm text-[var(--text-muted)]">{h.commentaire}</p>}
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{format(new Date(h.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions admin */}
            {IS_ADMIN && demande.statut === 'en_attente' && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]"><MessageSquare className="w-4 h-4" /><span className="font-semibold">Traiter la demande</span></div>
                <Textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Commentaire (optionnel)..." rows={2} />
                {showRefus && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"><label className="text-sm text-red-400 mb-1 block">Motif du refus *</label><Textarea value={motifRefus} onChange={e => setMotifRefus(e.target.value)} placeholder="Raison du refus..." rows={2} /></div>}
                <div className="flex gap-3">
                  <Button variant="success" className="flex-1" onClick={() => traiterMutation.mutate({ statut: 'approuve' })} disabled={traiterMutation.isPending}><Check className="w-4 h-4" /> Approuver</Button>
                  {!showRefus ? (
                    <Button variant="danger" className="flex-1" onClick={() => setShowRefus(true)}><X className="w-4 h-4" /> Refuser</Button>
                  ) : (
                    <Button variant="danger" className="flex-1" onClick={() => { if (!motifRefus.trim()) { toast.error('Motif obligatoire'); return; } traiterMutation.mutate({ statut: 'refuse', motif: motifRefus }); }} disabled={traiterMutation.isPending}><X className="w-4 h-4" /> Confirmer refus</Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border-primary)]"><Button variant="secondary" className="w-full" onClick={onClose}>Fermer</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function DemandesPage() {
  const [showForm, setShowForm] = useState(false);
  const [viewDemande, setViewDemande] = useState<Demande | null>(null);
  const [archiveItem, setArchiveItem] = useState<Demande | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: demandes, isLoading } = useQuery({ queryKey: ['demandes'], queryFn: () => getDemandes() });
  const { data: stats } = useQuery({ queryKey: ['demandes-stats'], queryFn: getDemandesStats });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveDemande(id, CURRENT_USER_ID, raison),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['demandes'] }); toast.success('Demande archivée'); setArchiveItem(null); },
  });

  const filtered = useMemo(() => {
    return demandes?.filter(d => {
      if (filterStatut !== 'all' && d.statut !== filterStatut) return false;
      if (filterType !== 'all' && d.type_demande !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return d.code.toLowerCase().includes(q) || d.objet.toLowerCase().includes(q) || d.technicien?.prenom?.toLowerCase().includes(q) || d.technicien?.nom?.toLowerCase().includes(q);
      }
      return true;
    }) || [];
  }, [demandes, filterStatut, filterType, searchQuery]);

  const enAttente = demandes?.filter(d => d.statut === 'en_attente').length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center"><HelpCircle className="w-6 h-6 text-pink-400" /></div><div><div className="text-2xl font-extrabold">{stats?.total || demandes?.length || 0}</div><div className="text-xs text-[var(--text-tertiary)]">Total</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"><Clock className="w-6 h-6 text-amber-400" /></div><div><div className="text-2xl font-extrabold text-amber-400">{stats?.en_attente || enAttente}</div><div className="text-xs text-[var(--text-tertiary)]">En attente</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><Check className="w-6 h-6 text-green-400" /></div><div><div className="text-2xl font-extrabold text-green-400">{stats?.approuve || 0}</div><div className="text-xs text-[var(--text-tertiary)]">Approuvées</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center"><X className="w-6 h-6 text-red-400" /></div><div><div className="text-2xl font-extrabold text-red-400">{stats?.refuse || 0}</div><div className="text-xs text-[var(--text-tertiary)]">Refusées</div></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-purple-400" /></div><div><div className="text-2xl font-extrabold text-purple-400">{stats?.termine || 0}</div><div className="text-xs text-[var(--text-tertiary)]">Terminées</div></div></CardBody></Card>
      </div>

      {/* Alerte */}
      {enAttente > 0 && IS_ADMIN && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-amber-400">{enAttente} demande{enAttente > 1 ? 's' : ''} en attente</span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setFilterStatut('en_attente')}>Voir</Button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="pl-10 w-64" /></div>
          <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-40"><option value="all">Tous les statuts</option>{Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-48"><option value="all">Tous les types</option>{Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nouvelle demande</Button>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {isLoading ? <Card><CardBody className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardBody></Card> : filtered.length === 0 ? (
          <Card><CardBody className="text-center py-12"><HelpCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><p className="text-[var(--text-muted)]">Aucune demande trouvée</p><Button variant="primary" className="mt-4" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Créer une demande</Button></CardBody></Card>
        ) : filtered.map(demande => {
          const typeConfig = TYPE_CONFIG[demande.type_demande];
          const Icon = typeConfig?.icon || HelpCircle;
          const hasPhotos = (demande as any).photos_json && JSON.parse((demande as any).photos_json).length > 0;
          return (
            <Card key={demande.id} className="hover:border-[var(--border-secondary)] transition-colors">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${typeConfig?.bgColor} flex items-center justify-center`}><Icon className="w-6 h-6" style={{ color: typeConfig?.color }} /></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-pink-400">{demande.code}</span>
                        <Badge variant={STATUT_CONFIG[demande.statut].color}>{STATUT_CONFIG[demande.statut].label}</Badge>
                        <Badge variant={PRIORITE_CONFIG[demande.priorite].color}>{PRIORITE_CONFIG[demande.priorite].label}</Badge>
                        <Badge variant="gray">{typeConfig?.label}</Badge>
                        {hasPhotos && <span className="text-xs text-blue-400 flex items-center gap-1"><Camera className="w-3 h-3" /> Photos</span>}
                      </div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{demande.objet}</h3>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {demande.technicien?.prenom} {demande.technicien?.nom}</span>
                        <span>{formatDistanceToNow(new Date(demande.created_at), { addSuffix: true, locale: fr })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewDemande(demande)} className="p-2 hover:bg-blue-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-blue-400" title="Voir"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => setArchiveItem(demande)} className="p-2 hover:bg-amber-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-amber-400" title="Archiver"><Archive className="w-4 h-4" /></button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Modals */}
      {showForm && <DemandeFormModal onClose={() => setShowForm(false)} onSuccess={() => setShowForm(false)} />}
      {viewDemande && <DemandeDetailModal demande={viewDemande} onClose={() => setViewDemande(null)} />}
      {archiveItem && <ArchiveModal type="demande" code={archiveItem.code} libelle={archiveItem.objet} onClose={() => setArchiveItem(null)} onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })} isLoading={archiveMutation.isPending} />}
    </div>
  );
}
