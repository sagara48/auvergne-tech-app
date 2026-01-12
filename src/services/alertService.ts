import { supabase } from './supabase';
import toast from 'react-hot-toast';

// Types d'alertes
export type AlertType = 
  | 'arret_critique'      // Arrêt > 72h
  | 'arret_warning'       // Arrêt > 24h
  | 'panne_bloquee'       // Panne avec personnes bloquées
  | 'panne_recurrente'    // Même panne répétée
  | 'stock_bas'           // Stock en dessous du seuil
  | 'visite_retard'       // Visite planifiée non réalisée
  | 'nouvelle_panne'      // Nouvelle panne détectée
  | 'sync_erreur'         // Erreur de synchronisation
  | 'note_echeance'       // Échéance de note proche/dépassée
  | 'note_rappel';        // Rappel programmé sur une note

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  data?: any;
  createdAt: Date;
  read: boolean;
  actionUrl?: string;
}

// Configuration des alertes
const ALERT_CONFIG = {
  arret_critique: { severity: 'critical' as const, icon: '🚨', sound: true },
  arret_warning: { severity: 'warning' as const, icon: '⚠️', sound: false },
  panne_bloquee: { severity: 'critical' as const, icon: '🆘', sound: true },
  panne_recurrente: { severity: 'warning' as const, icon: '🔄', sound: false },
  stock_bas: { severity: 'warning' as const, icon: '📦', sound: false },
  visite_retard: { severity: 'warning' as const, icon: '📅', sound: false },
  nouvelle_panne: { severity: 'info' as const, icon: '🔧', sound: false },
  sync_erreur: { severity: 'warning' as const, icon: '🔄', sound: false },
  note_echeance: { severity: 'warning' as const, icon: '⏰', sound: true },
  note_rappel: { severity: 'info' as const, icon: '🔔', sound: true },
};

// Store local des alertes (en mémoire)
let alerts: Alert[] = [];
let alertListeners: ((alerts: Alert[]) => void)[] = [];

// Notifier les listeners
const notifyListeners = () => {
  alertListeners.forEach(listener => listener([...alerts]));
};

// S'abonner aux alertes
export const subscribeToAlerts = (callback: (alerts: Alert[]) => void) => {
  alertListeners.push(callback);
  callback([...alerts]); // Envoyer les alertes actuelles
  
  return () => {
    alertListeners = alertListeners.filter(l => l !== callback);
  };
};

// Créer une alerte
export const createAlert = (
  type: AlertType,
  title: string,
  message: string,
  data?: any,
  actionUrl?: string
): Alert => {
  const config = ALERT_CONFIG[type];
  
  const alert: Alert = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity: config.severity,
    title: `${config.icon} ${title}`,
    message,
    data,
    createdAt: new Date(),
    read: false,
    actionUrl
  };
  
  // Ajouter au début de la liste
  alerts = [alert, ...alerts].slice(0, 100); // Garder max 100 alertes
  
  // Notification toast pour alertes critiques
  if (config.severity === 'critical') {
    toast.error(alert.title, {
      duration: 10000,
      icon: config.icon
    });
    
    // Jouer un son si configuré et supporté
    if (config.sound && 'Notification' in window) {
      playAlertSound();
    }
    
    // Notification push si permission accordée
    sendPushNotification(alert);
  } else if (config.severity === 'warning') {
    toast(alert.title, {
      duration: 5000,
      icon: config.icon
    });
  }
  
  notifyListeners();
  
  // Sauvegarder dans localStorage
  saveAlertsToStorage();
  
  return alert;
};

// Marquer une alerte comme lue
export const markAlertAsRead = (alertId: string) => {
  alerts = alerts.map(a => 
    a.id === alertId ? { ...a, read: true } : a
  );
  notifyListeners();
  saveAlertsToStorage();
};

// Marquer toutes les alertes comme lues
export const markAllAlertsAsRead = () => {
  alerts = alerts.map(a => ({ ...a, read: true }));
  notifyListeners();
  saveAlertsToStorage();
};

// Supprimer une alerte
export const dismissAlert = (alertId: string) => {
  alerts = alerts.filter(a => a.id !== alertId);
  notifyListeners();
  saveAlertsToStorage();
};

// Effacer toutes les alertes
export const clearAllAlerts = () => {
  alerts = [];
  notifyListeners();
  saveAlertsToStorage();
};

// Obtenir les alertes non lues
export const getUnreadAlerts = (): Alert[] => {
  return alerts.filter(a => !a.read);
};

// Obtenir le nombre d'alertes non lues
export const getUnreadCount = (): number => {
  return alerts.filter(a => !a.read).length;
};

// Sauvegarder dans localStorage
const saveAlertsToStorage = () => {
  try {
    localStorage.setItem('app_alerts', JSON.stringify(alerts));
  } catch (e) {
    console.warn('Erreur sauvegarde alertes:', e);
  }
};

// Charger depuis localStorage
export const loadAlertsFromStorage = () => {
  try {
    const stored = localStorage.getItem('app_alerts');
    if (stored) {
      alerts = JSON.parse(stored).map((a: any) => ({
        ...a,
        createdAt: new Date(a.createdAt)
      }));
      notifyListeners();
    }
  } catch (e) {
    console.warn('Erreur chargement alertes:', e);
  }
};

// Jouer un son d'alerte
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 200);
  } catch (e) {
    console.warn('Impossible de jouer le son:', e);
  }
};

// Envoyer une notification push
const sendPushNotification = async (alert: Alert) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(alert.title.replace(/^[^\s]+\s/, ''), {
      body: alert.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: alert.id,
      requireInteraction: alert.severity === 'critical'
    });
  }
};

// Demander la permission pour les notifications
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('Notifications non supportées');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// =============================================
// VÉRIFICATION AUTOMATIQUE DES ALERTES
// =============================================

export interface AlertCheckResult {
  arretsLongs: any[];
  pannesBloquees: any[];
  pannesRecurrentes: any[];
  stockBas: any[];
}

// Vérifier les conditions d'alerte
export const checkAlertConditions = async (
  ascenseurs: any[],
  arrets: any[],
  pannes: any[],
  stock?: any[]
): Promise<AlertCheckResult> => {
  const now = new Date();
  const result: AlertCheckResult = {
    arretsLongs: [],
    pannesBloquees: [],
    pannesRecurrentes: [],
    stockBas: []
  };
  
  // 1. Vérifier les arrêts longs
  arrets.forEach(arret => {
    const data = arret.data_warret || {};
    let dateArret: Date | null = null;
    
    if (data.DATE) {
      const ds = String(data.DATE);
      if (ds.length === 8) {
        dateArret = new Date(
          parseInt(ds.substring(0, 4)),
          parseInt(ds.substring(4, 6)) - 1,
          parseInt(ds.substring(6, 8))
        );
      }
    }
    
    if (dateArret) {
      const heures = Math.floor((now.getTime() - dateArret.getTime()) / (1000 * 60 * 60));
      
      if (heures > 72) {
        result.arretsLongs.push({ ...arret, heures, severity: 'critical' });
      } else if (heures > 24) {
        result.arretsLongs.push({ ...arret, heures, severity: 'warning' });
      }
    }
  });
  
  // 2. Vérifier les pannes avec personnes bloquées (dernières 24h)
  const hier = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  pannes.forEach(panne => {
    const data = panne.data_wpanne || {};
    const nombreBloque = data.NOMBRE || 0;
    
    if (nombreBloque > 0) {
      let datePanne: Date | null = null;
      if (data.DATE) {
        const ds = String(data.DATE);
        if (ds.length === 8) {
          datePanne = new Date(
            parseInt(ds.substring(0, 4)),
            parseInt(ds.substring(4, 6)) - 1,
            parseInt(ds.substring(6, 8))
          );
        }
      }
      
      if (datePanne && datePanne >= hier) {
        result.pannesBloquees.push({ ...panne, nombreBloque });
      }
    }
  });
  
  // 3. Détecter les pannes récurrentes (même ascenseur, même type, 3+ fois en 30 jours)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pannesRecentes = pannes.filter(p => {
    const data = p.data_wpanne || {};
    if (data.DATE) {
      const ds = String(data.DATE);
      if (ds.length === 8) {
        const d = new Date(
          parseInt(ds.substring(0, 4)),
          parseInt(ds.substring(4, 6)) - 1,
          parseInt(ds.substring(6, 8))
        );
        return d >= thirtyDaysAgo;
      }
    }
    return false;
  });
  
  // Grouper par ascenseur et type
  const groupedPannes: Record<string, number> = {};
  pannesRecentes.forEach(p => {
    const data = p.data_wpanne || {};
    const key = `${p.id_wsoucont}-${data.ENSEMBLE || data.PANNES || 'unknown'}`;
    groupedPannes[key] = (groupedPannes[key] || 0) + 1;
  });
  
  Object.entries(groupedPannes).forEach(([key, count]) => {
    if (count >= 3) {
      const [idWsoucont] = key.split('-');
      const asc = ascenseurs.find(a => String(a.id_wsoucont) === idWsoucont);
      result.pannesRecurrentes.push({
        id_wsoucont: idWsoucont,
        code_appareil: asc?.code_appareil || 'N/A',
        ville: asc?.ville || '',
        count,
        type: key.split('-').slice(1).join('-')
      });
    }
  });
  
  // 4. Vérifier le stock bas (si données fournies)
  if (stock) {
    stock.forEach(item => {
      if (item.quantite <= (item.seuil_alerte || 0)) {
        result.stockBas.push(item);
      }
    });
  }
  
  return result;
};

// Générer les alertes à partir des résultats de vérification
export const generateAlertsFromCheck = (result: AlertCheckResult, existingAlertIds: Set<string>) => {
  // Arrêts critiques
  result.arretsLongs
    .filter(a => a.severity === 'critical')
    .forEach(arret => {
      const alertId = `arret-${arret.id_wsoucont}`;
      if (!existingAlertIds.has(alertId)) {
        createAlert(
          'arret_critique',
          `Arrêt critique: ${arret.code_appareil || 'N/A'}`,
          `Ascenseur en arrêt depuis ${Math.floor(arret.heures / 24)} jours à ${arret.ville || 'N/A'}`,
          arret,
          '/?module=ascenseurs&tab=arrets'
        );
      }
    });
  
  // Pannes avec personnes bloquées
  result.pannesBloquees.forEach(panne => {
    const alertId = `bloque-${panne.id}`;
    if (!existingAlertIds.has(alertId)) {
      createAlert(
        'panne_bloquee',
        `URGENCE: ${panne.nombreBloque} personne(s) bloquée(s)`,
        `${panne.code_appareil || 'N/A'} - ${panne.adresse || ''}, ${panne.ville || ''}`,
        panne,
        '/?module=ascenseurs&tab=pannes'
      );
    }
  });
  
  // Pannes récurrentes
  result.pannesRecurrentes.forEach(item => {
    const alertId = `recurrent-${item.id_wsoucont}-${item.type}`;
    if (!existingAlertIds.has(alertId)) {
      createAlert(
        'panne_recurrente',
        `Panne récurrente: ${item.code_appareil}`,
        `${item.count} pannes "${item.type}" en 30 jours à ${item.ville}`,
        item,
        '/?module=ascenseurs'
      );
    }
  });
  
  // Stock bas
  result.stockBas.forEach(item => {
    const alertId = `stock-${item.id}`;
    if (!existingAlertIds.has(alertId)) {
      createAlert(
        'stock_bas',
        `Stock bas: ${item.designation || item.reference}`,
        `Quantité: ${item.quantite} (seuil: ${item.seuil_alerte})`,
        item,
        '/?module=stock'
      );
    }
  });
};

/**
 * Vérifier les rappels et échéances de notes
 */
export const checkNoteReminders = async (): Promise<void> => {
  try {
    const existingAlertIds = new Set(alerts.map(a => a.id.split('-').slice(0, 2).join('-')));
    
    // Récupérer les rappels dus (non envoyés et date passée)
    const { data: rappelsDus, error: errRappels } = await supabase
      .from('notes_rappels')
      .select(`
        *,
        note:notes(id, titre, technicien_id)
      `)
      .eq('envoye', false)
      .lte('date_rappel', new Date().toISOString())
      .order('date_rappel', { ascending: true });
    
    if (!errRappels && rappelsDus) {
      for (const rappel of rappelsDus) {
        const alertId = `rappel-${rappel.id}`;
        if (!existingAlertIds.has(alertId) && rappel.note) {
          createAlert(
            'note_rappel',
            `Rappel: ${rappel.note.titre}`,
            rappel.delai_minutes 
              ? `Échéance dans ${rappel.delai_minutes === 60 ? '1 heure' : rappel.delai_minutes === 1440 ? '1 jour' : rappel.delai_minutes === 10080 ? '1 semaine' : rappel.delai_minutes + ' min'}`
              : 'Il est temps de consulter cette note',
            { rappelId: rappel.id, noteId: rappel.note.id },
            '/?module=notes'
          );
          
          // Marquer le rappel comme envoyé
          await supabase
            .from('notes_rappels')
            .update({ envoye: true })
            .eq('id', rappel.id);
        }
      }
    }
    
    // Vérifier les échéances de notes proches
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: notesEcheance, error: errNotes } = await supabase
      .from('notes')
      .select('id, titre, echeance_date, statut')
      .not('echeance_date', 'is', null)
      .not('statut', 'in', '("terminee","archivee")')
      .lte('echeance_date', in24h.toISOString())
      .order('echeance_date', { ascending: true });
    
    if (!errNotes && notesEcheance) {
      for (const note of notesEcheance) {
        const echeance = new Date(note.echeance_date);
        const isDepassee = echeance < now;
        const alertId = `echeance-${note.id}`;
        
        if (!existingAlertIds.has(alertId)) {
          createAlert(
            'note_echeance',
            isDepassee ? `Échéance dépassée: ${note.titre}` : `Échéance proche: ${note.titre}`,
            isDepassee 
              ? `Cette note aurait dû être terminée le ${echeance.toLocaleDateString('fr-FR')}`
              : `Échéance le ${echeance.toLocaleDateString('fr-FR')} à ${echeance.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
            { noteId: note.id, echeance: note.echeance_date },
            '/?module=notes'
          );
        }
      }
    }
  } catch (error) {
    console.error('Erreur vérification rappels notes:', error);
  }
};

// Initialiser le service d'alertes
export const initAlertService = () => {
  loadAlertsFromStorage();
  requestNotificationPermission();
  
  // Vérifier les rappels de notes au démarrage et toutes les 5 minutes
  checkNoteReminders();
  setInterval(checkNoteReminders, 5 * 60 * 1000);
};
