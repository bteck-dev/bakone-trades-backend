import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { sendError } from "../utils/apiResponse";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  sendError(res, "Internal server error", {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, `Route ${req.method} ${req.originalUrl} not found`, {
    statusCode: 404,
    code: "ROUTE_NOT_FOUND",
  });
};
