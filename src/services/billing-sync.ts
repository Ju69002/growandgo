'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation.
 * Génère des instructions claires pour l'administrateur.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  const uniqueUsersMap = new Map<string, User>();
  allUsers.forEach(u => {
    const id = (u.loginId_lower || u.loginId?.toLowerCase() || '').trim();
    if (!id || u.role === 'super_admin') return;
    
    if (!uniqueUsersMap.has(id) || u.isProfile) {
      uniqueUsersMap.set(id, u);
    }
  });

  const uniqueClients = Array.from(uniqueUsersMap.values());

  const rangeStart = addMonths(now, -1);
  const rangeEnd = addMonths(now, 3);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    const hourOffset = index % 8; 

    while (isBefore(checkDate, rangeEnd)) {
      if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
        const monthId = format(checkDate, 'yyyy-MM');
        const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
        const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
        
        const currentTaskId = `billing_v4_${slug}_${monthId}`;
        const currentEventId = `event_v4_${slug}_${monthId}`;
        
        const taskRef = doc(db, 'companies', adminCompanyId, 'documents', currentTaskId);
        const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

        if (isActive) {
          const eventDate = new Date(checkDate);
          eventDate.setHours(9 + hourOffset, 0, 0, 0);

          // Tâche : Instruction directe pour l'admin
          setDocumentNonBlocking(taskRef, {
            id: currentTaskId,
            name: `Générer facture pour ${client.name || client.loginId} - ${monthLabel}`,
            categoryId: 'finance',
            subCategory: 'Factures à envoyer',
            status: 'waiting_verification',
            createdAt: format(eventDate, 'dd/MM/yyyy'),
            companyId: adminCompanyId,
            isBillingTask: true,
            billingMonthId: monthId,
            targetUserId: client.uid,
            fileUrl: ""
          }, { merge: true });

          // Événement : Titre condensé et instruction complète en note
          setDocumentNonBlocking(eventRef, {
            id: currentEventId,
            id_externe: currentEventId,
            companyId: adminCompanyId,
            userId: adminUid,
            titre: `Facture - ${client.name || client.loginId}`,
            description: `Note : Générer la facture pour le client ${client.name || client.loginId}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 60 * 60000).toISOString(),
            attendees: [client.email || ''],
            source: 'local',
            type: 'event',
            derniere_maj: now.toISOString(),
            isBillingEvent: true
          }, { merge: true });
        }
      }
      checkDate = addMonths(checkDate, 1);
    }
  });
}
