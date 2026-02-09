
'use client';

import { Firestore, collection, doc } from 'firebase/firestore';
import { User, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, isBefore, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les rendez-vous de facturation (Version V1).
 * Génère uniquement des RDV récurrents mensuels sur 12 mois dans l'agenda.
 * Les tâches du dashboard seront déduites de ces événements.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "growandgo";
  const now = new Date();

  // Filtrer pour n'avoir qu'un seul profil par utilisateur
  const uniqueUsersMap = new Map<string, User>();
  allUsers.forEach(u => {
    const id = (u.loginId_lower || u.loginId || u.uid).toLowerCase();
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
    
    // Décalage pour répartir les RDV dans la journée (9h à 17h)
    const hourOffset = index % 8; 

    while (isBefore(checkDate, rangeEnd)) {
      const monthId = format(checkDate, 'yyyy-MM');
      const slug = (client.loginId_lower || client.loginId || client.uid).toLowerCase();
      
      // Identifiant unique stable pour l'événement (Version V1)
      const currentEventId = `event_v1_${slug}_${monthId}`;
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', currentEventId);

      if (isActive) {
        // Date par défaut : le 8 du mois
        let eventDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), 8);
        
        // Si c'est le mois en cours, on force à aujourd'hui pour voir la tâche dans le dashboard
        if (checkDate.getMonth() === now.getMonth() && checkDate.getFullYear() === now.getFullYear()) {
           eventDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        eventDate.setHours(9 + hourOffset, 0, 0, 0);

        // Événement Agenda : Titre condensé, instruction en note
        setDocumentNonBlocking(eventRef, {
          id: currentEventId,
          id_externe: currentEventId,
          companyId: adminCompanyId,
          userId: adminUid,
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
}
