'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Gère la création pour les actifs et la suppression pour les inactifs.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // On synchronise sur une plage de 12 mois en arrière et 12 mois en avant
  const rangeStart = addMonths(now, -12);
  const rangeEnd = addMonths(now, 12);

  for (const client of allUsers.filter(u => u.role !== 'super_admin')) {
    const isActive = client.subscriptionStatus !== 'inactive';
    
    // Si pas de date de création, on utilise la date par défaut
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;

    // On parcourt les mois pour créer ou supprimer
    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const dayLabel = format(checkDate, 'dd/MM/yyyy');
      
      const taskId = `billing_task_${client.uid}_${monthId}`;
      const eventId = `billing_event_${client.uid}_${monthId}`;
      
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', taskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', eventId);

      if (isActive) {
        // Création/Mise à jour uniquement si la date est pertinente (après création et dans notre plage)
        if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
          const eventDate = new Date(checkDate);
          eventDate.setHours(9, 0, 0, 0);

          const taskData: Partial<BusinessDocument> = {
            id: taskId,
            name: `Facture ${client.name} - Échéance du ${dayLabel}`,
            categoryId: 'finance',
            subCategory: 'Factures à envoyer',
            projectColumn: 'administrative',
            status: 'waiting_verification',
            createdAt: format(eventDate, 'dd/MM/yyyy'), // Date de l'échéance
            companyId: adminCompanyId,
            isBillingTask: true,
            billingMonthId: monthId,
            targetUserId: client.uid,
            fileUrl: ""
          };

          const eventData: Partial<CalendarEvent> = {
            id: eventId,
            id_externe: eventId,
            companyId: adminCompanyId,
            userId: adminUid,
            titre: `Facturation ${client.name}`,
            description: `Tâche administrative : Générer la facture pour ${client.companyName || client.companyId}. Période : ${monthLabel}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 30 * 60000).toISOString(),
            attendees: [client.email],
            source: 'local',
            type: 'event',
            derniere_maj: now.toISOString(),
            isBillingEvent: true
          };

          setDocumentNonBlocking(taskRef, taskData, { merge: true });
          setDocumentNonBlocking(eventRef, eventData, { merge: true });
        }
      } else {
        // SUPPRESSION si l'utilisateur est inactif
        deleteDocumentNonBlocking(taskRef);
        deleteDocumentNonBlocking(eventRef);
      }

      checkDate = addMonths(checkDate, 1);
    }
  }
}
