/**
 * Tests for OS-aware logging infrastructure
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, LogLevel, getLogger, shutdownLogger } from './logger.js';
import { existsSync } from 'fs';
import { homedir } from 'os';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.Debug });
  });

  afterEach(async () => {
    await logger.close();
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger.level).toBe(LogLevel.Debug);
  });

  it('should get log file path', () => {
    const logPath = logger.getLogFilePath();
    expect(logPath).toBeTruthy();
    expect(logPath.includes('open-file')).toBe(true);
  });

  it('should get log directory path', () => {
    const logDir = logger.getLogDirectoryPath();
    expect(logDir).toBeTruthy();
    expect(logDir.includes('open-file')).toBe(true);
  });

  it('should create log directory if it does not exist', () => {
    const logDir = logger.getLogDirectoryPath();
    expect(existsSync(logDir)).toBe(true);
  });

  it('should write debug logs', async () => {
    logger.debug('Debug message');
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should write info logs', async () => {
    logger.info('Info message');
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should write warn logs', async () => {
    logger.warn('Warning message');
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should write error logs with Error object', async () => {
    const error = new Error('Test error');
    logger.error('Error occurred', error);
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should write error logs with data', async () => {
    logger.error('Error occurred', { code: 'TEST_ERROR', details: 'some details' });
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should respect log level filtering', async () => {
    const infoLogger = new Logger({ level: LogLevel.Info });
    infoLogger.debug('This should not be logged');
    infoLogger.info('This should be logged');
    await new Promise(resolve => setTimeout(resolve, 100));
    await infoLogger.close();
  });

  it('should write logs with data', async () => {
    logger.info('User action', { action: 'navigate', path: '/bucket/folder' });
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should create log file', async () => {
    logger.info('Test message');
    await new Promise(resolve => setTimeout(resolve, 100));

    const logPath = logger.getLogFilePath();
    expect(existsSync(logPath)).toBe(true);
  });
});

describe('Global logger', () => {
  afterEach(async () => {
    await shutdownLogger();
  });

  it('should get or create global logger', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    expect(logger1).toBe(logger2);
  });

  it('should accept options on first creation', () => {
    const logger = getLogger({ level: LogLevel.Error });
    expect(logger.level).toBe(LogLevel.Error);
  });

  it('should shutdown logger', async () => {
    const logger = getLogger();
    await shutdownLogger();
    const newLogger = getLogger();
    expect(newLogger).not.toBe(logger);
  });
});

describe('Log directory detection', () => {
  it('should identify correct directory for OS', () => {
    const logger = new Logger();
    const logDir = logger.getLogDirectoryPath();

    // Should contain open-file in the path
    expect(logDir.includes('open-file')).toBe(true);

    // Should be under home directory or platform-specific locations
    const home = homedir();
    expect(logDir.includes(home) || logDir.includes('AppData')).toBe(true);
  });
});
