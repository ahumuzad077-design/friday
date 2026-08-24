/**
 * Simple logger for MCP servers.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const currentLevel = process.env.LOG_LEVEL
  ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] ?? LogLevel.INFO
  : LogLevel.INFO;

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function log(level: LogLevel, context: string, message: string, data?: unknown) {
  if (level < currentLevel) return;

  const timestamp = formatTimestamp();
  const levelName = levelNames[level];
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';

  console.error(`[${timestamp}] [${levelName}] [${context}] ${message}${dataStr}`);
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) =>
    log(LogLevel.DEBUG, context, message, data),
  info: (context: string, message: string, data?: unknown) =>
    log(LogLevel.INFO, context, message, data),
  warn: (context: string, message: string, data?: unknown) =>
    log(LogLevel.WARN, context, message, data),
  error: (context: string, message: string, data?: unknown) =>
    log(LogLevel.ERROR, context, message, data),
};
