
'use client';

/**
 * @fileOverview Service de synchronisation des calendriers.
 * Gère le mapping des données Google/Outlook vers le schéma Grow&Go.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

export type ExternalSource = 'google' | 'outlook';

/**
 * Mappe un événement Google Calendar vers le schéma interne
 */
export function mapGoogleEvent(googleEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  return {
    id_externe: googleEvent.id || '',
    companyId,
    userId,
    titre: googleEvent.summary || 'Sans titre',
    description: googleEvent.description || '',
    debut: googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString(),
    fin: googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString(),
    attendees: googleEvent.attendees?.filter((a: any) => a?.email).map((a: any) => a.email) || [],
    source: 'google',
    type: 'meeting',
    derniere_maj: googleEvent.updated || new Date().toISOString()
  };
}

/**
 * Mappe un événement Microsoft Graph (Outlook) vers le schéma interne
 * Correction : Ajout de vérifications de sécurité sur les adresses des participants
 */
export function mapOutlookEvent(outlookEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  // Filtrage sécurisé des participants pour éviter l'erreur sur .address
  const attendees = (outlookEvent.attendees || [])
    .filter((a: any) => a?.emailAddress?.address) // On ne garde que ceux qui ont une adresse
    .map((a: any) => a.emailAddress.address);

  return {
    id_externe: outlookEvent.id || '',
    companyId,
    userId,
    titre: outlookEvent.subject || 'Sans titre',
    description: outlookEvent.bodyPreview || '',
    debut: outlookEvent.start?.dateTime || new Date().toISOString(),
    fin: outlookEvent.end?.dateTime || new Date().toISOString(),
    attendees: attendees,
    source: 'outlook',
    type: 'meeting',
    derniere_maj: outlookEvent.lastModifiedDateTime || new Date().toISOString()
  };
}

/**
 * Logique d'Upsert avec vérification de la date de mise à jour
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;

  // On utilise l'ID externe comme ID de document pour garantir l'unicité
  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  
  try {
    const docSnap = await getDoc(eventRef);

    if (docSnap.exists()) {
      const existingEvent = docSnap.data() as CalendarEvent;
      const existingDate = new Date(existingEvent.derniere_maj || 0).getTime();
      const newDate = new Date(eventData.derniere_maj!).getTime();

      // Mise à jour uniquement si la donnée source est plus récente
      if (newDate > existingDate) {
        setDocumentNonBlocking(eventRef, eventData, { merge: true });
      }
    } else {
      // Création d'un nouvel événement
      setDocumentNonBlocking(eventRef, eventData, { merge: true });
    }
  } catch (error) {
    console.error("Sync Error:", error);
  }
}

/**
 * Calcul des bornes temporelles ISO pour le fetch
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // -30 jours
  const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // +12 mois
  return { timeMin, timeMax };
}
