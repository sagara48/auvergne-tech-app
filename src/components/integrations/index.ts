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

// Historique complet ascenseur (timeline pannes, visites, travaux, docs)
export { HistoriqueAscenseur } from './HistoriqueAscenseur';

// Réapprovisionnement automatique véhicule (stock sous seuil)
export { ReapprovisionnementAuto, VehiculeStockAlertBadge } from './ReapprovisionnementAuto';

// Fiche ascenseur complète après scan NFC
export { FicheAscenseurNFC } from './FicheAscenseurNFC';

// Créer travaux depuis arrêt/panne du parc
export { CreerTravauxDepuisArret, BoutonCreerTravaux } from './CreerTravauxDepuisArret';

