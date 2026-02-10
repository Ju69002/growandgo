export type UserRole = 'super_admin' | 'admin' | 'employee' | 'individuel';
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
  modulesConfig?: {
    showRh: boolean;
    showFinance: boolean;
    customLabels: Record<string, string>;
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
  isBillingTask?: boolean;
  billingMonthId?: string;
  targetUserId?: string;
  storageType?: 'firebase' | 'google_drive' | 'one_drive';
  driveFileId?: string;
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
  isBillingEvent?: boolean;
  googleEventId?: string;
}
