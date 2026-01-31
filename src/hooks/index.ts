export { useFeuilleHeures } from './useFeuilleHeures';
export { useRealtimeSubscriptions, useRealtimeTable } from './useRealtimeSubscriptions';
export { useOnlineStatus, useOfflineCache, getOfflineData } from './useOnlineStatus';

// Hooks centralisés
export * from './useCentralizedHooks';

// Temps réel
export {
  useRealtimeQuery,
  useRealtimeStatus,
  useRealtimePannes,
  useRealtimeTravaux,
  useRealtimeStock,
  useRealtimePlanning,
  useRealtimeCommandes,
  useRealtimeVehicules,
  useRealtimeNotes,
  useRealtimeDocuments,
  useRealtimeNotifications,
  useRealtimeAscenseurs,
  useRealtimeVisites,
  useRealtimeStats,
  RealtimeProvider,
  RealtimeIndicator,
} from './useRealtime';

// Temps réel global
export {
  useGlobalRealtime,
  RealtimeStatusWidget,
} from './useGlobalRealtime';
