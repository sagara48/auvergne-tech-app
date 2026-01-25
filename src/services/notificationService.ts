// src/services/notificationService.ts
// Service unifié pour la gestion des notifications cross-modules

import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================================
// TYPES
// =============================================
export type NotificationType = 
  | 'panne' 
  | 'travaux' 
  | 'mise_service' 
  | 'stock' 
  | 'message' 
  | 'planning' 
  | 'note' 
  | 'system'
  | 'vehicule'
  | 'demande'
  | 'feuille_heures';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationParams {
  technicienId?: string; // ID du technicien destinataire
  type: NotificationType;
  priority?: NotificationPriority;
  titre: string;
  message?: string;
  icone?: string;
  lien?: string;
  metadata?: Record<string, any>;
}

export interface NotificationConfig {
  type: NotificationType;
  icon: string;
  color: string;
  label: string;
}

// =============================================
// CONFIGURATION DES TYPES
// =============================================
export const NOTIFICATION_CONFIGS: Record<NotificationType, NotificationConfig> = {
  panne: { type: 'panne', icon: '🚨', color: '#ef4444', label: 'Panne' },
  travaux: { type: 'travaux', icon: '🔧', color: '#a855f7', label: 'Travaux' },
  mise_service: { type: 'mise_service', icon: '📋', color: '#f97316', label: 'Mise en service' },
  stock: { type: 'stock', icon: '📦', color: '#f59e0b', label: 'Stock' },
  message: { type: 'message', icon: '💬', color: '#8b5cf6', label: 'Message' },
  planning: { type: 'planning', icon: '📅', color: '#3b82f6', label: 'Planning' },
  note: { type: 'note', icon: '📝', color: '#eab308', label: 'Note' },
  system: { type: 'system', icon: 'ℹ️', color: '#6b7280', label: 'Système' },
  vehicule: { type: 'vehicule', icon: '🚐', color: '#06b6d4', label: 'Véhicule' },
  demande: { type: 'demande', icon: '📩', color: '#ec4899', label: 'Demande' },
  feuille_heures: { type: 'feuille_heures', icon: '⏱️', color: '#10b981', label: 'Heures' },
};

// =============================================
// SERVICE PRINCIPAL
// =============================================
class NotificationService {
  // Créer une notification
  async create(params: CreateNotificationParams): Promise<string | null> {
    try {
      let technicienId = params.technicienId;
      
      if (!technicienId) {
        // Récupérer le technicien connecté
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: tech } = await supabase
            .from('techniciens')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          technicienId = tech?.id || user.id;
        } else if (user?.id) {
          technicienId = user.id;
        }
      }

      if (!technicienId) {
        console.error('NotificationService: Aucun destinataire pour la notification');
        return null;
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          technicien_id: technicienId,
          type: params.type,
          priority: params.priority || 'normal',
          titre: params.titre,
          message: params.message,
          icone: params.icone || NOTIFICATION_CONFIGS[params.type]?.icon,
          lien: params.lien,
          lue: false,
          metadata: params.metadata,
        })
        .select('id')
        .single();

      if (error) {
        console.error('NotificationService: Erreur création', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('NotificationService: Exception', error);
      return null;
    }
  }

  // Créer une notification pour plusieurs techniciens
  async createForTechniciens(technicienIds: string[], params: Omit<CreateNotificationParams, 'technicienId'>): Promise<void> {
    const notifications = technicienIds.map(technicienId => ({
      technicien_id: technicienId,
      type: params.type,
      priority: params.priority || 'normal',
      titre: params.titre,
      message: params.message,
      icone: params.icone || NOTIFICATION_CONFIGS[params.type]?.icon,
      lien: params.lien,
      lue: false,
      metadata: params.metadata,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      console.error('NotificationService: Erreur création multiple', error);
    }
  }

  // Créer une notification pour tous les admins
  async notifyAdmins(params: Omit<CreateNotificationParams, 'technicienId'>): Promise<void> {
    // Récupérer les admins
    const { data: admins } = await supabase
      .from('techniciens')
      .select('id, role:roles(code)')
      .or('role.code.eq.admin,role.code.eq.superadmin,role.code.eq.administrateur');

    const adminIds = (admins || [])
      .filter((a: any) => a.role?.code)
      .map((a: any) => a.id);

    if (adminIds.length > 0) {
      await this.createForTechniciens(adminIds, params);
    }
  }

  // =============================================
  // NOTIFICATIONS PRÉDÉFINIES
  // =============================================

  // Stock bas sur véhicule
  async notifyStockBas(vehiculeImmat: string, articlesCount: number, technicienId?: string): Promise<void> {
    const params: CreateNotificationParams = {
      technicienId,
      type: 'stock',
      priority: articlesCount > 5 ? 'high' : 'normal',
      titre: `Stock bas - ${vehiculeImmat}`,
      message: `${articlesCount} article(s) en dessous du seuil d'alerte`,
      metadata: { vehicule_immatriculation: vehiculeImmat, articles_count: articlesCount },
    };

    if (technicienId) {
      await this.create(params);
    }
    // Notifier aussi les admins
    await this.notifyAdmins(params);
  }

  // Nouvelle panne assignée
  async notifyNouvellePanne(codeAppareil: string, technicienId: string, panneId: string): Promise<void> {
    await this.create({
      technicienId,
      type: 'panne',
      priority: 'high',
      titre: `Nouvelle panne - ${codeAppareil}`,
      message: 'Une panne vous a été assignée',
      lien: `/parc?panne=${panneId}`,
      metadata: { code_appareil: codeAppareil, panne_id: panneId },
    });
  }

  // Travaux planifié
  async notifyTravauxPlanifie(travauxCode: string, date: string, technicienId: string): Promise<void> {
    await this.create({
      technicienId,
      type: 'travaux',
      priority: 'normal',
      titre: `Travaux planifié - ${travauxCode}`,
      message: `Planifié le ${format(new Date(date), 'dd/MM/yyyy', { locale: fr })}`,
      metadata: { travaux_code: travauxCode, date },
    });
  }

  // Visite planifiée demain
  async notifyVisiteDemain(technicienId: string, visitesCount: number): Promise<void> {
    await this.create({
      technicienId,
      type: 'planning',
      priority: 'normal',
      titre: 'Visites demain',
      message: `${visitesCount} visite(s) planifiée(s) pour demain`,
      lien: '/planning',
      metadata: { visites_count: visitesCount },
    });
  }

  // Alerte véhicule (CT, vidange, etc.)
  async notifyAlerteVehicule(
    technicienId: string, 
    vehiculeImmat: string, 
    typeAlerte: 'ct' | 'vidange' | 'revision',
    joursRestants: number
  ): Promise<void> {
    const labels = {
      ct: 'Contrôle technique',
      vidange: 'Vidange',
      revision: 'Révision',
    };

    await this.create({
      technicienId,
      type: 'vehicule',
      priority: joursRestants <= 7 ? 'urgent' : joursRestants <= 15 ? 'high' : 'normal',
      titre: `${labels[typeAlerte]} - ${vehiculeImmat}`,
      message: joursRestants <= 0 
        ? `En retard !`
        : `Dans ${joursRestants} jour(s)`,
      metadata: { vehicule_immatriculation: vehiculeImmat, type_alerte: typeAlerte, jours_restants: joursRestants },
    });
  }

  // Demande de réappro créée
  async notifyDemandeReappro(vehiculeImmat: string, articlesCount: number): Promise<void> {
    await this.notifyAdmins({
      type: 'demande',
      priority: 'normal',
      titre: `Demande réappro - ${vehiculeImmat}`,
      message: `${articlesCount} article(s) demandé(s)`,
      lien: '/demandes',
      metadata: { vehicule_immatriculation: vehiculeImmat, articles_count: articlesCount },
    });
  }

  // Feuille d'heures à valider
  async notifyFeuilleHeuresAValider(technicienNom: string, semaine: number): Promise<void> {
    await this.notifyAdmins({
      type: 'feuille_heures',
      priority: 'normal',
      titre: 'Feuille d\'heures à valider',
      message: `${technicienNom} - Semaine ${semaine}`,
      lien: '/feuille-heures',
      metadata: { technicien_nom: technicienNom, semaine },
    });
  }

  // Document à signer
  async notifyDocumentASigner(documentNom: string, technicienId: string): Promise<void> {
    await this.create({
      technicienId,
      type: 'system',
      priority: 'normal',
      titre: 'Document à signer',
      message: documentNom,
      lien: '/ged',
      metadata: { document_nom: documentNom },
    });
  }

  // Nouvelle note partagée
  async notifyNouvelleNote(noteId: string, titre: string, destinataireIds: string[]): Promise<void> {
    await this.createForTechniciens(destinataireIds, {
      type: 'note',
      priority: 'low',
      titre: 'Nouvelle note partagée',
      message: titre,
      lien: `/notes?id=${noteId}`,
      metadata: { note_id: noteId },
    });
  }

  // Message reçu
  async notifyNouveauMessage(expediteurNom: string, destinataireId: string, conversationId: string): Promise<void> {
    await this.create({
      technicienId: destinataireId,
      type: 'message',
      priority: 'normal',
      titre: `Message de ${expediteurNom}`,
      message: 'Vous avez reçu un nouveau message',
      lien: `/chat?conversation=${conversationId}`,
      metadata: { conversation_id: conversationId },
    });
  }
}

// Export singleton
export const notificationService = new NotificationService();

// =============================================
// HOOK REACT
// =============================================
import { useCallback } from 'react';

export function useNotifications() {
  const create = useCallback(async (params: CreateNotificationParams) => {
    return notificationService.create(params);
  }, []);

  const notifyStockBas = useCallback(async (
    vehiculeImmat: string, 
    articlesCount: number, 
    technicienId?: string
  ) => {
    return notificationService.notifyStockBas(vehiculeImmat, articlesCount, technicienId);
  }, []);

  const notifyNouvellePanne = useCallback(async (
    codeAppareil: string, 
    technicienId: string, 
    panneId: string
  ) => {
    return notificationService.notifyNouvellePanne(codeAppareil, technicienId, panneId);
  }, []);

  const notifyTravauxPlanifie = useCallback(async (
    travauxCode: string, 
    date: string, 
    technicienId: string
  ) => {
    return notificationService.notifyTravauxPlanifie(travauxCode, date, technicienId);
  }, []);

  const notifyAlerteVehicule = useCallback(async (
    technicienId: string,
    vehiculeImmat: string,
    typeAlerte: 'ct' | 'vidange' | 'revision',
    joursRestants: number
  ) => {
    return notificationService.notifyAlerteVehicule(technicienId, vehiculeImmat, typeAlerte, joursRestants);
  }, []);

  return {
    create,
    notifyStockBas,
    notifyNouvellePanne,
    notifyTravauxPlanifie,
    notifyAlerteVehicule,
    notifyAdmins: notificationService.notifyAdmins.bind(notificationService),
    notifyDemandeReappro: notificationService.notifyDemandeReappro.bind(notificationService),
    notifyFeuilleHeuresAValider: notificationService.notifyFeuilleHeuresAValider.bind(notificationService),
    notifyDocumentASigner: notificationService.notifyDocumentASigner.bind(notificationService),
    notifyNouvelleNote: notificationService.notifyNouvelleNote.bind(notificationService),
    notifyNouveauMessage: notificationService.notifyNouveauMessage.bind(notificationService),
  };
}

export default notificationService;
