/**
 * Google Drive Authentication Command
 *
 * Handles OAuth2 authentication flow for Google Drive provider.
 * Supports both browser-based loopback redirect and manual code entry for headless environments.
 */

import { google } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import { createServer, type Server } from 'http';
import { parse as parseUrl } from 'url';
import { randomBytes, createHash } from 'crypto';
import { platform } from 'os';
import { spawn } from 'child_process';
import { DRIVE_SCOPE } from '../providers/gdrive/utils/auth.js';
import { loadProfilesFromDisk, saveProfilesToDisk } from '../providers/services/profile-storage.js';
import type { GoogleDriveProfile } from '../providers/types/profile.js';

// ============================================================================
// Types
// ============================================================================

export interface AuthGDriveOptions {
  /** Profile ID to update (or create if doesn't exist) */
  profileId: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** Force headless mode (manual code entry) */
  headless?: boolean;
  /** Display name for the profile */
  displayName?: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  refreshToken?: string;
}

// ============================================================================
// PKCE Utilities
// ============================================================================

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be 43-128 characters of unreserved URI characters
 */
function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substring(0, 43);
}

/**
 * Generate code challenge from verifier using S256 method
 */
function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if we're in an environment where we can open a browser
 */
function canOpenBrowser(): boolean {
  // Check for SSH session
  if (process.env.SSH_TTY || process.env.SSH_CLIENT || process.env.SSH_CONNECTION) {
    return false;
  }

  // Check for display on Linux
  if (platform() === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return false;
  }

  // macOS and Windows can generally open browsers
  return true;
}

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): boolean {
  try {
    const plat = platform();
    let command: string;
    let args: string[];

    switch (plat) {
      case 'darwin':
        command = 'open';
        args = [url];
        break;
      case 'win32':
        command = 'cmd';
        args = ['/c', 'start', '', url];
        break;
      default: // Linux and others
        command = 'xdg-open';
        args = [url];
        break;
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Local Server for OAuth Redirect
// ============================================================================

/**
 * Start a local HTTP server to capture OAuth redirect
 * Returns a promise that resolves with the server and port once it's listening
 */
function createLocalServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({ server, port: address.port });
      } else {
        reject(new Error('Failed to get server address'));
      }
    });

    server.on('error', reject);
  });
}

/**
 * Wait for the OAuth callback on the server
 * Returns the authorization code
 */
function waitForCallback(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => {
        server.close();
        reject(new Error('Authentication timed out after 5 minutes'));
      },
      5 * 60 * 1000
    );

    server.on('request', (req, res) => {
      const urlParts = parseUrl(req.url || '', true);

      if (urlParts.pathname === '/callback' || urlParts.pathname === '/') {
        const code = urlParts.query.code as string | undefined;
        const error = urlParts.query.error as string | undefined;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          clearTimeout(timeoutId);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          clearTimeout(timeoutId);
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });
  });
}

// ============================================================================
// Authentication Flow
// ============================================================================

/**
 * Run the OAuth2 authentication flow
 */
export async function authenticateGDrive(options: AuthGDriveOptions): Promise<AuthResult> {
  const { clientId, clientSecret, headless } = options;

  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Determine if we should use browser or manual flow
  const useBrowser = !headless && canOpenBrowser();

  let authCode: string;
  let redirectUri: string;

  if (useBrowser) {
    // Browser-based flow with local server
    console.log('Starting browser-based authentication...');

    try {
      // Start local server first and get the port
      const { server, port } = await createLocalServer();

      redirectUri = `http://127.0.0.1:${port}`;

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [DRIVE_SCOPE],
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'consent', // Force consent to get refresh token
      });

      console.log('\nOpening browser for Google authentication...');
      console.log('If the browser does not open automatically, visit this URL:\n');
      console.log(authUrl);
      console.log('');

      const opened = openBrowser(authUrl);
      if (!opened) {
        console.log('Could not open browser automatically.');
      }

      console.log('Waiting for authentication...');

      // Wait for the callback
      authCode = await waitForCallback(server);
    } catch (err) {
      return {
        success: false,
        message: `Browser authentication failed: ${(err as Error).message}`,
      };
    }
  } else {
    // Headless flow - still use loopback, user must forward port via SSH
    // Note: Google deprecated OOB flow in 2022, so we must use loopback even headless
    try {
      const { server, port } = await createLocalServer();

      console.log('Starting authentication in headless mode...');
      console.log('');
      console.log('NOTE: Google requires a loopback redirect. If you are on a remote server,');
      console.log('forward the port to your local machine:');
      console.log(`  ssh -L ${port}:localhost:${port} your-server`);
      console.log('');

      redirectUri = `http://127.0.0.1:${port}`;

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [DRIVE_SCOPE],
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'consent',
      });

      console.log('Visit this URL to authenticate:\n');
      console.log(authUrl);
      console.log('');
      console.log('Waiting for authentication...');

      authCode = await waitForCallback(server);
    } catch (err) {
      return {
        success: false,
        message: `Authentication failed: ${(err as Error).message}`,
      };
    }
  }

  // Exchange authorization code for tokens
  console.log('\nExchanging authorization code for tokens...');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken({
      code: authCode,
      codeVerifier: codeVerifier,
    });

    if (!tokens.refresh_token) {
      return {
        success: false,
        message:
          'No refresh token received. This may happen if you have already authorized this app. Try revoking access at https://myaccount.google.com/permissions and try again.',
      };
    }

    // Save to profile
    const saveResult = saveRefreshTokenToProfile(options, tokens.refresh_token);
    if (!saveResult.success) {
      return saveResult;
    }

    console.log('\nAuthentication successful!');
    console.log(`Refresh token saved to profile: ${options.profileId}`);

    return {
      success: true,
      message: 'Authentication successful',
      refreshToken: tokens.refresh_token,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to exchange authorization code: ${(err as Error).message}`,
    };
  }
}

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Save refresh token to profile configuration
 */
function saveRefreshTokenToProfile(options: AuthGDriveOptions, refreshToken: string): AuthResult {
  const { profileId, clientId, clientSecret, displayName } = options;

  // Load existing profiles
  const loadResult = loadProfilesFromDisk();
  if (!loadResult.success) {
    return {
      success: false,
      message: `Failed to load profiles: ${loadResult.error.message}`,
    };
  }

  const profiles = loadResult.profiles;

  // Find or create the profile
  const existingIndex = profiles.findIndex(p => p.id === profileId);

  let gdriveProfile: GoogleDriveProfile = {
    id: profileId,
    displayName: displayName || `Google Drive (${profileId})`,
    provider: 'gdrive',
    config: {
      clientId,
      clientSecret,
      refreshToken,
    },
  };

  if (existingIndex >= 0) {
    // Update existing profile
    const existing = profiles[existingIndex];
    if (existing.provider !== 'gdrive') {
      return {
        success: false,
        message: `Profile "${profileId}" exists but is not a Google Drive profile`,
      };
    }
    // Preserve existing settings, update credentials
    const existingGDrive = existing as GoogleDriveProfile;
    gdriveProfile = {
      ...gdriveProfile,
      displayName: existingGDrive.displayName,
      config: {
        ...existingGDrive.config,
        clientId,
        clientSecret,
        refreshToken,
      },
    };
    profiles[existingIndex] = gdriveProfile;
  } else {
    // Add new profile
    profiles.push(gdriveProfile);
  }

  // Save profiles
  const saveResult = saveProfilesToDisk(profiles);
  if (!saveResult.success) {
    return {
      success: false,
      message: `Failed to save profiles: ${saveResult.error.message}`,
    };
  }

  return {
    success: true,
    message: 'Profile saved successfully',
  };
}

// ============================================================================
// CLI Helpers
// ============================================================================

/**
 * Read a line from stdin
 */
function readLine(prompt: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(prompt);

    let input = '';

    const onData = (data: Buffer) => {
      const str = data.toString();
      input += str;
      if (str.includes('\n')) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        // Restore terminal settings if needed
        if (process.stdin.setRawMode) {
          try {
            process.stdin.setRawMode(false);
          } catch {
            // Ignore errors
          }
        }
        resolve(input.trim());
      }
    };

    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Result of parsing auth args
 */
export type ParseAuthArgsResult =
  | { type: 'options'; options: AuthGDriveOptions }
  | { type: 'help' }
  | { type: 'error'; message: string };

/**
 * Parse command line arguments for auth command
 */
export function parseAuthArgs(args: string[]): ParseAuthArgsResult {
  let profileId = '';
  let clientId = '';
  let clientSecret = '';
  let headless = false;
  let displayName: string | undefined;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--profile' || arg === '-p') {
      profileId = args[++i] || '';
    } else if (arg === '--client-id') {
      clientId = args[++i] || '';
    } else if (arg === '--client-secret') {
      clientSecret = args[++i] || '';
    } else if (arg === '--headless' || arg === '--no-browser') {
      headless = true;
    } else if (arg === '--name') {
      displayName = args[++i] || '';
    } else if (!arg.startsWith('-') && !profileId) {
      // First positional argument is profile ID
      profileId = arg;
    }
  }

  // Show help if requested
  if (showHelp) {
    return { type: 'help' };
  }

  // Validate required arguments
  if (!profileId) {
    return {
      type: 'error',
      message:
        'Profile ID is required\nUsage: open-file auth gdrive <profile-id> --client-id <id> --client-secret <secret>',
    };
  }

  if (!clientId) {
    return {
      type: 'error',
      message:
        '--client-id is required\nUsage: open-file auth gdrive <profile-id> --client-id <id> --client-secret <secret>',
    };
  }

  if (!clientSecret) {
    return {
      type: 'error',
      message:
        '--client-secret is required\nUsage: open-file auth gdrive <profile-id> --client-id <id> --client-secret <secret>',
    };
  }

  return {
    type: 'options',
    options: {
      profileId,
      clientId,
      clientSecret,
      headless,
      displayName,
    },
  };
}

/**
 * Run the auth command
 */
export async function runAuthCommand(args: string[]): Promise<number> {
  const parseResult = parseAuthArgs(args);

  if (parseResult.type === 'help') {
    printAuthHelp();
    return 0;
  }

  if (parseResult.type === 'error') {
    console.error(`Error: ${parseResult.message}`);
    return 1;
  }

  const result = await authenticateGDrive(parseResult.options);

  if (result.success) {
    return 0;
  } else {
    console.error(`\nError: ${result.message}`);
    return 1;
  }
}

/**
 * Print help for auth command
 */
export function printAuthHelp(): void {
  console.log(`
open-file auth gdrive - Authenticate with Google Drive

USAGE:
  open-file auth gdrive <profile-id> --client-id <id> --client-secret <secret> [OPTIONS]

ARGUMENTS:
  <profile-id>          ID for the profile (e.g., "my-gdrive")

REQUIRED OPTIONS:
  --client-id <id>      OAuth2 client ID from Google Cloud Console
  --client-secret <s>   OAuth2 client secret

OPTIONS:
  --name <name>         Display name for the profile
  --headless            Force manual code entry (for SSH/remote sessions)
  -p, --profile <id>    Alternative way to specify profile ID

SETUP:
  1. Go to https://console.cloud.google.com/
  2. Create a new project or select existing
  3. Enable the Google Drive API
  4. Go to Credentials > Create Credentials > OAuth client ID
  5. Select "Desktop app" as application type
  6. Download or copy the client ID and secret

EXAMPLE:
  open-file auth gdrive my-gdrive \\
    --client-id "123456789.apps.googleusercontent.com" \\
    --client-secret "GOCSPX-abc123"
`);
}
