
'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar as CalendarIcon, RefreshCw, Plus, Users, Chrome, Layout } from 'lucide-react';
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, where, Timestamp } from 'firebase/firestore';
import { CalendarEvent, User } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function SharedCalendar({ companyId }: { companyId: string }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const db = useFirestore();
  
  // Mock connection status
  const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
  const [isOutlookConnected, setIsOutlookConnected] = React.useState(false);

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const selectedDateEvents = React.useMemo(() => {
    if (!events || !date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }, [events, date]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar - Calendar & Sync */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="w-full"
              locale={fr}
            />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Synchronisation
            </CardTitle>
            <CardDescription className="text-xs">
              Connectez vos calendriers professionnels pour centraliser l'agenda de l'équipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant={isGoogleConnected ? "outline" : "default"} 
              className="w-full justify-start h-11 text-xs"
              onClick={() => setIsGoogleConnected(!isGoogleConnected)}
            >
              <Chrome className="w-4 h-4 mr-2" />
              {isGoogleConnected ? "Google Calendar Connecté" : "Connecter Google Calendar"}
            </Button>
            <Button 
              variant={isOutlookConnected ? "outline" : "default"}
              className="w-full justify-start h-11 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setIsOutlookConnected(!isOutlookConnected)}
            >
              <Layout className="w-4 h-4 mr-2" />
              {isOutlookConnected ? "Outlook Connecté" : "Connecter Outlook"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main - Events List */}
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {date ? format(date, "EEEE d MMMM", { locale: fr }) : "Sélectionnez une date"}
          </h2>
          <Button size="sm" className="bg-primary shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Nouvel événement
          </Button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Chargement de l'agenda...</div>
          ) : selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-md transition-all border-none shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                          {event.source}
                        </Badge>
                        <span className="text-sm font-bold">{event.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{event.description || "Aucune description"}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                          <CalendarIcon className="w-3 h-3 mr-1" />
                          {format(new Date(event.startTime), "HH:mm")} - {format(new Date(event.endTime), "HH:mm")}
                        </div>
                        {event.attendees.length > 0 && (
                          <div className="flex items-center text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            <Users className="w-3 h-3 mr-1" />
                            {event.attendees.length} participants
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl bg-muted/10 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium text-lg">Journée calme</p>
              <p className="text-sm">Aucun événement n'est prévu pour cette date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
