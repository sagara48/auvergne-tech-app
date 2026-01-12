import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Déclencher une synchronisation après reconnexion
        window.dispatchEvent(new CustomEvent('app:reconnected'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

// Hook pour mettre en cache les données pour usage offline
export function useOfflineCache(key: string, data: any) {
  useEffect(() => {
    if (data && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_DATA',
        key,
        data
      });
    }
    
    // Aussi stocker dans localStorage comme backup
    if (data) {
      try {
        localStorage.setItem(`offline_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Erreur stockage offline:', e);
      }
    }
  }, [key, data]);
}

// Récupérer les données offline
export function getOfflineData<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(`offline_${key}`);
    if (stored) {
      const { data, timestamp } = JSON.parse(stored);
      // Données valides pendant 24h
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return data as T;
      }
    }
  } catch (e) {
    console.warn('Erreur lecture offline:', e);
  }
  return null;
}
