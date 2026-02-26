export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface DashboardSummary {
  todays_appointments: import('./appointment').Appointment[];
  pending_service_requests: number;
  unread_messages: number;
  outstanding_invoices: number;
  outstanding_total: number;
  upcoming_renewals: UpcomingRenewal[];
  revenue_this_month: import('./billing').BillingDashboardSummary;
}

export interface UpcomingRenewal {
  user_id: number;
  client_name: string;
  renewal_date: string;
  subscription_tier: string;
}
