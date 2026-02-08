'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Version 4 : Nettoie les anciennes versions et garantit l'unicité par loginId.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // 1. Groupement robuste par identifiant (comme dans le répertoire)
  const userGroups = new Map<string, User[]>();
  allUsers.forEach(u => {
    const id = (u.loginId_lower || u.loginId?.toLowerCase() || '').trim();
    if (!id || u.role === 'super_admin') return;
    if (!userGroups.has(id)) userGroups.set(id, []);
    userGroups.get(id)!.push(u);
  });

  const uniqueClients = Array.from(userGroups.entries()).map(([id, docs]) => {
    const profileDoc = docs.find(d => d.isProfile === true);
    const baseDoc = profileDoc || docs[0];
    return baseDoc;
  }).sort((a, b) => (a.loginId || '').localeCompare(b.loginId || ''));

  // Plage : 3 mois en arrière et 12 mois en avant
  const rangeStart = addMonths(now, -3);
  const rangeEnd = addMonths(now, 12);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    // Répartition horaire (9h, 10h, 11h...) pour éviter les chevauchements
    const hourOffset = index % 8; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      
      const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
      
      // ID Actuel (v4)
      const currentTaskId = `billing_v4_${slug}_${monthId}`;
      const currentEventId = `event_v4_${slug}_${monthId}`;
      
      // RÉFÉRENCES
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', currentTaskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

      // --- NETTOYAGE DES ANCIENNES VERSIONS (v1, v2, v3) ---
      ['v1', 'v2', 'v3'].forEach(v => {
        const oldTaskId = `billing_${v}_${slug}_${monthId}`;
        const oldEventId = `event_${v}_${slug}_${monthId}`;
        deleteDocumentNonBlocking(doc(db, 'companies', adminCompanyId, 'documents', oldTaskId));
        deleteDocumentNonBlocking(doc(db, 'companies', adminCompanyId, 'events', oldEventId));
      });

      if (isActive) {
        if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
          const eventDate = new Date(checkDate);
          eventDate.setHours(9 + hourOffset, 0, 0, 0);

          const taskData: Partial<BusinessDocument> = {
            id: currentTaskId,
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
            id: currentEventId,
            id_externe: currentEventId,
            companyId: adminCompanyId,
            userId: adminUid,
            titre: `Facturation ${client.name || client.loginId}`,
            description: `Générer la facture pour ${client.companyName || 'Espace Privé'}. Période : ${monthLabel}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 45 * 60000).toISOString(),
            attendees: [client.email || ''],
            source: 'local',
            type: 'event',
            derniere_maj: now.toISOString(),
            isBillingEvent: true
          };

          setDocumentNonBlocking(taskRef, taskData, { merge: true });
          setDocumentNonBlocking(eventRef, eventData, { merge: true });
        }
      } else {
        deleteDocumentNonBlocking(taskRef);
        deleteDocumentNonBlocking(eventRef);
      }

      checkDate = addMonths(checkDate, 1);
    }
  });
}
