#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { S3Explorer } from './ui/s3-explorer.jsx';
import { Adapter } from './adapters/adapter.js';
import { MockAdapter } from './adapters/mock-adapter.js';
import { S3Adapter } from './adapters/s3-adapter.js';
import { ConfigManager } from './utils/config.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, setLogLevel, LogLevel } from './utils/logger.js';
import { getActiveAwsRegion } from './utils/aws-profile.js';

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
  try {
    // Parse CLI arguments first to check for debug flag
    const args = Bun.argv.slice(2);
    const cliArgs = parseArgs(args);

    // Initialize logger with appropriate level
    const logLevel = cliArgs.debug ? LogLevel.Debug : LogLevel.Info;
    const logger = getLogger({ level: logLevel });
    // Ensure log level is set in case logger was already initialized
    setLogLevel(logLevel);
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
      logger.debug('S3 config from configManager', {
        region: s3Config.region,
        bucket: s3Config.bucket,
        profile: s3Config.profile,
        endpoint: s3Config.endpoint,
      });

      // Determine region priority: CLI > config file > active profile > us-east-1
      let region = cliArgs.region || s3Config.region;
      logger.debug('Region resolution', {
        cliRegion: cliArgs.region,
        configRegion: s3Config.region,
        selected: region,
      });

      if (!region) {
        const profileRegion = getActiveAwsRegion();
        region = profileRegion || process.env.AWS_REGION || 'us-east-1';
        logger.debug('Region from profile or env', {
          profileRegion,
          envRegion: process.env.AWS_REGION,
          final: region,
        });
      }

      const finalS3Config = {
        region,
        bucket: cliArgs.bucket || s3Config.bucket || 'my-bucket',
        profile: cliArgs.profile,
        endpoint: cliArgs.endpoint || s3Config.endpoint,
        accessKeyId: cliArgs.accessKey || s3Config.accessKeyId,
        secretAccessKey: cliArgs.secretKey || s3Config.secretAccessKey,
      };

      logger.debug('Final S3 config before adapter creation', {
        region: finalS3Config.region,
        bucket: finalS3Config.bucket,
        profile: finalS3Config.profile,
        endpoint: finalS3Config.endpoint,
        hasAccessKey: !!finalS3Config.accessKeyId,
        hasSecretKey: !!finalS3Config.secretAccessKey,
      });

      adapter = new S3Adapter(finalS3Config);
      logger.info('S3 adapter initialized successfully', {
        region: finalS3Config.region,
        bucket: finalS3Config.bucket,
        profile: finalS3Config.profile || 'default',
      });
    } else {
      logger.debug('Initializing mock adapter');
      adapter = new MockAdapter();
      logger.info('Mock adapter initialized');
    }

    // Get bucket name - can be undefined for root view mode
    const bucket = cliArgs.bucket || configManager.getS3Config().bucket;
    logger.debug('Starting S3 Explorer', {
      bucket: bucket || '(root view mode)',
      adapterType,
      isRootViewMode: !bucket,
    });

    // Create and start renderer
    let renderer: any;
    try {
      renderer = await createCliRenderer({
        exitOnCtrlC: true,
      });
    } catch (rendererError) {
      logger.error('Failed to create CLI renderer', rendererError);
      throw rendererError;
    }

    // Setup keyboard event handling
    try {
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
    } catch (keyError) {
      logger.error('Failed to setup keyboard handler', keyError);
      throw keyError;
    }

    // Create and render app
    try {
      const root = createRoot(renderer);
      root.render(<S3Explorer bucket={bucket} adapter={adapter} configManager={configManager} />);
      logger.info('App rendered successfully');
    } catch (renderError) {
      logger.error('Failed to render app', renderError);
      throw renderError;
    }
  } catch (error) {
    const logger = getLogger();
    logger.error('Error in main', error);
    throw error;
  }
}

main().catch(async error => {
  console.error('Fatal error:', error);
  const logger = getLogger();
  try {
    logger.error('Fatal error occurred', error);
  } catch (logError) {
    console.error('Error logging fatal error:', logError);
  }
  try {
    await shutdownLogger();
  } catch (shutdownError) {
    console.error('Error shutting down logger:', shutdownError);
  }
  process.exit(1);
});
