
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, parseISO, isValid, isAfter, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation (Version V1).
 * Utilise des identifiants harmonisés et des instructions directes.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  // On utilise growandgo en minuscule pour la cohérence
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

  // Plage de facturation : mois dernier, mois en cours, 2 mois prochains
  const rangeStart = addMonths(now, -1);
  const rangeEnd = addMonths(now, 2);

  uniqueClients.forEach((client, index) => {
    const isActive = client.subscriptionStatus !== 'inactive';
    const creationDateStr = client.createdAt || now.toISOString();
    let startDate = parseISO(creationDateStr);
    if (!isValid(startDate)) startDate = new Date(2026, 1, 8);

    let checkDate = startDate;
    // Décalage pour ne pas avoir tous les RDV à la même heure
    const hourOffset = index % 10; 

    while (isBefore(checkDate, rangeEnd)) {
      if (isAfter(checkDate, rangeStart) || isSameDay(checkDate, rangeStart)) {
        const monthId = format(checkDate, 'yyyy-MM');
        const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
        const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
        
        // Identifiants Version V1 stables
        const currentTaskId = `billing_v1_${slug}_${monthId}`;
        const currentEventId = `event_v1_${slug}_${monthId}`;
        
        const taskRef = doc(db, 'companies', adminCompanyId, 'documents', currentTaskId);
        const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

        if (isActive) {
          // On force la date de création à AUJOURD'HUI pour qu'elles soient dans la vue "semaine"
          const eventDate = new Date(now);
          eventDate.setHours(8 + hourOffset, 0, 0, 0);

          // Tâche de facturation : Titre clair et instruction directe
          setDocumentNonBlocking(taskRef, {
            id: currentTaskId,
            name: `Générer facture pour ${client.name || client.loginId} - ${monthLabel}`,
            categoryId: 'finance',
            subCategory: 'Factures à envoyer',
            status: 'waiting_verification',
            createdAt: todayStr, // Date du jour pour le filtre hebdomadaire
            companyId: adminCompanyId,
            isBillingTask: true,
            billingMonthId: monthId,
            targetUserId: client.uid,
            fileUrl: ""
          }, { merge: true });

          // Événement dans l'agenda : Titre court, instruction complète en note
          setDocumentNonBlocking(eventRef, {
            id: currentEventId,
            id_externe: currentEventId,
            companyId: adminCompanyId,
            userId: adminUid,
            titre: `Facture - ${client.name || client.loginId}`,
            description: `Note : Générer la facture pour le client ${client.name || client.loginId}.`,
            debut: eventDate.toISOString(),
            fin: new Date(eventDate.getTime() + 45 * 60000).toISOString(),
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
