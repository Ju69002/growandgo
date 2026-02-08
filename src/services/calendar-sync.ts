
'use client';

/**
 * @fileOverview Service de synchronisation des calendriers (Focus Google).
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

/**
 * Récupère les événements Google.
 */
export async function fetchGoogleEvents(token: string, timeMin: string, timeMax: string) {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Erreur Google API`);
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Mappe un événement Google.
 */
export function mapGoogleEvent(event: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || new Date().toISOString();
  
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
 * Exporte vers Google.
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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Erreur Export Google`);
  return response.json();
}

/**
 * Enregistre dans Firestore.
 */
export async function syncEventToFirestore(db: Firestore, eventData: Partial<CalendarEvent>) {
  if (!eventData.id_externe || !eventData.companyId) return;
  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  setDocumentNonBlocking(eventRef, eventData, { merge: true });
}

export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
