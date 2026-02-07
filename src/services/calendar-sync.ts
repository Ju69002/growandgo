'use client';

/**
 * @fileOverview Service de synchronisation bidirectionnelle des calendriers Google.
 * Gère la prévention des doublons en utilisant les ID Google comme IDs Firestore.
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
 * Envoie un événement local vers Google Calendar.
 */
export async function pushEventToGoogle(token: string, event: CalendarEvent) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
    
    const googleEvent = {
      summary: event.titre,
      description: event.description || '',
      start: { dateTime: event.debut },
      end: { dateTime: event.fin },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(googleEvent)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erreur export Google: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("pushEventToGoogle failed:", error);
    throw error;
  }
}

/**
 * Mappe un événement Google Calendar vers le schéma Grow&Go.
 */
export function mapGoogleEvent(googleEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString();
  const end = googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString();

  // On utilise l'ID de Google s'il existe pour éviter les doublons lors du setDoc
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
 * Enregistre un événement dans Firestore.
 * Utilise id_externe comme ID du document pour garantir l'unicité (Anti-Doublons).
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;
  // Utiliser id_externe comme ID du document garantit que si l'événement est ré-importé, 
  // il écrase le précédent au lieu d'en créer un nouveau.
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
