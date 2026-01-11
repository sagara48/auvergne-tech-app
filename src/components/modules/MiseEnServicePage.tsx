import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Check, Plus, X, Calendar, User, MapPin, Edit, Archive, Search,
  Building2, Zap, Settings, CheckCircle, Loader2, FileText, Camera, 
  Image, Clock, AlertTriangle, Play, Flag, ChevronDown, ChevronUp,
  Trash2, Download, Eye, Upload, ClipboardList, Shield, Gauge,
  LayoutGrid, List, Filter, MoreVertical, RefreshCw, FileCheck,
  Wrench, Cable, Lock, Ruler, Weight, Layers, Box
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

// Checklist COPREC complète (92 points)
const CHECKLIST_COPREC = [
  // MACHINERIE (15 points)
  { section: 'machinerie', code: 'MAC-01', label: 'Documentation machinerie', detail: 'Plan, schémas électriques, attestation des composants' },
  { section: 'machinerie', code: 'MAC-02', label: 'Porte local et serrure', detail: 'Fermeture, verrouillage' },
  { section: 'machinerie', code: 'MAC-03', label: 'Éclairage machinerie', detail: '200 lux minimum' },
  { section: 'machinerie', code: 'MAC-04', label: 'Éclairage de sécurité', detail: 'Fonctionnement' },
  { section: 'machinerie', code: 'MAC-05', label: 'Tableau d\'alimentation', detail: 'Interrupteur de force, disjoncteurs éclairage et PC' },
  { section: 'machinerie', code: 'MAC-06', label: 'Câblage', detail: 'Alimentation, téléphone, U36' },
  { section: 'machinerie', code: 'MAC-07', label: 'Ventilation', detail: 'Fonctionnement' },
  { section: 'machinerie', code: 'MAC-08', label: 'Thermostat', detail: 'Température ambiante en machinerie' },
  { section: 'machinerie', code: 'MAC-09', label: 'Signalisation de sécurité', detail: 'Pancarte porte, manœuvre de dépannage' },
  { section: 'machinerie', code: 'MAC-10', label: 'Accessoires de levage', detail: 'Estampillé' },
  { section: 'machinerie', code: 'MAC-11', label: 'Matériel étranger', detail: 'Absence de matériel, protection' },
  { section: 'machinerie', code: 'MAC-12', label: 'Machine de traction', detail: 'État général, fixation, niveau d\'huile' },
  { section: 'machinerie', code: 'MAC-13', label: 'Frein', detail: 'Fonctionnement, usure des garnitures' },
  { section: 'machinerie', code: 'MAC-14', label: 'Limiteur de vitesse', detail: 'Plombage, fonctionnement, type CE' },
  { section: 'machinerie', code: 'MAC-15', label: 'Poulie de traction', detail: 'Usure des gorges' },
  // LOCAL POULIES (4 points)
  { section: 'local_poulies', code: 'POU-01', label: 'Porte et serrure', detail: 'Fermeture, verrouillage' },
  { section: 'local_poulies', code: 'POU-02', label: 'Éclairage', detail: 'Fonctionnement' },
  { section: 'local_poulies', code: 'POU-03', label: 'Prise de courant', detail: 'Présente et fonctionnelle' },
  { section: 'local_poulies', code: 'POU-04', label: 'Stop', detail: 'Bouton d\'arrêt d\'urgence' },
  // GAINE (7 points)
  { section: 'gaine', code: 'GAI-01', label: 'Fermeture de la gaine', detail: 'Étanchéité, protection' },
  { section: 'gaine', code: 'GAI-02', label: 'Ventilation haute', detail: 'Fonctionnement' },
  { section: 'gaine', code: 'GAI-03', label: 'Vitrage gaine', detail: 'Type feuilleté' },
  { section: 'gaine', code: 'GAI-04', label: 'Réserves supérieures', detail: 'Norme EN81-21, toit-plafond, réserve amortisseur' },
  { section: 'gaine', code: 'GAI-05', label: 'Éclairage de la gaine', detail: 'Lampe selon plan, éclairement 50 lux sur toit' },
  { section: 'gaine', code: 'GAI-06', label: 'Guides cabine', detail: 'Attaches conformes au plan, coulisseaux' },
  { section: 'gaine', code: 'GAI-07', label: 'Guides contrepoids', detail: 'Alignement, fixation' },
  // TOIT DE CABINE (9 points)
  { section: 'toit_cabine', code: 'TOI-01', label: 'Manœuvre d\'inspection', detail: 'Fonctionnement' },
  { section: 'toit_cabine', code: 'TOI-02', label: 'Balustrade', detail: '0.7m si distance <0.5m, 1.1m si >0.5m' },
  { section: 'toit_cabine', code: 'TOI-03', label: 'Fin de course inspection', detail: 'Fonctionnement' },
  { section: 'toit_cabine', code: 'TOI-04', label: 'Stop sur toit', detail: 'Bouton d\'arrêt d\'urgence' },
  { section: 'toit_cabine', code: 'TOI-05', label: 'Contact mou de câble', detail: 'Fonctionnement' },
  { section: 'toit_cabine', code: 'TOI-06', label: 'Prise de courant', detail: 'Présente et fonctionnelle' },
  { section: 'toit_cabine', code: 'TOI-07', label: 'Alarme sur toit', detail: 'Fonctionnement' },
  { section: 'toit_cabine', code: 'TOI-08', label: 'Éclairage secours', detail: '5 lux/h' },
  { section: 'toit_cabine', code: 'TOI-09', label: 'Signalisation de sécurité', detail: 'Réserve réduite' },
  // PORTES PALIÈRES (6 points)
  { section: 'portes_palieres', code: 'PAL-01', label: 'Portes palières', detail: 'État général, alignement' },
  { section: 'portes_palieres', code: 'PAL-02', label: 'Vitrage', detail: 'Type et état' },
  { section: 'portes_palieres', code: 'PAL-03', label: 'Boutons d\'appel', detail: 'Conforme EN81-70' },
  { section: 'portes_palieres', code: 'PAL-04', label: 'Serrures des portes', detail: 'Fonctionnement, engagement pênes' },
  { section: 'portes_palieres', code: 'PAL-05', label: 'Mise à la terre', detail: 'Continuité' },
  { section: 'portes_palieres', code: 'PAL-06', label: 'Fonctionnement réglage', detail: 'Vitesse, force de fermeture' },
  // CUVETTE (9 points)
  { section: 'cuvette', code: 'CUV-01', label: 'Profondeur', detail: 'Conforme au plan' },
  { section: 'cuvette', code: 'CUV-02', label: 'Éclairage', detail: 'Selon plan de gaine avec 50 lux' },
  { section: 'cuvette', code: 'CUV-03', label: 'Interrupteur stop', detail: 'Accessible' },
  { section: 'cuvette', code: 'CUV-04', label: 'Échelle d\'accès', detail: 'Présente et conforme' },
  { section: 'cuvette', code: 'CUV-05', label: 'Amortisseurs cabine', detail: 'Nombre et modèle conformes, type CE' },
  { section: 'cuvette', code: 'CUV-06', label: 'Amortisseurs contrepoids', detail: 'Nombre et modèle conformes, type CE' },
  { section: 'cuvette', code: 'CUV-07', label: 'Prise de courant', detail: 'À la terre' },
  { section: 'cuvette', code: 'CUV-08', label: 'Réserve sous cabine', detail: 'Mesure conforme' },
  { section: 'cuvette', code: 'CUV-09', label: 'Poulie tendeuse', detail: 'Correctement installée, contact de sécurité' },
  // CABINE (13 points)
  { section: 'cabine', code: 'CAB-01', label: 'Porte de cabine', detail: 'Contact de heurt' },
  { section: 'cabine', code: 'CAB-02', label: 'Éclairage normal', detail: '100 lux minimum' },
  { section: 'cabine', code: 'CAB-03', label: 'Éclairage de secours', detail: '5 lux/h' },
  { section: 'cabine', code: 'CAB-04', label: 'Verrouillage porte cabine', detail: 'Fonctionnement' },
  { section: 'cabine', code: 'CAB-05', label: 'Boîtes à boutons', detail: 'État et fonctionnement' },
  { section: 'cabine', code: 'CAB-06', label: 'Main courante', detail: 'Dessus à 90 cm ±25mm' },
  { section: 'cabine', code: 'CAB-07', label: 'Revêtement', detail: 'Parois, sol, vitrage marqué' },
  { section: 'cabine', code: 'CAB-08', label: 'Alarme en cabine', detail: 'Conformité EN81-28, fonctionnement' },
  { section: 'cabine', code: 'CAB-09', label: 'Pictogrammes alarme', detail: 'Jaune (émission), vert (réception)' },
  { section: 'cabine', code: 'CAB-10', label: 'Téléphone', detail: 'Fonctionnement, communication' },
  { section: 'cabine', code: 'CAB-11', label: 'Garde pieds cabine', detail: 'Type fixe/rétractable' },
  { section: 'cabine', code: 'CAB-12', label: 'Indicateur de position', detail: 'Affichage correct' },
  { section: 'cabine', code: 'CAB-13', label: 'Ventilation', detail: 'Fonctionnement' },
  // SUSPENSION (4 points)
  { section: 'suspension', code: 'SUS-01', label: 'Câbles', detail: 'Nombre, diamètre, état, usure' },
  { section: 'suspension', code: 'SUS-02', label: 'Attaches', detail: 'État et serrage' },
  { section: 'suspension', code: 'SUS-03', label: 'Garde câbles', detail: 'Présents et conformes' },
  { section: 'suspension', code: 'SUS-04', label: 'Protection points rentrants', detail: 'Présente' },
  // JEUX (2 points)
  { section: 'jeux', code: 'JEU-01', label: 'Jeu seuil-seuil', detail: '35 mm maxi' },
  { section: 'jeux', code: 'JEU-02', label: 'Parois gaine côté cabine', detail: '<150mm, CP>50' },
  // SÉCURITÉS (4 points)
  { section: 'securites', code: 'SEC-01', label: 'Parachute cabine', detail: 'Type CE, fonctionnement' },
  { section: 'securites', code: 'SEC-02', label: 'Parachute contrepoids', detail: 'Type CE si présent' },
  { section: 'securites', code: 'SEC-03', label: 'Limiteur cabine', detail: 'Type CE' },
  { section: 'securites', code: 'SEC-04', label: 'Limiteur contrepoids', detail: 'Type CE si présent' },
  // ESSAIS (12 points)
  { section: 'essais', code: 'ESS-01', label: 'Hors course haut', detail: 'Fonctionnement fin de course' },
  { section: 'essais', code: 'ESS-02', label: 'Hors course bas', detail: 'Fonctionnement fin de course' },
  { section: 'essais', code: 'ESS-03', label: 'Parachute en charge 125%', detail: 'Vitesse réduite, contact enclenché' },
  { section: 'essais', code: 'ESS-04', label: 'Masse d\'une serrure', detail: 'Déclenchement du fusible ou disjoncteur' },
  { section: 'essais', code: 'ESS-05', label: 'Freinage', detail: 'Essai de freinage' },
  { section: 'essais', code: 'ESS-06', label: 'Surcharge', detail: 'Fonctionnement dispositif' },
  { section: 'essais', code: 'ESS-07', label: 'A3', detail: 'Essai A3' },
  { section: 'essais', code: 'ESS-08', label: 'Désincarcération', detail: 'Auto et manuelle' },
  { section: 'essais', code: 'ESS-09', label: 'Nivelage', detail: 'Précision aux différents niveaux' },
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

// =============================================
// COMPOSANT UPLOAD PHOTOS
// =============================================
function PhotoUpload({ photos, onChange, maxPhotos = 10 }: { photos: string[]; onChange: (p: string[]) => void; maxPhotos?: number }) {
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
      reader.onload = () => onChange([...photos, reader.result as string]);
      reader.readAsDataURL(file);
    });
    
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      {photos.length === 0 ? (
        <div 
          onClick={() => inputRef.current?.click()} 
          className="border-2 border-dashed border-[var(--border-primary)] rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
        >
          <Camera className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Cliquez pour ajouter des photos</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden group">
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <button 
                onClick={(e) => { e.stopPropagation(); onChange(photos.filter((_, i) => i !== idx)); }} 
                className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <button 
              onClick={() => inputRef.current?.click()} 
              className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center hover:border-orange-500/50"
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
// MODAL FORMULAIRE APPAREIL COMPLET
// =============================================
function AppareilFormModal({ appareil, onClose, onSave, isLoading }: { 
  appareil?: any; 
  onClose: () => void; 
  onSave: (data: any) => void; 
  isLoading?: boolean 
}) {
  const [activeSection, setActiveSection] = useState('identification');
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    // Identification
    device_number: appareil?.device_number || '',
    site_name: appareil?.site_name || '',
    manufacturer: appareil?.manufacturer || '',
    model: appareil?.model || '',
    installation_year: appareil?.installation_year || new Date().getFullYear().toString(),
    elevator_type: appareil?.elevator_type || '',
    building_type: appareil?.building_type || '',
    
    // Adresse
    address_street: appareil?.address_street || '',
    address_city: appareil?.address_city || '',
    address_zip: appareil?.address_zip || '',
    
    // Caractéristiques générales
    load_capacity: appareil?.load_capacity || '',
    speed: appareil?.speed || '',
    course: appareil?.course || '',
    levels_count: appareil?.levels_count?.toString() || '',
    levels_served: appareil?.levels_served?.toString() || '',
    access_count: appareil?.access_count?.toString() || '1',
    
    // Dimensions
    cabin_width: appareil?.cabin_width || '',
    cabin_depth: appareil?.cabin_depth || '',
    cabin_height: appareil?.cabin_height || '',
    cabin_dimensions: appareil?.cabin_dimensions || '',
    door_width: appareil?.door_width || '',
    door_height: appareil?.door_height || '',
    pit_depth: appareil?.pit_depth || '',
    headroom: appareil?.headroom || '',
    
    // Suspension & Câbles
    cables_count: appareil?.cables_count?.toString() || '',
    cables_diameter: appareil?.cables_diameter || '',
    suspension_ratio: appareil?.suspension_ratio || '',
    cable_type: appareil?.cable_type || '',
    
    // Amortisseurs
    buffer_cabin_count: appareil?.buffer_cabin_count?.toString() || '',
    buffer_cabin_type: appareil?.buffer_cabin_type || '',
    buffer_counterweight_count: appareil?.buffer_counterweight_count?.toString() || '',
    buffer_counterweight_type: appareil?.buffer_counterweight_type || '',
    
    // Sécurités
    parachute_type: appareil?.parachute_type || '',
    lock_type: appareil?.lock_type || '',
    
    // Machine
    motor_power: appareil?.motor_power || '',
    motor_type: appareil?.motor_type || '',
    variator_type: appareil?.variator_type || '',
    
    // Autres
    controller_type: appareil?.controller_type || '',
    controller_brand: appareil?.controller_brand || '',
    alarm_system: appareil?.alarm_system || '',
    
    // Notes
    notes: appareil?.notes || '',
    status: appareil?.status || 'non_commence',
  });

  const updateField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.device_number || !form.site_name) {
      toast.error('N° appareil et nom du site sont requis');
      return;
    }

    const cabin_dimensions = form.cabin_width && form.cabin_depth && form.cabin_height 
      ? `${form.cabin_width}x${form.cabin_depth}x${form.cabin_height}`
      : form.cabin_dimensions;

    onSave({
      ...form,
      cabin_dimensions,
      levels_count: form.levels_count ? parseInt(form.levels_count) : null,
      levels_served: form.levels_served ? parseInt(form.levels_served) : null,
      access_count: form.access_count ? parseInt(form.access_count) : 1,
      cables_count: form.cables_count ? parseInt(form.cables_count) : null,
      buffer_cabin_count: form.buffer_cabin_count ? parseInt(form.buffer_cabin_count) : null,
      buffer_counterweight_count: form.buffer_counterweight_count ? parseInt(form.buffer_counterweight_count) : null,
      photos_json: photos.length > 0 ? JSON.stringify(photos) : null,
    });
  };

  const sections = [
    { id: 'identification', label: 'Identification', icon: Building2 },
    { id: 'adresse', label: 'Adresse', icon: MapPin },
    { id: 'caracteristiques', label: 'Caractéristiques', icon: Gauge },
    { id: 'dimensions', label: 'Dimensions', icon: Ruler },
    { id: 'suspension', label: 'Suspension', icon: Cable },
    { id: 'securites', label: 'Sécurités', icon: Shield },
    { id: 'machine', label: 'Machine', icon: Wrench },
    { id: 'notes', label: 'Notes & Photos', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[950px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex">
          {/* Sidebar navigation */}
          <div className="w-52 bg-[var(--bg-tertiary)] border-r border-[var(--border-primary)] p-3 flex-shrink-0 overflow-y-auto">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-2">Sections</h3>
            <div className="space-y-1">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeSection === s.id 
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <s.icon className="w-4 h-4" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {appareil ? 'Modifier l\'appareil' : 'Nouvel appareil MES'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {appareil?.device_number || 'Remplissez les informations de l\'appareil'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section: Identification */}
            {activeSection === 'identification' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                      N° Appareil <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={form.device_number} 
                      onChange={e => updateField('device_number', e.target.value)} 
                      placeholder="ASC-2024-001" 
                      className="font-mono text-lg font-bold" 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">
                      Nom du site <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={form.site_name} 
                      onChange={e => updateField('site_name', e.target.value)} 
                      placeholder="Résidence Les Volcans" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Fabricant</label>
                    <Select value={form.manufacturer} onChange={e => updateField('manufacturer', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {MARQUES.map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Modèle</label>
                    <Input value={form.model} onChange={e => updateField('model', e.target.value)} placeholder="Gen2 Comfort" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Année installation</label>
                    <Input value={form.installation_year} onChange={e => updateField('installation_year', e.target.value)} placeholder="2024" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type d'appareil</label>
                    <Select value={form.elevator_type} onChange={e => updateField('elevator_type', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {TYPES_APPAREIL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type de bâtiment</label>
                    <Select value={form.building_type} onChange={e => updateField('building_type', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {TYPES_BATIMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Section: Adresse */}
            {activeSection === 'adresse' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Adresse</label>
                  <Input value={form.address_street} onChange={e => updateField('address_street', e.target.value)} placeholder="12 rue du Puy de Dôme" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Code postal</label>
                    <Input value={form.address_zip} onChange={e => updateField('address_zip', e.target.value)} placeholder="63000" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Ville</label>
                    <Input value={form.address_city} onChange={e => updateField('address_city', e.target.value)} placeholder="Clermont-Ferrand" />
                  </div>
                </div>
              </div>
            )}

            {/* Section: Caractéristiques */}
            {activeSection === 'caracteristiques' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Charge nominale (kg)</label>
                    <Input value={form.load_capacity} onChange={e => updateField('load_capacity', e.target.value)} placeholder="630" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Vitesse (m/s)</label>
                    <Input value={form.speed} onChange={e => updateField('speed', e.target.value)} placeholder="1.0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Course (m)</label>
                    <Input value={form.course} onChange={e => updateField('course', e.target.value)} placeholder="25.5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Nombre de niveaux</label>
                    <Input type="number" value={form.levels_count} onChange={e => updateField('levels_count', e.target.value)} placeholder="8" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Niveaux desservis</label>
                    <Input type="number" value={form.levels_served} onChange={e => updateField('levels_served', e.target.value)} placeholder="8" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Nombre d'accès</label>
                    <Input type="number" value={form.access_count} onChange={e => updateField('access_count', e.target.value)} placeholder="1" />
                  </div>
                </div>
              </div>
            )}

            {/* Section: Dimensions */}
            {activeSection === 'dimensions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Box className="w-4 h-4 text-orange-400" /> Dimensions cabine (mm)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Largeur</label>
                      <Input value={form.cabin_width} onChange={e => updateField('cabin_width', e.target.value)} placeholder="1100" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Profondeur</label>
                      <Input value={form.cabin_depth} onChange={e => updateField('cabin_depth', e.target.value)} placeholder="1400" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Hauteur</label>
                      <Input value={form.cabin_height} onChange={e => updateField('cabin_height', e.target.value)} placeholder="2200" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-400" /> Passage de porte (mm)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Largeur</label>
                      <Input value={form.door_width} onChange={e => updateField('door_width', e.target.value)} placeholder="800" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Hauteur</label>
                      <Input value={form.door_height} onChange={e => updateField('door_height', e.target.value)} placeholder="2000" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-orange-400" /> Gaine
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Profondeur cuvette (m)</label>
                      <Input value={form.pit_depth} onChange={e => updateField('pit_depth', e.target.value)} placeholder="1.50" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Passage de tête (m)</label>
                      <Input value={form.headroom} onChange={e => updateField('headroom', e.target.value)} placeholder="3.50" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section: Suspension */}
            {activeSection === 'suspension' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Cable className="w-4 h-4 text-orange-400" /> Câbles de suspension
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label>
                      <Input type="number" value={form.cables_count} onChange={e => updateField('cables_count', e.target.value)} placeholder="4" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Diamètre (mm)</label>
                      <Input value={form.cables_diameter} onChange={e => updateField('cables_diameter', e.target.value)} placeholder="8" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Mouflage</label>
                      <Select value={form.suspension_ratio} onChange={e => updateField('suspension_ratio', e.target.value)}>
                        <option value="">Sélectionner...</option>
                        <option value="1:1">1:1</option>
                        <option value="2:1">2:1</option>
                        <option value="3:1">3:1</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label>
                      <Input value={form.cable_type} onChange={e => updateField('cable_type', e.target.value)} placeholder="Câbles acier" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-400" /> Amortisseurs cabine
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label>
                      <Input type="number" value={form.buffer_cabin_count} onChange={e => updateField('buffer_cabin_count', e.target.value)} placeholder="2" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label>
                      <Select value={form.buffer_cabin_type} onChange={e => updateField('buffer_cabin_type', e.target.value)}>
                        <option value="">Sélectionner...</option>
                        {TYPES_AMORTISSEUR.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-400" /> Amortisseurs contrepoids
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Nombre</label>
                      <Input type="number" value={form.buffer_counterweight_count} onChange={e => updateField('buffer_counterweight_count', e.target.value)} placeholder="2" />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">Type</label>
                      <Select value={form.buffer_counterweight_type} onChange={e => updateField('buffer_counterweight_type', e.target.value)}>
                        <option value="">Sélectionner...</option>
                        {TYPES_AMORTISSEUR.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section: Sécurités */}
            {activeSection === 'securites' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type de parachute</label>
                    <Select value={form.parachute_type} onChange={e => updateField('parachute_type', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {TYPES_PARACHUTE.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type de serrures</label>
                    <Select value={form.lock_type} onChange={e => updateField('lock_type', e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {TYPES_SERRURE.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Système d'alarme</label>
                  <Input value={form.alarm_system} onChange={e => updateField('alarm_system', e.target.value)} placeholder="Téléalarme EN81-28" />
                </div>
              </div>
            )}

            {/* Section: Machine */}
            {activeSection === 'machine' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Puissance moteur (kW)</label>
                    <Input value={form.motor_power} onChange={e => updateField('motor_power', e.target.value)} placeholder="5.5" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type moteur</label>
                    <Input value={form.motor_type} onChange={e => updateField('motor_type', e.target.value)} placeholder="Gearless, Avec réducteur" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Variateur</label>
                    <Input value={form.variator_type} onChange={e => updateField('variator_type', e.target.value)} placeholder="VVVF" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Marque armoire</label>
                    <Input value={form.controller_brand} onChange={e => updateField('controller_brand', e.target.value)} placeholder="OTIS, SCHINDLER..." />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Type armoire / Manœuvre</label>
                  <Input value={form.controller_type} onChange={e => updateField('controller_type', e.target.value)} placeholder="Collective descente, Simplex..." />
                </div>
              </div>
            )}

            {/* Section: Notes & Photos */}
            {activeSection === 'notes' && (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-1.5 block">Notes et observations</label>
                  <Textarea 
                    value={form.notes} 
                    onChange={e => updateField('notes', e.target.value)} 
                    rows={5} 
                    placeholder="Informations complémentaires, particularités de l'installation..." 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Photos de l'installation</label>
                  <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={10} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-[var(--border-primary)]">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {appareil ? 'Enregistrer' : 'Créer l\'appareil'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL CHECKLIST INSPECTION
// =============================================
function ChecklistModal({ appareil, onClose }: { appareil: any; onClose: () => void }) {
  const [checkpoints, setCheckpoints] = useState<Record<string, { status: string; remarks: string }>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>('machinerie');

  const groupedChecklist = useMemo(() => {
    const groups: Record<string, typeof CHECKLIST_COPREC> = {};
    CHECKLIST_COPREC.forEach(item => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return groups;
  }, []);

  const updateCheckpoint = (code: string, status: string) => {
    setCheckpoints(prev => ({
      ...prev,
      [code]: { ...prev[code], status }
    }));
  };

  const updateRemarks = (code: string, remarks: string) => {
    setCheckpoints(prev => ({
      ...prev,
      [code]: { ...prev[code], remarks }
    }));
  };

  const stats = useMemo(() => {
    const values = Object.values(checkpoints);
    return {
      total: CHECKLIST_COPREC.length,
      conforme: values.filter(v => v.status === 'C').length,
      nonConforme: values.filter(v => v.status === 'NC').length,
      sansObjet: values.filter(v => v.status === 'SO').length,
    };
  }, [checkpoints]);

  const progress = Math.round(((stats.conforme + stats.nonConforme + stats.sansObjet) / stats.total) * 100);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Checklist d'inspection COPREC</h2>
                <p className="text-sm text-[var(--text-muted)]">{appareil.device_number} - {appareil.site_name}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--text-secondary)]">Progression</span>
                  <span className="text-sm font-bold text-orange-400">{progress}%</span>
                </div>
                <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="green">C: {stats.conforme}</Badge>
                <Badge variant="red">NC: {stats.nonConforme}</Badge>
                <Badge variant="gray">SO: {stats.sansObjet}</Badge>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {Object.entries(groupedChecklist).map(([section, items]) => (
              <div key={section} className="mb-4">
                <button
                  onClick={() => setExpandedSection(expandedSection === section ? null : section)}
                  className="w-full flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{SECTION_LABELS[section] || section}</span>
                    <Badge variant="gray">{items.length} points</Badge>
                  </div>
                  {expandedSection === section ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandedSection === section && (
                  <div className="mt-2 space-y-2">
                    {items.map(item => {
                      const cp = checkpoints[item.code] || { status: '', remarks: '' };
                      return (
                        <div key={item.code} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-primary)]">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-orange-400">{item.code}</span>
                                <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">{item.detail}</p>
                            </div>
                            <div className="flex gap-1">
                              {['C', 'NC', 'SO'].map(status => (
                                <button
                                  key={status}
                                  onClick={() => updateCheckpoint(item.code, status)}
                                  className={`w-10 h-8 rounded text-xs font-bold transition-all ${
                                    cp.status === status
                                      ? status === 'C' ? 'bg-green-500 text-white'
                                        : status === 'NC' ? 'bg-red-500 text-white'
                                        : 'bg-gray-500 text-white'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                          {cp.status === 'NC' && (
                            <div className="mt-2">
                              <Input
                                value={cp.remarks}
                                onChange={e => updateRemarks(item.code, e.target.value)}
                                placeholder="Remarques obligatoires pour NC..."
                                className="text-sm"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            <Button variant="primary" className="flex-1" onClick={() => { toast.success('Checklist enregistrée'); onClose(); }}>
              <Check className="w-4 h-4" /> Enregistrer
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================
// MODAL DÉTAIL APPAREIL
// =============================================
function AppareilDetailModal({ appareil, onClose, onEdit, onArchive, onRefresh }: { 
  appareil: any; 
  onClose: () => void; 
  onEdit: () => void; 
  onArchive: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [showChecklist, setShowChecklist] = useState(false);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from('mise_en_service').update({ status: newStatus }).eq('id', appareil.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      onRefresh();
      toast.success('Statut mis à jour');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusInfo = getStatusInfo(appareil.status);

  const tabs = [
    { id: 'info', label: 'Informations', icon: FileText },
    { id: 'technique', label: 'Technique', icon: Settings },
    { id: 'checklist', label: 'Checklist', icon: ClipboardList },
    { id: 'photos', label: 'Photos', icon: Image },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      {/* Backdrop - cliquer dessus ferme le modal */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Contenu du modal - ne propage pas les clics */}
      <Card className="w-[900px] max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)] flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span>
                  <Badge style={{ backgroundColor: statusInfo.bg }} className="text-white">{statusInfo.label}</Badge>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{appareil.site_name}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {[appareil.address_street, appareil.address_zip, appareil.address_city].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onArchive} className="p-2 hover:bg-amber-500/20 rounded-lg transition-colors" title="Archiver">
                  <Archive className="w-5 h-5 text-[var(--text-tertiary)] hover:text-amber-400" />
                </button>
                <button onClick={onEdit} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors" title="Modifier">
                  <Edit className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                </button>
              </div>
            </div>

            {/* Status buttons */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {STATUTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => updateStatusMutation.mutate(s.value)}
                  disabled={updateStatusMutation.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    appareil.status === s.value 
                      ? 'text-white shadow-lg' 
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                  style={appareil.status === s.value ? { backgroundColor: s.bg } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                    activeTab === t.id 
                      ? 'bg-[var(--bg-secondary)] text-orange-400 border-b-2 border-orange-400' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Identification
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Fabricant</span><span className="font-medium">{appareil.manufacturer || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Modèle</span><span className="font-medium">{appareil.model || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span className="font-medium">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Bâtiment</span><span className="font-medium">{TYPES_BATIMENT.find(t => t.value === appareil.building_type)?.label || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Année</span><span className="font-medium">{appareil.installation_year || '-'}</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Gauge className="w-4 h-4" /> Caractéristiques
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Charge</span><span className="font-medium">{appareil.load_capacity ? `${appareil.load_capacity} kg` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Vitesse</span><span className="font-medium">{appareil.speed ? `${appareil.speed} m/s` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Course</span><span className="font-medium">{appareil.course ? `${appareil.course} m` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Niveaux</span><span className="font-medium">{appareil.levels_count || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Accès</span><span className="font-medium">{appareil.access_count || 1}</span></div>
                    </div>
                  </div>
                </div>

                {appareil.notes && (
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Notes</h3>
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{appareil.notes}</p>
                  </div>
                )}

                <ContextChat contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} />
                <ContextNotes contextType="mise_service" contextId={appareil.id} contextLabel={appareil.device_number} />
              </div>
            )}

            {activeTab === 'technique' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Ruler className="w-4 h-4" /> Dimensions
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cabine</span><span className="font-medium">{appareil.cabin_dimensions || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cuvette</span><span className="font-medium">{appareil.pit_depth ? `${appareil.pit_depth} m` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Passage de tête</span><span className="font-medium">{appareil.headroom ? `${appareil.headroom} m` : '-'}</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Cable className="w-4 h-4" /> Suspension
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Câbles</span><span className="font-medium">{appareil.cables_count ? `${appareil.cables_count} x ${appareil.cables_diameter || '?'} mm` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Mouflage</span><span className="font-medium">{appareil.suspension_ratio || '-'}</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Amortisseurs
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cabine</span><span className="font-medium">{appareil.buffer_cabin_count ? `${appareil.buffer_cabin_count} - ${appareil.buffer_cabin_type || ''}` : '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Contrepoids</span><span className="font-medium">{appareil.buffer_counterweight_count ? `${appareil.buffer_counterweight_count} - ${appareil.buffer_counterweight_type || ''}` : '-'}</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4" /> Sécurités
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Parachute</span><span className="font-medium">{appareil.parachute_type || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Serrures</span><span className="font-medium">{appareil.lock_type || '-'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="text-center py-8">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Checklist d'inspection COPREC</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">{CHECKLIST_COPREC.length} points de contrôle</p>
                <Button variant="primary" onClick={() => setShowChecklist(true)}>
                  <ClipboardList className="w-4 h-4" /> Ouvrir la checklist
                </Button>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="text-center py-8">
                <Image className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Photos de l'appareil</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Aucune photo pour le moment</p>
                <Button variant="primary">
                  <Camera className="w-4 h-4" /> Ajouter des photos
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-primary)] flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Fermer</Button>
            <Button variant="primary" className="flex-1" onClick={onEdit}>
              <Edit className="w-4 h-4" /> Modifier
            </Button>
          </div>
        </CardBody>
      </Card>

      {showChecklist && <ChecklistModal appareil={appareil} onClose={() => setShowChecklist(false)} />}
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
  
  // Fetch data - utiliser OR pour gérer archived = null ou false
  const { data: appareils, isLoading, refetch } = useQuery({ 
    queryKey: ['mise-en-service'], 
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mise_en_service')
        .select('*')
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from('mise_en_service').insert(data).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Appareil créé avec succès');
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from('mise_en_service').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Appareil mis à jour');
      setEditAppareil(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, raison }: { id: string; raison: string }) => {
      const { error } = await supabase.from('mise_en_service').update({ 
        archived: true, 
        archived_at: new Date().toISOString(),
        archive_reason: raison 
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-service'] });
      toast.success('Appareil archivé');
      setArchiveItem(null);
      setDetailAppareil(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erreur'),
  });

  // Filtered data
  const filtered = useMemo(() => {
    return appareils?.filter(a => {
      if (filterStatus && a.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.device_number?.toLowerCase().includes(q) ||
               a.site_name?.toLowerCase().includes(q) ||
               a.address_city?.toLowerCase().includes(q) ||
               a.manufacturer?.toLowerCase().includes(q);
      }
      return true;
    }) || [];
  }, [appareils, filterStatus, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const all = appareils || [];
    return {
      total: all.length,
      ...STATUTS.reduce((acc, s) => ({ ...acc, [s.value]: all.filter(a => a.status === s.value).length }), {}),
    };
  }, [appareils]);

  const handleCardClick = (appareil: any) => {
    setDetailAppareil(appareil);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mise en service</h1>
          <p className="text-sm text-[var(--text-muted)]">{stats.total} appareils</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nouvel appareil
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Rechercher..." 
                className="pl-10" 
              />
            </div>
            
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilterStatus(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !filterStatus ? 'bg-orange-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                Tous ({stats.total})
              </button>
              {STATUTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setFilterStatus(s.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterStatus === s.value ? 'text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                  style={filterStatus === s.value ? { backgroundColor: s.bg } : {}}
                >
                  {s.label} ({(stats as any)[s.value] || 0})
                </button>
              ))}
            </div>

            <div className="ml-auto flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[var(--bg-elevated)] shadow-sm' : ''}`}
              >
                <LayoutGrid className="w-4 h-4" style={{ color: viewMode === 'grid' ? '#F97316' : undefined }} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[var(--bg-elevated)] shadow-sm' : ''}`}
              >
                <List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#F97316' : undefined }} />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardBody className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Aucun appareil</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">Ajoutez un appareil en mise en service</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Ajouter un appareil
            </Button>
          </CardBody>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(appareil => {
            const statusInfo = getStatusInfo(appareil.status);
            return (
              <Card 
                key={appareil.id} 
                className="hover:border-orange-500/30 transition-all cursor-pointer hover:shadow-lg"
                onClick={() => handleCardClick(appareil)}
              >
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-lg font-mono font-bold text-orange-400">{appareil.device_number}</span>
                      <Badge className="ml-2 text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge>
                    </div>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-1">{appareil.site_name}</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-3">{appareil.address_city || 'Aucune ville'}</p>
                  <div className="flex gap-3 text-xs text-[var(--text-muted)]">
                    {appareil.manufacturer && <span>{appareil.manufacturer}</span>}
                    {appareil.levels_count && <span>{appareil.levels_count} niv.</span>}
                    {appareil.load_capacity && <span>{appareil.load_capacity} kg</span>}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">N° Appareil</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">Site</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">Ville</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">Type</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">Fabricant</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text-secondary)]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(appareil => {
                  const statusInfo = getStatusInfo(appareil.status);
                  return (
                    <tr 
                      key={appareil.id}
                      onClick={() => handleCardClick(appareil)}
                      className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-orange-400">{appareil.device_number}</td>
                      <td className="p-3 text-[var(--text-primary)]">{appareil.site_name}</td>
                      <td className="p-3 text-[var(--text-muted)]">{appareil.address_city || '-'}</td>
                      <td className="p-3 text-[var(--text-muted)]">{TYPES_APPAREIL.find(t => t.value === appareil.elevator_type)?.label || '-'}</td>
                      <td className="p-3 text-[var(--text-muted)]">{appareil.manufacturer || '-'}</td>
                      <td className="p-3"><Badge className="text-white" style={{ backgroundColor: statusInfo.bg }}>{statusInfo.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      {showForm && (
        <AppareilFormModal 
          onClose={() => setShowForm(false)} 
          onSave={data => createMutation.mutate(data)} 
          isLoading={createMutation.isPending} 
        />
      )}
      
      {editAppareil && (
        <AppareilFormModal 
          appareil={editAppareil}
          onClose={() => setEditAppareil(null)} 
          onSave={data => updateMutation.mutate({ id: editAppareil.id, data })} 
          isLoading={updateMutation.isPending} 
        />
      )}
      
      {detailAppareil && (
        <AppareilDetailModal 
          appareil={detailAppareil}
          onClose={() => setDetailAppareil(null)} 
          onEdit={() => { setEditAppareil(detailAppareil); setDetailAppareil(null); }}
          onArchive={() => setArchiveItem(detailAppareil)}
          onRefresh={() => refetch().then(r => {
            if (r.data) {
              const updated = r.data.find((a: any) => a.id === detailAppareil.id);
              if (updated) setDetailAppareil(updated);
            }
          })}
        />
      )}
      
      {archiveItem && (
        <ArchiveModal
          type="mise_en_service"
          code={archiveItem.device_number}
          libelle={`${archiveItem.device_number} - ${archiveItem.site_name}`}
          onClose={() => setArchiveItem(null)}
          onConfirm={(raison) => archiveMutation.mutate({ id: archiveItem.id, raison })}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  );
}
