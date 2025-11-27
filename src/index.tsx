#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { useEffect } from 'react';
import { S3Explorer } from './ui/s3-explorer.jsx';
import { StorageProvider } from './providers/provider.js';
import { S3Provider } from './providers/s3/s3-provider.js';
import { FileProfileManager } from './providers/services/file-profile-manager.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, setLogLevel, LogLevel } from './utils/logger.js';
import { getActiveAwsRegion } from './utils/aws-profile.js';
import { KeyboardProvider, useKeyboardDispatch } from './contexts/KeyboardContext.js';
import { StorageContextProvider } from './contexts/StorageContextProvider.js';
import { isNewProviderSystemEnabled } from './utils/feature-flags.js';
import type { KeyboardKey, KeyboardDispatcher } from './types/keyboard.js';
import type { S3Profile } from './providers/types/profile.js';

// Global keyboard event dispatcher - bridges external renderer to React context
// This is set once when App mounts and provides the dispatch function from context
let globalKeyboardDispatcher: KeyboardDispatcher | null = null;

/**
 * Set the global keyboard event dispatcher (called internally by App component)
 */
function setGlobalKeyboardDispatcher(dispatcher: KeyboardDispatcher | null) {
  globalKeyboardDispatcher = dispatcher;
}

/**
 * Get the global keyboard event dispatcher
 */
export function getGlobalKeyboardDispatcher() {
  return globalKeyboardDispatcher;
}

/**
 * App component props
 */
interface AppProps {
  bucket?: string;
  provider: StorageProvider;
}

/**
 * App component that connects keyboard events to the React context
 */
function App({ bucket, provider }: AppProps) {
  const dispatch = useKeyboardDispatch();

  // Connect the context dispatch to the global dispatcher
  // This bridges the external renderer's keypress events to React
  useEffect(() => {
    setGlobalKeyboardDispatcher(dispatch);
    return () => {
      setGlobalKeyboardDispatcher(null);
    };
  }, [dispatch]);

  return <S3Explorer bucket={bucket} />;
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

    // Determine adapter type from CLI args (defaults to 's3')
    let provider: StorageProvider;
    const adapterType = cliArgs.adapter || 's3';

    if (adapterType === 's3') {
      // Determine region priority: CLI > active profile > env var > us-east-1
      let region = cliArgs.region;

      if (!region) {
        const profileRegion = getActiveAwsRegion();
        region = profileRegion || process.env.AWS_REGION || 'us-east-1';
      }

      const finalS3Config = {
        region,
        bucket: cliArgs.bucket || 'my-bucket',
        profile: cliArgs.profile,
        endpoint: cliArgs.endpoint,
        accessKeyId: cliArgs.accessKey,
        secretAccessKey: cliArgs.secretKey,
      };

      const s3Profile: S3Profile = {
        id: 'cli-s3-profile',
        displayName: 'CLI S3 Profile',
        provider: 's3',
        config: {
          region: finalS3Config.region,
          profile: finalS3Config.profile,
          endpoint: finalS3Config.endpoint,
          accessKeyId: finalS3Config.accessKeyId,
          secretAccessKey: finalS3Config.secretAccessKey,
        },
      };
      provider = new S3Provider(s3Profile);
      logger.info('S3 provider initialized successfully', {
        region: finalS3Config.region,
        bucket: finalS3Config.bucket,
        profile: finalS3Config.profile || 'default',
      });
    } else {
      // TODO: Create MockProvider when available
      // For now, throw an error for mock mode
      throw new Error('Mock mode not yet supported with provider system. Use S3 adapter type.');
    }

    // Get bucket name - can be undefined for root view mode
    const bucket = cliArgs.bucket;

    // Create ProfileManager if new provider system is enabled
    let profileManager;
    if (isNewProviderSystemEnabled()) {
      profileManager = new FileProfileManager();
      logger.info('ProfileManager initialized');
    }

    // Create and start renderer
    // Note: Using type assertion for external library type
    type CliRenderer = Awaited<ReturnType<typeof createCliRenderer>> & {
      keyInput: { on: (event: string, handler: (key: RawKeyEvent) => void) => void };
    };
    interface RawKeyEvent {
      name?: string;
      key?: string;
      ctrl?: boolean;
      ctrlKey?: boolean;
      shift?: boolean;
      shiftKey?: boolean;
      meta?: boolean;
      metaKey?: boolean;
      char?: string;
    }

    let renderer: CliRenderer;
    try {
      renderer = (await createCliRenderer({
        exitOnCtrlC: true,
      })) as CliRenderer;
    } catch (rendererError) {
      logger.error('Failed to create CLI renderer', rendererError);
      throw rendererError;
    }

    // Setup keyboard event handling
    try {
      renderer.keyInput.on('keypress', (key: RawKeyEvent) => {
        if (globalKeyboardDispatcher) {
          // Normalize key name - standardize on 'return' for enter key
          let keyName = key.name || key.key || 'unknown';
          if (keyName === 'enter') {
            keyName = 'return';
          }

          // Normalize key object to match expected interface
          const normalizedKey: KeyboardKey = {
            name: keyName,
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

    // Create and render app with context providers
    try {
      const root = createRoot(renderer);
      root.render(
        <KeyboardProvider>
          <StorageContextProvider provider={provider} profileManager={profileManager}>
            <App bucket={bucket} provider={provider} />
          </StorageContextProvider>
        </KeyboardProvider>
      );
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
