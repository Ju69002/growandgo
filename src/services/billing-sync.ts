
'use client';

import { Firestore, doc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { User, Company, PlanType } from '@/lib/types';
import { updateDocumentNonBlocking } from '@/firebase';
import { format } from 'date-fns';

/**
 * Service pour recalculer et mettre à jour les données d'abonnement d'une entreprise.
 */
export async function updateSubscriptionData(db: Firestore, companyId: string, activeUsersCount: number, currentPlan?: PlanType) {
  if (!db || !companyId) return;

  try {
    const isGlobalAdmin = companyId === 'admin_global';
    
    let plan: PlanType = currentPlan || 'individual';
    let basePrice = 19.99;
    let pricePerUser = 0;

    if (isGlobalAdmin) {
      basePrice = 0;
      pricePerUser = 0;
      plan = 'business';
    } else if (plan === 'business') {
      basePrice = 199.99;
      pricePerUser = 14.99;
    }

    // Le total mensuel = basePrice + (employés additionnels * pricePerUser)
    // On considère que le patron est inclus dans le basePrice
    const additionalUsers = Math.max(0, activeUsersCount - 1);
    const totalMonthlyAmount = basePrice + (additionalUsers * pricePerUser);

    const companyRef = doc(db, 'companies', companyId);
    
    updateDocumentNonBlocking(companyRef, {
      subscription: {
        planType: plan,
        basePrice,
        pricePerUser,
        activeUsersCount,
        totalMonthlyAmount,
        currency: 'EUR',
        status: 'active',
        nextBillingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 8).toISOString()
      },
      subscriptionStatus: 'active'
    });

  } catch (error) {
    console.error("Erreur mise à jour abonnement:", error);
  }
}

/**
 * Synchronise les tâches de facturation pour toutes les entreprises.
 */
export async function syncBillingTasks(db: Firestore, adminUid: string, allUsers: User[]) {
  const monthId = format(new Date(), 'yyyy-MM');
  const companies = Array.from(new Set(allUsers.map(u => u.companyId).filter(id => id && id !== 'admin_global')));

  for (const companyId of companies) {
    const normalizedId = companyId.toLowerCase();
    const eventsRef = collection(db, 'companies', normalizedId, 'events');
    
    const q = query(
      eventsRef, 
      where('isBillingEvent', '==', true), 
      where('billingMonthId', '==', monthId)
    );
    
    const snap = await getDocs(q);

    if (snap.empty) {
      const debut = new Date();
      debut.setDate(8);
      debut.setHours(9, 0, 0, 0);
      
      const fin = new Date(debut);
      fin.setHours(10, 0, 0, 0);

      addDoc(eventsRef, {
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
        description: "Prélèvement automatique ou validation du paiement mensuel."
      });
    }
  }
}
