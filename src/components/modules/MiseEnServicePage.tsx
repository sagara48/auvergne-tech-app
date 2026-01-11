import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, Plus, X, Calendar, User, MapPin, Edit, Archive, Search,
  Building2, Zap, Settings, CheckCircle, Loader2, FileText, Camera, 
  Image, Clock, AlertTriangle, Play, Flag, ChevronDown, ChevronUp,
  Trash2, Download, Eye, Upload, ClipboardList, Shield, Gauge,
  LayoutGrid, List, Filter, MoreVertical, RefreshCw, FileCheck,
  Wrench, Cable, Lock, Ruler, Weight, Layers, Box, CheckSquare,
  XCircle, MinusCircle, HelpCircle, Save, ClipboardCheck, BadgeCheck,
  Building, Phone, FileWarning
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

const BC_STATUTS = [
  { value: 'en_attente', label: 'En attente', color: 'gray', bg: '#6B7280' },
  { value: 'conforme', label: 'Conforme', color: 'green', bg: '#10B981' },
  { value: 'non_conforme', label: 'Non conforme', color: 'red', bg: '#EF4444' },
];

const BUREAUX_CONTROLE = ['SOCOTEC', 'APAVE', 'BUREAU VERITAS', 'DEKRA', 'QUALICONSULT', 'CEP', 'Autre'];

const TYPES_APPAREIL = [
  { value: 'traction', label: 'Traction' },
  { value: 'hydraulique', label: 'Hydraulique' },
  { value: 'mrl', label: 'Sans local machine (MRL)' },
  { value: 'monte_charge', label: 'Monte-charge' },
  { value: 'escalier_mecanique', label: 'Escalier mécanique' },
  { value: 'trottoir_roulant', label: 'Trottoir roulant' },
  { value: 'plateforme', label: 'Plateforme élévatrice' },
];

const TYPES_BATIMENT = [
  { value: 'habitation', label: 'Habitation' },
  { value: 'erp', label: 'ERP (Public)' },
  { value: 'bureaux', label: 'Bureaux' },
  { value: 'industriel', label: 'Industriel' },
  { value: 'hopital', label: 'Hôpital / Clinique' },
  { value: 'hotel', label: 'Hôtel' },
  { value: 'parking', label: 'Parking' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'autre', label: 'Autre' },
];

const MARQUES = [
  'OTIS', 'SCHINDLER', 'KONE', 'THYSSENKRUPP', 'MITSUBISHI', 
  'FUJITEC', 'ORONA', 'SOULIER', 'EIFFAGE', 'MP', 
  'KLEEMANN', 'SODIMAS', 'DRIEUX-COMBALUZIER', 'Autre'
];

const TYPES_AMORTISSEUR = ['Ressort', 'Huile', 'Polyuréthane', 'Hydraulique', 'Autre'];
const TYPES_SERRURE = ['Mécanique', 'Électrique', 'Électromécanique'];
const TYPES_PARACHUTE = ['Progressif', 'Instantané', 'Instantané à effet amorti'];

// Checklist COPREC complète (85 points)
const CHECKLIST_COPREC = [
  // MACHINERIE (15 points)
  { section: 'machinerie', code: 'MAC-01', label: 'Documentation machinerie', detail: 'Plan, schémas électriques, attestation des composants de sécurité' },
  { section: 'machinerie', code: 'MAC-02', label: 'Porte local et serrure', detail: 'Fermeture correcte, verrouillage fonctionnel' },
  { section: 'machinerie', code: 'MAC-03', label: 'Éclairage machinerie', detail: '200 lux minimum au sol' },
  { section: 'machinerie', code: 'MAC-04', label: 'Éclairage de sécurité', detail: 'Fonctionnement correct' },
  { section: 'machinerie', code: 'MAC-05', label: 'Tableau alimentation', detail: 'Interrupteur de force, disjoncteurs éclairage et PC' },
  { section: 'machinerie', code: 'MAC-06', label: 'Câblage électrique', detail: 'Alimentation, téléphone, liaison U36' },
  { section: 'machinerie', code: 'MAC-07', label: 'Ventilation machinerie', detail: 'Fonctionnement et débit conforme' },
  { section: 'machinerie', code: 'MAC-08', label: 'Thermostat', detail: 'Température ambiante en machinerie' },
  { section: 'machinerie', code: 'MAC-09', label: 'Signalisation de sécurité', detail: 'Pancarte porte, consignes de dépannage' },
  { section: 'machinerie', code: 'MAC-10', label: 'Accessoires de levage', detail: 'Estampillé et conforme' },
  { section: 'machinerie', code: 'MAC-11', label: 'Matériel étranger', detail: 'Absence de matériel non lié à l\'ascenseur' },
  { section: 'machinerie', code: 'MAC-12', label: 'Machine de traction', detail: 'État général, fixation, niveau d\'huile' },
  { section: 'machinerie', code: 'MAC-13', label: 'Frein de machine', detail: 'Fonctionnement, usure des garnitures' },
  { section: 'machinerie', code: 'MAC-14', label: 'Limiteur de vitesse', detail: 'Plombage intact, fonctionnement, marquage CE' },
  { section: 'machinerie', code: 'MAC-15', label: 'Poulie de traction', detail: 'Usure des gorges, état général' },
  // LOCAL POULIES (4 points)
  { section: 'local_poulies', code: 'POU-01', label: 'Porte et serrure', detail: 'Fermeture et verrouillage' },
  { section: 'local_poulies', code: 'POU-02', label: 'Éclairage', detail: 'Fonctionnement correct' },
  { section: 'local_poulies', code: 'POU-03', label: 'Prise de courant', detail: 'Présente et fonctionnelle' },
  { section: 'local_poulies', code: 'POU-04', label: 'Bouton stop', detail: 'Arrêt d\'urgence accessible' },
  // GAINE (7 points)
  { section: 'gaine', code: 'GAI-01', label: 'Fermeture de la gaine', detail: 'Étanchéité, protection contre intrusion' },
  { section: 'gaine', code: 'GAI-02', label: 'Ventilation haute', detail: 'Fonctionnement, surface conforme' },
  { section: 'gaine', code: 'GAI-03', label: 'Vitrage gaine', detail: 'Type feuilleté si requis' },
  { section: 'gaine', code: 'GAI-04', label: 'Réserves supérieures', detail: 'Conformité EN81-21, espace toit-plafond' },
  { section: 'gaine', code: 'GAI-05', label: 'Éclairage de la gaine', detail: '50 lux minimum sur toit cabine' },
  { section: 'gaine', code: 'GAI-06', label: 'Guides cabine', detail: 'Attaches conformes au plan, coulisseaux' },
  { section: 'gaine', code: 'GAI-07', label: 'Guides contrepoids', detail: 'Alignement et fixation corrects' },
  // TOIT DE CABINE (9 points)
  { section: 'toit_cabine', code: 'TOI-01', label: 'Manœuvre d\'inspection', detail: 'Fonctionnement correct' },
  { section: 'toit_cabine', code: 'TOI-02', label: 'Balustrade', detail: '0.7m si distance <0.5m, 1.1m si >0.5m' },
  { section: 'toit_cabine', code: 'TOI-03', label: 'Fin de course inspection', detail: 'Fonctionnement correct' },
  { section: 'toit_cabine', code: 'TOI-04', label: 'Bouton stop sur toit', detail: 'Arrêt d\'urgence accessible' },
  { section: 'toit_cabine', code: 'TOI-05', label: 'Contact mou de câble', detail: 'Fonctionnement correct' },
  { section: 'toit_cabine', code: 'TOI-06', label: 'Prise de courant', detail: 'Présente et fonctionnelle' },
  { section: 'toit_cabine', code: 'TOI-07', label: 'Alarme sur toit', detail: 'Fonctionnement correct' },
  { section: 'toit_cabine', code: 'TOI-08', label: 'Éclairage de secours', detail: '5 lux pendant 1 heure' },
  { section: 'toit_cabine', code: 'TOI-09', label: 'Signalisation réserve réduite', detail: 'Pancarte si applicable' },
  // PORTES PALIÈRES (6 points)
  { section: 'portes_palieres', code: 'PAL-01', label: 'État des portes palières', detail: 'État général, alignement, jeux' },
  { section: 'portes_palieres', code: 'PAL-02', label: 'Vitrage portes', detail: 'Type et état conforme' },
  { section: 'portes_palieres', code: 'PAL-03', label: 'Boutons d\'appel', detail: 'Conformité EN81-70, accessibilité' },
  { section: 'portes_palieres', code: 'PAL-04', label: 'Serrures des portes', detail: 'Fonctionnement, engagement pênes 7mm' },
  { section: 'portes_palieres', code: 'PAL-05', label: 'Mise à la terre portes', detail: 'Continuité électrique' },
  { section: 'portes_palieres', code: 'PAL-06', label: 'Réglage portes', detail: 'Vitesse et force de fermeture' },
  // CUVETTE (10 points)
  { section: 'cuvette', code: 'CUV-01', label: 'Profondeur cuvette', detail: 'Conforme au plan d\'installation' },
  { section: 'cuvette', code: 'CUV-02', label: 'Éclairage cuvette', detail: '50 lux minimum' },
  { section: 'cuvette', code: 'CUV-03', label: 'Interrupteur stop', detail: 'Accessible depuis l\'entrée' },
  { section: 'cuvette', code: 'CUV-04', label: 'Échelle d\'accès', detail: 'Présente et conforme' },
  { section: 'cuvette', code: 'CUV-05', label: 'Amortisseurs cabine', detail: 'Nombre, modèle, marquage CE' },
  { section: 'cuvette', code: 'CUV-06', label: 'Amortisseurs contrepoids', detail: 'Nombre, modèle, marquage CE' },
  { section: 'cuvette', code: 'CUV-07', label: 'Prise de courant', detail: 'Présente avec mise à la terre' },
  { section: 'cuvette', code: 'CUV-08', label: 'Réserve sous cabine', detail: 'Mesure conforme aux normes' },
  { section: 'cuvette', code: 'CUV-09', label: 'Poulie tendeuse', detail: 'Installation correcte, contact de sécurité' },
  { section: 'cuvette', code: 'CUV-10', label: 'Commande fosse', detail: 'Boîtier inspection, montée/descente, stop' },
  // CABINE (13 points)
  { section: 'cabine', code: 'CAB-01', label: 'Porte de cabine', detail: 'Contact de heurt, état général' },
  { section: 'cabine', code: 'CAB-02', label: 'Éclairage normal', detail: '100 lux minimum au sol' },
  { section: 'cabine', code: 'CAB-03', label: 'Éclairage de secours', detail: '5 lux pendant 1 heure minimum' },
  { section: 'cabine', code: 'CAB-04', label: 'Verrouillage porte cabine', detail: 'Fonctionnement correct' },
  { section: 'cabine', code: 'CAB-05', label: 'Boîtes à boutons', detail: 'État et fonctionnement' },
  { section: 'cabine', code: 'CAB-06', label: 'Main courante', detail: 'Dessus à 90 cm ±25mm' },
  { section: 'cabine', code: 'CAB-07', label: 'Revêtement cabine', detail: 'Parois, sol, vitrage marqué' },
  { section: 'cabine', code: 'CAB-08', label: 'Dispositif d\'alarme', detail: 'Conformité EN81-28, fonctionnement' },
  { section: 'cabine', code: 'CAB-09', label: 'Pictogrammes alarme', detail: 'Jaune émission, vert réception' },
  { section: 'cabine', code: 'CAB-10', label: 'Téléphone cabine', detail: 'Fonctionnement, communication établie' },
  { section: 'cabine', code: 'CAB-11', label: 'Garde pieds cabine', detail: 'Type fixe ou rétractable' },
  { section: 'cabine', code: 'CAB-12', label: 'Indicateur de position', detail: 'Affichage correct à chaque niveau' },
  { section: 'cabine', code: 'CAB-13', label: 'Ventilation cabine', detail: 'Fonctionnement correct' },
  // SUSPENSION (4 points)
  { section: 'suspension', code: 'SUS-01', label: 'Câbles de suspension', detail: 'Nombre, diamètre, état, usure' },
  { section: 'suspension', code: 'SUS-02', label: 'Attaches câbles', detail: 'État et serrage correct' },
  { section: 'suspension', code: 'SUS-03', label: 'Garde câbles', detail: 'Présents et conformes' },
  { section: 'suspension', code: 'SUS-04', label: 'Protection points rentrants', detail: 'Présente sur poulies' },
  // JEUX (2 points)
  { section: 'jeux', code: 'JEU-01', label: 'Jeu seuil-seuil', detail: '35 mm maximum' },
  { section: 'jeux', code: 'JEU-02', label: 'Distance parois gaine', detail: '<150mm, contrepoids >50mm' },
  // SÉCURITÉS (4 points)
  { section: 'securites', code: 'SEC-01', label: 'Parachute cabine', detail: 'Type CE, fonctionnement correct' },
  { section: 'securites', code: 'SEC-02', label: 'Parachute contrepoids', detail: 'Type CE si présent' },
  { section: 'securites', code: 'SEC-03', label: 'Limiteur cabine', detail: 'Marquage CE, plombage' },
  { section: 'securites', code: 'SEC-04', label: 'Limiteur contrepoids', detail: 'Type CE si présent' },
  // ESSAIS (12 points)
  { section: 'essais', code: 'ESS-01', label: 'Fin de course haut', detail: 'Fonctionnement correct' },
  { section: 'essais', code: 'ESS-02', label: 'Fin de course bas', detail: 'Fonctionnement correct' },
  { section: 'essais', code: 'ESS-03', label: 'Essai parachute 125%', detail: 'Vitesse réduite, contact enclenché' },
  { section: 'essais', code: 'ESS-04', label: 'Masse d\'une serrure', detail: 'Déclenchement fusible ou disjoncteur' },
  { section: 'essais', code: 'ESS-05', label: 'Essai de freinage', detail: 'Efficacité du frein' },
  { section: 'essais', code: 'ESS-06', label: 'Dispositif de surcharge', detail: 'Fonctionnement correct' },
  { section: 'essais', code: 'ESS-07', label: 'Essai A3', detail: 'Fonctionnement correct' },
  { section: 'essais', code: 'ESS-08', label: 'Désincarcération', detail: 'Manœuvre auto et manuelle' },
  { section: 'essais', code: 'ESS-09', label: 'Précision nivelage', detail: 'Vérification à tous les niveaux' },
  { section: 'essais', code: 'ESS-10', label: 'Vitesse nominale', detail: 'Mesure montée et descente' },
  { section: 'essais', code: 'ESS-11', label: 'Bruit et vibrations', detail: 'Niveau acceptable' },
  { section: 'essais', code: 'ESS-12', label: 'Rénivelage', detail: 'Fonctionnement si équipé' },
];

const SECTION_LABELS: Record<string, string> = {
  'machinerie': 'Machinerie',
  'local_poulies': 'Local Poulies',
  'gaine': 'Gaine',
  'toit_cabine': 'Toit de Cabine',
  'portes_palieres': 'Portes Palières',
  'cuvette': 'Cuvette',
  'cabine': 'Cabine',
  'suspension': 'Suspension',
  'jeux': 'Jeux',
  'securites': 'Sécurités',
  'essais': 'Essais',
};

const getStatusInfo = (status: string) => STATUTS.find(s => s.value === status) || STATUTS[0];
const getBCStatusInfo = (status: string) => BC_STATUTS.find(s => s.value === status) || BC_STATUTS[0];

// =============================================
// COMPOSANT UPLOAD PHOTOS
// =============================================
function PhotoUpload({ photos, onChange, maxPhotos = 10 }: { photos: string[]; onChange: (p: string[]) => void; maxPhotos?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(file => {
      if (photos.length >= maxPhotos) { toast.error(`Max ${maxPhotos} photos`); return; }
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
          <p className="text-sm text-[var(--text-muted)]">Ajouter des photos</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button onClick={(e) => { e.stopPropagation(); onChange(photos.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
            </div>
          ))}
          {photos.length < maxPhotos && <button onClick={() => inputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center"><Plus className="w-6 h-6 text-[var(--text-muted)]" /></button>}
        </div>
      )}
    </div>
  );
}

// =============================================
// MODAL FORMULAIRE APPAREIL
// =============================================
function AppareilFormModal({ appareil, onClose, onSave, isLoading }: { appareil?: any; onClose: () => void; onSave: (data: any) => void; isLoading?: boolean }) {
  const [activeSection, setActiveSection] = useState('identification');
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({
    device_number: appareil?.device_number || '', site_name: appareil?.site_name || '', manufacturer: appareil?.manufacturer || '',
    model: appareil?.model || '', installation_year: appareil?.installation_year || new Date().getFullYear().toString(),
    elevator_type: appareil?.elevator_type || '', building_type: appareil?.building_type || '',
    address_street: appareil?.address_street || '', address_city: appareil?.address_city || '', address_zip: appareil?.address_zip || '',
    load_capacity: appareil?.load_capacity || '', speed: appareil?.speed || '', course: appareil?.course || '',
    levels_count: appareil?.levels_count?.toString() || '', levels_served: appareil?.levels_served?.toString() || '', access_count: appareil?.access_count?.toString() || '1',
    cabin_width: appareil?.cabin_width || '', cabin_depth: appareil?.cabin_depth || '', cabin_height: appareil?.cabin_height || '', cabin_dimensions: appareil?.cabin_dimensions || '',
    door_width: appareil?.door_width || '', door_height: appareil?.door_height || '', pit_depth: appareil?.pit_depth || '', headroom: appareil?.headroom || '',
    cables_count: appareil?.cables_count?.toString() || '', cables_diameter: appareil?.cables_diameter || '', suspension_ratio: appareil?.suspension_ratio || '', cable_type: appareil?.cable_type || '',
    buffer_cabin_count: appareil?.buffer_cabin_count?.toString() || '', buffer_cabin_type: appareil?.buffer_cabin_type || '',
    buffer_counterweight_count: appareil?.buffer_counterweight_count?.toString() || '', buffer_counterweight_type: appareil?.buffer_counterweight_type || '',
    parachute_type: appareil?.parachute_type || '', lock_type: appareil?.lock_type || '', alarm_system: appareil?.alarm_system || '',
    motor_power: appareil?.motor_power || '', motor_type: appareil?.motor_type || '', variator_type: appareil?.variator_type || '',
    controller_type: appareil?.controller_type || '', controller_brand: appareil?.controller_brand || '',
    notes: appareil?.notes || '', status: appareil?.status || 'non_commence',
  });
  const updateField = (f: string, v: any) => setForm(prev => ({ ...prev, [f]: v }));
  const handleSubmit = () => {
    if (!form.device_number || !form.site_name) { toast.error('N° appareil et site requis'); return; }
    const cabin_dimensions = form.cabin_width && form.cabin_depth && form.cabin_height ? `${form.cabin_width}x${form.cabin_depth}x${form.cabin_height}` : form.cabin_dimensions;
    onSave({ ...form, cabin_dimensions, levels_count: form.levels_count ? parseInt(form.levels_count) : null, levels_served: form.levels_served ? parseInt(form.levels_served) : null, access_count: form.access_count ? parseInt(form.access_count) : 1, cables_count: form.cables_count ? parseInt(form.cables_count) : null, buffer_cabin_count: form.buffer_cabin_count ? parseInt(form.buffer_cabin_count) : null, buffer_counterweight_count: form.buffer_counterweight_count ? parseInt(form.buffer_counterweight_count) : null, photos_json: photos.length > 0 ? JSON.stringify(photos) : null });
  };
  const sections = [{ id: 'identification', label: 'Identification', icon: Building2 }, { id: 'adresse', label: 'Adresse', icon: MapPin }, { id: 'caracteristiques', label: 'Caractéristiques', icon: Gauge }, { id: 'dimensions', label: 'Dimensions', icon: Ruler }, { id: 'suspension', label: 'Suspension', icon: Cable }, { id: 'securites', label: 'Sécurités', icon: Shield }, { id: 'machine', label: 'Machine', icon: Wrench }, { id: 'notes', label: 'Notes & Photos', icon: FileText }];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[950px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex">
          <div className="w-52 bg-[var(--bg-tertiary)] border-r border-[var(--border-primary)] p-3 flex-shrink-0 overflow-y-auto">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-3 px-2">Sections</h3>
            <div className="space-y-1">{sections.map(s => (<button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${activeSection === s.id ? 'bg-orange-500 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}><s.icon className="w-4 h-4" />{s.label}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6"><div><h2 className="text-xl font-bold">{appareil ? 'Modifier' : 'Nouvel appareil MES'}</h2><p className="text-sm text-[var(--text-muted)]">{appareil?.device_number || 'Remplissez les informations'}</p></div><button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button></div>
            {activeSection === 'identification' && (<div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">N° Appareil *</label><Input value={form.device_number} onChange={e => updateField('device_number', e.target.value)} placeholder="ASC-2024-001" className="font-mono text-lg font-bold" /></div><div><label className="text-sm font-medium mb-1.5 block">Site *</label><Input value={form.site_name} onChange={e => updateField('site_name', e.target.value)} placeholder="Résidence..." /></div></div><div className="grid grid-cols-3 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Fabricant</label><Select value={form.manufacturer} onChange={e => updateField('manufacturer', e.target.value)}><option value="">...</option>{MARQUES.map(m => <option key={m} value={m}>{m}</option>)}</Select></div><div><label className="text-sm font-medium mb-1.5 block">Modèle</label><Input value={form.model} onChange={e => updateField('model', e.target.value)} /></div><div><label className="text-sm font-medium mb-1.5 block">Année</label><Input value={form.installation_year} onChange={e => updateField('installation_year', e.target.value)} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Type</label><Select value={form.elevator_type} onChange={e => updateField('elevator_type', e.target.value)}><option value="">...</option>{TYPES_APPAREIL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div><div><label className="text-sm font-medium mb-1.5 block">Bâtiment</label><Select value={form.building_type} onChange={e => updateField('building_type', e.target.value)}><option value="">...</option>{TYPES_BATIMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div></div></div>)}
            {activeSection === 'adresse' && (<div className="space-y-4"><div><label className="text-sm font-medium mb-1.5 block">Adresse</label><Input value={form.address_street} onChange={e => updateField('address_street', e.target.value)} /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Code postal</label><Input value={form.address_zip} onChange={e => updateField('address_zip', e.target.value)} /></div><div><label className="text-sm font-medium mb-1.5 block">Ville</label><Input value={form.address_city} onChange={e => updateField('address_city', e.target.value)} /></div></div></div>)}
            {activeSection === 'caracteristiques' && (<div className="space-y-6"><div className="grid grid-cols-3 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Charge (kg)</label><Input value={form.load_capacity} onChange={e => updateField('load_capacity', e.target.value)} placeholder="630" /></div><div><label className="text-sm font-medium mb-1.5 block">Vitesse (m/s)</label><Input value={form.speed} onChange={e => updateField('speed', e.target.value)} placeholder="1.0" /></div><div><label className="text-sm font-medium mb-1.5 block">Course (m)</label><Input value={form.course} onChange={e => updateField('course', e.target.value)} /></div></div><div className="grid grid-cols-3 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Niveaux</label><Input type="number" value={form.levels_count} onChange={e => updateField('levels_count', e.target.value)} /></div><div><label className="text-sm font-medium mb-1.5 block">Niveaux desservis</label><Input type="number" value={form.levels_served} onChange={e => updateField('levels_served', e.target.value)} /></div><div><label className="text-sm font-medium mb-1.5 block">Accès</label><Input type="number" value={form.access_count} onChange={e => updateField('access_count', e.target.value)} /></div></div></div>)}
            {activeSection === 'dimensions' && (<div className="space-y-6"><div><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Box className="w-4 h-4 text-orange-400" /> Cabine (mm)</h3><div className="grid grid-cols-3 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Largeur</label><Input value={form.cabin_width} onChange={e => updateField('cabin_width', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Profondeur</label><Input value={form.cabin_depth} onChange={e => updateField('cabin_depth', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Hauteur</label><Input value={form.cabin_height} onChange={e => updateField('cabin_height', e.target.value)} /></div></div></div><div><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-orange-400" /> Porte (mm)</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Largeur</label><Input value={form.door_width} onChange={e => updateField('door_width', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Hauteur</label><Input value={form.door_height} onChange={e => updateField('door_height', e.target.value)} /></div></div></div><div><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Ruler className="w-4 h-4 text-orange-400" /> Gaine</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Cuvette (m)</label><Input value={form.pit_depth} onChange={e => updateField('pit_depth', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Passage tête (m)</label><Input value={form.headroom} onChange={e => updateField('headroom', e.target.value)} /></div></div></div></div>)}
            {activeSection === 'suspension' && (<div className="space-y-6"><div><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Cable className="w-4 h-4 text-orange-400" /> Câbles</h3><div className="grid grid-cols-4 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label><Input type="number" value={form.cables_count} onChange={e => updateField('cables_count', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Diamètre (mm)</label><Input value={form.cables_diameter} onChange={e => updateField('cables_diameter', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Mouflage</label><Select value={form.suspension_ratio} onChange={e => updateField('suspension_ratio', e.target.value)}><option value="">...</option><option value="1:1">1:1</option><option value="2:1">2:1</option><option value="3:1">3:1</option></Select></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label><Input value={form.cable_type} onChange={e => updateField('cable_type', e.target.value)} /></div></div></div><div className="grid grid-cols-2 gap-6"><div><h3 className="text-sm font-semibold mb-3">Amortisseurs cabine</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label><Input type="number" value={form.buffer_cabin_count} onChange={e => updateField('buffer_cabin_count', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label><Select value={form.buffer_cabin_type} onChange={e => updateField('buffer_cabin_type', e.target.value)}><option value="">...</option>{TYPES_AMORTISSEUR.map(t => <option key={t} value={t}>{t}</option>)}</Select></div></div></div><div><h3 className="text-sm font-semibold mb-3">Amortisseurs contrepoids</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label><Input type="number" value={form.buffer_counterweight_count} onChange={e => updateField('buffer_counterweight_count', e.target.value)} /></div><div><label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label><Select value={form.buffer_counterweight_type} onChange={e => updateField('buffer_counterweight_type', e.target.value)}><option value="">...</option>{TYPES_AMORTISSEUR.map(t => <option key={t} value={t}>{t}</option>)}</Select></div></div></div></div></div>)}
            {activeSection === 'securites' && (<div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Type parachute</label><Select value={form.parachute_type} onChange={e => updateField('parachute_type', e.target.value)}><option value="">...</option>{TYPES_PARACHUTE.map(t => <option key={t} value={t}>{t}</option>)}</Select></div><div><label className="text-sm font-medium mb-1.5 block">Type serrures</label><Select value={form.lock_type} onChange={e => updateField('lock_type', e.target.value)}><option value="">...</option>{TYPES_SERRURE.map(t => <option key={t} value={t}>{t}</option>)}</Select></div></div><div><label className="text-sm font-medium mb-1.5 block">Système alarme</label><Input value={form.alarm_system} onChange={e => updateField('alarm_system', e.target.value)} placeholder="Téléalarme EN81-28" /></div></div>)}
            {activeSection === 'machine' && (<div className="space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Puissance (kW)</label><Input value={form.motor_power} onChange={e => updateField('motor_power', e.target.value)} /></div><div><label className="text-sm font-medium mb-1.5 block">Type moteur</label><Input value={form.motor_type} onChange={e => updateField('motor_type', e.target.value)} placeholder="Gearless" /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Variateur</label><Input value={form.variator_type} onChange={e => updateField('variator_type', e.target.value)} placeholder="VVVF" /></div><div><label className="text-sm font-medium mb-1.5 block">Marque armoire</label><Input value={form.controller_brand} onChange={e => updateField('controller_brand', e.target.value)} /></div></div><div><label className="text-sm font-medium mb-1.5 block">Type armoire</label><Input value={form.controller_type} onChange={e => updateField('controller_type', e.target.value)} placeholder="Collective descente" /></div></div>)}
            {activeSection === 'notes' && (<div className="space-y-6"><div><label className="text-sm font-medium mb-1.5 block">Notes</label><Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={5} /></div><div><label className="text-sm font-medium mb-2 block">Photos</label><PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={10} /></div></div>)}
            <div className="flex gap-3 pt-6 mt-6 border-t border-[var(--border-primary)]"><Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button><Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={isLoading}>{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {appareil ? 'Enregistrer' : 'Créer'}</>}</Button></div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL CHECKLIST (PERSISTANTE)
// =============================================
interface CheckpointData { status: string; remarks: string; measurement: string; }
interface EssaisEnCharge {
  speed_empty_up: string; speed_empty_down: string;
  speed_half_up: string; speed_half_down: string;
  speed_full_up: string; speed_full_down: string;
  amp_empty_up: string; amp_empty_down: string;
  amp_half_up: string; amp_half_down: string;
  amp_full_up: string; amp_full_down: string;
  remarks: string;
}

const defaultEssais: EssaisEnCharge = {
  speed_empty_up: '', speed_empty_down: '',
  speed_half_up: '', speed_half_down: '',
  speed_full_up: '', speed_full_down: '',
  amp_empty_up: '', amp_empty_down: '',
  amp_half_up: '', amp_half_down: '',
  amp_full_up: '', amp_full_down: '',
  remarks: ''
};

function ChecklistModal({ appareil, onClose, onSave }: { appareil: any; onClose: () => void; onSave: () => void }) {
  const [checkpoints, setCheckpoints] = useState<Record<string, CheckpointData>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>('machinerie');
  const [showMeasurement, setShowMeasurement] = useState<Record<string, boolean>>({});
  const [essaisEnCharge, setEssaisEnCharge] = useState<EssaisEnCharge>(defaultEssais);
  const [showEssaisEnCharge, setShowEssaisEnCharge] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionDate, setInspectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => { loadOrCreateReport(); }, [appareil.id]);

  const loadOrCreateReport = async () => {
    try {
      const { data: existing } = await supabase.from('mes_inspection_reports').select('*, mes_inspection_checkpoints(*)').eq('device_id', appareil.id).in('status', ['brouillon', 'en_cours']).order('created_at', { ascending: false }).limit(1).single();
      if (existing) {
        setReportId(existing.id);
        setInspectorName(existing.inspector_name || '');
        setInspectionDate(existing.inspection_date || format(new Date(), 'yyyy-MM-dd'));
        const loaded: Record<string, CheckpointData> = {};
        const showMeas: Record<string, boolean> = {};
        existing.mes_inspection_checkpoints?.forEach((cp: any) => { 
          loaded[cp.checkpoint_code] = { status: cp.status || '', remarks: cp.remarks || '', measurement: cp.measurement || '' }; 
          if (cp.measurement) showMeas[cp.checkpoint_code] = true;
        });
        setCheckpoints(loaded);
        setShowMeasurement(showMeas);
        // Charger les essais en charge
        if (existing.speed_empty_up || existing.amp_empty_up) {
          setEssaisEnCharge({
            speed_empty_up: existing.speed_empty_up || '', speed_empty_down: existing.speed_empty_down || '',
            speed_half_up: existing.speed_half_up || '', speed_half_down: existing.speed_half_down || '',
            speed_full_up: existing.speed_full_up || '', speed_full_down: existing.speed_full_down || '',
            amp_empty_up: existing.amp_empty_up || '', amp_empty_down: existing.amp_empty_down || '',
            amp_half_up: existing.amp_half_up || '', amp_half_down: existing.amp_half_down || '',
            amp_full_up: existing.amp_full_up || '', amp_full_down: existing.amp_full_down || '',
            remarks: existing.general_remarks || ''
          });
          setShowEssaisEnCharge(true);
        }
      }
    } catch { /* pas de rapport existant */ }
  };

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, typeof CHECKLIST_COPREC> = {};
    CHECKLIST_COPREC.forEach(item => { if (!groups[item.section]) groups[item.section] = []; groups[item.section].push(item); });
    return groups;
  }, []);

  const updateCheckpoint = (code: string, field: keyof CheckpointData, value: string) => { 
    setCheckpoints(prev => ({ ...prev, [code]: { ...prev[code], [field]: value } })); 
  };

  const toggleMeasurement = (code: string) => {
    setShowMeasurement(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const updateEssai = (field: keyof EssaisEnCharge, value: string) => {
    setEssaisEnCharge(prev => ({ ...prev, [field]: value }));
  };

  const stats = useMemo(() => {
    const values = Object.values(checkpoints);
    return { total: CHECKLIST_COPREC.length, conforme: values.filter(v => v.status === 'C').length, nonConforme: values.filter(v => v.status === 'NC').length, sansObjet: values.filter(v => v.status === 'SO').length };
  }, [checkpoints]);

  const progress = Math.round(((stats.conforme + stats.nonConforme + stats.sansObjet) / stats.total) * 100);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let currentReportId = reportId;
      const reportData = { 
        inspector_name: inspectorName, 
        inspection_date: inspectionDate, 
        status: progress === 100 ? 'termine' : 'en_cours',
        speed_empty_up: essaisEnCharge.speed_empty_up || null,
        speed_empty_down: essaisEnCharge.speed_empty_down || null,
        speed_half_up: essaisEnCharge.speed_half_up || null,
        speed_half_down: essaisEnCharge.speed_half_down || null,
        speed_full_up: essaisEnCharge.speed_full_up || null,
        speed_full_down: essaisEnCharge.speed_full_down || null,
        amp_empty_up: essaisEnCharge.amp_empty_up || null,
        amp_empty_down: essaisEnCharge.amp_empty_down || null,
        amp_half_up: essaisEnCharge.amp_half_up || null,
        amp_half_down: essaisEnCharge.amp_half_down || null,
        amp_full_up: essaisEnCharge.amp_full_up || null,
        amp_full_down: essaisEnCharge.amp_full_down || null,
        general_remarks: essaisEnCharge.remarks || null
      };

      if (!currentReportId) {
        const reportNumber = `RAP-${appareil.device_number}-${format(new Date(), 'yyyyMMdd')}`;
        const { data: newReport, error } = await supabase.from('mes_inspection_reports').insert({ 
          device_id: appareil.id, 
          report_number: reportNumber, 
          report_type: 'mise_en_service', 
          ...reportData 
        }).select().single();
        if (error) throw error;
        currentReportId = newReport.id;
        setReportId(currentReportId);
      } else {
        await supabase.from('mes_inspection_reports').update(reportData).eq('id', currentReportId);
      }
      await supabase.from('mes_inspection_checkpoints').delete().eq('report_id', currentReportId);
      const checkpointsToInsert = CHECKLIST_COPREC.map(item => {
        const cp = checkpoints[item.code] || { status: '', remarks: '', measurement: '' };
        return { report_id: currentReportId, section: item.section, checkpoint_code: item.code, checkpoint_label: item.label, checkpoint_detail: item.detail, status: cp.status || null, remarks: cp.remarks || null, measurement: cp.measurement || null };
      });
      const { error: cpError } = await supabase.from('mes_inspection_checkpoints').insert(checkpointsToInsert);
      if (cpError) throw cpError;
      toast.success('Checklist enregistrée');
      onSave();
    } catch (error: any) { toast.error(error.message || 'Erreur'); } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="w-[1000px] max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border-primary)] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">Checklist d'inspection COPREC</h2>
                <p className="text-sm text-[var(--text-muted)]">{appareil.device_number} - {appareil.site_name} • <span className="text-orange-400 font-medium">{CHECKLIST_COPREC.length} points</span></p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs text-[var(--text-muted)] block mb-1">Inspecteur</label><Input value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="Nom" className="h-9" /></div>
              <div><label className="text-xs text-[var(--text-muted)] block mb-1">Date</label><Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} className="h-9" /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1"><span className="text-sm">Progression</span><span className="text-sm font-bold text-orange-400">{progress}%</span></div>
                <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${progress}%` }} /></div>
              </div>
              <div className="flex gap-2">
                <Badge variant="green">C: {stats.conforme}</Badge>
                <Badge variant="red">NC: {stats.nonConforme}</Badge>
                <Badge variant="gray">SO: {stats.sansObjet}</Badge>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {/* Sections de la checklist */}
            {Object.entries(groupedChecklist).map(([section, items]) => {
              const sectionStats = items.reduce((acc, item) => { 
                const cp = checkpoints[item.code]; 
                if (cp?.status === 'C') acc.c++; 
                else if (cp?.status === 'NC') acc.nc++; 
                else if (cp?.status === 'SO') acc.so++; 
                return acc; 
              }, { c: 0, nc: 0, so: 0 });
              
              return (
                <div key={section} className="mb-4">
                  <button onClick={() => setExpandedSection(expandedSection === section ? null : section)} className="w-full flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{SECTION_LABELS[section] || section}</span>
                      <Badge variant="gray">{items.length}</Badge>
                      {sectionStats.c > 0 && <Badge variant="green">{sectionStats.c}</Badge>}
                      {sectionStats.nc > 0 && <Badge variant="red">{sectionStats.nc}</Badge>}
                    </div>
                    {expandedSection === section ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSection === section && (
                    <div className="mt-2 space-y-2">
                      {items.map(item => {
                        const cp = checkpoints[item.code] || { status: '', remarks: '', measurement: '' };
                        const hasMeasurement = showMeasurement[item.code];
                        
                        return (
                          <div key={item.code} className={`p-3 rounded-lg border ${
                            cp.status === 'C' ? 'bg-green-500/5 border-green-500/30' : 
                            cp.status === 'NC' ? 'bg-red-500/5 border-red-500/30' : 
                            cp.status === 'SO' ? 'bg-gray-500/5 border-gray-500/30' : 
                            'bg-[var(--bg-elevated)] border-[var(--border-primary)]'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-orange-400">{item.code}</span>
                                  <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)]">{item.detail}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleMeasurement(item.code)}
                                  className={`p-1.5 rounded transition-all ${hasMeasurement ? 'bg-blue-500/20 text-blue-500' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`}
                                  title={hasMeasurement ? 'Masquer mesure' : 'Ajouter mesure'}
                                >
                                  <Ruler className="w-4 h-4" />
                                </button>
                                <div className="flex gap-1">
                                  {[{ v: 'C', color: '#10B981' }, { v: 'NC', color: '#EF4444' }, { v: 'SO', color: '#6B7280' }].map(({ v, color }) => (
                                    <button 
                                      key={v} 
                                      onClick={() => updateCheckpoint(item.code, 'status', cp.status === v ? '' : v)} 
                                      className={`w-10 h-8 rounded text-xs font-bold ${cp.status === v ? 'text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'}`} 
                                      style={cp.status === v ? { backgroundColor: color } : {}}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {hasMeasurement && (
                              <div className="mt-2">
                                <Input value={cp.measurement} onChange={e => updateCheckpoint(item.code, 'measurement', e.target.value)} placeholder="Mesure / Valeur relevée" className="h-8 text-sm" />
                              </div>
                            )}
                            <div className="mt-2">
                              <Input value={cp.remarks} onChange={e => updateCheckpoint(item.code, 'remarks', e.target.value)} placeholder={cp.status === 'NC' ? 'Remarques (obligatoire pour NC)' : 'Remarques (optionnel)'} className={`h-8 text-sm ${cp.status === 'NC' && !cp.remarks ? 'border-red-500' : ''}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Section Essais en charge - Tableau */}
            <div className="mb-4">
              <button onClick={() => setShowEssaisEnCharge(!showEssaisEnCharge)} className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-lg hover:from-orange-500/30 hover:to-amber-500/30">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-orange-400" />
                  <span className="font-semibold text-orange-400">Essais en charge</span>
                  <Badge variant="orange">Mesures vitesse & ampérage</Badge>
                </div>
                {showEssaisEnCharge ? <ChevronUp className="w-4 h-4 text-orange-400" /> : <ChevronDown className="w-4 h-4 text-orange-400" />}
              </button>
              
              {showEssaisEnCharge && (
                <div className="mt-3 p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-primary)]">
                  {/* Tableau Vitesse */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      Mesures de vitesse (m/s)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-primary)]">
                            <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Charge</th>
                            <th className="text-center py-2 px-3 font-medium text-green-400">↑ Montée</th>
                            <th className="text-center py-2 px-3 font-medium text-red-400">↓ Descente</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[var(--border-primary)]/50">
                            <td className="py-2 px-3 font-medium">À vide</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_empty_up} onChange={e => updateEssai('speed_empty_up', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_empty_down} onChange={e => updateEssai('speed_empty_down', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                          </tr>
                          <tr className="border-b border-[var(--border-primary)]/50">
                            <td className="py-2 px-3 font-medium">Demi-charge</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_half_up} onChange={e => updateEssai('speed_half_up', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_half_down} onChange={e => updateEssai('speed_half_down', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium">Pleine charge</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_full_up} onChange={e => updateEssai('speed_full_up', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.speed_full_down} onChange={e => updateEssai('speed_full_down', e.target.value)} placeholder="0.00" className="h-8 text-center text-sm" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tableau Ampérage */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Mesures d'ampérage (A)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-primary)]">
                            <th className="text-left py-2 px-3 font-medium text-[var(--text-muted)]">Charge</th>
                            <th className="text-center py-2 px-3 font-medium text-green-400">↑ Montée</th>
                            <th className="text-center py-2 px-3 font-medium text-red-400">↓ Descente</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[var(--border-primary)]/50">
                            <td className="py-2 px-3 font-medium">À vide</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_empty_up} onChange={e => updateEssai('amp_empty_up', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_empty_down} onChange={e => updateEssai('amp_empty_down', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                          </tr>
                          <tr className="border-b border-[var(--border-primary)]/50">
                            <td className="py-2 px-3 font-medium">Demi-charge</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_half_up} onChange={e => updateEssai('amp_half_up', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_half_down} onChange={e => updateEssai('amp_half_down', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium">Pleine charge</td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_full_up} onChange={e => updateEssai('amp_full_up', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                            <td className="py-2 px-3"><Input value={essaisEnCharge.amp_full_down} onChange={e => updateEssai('amp_full_down', e.target.value)} placeholder="0.0" className="h-8 text-center text-sm" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Remarques générales */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Remarques essais en charge</label>
                    <Textarea value={essaisEnCharge.remarks} onChange={e => updateEssai('remarks', e.target.value)} placeholder="Observations sur les essais en charge..." rows={2} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL BUREAU DE CONTRÔLE
// =============================================
function BureauControleModal({ appareil, onClose, onSave }: { appareil: any; onClose: () => void; onSave: () => void }) {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reserves, setReserves] = useState<any[]>([]);
  const [newReserve, setNewReserve] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ control_office: '', report_number: '', report_date: format(new Date(), 'yyyy-MM-dd'), status: 'en_attente', observations: '', remaining_reserves: '' });

  useEffect(() => { loadReports(); }, [appareil.id]);

  const loadReports = async () => {
    setIsLoading(true);
    try { const { data } = await supabase.from('mes_control_reports').select('*, mes_bc_reserve_items(*)').eq('device_id', appareil.id).order('created_at', { ascending: false }); setReports(data || []); } catch { }
    finally { setIsLoading(false); }
  };

  const selectReport = (report: any) => {
    setSelectedReport(report);
    setForm({ control_office: report.control_office || '', report_number: report.report_number || '', report_date: report.report_date || format(new Date(), 'yyyy-MM-dd'), status: report.status || 'en_attente', observations: report.observations || '', remaining_reserves: report.remaining_reserves || '' });
    setReserves(report.mes_bc_reserve_items || []);
    setShowForm(true);
  };

  const createNew = () => {
    setSelectedReport(null);
    setForm({ control_office: '', report_number: `BC-${appareil.device_number}-${format(new Date(), 'yyyyMMdd')}`, report_date: format(new Date(), 'yyyy-MM-dd'), status: 'en_attente', observations: '', remaining_reserves: '' });
    setReserves([]);
    setShowForm(true);
  };

  const handleSaveReport = async () => {
    if (!form.control_office) { toast.error('Bureau de contrôle requis'); return; }
    setIsSaving(true);
    try {
      let reportId = selectedReport?.id;
      const allResolved = reserves.length > 0 && reserves.every(r => r.is_resolved);
      if (selectedReport) {
        await supabase.from('mes_control_reports').update({ ...form, reserves_lifted: allResolved }).eq('id', selectedReport.id);
      } else {
        const { data, error } = await supabase.from('mes_control_reports').insert({ device_id: appareil.id, ...form, reserves_lifted: false }).select().single();
        if (error) throw error;
        reportId = data.id;
      }
      if (reportId) {
        await supabase.from('mes_bc_reserve_items').delete().eq('report_id', reportId);
        if (reserves.length > 0) {
          await supabase.from('mes_bc_reserve_items').insert(reserves.map(r => ({ report_id: reportId, description: r.description, is_resolved: r.is_resolved || false, resolved_at: r.is_resolved ? new Date().toISOString() : null })));
        }
      }
      toast.success('Rapport BC enregistré');
      loadReports();
      setShowForm(false);
      onSave();
    } catch (error: any) { toast.error(error.message || 'Erreur'); } finally { setIsSaving(false); }
  };

  const addReserve = () => { if (!newReserve.trim()) return; setReserves([...reserves, { description: newReserve, is_resolved: false }]); setNewReserve(''); };
  const toggleReserve = (idx: number) => { setReserves(reserves.map((r, i) => i === idx ? { ...r, is_resolved: !r.is_resolved } : r)); };
  const deleteReserve = (idx: number) => { setReserves(reserves.filter((_, i) => i !== idx)); };
  const deleteReport = async (id: string) => { if (!confirm('Supprimer ce rapport BC ?')) return; try { await supabase.from('mes_control_reports').delete().eq('id', id); toast.success('Supprimé'); loadReports(); } catch (e: any) { toast.error(e.message); } };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-orange-400" /> Bureau de Contrôle</h2><p className="text-sm text-[var(--text-muted)]">{appareil.device_number} - {appareil.site_name}</p></div><div className="flex items-center gap-2">{!showForm && <Button variant="primary" size="sm" onClick={createNew}><Plus className="w-4 h-4" /> Nouveau</Button>}<button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button></div></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : showForm ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4"><button onClick={() => setShowForm(false)} className="p-1 hover:bg-[var(--bg-tertiary)] rounded"><ChevronUp className="w-4 h-4 rotate-[-90deg]" /></button><h3 className="font-semibold">{selectedReport ? 'Modifier' : 'Nouveau rapport BC'}</h3></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Bureau de contrôle *</label><Select value={form.control_office} onChange={e => setForm({ ...form, control_office: e.target.value })}><option value="">...</option>{BUREAUX_CONTROLE.map(bc => <option key={bc} value={bc}>{bc}</option>)}</Select></div><div><label className="text-sm font-medium mb-1.5 block">N° Rapport</label><Input value={form.report_number} onChange={e => setForm({ ...form, report_number: e.target.value })} /></div></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1.5 block">Date</label><Input type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} /></div><div><label className="text-sm font-medium mb-1.5 block">Statut</label><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{BC_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></div></div>
                <div><label className="text-sm font-medium mb-1.5 block">Observations</label><Textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={3} /></div>
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h4 className="font-semibold mb-3 flex items-center gap-2"><FileWarning className="w-4 h-4 text-orange-400" /> Réserves ({reserves.length})</h4>
                  <div className="flex gap-2 mb-3"><Input value={newReserve} onChange={e => setNewReserve(e.target.value)} placeholder="Ajouter une réserve..." onKeyPress={e => e.key === 'Enter' && addReserve()} /><Button variant="secondary" onClick={addReserve}><Plus className="w-4 h-4" /></Button></div>
                  {reserves.length === 0 ? <p className="text-sm text-[var(--text-muted)] text-center py-4">Aucune réserve</p> : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">{reserves.map((r, idx) => (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${r.is_resolved ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <button onClick={() => toggleReserve(idx)} className={`p-1 rounded ${r.is_resolved ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>{r.is_resolved ? <CheckSquare className="w-4 h-4" /> : <div className="w-4 h-4 border-2 rounded" />}</button>
                        <span className={`flex-1 text-sm ${r.is_resolved ? 'line-through text-[var(--text-muted)]' : ''}`}>{r.description}</span>
                        <button onClick={() => deleteReserve(idx)} className="p-1 text-red-500 hover:bg-red-500/20 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}</div>
                  )}
                </div>
                <div className="flex gap-3 pt-4"><Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button><Button variant="primary" className="flex-1" onClick={handleSaveReport} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}</Button></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12"><BadgeCheck className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Aucun rapport Bureau de Contrôle</h3><p className="text-sm text-[var(--text-muted)] mb-4">Créez un rapport pour suivre les contrôles</p><Button variant="primary" onClick={createNew}><Plus className="w-4 h-4" /> Créer</Button></div>
            ) : (
              <div className="space-y-3">{reports.map(report => {
                const statusInfo = getBCStatusInfo(report.status);
                const reservesCount = report.mes_bc_reserve_items?.length || 0;
                const resolvedCount = report.mes_bc_reserve_items?.filter((r: any) => r.is_resolved).length || 0;
                return (
                  <div key={report.id} className="p-4 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--bg-secondary)] cursor-pointer" onClick={() => selectReport(report)}>
                    <div className="flex items-start justify-between">
                      <div><div className="flex items-center gap-2 mb-1"><span className="font-semibold">{report.control_office}</span><Badge style={{ backgroundColor: statusInfo.bg }} className="text-white">{statusInfo.label}</Badge></div><p className="text-sm text-[var(--text-muted)]">N° {report.report_number} • {report.report_date ? format(parseISO(report.report_date), 'd MMM yyyy', { locale: fr }) : '-'}</p>{reservesCount > 0 && <p className="text-xs mt-1"><span className={resolvedCount === reservesCount ? 'text-green-500' : 'text-orange-500'}>{resolvedCount}/{reservesCount} réserves levées</span></p>}</div>
                      <button onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }} className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}</div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL DÉTAIL APPAREIL
// =============================================
function AppareilDetailModal({ appareil, onClose, onEdit, onArchive, onRefresh }: { appareil: any; onClose: () => void; onEdit: () => void; onArchive: () => void; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState('info');
  const [showChecklist, setShowChecklist] = useState(false);
  const [showBC, setShowBC] = useState(false);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => { const { error } = await supabase.from('mise_en_service').update({ status: newStatus }).eq('id', appareil.id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); onRefresh(); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusInfo = getStatusInfo(appareil.status);
  const tabs = [{ id: 'info', label: 'Informations', icon: FileText }, { id: 'technique', label: 'Technique', icon: Settings }, { id: 'checklist', label: 'Checklist', icon: ClipboardList }, { id: 'bc', label: 'Bureau Contrôle', icon: BadgeCheck }];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border-primary)] flex-shrink-0">
            <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 mb-1"><span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span><Badge style={{ backgroundColor: statusInfo.bg }} className="text-white">{statusInfo.label}</Badge></div><h2 className="text-xl font-bold">{appareil.site_name}</h2><p className="text-sm text-[var(--text-muted)]">{[appareil.address_street, appareil.address_zip, appareil.address_city].filter(Boolean).join(', ')}</p></div><div className="flex items-center gap-2"><button onClick={onArchive} className="p-2 hover:bg-amber-500/20 rounded-lg" title="Archiver"><Archive className="w-5 h-5" /></button><button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg" title="Modifier"><Edit className="w-5 h-5" /></button><button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"><X className="w-5 h-5" /></button></div></div>
            <div className="flex gap-2 mt-4 flex-wrap">{STATUTS.map(s => (<button key={s.value} onClick={() => updateStatusMutation.mutate(s.value)} disabled={updateStatusMutation.isPending} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${appareil.status === s.value ? 'text-white shadow-lg' : 'bg-[var(--bg-tertiary)]'}`} style={appareil.status === s.value ? { backgroundColor: s.bg } : {}}>{s.label}</button>))}</div>
            <div className="flex gap-1 mt-4">{tabs.map(t => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === t.id ? 'bg-[var(--bg-secondary)] text-orange-400 border-b-2 border-orange-400' : 'text-[var(--text-muted)]'}`}><t.icon className="w-4 h-4" />{t.label}</button>))}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'info' && (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Identification</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Fabricant</span><span className="font-medium">{appareil.manufacturer || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Modèle</span><span className="font-medium">{appareil.model || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span className="font-medium">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Bâtiment</span><span className="font-medium">{TYPES_BATIMENT.find(t => t.value === appareil.building_type)?.label || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Année</span><span className="font-medium">{appareil.installation_year || '-'}</span></div></div></div><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Gauge className="w-4 h-4" /> Caractéristiques</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Charge</span><span className="font-medium">{appareil.load_capacity ? `${appareil.load_capacity} kg` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Vitesse</span><span className="font-medium">{appareil.speed ? `${appareil.speed} m/s` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Course</span><span className="font-medium">{appareil.course ? `${appareil.course} m` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Niveaux</span><span className="font-medium">{appareil.levels_count || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Accès</span><span className="font-medium">{appareil.access_count || 1}</span></div></div></div></div>{appareil.notes && <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-2">Notes</h3><p className="text-sm whitespace-pre-wrap">{appareil.notes}</p></div>}<ContextChat contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} /><ContextNotes contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} /></div>)}
            {activeTab === 'technique' && (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Ruler className="w-4 h-4" /> Dimensions</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Cabine</span><span>{appareil.cabin_dimensions || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Cuvette</span><span>{appareil.pit_depth ? `${appareil.pit_depth} m` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Passage tête</span><span>{appareil.headroom ? `${appareil.headroom} m` : '-'}</span></div></div></div><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Cable className="w-4 h-4" /> Suspension</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Câbles</span><span>{appareil.cables_count ? `${appareil.cables_count} x ${appareil.cables_diameter || '?'} mm` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Mouflage</span><span>{appareil.suspension_ratio || '-'}</span></div></div></div></div><div className="grid grid-cols-2 gap-4"><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Sécurités</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Parachute</span><span>{appareil.parachute_type || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Serrures</span><span>{appareil.lock_type || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Alarme</span><span>{appareil.alarm_system || '-'}</span></div></div></div><div className="p-4 bg-[var(--bg-tertiary)] rounded-xl"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wrench className="w-4 h-4" /> Machine</h3><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Puissance</span><span>{appareil.motor_power ? `${appareil.motor_power} kW` : '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span>{appareil.motor_type || '-'}</span></div><div className="flex justify-between"><span className="text-[var(--text-muted)]">Variateur</span><span>{appareil.variator_type || '-'}</span></div></div></div></div></div>)}
            {activeTab === 'checklist' && (<div className="text-center py-8"><ClipboardList className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Checklist d'inspection COPREC</h3><p className="text-sm text-[var(--text-muted)] mb-4">{CHECKLIST_COPREC.length} points de contrôle</p><Button variant="primary" onClick={() => setShowChecklist(true)}><ClipboardList className="w-4 h-4" /> Ouvrir la checklist</Button></div>)}
            {activeTab === 'bc' && (<div className="text-center py-8"><BadgeCheck className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Bureau de Contrôle</h3><p className="text-sm text-[var(--text-muted)] mb-4">Gérez les rapports et réserves BC</p><Button variant="primary" onClick={() => setShowBC(true)}><BadgeCheck className="w-4 h-4" /> Ouvrir Bureau Contrôle</Button></div>)}
          </div>
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3"><Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button><Button variant="primary" className="flex-1" onClick={onEdit}><Edit className="w-4 h-4" /> Modifier</Button></div>
        </CardBody>
      </Card>
      {showChecklist && <ChecklistModal appareil={appareil} onClose={() => setShowChecklist(false)} onSave={() => { setShowChecklist(false); onRefresh(); }} />}
      {showBC && <BureauControleModal appareil={appareil} onClose={() => setShowBC(false)} onSave={() => onRefresh()} />}
    </div>
  );
}

// =============================================
// PAGE PRINCIPALE
// =============================================
export function MiseEnServicePage() {
  const [showForm, setShowForm] = useState(false);
  const [editAppareil, setEditAppareil] = useState<any>(null);
  const [detailAppareil, setDetailAppareil] = useState<any>(null);
  const [archiveItem, setArchiveItem] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: appareils, isLoading, refetch } = useQuery({ queryKey: ['mise-en-service'], queryFn: async () => { const { data, error } = await supabase.from('mise_en_service').select('*').or('archived.is.null,archived.eq.false').order('created_at', { ascending: false }); if (error) throw error; return data || []; } });

  const createMutation = useMutation({ mutationFn: async (data: any) => { const { data: result, error } = await supabase.from('mise_en_service').insert(data).select().single(); if (error) throw error; return result; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Appareil créé'); setShowForm(false); }, onError: (e: any) => toast.error(e.message) });
  const updateMutation = useMutation({ mutationFn: async ({ id, data }: { id: string; data: any }) => { const { error } = await supabase.from('mise_en_service').update(data).eq('id', id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Mis à jour'); setEditAppareil(null); } });
  const archiveMutation = useMutation({ mutationFn: async ({ id, raison }: { id: string; raison: string }) => { const { error } = await supabase.from('mise_en_service').update({ archived: true, archived_at: new Date().toISOString(), archive_reason: raison }).eq('id', id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mise-en-service'] }); toast.success('Archivé'); setArchiveItem(null); setDetailAppareil(null); } });

  const filtered = useMemo(() => { return appareils?.filter(a => { if (filterStatus && a.status !== filterStatus) return false; if (searchQuery) { const q = searchQuery.toLowerCase(); return a.device_number?.toLowerCase().includes(q) || a.site_name?.toLowerCase().includes(q) || a.address_city?.toLowerCase().includes(q) || a.manufacturer?.toLowerCase().includes(q); } return true; }) || []; }, [appareils, filterStatus, searchQuery]);
  const stats = useMemo(() => { const all = appareils || []; return { total: all.length, ...STATUTS.reduce((acc, s) => ({ ...acc, [s.value]: all.filter(a => a.status === s.value).length }), {}) }; }, [appareils]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Mise en service</h1><p className="text-sm text-[var(--text-muted)]">{stats.total} appareils</p></div><Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nouvel appareil</Button></div>
      <Card><CardBody className="p-3"><div className="flex items-center gap-3 flex-wrap"><div className="relative flex-1 min-w-[200px] max-w-[300px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" /><Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="pl-10" /></div><div className="flex gap-1 flex-wrap"><button onClick={() => setFilterStatus(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!filterStatus ? 'bg-orange-500 text-white' : 'bg-[var(--bg-tertiary)]'}`}>Tous ({stats.total})</button>{STATUTS.map(s => (<button key={s.value} onClick={() => setFilterStatus(s.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterStatus === s.value ? 'text-white' : 'bg-[var(--bg-tertiary)]'}`} style={filterStatus === s.value ? { backgroundColor: s.bg } : {}}>{s.label} ({(stats as any)[s.value] || 0})</button>))}</div><div className="ml-auto flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1"><button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-[var(--bg-elevated)] shadow-sm' : ''}`}><LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#F97316' : undefined }} /></button><button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-[var(--bg-elevated)] shadow-sm' : ''}`}><List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#F97316' : undefined }} /></button></div></div></CardBody></Card>
      {isLoading ? <Card><CardBody className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardBody></Card> : filtered.length === 0 ? <Card><CardBody className="text-center py-12"><Building2 className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" /><h3 className="text-lg font-semibold mb-2">Aucun appareil</h3><p className="text-sm text-[var(--text-muted)] mb-4">Ajoutez un appareil</p><Button variant="primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Ajouter</Button></CardBody></Card> : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(appareil => { const statusInfo = getStatusInfo(appareil.status); return (<Card key={appareil.id} className="hover:border-orange-500/30 cursor-pointer hover:shadow-lg" onClick={() => setDetailAppareil(appareil)}><CardBody><div className="flex items-start justify-between mb-3"><div><span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span><Badge className="ml-2 text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge></div></div><h3 className="font-semibold mb-1">{appareil.site_name}</h3><p className="text-sm text-[var(--text-muted)] mb-3">{appareil.address_city || '-'}</p><div className="flex gap-3 text-xs text-[var(--text-muted)]">{appareil.manufacturer && <span>{appareil.manufacturer}</span>}{appareil.levels_count && <span>{appareil.levels_count} niv.</span>}{appareil.load_capacity && <span>{appareil.load_capacity} kg</span>}</div></CardBody></Card>); })}</div>
      ) : (
        <Card><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-[var(--border-primary)]"><th className="text-left p-3 text-sm font-semibold">N° Appareil</th><th className="text-left p-3 text-sm font-semibold">Site</th><th className="text-left p-3 text-sm font-semibold">Ville</th><th className="text-left p-3 text-sm font-semibold">Type</th><th className="text-left p-3 text-sm font-semibold">Fabricant</th><th className="text-left p-3 text-sm font-semibold">Statut</th></tr></thead><tbody>{filtered.map(appareil => { const statusInfo = getStatusInfo(appareil.status); return (<tr key={appareil.id} onClick={() => setDetailAppareil(appareil)} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"><td className="p-3 font-mono font-bold text-orange-400">{appareil.device_number}</td><td className="p-3">{appareil.site_name}</td><td className="p-3 text-[var(--text-muted)]">{appareil.address_city || '-'}</td><td className="p-3 text-[var(--text-muted)]">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</td><td className="p-3 text-[var(--text-muted)]">{appareil.manufacturer || '-'}</td><td className="p-3"><Badge className="text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge></td></tr>); })}</tbody></table></div></Card>
      )}
      {showForm && <AppareilFormModal onClose={() => setShowForm(false)} onSave={data => createMutation.mutate(data)} isLoading={createMutation.isPending} />}
      {editAppareil && <AppareilFormModal appareil={editAppareil} onClose={() => setEditAppareil(null)} onSave={data => updateMutation.mutate({ id: editAppareil.id, data })} isLoading={updateMutation.isPending} />}
      {detailAppareil && <AppareilDetailModal appareil={detailAppareil} onClose={() => setDetailAppareil(null)} onEdit={() => { setEditAppareil(detailAppareil); setDetailAppareil(null); }} onArchive={() => setArchiveItem(detailAppareil)} onRefresh={() => refetch().then(r => { if (r.data) { const u = r.data.find((a: any) => a.id === detailAppareil.id); if (u) setDetailAppareil(u); } })} />}
      {archiveItem && <ArchiveModal type="mise_en_service" code={archiveItem.device_number} libelle={`${archiveItem.device_number} - ${archiveItem.site_name}`} onClose={() => setArchiveItem(null)} onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })} isLoading={archiveMutation.isPending} />}
    </div>
  );
}
