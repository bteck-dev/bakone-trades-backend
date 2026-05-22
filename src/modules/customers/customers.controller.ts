import { Request, Response } from "express";
import { customersService } from "./customers.service";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class CustomersController {
  async getAll(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { customers: await customersService.getAll(req.query.search as string) }); }
    catch (err: unknown) { sendError(res, "Failed to fetch customers"); }
  }
  async getOrders(req: Request, res: Response): Promise<void> {
    try { sendSuccess(res, { orders: await customersService.getOrders(req.params.email) }); }
    catch (err: unknown) { sendError(res, "Failed to fetch customer orders"); }
  }
}
export const customersController = new CustomersController();
