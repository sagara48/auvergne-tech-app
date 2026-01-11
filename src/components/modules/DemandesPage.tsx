import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  HelpCircle, Search, Check, X, Clock, Package, Calendar, GraduationCap, Plus, User, 
  Archive, Eye, FileText, Send, Save, ChevronDown, ChevronUp, MessageSquare, 
  Wrench, AlertTriangle, Receipt, Upload, Trash2, History, Filter, CalendarDays,
  TrendingUp, Building2, MapPin, Euro, Paperclip, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select, Textarea } from '@/components/ui';
import { 
  getDemandes, createDemande, updateDemande, traiterDemande, archiveDemande,
  getDemandeHistorique, addDemandeComment,
  getStockArticles, getAscenseurs, getSoldeConges, getTechniciens
} from '@/services/api';
import { ArchiveModal } from './ArchivesPage';
import { format, parseISO, differenceInBusinessDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeDemande, StatutDemande, Priorite, Demande, CategorieRemboursement, StockArticle, Ascenseur, DemandeHistorique } from '@/types';
import toast from 'react-hot-toast';

// ID utilisateur actuel (à remplacer par auth)
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';
const IS_ADMIN = true; // À remplacer par vérification rôle

// ============================================
// CONFIGURATIONS
// ============================================
const TYPE_CONFIG: Record<TypeDemande, { label: string; icon: any; color: string; bgColor: string }> = {
  piece: { label: 'Pièce détachée', icon: Package, color: '#3b82f6', bgColor: 'bg-blue-500/20' },
  conge: { label: 'Congé payé', icon: Calendar, color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  rtt: { label: 'RTT', icon: Clock, color: '#10b981', bgColor: 'bg-emerald-500/20' },
  formation: { label: 'Formation', icon: GraduationCap, color: '#a855f7', bgColor: 'bg-purple-500/20' },
  materiel: { label: 'Matériel/Outillage', icon: Wrench, color: '#f59e0b', bgColor: 'bg-amber-500/20' },
  intervention: { label: 'Intervention urgente', icon: AlertTriangle, color: '#ef4444', bgColor: 'bg-red-500/20' },
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

const CATEGORIES_REMBOURSEMENT: Record<CategorieRemboursement, { label: string; icon: string }> = {
  carburant: { label: 'Carburant', icon: '⛽' },
  peage: { label: 'Péage', icon: '🛣️' },
  parking: { label: 'Parking', icon: '🅿️' },
  repas: { label: 'Repas', icon: '🍽️' },
  hotel: { label: 'Hôtel', icon: '🏨' },
  transport: { label: 'Transport', icon: '🚆' },
  materiel: { label: 'Matériel', icon: '🔧' },
  autre: { label: 'Autre', icon: '📝' },
};

// ============================================
// COMPOSANT FORMULAIRE DYNAMIQUE
// ============================================
interface DemandeFormProps {
  demande?: Demande | null;
  onClose: () => void;
  onSave: (data: Partial<Demande>, asBrouillon?: boolean) => void;
  isLoading?: boolean;
}

function DemandeForm({ demande, onClose, onSave, isLoading }: DemandeFormProps) {
  const [formData, setFormData] = useState<Partial<Demande>>({
    type_demande: demande?.type_demande || 'piece',
    objet: demande?.objet || '',
    description: demande?.description || '',
    priorite: demande?.priorite || 'normale',
    // Congé/RTT
    date_debut: demande?.date_debut || format(new Date(), 'yyyy-MM-dd'),
    date_fin: demande?.date_fin || format(new Date(), 'yyyy-MM-dd'),
    demi_journee_debut: demande?.demi_journee_debut || false,
    demi_journee_fin: demande?.demi_journee_fin || false,
    // Pièce
    article_id: demande?.article_id || '',
    quantite: demande?.quantite || 1,
    ascenseur_id: demande?.ascenseur_id || '',
    // Formation
    organisme_formation: demande?.organisme_formation || '',
    duree_formation: demande?.duree_formation || '',
    cout_estime: demande?.cout_estime || 0,
    objectif_formation: demande?.objectif_formation || '',
    // Matériel
    designation_materiel: demande?.designation_materiel || '',
    reference_materiel: demande?.reference_materiel || '',
    // Intervention
    motif_urgence: demande?.motif_urgence || '',
    adresse_intervention: demande?.adresse_intervention || '',
    // Remboursement
    categorie_remboursement: demande?.categorie_remboursement || 'autre',
    montant: demande?.montant || 0,
    date_depense: demande?.date_depense || format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: articles } = useQuery({ queryKey: ['stock-articles'], queryFn: getStockArticles });
  const { data: ascenseurs } = useQuery({ queryKey: ['ascenseurs'], queryFn: getAscenseurs });
  const { data: soldes } = useQuery({ 
    queryKey: ['soldes-conges', CURRENT_USER_ID], 
    queryFn: () => getSoldeConges(CURRENT_USER_ID),
    enabled: formData.type_demande === 'conge' || formData.type_demande === 'rtt'
  });

  // Calcul automatique du nombre de jours
  const nbJours = useMemo(() => {
    if (!formData.date_debut || !formData.date_fin) return 0;
    const debut = parseISO(formData.date_debut);
    const fin = parseISO(formData.date_fin);
    let jours = differenceInBusinessDays(fin, debut) + 1;
    if (formData.demi_journee_debut) jours -= 0.5;
    if (formData.demi_journee_fin) jours -= 0.5;
    return Math.max(0, jours);
  }, [formData.date_debut, formData.date_fin, formData.demi_journee_debut, formData.demi_journee_fin]);

  const handleSubmit = (asBrouillon = false) => {
    // Validation basique
    if (!formData.objet?.trim()) {
      toast.error('L\'objet est requis');
      return;
    }
    
    onSave({
      ...formData,
      nb_jours: nbJours,
      technicien_id: CURRENT_USER_ID,
    }, asBrouillon);
  };

  const typeConfig = TYPE_CONFIG[formData.type_demande as TypeDemande];
  const TypeIcon = typeConfig?.icon || HelpCircle;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${typeConfig?.bgColor} flex items-center justify-center`}>
                <TypeIcon className="w-6 h-6" style={{ color: typeConfig?.color }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {demande ? 'Modifier la demande' : 'Nouvelle demande'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {demande?.code || 'Remplissez les informations ci-dessous'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-2">
            {/* Type de demande */}
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Type de demande</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setFormData({ ...formData, type_demande: key as TypeDemande })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        formData.type_demande === key
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                          : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" style={{ color: config.color }} />
                      <span className="text-xs font-medium">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Objet et priorité */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">Objet *</label>
                <Input
                  value={formData.objet}
                  onChange={e => setFormData({ ...formData, objet: e.target.value })}
                  placeholder="Résumé de votre demande..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">Priorité</label>
                <Select 
                  value={formData.priorite} 
                  onChange={e => setFormData({ ...formData, priorite: e.target.value as Priorite })}
                >
                  {Object.entries(PRIORITE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* === CHAMPS SPÉCIFIQUES SELON LE TYPE === */}

            {/* CONGÉ / RTT */}
            {(formData.type_demande === 'conge' || formData.type_demande === 'rtt') && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formData.type_demande === 'conge' ? 'Demande de congé' : 'Demande de RTT'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date de début</label>
                    <Input
                      type="date"
                      value={formData.date_debut}
                      onChange={e => setFormData({ ...formData, date_debut: e.target.value })}
                    />
                    <label className="flex items-center gap-2 mt-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={formData.demi_journee_debut}
                        onChange={e => setFormData({ ...formData, demi_journee_debut: e.target.checked })}
                        className="rounded"
                      />
                      Commence l'après-midi
                    </label>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date de fin</label>
                    <Input
                      type="date"
                      value={formData.date_fin}
                      onChange={e => setFormData({ ...formData, date_fin: e.target.value })}
                    />
                    <label className="flex items-center gap-2 mt-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={formData.demi_journee_fin}
                        onChange={e => setFormData({ ...formData, demi_journee_fin: e.target.checked })}
                        className="rounded"
                      />
                      Finit le matin
                    </label>
                  </div>
                </div>

                {/* Résumé calcul */}
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--text-secondary)]">Durée calculée :</span>
                    <span className="text-lg font-bold text-[var(--text-primary)]">{nbJours} jour(s)</span>
                  </div>
                </div>

                {/* Soldes actuels */}
                {soldes && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className={`p-3 rounded-lg ${formData.type_demande === 'conge' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-[var(--bg-secondary)]'}`}>
                      <div className="text-xs text-[var(--text-muted)] uppercase">Congés restants</div>
                      <div className="text-xl font-bold text-cyan-400">{soldes.conges_solde?.toFixed(1) || 0}j</div>
                    </div>
                    <div className={`p-3 rounded-lg ${formData.type_demande === 'rtt' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-[var(--bg-secondary)]'}`}>
                      <div className="text-xs text-[var(--text-muted)] uppercase">RTT restants</div>
                      <div className="text-xl font-bold text-emerald-400">{soldes.rtt_solde?.toFixed(1) || 0}h</div>
                    </div>
                  </div>
                )}

                {/* Alerte si solde insuffisant */}
                {formData.type_demande === 'conge' && soldes && nbJours > (soldes.conges_solde || 0) && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Attention : solde congés insuffisant ({soldes.conges_solde?.toFixed(1)}j disponibles)
                  </div>
                )}
              </div>
            )}

            {/* PIÈCE DÉTACHÉE */}
            {formData.type_demande === 'piece' && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-[var(--text-primary)]">Demande de pièce</span>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Ascenseur concerné</label>
                  <Select
                    value={formData.ascenseur_id}
                    onChange={e => setFormData({ ...formData, ascenseur_id: e.target.value })}
                  >
                    <option value="">Sélectionner un ascenseur...</option>
                    {ascenseurs?.map(asc => (
                      <option key={asc.id} value={asc.id}>
                        {asc.numero_serie} - {asc.client?.nom} ({asc.adresse})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Article demandé</label>
                  <Select
                    value={formData.article_id}
                    onChange={e => setFormData({ ...formData, article_id: e.target.value })}
                  >
                    <option value="">Sélectionner un article ou saisir dans description...</option>
                    {articles?.map(art => (
                      <option key={art.id} value={art.id}>
                        {art.reference} - {art.designation} (stock: {art.quantite_stock})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Quantité</label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.quantite}
                      onChange={e => setFormData({ ...formData, quantite: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Urgence</label>
                    <Select 
                      value={formData.priorite} 
                      onChange={e => setFormData({ ...formData, priorite: e.target.value as Priorite })}
                    >
                      <option value="normale">Normale</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente - Ascenseur à l'arrêt</option>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* FORMATION */}
            {formData.type_demande === 'formation' && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-[var(--text-primary)]">Demande de formation</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Organisme de formation</label>
                    <Input
                      value={formData.organisme_formation}
                      onChange={e => setFormData({ ...formData, organisme_formation: e.target.value })}
                      placeholder="Nom de l'organisme..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Durée</label>
                    <Input
                      value={formData.duree_formation}
                      onChange={e => setFormData({ ...formData, duree_formation: e.target.value })}
                      placeholder="Ex: 2 jours, 35h..."
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Coût estimé (€)</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.cout_estime}
                    onChange={e => setFormData({ ...formData, cout_estime: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Objectif de la formation</label>
                  <Textarea
                    value={formData.objectif_formation}
                    onChange={e => setFormData({ ...formData, objectif_formation: e.target.value })}
                    placeholder="Pourquoi souhaitez-vous suivre cette formation..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* MATÉRIEL / OUTILLAGE */}
            {formData.type_demande === 'materiel' && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold text-[var(--text-primary)]">Demande de matériel/outillage</span>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Désignation du matériel</label>
                  <Input
                    value={formData.designation_materiel}
                    onChange={e => setFormData({ ...formData, designation_materiel: e.target.value })}
                    placeholder="Ex: Perceuse visseuse, EPI..."
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Référence (si connue)</label>
                  <Input
                    value={formData.reference_materiel}
                    onChange={e => setFormData({ ...formData, reference_materiel: e.target.value })}
                    placeholder="Référence fabricant..."
                  />
                </div>
              </div>
            )}

            {/* INTERVENTION URGENTE */}
            {formData.type_demande === 'intervention' && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="font-semibold text-[var(--text-primary)]">Demande d'intervention urgente</span>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Ascenseur concerné</label>
                  <Select
                    value={formData.ascenseur_id}
                    onChange={e => setFormData({ ...formData, ascenseur_id: e.target.value })}
                  >
                    <option value="">Sélectionner un ascenseur...</option>
                    {ascenseurs?.map(asc => (
                      <option key={asc.id} value={asc.id}>
                        {asc.numero_serie} - {asc.client?.nom} ({asc.adresse})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Motif de l'urgence</label>
                  <Textarea
                    value={formData.motif_urgence}
                    onChange={e => setFormData({ ...formData, motif_urgence: e.target.value })}
                    placeholder="Décrivez la situation..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">Adresse d'intervention</label>
                  <Input
                    value={formData.adresse_intervention}
                    onChange={e => setFormData({ ...formData, adresse_intervention: e.target.value })}
                    placeholder="Adresse complète..."
                  />
                </div>
              </div>
            )}

            {/* REMBOURSEMENT */}
            {formData.type_demande === 'remboursement' && (
              <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-5 h-5 text-pink-400" />
                  <span className="font-semibold text-[var(--text-primary)]">Demande de remboursement</span>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-2 block">Catégorie</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(CATEGORIES_REMBOURSEMENT).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, categorie_remboursement: key as CategorieRemboursement })}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          formData.categorie_remboursement === key
                            ? 'border-pink-500 bg-pink-500/10'
                            : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                        }`}
                      >
                        <span className="text-xl">{config.icon}</span>
                        <span className="text-xs font-medium">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Montant (€)</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.montant}
                      onChange={e => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">Date de la dépense</label>
                    <Input
                      type="date"
                      value={formData.date_depense}
                      onChange={e => setFormData({ ...formData, date_depense: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-4 border-2 border-dashed border-[var(--border-primary)] rounded-xl text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Glissez votre justificatif ou</p>
                  <Button variant="secondary" size="sm" className="mt-2">
                    <Paperclip className="w-4 h-4" /> Parcourir
                  </Button>
                </div>
              </div>
            )}

            {/* Description (toujours visible) */}
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                Description / Commentaire
              </label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails supplémentaires..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => handleSubmit(true)} 
              disabled={isLoading}
            >
              <Save className="w-4 h-4" /> Brouillon
            </Button>
            <Button 
              variant="primary" 
              onClick={() => handleSubmit(false)} 
              disabled={isLoading}
              className="flex-1"
            >
              <Send className="w-4 h-4" /> Envoyer la demande
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// COMPOSANT DÉTAIL DEMANDE
// ============================================
function DemandeDetail({ demande, onClose, onTraiter }: { 
  demande: Demande; 
  onClose: () => void;
  onTraiter: (statut: StatutDemande, commentaire?: string, motifRefus?: string) => void;
}) {
  const [commentaire, setCommentaire] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [showRefusForm, setShowRefusForm] = useState(false);

  const { data: historique } = useQuery({
    queryKey: ['demande-historique', demande.id],
    queryFn: () => getDemandeHistorique(demande.id),
  });

  const typeConfig = TYPE_CONFIG[demande.type_demande];
  const TypeIcon = typeConfig?.icon || HelpCircle;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${typeConfig?.bgColor} flex items-center justify-center`}>
                <TypeIcon className="w-7 h-7" style={{ color: typeConfig?.color }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-pink-400">{demande.code}</span>
                  <Badge variant={STATUT_CONFIG[demande.statut].color}>
                    {STATUT_CONFIG[demande.statut].label}
                  </Badge>
                  <Badge variant={PRIORITE_CONFIG[demande.priorite].color}>
                    {PRIORITE_CONFIG[demande.priorite].label}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">{demande.objet}</h2>
                <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mt-1">
                  {demande.technicien && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {demande.technicien.prenom} {demande.technicien.nom}
                    </span>
                  )}
                  <span>{format(new Date(demande.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Informations principales */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <FileText className="w-4 h-4" />
                <span className="font-semibold">Détails de la demande</span>
              </div>
              
              {demande.description && (
                <p className="text-[var(--text-primary)]">{demande.description}</p>
              )}

              {/* Infos spécifiques selon type */}
              {(demande.type_demande === 'conge' || demande.type_demande === 'rtt') && (
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Du</div>
                    <div className="font-semibold">{demande.date_debut && format(parseISO(demande.date_debut), 'd MMM yyyy', { locale: fr })}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Au</div>
                    <div className="font-semibold">{demande.date_fin && format(parseISO(demande.date_fin), 'd MMM yyyy', { locale: fr })}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Durée</div>
                    <div className="font-semibold">{demande.nb_jours} jour(s)</div>
                  </div>
                </div>
              )}

              {demande.type_demande === 'piece' && (
                <div className="space-y-2">
                  {demande.article && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-400" />
                      <span>{demande.article.reference} - {demande.article.designation}</span>
                      <Badge variant="blue">Qté: {demande.quantite}</Badge>
                    </div>
                  )}
                  {demande.ascenseur && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>{demande.ascenseur.numero_serie} - {demande.ascenseur.client?.nom}</span>
                    </div>
                  )}
                </div>
              )}

              {demande.type_demande === 'formation' && (
                <div className="grid grid-cols-2 gap-4">
                  {demande.organisme_formation && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Organisme</div>
                      <div className="font-medium">{demande.organisme_formation}</div>
                    </div>
                  )}
                  {demande.duree_formation && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Durée</div>
                      <div className="font-medium">{demande.duree_formation}</div>
                    </div>
                  )}
                  {demande.cout_estime && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Coût estimé</div>
                      <div className="font-medium">{demande.cout_estime.toLocaleString()} €</div>
                    </div>
                  )}
                </div>
              )}

              {demande.type_demande === 'remboursement' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Catégorie</div>
                    <div className="font-semibold flex items-center gap-2">
                      {demande.categorie_remboursement && CATEGORIES_REMBOURSEMENT[demande.categorie_remboursement]?.icon}
                      {demande.categorie_remboursement && CATEGORIES_REMBOURSEMENT[demande.categorie_remboursement]?.label}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Montant</div>
                    <div className="font-semibold text-pink-400">{demande.montant?.toFixed(2)} €</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="text-xs text-[var(--text-muted)]">Date dépense</div>
                    <div className="font-semibold">{demande.date_depense && format(parseISO(demande.date_depense), 'd MMM yyyy', { locale: fr })}</div>
                  </div>
                </div>
              )}

              {demande.type_demande === 'intervention' && (
                <div className="space-y-2">
                  {demande.motif_urgence && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Motif urgence</div>
                      <div className="font-medium text-red-400">{demande.motif_urgence}</div>
                    </div>
                  )}
                  {demande.adresse_intervention && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>{demande.adresse_intervention}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Motif de refus si refusé */}
            {demande.statut === 'refuse' && demande.motif_refus && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <X className="w-4 h-4" />
                  <span className="font-semibold">Motif du refus</span>
                </div>
                <p className="text-[var(--text-primary)]">{demande.motif_refus}</p>
              </div>
            )}

            {/* Historique */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-4">
                <History className="w-4 h-4" />
                <span className="font-semibold">Historique</span>
              </div>
              
              <div className="space-y-3">
                {historique?.map((h, idx) => (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] mt-2" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{h.action}</span>
                        {h.nouveau_statut && (
                          <Badge variant={STATUT_CONFIG[h.nouveau_statut].color} className="text-xs">
                            {STATUT_CONFIG[h.nouveau_statut].label}
                          </Badge>
                        )}
                      </div>
                      {h.commentaire && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">{h.commentaire}</p>
                      )}
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        {h.effectue_par_technicien && `${h.effectue_par_technicien.prenom} ${h.effectue_par_technicien.nom} • `}
                        {format(new Date(h.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions admin */}
            {IS_ADMIN && demande.statut === 'en_attente' && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <MessageSquare className="w-4 h-4" />
                  <span className="font-semibold">Traiter la demande</span>
                </div>

                <Textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Commentaire (optionnel)..."
                  rows={2}
                />

                {showRefusForm && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <label className="text-sm text-red-400 mb-1 block">Motif du refus *</label>
                    <Textarea
                      value={motifRefus}
                      onChange={e => setMotifRefus(e.target.value)}
                      placeholder="Expliquez la raison du refus..."
                      rows={2}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="success" 
                    className="flex-1"
                    onClick={() => onTraiter('approuve', commentaire)}
                  >
                    <Check className="w-4 h-4" /> Approuver
                  </Button>
                  {!showRefusForm ? (
                    <Button 
                      variant="danger" 
                      className="flex-1"
                      onClick={() => setShowRefusForm(true)}
                    >
                      <X className="w-4 h-4" /> Refuser
                    </Button>
                  ) : (
                    <Button 
                      variant="danger" 
                      className="flex-1"
                      onClick={() => {
                        if (!motifRefus.trim()) {
                          toast.error('Le motif de refus est obligatoire');
                          return;
                        }
                        onTraiter('refuse', commentaire, motifRefus);
                      }}
                    >
                      <X className="w-4 h-4" /> Confirmer refus
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
            <Button variant="secondary" onClick={onClose} className="w-full">
              Fermer
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================
// COMPOSANT CALENDRIER CONGÉS
// ============================================
function CalendrierConges({ demandes }: { demandes: Demande[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const conges = demandes.filter(d => 
    (d.type_demande === 'conge' || d.type_demande === 'rtt') && 
    d.statut !== 'refuse' && d.statut !== 'brouillon'
  );

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getCongesForDay = (day: Date) => {
    return conges.filter(c => {
      if (!c.date_debut || !c.date_fin) return false;
      const debut = parseISO(c.date_debut);
      const fin = parseISO(c.date_fin);
      return day >= debut && day <= fin;
    });
  };

  const prevMonth = () => setCurrentMonth(prev => addDays(startOfMonth(prev), -1));
  const nextMonth = () => setCurrentMonth(prev => addDays(endOfMonth(prev), 1));

  return (
    <Card>
      <CardBody>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-[var(--text-primary)]">Calendrier des congés</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-[var(--text-primary)] min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grille jours */}
        <div className="grid grid-cols-7 gap-1">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-[var(--text-muted)] py-2">
              {d}
            </div>
          ))}
          
          {/* Padding pour aligner au bon jour */}
          {Array.from({ length: (startOfMonth(currentMonth).getDay() + 6) % 7 }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          
          {days.map(day => {
            const dayConges = getCongesForDay(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[60px] p-1 rounded-lg border transition-all ${
                  isToday(day) 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : isWeekend
                    ? 'border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50'
                    : 'border-[var(--border-primary)]'
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isToday(day) ? 'text-blue-400' : isWeekend ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayConges.slice(0, 2).map(c => (
                    <div
                      key={c.id}
                      className={`text-[9px] truncate px-1 py-0.5 rounded ${
                        c.type_demande === 'conge' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'bg-emerald-500/20 text-emerald-400'
                      } ${c.statut === 'en_attente' ? 'opacity-60' : ''}`}
                      title={`${c.technicien?.prenom} - ${c.objet}`}
                    >
                      {c.technicien?.prenom?.charAt(0)}.
                    </div>
                  ))}
                  {dayConges.length > 2 && (
                    <div className="text-[9px] text-[var(--text-muted)]">+{dayConges.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-cyan-500/40" />
            <span className="text-xs text-[var(--text-muted)]">Congé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/40" />
            <span className="text-xs text-[var(--text-muted)]">RTT</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-3 h-3 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] opacity-60" />
            <span className="text-xs text-[var(--text-muted)]">En attente</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================
// PAGE PRINCIPALE DEMANDES
// ============================================
export function DemandesPage() {
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDemande, setEditDemande] = useState<Demande | null>(null);
  const [viewDemande, setViewDemande] = useState<Demande | null>(null);
  const [archiveItem, setArchiveItem] = useState<Demande | null>(null);
  const [activeView, setActiveView] = useState<'liste' | 'calendrier'>('liste');
  
  const queryClient = useQueryClient();

  const { data: demandes, isLoading } = useQuery({ 
    queryKey: ['demandes'], 
    queryFn: () => getDemandes() 
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Demande>) => createDemande(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success('Demande créée avec succès');
      setShowForm(false);
      setEditDemande(null);
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Demande> }) => updateDemande(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      toast.success('Demande mise à jour');
      setShowForm(false);
      setEditDemande(null);
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const traiterMutation = useMutation({
    mutationFn: ({ id, statut, commentaire, motifRefus }: { 
      id: string; 
      statut: StatutDemande; 
      commentaire?: string;
      motifRefus?: string;
    }) => traiterDemande(id, statut, CURRENT_USER_ID, commentaire, motifRefus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      queryClient.invalidateQueries({ queryKey: ['demande-historique'] });
      toast.success(variables.statut === 'approuve' ? 'Demande approuvée' : 'Demande refusée');
      setViewDemande(null);
    },
    onError: () => toast.error('Erreur lors du traitement'),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, raison }: { id: string; raison: string }) => archiveDemande(id, CURRENT_USER_ID, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      toast.success('Demande archivée');
      setArchiveItem(null);
    },
    onError: () => toast.error("Erreur lors de l'archivage"),
  });

  // Filtrage
  const filtered = useMemo(() => {
    return demandes?.filter(d => {
      if (filterStatut !== 'all' && d.statut !== filterStatut) return false;
      if (filterType !== 'all' && d.type_demande !== filterType) return false;
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          d.code.toLowerCase().includes(search) ||
          d.objet.toLowerCase().includes(search) ||
          d.technicien?.prenom?.toLowerCase().includes(search) ||
          d.technicien?.nom?.toLowerCase().includes(search)
        );
      }
      return true;
    }) || [];
  }, [demandes, filterStatut, filterType, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: demandes?.length || 0,
    en_attente: demandes?.filter(d => d.statut === 'en_attente').length || 0,
    approuve: demandes?.filter(d => d.statut === 'approuve' || d.statut === 'en_cours').length || 0,
    refuse: demandes?.filter(d => d.statut === 'refuse').length || 0,
    termine: demandes?.filter(d => d.statut === 'termine').length || 0,
  }), [demandes]);

  const handleSave = (data: Partial<Demande>, asBrouillon = false) => {
    const saveData = {
      ...data,
      statut: asBrouillon ? 'brouillon' as StatutDemande : 'en_attente' as StatutDemande,
    };
    
    if (editDemande) {
      updateMutation.mutate({ id: editDemande.id, data: saveData });
    } else {
      createMutation.mutate(saveData);
    }
  };

  const handleTraiter = (statut: StatutDemande, commentaire?: string, motifRefus?: string) => {
    if (viewDemande) {
      traiterMutation.mutate({ id: viewDemande.id, statut, commentaire, motifRefus });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Total</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">{stats.en_attente}</div>
              <div className="text-xs text-[var(--text-tertiary)]">En attente</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-green-400">{stats.approuve}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Approuvées</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <X className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-red-400">{stats.refuse}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Refusées</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-purple-400">{stats.termine}</div>
              <div className="text-xs text-[var(--text-tertiary)]">Terminées</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Alerte demandes en attente */}
      {stats.en_attente > 0 && IS_ADMIN && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-amber-400">
            {stats.en_attente} demande{stats.en_attente > 1 ? 's' : ''} en attente de traitement
          </span>
          <Button 
            variant="secondary" 
            size="sm" 
            className="ml-auto"
            onClick={() => setFilterStatut('en_attente')}
          >
            Voir
          </Button>
        </div>
      )}

      {/* Filtres et actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-10 w-64"
            />
          </div>
          <Select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="w-40">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-48">
            <option value="all">Tous les types</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setActiveView('liste')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'liste' 
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' 
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setActiveView('calendrier')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'calendrier' 
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' 
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Calendrier
            </button>
          </div>
          
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nouvelle demande
          </Button>
        </div>
      </div>

      {/* Vue calendrier */}
      {activeView === 'calendrier' && demandes && (
        <CalendrierConges demandes={demandes} />
      )}

      {/* Liste */}
      {activeView === 'liste' && (
        <div className="space-y-4">
          {filtered.map(demande => {
            const typeConfig = TYPE_CONFIG[demande.type_demande];
            const Icon = typeConfig?.icon || HelpCircle;
            
            return (
              <Card key={demande.id} className="hover:border-[var(--border-secondary)] transition-colors">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div 
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig?.bgColor}`}
                      >
                        <Icon className="w-6 h-6" style={{ color: typeConfig?.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-bold text-pink-400">{demande.code}</span>
                          <Badge variant={STATUT_CONFIG[demande.statut].color}>
                            {STATUT_CONFIG[demande.statut].label}
                          </Badge>
                          <Badge variant={PRIORITE_CONFIG[demande.priorite].color}>
                            {PRIORITE_CONFIG[demande.priorite].label}
                          </Badge>
                          <Badge variant="gray">{typeConfig?.label}</Badge>
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{demande.objet}</h3>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                          {demande.technicien && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {demande.technicien.prenom} {demande.technicien.nom}
                            </span>
                          )}
                          <span>{format(new Date(demande.created_at), 'd MMM yyyy', { locale: fr })}</span>
                          
                          {/* Infos spécifiques */}
                          {(demande.type_demande === 'conge' || demande.type_demande === 'rtt') && demande.nb_jours && (
                            <span className="flex items-center gap-1 text-cyan-400">
                              <Calendar className="w-3 h-3" /> {demande.nb_jours}j
                            </span>
                          )}
                          {demande.type_demande === 'remboursement' && demande.montant && (
                            <span className="flex items-center gap-1 text-pink-400">
                              <Euro className="w-3 h-3" /> {demande.montant.toFixed(2)}€
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Actions rapides admin */}
                      {IS_ADMIN && demande.statut === 'en_attente' && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => traiterMutation.mutate({ id: demande.id, statut: 'approuve' })}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setViewDemande(demande)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      
                      <button
                        onClick={() => setViewDemande(demande)}
                        className="p-2 hover:bg-blue-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-blue-400"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {demande.statut === 'brouillon' && (
                        <button
                          onClick={() => setEditDemande(demande)}
                          className="p-2 hover:bg-amber-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-amber-400"
                          title="Modifier"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => setArchiveItem(demande)}
                        className="p-2 hover:bg-amber-500/20 rounded-lg text-[var(--text-tertiary)] hover:text-amber-400"
                        title="Archiver"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <p className="text-[var(--text-muted)]">Aucune demande trouvée</p>
                <Button variant="primary" className="mt-4" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4" /> Créer une demande
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      {(showForm || editDemande) && (
        <DemandeForm
          demande={editDemande}
          onClose={() => { setShowForm(false); setEditDemande(null); }}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {viewDemande && (
        <DemandeDetail
          demande={viewDemande}
          onClose={() => setViewDemande(null)}
          onTraiter={handleTraiter}
        />
      )}

      {archiveItem && (
        <ArchiveModal
          type="demande"
          code={archiveItem.code}
          libelle={archiveItem.objet}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
