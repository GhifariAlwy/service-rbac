import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { sendSuccess } from '../../utils/response';

/**
 * GET /health — wajib ada di setiap service (CLAUDE.md §7).
 *
 * Sengaja TIDAK menyentuh database: health check dipakai Docker/orchestrator untuk
 * menentukan apakah proses layak menerima trafik. Kesehatan database punya
 * healthcheck sendiri di docker-compose.
 */
export function getHealth(_req: Request, res: Response): void {
  sendSuccess(
    res,
    {
      status: 'ok',
      service: env.SERVICE_NAME,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    'Service sehat',
  );
}
