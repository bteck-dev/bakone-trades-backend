import { Request, Response } from "express";
import { dashboardService } from "./dashboard.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class DashboardController {
  async getStats(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, await dashboardService.getStats()); }
    catch (err: unknown) { sendError(res, "Failed to fetch dashboard stats"); }
  }
}
export const dashboardController = new DashboardController();
