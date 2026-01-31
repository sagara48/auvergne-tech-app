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

// ============================================
// SYNERGIES AVANCÉES
// ============================================

// Analyse prédictive des pannes
export { 
  AnalysePredictivePannes,
  AnalysePredictiveWidget 
} from './synergies';

// Tournées ↔ Travaux à proximité
export { 
  TourneeTravauxProximite,
  TravauxParSecteurWidget 
} from './synergies';

// Stock ↔ Alertes préventives
export { 
  StockAlertesPreventives,
  StockAlertesWidget 
} from './synergies';

// Travaux ↔ Planning intégration
export { 
  TravauxPlanningIntegration,
  TravauxAPlanifierWidget 
} from './synergies';

// ============================================
// SYNERGIES AVANCÉES V2
// ============================================

// Astreintes ↔ Pannes
export { 
  AstreintesPannes,
  AstreintePannesWidget 
} from './synergiesAvancees';

// Charge de travail équipe
export { 
  ChargeTravailTechniciens,
  ChargeTechWidget 
} from './synergiesAvancees';

// Chaîne d'approvisionnement
export { 
  ChaineApprovisionnement,
  ChaineApproWidget 
} from './synergiesAvancees';

// Suivi kilométrage véhicules
export { 
  SuiviKilometrage 
} from './synergiesAvancees';

// Notes contextuelles
export { 
  NotesContextuelles 
} from './synergiesAvancees';

// ============================================
// SYNERGIES V3
// ============================================

// GED ↔ Ascenseurs
export { 
  GEDAscenseurs,
  GEDWidget 
} from './synergiesV3';

// Chaîne d'approvisionnement complète
export { 
  ChaineApprovisionnement,
  ChaineApproWidget 
} from './synergiesV3';

// Alertes entretien (véhicules + ascenseurs)
export { 
  AlertesEntretien,
  AlertesEntretienWidget 
} from './synergiesV3';

// Notes contextuelles améliorées
export { 
  NotesContextuelles as NotesContextuellesV3 
} from './synergiesV3';

// ============================================
// SYNERGIES V4
// ============================================

// Stock Véhicule ↔ Tournée du jour
export { 
  StockVehiculeTournee,
  StockTourneeWidget 
} from './synergiesV4';

// Récurrence Pannes ↔ Alertes
export { 
  RecurrencePannes,
  RecurrencePannesWidget 
} from './synergiesV4';

// ============================================
// SYNERGIES V5
// ============================================

// Âge Pièces ↔ Remplacement Préventif
export { 
  AgePiecesPreventif,
  AgePiecesWidget 
} from './synergiesV5';

// Consommation Pièces ↔ Prévisions
export { 
  PrevisionConsommation,
  PrevisionConsoWidget 
} from './synergiesV5';

// Feedback Terrain
export { 
  FeedbackTerrain,
  FeedbackTerrainWidget 
} from './synergiesV5';

// ============================================
// SYNERGIES V6
// ============================================

// Dictée Vocale
export { 
  DicteeVocale,
  DicteeVocaleWidget 
} from './synergiesV6';

// Scan NFC
export { 
  ScanNFC,
  ScanNFCWidget 
} from './synergiesV6';

// Mode Hors-ligne
export { 
  ModeHorsLigne,
  ModeHorsLigneWidget,
  useOfflineMode 
} from './synergiesV6';

// Absences ↔ Réaffectation
export { 
  AbsencesReaffectation,
  AbsencesWidget 
} from './synergiesV6';
