export type DocumentType =
  | 'vaccination_record'
  | 'vet_record'
  | 'service_agreement'
  | 'liability_waiver'
  | 'other';

export interface ClientDocument {
  id: number;
  user_id: number;
  dog_id: number | null;
  type: DocumentType;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: 'admin' | 'client';
  signed_url: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
