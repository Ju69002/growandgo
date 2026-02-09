
'use client';

import { Firestore, doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore } from 'date-fns';

/**
 * Service pour synchroniser les rendez-vous de facturation.
 * Ajout de try/catch et merge: true pour la stabilité totale.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  try {
    const adminCompanyId = "growandgo";
    const now = new Date();

    const uniqueUsersMap = new Map<string, User>();
    allUsers.forEach(u => {
      const id = (u.loginId_lower || u.loginId || u.uid || '').toLowerCase();
      if (!id || u.role === 'admin') return; // Ne pas facturer les admins
      if (!uniqueUsersMap.has(id) || u.isProfile) {
        uniqueUsersMap.set(id, u);
      }
    });

    const uniqueClients = Array.from(uniqueUsersMap.values());
    const rangeStart = addMonths(now, -1);
    const rangeEnd = addMonths(now, 12);

    uniqueClients.forEach((client, index) => {
      const isActive = client.subscriptionStatus !== 'inactive';
      let checkDate = rangeStart;
      const hourOffset = index % 8; 

      while (isBefore(checkDate, rangeEnd)) {
        const monthId = format(checkDate, 'yyyy-MM');
        const slug = (client.loginId_lower || client.loginId || client.uid || '').toLowerCase();
        if (!slug) {
          checkDate = addMonths(checkDate, 1);
          continue;
        }
        
        const currentEventId = `event_v1_${slug}_${monthId}`;
        const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

        if (isActive) {
          let eventDate;
          if (checkDate.getMonth() === now.getMonth() && checkDate.getFullYear() === now.getFullYear()) {
             eventDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          } else {
             eventDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), 8);
          }
          
          eventDate.setHours(9 + hourOffset, 0, 0, 0);

          setDocumentNonBlocking(eventRef, {
            id: currentEventId,
            id_externe: currentEventId,
            companyId: adminCompanyId,
            userId: adminUid,
            enterpriseId: 'admin_global',
            titre: `Facture - ${client.name || client.loginId}`,
            description: `Générer la facture pour le client ${client.name || client.loginId}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 60 * 60000).toISOString(),
            attendees: [client.email || ''],
            source: 'local',
            type: 'event',
            derniere_maj: now.toISOString(),
            isBillingEvent: true
          }, { merge: true });
        }
        
        checkDate = addMonths(checkDate, 1);
      }
    });
  } catch (error) {
    console.error("Billing Sync Error:", error);
  }
}
