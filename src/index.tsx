#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { useState, useEffect, useCallback } from 'react';
import { FileExplorer } from './ui/file-explorer.js';
import { ProfileSelectorDialog } from './ui/dialog/profile-selector.js';
import { StorageProvider } from './providers/provider.js';
import { FileProfileManager } from './providers/services/file-profile-manager.js';
import type { ProfileManager } from './providers/services/profile-manager.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, setLogLevel, LogLevel } from './utils/logger.js';
import { KeyboardProvider, useKeyboardDispatch } from './contexts/KeyboardContext.js';
import { StorageContextProvider } from './contexts/StorageContextProvider.js';
import type { KeyboardKey, KeyboardDispatcher } from './types/keyboard.js';
import type { Profile } from './providers/types/profile.js';

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
 * Props for the main App wrapper
 */
interface AppWrapperProps {
  profileManager: ProfileManager;
}

/**
 * AppWrapper - Manages the provider lifecycle and profile selection
 *
 * Always starts with profile selector.
 * Once a profile is selected, creates the provider and renders FileExplorer.
 */
function AppWrapper({ profileManager }: AppWrapperProps) {
  const dispatch = useKeyboardDispatch();
  const [provider, setProvider] = useState<StorageProvider | undefined>(undefined);
  const [profileName, setProfileName] = useState<string | undefined>(undefined);
  const [isSelectingProfile, setIsSelectingProfile] = useState(true);

  // Connect the context dispatch to the global dispatcher
  useEffect(() => {
    setGlobalKeyboardDispatcher(dispatch);
    return () => {
      setGlobalKeyboardDispatcher(null);
    };
  }, [dispatch]);

  // Handle profile selection
  const handleProfileSelect = useCallback(
    async (profile: Profile) => {
      try {
        const newProvider = await profileManager.createProviderFromProfile(profile.id);
        setProvider(newProvider);
        setProfileName(profile.displayName);
        setIsSelectingProfile(false);
      } catch (err) {
        // Log error but stay on profile selector
        console.error(`Failed to load profile: ${(err as Error).message}`);
      }
    },
    [profileManager]
  );

  // Handle cancel - exit if no provider available
  const handleCancel = useCallback(() => {
    if (!provider) {
      // No provider available, exit the app
      process.exit(0);
    }
    setIsSelectingProfile(false);
  }, [provider]);

  // If we're selecting a profile (no provider yet), show the profile selector
  if (isSelectingProfile || !provider) {
    return (
      <ProfileSelectorDialog
        visible={true}
        profileManager={profileManager}
        onProfileSelect={handleProfileSelect}
        onCancel={handleCancel}
      />
    );
  }

  // We have a provider, render the full app
  return (
    <StorageContextProvider
      provider={provider}
      profileManager={profileManager}
      profileName={profileName}
    >
      <FileExplorer />
    </StorageContextProvider>
  );
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

    // Always create ProfileManager for profile management
    const profileManager = new FileProfileManager();
    logger.info('ProfileManager initialized');

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

          // Derive char from key name for printable characters
          // opentui's KeyEvent uses 'name' for the character (e.g., "a", "b", "1")
          // but doesn't provide a separate 'char' field
          let char = key.char;
          if (!char && keyName.length === 1) {
            // Single character key names are printable characters
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

    // Create and render app with context providers
    try {
      const root = createRoot(renderer);
      root.render(
        <KeyboardProvider>
          <AppWrapper profileManager={profileManager} />
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
