'use client';

/**
 * @fileOverview Service de synchronisation des calendriers.
 * Gère le mapping et les appels réels aux API Google/Outlook.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc, getDoc } from 'firebase/firestore';
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
 */
export function mapOutlookEvent(outlookEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  // Sécurisation du mapping des participants Outlook
  const attendees = (outlookEvent.attendees || [])
    .filter((a: any) => a?.emailAddress?.address)
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
 * Appelle l'API Google pour récupérer les événements
 */
export async function fetchGoogleEvents(token: string, timeMin: string, timeMax: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(`Google API Error (${response.status}): ${message}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

/**
 * Appelle l'API Microsoft Graph pour récupérer les événements Outlook
 */
export async function fetchOutlookEvents(token: string, timeMin: string) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/events?$filter=start/dateTime ge '${timeMin}'&$select=id,subject,bodyPreview,start,end,attendees,lastModifiedDateTime`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(`Outlook API Error (${response.status}): ${message}`);
  }
  
  const data = await response.json();
  return data.value || [];
}

/**
 * Logique d'Upsert avec vérification de la date de mise à jour
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;

  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  
  try {
    const docSnap = await getDoc(eventRef);

    if (docSnap.exists()) {
      const existingEvent = docSnap.data() as CalendarEvent;
      const existingDate = new Date(existingEvent.derniere_maj || 0).getTime();
      const newDate = new Date(eventData.derniere_maj!).getTime();

      // On ne met à jour que si l'événement externe a été modifié plus récemment
      if (newDate > existingDate) {
        setDocumentNonBlocking(eventRef, eventData, { merge: true });
      }
    } else {
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
  // On récupère 30 jours dans le passé et 365 jours dans le futur
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
