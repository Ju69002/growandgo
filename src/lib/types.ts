export type UserRole = 'super_admin' | 'admin' | 'employee';

export type DocumentStatus = 'pending_analysis' | 'waiting_verification' | 'waiting_validation' | 'archived';

export type CategoryType = 'standard' | 'custom';

export interface Company {
  id: string;
  name: string;
  subscriptionStatus: 'active' | 'trial';
  primaryColor?: string; // HSL value or hex
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
  color?: string; // Individual background color (e.g., "bg-green-500" or a custom HSL)
}

export interface BusinessDocument {
  id: string;
  companyId: string;
  categoryId: string;
  projectColumn: 'technical' | 'administrative' | 'budget';
  status: DocumentStatus;
  extractedData: Record<string, any>;
  fileUrl: string;
  name: string;
  createdAt: string;
}
