
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service optimisé pour synchroniser les tâches de facturation.
 * Limite les écritures Firestore pour plus de fluidité.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // 1. Déduplication par identifiant technique (comme dans le répertoire)
  const uniqueUsersMap = new Map<string, User>();
  allUsers.forEach(u => {
    const id = (u.loginId_lower || u.loginId?.toLowerCase() || '').trim();
    if (!id || u.role === 'super_admin') return;
    
    // Priorité au document de profil réel
    if (!uniqueUsersMap.has(id) || u.isProfile) {
      uniqueUsersMap.set(id, u);
    }
  });

  const uniqueClients = Array.from(uniqueUsersMap.values())
    .sort((a, b) => (a.loginId || '').localeCompare(b.loginId || ''));

  // Plage réduite pour la fluidité : 1 mois arrière, 6 mois avant
  const rangeStart = addMonths(now, -1);
  const rangeEnd = addMonths(now, 6);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    // Répartition horaire fixe pour la stabilité
    const hourOffset = index % 7; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
      
      const currentTaskId = `billing_v4_${slug}_${monthId}`;
      const currentEventId = `event_v4_${slug}_${monthId}`;
      
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', currentTaskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

      if (isActive && (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart))) {
        const eventDate = new Date(checkDate);
        eventDate.setHours(9 + hourOffset, 0, 0, 0);

        // Mise à jour uniquement si nécessaire (optimisme Firestore)
        setDocumentNonBlocking(taskRef, {
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
        }, { merge: true });

        setDocumentNonBlocking(eventRef, {
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
        }, { merge: true });
      } else if (!isActive) {
        deleteDocumentNonBlocking(taskRef);
        deleteDocumentNonBlocking(eventRef);
      }

      checkDate = addMonths(checkDate, 1);
    }
  });
}
