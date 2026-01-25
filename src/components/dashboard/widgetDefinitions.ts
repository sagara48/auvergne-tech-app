import { 
  LayoutDashboard, Calendar, Hammer, FileCheck, Package, Clock, 
  MessageCircle, Car, AlertTriangle, TrendingUp, CheckSquare,
  StickyNote, CloudSun, Link, Users, BarChart3, PieChart,
  Timer, Truck, Bell, Activity, Zap, Shield
} from 'lucide-react';

export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetCategory = 'stats' | 'planning' | 'travaux' | 'stock' | 'communication' | 'temps' | 'vehicule' | 'graphiques' | 'utilitaires';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  icon: any;
  defaultSize: WidgetSize;
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  defaultW: number;
  defaultH: number;
}

export interface WidgetInstance {
  i: string; // unique id
  type: string; // widget definition id
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, any>;
}

export interface DashboardConfig {
  id?: string;
  technicien_id: string;
  layout: WidgetInstance[];
  widgets: string[]; // list of active widget types
}

// Catégories
export const WIDGET_CATEGORIES: Record<WidgetCategory, { label: string; color: string }> = {
  stats: { label: 'Statistiques', color: '#3b82f6' },
  planning: { label: 'Planning', color: '#f59e0b' },
  travaux: { label: 'Travaux & MES', color: '#a855f7' },
  stock: { label: 'Stock', color: '#ef4444' },
  communication: { label: 'Communication', color: '#8b5cf6' },
  temps: { label: 'Temps', color: '#14b8a6' },
  vehicule: { label: 'Véhicule', color: '#22c55e' },
  graphiques: { label: 'Graphiques', color: '#ec4899' },
  utilitaires: { label: 'Utilitaires', color: '#6366f1' },
};

// Définitions de tous les widgets
export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // === STATS ===
  {
    id: 'stats-counters',
    name: 'Compteurs clés',
    description: 'Ascenseurs en panne, travaux, MES, demandes',
    category: 'stats',
    icon: LayoutDashboard,
    defaultSize: 'large',
    minW: 2, minH: 1, defaultW: 4, defaultH: 1,
  },
  {
    id: 'stats-progress',
    name: 'Progression travaux',
    description: 'Barre de progression globale des travaux actifs',
    category: 'stats',
    icon: TrendingUp,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 2, defaultH: 1,
  },
  {
    id: 'stats-stock-critical',
    name: 'Stock critique',
    description: 'Articles sous seuil avec alerte',
    category: 'stats',
    icon: AlertTriangle,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },
  {
    id: 'stats-transfers',
    name: 'Transferts en attente',
    description: 'Demandes de transfert à valider',
    category: 'stats',
    icon: Truck,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },

  // === PLANNING ===
  {
    id: 'planning-today',
    name: 'Mon planning du jour',
    description: 'Liste des interventions du technicien connecté',
    category: 'planning',
    icon: Calendar,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'planning-week',
    name: 'Planning semaine',
    description: 'Vue mini-calendrier avec événements',
    category: 'planning',
    icon: Calendar,
    defaultSize: 'large',
    minW: 3, minH: 2, defaultW: 4, defaultH: 3,
  },
  {
    id: 'planning-deadlines',
    name: 'Prochaines échéances',
    description: 'Travaux avec date butoir proche',
    category: 'planning',
    icon: AlertTriangle,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  {
    id: 'planning-astreintes',
    name: 'Astreintes à venir',
    description: 'Prochaines astreintes assignées',
    category: 'planning',
    icon: Bell,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 2, defaultH: 1,
  },

  // === TRAVAUX & MES ===
  {
    id: 'travaux-mine',
    name: 'Mes travaux',
    description: 'Liste des travaux assignés au technicien',
    category: 'travaux',
    icon: Hammer,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'travaux-urgent',
    name: 'Travaux urgents',
    description: 'Travaux avec date butoir critique',
    category: 'travaux',
    icon: AlertTriangle,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  {
    id: 'mes-progress',
    name: 'MES en cours',
    description: 'Mises en service avec progression',
    category: 'travaux',
    icon: FileCheck,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },

  // === STOCK ===
  {
    id: 'stock-vehicle',
    name: 'Stock véhicule',
    description: 'Inventaire du véhicule du technicien',
    category: 'stock',
    icon: Package,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'stock-alerts',
    name: 'Alertes stock',
    description: 'Articles en alerte ou critique',
    category: 'stock',
    icon: AlertTriangle,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  {
    id: 'stock-movements',
    name: 'Derniers mouvements',
    description: 'Historique transferts récents',
    category: 'stock',
    icon: Activity,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },

  // === COMMUNICATION ===
  {
    id: 'chat-recent',
    name: 'Messages récents',
    description: 'Derniers messages des canaux',
    category: 'communication',
    icon: MessageCircle,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'chat-unread',
    name: 'Messages non-lus',
    description: 'Compteur avec aperçu',
    category: 'communication',
    icon: MessageCircle,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },
  {
    id: 'notes',
    name: 'Notes récentes',
    description: 'Aperçu des dernières notes personnelles et partagées',
    category: 'communication',
    icon: StickyNote,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Alertes et notifications non lues',
    category: 'communication',
    icon: Bell,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },

  // === TEMPS ===
  {
    id: 'hours-week',
    name: 'Heures semaine',
    description: 'Progression heures travaillées',
    category: 'temps',
    icon: Clock,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },
  {
    id: 'hours-summary',
    name: 'Résumé feuille',
    description: 'Totaux heures/trajet/RTT',
    category: 'temps',
    icon: Timer,
    defaultSize: 'medium',
    minW: 2, minH: 1, defaultW: 2, defaultH: 2,
  },

  // === VEHICULE ===
  {
    id: 'vehicle-info',
    name: 'Mon véhicule',
    description: 'Infos véhicule assigné + kilométrage',
    category: 'vehicule',
    icon: Car,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 2, defaultH: 1,
  },
  {
    id: 'vehicle-maintenance',
    name: 'Entretien véhicule',
    description: 'Prochaine révision/CT',
    category: 'vehicule',
    icon: Car,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },

  // === GRAPHIQUES ===
  {
    id: 'chart-activity',
    name: 'Activité 7 jours',
    description: 'Graphique interventions par jour',
    category: 'graphiques',
    icon: BarChart3,
    defaultSize: 'large',
    minW: 3, minH: 2, defaultW: 4, defaultH: 2,
  },
  {
    id: 'chart-types',
    name: 'Répartition types',
    description: 'Camembert types de travaux',
    category: 'graphiques',
    icon: PieChart,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  {
    id: 'chart-team',
    name: 'Performance équipe',
    description: 'Comparatif techniciens (chef d\'équipe)',
    category: 'graphiques',
    icon: Users,
    defaultSize: 'large',
    minW: 3, minH: 2, defaultW: 4, defaultH: 2,
  },

  // === UTILITAIRES ===
  {
    id: 'weather',
    name: 'Météo',
    description: 'Prévisions locales',
    category: 'utilitaires',
    icon: CloudSun,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },
  {
    id: 'clock',
    name: 'Horloge',
    description: 'Date/heure avec semaine ISO',
    category: 'utilitaires',
    icon: Clock,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 1, defaultH: 1,
  },
  {
    id: 'quick-links',
    name: 'Liens rapides',
    description: 'Raccourcis vers modules favoris',
    category: 'utilitaires',
    icon: Link,
    defaultSize: 'small',
    minW: 1, minH: 1, defaultW: 2, defaultH: 1,
  },
  {
    id: 'checklist',
    name: 'Checklist du jour',
    description: 'Todo list personnelle',
    category: 'utilitaires',
    icon: CheckSquare,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 2,
  },
  // === SYNERGIES ===
  {
    id: 'technicien-dashboard',
    name: 'Mon tableau de bord',
    description: 'Vue personnalisée: visites, stock, heures, véhicule',
    category: 'stats',
    icon: Zap,
    defaultSize: 'large',
    minW: 3, minH: 3, defaultW: 4, defaultH: 4,
  },
  {
    id: 'alertes-stock-reappro',
    name: 'Alertes Stock',
    description: 'Articles sous seuil avec création demande réappro',
    category: 'stock',
    icon: AlertTriangle,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'suivi-vehicule',
    name: 'Suivi Véhicule',
    description: 'Alertes CT, vidange, pièces utilisées',
    category: 'vehicule',
    icon: Shield,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
  {
    id: 'planning-travaux',
    name: 'Travaux à planifier',
    description: 'Liste travaux sans date + vue planning',
    category: 'travaux',
    icon: Hammer,
    defaultSize: 'large',
    minW: 3, minH: 3, defaultW: 3, defaultH: 4,
  },
  {
    id: 'pieces-remplacees',
    name: 'Pièces remplacées',
    description: 'Dernières pièces remplacées sur les ascenseurs',
    category: 'stock',
    icon: Package,
    defaultSize: 'medium',
    minW: 2, minH: 2, defaultW: 2, defaultH: 3,
  },
];

// Layout par défaut pour les nouveaux utilisateurs
export const DEFAULT_LAYOUT: WidgetInstance[] = [
  { i: 'w1', type: 'stats-counters', x: 0, y: 0, w: 4, h: 1 },
  { i: 'w2', type: 'planning-today', x: 0, y: 1, w: 2, h: 3 },
  { i: 'w3', type: 'travaux-mine', x: 2, y: 1, w: 2, h: 3 },
  { i: 'w4', type: 'travaux-urgent', x: 4, y: 0, w: 2, h: 2 },
  { i: 'w5', type: 'hours-week', x: 4, y: 2, w: 1, h: 1 },
  { i: 'w6', type: 'chat-unread', x: 5, y: 2, w: 1, h: 1 },
  { i: 'w7', type: 'chart-activity', x: 0, y: 4, w: 4, h: 2 },
  { i: 'w8', type: 'checklist', x: 4, y: 3, w: 2, h: 2 },
];

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find(w => w.id === type);
}
