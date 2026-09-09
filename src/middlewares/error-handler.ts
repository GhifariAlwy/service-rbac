import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import type { FieldError } from '../utils/response';

/** 404 untuk route yang tidak terdaftar, tetap memakai envelope standar. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
}

/**
 * Error handler terpusat.
 *
 * Aturan keamanan (CLAUDE.md §6 aturan #16): response TIDAK PERNAH memuat stack trace,
 * nama framework, atau pesan asli dari error tak terduga. Detail lengkap hanya masuk
 * ke log server (JSON terstruktur, membawa request_id).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod -> 400 dengan daftar field yang gagal
  if (err instanceof ZodError) {
    const errors: FieldError[] = err.issues.map((issue) => ({
      field: issue.path.join('.') || undefined,
      message: issue.message,
    }));
    req.log?.warn('validasi gagal', { errors });
    sendError(res, 'Validasi gagal', 400, errors);
    return;
  }

  // Error domain yang memang dirancang untuk ditampilkan ke klien
  if (err instanceof AppError) {
    req.log?.warn('permintaan ditolak', {
      status_code: err.statusCode,
      error_name: err.name,
      error_message: err.message,
    });
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Body JSON rusak -> 400, bukan 500
  if (err instanceof SyntaxError && 'body' in err) {
    req.log?.warn('body JSON tidak valid');
    sendError(res, 'Format JSON pada body request tidak valid', 400);
    return;
  }

  // Sisanya: tak terduga. Log lengkap ke server, pesan generik ke klien.
  const detail = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: String(err) };
  req.log?.error('kesalahan tidak terduga', detail);
  sendError(res, 'Terjadi kesalahan pada server', 500);
}
