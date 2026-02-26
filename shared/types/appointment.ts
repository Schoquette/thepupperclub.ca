export type AppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled';

export type TimeBlock =
  | 'early_morning'   // 7–10 AM
  | 'morning'         // 9–12 PM
  | 'midday'          // 11 AM–2 PM
  | 'afternoon'       // 2–5 PM
  | 'evening';        // 5–8 PM

export const TIME_BLOCK_LABELS: Record<TimeBlock, string> = {
  early_morning: '7–10 AM',
  morning: '9–12 AM',
  midday: '11 AM–2 PM',
  afternoon: '2–5 PM',
  evening: '5–8 PM',
};

export type ServiceType =
  | 'walk_30'
  | 'walk_60'
  | 'drop_in'
  | 'overnight'
  | 'day_boarding';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  days_of_week?: number[]; // 0=Sun, 6=Sat
  end_date?: string;
  occurrences?: number;
}

export interface Appointment {
  id: number;
  user_id: number;
  dog_ids: number[];
  service_type: ServiceType;
  status: AppointmentStatus;
  // Admin only — exact time
  scheduled_time?: string;
  // Client visible — time block only
  client_time_block: TimeBlock;
  duration_minutes: number;
  notes: string | null;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  pre_visit_notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceRequestStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'counter_offered';

export interface ServiceRequest {
  id: number;
  user_id: number;
  dog_ids: number[];
  service_type: ServiceType;
  preferred_time_block: TimeBlock;
  preferred_date: string;
  notes: string | null;
  status: ServiceRequestStatus;
  admin_response: string | null;
  counter_time_block: TimeBlock | null;
  counter_date: string | null;
  created_at: string;
  updated_at: string;
}
