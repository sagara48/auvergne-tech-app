// src/services/notificationService.ts
import { supabase } from './supabase';

export interface Notification {
  id: string;
  technicien_id: string;
  titre: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lu: boolean;
  icone?: string;
  lien?: string;
  created_at: string;
}

// Récupérer les notifications non lues
export async function getUnreadNotifications(technicienId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('technicien_id', technicienId)
    .eq('lu', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

// Récupérer toutes les notifications
export async function getAllNotifications(technicienId: string, limit = 100): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('technicien_id', technicienId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Marquer comme lu
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ lu: true })
    .eq('id', notificationId);

  if (error) throw error;
}

// Marquer toutes comme lues
export async function markAllAsRead(technicienId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ lu: true })
    .eq('technicien_id', technicienId)
    .eq('lu', false);

  if (error) throw error;
}

// Créer une notification
export async function createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'lu'>): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      ...notification,
      lu: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Supprimer une notification
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

// Supprimer les anciennes notifications
export async function cleanOldNotifications(technicienId: string, daysOld = 30): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('technicien_id', technicienId)
    .eq('lu', true)
    .lt('created_at', cutoffDate.toISOString());

  if (error) throw error;
}

// Helper pour créer différents types de notifications
export const notificationHelpers = {
  panne: async (technicienId: string, ascenseurCode: string, message: string) => {
    return createNotification({
      technicien_id: technicienId,
      titre: `🚨 Panne ${ascenseurCode}`,
      message,
      type: 'error',
      priority: 'urgent',
      icone: '🚨',
      lien: `/parc?code=${ascenseurCode}`,
    });
  },

  travaux: async (technicienId: string, travauxCode: string, message: string) => {
    return createNotification({
      technicien_id: technicienId,
      titre: `🔧 Travaux ${travauxCode}`,
      message,
      type: 'info',
      priority: 'normal',
      icone: '🔧',
      lien: `/travaux?code=${travauxCode}`,
    });
  },

  stock: async (technicienId: string, articleRef: string, message: string) => {
    return createNotification({
      technicien_id: technicienId,
      titre: `📦 Stock ${articleRef}`,
      message,
      type: 'warning',
      priority: 'high',
      icone: '📦',
      lien: `/stock`,
    });
  },

  message: async (technicienId: string, senderName: string, message: string) => {
    return createNotification({
      technicien_id: technicienId,
      titre: `💬 Message de ${senderName}`,
      message,
      type: 'info',
      priority: 'normal',
      icone: '💬',
      lien: `/chat`,
    });
  },
};
