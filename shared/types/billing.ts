export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type BillingMethod = 'credit_card' | 'e_transfer' | 'cash';

export interface Invoice {
  id: number;
  user_id: number;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  gst: number;
  credit_card_surcharge: number;
  tip: number;
  total: number;
  due_date: string | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Eager loaded
  line_items?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  service_date: string | null;
  appointment_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface BillingDashboardSummary {
  billed_this_month: number;
  collected_this_month: number;
  outstanding: number;
  overdue_count: number;
}
