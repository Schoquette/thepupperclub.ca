export type MessageType =
  | 'text'
  | 'pre_visit_prompt'
  | 'arrival'
  | 'visit_report'
  | 'invoice'
  | 'notification';

export type ConversationStatus = 'open' | 'resolved' | 'needs_follow_up';

export interface Conversation {
  id: number;
  user_id: number;
  status: ConversationStatus;
  unread_count_admin: number;
  unread_count_client: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Eager loaded
  user?: import('./user').User;
  last_message?: Message;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: MessageType;
  body: string | null;
  metadata: MessageMetadata | null;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageMetadata =
  | PreVisitPromptMetadata
  | ArrivalMetadata
  | VisitReportMetadata
  | InvoiceMetadata
  | NotificationMetadata;

export interface PreVisitPromptMetadata {
  appointment_id: number;
  scheduled_date: string;
  time_block: string;
}

export interface ArrivalMetadata {
  appointment_id: number;
  check_in_time: string;
}

export interface VisitReportMetadata {
  appointment_id: number;
  visit_report_id: number;
  photo_urls: string[];
  mood: string;
  eliminated: boolean;
  ate_well: boolean;
  drank_water: boolean;
  notes: string | null;
}

export interface InvoiceMetadata {
  invoice_id: number;
  invoice_number: string;
  total: number;
  due_date: string;
}

export interface NotificationMetadata {
  title: string;
  broadcast: boolean;
}

export interface PushNotification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}
