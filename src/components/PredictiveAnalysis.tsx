import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Shield, Activity,
  ChevronRight, RefreshCw, Filter, Download, Eye, Zap, Clock,
  ArrowUp, ArrowDown, Minus, Building2, Wrench, Calendar, Info
} from 'lucide-react';
import { Card, CardBody, Badge, Button, Select } from '@/components/ui';
import { analyserParcComplet, getPredictionAscenseur, type PredictionPanne, type AnalyseGlobale } from '@/services/predictiveService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PredictiveAnalysisProps {
  onSelectAscenseur?: (code: string) => void;
  secteurs?: number[];
}

export function PredictiveAnalysisDashboard({ onSelectAscenseur, secteurs }: PredictiveAnalysisProps) {
  const [selectedNiveau, setSelectedNiveau] = useState<string>('all');
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionPanne | null>(null);

  const { data: analyse, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['analyse-predictive', secteurs],
    queryFn: () => analyserParcComplet(secteurs),
    refetchInterval: 5 * 60 * 1000, // Rafraîchir toutes les 5 minutes
  });

  // Filtrer les prédictions par niveau
  const predictionsFiltrees = analyse?.predictions.filter(p => 
    selectedNiveau === 'all' || p.niveau === selectedNiveau
  ) || [];

  // Couleurs par niveau
  const getNiveauConfig = (niveau: string) => {
    switch (niveau) {
      case 'critique':
        return { color: 'red', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
      case 'eleve':
        return { color: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
      case 'moyen':
        return { color: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
      default:
        return { color: 'green', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
    }
  };

  const getTendanceIcon = (tendance: string) => {
    switch (tendance) {
      case 'hausse': return <ArrowUp className="w-4 h-4 text-red-400" />;
      case 'baisse': return <ArrowDown className="w-4 h-4 text-green-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-purple-500 animate-pulse" />
          <p className="text-[var(--text-muted)]">Analyse prédictive en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Analyse Prédictive IA</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Prédiction des pannes basée sur l'historique
            </p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border-purple-500/30">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{analyse?.scoreGlobal || 0}</p>
                <p className="text-sm text-[var(--text-muted)]">Score risque global</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                (analyse?.scoreGlobal || 0) > 50 ? 'bg-red-500/20' : 'bg-green-500/20'
              }`}>
                <Activity className={`w-6 h-6 ${
                  (analyse?.scoreGlobal || 0) > 50 ? 'text-red-400' : 'text-green-400'
                }`} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs">
              {analyse?.tendanceGenerale === 'degradation' && (
                <><TrendingUp className="w-3 h-3 text-red-400" /> En dégradation</>
              )}
              {analyse?.tendanceGenerale === 'amelioration' && (
                <><TrendingDown className="w-3 h-3 text-green-400" /> En amélioration</>
              )}
              {analyse?.tendanceGenerale === 'stable' && (
                <><Minus className="w-3 h-3 text-gray-400" /> Stable</>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-400">{analyse?.ascenseursACritiquer || 0}</p>
                <p className="text-sm text-[var(--text-muted)]">Risque critique</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-orange-400">{analyse?.ascenseursAEleveRisque || 0}</p>
                <p className="text-sm text-[var(--text-muted)]">Risque élevé</p>
              </div>
              <Zap className="w-8 h-8 text-orange-400" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-400">
                  {(analyse?.predictions.length || 0) - (analyse?.ascenseursACritiquer || 0) - (analyse?.ascenseursAEleveRisque || 0)}
                </p>
                <p className="text-sm text-[var(--text-muted)]">Risque faible/moyen</p>
              </div>
              <Shield className="w-8 h-8 text-green-400" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Alertes */}
      {analyse?.alertes && analyse.alertes.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardBody className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Alertes actives
            </h3>
            <div className="space-y-2">
              {analyse.alertes.map((alerte, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg ${
                    alerte.priorite === 'haute' ? 'bg-red-500/10 border border-red-500/30' :
                    alerte.priorite === 'moyenne' ? 'bg-orange-500/10 border border-orange-500/30' :
                    'bg-yellow-500/10 border border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{alerte.message}</p>
                    <Badge variant={alerte.priorite === 'haute' ? 'red' : alerte.priorite === 'moyenne' ? 'orange' : 'gray'}>
                      {alerte.priorite}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Ascenseurs: {alerte.ascenseurs.slice(0, 5).join(', ')}
                    {alerte.ascenseurs.length > 5 && ` +${alerte.ascenseurs.length - 5} autres`}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filtre et liste */}
      <div className="flex items-center gap-4 mb-4">
        <Filter className="w-5 h-5 text-[var(--text-muted)]" />
        <Select 
          value={selectedNiveau} 
          onChange={e => setSelectedNiveau(e.target.value)}
          className="w-48"
        >
          <option value="all">Tous les niveaux</option>
          <option value="critique">🔴 Critique</option>
          <option value="eleve">🟠 Élevé</option>
          <option value="moyen">🟡 Moyen</option>
          <option value="faible">🟢 Faible</option>
        </Select>
        <span className="text-sm text-[var(--text-muted)]">
          {predictionsFiltrees.length} ascenseur(s)
        </span>
      </div>

      {/* Liste des prédictions */}
      <div className="grid gap-3">
        {predictionsFiltrees.slice(0, 20).map(prediction => {
          const config = getNiveauConfig(prediction.niveau);
          
          return (
            <Card 
              key={prediction.ascenseurId}
              className={`${config.border} hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors`}
              onClick={() => setSelectedPrediction(prediction)}
            >
              <CardBody className="p-4">
                <div className="flex items-center gap-4">
                  {/* Score visuel */}
                  <div className={`w-16 h-16 rounded-xl ${config.bg} flex flex-col items-center justify-center`}>
                    <span className={`text-2xl font-bold ${config.text}`}>{prediction.scoreRisque}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">risque</span>
                  </div>

                  {/* Infos ascenseur */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{prediction.codeAppareil}</p>
                      <Badge variant={
                        prediction.niveau === 'critique' ? 'red' :
                        prediction.niveau === 'eleve' ? 'orange' :
                        prediction.niveau === 'moyen' ? 'yellow' : 'green'
                      } className="text-[10px]">
                        {prediction.niveau.toUpperCase()}
                      </Badge>
                      {getTendanceIcon(prediction.tendance)}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] truncate">
                      {prediction.adresse}, {prediction.ville}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {prediction.nombrePannes30j} panne(s) / 30j
                      </span>
                      {prediction.dernierePanne && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Dernière: {format(prediction.dernierePanne, 'dd/MM', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Probabilités */}
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-[var(--text-muted)]">7j:</span>{' '}
                      <span className={prediction.probabilitePanne7j > 50 ? 'text-red-400 font-bold' : ''}>
                        {prediction.probabilitePanne7j}%
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-[var(--text-muted)]">30j:</span>{' '}
                      <span className={prediction.probabilitePanne30j > 70 ? 'text-red-400 font-bold' : ''}>
                        {prediction.probabilitePanne30j}%
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Modal détail */}
      {selectedPrediction && (
        <PredictionDetailModal 
          prediction={selectedPrediction}
          onClose={() => setSelectedPrediction(null)}
          onViewAscenseur={onSelectAscenseur}
        />
      )}
    </div>
  );
}

/**
 * Modal détail d'une prédiction
 */
function PredictionDetailModal({ 
  prediction, 
  onClose,
  onViewAscenseur 
}: { 
  prediction: PredictionPanne;
  onClose: () => void;
  onViewAscenseur?: (code: string) => void;
}) {
  const config = {
    critique: { color: 'red', icon: AlertTriangle },
    eleve: { color: 'orange', icon: Zap },
    moyen: { color: 'yellow', icon: Activity },
    faible: { color: 'green', icon: Shield },
  }[prediction.niveau];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[80vh] overflow-hidden">
        <CardBody className="p-0">
          {/* Header */}
          <div className={`p-4 bg-gradient-to-r from-${config.color}-500 to-${config.color}-600 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="text-2xl font-bold">{prediction.scoreRisque}</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg">{prediction.codeAppareil}</h2>
                  <p className="text-sm text-white/80">{prediction.ville} • Secteur {prediction.secteur}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
            {/* Probabilités */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[var(--bg-tertiary)]">
                <CardBody className="p-4 text-center">
                  <p className={`text-3xl font-bold ${prediction.probabilitePanne7j > 50 ? 'text-red-400' : 'text-green-400'}`}>
                    {prediction.probabilitePanne7j}%
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Probabilité panne 7 jours</p>
                </CardBody>
              </Card>
              <Card className="bg-[var(--bg-tertiary)]">
                <CardBody className="p-4 text-center">
                  <p className={`text-3xl font-bold ${prediction.probabilitePanne30j > 70 ? 'text-red-400' : 'text-orange-400'}`}>
                    {prediction.probabilitePanne30j}%
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Probabilité panne 30 jours</p>
                </CardBody>
              </Card>
            </div>

            {/* Facteurs de risque */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Facteurs analysés
              </h3>
              <div className="space-y-2">
                {prediction.facteurs.map((facteur, i) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      facteur.type === 'risque' 
                        ? 'bg-red-500/10 border border-red-500/20' 
                        : 'bg-green-500/10 border border-green-500/20'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{facteur.facteur}</p>
                      <p className="text-sm text-[var(--text-muted)]">{facteur.description}</p>
                    </div>
                    <Badge variant={facteur.type === 'risque' ? 'red' : 'green'}>
                      {facteur.impact > 0 ? '+' : ''}{facteur.impact}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Pannes récurrentes */}
            {prediction.pannesRecurrentes && prediction.pannesRecurrentes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-400" />
                  Pannes récurrentes détectées
                </h3>
                <div className="space-y-2">
                  {prediction.pannesRecurrentes.map((panne, i) => (
                    <div key={i} className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{panne.type}</span>
                        <Badge variant="orange">{panne.count}x en 90j</Badge>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        Dernière occurrence: {format(panne.derniere, 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommandations */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Recommandations IA
              </h3>
              <div className="space-y-2">
                {prediction.recommandations.map((rec, i) => (
                  <div key={i} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                    {rec}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
              <Button variant="secondary" onClick={onClose}>
                Fermer
              </Button>
              {onViewAscenseur && (
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={() => {
                    onViewAscenseur(prediction.codeAppareil);
                    onClose();
                  }}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Voir l'ascenseur
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default PredictiveAnalysisDashboard;
