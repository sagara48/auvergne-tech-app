import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, MapPin, AlertTriangle, Clock, Search, Filter, RefreshCw,
  LayoutGrid, List, Map, ChevronDown, ChevronUp, Phone, Wrench,
  Calendar, User, Activity, TrendingUp, Zap, Timer, AlertCircle,
  CheckCircle, XCircle, Settings, Eye, FileText, BarChart3
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, formatDistanceToNow, parseISO, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================
// TYPES
// =============================================
interface Ascenseur {
  id: string;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  code_postal: string;
  secteur: number;
  marque: string;
  modele: string;
  type_appareil: string;
  type_planning: string;
  nb_visites_an: number;
  en_arret: boolean;
  dernier_passage: string;
  localisation: string;
  tel_cabine: string;
}

interface Arret {
  id: string;
  id_wsoucont: number;
  code_appareil: string;
  adresse: string;
  ville: string;
  secteur: number;
  date_appel: string;
  heure_appel: string;
  motif: string;
  demandeur: string;
}

interface Panne {
  id: string;
  id_panne: number;
  id_wsoucont: number;
  code_appareil: string;
  date_appel: string;
  motif: string;
  cause: string;
  depanneur: string;
  duree_minutes: number;
  etat: string;
}

interface SyncLog {
  sync_date: string;
  status: string;
  equipements_count: number;
  pannes_count: number;
  arrets_count: number;
  duration_seconds: number;
}

// =============================================
// API FUNCTIONS
// =============================================
const getAscenseurs = async (secteur?: number) => {
  let query = supabase
    .from('parc_ascenseurs')
    .select('*')
    .order('code_appareil');
  
  if (secteur) {
    query = query.eq('secteur', secteur);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const getArrets = async () => {
  const { data, error } = await supabase
    .from('parc_arrets')
    .select('*')
    .order('date_appel', { ascending: false });
  if (error) throw error;
  return data || [];
};

const getPannesRecentes = async (limit = 50) => {
  const { data, error } = await supabase
    .from('parc_pannes')
    .select('*')
    .order('date_appel', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};

const getSecteurs = async () => {
  const { data, error } = await supabase
    .from('parc_secteurs')
    .select('*')
    .order('numero');
  if (error) throw error;
  return data || [];
};

const getLastSync = async (): Promise<SyncLog | null> => {
  const { data, error } = await supabase
    .from('parc_sync_logs')
    .select('*')
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
};

const getStats = async () => {
  const [ascenseursRes, arretsRes, pannesRes] = await Promise.all([
    supabase.from('parc_ascenseurs').select('id', { count: 'exact' }),
    supabase.from('parc_arrets').select('id', { count: 'exact' }),
    supabase.from('parc_pannes').select('id', { count: 'exact' }).gte('date_appel', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  ]);
  
  return {
    total: ascenseursRes.count || 0,
    arrets: arretsRes.count || 0,
    pannes30j: pannesRes.count || 0
  };
};

// =============================================
// COMPOSANTS
// =============================================

// Widget Ascenseurs à l'arrêt
function ArretsWidget({ arrets }: { arrets: Arret[] }) {
  if (arrets.length === 0) {
    return (
      <Card className="bg-green-500/10 border-green-500/30">
        <CardBody className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">0</p>
              <p className="text-sm text-[var(--text-muted)]">Ascenseur à l'arrêt</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <Card className="bg-red-500/10 border-red-500/30">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{arrets.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Ascenseur{arrets.length > 1 ? 's' : ''} à l'arrêt</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {arrets.slice(0, 5).map(arret => {
            const dateAppel = arret.date_appel ? parseISO(arret.date_appel) : new Date();
            const heuresArret = differenceInHours(new Date(), dateAppel);
            
            return (
              <div key={arret.id} className="flex items-center gap-3 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{arret.code_appareil}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{arret.adresse}, {arret.ville}</p>
                </div>
                <div className="text-right">
                  <Badge variant="red" className="text-[10px]">{heuresArret}h</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// Carte Ascenseur
function AscenseurCard({ ascenseur, onClick }: { ascenseur: Ascenseur; onClick: () => void }) {
  return (
    <Card 
      className={`cursor-pointer hover:border-orange-500/50 transition-all ${ascenseur.en_arret ? 'border-red-500/50 bg-red-500/5' : ''}`}
      onClick={onClick}
    >
      <CardBody className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
              <Building2 className={`w-5 h-5 ${ascenseur.en_arret ? 'text-red-500' : 'text-orange-500'}`} />
            </div>
            <div>
              <p className="font-bold">{ascenseur.code_appareil}</p>
              <p className="text-xs text-[var(--text-muted)]">Secteur {ascenseur.secteur}</p>
            </div>
          </div>
          {ascenseur.en_arret && (
            <Badge variant="red" className="animate-pulse">À L'ARRÊT</Badge>
          )}
        </div>
        
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="truncate">{ascenseur.adresse}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{ascenseur.ville} {ascenseur.code_postal}</span>
          </div>
          {ascenseur.marque && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{ascenseur.marque} {ascenseur.modele}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
          {ascenseur.type_planning && (
            <Badge variant="gray" className="text-[10px]">{ascenseur.type_planning}</Badge>
          )}
          {ascenseur.nb_visites_an && (
            <Badge variant="blue" className="text-[10px]">{ascenseur.nb_visites_an} visites/an</Badge>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Ligne Ascenseur (vue liste)
function AscenseurRow({ ascenseur, onClick }: { ascenseur: Ascenseur; onClick: () => void }) {
  return (
    <tr 
      className={`hover:bg-[var(--bg-secondary)] cursor-pointer ${ascenseur.en_arret ? 'bg-red-500/5' : ''}`}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-[var(--bg-tertiary)]'}`}>
            <Building2 className={`w-4 h-4 ${ascenseur.en_arret ? 'text-red-500' : 'text-[var(--text-muted)]'}`} />
          </div>
          <div>
            <p className="font-medium">{ascenseur.code_appareil}</p>
            {ascenseur.localisation && <p className="text-xs text-[var(--text-muted)]">{ascenseur.localisation}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{ascenseur.adresse}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.ville}</td>
      <td className="px-4 py-3 text-sm text-center">{ascenseur.secteur}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.marque}</td>
      <td className="px-4 py-3 text-sm">{ascenseur.type_planning || '-'}</td>
      <td className="px-4 py-3 text-center">
        {ascenseur.en_arret ? (
          <Badge variant="red">Arrêt</Badge>
        ) : (
          <Badge variant="green">OK</Badge>
        )}
      </td>
    </tr>
  );
}

// Modal Détail Ascenseur
function AscenseurDetailModal({ ascenseur, onClose }: { ascenseur: Ascenseur; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'info' | 'pannes' | 'visites'>('info');
  
  const { data: pannes } = useQuery({
    queryKey: ['pannes-ascenseur', ascenseur.id_wsoucont],
    queryFn: async () => {
      const { data } = await supabase
        .from('parc_pannes')
        .select('*')
        .eq('id_wsoucont', ascenseur.id_wsoucont)
        .order('date_appel', { ascending: false })
        .limit(20);
      return data || [];
    }
  });
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <CardBody className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ascenseur.en_arret ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
                  <Building2 className={`w-6 h-6 ${ascenseur.en_arret ? 'text-red-500' : 'text-orange-500'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{ascenseur.code_appareil}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{ascenseur.adresse}, {ascenseur.ville}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              {[
                { id: 'info', label: 'Informations', icon: FileText },
                { id: 'pannes', label: 'Pannes', icon: AlertTriangle },
                { id: 'visites', label: 'Visites', icon: Calendar }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-400" /> Localisation
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Adresse</span>
                      <span className="font-medium">{ascenseur.adresse}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Ville</span>
                      <span className="font-medium">{ascenseur.ville} {ascenseur.code_postal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Secteur</span>
                      <span className="font-medium">{ascenseur.secteur}</span>
                    </div>
                    {ascenseur.localisation && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Localisation</span>
                        <span className="font-medium">{ascenseur.localisation}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" /> Caractéristiques
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Marque</span>
                      <span className="font-medium">{ascenseur.marque || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Modèle</span>
                      <span className="font-medium">{ascenseur.modele || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Type</span>
                      <span className="font-medium">{ascenseur.type_appareil || '-'}</span>
                    </div>
                    {ascenseur.tel_cabine && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Tél. cabine</span>
                        <span className="font-medium">{ascenseur.tel_cabine}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl col-span-2">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" /> Contrat & Maintenance
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Type planning</span>
                      <span className="font-medium">{ascenseur.type_planning || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Visites/an</span>
                      <span className="font-medium">{ascenseur.nb_visites_an || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Dernier passage</span>
                      <span className="font-medium">{ascenseur.dernier_passage ? format(parseISO(ascenseur.dernier_passage), 'dd/MM/yyyy') : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'pannes' && (
              <div className="space-y-3">
                {pannes && pannes.length > 0 ? (
                  pannes.map((panne: any) => (
                    <div key={panne.id} className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {panne.date_appel ? format(parseISO(panne.date_appel), 'dd/MM/yyyy', { locale: fr }) : '-'}
                        </span>
                        <Badge variant={panne.etat === 'termine' ? 'green' : 'orange'}>
                          {panne.etat || 'En cours'}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{panne.motif}</p>
                      {panne.cause && <p className="text-xs text-[var(--text-muted)] mt-1">Cause: {panne.cause}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                        {panne.depanneur && <span>👤 {panne.depanneur}</span>}
                        {panne.duree_minutes && <span>⏱️ {panne.duree_minutes} min</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune panne enregistrée</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'visites' && (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Historique des visites à venir</p>
              </div>
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
export function ParcAscenseursPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [secteurFilter, setSecteurFilter] = useState<string>('');
  const [showArretOnly, setShowArretOnly] = useState(false);
  const [selectedAscenseur, setSelectedAscenseur] = useState<Ascenseur | null>(null);
  
  const { data: ascenseurs, isLoading } = useQuery({
    queryKey: ['parc-ascenseurs'],
    queryFn: () => getAscenseurs()
  });
  
  const { data: arrets } = useQuery({
    queryKey: ['parc-arrets'],
    queryFn: getArrets,
    refetchInterval: 60000 // Refresh toutes les minutes
  });
  
  const { data: secteurs } = useQuery({
    queryKey: ['parc-secteurs'],
    queryFn: getSecteurs
  });
  
  const { data: lastSync } = useQuery({
    queryKey: ['parc-last-sync'],
    queryFn: getLastSync
  });
  
  const { data: stats } = useQuery({
    queryKey: ['parc-stats'],
    queryFn: getStats
  });
  
  const filteredAscenseurs = useMemo(() => {
    if (!ascenseurs) return [];
    
    return ascenseurs.filter(a => {
      if (search) {
        const s = search.toLowerCase();
        if (!a.code_appareil?.toLowerCase().includes(s) &&
            !a.adresse?.toLowerCase().includes(s) &&
            !a.ville?.toLowerCase().includes(s)) {
          return false;
        }
      }
      if (secteurFilter && a.secteur?.toString() !== secteurFilter) return false;
      if (showArretOnly && !a.en_arret) return false;
      return true;
    });
  }, [ascenseurs, search, secteurFilter, showArretOnly]);
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Parc Ascenseurs</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Données synchronisées depuis Progilift
              {lastSync && (
                <span className="ml-2">
                  • Dernière sync: {formatDistanceToNow(parseISO(lastSync.sync_date), { addSuffix: true, locale: fr })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4" /> Sync
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Ascenseurs</p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <ArretsWidget arrets={arrets || []} />
          
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pannes30j || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Pannes (30j)</p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{secteurs?.length || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Secteurs</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par code, adresse, ville..."
              className="pl-10"
            />
          </div>
          
          <Select value={secteurFilter} onChange={e => setSecteurFilter(e.target.value)} className="w-40">
            <option value="">Tous secteurs</option>
            {secteurs?.map(s => (
              <option key={s.numero} value={s.numero}>{s.nom}</option>
            ))}
          </Select>
          
          <Button
            variant={showArretOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowArretOnly(!showArretOnly)}
          >
            <AlertTriangle className="w-4 h-4" />
            À l'arrêt ({arrets?.length || 0})
          </Button>
          
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded ${view === 'grid' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded ${view === 'list' ? 'bg-orange-500 text-white' : 'text-[var(--text-muted)]'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-[var(--text-muted)]">Chargement...</div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAscenseurs.map(ascenseur => (
              <AscenseurCard 
                key={ascenseur.id} 
                ascenseur={ascenseur}
                onClick={() => setSelectedAscenseur(ascenseur)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Adresse</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Ville</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Secteur</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Marque</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Planning</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredAscenseurs.map(ascenseur => (
                  <AscenseurRow 
                    key={ascenseur.id} 
                    ascenseur={ascenseur}
                    onClick={() => setSelectedAscenseur(ascenseur)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredAscenseurs.length === 0 && !isLoading && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun ascenseur trouvé</p>
          </div>
        )}
      </div>
      
      {/* Modal détail */}
      {selectedAscenseur && (
        <AscenseurDetailModal
          ascenseur={selectedAscenseur}
          onClose={() => setSelectedAscenseur(null)}
        />
      )}
    </div>
  );
}
