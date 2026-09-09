import { createApp, logger } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('service berjalan', { port: env.PORT, node_env: env.NODE_ENV });
});

/** Shutdown rapi supaya container restart/redeploy tidak memutus request yang sedang jalan. */
function shutdown(signal: string): void {
  logger.info('menerima sinyal shutdown', { signal });
  server.close(() => {
    logger.info('server ditutup dengan rapi');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('shutdown dipaksa setelah timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (error: Error) => {
  logger.error('uncaught exception', { name: error.name, message: error.message, stack: error.stack });
  process.exit(1);
});
