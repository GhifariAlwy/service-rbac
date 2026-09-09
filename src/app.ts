// Patch serialisasi BigInt harus dijalankan sebelum response apa pun dibentuk.
import './utils/bigint';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler, requestId } from './middlewares';
import routes from './routes';
import { Logger } from './utils/logger';

export const logger = new Logger(env.SERVICE_NAME, env.LOG_LEVEL);

export function createApp(): Express {
  const app = express();

  // Di belakang API Gateway; percayai satu hop proxy saja untuk req.ip yang benar.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  // Refresh token dibaca dari cookie HttpOnly, bukan dari body/header.
  app.use(cookieParser());

  // requestId harus terpasang sebelum route apa pun agar req.log selalu tersedia.
  app.use(requestId(logger));

  app.use('/', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
