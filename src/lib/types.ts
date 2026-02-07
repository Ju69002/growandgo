
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
  adminMode: boolean; // Mode Patron/Admin actif ou non
  isCategoryModifier: boolean; // Droit accordé par le Super Admin pour modifier les tuiles
  name: string;
  email: string;
  calendarTokens?: {
    google_refresh_token?: string;
  };
}

export interface Category {
  id: string;
  label: string;
  badgeCount: number;
  visibleToEmployees: boolean;
  type: CategoryType;
  aiInstructions?: string;
  companyId: string;
  subCategories?: string[];
  color?: string; // Classe tailwind ou couleur custom
  icon?: string;
}

export interface BusinessDocument {
  id: string;
  name: string;
  categoryId: string;
  subCategory?: string;
  projectColumn: 'technical' | 'administrative' | 'budget';
  status: DocumentStatus;
  extractedData?: {
    date?: string;
    montant?: string;
    emetteur?: string;
    reference?: string;
    siren?: string;
    expiryDate?: string;
    deliveryDate?: string;
  };
  fileUrl: string;
  createdAt: string;
  companyId: string;
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
  source: 'local' | 'google';
  type: 'meeting' | 'task' | 'event';
  derniere_maj: string;
}
