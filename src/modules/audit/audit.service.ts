import { supabase } from "../../config/supabase";
import { CreateAuditLogDto, AuditQueryFilters } from "./audit.model";

export class AuditService {
  // Log an action — called internally, never fails silently
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      await supabase.from("audit_logs").insert({
        action: dto.action,
        admin_id: dto.admin_id || null,
        entity_type: dto.entity_type || null,
        entity_id: dto.entity_id || null,
        description: dto.description,
        metadata: dto.metadata || null,
        ip_address: dto.ip_address || null,
        user_agent: dto.user_agent || null,
      });
    } catch (err) {
      // Audit logging must never crash the main flow
      console.error("[AuditService] Failed to write audit log:", err);
    }
  }

  async getAll(filters: AuditQueryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.action) query = query.eq("action", filters.action);
    if (filters.entity_type) query = query.eq("entity_type", filters.entity_type);
    if (filters.from_date) query = query.gte("created_at", filters.from_date);
    if (filters.to_date) query = query.lte("created_at", filters.to_date);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      logs: data,
      pagination: { total: count || 0, page, limit, pages: Math.ceil((count || 0) / limit) },
    };
  }
}

export const auditService = new AuditService();
