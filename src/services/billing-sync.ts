
'use client';

import { Firestore, collection, doc, getDocs, query, where } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase';
import { format, addMonths, startOfMonth, isBefore, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Service pour synchroniser les tâches de facturation de l'Admin.
 * Parcourt les utilisateurs et crée des tâches/événements manquants.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const adminCompanyId = "GrowAndGo";
  const now = new Date();

  // Filtrer les utilisateurs actifs (hors admin)
  const activeClients = allUsers.filter(u => 
    u.role !== 'super_admin' && 
    u.subscriptionStatus !== 'inactive'
  );

  for (const client of activeClients) {
    // Si pas de date de création, on utilise la date par défaut du projet
    const creationDateStr = client.createdAt || "2026-02-08T00:00:00.000Z";
    let startDate = parseISO(creationDateStr);
    
    if (!isValid(startDate)) {
      startDate = new Date(2026, 1, 8);
    }

    let checkDate = startOfMonth(startDate);
    const endCheckDate = startOfMonth(now);

    while (isBefore(checkDate, addMonths(endCheckDate, 1))) {
      const monthId = format(checkDate, 'yyyy-MM');
      const monthLabel = format(checkDate, 'MMMM yyyy', { locale: fr });
      
      const taskId = `billing_task_${client.uid}_${monthId}`;
      const eventId = `billing_event_${client.uid}_${monthId}`;

      // 1. Création de la tâche dans le tableau de bord Admin
      const taskRef = doc(db, 'companies', adminCompanyId, 'documents', taskId);
      const taskData: Partial<BusinessDocument> = {
        id: taskId,
        name: `Envoyer facture à ${client.name} - ${monthLabel}`,
        categoryId: 'finance',
        subCategory: 'Factures à envoyer',
        projectColumn: 'administrative',
        status: 'waiting_verification',
        createdAt: format(now, 'dd/MM/yyyy'),
        companyId: adminCompanyId,
        isBillingTask: true,
        billingMonthId: monthId,
        targetUserId: client.uid,
        fileUrl: "" // Placeholder car la facture n'est pas encore générée en PDF
      };

      // 2. Création du rendez-vous dans l'agenda
      const eventRef = doc(db, 'companies', adminCompanyId, 'events', eventId);
      const eventDate = new Date(checkDate);
      eventDate.setHours(9, 0, 0, 0); // RDV à 9h le 1er du mois

      const eventData: Partial<CalendarEvent> = {
        id: eventId,
        id_externe: eventId,
        companyId: adminCompanyId,
        userId: adminUid,
        titre: `Facturation ${client.name}`,
        description: `Tâche administrative : Générer et envoyer la facture de ${monthLabel} pour ${client.companyName || client.companyId}.`,
        debut: eventDate.toISOString(),
        fin: addMonths(eventDate, 0).toISOString(), // Même jour, courte durée
        attendees: [client.email],
        source: 'local',
        type: 'event',
        derniere_maj: now.toISOString(),
        isBillingEvent: true
      };

      // On utilise setDocumentNonBlocking avec merge pour l'idempotence
      setDocumentNonBlocking(taskRef, taskData, { merge: true });
      setDocumentNonBlocking(eventRef, eventData, { merge: true });

      checkDate = addMonths(checkDate, 1);
    }
  }
}
