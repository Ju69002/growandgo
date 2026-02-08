
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Parcourt les utilisateurs et crée des tâches/événements manquants à la date anniversaire.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // Filtrer les utilisateurs actifs (hors admin)
  const activeClients = allUsers.filter(u => 
    u.role !== 'super_admin' && 
    u.subscriptionStatus !== 'inactive'
  );

  for (const client of activeClients) {
    // Si pas de date de création, on utilise la date par défaut du projet
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    
    if (!isValid(startDate)) {
      startDate = new Date(2026, 1, 8);
    }

    // On commence à la date de création exacte
    let checkDate = startDate;
    // On synchronise jusqu'à 1 mois dans le futur pour prévoir l'échéance suivante
    const limitDate = addMonths(now, 1);

    while (isBefore(checkDate, limitDate)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const dayLabel = format(checkDate, 'dd/MM/yyyy');
      
      const taskId = `billing_task_${client.uid}_${monthId}`;
      const eventId = `billing_event_${client.uid}_${monthId}`;

      // 1. Création de la tâche dans le tableau de bord Admin
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', taskId);
      const taskData: Partial<BusinessDocument> = {
        id: taskId,
        name: `Facture ${client.name} - Échéance du ${dayLabel}`,
        categoryId: 'finance',
        subCategory: 'Factures à envoyer',
        projectColumn: 'administrative',
        status: 'waiting_verification',
        createdAt: format(now, 'dd/MM/yyyy'),
        companyId: adminCompanyId,
        isBillingTask: true,
        billingMonthId: monthId,
        targetUserId: client.uid,
        fileUrl: ""
      };

      // 2. Création du rendez-vous dans l'agenda à la date anniversaire
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', eventId);
      const eventDate = new Date(checkDate);
      eventDate.setHours(9, 0, 0, 0); // RDV à 9h le jour anniversaire

      const eventData: Partial<CalendarEvent> = {
        id: eventId,
        id_externe: eventId,
        companyId: adminCompanyId,
        userId: adminUid,
        titre: `Facturation ${client.name}`,
        description: `Tâche administrative : Générer la facture pour ${client.companyName || client.companyId}. Période : ${monthLabel}.`,
        debut: eventDate.toISOString(),
        fin: new Date(eventDate.getTime() + 30 * 60000).toISOString(), // 30 mins
        attendees: [client.email],
        source: 'local',
        type: 'event',
        derniere_maj: now.toISOString(),
        isBillingEvent: true
      };

      setDocumentNonBlocking(taskRef, taskData, { merge: true });
      setDocumentNonBlocking(eventRef, eventData, { merge: true });

      checkDate = addMonths(checkDate, 1);
    }
  }
}
