/** OS-aware logging infrastructure
 * Writes logs to appropriate OS-specific directories and a log file.
 */

import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  maxFileSize?: number; // in bytes, not used in this minimal version
  maxFiles?: number; // number of rotated files, not used here
}

function getLogDirectory(): string {
  const home = homedir();
  switch (platform()) {
    case 'linux': {
      const xdgStateHome = process.env.XDG_STATE_HOME || join(home, '.local', 'state');
      return join(xdgStateHome, 'open-s3', 'logs');
    }
    case 'darwin': {
      return join(home, 'Library', 'Logs', 'open-s3');
    }
    case 'win32': {
      const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
      return join(localAppData, 'open-s3', 'logs');
    }
    default: {
      return join(home, '.open-s3', 'logs');
    }
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLevel(level: LogLevel): string {
  switch (level) {
    case LogLevel.Debug:
      return 'DEBUG';
    case LogLevel.Info:
      return 'INFO ';
    case LogLevel.Warn:
      return 'WARN ';
    case LogLevel.Error:
      return 'ERROR';
    default:
      return 'UNKN ';
  }
}

export class Logger {
  level: LogLevel;
  private logDir: string;
  private logFile: string;
  private stream: any = null;
  private queue: string[] = [];
  private isWriting = false;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.Info;
    this.logDir = getLogDirectory();

    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      // If log dir can't be created, we'll still try to write to where we can
      // Do not throw in constructor
    }

    const name = options.name ?? 'open-s3';
    this.logFile = join(this.logDir, `${name}.log`);

    try {
      this.stream = createWriteStream(this.logFile, { flags: 'a' });
    } catch (err) {
      // If stream can't be created, logging to file won't happen
      this.stream = null;
    }
  }

  private write(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) return;
    if (!this.stream) return;

    const timestamp = formatTimestamp();
    const levelStr = formatLevel(level);
    const logEntry = `[${timestamp}] ${levelStr} ${message}`;

    const entry = data !== undefined ? `${logEntry} ${JSON.stringify(data)}` : logEntry;

    this.queue.push(entry);
    this.flush();
  }

  private flush(): void {
    if (this.isWriting || !this.stream || this.queue.length === 0) return;
    this.isWriting = true;
    const entry = this.queue.shift();

    if (entry) {
      this.stream.write(`${entry}\n`, () => {
        this.isWriting = false;
        if (this.queue.length > 0 && this.stream && !this.stream.destroyed) {
          this.flush();
        }
      });
    } else {
      this.isWriting = false;
    }
  }

  debug(message: string, data?: any): void {
    this.write(LogLevel.Debug, message, data);
  }

  info(message: string, data?: any): void {
    this.write(LogLevel.Info, message, data);
  }

  warn(message: string, data?: any): void {
    this.write(LogLevel.Warn, message, data);
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      const payload = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.write(LogLevel.Error, message, payload);
    } else {
      this.write(LogLevel.Error, message, error);
    }
  }

  close(): Promise<void> {
    return new Promise(resolve => {
      if (this.stream) {
        this.stream.end(() => {
          this.stream = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getLogFilePath(): string {
    return this.logFile;
  }

  getLogDirectoryPath(): string {
    return this.logDir;
  }
}

let globalLogger: Logger | null = null;
export function getLogger(options?: LoggerOptions): Logger {
  if (!globalLogger) globalLogger = new Logger(options);
  return globalLogger;
}

export function setLogLevel(level: LogLevel): void {
  if (globalLogger) globalLogger.level = level;
}

export async function shutdownLogger(): Promise<void> {
  if (globalLogger) {
    await globalLogger.close();
    globalLogger = null;
  }
}
