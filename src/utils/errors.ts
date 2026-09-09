import type { FieldError } from './response';

/**
 * Error domain yang aman ditampilkan ke klien.
 * Error di luar kelas ini dianggap tak terduga dan SELALU dipetakan ke pesan generik
 * 500 oleh errorHandler, tanpa membocorkan stack trace (CLAUDE.md §6 aturan #16).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: FieldError[];
  public readonly isOperational = true;

  constructor(message: string, statusCode = 400, errors: FieldError[] = []) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validasi gagal', errors: FieldError[] = []) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autentikasi diperlukan') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Anda tidak memiliki akses ke resource ini') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Data sudah ada atau bentrok dengan data lain') {
    super(message, 409);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Ukuran berkas melebihi batas yang diizinkan') {
    super(message, 413);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Berkas tidak dapat diproses', errors: FieldError[] = []) {
    super(message, 422, errors);
  }
}
