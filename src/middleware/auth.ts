import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload } from "../modules/auth/auth.model";
import { sendError } from "../utils/apiResponse";

export interface AuthRequest extends Request {
  admin?: JwtPayload;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Unauthorized - no token provided", { statusCode: 401, code: "UNAUTHORIZED" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.admin = decoded;
    next();
  } catch {
    sendError(res, "Unauthorized - invalid or expired token", { statusCode: 401, code: "UNAUTHORIZED" });
  }
};
