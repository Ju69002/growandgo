
export type UserRole = 'super_admin' | 'admin' | 'employee';
export type DocumentStatus = 'pending_analysis' | 'waiting_verification' | 'waiting_validation' | 'archived';
export type CategoryType = 'standard' | 'custom';

export interface Company {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'trial';
  primaryColor?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  modulesConfig: {
    showRh: boolean;
    showFinance: boolean;
    customLabels: Record<string, string>;
  };
}

export interface User {
  uid: string;
  companyId: string;
  role: UserRole;
  adminMode: boolean;
  name: string;
  email: string;
  calendarTokens?: {
    google_refresh_token?: string;
    outlook_refresh_token?: string;
  };
}

export interface CalendarEvent {
  id: string;
  id_externe: string;
  companyId: string;
  userId: string;
  titre: string;
  description?: string;
  debut: string; 
  fin: string; 
  attendees: string[]; 
  source: 'local' | 'google' | 'outlook';
  type: 'meeting' | 'task' | 'event';
  derniere_maj: string;
}
