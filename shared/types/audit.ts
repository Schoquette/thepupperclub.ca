export interface AuditLog {
  id: number;
  user_id: number;
  model_type: string;
  model_id: number;
  action: 'created' | 'updated' | 'deleted';
  changed_fields: Record<string, { from: unknown; to: unknown }> | null;
  ip_address: string | null;
  created_at: string;
}
