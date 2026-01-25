// src/components/integrations/index.ts
// Export de tous les composants d'intégration cross-modules

// GED - Documents liés avec expiration
export { DocumentsLies } from './DocumentsLies';

// Stock Véhicule - Alertes et réapprovisionnement
export { StockVehiculeDetail, StockVehiculeWidget } from './StockVehiculeDetail';

// Travaux - Pièces et étapes détaillées
export { TravauxPieces, TravauxEtapes } from './TravauxPiecesEtapes';

// Mouvements de stock - Historique entrées/sorties
export { StockMouvements, StockMouvementsWidget } from './StockMouvements';

// Sélecteur de pièces détachées
export { PiecesPicker, AddToPanierButton } from './PiecesPicker';

// Historique complet ascenseur (timeline pannes, visites, travaux, docs, pièces)
export { HistoriqueAscenseur } from './HistoriqueAscenseur';

// Réapprovisionnement automatique véhicule (stock sous seuil)
export { ReapprovisionnementAuto, VehiculeStockAlertBadge } from './ReapprovisionnementAuto';

// Fiche ascenseur complète après scan NFC
export { FicheAscenseurNFC } from './FicheAscenseurNFC';

// Créer travaux depuis arrêt/panne du parc
export { CreerTravauxDepuisArret, BoutonCreerTravaux } from './CreerTravauxDepuisArret';

// ============================================
// NOUVELLES SYNERGIES
// ============================================

// Dashboard Technicien Personnalisé
export { TechnicienDashboard } from './TechnicienDashboard';

// Alertes Stock avec création de demandes réappro automatiques
export { AlerteStock, AlerteStockWidget, useStockAlerts } from './AlerteStockReappro';

// Suivi Véhicule Intelligent (alertes CT, vidange, stock)
export { SuiviVehicule, SuiviVehiculeWidget } from './SuiviVehicule';

// Intégration Planning ↔ Travaux
export { PlanningTravaux, TravauxAPlanifier, PlanningTravauxView } from './PlanningTravaux';

// Actions Rapides NFC (notes, signalement, demande travaux)
export { 
  ActionsRapidesNFC, 
  ActionNoteRapide, 
  ActionSignalerProbleme, 
  ActionDemanderTravaux 
} from './ActionsRapidesNFC';

// Pièces remplacées - Vue globale et par ascenseur
export { 
  PiecesRemplaceesParc, 
  PiecesRemplaceesByAscenseur 
} from './PiecesRemplacees';
