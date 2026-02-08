
'use client';

/**
 * @fileOverview Service de synchronisation des calendriers Google et Microsoft.
 * Gère la prévention des doublons en utilisant les ID externes.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

/**
 * Appelle l'API Google pour récupérer les événements.
 */
export async function fetchGoogleEvents(token: string, timeMin: string, timeMax: string) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || response.statusText;
      throw new Error(`Erreur API Google (${response.status}): ${message}`);
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("fetchGoogleEvents failed:", error);
    throw error;
  }
}

/**
 * Mappe un événement Google Calendar vers le schéma Grow&Go.
 */
export function mapGoogleEvent(googleEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString();
  const end = googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString();
  const idToUse = googleEvent.id || Math.random().toString(36).substring(7);

  return {
    id_externe: idToUse,
    companyId,
    userId,
    titre: googleEvent.summary || 'Sans titre',
    description: googleEvent.description || '',
    debut: start,
    fin: end,
    attendees: googleEvent.attendees?.filter((a: any) => a?.email).map((a: any) => a.email) || [],
    source: 'google',
    type: 'meeting',
    derniere_maj: googleEvent.updated || new Date().toISOString()
  };
}

/**
 * Mappe un événement Microsoft Outlook (Azure) vers le schéma Grow&Go.
 */
export function mapOutlookEvent(outlookEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = outlookEvent.start?.dateTime || new Date().toISOString();
  const end = outlookEvent.end?.dateTime || new Date().toISOString();
  const idToUse = outlookEvent.id || Math.random().toString(36).substring(7);

  return {
    id_externe: idToUse,
    companyId,
    userId,
    titre: outlookEvent.subject || 'Sans titre',
    description: outlookEvent.bodyPreview || '',
    debut: start,
    fin: end,
    attendees: outlookEvent.attendees?.map((a: any) => a.emailAddress?.address || '') || [],
    source: 'google', 
    type: 'meeting',
    derniere_maj: outlookEvent.lastModifiedDateTime || new Date().toISOString()
  };
}

/**
 * Envoie un événement local vers Google Calendar.
 */
export async function pushEventToGoogle(token: string, event: CalendarEvent) {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  
  const body = {
    summary: event.titre,
    description: event.description || '',
    start: { dateTime: event.debut },
    end: { dateTime: event.fin },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erreur Export Google: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Enregistre un événement dans Firestore.
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;
  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  setDocumentNonBlocking(eventRef, eventData, { merge: true });
}

/**
 * Calcul des bornes temporelles ISO.
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
