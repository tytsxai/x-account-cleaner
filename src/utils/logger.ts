import winston from 'winston';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

const logsDir = path.join(process.cwd(), 'logs');

const sensitiveKeys = ['password', 'token', 'cookie', 'authorization', 'secret'] as const;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return sensitiveKeys.some((s) => lower === s || lower.includes(s));
}

function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return '[REDACTED]';
  return '[REDACTED]';
}

function redactSensitive<T>(input: T, seen = new WeakMap<object, unknown>()): T {
  if (input == null) return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item as unknown, seen)) as unknown as T;
  }

  if (typeof input !== 'object') {
    return input;
  }

  const obj = input as unknown as object;
  const existing = seen.get(obj);
  if (existing) {
    return existing as T;
  }

  const output: Record<PropertyKey, unknown> = {};
  seen.set(obj, output);

  for (const key of Reflect.ownKeys(obj)) {
    const value = (obj as Record<PropertyKey, unknown>)[key];

    if (typeof key === 'string' && isSensitiveKey(key)) {
      output[key] = redactValue(value);
      continue;
    }

    output[key] = redactSensitive(value, seen);
  }

  return output as unknown as T;
}

const redactFormat = winston.format((info) => redactSensitive(info));

function ensureLogsDirExists(): void {
  if (fs.existsSync(logsDir)) return;
  fs.mkdirSync(logsDir, { recursive: true });
}

function safeJSONStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable meta]';
  }
}

// 自定义日志格式（console）：包含 stack + meta
const customFormat = winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
  let coloredLevel = level;
  switch (level) {
    case 'error':
      coloredLevel = chalk.red.bold(level.toUpperCase());
      break;
    case 'warn':
      coloredLevel = chalk.yellow.bold(level.toUpperCase());
      break;
    case 'info':
      coloredLevel = chalk.blue.bold(level.toUpperCase());
      break;
    case 'debug':
      coloredLevel = chalk.gray.bold(level.toUpperCase());
      break;
    default:
      coloredLevel = level.toUpperCase();
  }

  let output = `${chalk.gray(String(timestamp))} [${coloredLevel}]: ${String(message)}`;
  if (stack) output += `\n${String(stack)}`;

  const metaKeys = Object.keys(meta);
  if (metaKeys.length) output += ` ${safeJSONStringify(meta)}`;

  return output;
});

// 创建日志记录器（默认只初始化 console；文件日志通过 initLogger 按需启用）
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    redactFormat()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(customFormat),
    }),
  ],
});

let fileTransportsInitialized = false;

export function initLogger(): void {
  if (fileTransportsInitialized) return;
  if (process.env.LOG_TO_FILE !== 'true') return;

  ensureLogsDirExists();

  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(redactFormat(), winston.format.json()),
    })
  );

  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(redactFormat(), winston.format.json()),
    })
  );

  fileTransportsInitialized = true;
}

export default logger;

// 便捷的日志方法
export const log = {
  info: (message: string, ...args: unknown[]) => logger.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => logger.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => logger.error(message, ...args),
  debug: (message: string, ...args: unknown[]) => logger.debug(message, ...args),
  success: (message: string, ...args: unknown[]) =>
    logger.info(chalk.green('✓ ') + message, ...args),
};
