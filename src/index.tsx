#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { S3Explorer } from './ui/s3-explorer.jsx';
import { Adapter } from './adapters/adapter.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { S3Adapter } from './adapters/s3-adapter.js';
import { ConfigManager } from './utils/config.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, LogLevel } from './utils/logger.js';

// Global keyboard event dispatcher - exported at module level
export let globalKeyboardDispatcher: ((key: any) => void) | null = null;

/**
 * Set the global keyboard event dispatcher
 */
export function setGlobalKeyboardDispatcher(dispatcher: ((key: any) => void) | null) {
  globalKeyboardDispatcher = dispatcher;
}

/**
 * Get the global keyboard event dispatcher
 */
export function getGlobalKeyboardDispatcher() {
  return globalKeyboardDispatcher;
}

/**
 * Main entry point for open-s3 application
 */
async function main() {
  // Parse CLI arguments first to check for debug flag
  const args = Bun.argv.slice(2);
  const cliArgs = parseArgs(args);

  // Initialize logger with appropriate level
  const logLevel = cliArgs.debug ? LogLevel.Debug : LogLevel.Info;
  const logger = getLogger({ level: logLevel });
  logger.info('Application starting', { args, debug: cliArgs.debug });

  // Handle help and version flags
  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  if (cliArgs.version) {
    printVersion();
    process.exit(0);
  }

  // Create config manager
  const configManager = new ConfigManager(cliArgs.config);
  logger.debug('Config manager initialized');

  // Determine adapter
  let adapter: Adapter;
  const adapterType = cliArgs.adapter || configManager.getAdapter();

  if (adapterType === 's3') {
    // Get S3 config from CLI args or config file
    const s3Config = configManager.getS3Config();
    const finalS3Config = {
      region: cliArgs.region || s3Config.region || 'us-east-1',
      bucket: cliArgs.bucket || s3Config.bucket || 'my-bucket',
      endpoint: cliArgs.endpoint || s3Config.endpoint,
      accessKeyId: cliArgs.accessKey || s3Config.accessKeyId,
      secretAccessKey: cliArgs.secretKey || s3Config.secretAccessKey,
    };

    logger.debug('Initializing S3 adapter', { config: { ...finalS3Config, secretAccessKey: '***' } });
    adapter = new S3Adapter(finalS3Config);
    logger.info('S3 adapter initialized', { region: finalS3Config.region, bucket: finalS3Config.bucket });
  } else {
    logger.debug('Initializing mock adapter');
    adapter = new MockAdapter();
    logger.info('Mock adapter initialized');
  }

  // Get bucket name
  const bucket = cliArgs.bucket || configManager.getS3Config().bucket || 'test-bucket';
  logger.debug('Starting S3 Explorer', { bucket, adapterType });

  // Create and start renderer
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  // Setup keyboard event handling
  renderer.keyInput.on('keypress', (key: any) => {
    if (globalKeyboardDispatcher) {
      // Normalize key object to match expected interface
      const normalizedKey = {
        name: key.name || key.key || 'unknown',
        ctrl: key.ctrl || key.ctrlKey || false,
        shift: key.shift || key.shiftKey || false,
        meta: key.meta || key.metaKey || false,
        char: key.char,
      };
      globalKeyboardDispatcher(normalizedKey);
    }
  });

  // Create and render app
  const root = createRoot(renderer);
  root.render(<S3Explorer bucket={bucket} adapter={adapter} configManager={configManager} />);
}

main()
  .catch(async (error) => {
    console.error('Fatal error:', error);
    const logger = getLogger();
    logger.error('Fatal error occurred', error);
    await shutdownLogger();
    process.exit(1);
  })
  .finally(async () => {
    // Ensure logger is shut down on normal exit
    await shutdownLogger();
  });
