export type UserRole = 'admin' | 'client';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientProfile {
  id: number;
  user_id: number;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  billing_method: 'credit_card' | 'e_transfer' | 'cash';
  subscription_tier: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  stripe_customer_id: string | null;
  notes: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStep {
  id: number;
  user_id: number;
  step: OnboardingStepName;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OnboardingStepName =
  | 'set_password'
  | 'welcome'
  | 'profile'
  | 'home_access'
  | 'dog_profiles'
  | 'payment'
  | 'agreement'
  | 'confirmation';

export interface AuthToken {
  token: string;
  user: User;
}
