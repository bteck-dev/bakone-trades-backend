import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sendError } from "../utils/apiResponse";

export interface AdminPayload {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  admin?: AdminPayload;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Unauthorized - no token provided", { statusCode: 401, code: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminPayload;
    req.admin = decoded;
    next();
  } catch {
    sendError(res, "Unauthorized - invalid or expired token", { statusCode: 401, code: "UNAUTHORIZED" });
  }
};
