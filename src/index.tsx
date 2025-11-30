#!/usr/bin/env bun

/**
 * Entry point for open-file application
 *
 * Sets up the CLI renderer with SolidJS.
 */

import { render } from '@opentui/solid';
import { App } from './ui/app.js';
import { FileProfileManager } from './providers/services/file-profile-manager.js';
import { parseArgs, printHelp, printVersion } from './utils/cli.js';
import { getLogger, shutdownLogger, setLogLevel, LogLevel } from './utils/logger.js';
import { openInExternalEditor } from './utils/external-editor.js';
import { getProfilesPath } from './providers/services/profile-storage.js';
import { initializeThemes } from './themes/index.js';

/**
 * Main entry point for open-file application
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

    // Initialize theme system before any rendering
    initializeThemes();
    logger.info('Theme system initialized');

    // Create ProfileManager for profile management
    const profileManager = new FileProfileManager();
    logger.info('ProfileManager initialized');

    /**
     * Handler to open profiles.json in external editor
     * Suspends the TUI, spawns the editor, then resumes and reloads profiles
     */
    const handleEditProfiles = async (): Promise<void> => {
      const profilesPath = getProfilesPath();
      logger.info('Opening profiles in external editor', { path: profilesPath });

      // TODO: Need to implement suspend/resume for editor
      try {
        const result = openInExternalEditor(profilesPath);

        if (!result.success) {
          logger.warn('Editor exited with error', { error: result.error });
        }
      } finally {
        // Reload profiles from disk to pick up any changes
        try {
          await profileManager.reload();
          logger.info('Profiles reloaded after editor close');
        } catch (reloadError) {
          logger.error('Failed to reload profiles', reloadError);
        }
      }
    };

    // Render app using OpenTUI Solid renderer
    // Keyboard handling is done via useKeyboard hook inside the App/KeyboardProvider
    await render(
      () => (
        <App
          profileManager={profileManager}
          onExitWithoutProvider={() => {
            // No profile selected and selector closed; terminate the CLI
            process.exit(0);
          }}
          onEditProfiles={handleEditProfiles}
        />
      ),
      {
        targetFps: 60,
        exitOnCtrlC: false,
        useKittyKeyboard: true,
      }
    );
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
