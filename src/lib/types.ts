export type UserRole = 'super_admin' | 'admin' | 'employee';

export type DocumentStatus = 'pending_analysis' | 'waiting_verification' | 'waiting_validation' | 'archived';

export type CategoryType = 'standard' | 'custom';

export interface Company {
  id: string;
  name: string;
  subscription_status: 'active' | 'trial';
  modules_config: {
    show_rh: boolean;
    show_finance: boolean;
    custom_labels: Record<string, string>;
  };
}

export interface User {
  uid: string;
  company_id: string;
  role: UserRole;
  admin_mode: boolean;
  name: string;
  email: string;
}

export interface Category {
  id: string;
  company_id: string;
  label: string;
  badge_count: number;
  type: CategoryType;
  visible_to_employees: boolean;
  ai_instructions: string;
  icon?: string;
}

export interface BusinessDocument {
  id: string;
  category_id: string;
  project_column: 'technical' | 'administrative' | 'budget';
  status: DocumentStatus;
  extracted_data: Record<string, any>;
  file_url: string;
  name: string;
  created_at: string;
}