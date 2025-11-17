/**
 * OS-aware logging infrastructure
 * 
 * Writes logs to appropriate OS-specific directories:
 * - Linux: $XDG_STATE_HOME/open-s3/logs (or ~/.local/state/open-s3/logs)
 * - macOS: ~/Library/Logs/open-s3
 * - Windows: %LOCALAPPDATA%/open-s3/logs
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
  maxFileSize?: number; // in bytes, default 10MB
  maxFiles?: number; // number of rotated files to keep
}

/**
 * Get OS-specific log directory
 */
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

/**
 * Format log timestamp
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format log level as string
 */
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

/**
 * Logger class for file-based logging
 */
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

    // Ensure log directory exists
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create log directory ${this.logDir}:`, err);
    }

    const name = options.name ?? 'open-s3';
    this.logFile = join(this.logDir, `${name}.log`);

    // Create write stream
    try {
      this.stream = createWriteStream(this.logFile, { flags: 'a' });
    } catch (err) {
      console.error(`Failed to create log file ${this.logFile}:`, err);
    }
  }

  /**
   * Write log entry
   */
  private write(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) {
      return;
    }

    // Don't write if stream is closed
    if (!this.stream) {
      return;
    }

    const timestamp = formatTimestamp();
    const levelStr = formatLevel(level);
    const logEntry = `[${timestamp}] ${levelStr} ${message}`;
    
    if (data !== undefined) {
      this.queue.push(`${logEntry} ${JSON.stringify(data)}`);
    } else {
      this.queue.push(logEntry);
    }

    this.flush();
  }

  /**
   * Flush queued log entries to file
   */
  private flush(): void {
    if (this.isWriting || !this.stream || this.queue.length === 0) {
      return;
    }

    this.isWriting = true;
    const entry = this.queue.shift();
    
    if (entry) {
      try {
        this.stream.write(`${entry}\n`, (err: any) => {
          this.isWriting = false;
          if (err) {
            // Silently ignore write errors (stream might be closed)
            if (err.code !== 'ERR_STREAM_DESTROYED') {
              console.error('Failed to write log:', err);
            }
          }
          if (this.queue.length > 0 && this.stream) {
            this.flush();
          }
        });
      } catch (error) {
        // Silently ignore write errors during shutdown
        this.isWriting = false;
      }
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.Debug) {
      console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
    this.write(LogLevel.Debug, message, data);
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    if (this.level <= LogLevel.Info) {
      console.error(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
    this.write(LogLevel.Info, message, data);
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.Warn) {
      console.error(`[WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
    this.write(LogLevel.Warn, message, data);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      this.write(LogLevel.Error, message, {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error(`[ERROR] ${message}`, error);
      this.write(LogLevel.Error, message, error);
    }
  }

  /**
   * Close the logger
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
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

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * Get log directory path
   */
  getLogDirectoryPath(): string {
    return this.logDir;
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create global logger
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(options);
  }
  return globalLogger;
}

/**
 * Set log level globally
 */
export function setLogLevel(level: LogLevel): void {
  if (globalLogger) {
    globalLogger.level = level;
  }
}

/**
 * Shutdown logger (flush and close)
 */
export async function shutdownLogger(): Promise<void> {
  if (globalLogger) {
    await globalLogger.close();
    globalLogger = null;
  }
}
