/**
 * Google Drive OAuth2 Authentication Utilities
 *
 * Handles OAuth2 client initialization, token refresh, and service account authentication.
 */

import { google, type drive_v3 } from 'googleapis';
import type { GoogleDriveProfile } from '../../types/profile.js';
import { readFileSync } from 'fs';

// ============================================================================
// Bun Compatibility - gaxios fetch workaround
// ============================================================================

/**
 * Workaround for gaxios 7.x Bun compatibility issue.
 *
 * gaxios dynamically imports node-fetch via `await import('node-fetch')` but
 * this returns undefined in certain Bun contexts (particularly during React/OpenTUI
 * render cycles). By passing `fetchImplementation: globalThis.fetch` via
 * transporterOptions, we ensure Bun's native fetch is used instead.
 */
const BUN_TRANSPORTER_OPTIONS = {
  fetchImplementation: globalThis.fetch,
};

// ============================================================================
// Constants
// ============================================================================

/** Full Google Drive access scope */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/** Google Workspace document MIME types that cannot be directly downloaded */
export const GOOGLE_WORKSPACE_MIMETYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.script',
  'application/vnd.google-apps.site',
  'application/vnd.google-apps.jam', // Jamboard
  'application/vnd.google-apps.map',
] as const;

/** MIME type for Google Drive folders */
export const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

/** MIME type for Google Drive shortcuts (like symlinks) */
export const SHORTCUT_MIMETYPE = 'application/vnd.google-apps.shortcut';

// ============================================================================
// Types
// ============================================================================

/** Type alias for OAuth2Client from googleapis */
export type OAuth2ClientType = InstanceType<typeof google.auth.OAuth2>;

/**
 * Result of creating a Drive client
 *
 * Note: oauth2Client is only functional for OAuth2 authentication.
 * For service accounts, it's undefined - the googleapis library handles
 * auth internally via GoogleAuth.
 */
export interface DriveClientResult {
  success: true;
  drive: drive_v3.Drive;
  /** OAuth2 client - only set for OAuth2 auth, undefined for service accounts */
  oauth2Client?: OAuth2ClientType;
}

/**
 * Error result for Drive client creation
 */
export interface DriveClientError {
  success: false;
  error: string;
  code: 'missing_credentials' | 'missing_refresh_token' | 'invalid_key_file' | 'auth_failed';
}

export type CreateDriveClientResult = DriveClientResult | DriveClientError;

// ============================================================================
// OAuth2 Client Creation
// ============================================================================

/**
 * Create an OAuth2 client from profile configuration
 *
 * Supports:
 * 1. OAuth2 with refresh token (for personal accounts)
 * 2. Service account with optional impersonation (for Workspace)
 */
export function createDriveClient(profile: GoogleDriveProfile): CreateDriveClientResult {
  const { config } = profile;

  // Service account authentication
  if (config.keyFilePath) {
    return createServiceAccountClient(config.keyFilePath, config.impersonateEmail);
  }

  // OAuth2 authentication
  if (config.clientId && config.clientSecret) {
    if (!config.refreshToken) {
      return {
        success: false,
        error:
          'OAuth2 credentials found but refreshToken is missing. Run "open-file auth gdrive" to authenticate.',
        code: 'missing_refresh_token',
      };
    }
    return createOAuth2Client(config.clientId, config.clientSecret, config.refreshToken);
  }

  return {
    success: false,
    error: 'No valid credentials found. Provide either keyFilePath or clientId/clientSecret.',
    code: 'missing_credentials',
  };
}

/**
 * Create an OAuth2 client with client credentials and optional refresh token
 */
function createOAuth2Client(
  clientId: string,
  clientSecret: string,
  refreshToken?: string
): CreateDriveClientResult {
  // Pass transporterOptions to ensure Bun's native fetch is used
  // This fixes gaxios 7.x compatibility issues where dynamic import of node-fetch fails
  const oauth2Client = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: 'http://127.0.0.1', // Redirect URI placeholder, actual port set during auth
    transporterOptions: BUN_TRANSPORTER_OPTIONS,
  });

  if (refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  return {
    success: true,
    drive,
    oauth2Client,
  };
}

/**
 * Create a service account client with optional user impersonation
 */
function createServiceAccountClient(
  keyFilePath: string,
  impersonateEmail?: string
): CreateDriveClientResult {
  let keyFileContent: string;
  try {
    keyFileContent = readFileSync(keyFilePath, 'utf-8');
  } catch (err) {
    return {
      success: false,
      error: `Cannot read service account key file: ${keyFilePath}`,
      code: 'invalid_key_file',
    };
  }

  let keyData: { client_email?: string; private_key?: string };
  try {
    keyData = JSON.parse(keyFileContent);
  } catch {
    return {
      success: false,
      error: `Invalid JSON in service account key file: ${keyFilePath}`,
      code: 'invalid_key_file',
    };
  }

  if (!keyData.client_email || !keyData.private_key) {
    return {
      success: false,
      error: 'Service account key file missing client_email or private_key',
      code: 'invalid_key_file',
    };
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: [DRIVE_SCOPE],
    clientOptions: {
      subject: impersonateEmail,
      transporterOptions: BUN_TRANSPORTER_OPTIONS,
    },
  });

  const drive = google.drive({ version: 'v3', auth });

  // Note: oauth2Client is undefined for service accounts - GoogleAuth handles auth internally
  return {
    success: true,
    drive,
  };
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Refresh the access token if needed
 *
 * The googleapis library typically handles this automatically,
 * but this can be called explicitly if needed.
 */
export async function refreshAccessToken(oauth2Client: OAuth2ClientType): Promise<string | null> {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Check if credentials are valid by making a simple API call
 */
export async function validateCredentials(drive: drive_v3.Drive): Promise<boolean> {
  try {
    // Try to get info about the root folder
    await drive.files.get({
      fileId: 'root',
      fields: 'id',
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a MIME type is a Google Workspace document
 */
export function isGoogleWorkspaceDocument(mimeType: string): boolean {
  return GOOGLE_WORKSPACE_MIMETYPES.includes(
    mimeType as (typeof GOOGLE_WORKSPACE_MIMETYPES)[number]
  );
}

/**
 * Check if a MIME type is a folder
 */
export function isFolder(mimeType: string): boolean {
  return mimeType === FOLDER_MIMETYPE;
}

/**
 * Check if a MIME type is a shortcut
 */
export function isShortcut(mimeType: string): boolean {
  return mimeType === SHORTCUT_MIMETYPE;
}

/**
 * Get the export MIME type for a Google Workspace document
 *
 * @param sourceMimeType - The Google Workspace MIME type
 * @param targetFormat - The desired export format
 * @returns The MIME type to use for export, or null if not exportable
 */
export function getExportMimeType(
  sourceMimeType: string,
  targetFormat: 'pdf' | 'docx' | 'txt'
): string | null {
  // Map of Google Workspace types to export formats
  const exportMap: Record<string, Record<string, string>> = {
    'application/vnd.google-apps.document': {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    },
    'application/vnd.google-apps.spreadsheet': {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      txt: 'text/csv',
    },
    'application/vnd.google-apps.presentation': {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      txt: 'text/plain',
    },
    'application/vnd.google-apps.drawing': {
      pdf: 'application/pdf',
      docx: 'image/png',
      txt: 'image/svg+xml',
    },
  };

  return exportMap[sourceMimeType]?.[targetFormat] || null;
}
