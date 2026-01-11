import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, Plus, X, Calendar, User, MapPin, Edit, Archive, Search,
  Building2, Zap, Settings, CheckCircle, Loader2, FileText, Camera, 
  Image, Clock, AlertTriangle, Play, Flag, ChevronDown, ChevronUp,
  Trash2, Download, Eye, Upload, ClipboardList, Shield, Gauge,
  LayoutGrid, List, Filter, MoreVertical, RefreshCw, FileCheck
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Select, Input, Textarea } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { ContextChat } from './ChatPage';
import { ContextNotes } from './NotesPage';
import { ArchiveModal } from './ArchivesPage';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// =============================================
// CONFIGURATION
// =============================================

const STATUTS = [
  { value: 'non_commence', label: 'Non commencé', color: 'gray', bg: '#6B7280' },
  { value: 'monte', label: 'Monté', color: 'blue', bg: '#3B82F6' },
  { value: 'mes_ok_sans_reserves', label: 'MES OK', color: 'green', bg: '#10B981' },
  { value: 'mes_ok_avec_reserves', label: 'MES avec réserves', color: 'orange', bg: '#F97316' },
  { value: 'levee_reserves', label: 'Levée réserves', color: 'purple', bg: '#8B5CF6' },
  { value: 'termine', label: 'Terminé', color: 'teal', bg: '#14B8A6' },
];

const TYPES_APPAREIL = [
  { value: 'traction', label: 'Traction' },
  { value: 'hydraulique', label: 'Hydraulique' },
  { value: 'mrl', label: 'Sans local machine (MRL)' },
  { value: 'monte_charge', label: 'Monte-charge' },
  { value: 'escalier_mecanique', label: 'Escalier mécanique' },
  { value: 'trottoir_roulant', label: 'Trottoir roulant' },
];

const TYPES_BATIMENT = [
  { value: 'habitation', label: 'Habitation' },
  { value: 'erp', label: 'ERP (Public)' },
  { value: 'bureaux', label: 'Bureaux' },
  { value: 'industriel', label: 'Industriel' },
  { value: 'hopital', label: 'Hôpital' },
  { value: 'parking', label: 'Parking' },
  { value: 'autre', label: 'Autre' },
];

const MARQUES = ['OTIS', 'SCHINDLER', 'KONE', 'THYSSENKRUPP', 'MITSUBISHI', 'ORONA', 'SOULIER', 'EIFFAGE', 'MP', 'Autre'];

// Checklist COPREC 
const CHECKLIST_COPREC = [
  { section: 'machinerie', code: 'MAC-01', label: 'Documentation machinerie', detail: 'Plan, schémas électriques, attestation des composants' },
  { section: 'machinerie', code: 'MAC-02', label: 'Porte local et serrure', detail: 'Fermeture, verrouillage' },
  { section: 'machinerie', code: 'MAC-03', label: 'Éclairage machinerie', detail: '200 lux minimum' },
  { section: 'machinerie', code: 'MAC-04', label: 'Éclairage de sécurité', detail: 'Fonctionnement' },
  { section: 'machinerie', code: 'MAC-05', label: 'Tableau d alimentation', detail: 'Interrupteur de force, disjoncteurs' },
  { section: 'machinerie', code: 'MAC-06', label: 'Câblage', detail: 'Alimentation, téléphone, U36' },
  { section: 'machinerie', code: 'MAC-07', label: 'Ventilation', detail: 'Fonctionnement' },
  { section: 'machinerie', code: 'MAC-08', label: 'Thermostat', detail: 'Température ambiante' },
  { section: 'machinerie', code: 'MAC-09', label: 'Signalisation de sécurité', detail: 'Pancarte porte' },
  { section: 'machinerie', code: 'MAC-10', label: 'Accessoires de levage', detail: 'Estampillé' },
  { section: 'machinerie', code: 'MAC-11', label: 'Matériel étranger', detail: 'Absence' },
  { section: 'machinerie', code: 'MAC-12', label: 'Machine de traction', detail: 'État général, fixation' },
  { section: 'machinerie', code: 'MAC-13', label: 'Frein', detail: 'Fonctionnement, usure' },
  { section: 'machinerie', code: 'MAC-14', label: 'Limiteur de vitesse', detail: 'Plombage, fonctionnement, type CE' },
  { section: 'machinerie', code: 'MAC-15', label: 'Poulie de traction', detail: 'Usure des gorges' },
  { section: 'gaine', code: 'GAI-01', label: 'Fermeture de la gaine', detail: 'Étanchéité, protection' },
  { section: 'gaine', code: 'GAI-02', label: 'Ventilation haute', detail: 'Fonctionnement' },
  { section: 'gaine', code: 'GAI-03', label: 'Éclairage de la gaine', detail: '50 lux sur toit' },
  { section: 'gaine', code: 'GAI-04', label: 'Guides cabine', detail: 'Attaches conformes' },
  { section: 'toit_cabine', code: 'TOI-01', label: 'Manoeuvre inspection', detail: 'Fonctionnement' },
  { section: 'toit_cabine', code: 'TOI-02', label: 'Balustrade', detail: '0.7m ou 1.1m' },
  { section: 'toit_cabine', code: 'TOI-03', label: 'Stop sur toit', detail: 'Bouton arrêt urgence' },
  { section: 'portes_palieres', code: 'PAL-01', label: 'Portes palières', detail: 'État général, alignement' },
  { section: 'portes_palieres', code: 'PAL-02', label: 'Serrures des portes', detail: 'Fonctionnement, engagement pênes' },
  { section: 'cuvette', code: 'CUV-01', label: 'Profondeur', detail: 'Conforme au plan' },
  { section: 'cuvette', code: 'CUV-02', label: 'Éclairage', detail: '50 lux' },
  { section: 'cuvette', code: 'CUV-03', label: 'Amortisseurs cabine', detail: 'Type CE' },
  { section: 'cabine', code: 'CAB-01', label: 'Éclairage normal', detail: '100 lux minimum' },
  { section: 'cabine', code: 'CAB-02', label: 'Éclairage de secours', detail: '5 lux/h' },
  { section: 'cabine', code: 'CAB-03', label: 'Alarme en cabine', detail: 'Conformité EN81-28' },
  { section: 'cabine', code: 'CAB-04', label: 'Téléphone', detail: 'Fonctionnement' },
  { section: 'essais', code: 'ESS-01', label: 'Hors course haut', detail: 'Fin de course' },
  { section: 'essais', code: 'ESS-02', label: 'Hors course bas', detail: 'Fin de course' },
  { section: 'essais', code: 'ESS-03', label: 'Parachute en charge 125%', detail: 'Vitesse réduite' },
  { section: 'essais', code: 'ESS-04', label: 'Freinage', detail: 'Essai de freinage' },
  { section: 'essais', code: 'ESS-05', label: 'Surcharge', detail: 'Fonctionnement dispositif' },
  { section: 'essais', code: 'ESS-06', label: 'Vitesse nominale', detail: 'Mesure montée et descente' },
];

const SECTION_LABELS: Record<string, string> = {
  'machinerie': 'Machinerie',
  'gaine': 'Gaine',
  'toit_cabine': 'Toit de Cabine',
  'portes_palieres': 'Portes Palières',
  'cuvette': 'Cuvette',
  'cabine': 'Cabine',
  'essais': 'Essais',
};

const getStatusInfo = (status: string) => STATUTS.find(s => s.value === status) || STATUTS[0];
const formatDate = (date: string) => { if (!date) return '-'; try { return format(parseISO(date), 'd MMM yyyy', { locale: fr }); } catch { return date; } };

// PhotoUpload Component
function PhotoUpload({ photos, onChange, maxPhotos = 10 }: { photos: string[]; onChange: (p: string[]) => void; maxPhotos?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(file => {
      if (photos.length >= maxPhotos) { toast.error('Maximum ' + maxPhotos + ' photos'); return; }
      if (!file.type.startsWith('image/')) { toast.error('Images uniquement'); return; }
      if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 Mo'); return; }
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
        <div onClick={() => inputRef.current?.click()} className="border-2 border-dashed border-[var(--border-primary)] rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50">
          <Camera className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Cliquez pour ajouter des photos</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden group">
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onChange(photos.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <button onClick={() => inputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center hover:border-orange-500/50">
              <Plus className="w-6 h-6 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// AppareilFormModal
function AppareilFormModal({ appareil, onClose, onSave, isLoading }: { appareil?: any; onClose: () => void; onSave: (data: any) => void; isLoading?: boolean }) {
  const [form, setForm] = useState({
    device_number: appareil?.device_number || '', site_name: appareil?.site_name || '', manufacturer: appareil?.manufacturer || '',
    model: appareil?.model || '', installation_year: appareil?.installation_year || '', elevator_type: appareil?.elevator_type || '',
    building_type: appareil?.building_type || '', address_street: appareil?.address_street || '', address_city: appareil?.address_city || '',
    address_zip: appareil?.address_zip || '', load_capacity: appareil?.load_capacity || '', speed: appareil?.speed || '',
    course: appareil?.course || '', levels_count: appareil?.levels_count || '', cabin_dimensions: appareil?.cabin_dimensions || '',
    pit_depth: appareil?.pit_depth || '', cables_count: appareil?.cables_count || '', cables_diameter: appareil?.cables_diameter || '',
    suspension_ratio: appareil?.suspension_ratio || '', lock_type: appareil?.lock_type || '', notes: appareil?.notes || '',
    status: appareil?.status || 'non_commence',
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });
  const handleSubmit = () => {
    if (!form.device_number || !form.site_name) { toast.error('N° appareil et nom du site requis'); return; }
    onSave({ ...form, levels_count: form.levels_count ? parseInt(form.levels_count) : null, cables_count: form.cables_count ? parseInt(form.cables_count) : null, photos_json: photos.length > 0 ? JSON.stringify(photos) : null });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{appareil ? 'Modifier' : 'Nouvel appareil'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Identification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">N° Appareil *</label><Input value={form.device_number} onChange={e => updateField('device_number', e.target.value)} placeholder="ASC-001" className="font-mono" /></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Nom du site *</label><Input value={form.site_name} onChange={e => updateField('site_name', e.target.value)} placeholder="Résidence Les Fleurs" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Fabricant</label><Select value={form.manufacturer} onChange={e => updateField('manufacturer', e.target.value)}><option value="">Sélectionner...</option>{MARQUES.map(m => <option key={m} value={m}>{m}</option>)}</Select></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Modèle</label><Input value={form.model} onChange={e => updateField('model', e.target.value)} /></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Type</label><Select value={form.elevator_type} onChange={e => updateField('elevator_type', e.target.value)}><option value="">Sélectionner...</option>{TYPES_APPAREIL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
              </div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Adresse</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><Input value={form.address_street} onChange={e => updateField('address_street', e.target.value)} placeholder="Adresse" /></div>
                <div><Input value={form.address_zip} onChange={e => updateField('address_zip', e.target.value)} placeholder="Code postal" /></div>
              </div>
              <div className="mt-4"><Input value={form.address_city} onChange={e => updateField('address_city', e.target.value)} placeholder="Ville" /></div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Settings className="w-4 h-4" /> Caractéristiques</h3>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Charge (kg)</label><Input value={form.load_capacity} onChange={e => updateField('load_capacity', e.target.value)} placeholder="630" /></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Vitesse (m/s)</label><Input value={form.speed} onChange={e => updateField('speed', e.target.value)} placeholder="1.0" /></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Course (m)</label><Input value={form.course} onChange={e => updateField('course', e.target.value)} placeholder="25" /></div>
                <div><label className="text-sm text-[var(--text-muted)] block mb-1">Niveaux</label><Input type="number" value={form.levels_count} onChange={e => updateField('levels_count', e.target.value)} placeholder="5" /></div>
              </div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Notes & Photos</h3>
              <Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={3} placeholder="Notes..." className="mb-4" />
              <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={10} />
            </div>
          </div>
          <div className="flex gap-3 mt-6"><Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button><Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : appareil ? 'Enregistrer' : 'Créer'}</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}

// ChecklistModal
function ChecklistModal({ appareil, onClose }: { appareil: any; onClose: () => void }) {
  const [checkpoints, setCheckpoints] = useState<Record<string, { status: string; remarks: string }>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>('machinerie');
  const groupedChecklist = useMemo(() => {
    const groups: Record<string, typeof CHECKLIST_COPREC> = {};
    CHECKLIST_COPREC.forEach(item => { if (!groups[item.section]) groups[item.section] = []; groups[item.section].push(item); });
    return groups;
  }, []);
  const updateCheckpoint = (code: string, status: string) => setCheckpoints(prev => ({ ...prev, [code]: { ...prev[code], status } }));
  const stats = useMemo(() => {
    const values = Object.values(checkpoints);
    return { total: CHECKLIST_COPREC.length, conforme: values.filter(v => v.status === 'C').length, nonConforme: values.filter(v => v.status === 'NC').length, sansObjet: values.filter(v => v.status === 'SO').length };
  }, [checkpoints]);
  const progress = Math.round(((stats.conforme + stats.nonConforme + stats.sansObjet) / stats.total) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div><h2 className="text-lg font-bold">Checklist COPREC</h2><p className="text-sm text-[var(--text-muted)]">{appareil.device_number} - {appareil.site_name}</p></div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1"><div className="flex justify-between mb-1"><span className="text-sm">Progression</span><span className="text-sm font-bold text-orange-400">{progress}%</span></div><div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: progress + '%' }} /></div></div>
              <div className="flex gap-2"><Badge variant="green">C: {stats.conforme}</Badge><Badge variant="red">NC: {stats.nonConforme}</Badge><Badge variant="gray">SO: {stats.sansObjet}</Badge></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {Object.entries(groupedChecklist).map(([section, items]) => (
              <div key={section} className="mb-4">
                <button onClick={() => setExpandedSection(expandedSection === section ? null : section)} className="w-full flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2"><span className="font-semibold">{SECTION_LABELS[section] || section}</span><Badge variant="gray">{items.length}</Badge></div>
                  {expandedSection === section ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedSection === section && (
                  <div className="mt-2 space-y-2">
                    {items.map(item => {
                      const cp = checkpoints[item.code] || { status: '', remarks: '' };
                      return (
                        <div key={item.code} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-primary)]">
                          <div className="flex items-start gap-3">
                            <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-mono text-orange-400">{item.code}</span><span className="text-sm font-medium">{item.label}</span></div><p className="text-xs text-[var(--text-muted)]">{item.detail}</p></div>
                            <div className="flex gap-1">{['C', 'NC', 'SO'].map(status => (<button key={status} onClick={() => updateCheckpoint(item.code, status)} className={'w-10 h-8 rounded text-xs font-bold ' + (cp.status === status ? (status === 'C' ? 'bg-green-500 text-white' : status === 'NC' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white') : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]')}>{status}</button>))}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3"><Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button><Button variant="primary" className="flex-1" onClick={() => { toast.success('Checklist enregistrée'); onClose(); }}><Check className="w-4 h-4" /> Enregistrer</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}

// AppareilDetailModal
function AppareilDetailModal({ appareil, onClose, onEdit, onArchive, onRefresh }: { appareil: any; onClose: () => void; onEdit: () => void; onArchive: () => void; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState('info');
  const [showChecklist, setShowChecklist] = useState(false);
  const queryClient = useQueryClient();
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => { const { error } = await supabase.from('mise_en_service').update({ status: newStatus }).eq('id', appareil.id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); onRefresh(); toast.success('Statut mis à jour'); },
  });
  const statusInfo = getStatusInfo(appareil.status);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-start justify-between">
              <div><div className="flex items-center gap-2 mb-1"><span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span><Badge style={{ backgroundColor: statusInfo.bg }} className="text-white">{statusInfo.label}</Badge></div><h2 className="text-xl font-bold">{appareil.site_name}</h2><p className="text-sm text-[var(--text-muted)]">{appareil.address_street}, {appareil.address_zip} {appareil.address_city}</p></div>
              <div className="flex items-center gap-2"><button onClick={onArchive} className="p-2 hover:bg-amber-500/20 rounded-lg"><Archive className="w-5 h-5" /></button><button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><Edit className="w-5 h-5" /></button><button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button></div>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">{STATUTS.map(s => (<button key={s.value} onClick={() => updateStatusMutation.mutate(s.value)} className={'px-3 py-1.5 rounded-lg text-xs font-medium ' + (appareil.status === s.value ? 'text-white' : 'bg-[var(--bg-tertiary)]')} style={appareil.status === s.value ? { backgroundColor: s.bg } : {}}>{s.label}</button>))}</div>
            <div className="flex gap-1 mt-4">{[{ id: 'info', label: 'Informations', icon: FileText }, { id: 'checklist', label: 'Checklist', icon: ClipboardList }, { id: 'photos', label: 'Photos', icon: Image }].map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={'flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium ' + (activeTab === t.id ? 'bg-[var(--bg-secondary)] text-orange-400 border-b-2 border-orange-400' : 'text-[var(--text-muted)]')}><t.icon className="w-4 h-4" />{t.label}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Identification</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Fabricant</span><span className="font-medium">{appareil.manufacturer || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Modèle</span><span className="font-medium">{appareil.model || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span className="font-medium">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</span></div></div></div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Settings className="w-4 h-4" /> Caractéristiques</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Charge</span><span className="font-medium">{appareil.load_capacity || '-'} kg</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Vitesse</span><span className="font-medium">{appareil.speed || '-'} m/s</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Niveaux</span><span className="font-medium">{appareil.levels_count || '-'}</span></div></div></div>
                </div>
                {appareil.notes && <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-2">Notes</h3><p className="text-sm whitespace-pre-wrap">{appareil.notes}</p></div>}
                <ContextChat contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} />
                <ContextNotes contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} />
              </div>
            )}
            {activeTab === 'checklist' && (<div className="text-center py-8"><ClipboardList className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Checklist COPREC</h3><p className="text-sm text-[var(--text-muted)] mb-4">{CHECKLIST_COPREC.length} points de contrôle</p><Button variant="primary" onClick={() => setShowChecklist(true)}><ClipboardList className="w-4 h-4" /> Ouvrir la checklist</Button></div>)}
            {activeTab === 'photos' && (<div className="text-center py-8"><Image className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Photos</h3><p className="text-sm text-[var(--text-muted)] mb-4">Aucune photo</p><Button variant="primary"><Camera className="w-4 h-4" /> Ajouter</Button></div>)}
          </div>
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3"><Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button><Button variant="primary" className="flex-1" onClick={onEdit}><Edit className="w-4 h-4" /> Modifier</Button></div>
        </CardBody>
      </Card>
      {showChecklist && <ChecklistModal appareil={appareil} onClose={() => setShowChecklist(false)} />}
    </div>
  );
}

// Main Page
export function MiseEnServicePage() {
  const [showForm, setShowForm] = useState(false);
  const [editAppareil, setEditAppareil] = useState<any>(null);
  const [detailAppareil, setDetailAppareil] = useState<any>(null);
  const [archiveItem, setArchiveItem] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  
  const { data: appareils, isLoading, refetch } = useQuery({ 
    queryKey: ['mise-en-service'], 
    queryFn: async () => { const { data, error } = await supabase.from('mise_en_service').select('*').is('archived', null).order('created_at', { ascending: false }); if (error) throw error; return data || []; }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const { data: result, error } = await supabase.from('mise_en_service').insert(data).select().single(); if (error) throw error; return result; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Appareil créé'); setShowForm(false); },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const { error } = await supabase.from('mise_en_service').update(data).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Mis à jour'); setEditAppareil(null); },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, raison }: { id: string; raison: string }) => { const { error } = await supabase.from('mise_en_service').update({ archived: true, archived_at: new Date().toISOString(), archive_reason: raison }).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Archivé'); setArchiveItem(null); setDetailAppareil(null); },
  });

  const filtered = useMemo(() => {
    return appareils?.filter(a => {
      if (filterStatus && a.status !== filterStatus) return false;
      if (searchQuery) { const q = searchQuery.toLowerCase(); return a.device_number?.toLowerCase().includes(q) || a.site_name?.toLowerCase().includes(q) || a.address_city?.toLowerCase().includes(q) || a.manufacturer?.toLowerCase().includes(q); }
      return true;
    }) || [];
  }, [appareils, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const all = appareils || [];
    return { total: all.length, ...STATUTS.reduce((acc, s) => ({ ...acc, [s.value]: all.filter(a => a.status === s.value).length }), {}) };
  }, [appareils]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Mise en service</h1><p className="text-sm text-[var(--text-muted)]">{stats.total} appareils</p></div>
        <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nouvel appareil</Button>
      </div>

      <Card><CardBody className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="pl-10" /></div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStatus(null)} className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (!filterStatus ? 'bg-orange-500 text-white' : 'bg-[var(--bg-tertiary)]')}>Tous ({stats.total})</button>
            {STATUTS.map(s => (<button key={s.value} onClick={() => setFilterStatus(s.value)} className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (filterStatus === s.value ? 'text-white' : 'bg-[var(--bg-tertiary)]')} style={filterStatus === s.value ? { backgroundColor: s.bg } : {}}>{s.label} ({(stats as any)[s.value] || 0})</button>))}
          </div>
          <div className="ml-auto flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button onClick={() => setViewMode('grid')} className={'p-2 rounded ' + (viewMode === 'grid' ? 'bg-white shadow-sm' : '')}><LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#F97316' : undefined }} /></button>
            <button onClick={() => setViewMode('list')} className={'p-2 rounded ' + (viewMode === 'list' ? 'bg-white shadow-sm' : '')}><List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#F97316' : undefined }} /></button>
          </div>
        </div>
      </CardBody></Card>

      {isLoading ? (
        <Card><CardBody className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardBody></Card>
      ) : filtered.length === 0 ? (
        <Card><CardBody className="text-center py-12"><Building2 className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Aucun appareil</h3><p className="text-sm text-[var(--text-muted)] mb-4">Ajoutez un appareil en mise en service</p><Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Ajouter</Button></CardBody></Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(appareil => {
            const statusInfo = getStatusInfo(appareil.status);
            return (<Card key={appareil.id} className="hover:border-orange-500/30 cursor-pointer" onClick={() => setDetailAppareil(appareil)}><CardBody><div className="flex items-start justify-between mb-3"><div><span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span><Badge className="ml-2 text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge></div></div><h3 className="font-semibold mb-1">{appareil.site_name}</h3><p className="text-sm text-[var(--text-muted)] mb-3">{appareil.address_city}</p><div className="flex gap-3 text-xs text-[var(--text-muted)]">{appareil.manufacturer && <span>{appareil.manufacturer}</span>}{appareil.levels_count && <span>{appareil.levels_count} niv.</span>}{appareil.load_capacity && <span>{appareil.load_capacity} kg</span>}</div></CardBody></Card>);
          })}
        </div>
      ) : (
        <Card><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-[var(--border-primary)]"><th className="text-left p-3 text-sm font-semibold">N° Appareil</th><th className="text-left p-3 text-sm font-semibold">Site</th><th className="text-left p-3 text-sm font-semibold">Ville</th><th className="text-left p-3 text-sm font-semibold">Type</th><th className="text-left p-3 text-sm font-semibold">Statut</th></tr></thead><tbody>{filtered.map(appareil => { const statusInfo = getStatusInfo(appareil.status); return (<tr key={appareil.id} onClick={() => setDetailAppareil(appareil)} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"><td className="p-3 font-mono font-bold text-orange-400">{appareil.device_number}</td><td className="p-3">{appareil.site_name}</td><td className="p-3 text-[var(--text-muted)]">{appareil.address_city}</td><td className="p-3 text-[var(--text-muted)]">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</td><td className="p-3"><Badge className="text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge></td></tr>); })}</tbody></table></div></Card>
      )}

      {showForm && <AppareilFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} isLoading={createMutation.isPending} />}
      {editAppareil && <AppareilFormModal appareil={editAppareil} onClose={() => setEditAppareil(null)} onSave={data => updateMutation.mutate({ id: editAppareil.id, data })} isLoading={updateMutation.isPending} />}
      {detailAppareil && <AppareilDetailModal appareil={detailAppareil} onClose={() => setDetailAppareil(null)} onEdit={() => { setEditAppareil(detailAppareil); setDetailAppareil(null); }} onArchive={() => setArchiveItem(detailAppareil)} onRefresh={() => refetch().then(r => r.data && setDetailAppareil(r.data.find((a: any) => a.id === detailAppareil.id)))} />}
      {archiveItem && <ArchiveModal type="mise_en_service" code={archiveItem.device_number} libelle={archiveItem.device_number + ' - ' + archiveItem.site_name} onClose={() => setArchiveItem(null)} onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })} isLoading={archiveMutation.isPending} />}
    </div>
  );
}
