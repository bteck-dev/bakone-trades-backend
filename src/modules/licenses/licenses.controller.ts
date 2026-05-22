import { Request, Response } from "express";
import { licensesService } from "./licenses.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class LicensesController {
  async getStockStatus(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { stock: await licensesService.getStockStatus() }); }
    catch (err: unknown) { sendError(res, "Failed to get stock status"); }
  }
  async addNote(req: Request, res: Response): Promise<void> {
    try {
      const admin = (req as any).admin;
      const note = await licensesService.addNote(admin.id, req.body);
      sendSuccess(res, { note }, { statusCode: 201, message: "Note added" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to add note", { statusCode: 400 });
    }
  }
  async getNotes(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { notes: await licensesService.getNotes(req.query.product_id as string) }); }
    catch (err: unknown) { sendError(res, "Failed to get notes"); }
  }
}
export const licensesController = new LicensesController();
