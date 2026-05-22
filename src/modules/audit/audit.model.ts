import { AuditAction } from "../../constants";

export interface AuditLog {
  id: string;
  action: AuditAction;
  admin_id?: string;
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface CreateAuditLogDto {
  action: AuditAction;
  admin_id?: string;
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditQueryFilters {
  action?: string;
  entity_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}
