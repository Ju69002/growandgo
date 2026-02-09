
'use client';

/**
 * @fileOverview Service de synchronisation bidirectionnelle des calendriers (Google Calendar).
 * Gère l'import (Google -> App) et l'export (App -> Google).
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc, setDoc } from 'firebase/firestore';

/**
 * Récupère les événements Google Calendar (Import).
 */
export async function fetchGoogleEvents(token: string, timeMin: string, timeMax: string) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Erreur API Google Calendar (Import)`);
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Google Calendar Fetch Error:", error);
    throw error;
  }
}

/**
 * Envoie un événement local vers Google Calendar (Export).
 */
export async function pushEventToGoogle(token: string, event: CalendarEvent) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
    const body = {
      summary: event.titre,
      description: event.description || '',
      start: {
        dateTime: event.debut,
      },
      end: {
        dateTime: event.fin,
      },
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
      const errorData = await response.json();
      throw new Error(`Google Calendar Export Error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.id; // Retourne le nouvel ID Google
  } catch (error) {
    console.error("Google Calendar Push Error:", error);
    throw error;
  }
}

/**
 * Mappe un événement Google vers le format local.
 * Sécurisation CRITIQUE (ligne 46) maintenue.
 */
export function mapGoogleEvent(event: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || new Date().toISOString();
  
  // Correction Robuste : Gère les participants sans emailAddress ou email direct
  const attendees = event.attendees?.map((a: any) => {
    return a.email || a.emailAddress?.address || '';
  }).filter(Boolean) || [];

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
    googleEventId: event.id,
    derniere_maj: event.updated || new Date().toISOString()
  };
}

/**
 * Enregistre un événement dans Firestore avec merge: true pour protéger les données.
 */
export async function syncEventToFirestore(db: Firestore, eventData: Partial<CalendarEvent>) {
  if (!eventData.id_externe || !eventData.companyId) return;
  try {
    const eventRef = doc(db, 'companies', eventData.companyId.toLowerCase(), 'events', eventData.id_externe);
    await setDoc(eventRef, eventData, { merge: true });
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    throw error;
  }
}

/**
 * Plage de temps pour la synchro (15 jours passés, 45 jours futurs).
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
