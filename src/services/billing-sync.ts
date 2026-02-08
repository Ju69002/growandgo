
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation (Version V1).
 * Génère des tâches et RDV récurrents mensuels sur 12 mois.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "growandgo";
  const now = new Date();
  const todayStr = format(now, 'dd/MM/yyyy');

  // Filtrer pour n'avoir qu'un seul profil par utilisateur
  const uniqueUsersMap = new Map<string, User>();
  allUsers.forEach(u => {
    const id = (u.loginId_lower || u.loginId?.toLowerCase() || '').trim();
    if (!id || u.role === 'super_admin') return;
    
    if (!uniqueUsersMap.has(id) || u.isProfile) {
      uniqueUsersMap.set(id, u);
    }
  });

  const uniqueClients = Array.from(uniqueUsersMap.values());

  // Plage de facturation : mois dernier jusqu'à 12 mois dans le futur
  const rangeStart = addMonths(now, -1);
  const rangeEnd = addMonths(now, 12);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    let checkDate = rangeStart;
    
    // Décalage pour répartir les RDV dans la semaine
    const hourOffset = index % 10; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
      
      // Identifiants Version V1 stables
      const currentTaskId = `billing_v1_${slug}_${monthId}`;
      const currentEventId = `event_v1_${slug}_${monthId}`;
      
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', currentTaskId);
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

      if (isActive) {
        // Pour l'agenda, on place le RDV au jour 8 du mois concerné (ou aujourd'hui pour le mois en cours)
        const eventDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), 8);
        if (isSameDay(checkDate, now)) {
           // Pour le mois en cours, on s'assure que c'est visible cette semaine
           eventDate.setTime(now.getTime());
        }
        eventDate.setHours(8 + hourOffset, 0, 0, 0);

        // Tâche : Titre clair orienté action
        setDocumentNonBlocking(taskRef, {
          id: currentTaskId,
          name: `Générer facture pour ${client.name || client.loginId} - ${monthLabel}`,
          categoryId: 'finance',
          subCategory: 'Factures à envoyer',
          status: 'waiting_verification',
          createdAt: todayStr, // Permet l'affichage dans "Tâches de la semaine"
          companyId: adminCompanyId,
          isBillingTask: true,
          billingMonthId: monthId,
          targetUserId: client.uid,
          fileUrl: ""
        }, { merge: true });

        // Événement Agenda : Titre condensé, instruction en note
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
      
      checkDate = addMonths(checkDate, 1);
    }
  });
}
