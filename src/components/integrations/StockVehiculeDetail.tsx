// src/components/integrations/StockVehiculeDetail.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Package, AlertTriangle, Plus, Send, Check, X,
  Search, Filter, RefreshCw, ChevronRight, Clock, CheckCircle,
  XCircle, Loader2, ArrowRight, Calendar
} from 'lucide-react';
import { Button, Card, CardBody, Badge, Input, Select, ProgressBar } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface StockVehiculeItem {
  id: string;
  vehicule_id: string;
  article_id: string;
  reference: string;
  designation: string;
  quantite: number;
  quantite_min: number;
  quantite_max: number;
  prix_unitaire?: number;
  niveau: 'ok' | 'alerte' | 'critique' | 'rupture';
}

interface DemandeReappro {
  id: string;
  code: string;
  vehicule_id: string;
  statut: string;
  urgence: string;
  date_demande: string;
  date_validation?: string;
  date_preparation?: string;
  date_livraison?: string;
  notes?: string;
  lignes?: LigneReappro[];
}

interface LigneReappro {
  id: string;
  reference: string;
  designation?: string;
  quantite_demandee: number;
  quantite_validee?: number;
  quantite_livree: number;
  motif?: string;
}

interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  technicien?: { prenom: string; nom: string };
  kilometrage?: number;
  date_ct?: string;
}

const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

const NIVEAU_CONFIG = {
  ok: { label: 'OK', color: 'green', bg: 'bg-green-500/20' },
  alerte: { label: 'Bas', color: 'amber', bg: 'bg-amber-500/20' },
  critique: { label: 'Critique', color: 'red', bg: 'bg-red-500/20' },
  rupture: { label: 'Rupture', color: 'red', bg: 'bg-red-500/30' },
};

const STATUT_DEMANDE_CONFIG: Record<string, { label: string; color: 'gray' | 'blue' | 'amber' | 'purple' | 'green' | 'red'; icon: any }> = {
  en_attente: { label: 'En attente', color: 'amber', icon: Clock },
  validee: { label: 'Validée', color: 'blue', icon: Check },
  preparee: { label: 'Préparée', color: 'purple', icon: Package },
  livree: { label: 'Livrée', color: 'green', icon: CheckCircle },
  annulee: { label: 'Annulée', color: 'red', icon: XCircle },
};

export function StockVehiculeDetail({ vehiculeId }: { vehiculeId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stock' | 'demandes'>('stock');
  const [search, setSearch] = useState('');
  const [filterNiveau, setFilterNiveau] = useState<string>('all');

  // Charger le véhicule
  const { data: vehicule } = useQuery({
    queryKey: ['vehicule', vehiculeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules')
        .select('*, technicien:technicien_id(prenom, nom)')
        .eq('id', vehiculeId)
        .single();
      if (error) throw error;
      return data as Vehicule;
    },
  });

  // Charger le stock du véhicule
  const { data: stockItems, isLoading: loadingStock } = useQuery({
    queryKey: ['stock-vehicule', vehiculeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vue_stock_vehicule_detail')
        .select('*')
        .eq('vehicule_id', vehiculeId);
      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        niveau: item.quantite === 0 ? 'rupture' 
          : item.quantite <= (item.quantite_min || 1) ? 'critique'
          : item.quantite <= (item.quantite_min || 1) * 2 ? 'alerte'
          : 'ok'
      })) as StockVehiculeItem[];
    },
  });

  // Charger les demandes de réappro
  const { data: demandes, isLoading: loadingDemandes } = useQuery({
    queryKey: ['demandes-reappro', vehiculeId],
    queryFn: async () => {
      const { data: demandesData, error } = await supabase
        .from('stock_demandes_reappro')
        .select('*')
        .eq('vehicule_id', vehiculeId)
        .order('date_demande', { ascending: false });
      if (error) throw error;
      
      // Charger les lignes pour chaque demande
      const demandesAvecLignes = await Promise.all(
        (demandesData || []).map(async (d: any) => {
          const { data: lignes } = await supabase
            .from('stock_demandes_reappro_lignes')
            .select('*')
            .eq('demande_id', d.id);
          return { ...d, lignes: lignes || [] };
        })
      );
      
      return demandesAvecLignes as DemandeReappro[];
    },
  });

  // Générer demande de réappro automatique
  const genererReapproMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generer_demande_reappro', {
        p_vehicule_id: vehiculeId,
        p_technicien_id: CURRENT_USER_ID
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demandes-reappro'] });
      if (data) {
        toast.success('Demande de réapprovisionnement créée');
        setActiveTab('demandes');
      } else {
        toast.success('Stock OK - Aucune demande nécessaire');
      }
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  // Filtrage stock
  const filteredStock = stockItems?.filter(item => {
    if (filterNiveau !== 'all' && item.niveau !== filterNiveau) return false;
    if (search && !item.reference.toLowerCase().includes(search.toLowerCase()) && 
        !item.designation?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  // Stats
  const stats = {
    total: stockItems?.length || 0,
    ruptures: stockItems?.filter(i => i.niveau === 'rupture').length || 0,
    critiques: stockItems?.filter(i => i.niveau === 'critique').length || 0,
    alertes: stockItems?.filter(i => i.niveau === 'alerte').length || 0,
  };

  const demandesEnCours = demandes?.filter(d => !['livree', 'annulee'].includes(d.statut)).length || 0;

  return (
    <div className="space-y-4">
      {/* Header véhicule */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-[var(--border-primary)]">
        <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
          <Truck className="w-7 h-7 text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {vehicule?.immatriculation || 'Véhicule'}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {vehicule?.marque} {vehicule?.modele}
            {vehicule?.technicien && ` • ${vehicule.technicien.prenom} ${vehicule.technicien.nom}`}
          </p>
          {vehicule?.kilometrage && (
            <p className="text-xs text-[var(--text-muted)]">{vehicule.kilometrage.toLocaleString()} km</p>
          )}
        </div>
        
        {/* Alertes */}
        {(stats.ruptures > 0 || stats.critiques > 0) && (
          <div className="flex items-center gap-2">
            {stats.ruptures > 0 && (
              <Badge variant="red" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.ruptures} rupture(s)
              </Badge>
            )}
            {stats.critiques > 0 && (
              <Badge variant="amber" className="flex items-center gap-1">
                {stats.critiques} critique(s)
              </Badge>
            )}
          </div>
        )}
        
        <Button 
          variant="primary" 
          onClick={() => genererReapproMutation.mutate()}
          disabled={genererReapproMutation.isPending}
        >
          {genererReapproMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Demander réappro
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Articles', value: stats.total, color: 'text-[var(--text-primary)]' },
          { label: 'Ruptures', value: stats.ruptures, color: 'text-red-400' },
          { label: 'Critiques', value: stats.critiques, color: 'text-amber-400' },
          { label: 'Demandes', value: demandesEnCours, color: 'text-blue-400' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="text-center py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)]">
        {[
          { id: 'stock', label: 'Stock', icon: Package },
          { id: 'demandes', label: 'Demandes', icon: Send, badge: demandesEnCours },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-purple-500 text-purple-400' 
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge variant="purple" className="text-[10px]">{tab.badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Contenu tab Stock */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <Input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Rechercher une pièce..." 
                className="pl-10"
              />
            </div>
            <Select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)} className="w-36">
              <option value="all">Tous niveaux</option>
              <option value="rupture">Ruptures</option>
              <option value="critique">Critiques</option>
              <option value="alerte">Alertes</option>
              <option value="ok">OK</option>
            </Select>
          </div>

          {/* Liste stock */}
          {loadingStock ? (
            <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>
          ) : filteredStock.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="text-[var(--text-tertiary)]">Aucun article dans ce véhicule</p>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-[var(--border-primary)]">
                {filteredStock.map(item => {
                  const niveauConfig = NIVEAU_CONFIG[item.niveau];
                  const pourcentage = Math.min(100, Math.round((item.quantite / (item.quantite_max || 10)) * 100));
                  
                  return (
                    <div key={item.id} className={`p-4 flex items-center gap-4 ${item.niveau !== 'ok' ? niveauConfig.bg : ''}`}>
                      <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-[var(--text-muted)]" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-purple-400">{item.reference}</span>
                          <Badge variant={niveauConfig.color as any}>{niveauConfig.label}</Badge>
                        </div>
                        <p className="text-sm text-[var(--text-tertiary)] truncate">{item.designation}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-[var(--text-primary)]">
                          {item.quantite} <span className="text-sm text-[var(--text-muted)]">/ {item.quantite_max || 10}</span>
                        </div>
                        <div className="w-20">
                          <ProgressBar 
                            value={pourcentage} 
                            variant={item.niveau === 'ok' ? 'green' : item.niveau === 'alerte' ? 'amber' : 'red'} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Contenu tab Demandes */}
      {activeTab === 'demandes' && (
        <div className="space-y-3">
          {loadingDemandes ? (
            <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>
          ) : demandes?.length === 0 ? (
            <Card className="p-8 text-center">
              <Send className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="text-[var(--text-tertiary)]">Aucune demande de réapprovisionnement</p>
              <Button 
                variant="secondary" 
                className="mt-3"
                onClick={() => genererReapproMutation.mutate()}
              >
                <Plus className="w-4 h-4" /> Créer une demande
              </Button>
            </Card>
          ) : (
            demandes?.map(demande => {
              const statutConfig = STATUT_DEMANDE_CONFIG[demande.statut] || STATUT_DEMANDE_CONFIG.en_attente;
              const StatutIcon = statutConfig.icon;
              
              return (
                <Card key={demande.id}>
                  <CardBody>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-purple-400">{demande.code}</span>
                        <Badge variant={statutConfig.color} className="flex items-center gap-1">
                          <StatutIcon className="w-3 h-3" />
                          {statutConfig.label}
                        </Badge>
                        {demande.urgence !== 'normale' && (
                          <Badge variant="red">{demande.urgence === 'tres_urgent' ? 'Très urgent' : 'Urgent'}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDistanceToNow(parseISO(demande.date_demande), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    
                    {/* Timeline */}
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
                      <span>Demande: {format(parseISO(demande.date_demande), 'dd/MM HH:mm')}</span>
                      {demande.date_validation && (
                        <>
                          <ArrowRight className="w-3 h-3" />
                          <span>Validée: {format(parseISO(demande.date_validation), 'dd/MM')}</span>
                        </>
                      )}
                      {demande.date_preparation && (
                        <>
                          <ArrowRight className="w-3 h-3" />
                          <span>Préparée: {format(parseISO(demande.date_preparation), 'dd/MM')}</span>
                        </>
                      )}
                      {demande.date_livraison && (
                        <>
                          <ArrowRight className="w-3 h-3" />
                          <span className="text-green-400">Livrée: {format(parseISO(demande.date_livraison), 'dd/MM')}</span>
                        </>
                      )}
                    </div>
                    
                    {/* Lignes */}
                    {demande.lignes && demande.lignes.length > 0 && (
                      <div className="space-y-1 p-2 bg-[var(--bg-tertiary)] rounded-lg">
                        {demande.lignes.map(ligne => (
                          <div key={ligne.id} className="flex items-center gap-3 text-sm">
                            <span className="font-mono text-purple-400">{ligne.reference}</span>
                            <span className="flex-1 text-[var(--text-tertiary)] truncate">{ligne.designation}</span>
                            <span className="font-medium text-[var(--text-primary)]">x{ligne.quantite_demandee}</span>
                            {ligne.motif && (
                              <span className="text-xs text-amber-400">{ligne.motif}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Widget compact pour intégration
export function StockVehiculeWidget({ vehiculeId }: { vehiculeId: string }) {
  const { data: alertes } = useQuery({
    queryKey: ['alertes-stock-vehicule', vehiculeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_alertes_stock_vehicule')
        .select('*')
        .eq('vehicule_id', vehiculeId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  if (!alertes) return null;

  const totalAlertes = (alertes.nb_ruptures || 0) + (alertes.nb_critiques || 0);
  if (totalAlertes === 0) return null;

  return (
    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-400">
          Stock véhicule : {alertes.nb_ruptures} rupture(s), {alertes.nb_critiques} critique(s)
        </p>
        {alertes.refs_alerte && (
          <p className="text-xs text-[var(--text-muted)] truncate">
            {alertes.refs_alerte.slice(0, 3).join(', ')}
            {alertes.refs_alerte.length > 3 && ` +${alertes.refs_alerte.length - 3}`}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
    </div>
  );
}
