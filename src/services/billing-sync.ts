
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Gère la répartition des RDV dans la journée (9h-16h) et garantit l'unicité par loginId.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // On ne garde que les PROFILS uniques basés sur le loginId pour éviter les doublons de session
  const uniqueClients = Array.from(
    new Map(
      allUsers
        .filter(u => u.isProfile && u.role !== 'super_admin')
        .map(u => [u.loginId?.toLowerCase(), u])
    ).values()
  ).sort((a, b) => (a.loginId || '').localeCompare(b.loginId || ''));

  // Plage : 6 mois en arrière et 12 mois en avant (plus léger et suffisant)
  const rangeStart = addMonths(now, -6);
  const rangeEnd = addMonths(now, 12);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    // Répartition horaire stable (9h, 10h, 11h...)
    const hourOffset = index % 8; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const dayLabel = format(checkDate, 'dd/MM/yyyy');
      
      // V3 : Identifiant basé sur le loginId pour une stabilité totale
      const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
      const taskId = `billing_v3_${slug}_${monthId}`;
      const eventId = `event_v3_${slug}_${monthId}`;
      
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', taskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', eventId);

      if (isActive) {
        // On ne crée que si on est dans la plage de temps
        if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
          const eventDate = new Date(checkDate);
          eventDate.setHours(9 + hourOffset, 0, 0, 0);

          const taskData: Partial<BusinessDocument> = {
            id: taskId,
            name: `Facture ${client.name || client.loginId} - ${monthLabel}`,
            categoryId: 'finance',
            subCategory: 'Factures à envoyer',
            projectColumn: 'administrative',
            status: 'waiting_verification',
            createdAt: format(eventDate, 'dd/MM/yyyy'),
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
            titre: `Facturation ${client.name || client.loginId}`,
            description: `Générer la facture pour ${client.companyName || 'Espace Privé'}. Période : ${monthLabel}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 45 * 60000).toISOString(),
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
        // Suppression si inactif
        deleteDocumentNonBlocking(taskRef);
        deleteDocumentNonBlocking(eventRef);
      }

      checkDate = addMonths(checkDate, 1);
    }
  });
}
