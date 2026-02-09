
'use client';

/**
 * @fileOverview Service de synchronisation des calendriers (Google Calendar).
 * Gère l'import/export et la sécurité des données d'agenda.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc, setDoc } from 'firebase/firestore';

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
 * Correction Ligne 46 : Sécurisation du chaînage des adresses mail.
 */
export function mapGoogleEvent(event: any, companyId: string, userId: string): Partial<CalendarEvent> {
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || new Date().toISOString();
  
  // Correction sécurisée ligne 46 : Utilisation de a.emailAddress?.address pour éviter le crash
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
    derniere_maj: event.updated || new Date().toISOString()
  };
}

/**
 * Enregistre un événement dans Firestore avec merge: true pour protéger les données.
 */
export async function syncEventToFirestore(db: Firestore, eventData: Partial<CalendarEvent>) {
  if (!eventData.id_externe || !eventData.companyId) return;
  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  
  // Utilisation de setDoc avec merge: true au lieu de setDoc simple
  await setDoc(eventRef, eventData, { merge: true });
}

/**
 * Plage de temps pour la synchro.
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
