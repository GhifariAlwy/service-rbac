/**
 * Logger JSON terstruktur (CLAUDE.md §7).
 * Tidak memakai dependency eksternal agar format output sepenuhnya terkendali
 * dan identik di keempat service backend.
 *
 * Setiap baris log adalah satu objek JSON dengan field `request_id` bila tersedia,
 * sehingga satu request bisa ditelusuri lintas service lewat X-Request-Id dari Gateway.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  request_id?: string;
  [key: string]: unknown;
}

/** Field yang tidak boleh ikut tertulis ke log dalam bentuk apa pun. */
const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'token_hash',
  'sha256',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

export class Logger {
  private readonly service: string;
  private readonly minLevel: number;
  private readonly base: LogContext;

  constructor(service: string, level: LogLevel = 'info', base: LogContext = {}) {
    this.service = service;
    this.minLevel = LEVEL_ORDER[level] ?? LEVEL_ORDER.info;
    this.base = base;
  }

  /** Turunan logger yang selalu membawa konteks tambahan, mis. request_id. */
  child(context: LogContext): Logger {
    const level = (Object.keys(LEVEL_ORDER) as LogLevel[]).find(
      (key) => LEVEL_ORDER[key] === this.minLevel,
    );
    return new Logger(this.service, level ?? 'info', { ...this.base, ...context });
  }

  private write(level: LogLevel, message: string, context: LogContext = {}): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...(redact({ ...this.base, ...context }) as Record<string, unknown>),
    };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }
}
