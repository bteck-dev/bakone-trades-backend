import { Request, Response } from "express";
import { auditService } from "./audit.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class AuditController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        action: req.query.action as string,
        entity_type: req.query.entity_type as string,
        from_date: req.query.from_date as string,
        to_date: req.query.to_date as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };
      const result = await auditService.getAll(filters);
      sendSuccess(res, { logs: result.logs }, { meta: { pagination: result.pagination } });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to fetch audit logs");
    }
  }
}

export const auditController = new AuditController();
