import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Car, AlertTriangle, Calendar, Wrench, Package, Clock, 
  ChevronRight, CheckCircle, FileText, Fuel, RefreshCw,
  Settings, History, Shield, Bell
} from 'lucide-react';
import { Card, CardBody, Badge, Button, ProgressBar } from '@/components/ui';
import { supabase } from '@/services/supabase';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================
// TYPES
// =============================================
interface VehiculeComplet {
  id: string;
  immatriculation: string;
  marque?: string;
  modele?: string;
  annee?: number;
  technicien_id?: string;
  technicien_nom?: string;
  date_mise_circulation?: string;
  date_prochain_ct?: string;
  date_prochaine_vidange?: string;
  date_derniere_revision?: string;
  kilometrage?: number;
  actif: boolean;
}

interface AlerteVehicule {
  type: 'ct' | 'vidange' | 'revision' | 'stock' | 'assurance';
  niveau: 'urgent' | 'warning' | 'info';
  message: string;
  date_echeance?: string;
  jours_restants?: number;
}

interface HistoriquePiece {
  id: string;
  date: string;
  designation: string;
  reference?: string;
  quantite: number;
  technicien_nom?: string;
  code_appareil?: string;
}

interface SuiviVehiculeData {
  vehicule: VehiculeComplet;
  alertes: AlerteVehicule[];
  stockBas: { designation: string; quantite: number; seuil: number }[];
  dernieresPieces: HistoriquePiece[];
  stats: {
    pieces_utilisees_mois: number;
    interventions_mois: number;
  };
}

// =============================================
// API FUNCTIONS
// =============================================
async function getSuiviVehicule(vehiculeId: string): Promise<SuiviVehiculeData | null> {
  // Récupérer les infos du véhicule
  const { data: vehicule, error } = await supabase
    .from('vehicules')
    .select(`
      *,
      technicien:technicien_id(prenom, nom)
    `)
    .eq('id', vehiculeId)
    .single();

  if (error || !vehicule) return null;

  const vehiculeComplet: VehiculeComplet = {
    ...vehicule,
    technicien_nom: vehicule.technicien 
      ? `${vehicule.technicien.prenom} ${vehicule.technicien.nom}`.trim()
      : undefined,
  };

  const aujourdhui = new Date();
  const alertes: AlerteVehicule[] = [];

  // Alertes CT
  if (vehicule.date_prochain_ct) {
    const dateCT = parseISO(vehicule.date_prochain_ct);
    const joursRestants = differenceInDays(dateCT, aujourdhui);
    
    if (joursRestants < 0) {
      alertes.push({
        type: 'ct',
        niveau: 'urgent',
        message: `Contrôle technique dépassé depuis ${Math.abs(joursRestants)} jours`,
        date_echeance: vehicule.date_prochain_ct,
        jours_restants: joursRestants,
      });
    } else if (joursRestants <= 30) {
      alertes.push({
        type: 'ct',
        niveau: joursRestants <= 7 ? 'urgent' : 'warning',
        message: `Contrôle technique dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`,
        date_echeance: vehicule.date_prochain_ct,
        jours_restants: joursRestants,
      });
    }
  }

  // Alertes Vidange
  if (vehicule.date_prochaine_vidange) {
    const dateVidange = parseISO(vehicule.date_prochaine_vidange);
    const joursRestants = differenceInDays(dateVidange, aujourdhui);
    
    if (joursRestants < 0) {
      alertes.push({
        type: 'vidange',
        niveau: 'urgent',
        message: `Vidange en retard de ${Math.abs(joursRestants)} jours`,
        date_echeance: vehicule.date_prochaine_vidange,
        jours_restants: joursRestants,
      });
    } else if (joursRestants <= 15) {
      alertes.push({
        type: 'vidange',
        niveau: 'warning',
        message: `Vidange prévue dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`,
        date_echeance: vehicule.date_prochaine_vidange,
        jours_restants: joursRestants,
      });
    }
  }

  // Alertes Révision
  if (vehicule.date_derniere_revision) {
    const dateRevision = parseISO(vehicule.date_derniere_revision);
    const prochaineRevision = addDays(dateRevision, 365); // Révision annuelle
    const joursRestants = differenceInDays(prochaineRevision, aujourdhui);
    
    if (joursRestants <= 30) {
      alertes.push({
        type: 'revision',
        niveau: joursRestants <= 0 ? 'urgent' : 'warning',
        message: joursRestants <= 0 
          ? `Révision annuelle en retard`
          : `Révision annuelle dans ${joursRestants} jours`,
        date_echeance: format(prochaineRevision, 'yyyy-MM-dd'),
        jours_restants: joursRestants,
      });
    }
  }

  // Stock bas
  const { data: stockData } = await supabase
    .from('stock_vehicule')
    .select(`
      id,
      quantite,
      seuil_alerte,
      article:article_id(designation)
    `)
    .eq('vehicule_id', vehiculeId);

  const stockBas = (stockData || [])
    .filter((s: any) => s.quantite <= (s.seuil_alerte || 3))
    .map((s: any) => ({
      designation: s.article?.designation || 'Article',
      quantite: s.quantite,
      seuil: s.seuil_alerte || 3,
    }));

  if (stockBas.length > 0) {
    alertes.push({
      type: 'stock',
      niveau: 'warning',
      message: `${stockBas.length} article(s) en stock bas`,
    });
  }

  // Dernières pièces sorties (mouvements de stock)
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
  
  const { data: mouvements } = await supabase
    .from('stock_mouvements')
    .select(`
      id,
      date_mouvement,
      quantite,
      code_appareil,
      technicien:technicien_id(prenom, nom),
      article:article_id(designation, reference)
    `)
    .eq('vehicule_id', vehiculeId)
    .eq('type_mouvement', 'sortie')
    .order('date_mouvement', { ascending: false })
    .limit(20);

  const dernieresPieces: HistoriquePiece[] = (mouvements || []).map((m: any) => ({
    id: m.id,
    date: m.date_mouvement,
    designation: m.article?.designation || 'Article',
    reference: m.article?.reference,
    quantite: m.quantite,
    technicien_nom: m.technicien 
      ? `${m.technicien.prenom} ${m.technicien.nom}`.trim()
      : undefined,
    code_appareil: m.code_appareil,
  }));

  // Stats du mois
  const piecesUtiliseesMois = (mouvements || [])
    .filter((m: any) => new Date(m.date_mouvement) >= debutMois)
    .reduce((acc: number, m: any) => acc + m.quantite, 0);

  const { data: interventions } = await supabase
    .from('interventions_rapides')
    .select('id')
    .eq('technicien_id', vehicule.technicien_id)
    .gte('date_intervention', format(debutMois, 'yyyy-MM-dd'));

  return {
    vehicule: vehiculeComplet,
    alertes,
    stockBas,
    dernieresPieces,
    stats: {
      pieces_utilisees_mois: piecesUtiliseesMois,
      interventions_mois: interventions?.length || 0,
    },
  };
}

// Récupérer le véhicule du technicien connecté
async function getVehiculeTechnicienConnecte(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Chercher par email d'abord
  const { data: technicien } = await supabase
    .from('techniciens')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  const technicienId = technicien?.id || user.id;

  const { data: vehicule } = await supabase
    .from('vehicules')
    .select('id')
    .eq('technicien_id', technicienId)
    .maybeSingle();

  return vehicule?.id || null;
}

// =============================================
// COMPOSANTS
// =============================================

// Composant Alerte
function AlerteCard({ alerte }: { alerte: AlerteVehicule }) {
  const config = {
    urgent: { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '🚨', color: 'text-red-400' },
    warning: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', icon: '⚠️', color: 'text-amber-400' },
    info: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: 'ℹ️', color: 'text-blue-400' },
  };

  const typeIcons = {
    ct: <Shield className="w-4 h-4" />,
    vidange: <Fuel className="w-4 h-4" />,
    revision: <Wrench className="w-4 h-4" />,
    stock: <Package className="w-4 h-4" />,
    assurance: <FileText className="w-4 h-4" />,
  };

  const c = config[alerte.niveau];

  return (
    <div className={`p-3 rounded-lg ${c.bg} border ${c.border}`}>
      <div className="flex items-center gap-3">
        <div className={c.color}>
          {typeIcons[alerte.type]}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${c.color}`}>{alerte.message}</p>
          {alerte.date_echeance && (
            <p className="text-xs text-[var(--text-muted)]">
              Échéance: {format(parseISO(alerte.date_echeance), 'dd/MM/yyyy')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant principal Suivi Véhicule
interface SuiviVehiculeProps {
  vehiculeId?: string; // Si non fourni, utilise le véhicule du technicien connecté
}

export function SuiviVehicule({ vehiculeId: propVehiculeId }: SuiviVehiculeProps) {
  const [activeTab, setActiveTab] = useState<'alertes' | 'pieces' | 'stats'>('alertes');

  // Récupérer l'ID du véhicule si non fourni
  const { data: vehiculeIdAuto } = useQuery({
    queryKey: ['vehicule-technicien-connecte'],
    queryFn: getVehiculeTechnicienConnecte,
    enabled: !propVehiculeId,
  });

  const vehiculeId = propVehiculeId || vehiculeIdAuto;

  // Récupérer les données du véhicule
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suivi-vehicule', vehiculeId],
    queryFn: () => getSuiviVehicule(vehiculeId!),
    enabled: !!vehiculeId,
    refetchInterval: 300000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-6 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--text-muted)]" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">Chargement...</p>
        </CardBody>
      </Card>
    );
  }

  if (!vehiculeId || !data) {
    return (
      <Card>
        <CardBody className="p-6 text-center">
          <Car className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-50" />
          <p className="mt-2 text-[var(--text-muted)]">Aucun véhicule assigné</p>
        </CardBody>
      </Card>
    );
  }

  const { vehicule, alertes, stockBas, dernieresPieces, stats } = data;
  const hasUrgentAlerts = alertes.some(a => a.niveau === 'urgent');

  return (
    <div className="space-y-4">
      {/* Header véhicule */}
      <Card className={hasUrgentAlerts ? 'border-red-500/50' : ''}>
        <CardBody className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                hasUrgentAlerts ? 'bg-red-500/20' : 'bg-cyan-500/20'
              }`}>
                <Car className={`w-7 h-7 ${hasUrgentAlerts ? 'text-red-400' : 'text-cyan-400'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {vehicule.immatriculation}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {vehicule.marque} {vehicule.modele} {vehicule.annee && `(${vehicule.annee})`}
                </p>
                {vehicule.technicien_nom && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Assigné à: {vehicule.technicien_nom}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alertes.length > 0 && (
                <Badge variant={hasUrgentAlerts ? 'red' : 'amber'}>
                  {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardBody className="p-3 text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.pieces_utilisees_mois}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Pièces ce mois</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-3 text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.interventions_mois}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Interventions</p>
          </CardBody>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)] pb-2">
        {[
          { id: 'alertes', label: 'Alertes', icon: Bell, count: alertes.length },
          { id: 'pieces', label: 'Pièces', icon: Package, count: dernieresPieces.length },
          { id: 'stats', label: 'Infos', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge variant={tab.id === 'alertes' && hasUrgentAlerts ? 'red' : 'gray'} className="text-[10px]">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Contenu des tabs */}
      <div className="min-h-[200px]">
        {activeTab === 'alertes' && (
          <div className="space-y-2">
            {alertes.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-[var(--text-muted)]">Aucune alerte</p>
              </div>
            ) : (
              alertes.map((alerte, idx) => (
                <AlerteCard key={idx} alerte={alerte} />
              ))
            )}
          </div>
        )}

        {activeTab === 'pieces' && (
          <div className="space-y-2">
            {dernieresPieces.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                <p className="text-[var(--text-muted)]">Aucune pièce utilisée récemment</p>
              </div>
            ) : (
              dernieresPieces.map(piece => (
                <Card key={piece.id}>
                  <CardBody className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {piece.designation}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          {piece.reference && <span>{piece.reference}</span>}
                          {piece.code_appareil && (
                            <Badge variant="gray" className="text-[10px]">
                              {piece.code_appareil}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--text-primary)]">×{piece.quantite}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {format(parseISO(piece.date), 'dd/MM', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-3">
            {/* Dates importantes */}
            <Card>
              <CardBody className="p-4 space-y-3">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Dates importantes</h4>
                
                {vehicule.date_prochain_ct && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-[var(--text-muted)]">Prochain CT</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {format(parseISO(vehicule.date_prochain_ct), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}

                {vehicule.date_prochaine_vidange && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-[var(--text-muted)]">Prochaine vidange</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {format(parseISO(vehicule.date_prochaine_vidange), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}

                {vehicule.date_derniere_revision && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-[var(--text-muted)]">Dernière révision</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {format(parseISO(vehicule.date_derniere_revision), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}

                {vehicule.date_mise_circulation && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-[var(--text-muted)]">Mise en circulation</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {format(parseISO(vehicule.date_mise_circulation), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Stock bas */}
            {stockBas.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardBody className="p-4">
                  <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Articles en stock bas
                  </h4>
                  <div className="space-y-2">
                    {stockBas.map((article, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-primary)] truncate">{article.designation}</span>
                        <span className="text-amber-400 font-medium">
                          {article.quantite}/{article.seuil}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Widget compact pour dashboard
export function SuiviVehiculeWidget({ vehiculeId }: { vehiculeId?: string }) {
  const { data: vehiculeIdAuto } = useQuery({
    queryKey: ['vehicule-technicien-connecte'],
    queryFn: getVehiculeTechnicienConnecte,
    enabled: !vehiculeId,
  });

  const effectiveVehiculeId = vehiculeId || vehiculeIdAuto;

  const { data } = useQuery({
    queryKey: ['suivi-vehicule', effectiveVehiculeId],
    queryFn: () => getSuiviVehicule(effectiveVehiculeId!),
    enabled: !!effectiveVehiculeId,
  });

  if (!data) {
    return (
      <Card>
        <CardBody className="p-4 text-center">
          <Car className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
          <p className="text-sm text-[var(--text-muted)] mt-2">Aucun véhicule</p>
        </CardBody>
      </Card>
    );
  }

  const hasUrgent = data.alertes.some(a => a.niveau === 'urgent');

  return (
    <Card className={hasUrgent ? 'border-red-500/50' : ''}>
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Car className={`w-5 h-5 ${hasUrgent ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="font-semibold text-[var(--text-primary)]">
              {data.vehicule.immatriculation}
            </span>
          </div>
          {data.alertes.length > 0 && (
            <Badge variant={hasUrgent ? 'red' : 'amber'}>{data.alertes.length}</Badge>
          )}
        </div>

        {data.alertes.length > 0 ? (
          <div className="space-y-1">
            {data.alertes.slice(0, 2).map((alerte, idx) => (
              <p key={idx} className={`text-xs ${
                alerte.niveau === 'urgent' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {alerte.niveau === 'urgent' ? '🚨' : '⚠️'} {alerte.message}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Tout est OK
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export default SuiviVehicule;
