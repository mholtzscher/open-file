#!/usr/bin/env bun

/**
 * Entry point for open-s3 application
 *
 * Sets up the CLI renderer and bridges keyboard events to the App.
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './ui/app.js';
import { FileProfileManager } from './providers/services/file-profile-manager.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, setLogLevel, LogLevel } from './utils/logger.js';
import type { KeyboardKey, KeyboardDispatcher } from './types/keyboard.js';

// Global keyboard event dispatcher - bridges external renderer to React context
let globalKeyboardDispatcher: KeyboardDispatcher | null = null;

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

    // Create ProfileManager for profile management
    const profileManager = new FileProfileManager();
    logger.info('ProfileManager initialized');

    // Create CLI renderer
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

    // Setup keyboard event handling - bridge renderer events to React context
    try {
      renderer.keyInput.on('keypress', (key: RawKeyEvent) => {
        if (globalKeyboardDispatcher) {
          // Normalize key name - standardize on 'return' for enter key
          let keyName = key.name || key.key || 'unknown';
          if (keyName === 'enter') {
            keyName = 'return';
          }

          // Derive char from key name for printable characters
          let char = key.char;
          if (!char && keyName.length === 1) {
            char = keyName;
          }

          // Normalize key object to match expected interface
          const normalizedKey: KeyboardKey = {
            name: keyName,
            ctrl: key.ctrl || key.ctrlKey || false,
            shift: key.shift || key.shiftKey || false,
            meta: key.meta || key.metaKey || false,
            char: char,
          };
          globalKeyboardDispatcher(normalizedKey);
        }
      });
    } catch (keyError) {
      logger.error('Failed to setup keyboard handler', keyError);
      throw keyError;
    }

    // Render app
    try {
      const root = createRoot(renderer);
      root.render(
        <App
          profileManager={profileManager}
          onDispatchReady={dispatch => {
            globalKeyboardDispatcher = dispatch;
          }}
          onExitWithoutProvider={() => {
            // No profile selected and selector closed; terminate the CLI
            process.exit(0);
          }}
        />
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
