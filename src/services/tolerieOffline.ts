// ═══════════════════════════════════════════════════════════════
// STOCKAGE HORS-LIGNE — IndexedDB + File d'attente de sync
// Feature 53: Mode hors-ligne complet
// ═══════════════════════════════════════════════════════════════

import type { PieceConfig } from './tolerie';

const DB_NAME = 'auvergnetech-tolerie';
const DB_VERSION = 1;
const STORE_PIECES = 'pieces';
const STORE_QUEUE = 'sync_queue';

// ═══ IndexedDB helpers ═══

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PIECES)) {
        db.createObjectStore(STORE_PIECES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'queueId', autoIncrement: true });
        qs.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

// ═══ Offline CRUD ═══

export async function savePieceOffline(piece: PieceConfig): Promise<void> {
  const toSave = { ...piece, id: piece.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, _offline: true, _dirty: true };
  await tx(STORE_PIECES, 'readwrite', s => s.put(toSave));
}

export async function getPiecesOffline(): Promise<PieceConfig[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE_PIECES, 'readonly');
    const req = t.objectStore(STORE_PIECES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function getPieceOffline(id: string): Promise<PieceConfig | null> {
  try {
    return await tx(STORE_PIECES, 'readonly', s => s.get(id));
  } catch { return null; }
}

export async function deletePieceOffline(id: string): Promise<void> {
  await tx(STORE_PIECES, 'readwrite', s => s.delete(id));
}

// ═══ Sync Queue ═══

interface SyncQueueItem {
  queueId?: number;
  action: 'create' | 'update' | 'delete';
  pieceId: string;
  data?: PieceConfig;
  timestamp: number;
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'queueId' | 'timestamp'>): Promise<void> {
  await tx(STORE_QUEUE, 'readwrite', s => s.add({ ...item, timestamp: Date.now() }));
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE_QUEUE, 'readonly');
    const req = t.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function clearSyncQueue(): Promise<void> {
  await tx(STORE_QUEUE, 'readwrite', s => s.clear());
}

// ═══ Synchronisation ═══

export async function syncWithServer(
  createFn: (p: PieceConfig) => Promise<PieceConfig>,
  updateFn: (id: string, p: Partial<PieceConfig>) => Promise<PieceConfig>,
  deleteFn: (id: string) => Promise<void>,
): Promise<{ synced: number; errors: number }> {
  const queue = await getSyncQueue();
  let synced = 0, errors = 0;

  for (const item of queue) {
    try {
      if (item.action === 'create' && item.data) {
        const serverPiece = await createFn(item.data);
        // Update local with server ID
        await deletePieceOffline(item.pieceId);
        await savePieceOffline({ ...item.data, id: serverPiece.id, _offline: false, _dirty: false } as any);
        synced++;
      } else if (item.action === 'update' && item.data) {
        await updateFn(item.pieceId, item.data);
        // Mark as clean
        const local = await getPieceOffline(item.pieceId);
        if (local) await savePieceOffline({ ...local, _dirty: false } as any);
        synced++;
      } else if (item.action === 'delete') {
        await deleteFn(item.pieceId);
        synced++;
      }
    } catch (err) {
      console.error('[Offline] Sync error:', err);
      errors++;
    }
  }

  if (synced > 0) await clearSyncQueue();

  return { synced, errors };
}

// ═══ Network detection ═══

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onNetworkChange(cb: (online: boolean) => void): () => void {
  const onOnline = () => cb(true);
  const onOffline = () => cb(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// ═══ Cache all pieces from server to IndexedDB ═══

export async function cacheAllPieces(pieces: PieceConfig[]): Promise<void> {
  const db = await openDB();
  const t = db.transaction(STORE_PIECES, 'readwrite');
  const store = t.objectStore(STORE_PIECES);
  pieces.forEach(p => store.put({ ...p, _offline: false, _dirty: false }));
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ═══ Dirty check ═══

export async function getDirtyPiecesCount(): Promise<number> {
  const pieces = await getPiecesOffline();
  return pieces.filter((p: any) => p._dirty).length;
}
