import { Request, Response } from "express";
import { authService } from "./auth.service";
import { auditService } from "../audit";
import { AUDIT_ACTIONS } from "../../constants";
import { sendError, sendSuccess } from "../../utils/apiResponse";

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        sendError(res, "Email and password are required", { statusCode: 400 });
        return;
      }
      const result = await authService.login({ email, password });
      await auditService.log({
        action: AUDIT_ACTIONS.ADMIN_LOGIN,
        admin_id: result.admin.id,
        description: `Admin logged in: ${email}`,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      });
      sendSuccess(res, result, { message: "Login successful" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Login failed", { statusCode: 401 });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { admin: (req as any).admin });
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const admin = (req as any).admin;
      await authService.changePassword(admin.id, { currentPassword, newPassword });
      await auditService.log({
        action: AUDIT_ACTIONS.ADMIN_PASSWORD_CHANGED,
        admin_id: admin.id,
        description: "Admin changed their password",
        ip_address: req.ip,
      });
      sendSuccess(res, null, { message: "Password updated successfully" });
    } catch (err: unknown) {
      sendError(res, err instanceof Error ? err.message : "Failed to change password", { statusCode: 400 });
    }
  }
}

export const authController = new AuthController();
