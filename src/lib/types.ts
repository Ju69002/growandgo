export type UserRole = 'super_admin' | 'admin' | 'employee';

export type DocumentStatus = 'pending_analysis' | 'waiting_verification' | 'waiting_validation' | 'archived';

export type CategoryType = 'standard' | 'custom';

export interface Company {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'trial';
  primaryColor?: string; // HSL value
  backgroundColor?: string; // HSL value
  foregroundColor?: string; // HSL value
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
}

export interface Category {
  id: string;
  companyId: string;
  label: string;
  badgeCount: number;
  type: CategoryType;
  visibleToEmployees: boolean;
  aiInstructions: string;
  icon?: string;
  color?: string; 
  subCategories?: string[]; // Liste des noms de sous-dossiers
}

export interface BusinessDocument {
  id: string;
  companyId: string;
  categoryId: string;
  subCategory?: string; // Le sous-dossier associé
  projectColumn: 'technical' | 'administrative' | 'budget';
  status: DocumentStatus;
  extractedData: {
    date?: string;
    montant?: string;
    emetteur?: string;
    reference?: string;
    siren?: string;
    [key: string]: any;
  };
  fileUrl: string;
  name: string;
  createdAt: string;
}
