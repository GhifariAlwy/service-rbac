import type { Logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      /** Diisi requestId middleware; diteruskan sebagai X-Request-Id ke service lain. */
      requestId: string;
      /** Logger turunan yang sudah membawa request_id. */
      log: Logger;
      /** Identitas terverifikasi yang diteruskan API Gateway. */
      user?: {
        id: number;
        role: string;
      };
    }
  }
}

export {};
