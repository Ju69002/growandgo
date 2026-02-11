
export type UserRole = 'admin' | 'patron' | 'family' | 'employee';
export type DocumentStatus = 'pending_analysis' | 'waiting_verification' | 'waiting_validation' | 'archived';
export type CategoryType = 'standard' | 'custom';
export type SubscriptionStatus = 'active' | 'inactive';
export type PlanType = 'individual' | 'business';

export interface Company {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'trial' | 'inactive';
  primaryColor?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  subscription?: {
    planType: PlanType;
    basePrice: number;
    pricePerUser: number;
    activeUsersCount: number;
    totalMonthlyAmount: number;
    currency: string;
    status: 'active' | 'overdue';
    nextBillingDate?: string;
  };
  integrations?: {
    googleDrive?: {
      isConnected: boolean;
      folderId: string;
      accessToken: string;
      email?: string;
    };
    oneDrive?: {
      isConnected: boolean;
      folderId: string;
      accessToken: string;
      email?: string;
    };
  };
}

export interface User {
  uid: string;
  companyId: string;
  companyName: string; 
  role: UserRole;
  adminMode: boolean;
  isCategoryModifier: boolean;
  name: string;
  loginId: string;
  loginId_lower?: string;
  password?: string;
  email: string;
  subscriptionStatus?: SubscriptionStatus;
  createdAt?: string;
  googleEmail?: string;
  isProfile?: boolean;
  photoURL?: string;
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
  color?: string;
  icon?: string;
  isClientFolder?: boolean;
}

export interface BusinessDocument {
  id: string;
  name: string;
  categoryId: string;
  subCategory?: string;
  clientName?: string; 
  clientId?: string;   
  issuerEntity?: string; // Entité émettrice identifiée
  documentDate?: string;
  status: DocumentStatus;
  confidenceScore?: number; 
  isDataParsed?: boolean;   
  extractedData?: any;      // Métadonnées à la carte
  summary_flash?: string;   // Résumé flash de l'IA
  fileUrl: string;
  createdAt: string;
  companyId: string;
  storageType: 'firebase' | 'private_server' | 'google_drive' | 'one_drive';
}

export interface CalendarEvent {
  id: string;
  id_externe: string;
  companyId: string;
  userId: string;
  assignedTo?: string;
  assignedToName?: string;
  titre: string;
  description?: string;
  debut: string; 
  fin: string; 
  attendees: string[]; 
  source: 'local' | 'google';
  type: 'meeting' | 'task' | 'event';
  derniere_maj: string;
  isBillingEvent?: boolean;
  googleEventId?: string;
}
