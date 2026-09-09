/**
 * Response envelope seragam untuk SEMUA service (CLAUDE.md §7):
 *   { "success": true, "data": {}, "message": "", "errors": [] }
 */
import type { Response } from 'express';

export interface FieldError {
  field?: string;
  message: string;
}

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: FieldError[];
}

export function buildEnvelope<T>(
  success: boolean,
  data: T | null,
  message: string,
  errors: FieldError[] = [],
): Envelope<T> {
  return { success, data, message, errors };
}

export function sendSuccess<T>(
  res: Response,
  data: T | null,
  message = '',
  statusCode = 200,
): Response {
  return res.status(statusCode).json(buildEnvelope(true, data, message, []));
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors: FieldError[] = [],
): Response {
  return res.status(statusCode).json(buildEnvelope(false, null, message, errors));
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
