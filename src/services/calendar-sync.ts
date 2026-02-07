'use client';

/**
 * @fileOverview Service de synchronisation des calendriers Google.
 */

import { CalendarEvent } from '@/lib/types';
import { Firestore, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';

/**
 * Appelle l'API Google pour récupérer les événements.
 * Utilise les paramètres timeMin et timeMax pour limiter la recherche.
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
      console.error("Google API Detail Error:", errorData);
      throw new Error(`Erreur API Google (${response.status}): ${message}`);
    }
    
    const data = await response.json();
    console.log("Events fetched from Google:", data.items?.length || 0);
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
  // Gestion des événements toute la journée vs horaires précis
  const start = googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString();
  const end = googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString();

  return {
    id_externe: googleEvent.id || Math.random().toString(36).substring(7),
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
 */
export async function syncEventToFirestore(
  db: Firestore, 
  eventData: Partial<CalendarEvent>
) {
  if (!eventData.id_externe || !eventData.companyId) return;

  const eventRef = doc(db, 'companies', eventData.companyId, 'events', eventData.id_externe);
  
  // On force l'écriture avec merge: true pour mettre à jour les infos existantes
  setDocumentNonBlocking(eventRef, eventData, { merge: true });
}

/**
 * Calcul des bornes temporelles ISO (période de 30 jours autour d'aujourd'hui).
 */
export function getSyncTimeRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}
