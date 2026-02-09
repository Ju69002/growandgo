
'use client';

import { Firestore, doc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { updateDocumentNonBlocking } from '@/firebase';
import { format } from 'date-fns';

/**
 * Service pour recalculer et mettre à jour les données d'abonnement d'une entreprise.
 * Appelé lorsque le nombre d'utilisateurs change.
 */
export async function updateSubscriptionData(db: Firestore, companyId: string, activeUsersCount: number) {
  if (!db || !companyId) return;

  try {
    const pricePerUser = 39.99;
    const totalMonthlyAmount = activeUsersCount * pricePerUser;

    const companyRef = doc(db, 'companies', companyId);
    
    // Mise à jour de l'objet subscription dans le document entreprise
    updateDocumentNonBlocking(companyRef, {
      subscription: {
        pricePerUser,
        activeUsersCount,
        totalMonthlyAmount,
        currency: 'EUR',
        status: 'active',
        nextBillingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 8).toISOString()
      }
    });

  } catch (error) {
    console.error("Erreur mise à jour abonnement:", error);
  }
}

/**
 * Synchronise les tâches de facturation pour toutes les entreprises.
 * Utilisé par le Super Admin pour générer les rappels de paiement.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const monthId = format(new Date(), 'yyyy-MM');
  // On récupère toutes les entreprises uniques représentées par les utilisateurs
  const companies = Array.from(new Set(allUsers.map(u => u.companyId).filter(id => id && id !== 'admin_global')));

  for (const companyId of companies) {
    const normalizedId = companyId.toLowerCase();
    const eventsRef = collection(db, 'companies', normalizedId, 'events');
    
    // On vérifie si une tâche de facturation existe déjà pour ce mois
    const q = query(
      eventsRef, 
      where('isBillingEvent', '==', true), 
      where('billingMonthId', '==', monthId)
    );
    
    const snap = await getDocs(q);

    if (snap.empty) {
      // Création de l'événement de facturation (par défaut le 8 du mois)
      const debut = new Date();
      debut.setDate(8);
      debut.setHours(9, 0, 0, 0);
      
      const fin = new Date(debut);
      fin.setHours(10, 0, 0, 0);

      await addDoc(eventsRef, {
        titre: `Paiement Abonnement - ${format(new Date(), 'MMMM yyyy')}`,
        debut: debut.toISOString(),
        fin: fin.toISOString(),
        isBillingEvent: true,
        billingMonthId: monthId,
        source: 'local',
        type: 'task',
        companyId: normalizedId,
        userId: adminUid,
        derniere_maj: new Date().toISOString(),
        description: "Prélèvement automatique ou validation du paiement mensuel BusinessPilot."
      });
    }
  }
}
