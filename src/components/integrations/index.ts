// src/components/integrations/index.ts
// Export centralisé - version optimisée

// ============================================
// COMPOSANTS DE BASE
// ============================================

export { DocumentsLies } from './DocumentsLies';
export { StockVehiculeDetail, StockVehiculeWidget } from './StockVehiculeDetail';
export { TravauxPieces, TravauxEtapes } from './TravauxPiecesEtapes';
export { StockMouvements, StockMouvementsWidget } from './StockMouvements';
export { PiecesPicker, AddToPanierButton } from './PiecesPicker';
export { HistoriqueAscenseur } from './HistoriqueAscenseur';
export { ReapprovisionnementAuto, VehiculeStockAlertBadge } from './ReapprovisionnementAuto';
export { FicheAscenseurNFC } from './FicheAscenseurNFC';
export { CreerTravauxDepuisArret, BoutonCreerTravaux } from './CreerTravauxDepuisArret';
export { TechnicienDashboard } from './TechnicienDashboard';
export { AlerteStock, AlerteStockWidget, useStockAlerts } from './AlerteStockReappro';
export { SuiviVehicule, SuiviVehiculeWidget } from './SuiviVehicule';
export { PlanningTravaux, TravauxAPlanifier, PlanningTravauxView } from './PlanningTravaux';
export { ActionsRapidesNFC, ActionNoteRapide, ActionSignalerProbleme, ActionDemanderTravaux } from './ActionsRapidesNFC';
export { PiecesRemplaceesParc, PiecesRemplaceesByAscenseur } from './PiecesRemplacees';

// ============================================
// SYNERGIES V1
// ============================================

export { 
  AnalysePredictivePannes,
  TourneeTravauxProximite,
  StockAlertesPreventives,
  TravauxPlanningIntegration,
} from './synergies';

// ============================================
// SYNERGIES V2
// ============================================

export { 
  AstreintesPannes,
  AstreintePannesWidget,
  ChargeTravailTechniciens,
  ChargeTechWidget,
  SuiviKilometrage,
} from './synergiesAvancees';

// ============================================
// SYNERGIES V3
// ============================================

export { 
  GEDAscenseurs,
  GEDWidget,
  ChaineApprovisionnement,
  ChaineApproWidget,
  AlertesEntretien,
  AlertesEntretienWidget,
  NotesContextuelles,
} from './synergiesV3';

// ============================================
// SYNERGIES V4
// ============================================

export { 
  StockVehiculeTournee,
  StockTourneeWidget,
  RecurrencePannes,
  RecurrencePannesWidget,
} from './synergiesV4';

// ============================================
// SYNERGIES V5
// ============================================

export { 
  AgePiecesPreventif,
  AgePiecesWidget,
  PrevisionConsommation,
  PrevisionConsoWidget,
  FeedbackTerrain,
  FeedbackTerrainWidget,
} from './synergiesV5';

// ============================================
// SYNERGIES V6
// ============================================

export { 
  DicteeVocale,
  DicteeVocaleWidget,
  ScanNFC,
  ScanNFCWidget,
  ModeHorsLigne,
  ModeHorsLigneWidget,
  useOfflineMode,
  AbsencesReaffectation,
  AbsencesWidget,
} from './synergiesV6';
