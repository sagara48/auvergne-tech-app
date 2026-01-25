import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar, Package, Clock, Car, AlertTriangle, CheckCircle, 
  MapPin, Wrench, TrendingUp, ChevronRight, Bell, RefreshCw,
  Fuel, FileCheck, Timer, Route, User
} from 'lucide-react';
import { Card, CardBody, Badge, Button, ProgressBar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, isToday, isTomorrow, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================
// TYPES
// =============================================
interface VisitePlanifiee {
  id: string;
  code_appareil: string;
  adresse: string;
  ville: string;
  type: 'visite' | 'controle' | 'travaux';
  date_planifiee: string;
  heure_debut?: string;
  statut: string;
}

interface ArticleStockBas {
  id: string;
  designation: string;
  reference?: string;
  quantite: number;
  seuil_alerte: number;
}

interface HeuresSemaine {
  heures_travaillees: number;
  heures_objectif: number;
  heures_supplementaires: number;
  jours_travailles: number;
}

interface InfoVehicule {
  id: string;
  immatriculation: string;
  marque?: string;
  modele?: string;
  date_prochain_ct?: string;
  date_prochaine_vidange?: string;
  kilometrage?: number;
  alertes: string[];
}

interface TechnicienInfo {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  secteurs?: number[];
}

interface DashboardData {
  technicien: TechnicienInfo | null;
  visitesAujourdhui: VisitePlanifiee[];
  visitesDemain: VisitePlanifiee[];
  visitesSemaine: VisitePlanifiee[];
  stockBas: ArticleStockBas[];
  heures: HeuresSemaine;
  vehicule: InfoVehicule | null;
  statsIntervention: {
    total_mois: number;
    pannes_resolues: number;
    temps_moyen_minutes: number;
  };
}

// =============================================
// FONCTIONS API
// =============================================
async function getDashboardTechnicien(): Promise<DashboardData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  // Récupérer le technicien
  let technicien: TechnicienInfo | null = null;
  const { data: techData } = await supabase
    .from('techniciens')
    .select('id, nom, prenom, email')
    .eq('email', user.email)
    .maybeSingle();
  
  if (techData) {
    technicien = techData;
    
    // Récupérer ses secteurs
    const { data: secteurs } = await supabase
      .from('user_secteurs')
      .select('secteur')
      .eq('user_id', techData.id);
    
    if (secteurs) {
      technicien.secteurs = secteurs.map(s => s.secteur);
    }
  }

  const technicienId = techData?.id || user.id;

  // Dates
  const aujourdhui = new Date();
  const debutSemaine = startOfWeek(aujourdhui, { weekStartsOn: 1 });
  const finSemaine = endOfWeek(aujourdhui, { weekStartsOn: 1 });
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);

  // Visites planifiées (depuis planning_events ou interventions)
  const { data: planningEvents } = await supabase
    .from('planning_events')
    .select('*')
    .eq('technicien_id', technicienId)
    .gte('date_debut', format(aujourdhui, 'yyyy-MM-dd'))
    .lte('date_debut', format(finSemaine, 'yyyy-MM-dd'))
    .order('date_debut');

  const visites: VisitePlanifiee[] = (planningEvents || []).map((e: any) => ({
    id: e.id,
    code_appareil: e.code_appareil || e.titre || 'N/A',
    adresse: e.lieu || '',
    ville: '',
    type: e.type_event === 'travaux' ? 'travaux' : 'visite',
    date_planifiee: e.date_debut,
    heure_debut: e.heure_debut,
    statut: e.statut || 'planifie',
  }));

  const visitesAujourdhui = visites.filter(v => isToday(parseISO(v.date_planifiee)));
  const visitesDemain = visites.filter(v => isTomorrow(parseISO(v.date_planifiee)));
  const visitesSemaine = visites;

  // Stock véhicule bas
  const { data: vehiculeData } = await supabase
    .from('vehicules')
    .select('id, immatriculation, marque, modele, date_prochain_ct, date_prochaine_vidange, kilometrage')
    .eq('technicien_id', technicienId)
    .maybeSingle();

  let stockBas: ArticleStockBas[] = [];
  let vehicule: InfoVehicule | null = null;

  if (vehiculeData) {
    // Stock bas
    const { data: stockData } = await supabase
      .from('stock_vehicule')
      .select(`
        id,
        quantite,
        seuil_alerte,
        article:article_id(id, designation, reference)
      `)
      .eq('vehicule_id', vehiculeData.id)
      .lt('quantite', supabase.rpc('coalesce', { val: 'seuil_alerte', default: 5 }));

    // Filtrer manuellement les stocks bas
    const { data: allStock } = await supabase
      .from('stock_vehicule')
      .select(`
        id,
        quantite,
        seuil_alerte,
        article:article_id(id, designation, reference)
      `)
      .eq('vehicule_id', vehiculeData.id);

    stockBas = (allStock || [])
      .filter((s: any) => s.quantite <= (s.seuil_alerte || 3))
      .map((s: any) => ({
        id: s.id,
        designation: s.article?.designation || 'Article',
        reference: s.article?.reference,
        quantite: s.quantite,
        seuil_alerte: s.seuil_alerte || 3,
      }));

    // Alertes véhicule
    const alertes: string[] = [];
    if (vehiculeData.date_prochain_ct) {
      const joursAvantCT = differenceInDays(parseISO(vehiculeData.date_prochain_ct), aujourdhui);
      if (joursAvantCT <= 30) {
        alertes.push(`CT dans ${joursAvantCT} jours`);
      }
    }
    if (vehiculeData.date_prochaine_vidange) {
      const joursAvantVidange = differenceInDays(parseISO(vehiculeData.date_prochaine_vidange), aujourdhui);
      if (joursAvantVidange <= 15) {
        alertes.push(`Vidange dans ${joursAvantVidange} jours`);
      }
    }

    vehicule = {
      ...vehiculeData,
      alertes,
    };
  }

  // Heures de la semaine (depuis feuilles d'heures)
  const numeroSemaine = Math.ceil((aujourdhui.getDate() - aujourdhui.getDay() + 1) / 7);
  const { data: semaineData } = await supabase
    .from('semaines')
    .select('heures_totales, jours(heures_jour)')
    .eq('technicien_id', technicienId)
    .eq('annee', aujourdhui.getFullYear())
    .eq('numero_semaine', numeroSemaine)
    .maybeSingle();

  const heures: HeuresSemaine = {
    heures_travaillees: semaineData?.heures_totales || 0,
    heures_objectif: 35,
    heures_supplementaires: Math.max(0, (semaineData?.heures_totales || 0) - 35),
    jours_travailles: (semaineData?.jours || []).filter((j: any) => j.heures_jour > 0).length,
  };

  // Stats interventions du mois
  const { data: interventions } = await supabase
    .from('interventions_rapides')
    .select('id, duree_minutes')
    .eq('technicien_id', technicienId)
    .gte('date_intervention', format(debutMois, 'yyyy-MM-dd'));

  const statsIntervention = {
    total_mois: interventions?.length || 0,
    pannes_resolues: interventions?.length || 0,
    temps_moyen_minutes: interventions?.length 
      ? Math.round(interventions.reduce((acc, i) => acc + (i.duree_minutes || 30), 0) / interventions.length)
      : 0,
  };

  return {
    technicien,
    visitesAujourdhui,
    visitesDemain,
    visitesSemaine,
    stockBas,
    heures,
    vehicule,
    statsIntervention,
  };
}

// =============================================
// COMPOSANTS
// =============================================

// Widget Visites du jour
function WidgetVisites({ 
  visites, 
  titre, 
  emptyText 
}: { 
  visites: VisitePlanifiee[]; 
  titre: string;
  emptyText: string;
}) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'travaux': return { icon: Wrench, color: 'text-purple-400', bg: 'bg-purple-500/20' };
      case 'controle': return { icon: FileCheck, color: 'text-orange-400', bg: 'bg-orange-500/20' };
      default: return { icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    }
  };

  return (
    <Card className="h-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            {titre}
          </h3>
          <Badge variant={visites.length > 0 ? 'blue' : 'gray'}>
            {visites.length}
          </Badge>
        </div>

        {visites.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)]">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visites.slice(0, 5).map((visite) => {
              const config = getTypeConfig(visite.type);
              const Icon = config.icon;
              return (
                <div 
                  key={visite.id}
                  className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] hover:border-blue-500/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {visite.code_appareil}
                      </p>
                      {visite.adresse && (
                        <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {visite.adresse}
                        </p>
                      )}
                    </div>
                    {visite.heure_debut && (
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {visite.heure_debut.slice(0, 5)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {visites.length > 5 && (
              <p className="text-xs text-center text-[var(--text-muted)]">
                +{visites.length - 5} autres visites
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Widget Stock véhicule
function WidgetStockVehicule({ 
  stockBas, 
  vehicule 
}: { 
  stockBas: ArticleStockBas[];
  vehicule: InfoVehicule | null;
}) {
  return (
    <Card className="h-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            Stock véhicule
          </h3>
          {stockBas.length > 0 && (
            <Badge variant="amber">{stockBas.length} alertes</Badge>
          )}
        </div>

        {!vehicule ? (
          <div className="text-center py-6 text-[var(--text-muted)]">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun véhicule assigné</p>
          </div>
        ) : stockBas.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)]">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm">Stock OK</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stockBas.slice(0, 4).map((article) => (
              <div 
                key={article.id}
                className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {article.designation}
                    </p>
                    {article.reference && (
                      <p className="text-[10px] text-[var(--text-muted)]">{article.reference}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400">
                      {article.quantite}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      / {article.seuil_alerte}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {stockBas.length > 4 && (
              <Button variant="ghost" size="sm" className="w-full text-amber-400">
                Voir {stockBas.length - 4} autres alertes
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Widget Heures semaine
function WidgetHeures({ heures }: { heures: HeuresSemaine }) {
  const progression = Math.min(100, (heures.heures_travaillees / heures.heures_objectif) * 100);
  const progressColor = progression >= 100 ? 'green' : progression >= 70 ? 'blue' : 'amber';

  return (
    <Card className="h-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            Heures semaine
          </h3>
          <span className="text-lg font-bold text-[var(--text-primary)]">
            {heures.heures_travaillees}h
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Progression</span>
              <span>{heures.heures_travaillees}h / {heures.heures_objectif}h</span>
            </div>
            <ProgressBar value={progression} color={progressColor} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded-lg">
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {heures.jours_travailles}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">Jours</p>
            </div>
            <div className="text-center p-2 bg-[var(--bg-secondary)] rounded-lg">
              <p className={`text-lg font-bold ${heures.heures_supplementaires > 0 ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>
                {heures.heures_supplementaires > 0 ? '+' : ''}{heures.heures_supplementaires}h
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">Supp.</p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Widget Véhicule
function WidgetVehicule({ vehicule }: { vehicule: InfoVehicule | null }) {
  if (!vehicule) {
    return (
      <Card className="h-full">
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Car className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-[var(--text-primary)]">Mon véhicule</h3>
          </div>
          <div className="text-center py-6 text-[var(--text-muted)]">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun véhicule assigné</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Car className="w-4 h-4 text-cyan-400" />
            Mon véhicule
          </h3>
          {vehicule.alertes.length > 0 && (
            <Badge variant="amber">{vehicule.alertes.length}</Badge>
          )}
        </div>

        <div className="space-y-3">
          {/* Info véhicule */}
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {vehicule.immatriculation}
            </p>
            {(vehicule.marque || vehicule.modele) && (
              <p className="text-sm text-[var(--text-muted)]">
                {vehicule.marque} {vehicule.modele}
              </p>
            )}
          </div>

          {/* Alertes */}
          {vehicule.alertes.length > 0 && (
            <div className="space-y-2">
              {vehicule.alertes.map((alerte, idx) => (
                <div 
                  key={idx}
                  className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-amber-400">{alerte}</span>
                </div>
              ))}
            </div>
          )}

          {/* Dates importantes */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {vehicule.date_prochain_ct && (
              <div className="p-2 bg-[var(--bg-secondary)] rounded">
                <p className="text-[var(--text-muted)]">Prochain CT</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {format(parseISO(vehicule.date_prochain_ct), 'dd/MM/yyyy')}
                </p>
              </div>
            )}
            {vehicule.date_prochaine_vidange && (
              <div className="p-2 bg-[var(--bg-secondary)] rounded">
                <p className="text-[var(--text-muted)]">Vidange</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {format(parseISO(vehicule.date_prochaine_vidange), 'dd/MM/yyyy')}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Widget Stats
function WidgetStats({ stats }: { stats: DashboardData['statsIntervention'] }) {
  return (
    <Card className="h-full">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Ce mois</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.total_mois}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Interventions</p>
          </div>
          <div className="text-center p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-2xl font-bold text-green-400">
              {stats.pannes_resolues}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Résolues</p>
          </div>
          <div className="text-center p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.temps_moyen_minutes}'
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Temps moy.</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================
// COMPOSANT PRINCIPAL
// =============================================
export function TechnicienDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['technicien-dashboard'],
    queryFn: getDashboardTechnicien,
    refetchInterval: 60000, // Refresh toutes les minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Impossible de charger le dashboard</p>
        <Button variant="ghost" onClick={() => refetch()} className="mt-2">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Bonjour {data.technicien?.prenom || 'Technicien'} 👋
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Visites aujourd'hui */}
        <WidgetVisites 
          visites={data.visitesAujourdhui}
          titre="Aujourd'hui"
          emptyText="Aucune visite prévue"
        />

        {/* Visites demain */}
        <WidgetVisites 
          visites={data.visitesDemain}
          titre="Demain"
          emptyText="Aucune visite prévue"
        />

        {/* Heures semaine */}
        <WidgetHeures heures={data.heures} />

        {/* Stock véhicule */}
        <WidgetStockVehicule 
          stockBas={data.stockBas}
          vehicule={data.vehicule}
        />

        {/* Mon véhicule */}
        <WidgetVehicule vehicule={data.vehicule} />

        {/* Stats */}
        <WidgetStats stats={data.statsIntervention} />
      </div>

      {/* Alertes globales */}
      {(data.stockBas.length > 0 || (data.vehicule?.alertes.length || 0) > 0) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-amber-400">Alertes</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.stockBas.length > 0 && (
                <Badge variant="amber">
                  {data.stockBas.length} article(s) en stock bas
                </Badge>
              )}
              {data.vehicule?.alertes.map((alerte, idx) => (
                <Badge key={idx} variant="amber">{alerte}</Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default TechnicienDashboard;
