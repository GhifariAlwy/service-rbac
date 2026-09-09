import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Hanya terima request id berformat aman agar tidak dipakai untuk log injection. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Membaca X-Request-Id dari API Gateway; kalau tidak ada (atau formatnya tidak aman)
 * membuat UUID baru. Nilai yang sama dipantulkan kembali di response header supaya
 * satu request bisa ditelusuri lintas service (CLAUDE.md §7).
 */
export function requestId(baseLogger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header(REQUEST_ID_HEADER);
    const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    req.requestId = id;
    req.log = baseLogger.child({ request_id: id });
    res.setHeader('X-Request-Id', id);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      req.log.info('request selesai', {
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
      });
    });

    next();
  };
}
