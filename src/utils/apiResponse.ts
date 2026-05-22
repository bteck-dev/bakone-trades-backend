import { Response } from "express";

type ApiMeta = Record<string, unknown>;
type ApiErrorDetails = Record<string, unknown> | string | null;

interface SuccessOptions {
  statusCode?: number;
  message?: string;
  meta?: ApiMeta;
}

interface ErrorOptions {
  statusCode?: number;
  code?: string;
  details?: ApiErrorDetails;
  data?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: ApiMeta;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code?: string;
    details?: ApiErrorDetails;
  };
  data?: unknown;
  timestamp: string;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  options: SuccessOptions = {}
): void => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    message: options.message ?? "Success",
    data,
    timestamp: new Date().toISOString(),
  };

  if (options.meta) {
    response.meta = options.meta;
  }

  res.status(options.statusCode ?? 200).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  options: ErrorOptions = {}
): void => {
  const response: ApiErrorResponse = {
    success: false,
    message,
    error: {
      code: options.code,
      details: options.details,
    },
    timestamp: new Date().toISOString(),
  };

  if (options.data !== undefined) {
    response.data = options.data;
  }

  res.status(options.statusCode ?? 500).json(response);
};
