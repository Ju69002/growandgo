
'use client';

/**
 * @fileOverview Service de synchronisation des calendriers (Focus Google Calendar uniquement).
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

/**
 * Récupère les événements Google Calendar.
 */
export async function fetchGoogleEvents(token: string, timeMin: string, timeMax: string) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Erreur API Google Calendar`);
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Google Calendar Sync Error:", error);
    throw error;
  }
}

/**
 * Mappe un événement Google vers le format local.
 */
export function mapGoogleEvent(event: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || new Date().toISOString();
  
  // Safe participants mapping
  const attendees = event.attendees?.map((a: any) => a.email || a.displayName || '').filter(Boolean) || [];

  return {
    id_externe: event.id || Math.random().toString(36).substring(7),
    companyId,
    userId,
    titre: event.summary || 'Sans titre',
    description: event.description || '',
    debut: start,
    fin: end,
    attendees,
    source: 'google',
    type: 'meeting',
    derniere_maj: event.updated || new Date().toISOString()
  };
}

/**
 * Exporte un événement local vers Google Calendar.
 */
export async function pushEventToGoogle(token: string, event: CalendarEvent) {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const body = {
      summary: event.titre,
      description: event.description || '',
      start: { dateTime: event.debut },
      end: { dateTime: event.fin },
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Erreur lors de l'exportation Google Calendar`);
    return response.json();
  } catch (error) {
    console.error("Google Calendar Push Error:", error);
    throw error;
  }
}

/**
 * Enregistre un événement dans Firestore de manière non-bloquante.
 */
export async function syncEventToFirestore(db: Firestore, eventData: Partial<CalendarEvent>) {
  if (!eventData.id_externe || !eventData.companyId) return;
  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  setDocumentNonBlocking(eventRef, eventData, { merge: true });
}

/**
 * Définit la plage de temps pour la synchronisation.
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
