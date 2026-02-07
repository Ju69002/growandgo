'use client';

/**
 * @fileOverview Service de synchronisation des calendriers.
 * Gère le mapping et les appels réels aux API Google Calendar.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

/**
 * Mappe un événement Google Calendar vers le schéma interne
 */
export function mapGoogleEvent(googleEvent: any, companyId: string, userId: string): Partial<CalendarEvent> {
  // Les événements "toute la journée" ont .date au lieu de .dateTime
  const start = googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString();
  const end = googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString();

  return {
    id_externe: googleEvent.id || '',
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
 * Logique d'Upsert directe dans Firestore
 * On utilise Google comme source de vérité absolue lors du fetch.
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;

  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  
  // On utilise set avec merge: true pour mettre à jour ou créer l'événement
  // On ne vérifie plus manuellement la date de mise à jour pour garantir que le fetch force l'état actuel de Google
  setDocumentNonBlocking(eventRef, eventData, { merge: true });
}

/**
 * Calcul des bornes temporelles ISO pour le fetch
 */
export function getSyncTimeRange() {
  const now = new Date();
  // On élargit un peu la fenêtre pour être sûr
  const timeMin = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
