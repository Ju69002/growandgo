
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Gère la répartition des RDV dans la journée (9h-16h) et le nettoyage des inactifs.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // Plage : 12 mois en arrière et 24 mois en avant pour éviter l'arrêt des rappels
  const rangeStart = addMonths(now, -12);
  const rangeEnd = addMonths(now, 24);

  // Trier les clients pour une répartition stable des heures
  const clients = allUsers
    .filter(u => u.role !== 'super_admin')
    .sort((a, b) => a.uid.localeCompare(b.uid));

  clients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    // Répartition de l'heure : on décale de 1h par client (max 8 clients par jour avant de boucler)
    const hourOffset = index % 8; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const dayLabel = format(checkDate, 'dd/MM/yyyy');
      
      // Identifiants uniques pour éviter les doublons
      const taskId = `billing_v2_${client.uid}_${monthId}`;
      const eventId = `billing_event_v2_${client.uid}_${monthId}`;
      
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', taskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', eventId);

      if (isActive) {
        if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
          const eventDate = new Date(checkDate);
          eventDate.setHours(9 + hourOffset, 0, 0, 0);

          const taskData: Partial<BusinessDocument> = {
            id: taskId,
            name: `Facture ${client.name} - Échéance du ${dayLabel}`,
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
            titre: `Facturation ${client.name}`,
            description: `Tâche administrative : Générer la facture pour ${client.companyName || client.companyId}. Période : ${monthLabel}.`,
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
        // Nettoyage automatique pour les comptes inactifs
        deleteDocumentNonBlocking(taskRef);
        deleteDocumentNonBlocking(eventRef);
      }

      checkDate = addMonths(checkDate, 1);
    }
  });
}
