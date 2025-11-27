/**
 * SFTP Credential Resolver
 *
 * Resolves SFTP credentials from multiple sources:
 * 1. SSH Agent
 * 2. Environment variables (SFTP_PASSWORD)
 * 3. Private key file
 * 4. Inline credentials in profile config
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  SFTPCredentials,
} from '../types.js';

// ============================================================================
// SSH Agent Credential Provider
// ============================================================================

/**
 * Resolves SFTP credentials using SSH agent
 */
export class SFTPAgentCredentialProvider implements CredentialProvider {
  readonly name = 'sftp-agent';
  readonly description = 'Resolve SFTP credentials using SSH agent';
  readonly priority = 100;

  canHandle(context: CredentialContext): boolean {
    if (context.providerType !== 'sftp') return false;

    // Check if SSH_AUTH_SOCK is set (indicates agent is available)
    return !!process.env.SSH_AUTH_SOCK;
  }

  async resolve(context: CredentialContext): Promise<CredentialResult<SFTPCredentials>> {
    // Check if agent is explicitly requested or available
    const useAgent = context.source?.type === 'sshAgent' || !!process.env.SSH_AUTH_SOCK;

    if (!useAgent) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'SSH agent not available (SSH_AUTH_SOCK not set)',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'sftp',
        source: 'sshAgent',
        useAgent: true,
      },
    };
  }
}

// ============================================================================
// Environment Credential Provider for SFTP
// ============================================================================

/**
 * Resolves SFTP credentials from environment variables
 */
export class SFTPEnvironmentCredentialProvider implements CredentialProvider {
  readonly name = 'sftp-environment';
  readonly description = 'Resolve SFTP credentials from environment variables';
  readonly priority = 200;

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'sftp';
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<SFTPCredentials>> {
    const password = process.env.SFTP_PASSWORD;

    if (!password) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'SFTP_PASSWORD not set in environment',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'sftp',
        source: 'environment',
        password,
      },
    };
  }
}

// ============================================================================
// Private Key File Credential Provider
// ============================================================================

/**
 * Default SSH key locations to check
 */
const DEFAULT_SSH_KEY_PATHS = [
  '~/.ssh/id_rsa',
  '~/.ssh/id_ed25519',
  '~/.ssh/id_ecdsa',
  '~/.ssh/id_dsa',
];

/**
 * Expand ~ to home directory
 */
function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Resolves SFTP credentials from private key file
 */
export class SFTPKeyFileCredentialProvider implements CredentialProvider {
  readonly name = 'sftp-keyfile';
  readonly description = 'Resolve SFTP credentials from private key file';
  readonly priority = 300;

  private privateKeyPath?: string;
  private passphrase?: string;

  /**
   * Set the path to the private key file
   */
  setPrivateKeyPath(path: string): void {
    this.privateKeyPath = path;
  }

  /**
   * Set the passphrase for encrypted private keys
   */
  setPassphrase(passphrase: string): void {
    this.passphrase = passphrase;
  }

  canHandle(context: CredentialContext): boolean {
    if (context.providerType !== 'sftp') return false;

    // Can handle if key file path is configured or if default keys exist
    if (this.privateKeyPath || context.source?.type === 'file') {
      return true;
    }

    // Check for default SSH keys
    return DEFAULT_SSH_KEY_PATHS.some(p => existsSync(expandPath(p)));
  }

  async resolve(context: CredentialContext): Promise<CredentialResult<SFTPCredentials>> {
    let keyPath = this.privateKeyPath;

    // Get from source hint if available
    if (context.source?.type === 'file') {
      keyPath = context.source.path;
    }

    // If no specific path, try default locations
    if (!keyPath) {
      for (const defaultPath of DEFAULT_SSH_KEY_PATHS) {
        const expanded = expandPath(defaultPath);
        if (existsSync(expanded)) {
          keyPath = expanded;
          break;
        }
      }
    }

    if (!keyPath) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No SSH private key found',
        },
      };
    }

    const expandedPath = expandPath(keyPath);

    if (!existsSync(expandedPath)) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: `Private key file not found: ${keyPath}`,
        },
      };
    }

    // Read the private key
    let privateKey: string;
    try {
      privateKey = readFileSync(expandedPath, 'utf-8');
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'access_denied',
          message: `Cannot read private key file: ${keyPath}`,
          cause: err as Error,
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'sftp',
        source: 'file',
        privateKey,
        passphrase: this.passphrase,
      },
    };
  }
}

// ============================================================================
// Inline Credential Provider for SFTP
// ============================================================================

/**
 * Resolves SFTP credentials from inline profile configuration
 */
export class SFTPInlineCredentialProvider implements CredentialProvider {
  readonly name = 'sftp-inline';
  readonly description = 'Resolve SFTP credentials from profile configuration';
  readonly priority = 500;

  private config?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config;
  }

  canHandle(context: CredentialContext): boolean {
    return context.providerType === 'sftp' && this.config !== undefined;
  }

  async resolve(_context: CredentialContext): Promise<CredentialResult<SFTPCredentials>> {
    if (!this.config) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      };
    }

    const password = this.config.password as string | undefined;
    const privateKeyPath = this.config.privateKeyPath as string | undefined;
    const passphrase = this.config.passphrase as string | undefined;
    const authMethod = this.config.authMethod as string | undefined;

    // For password auth
    if (authMethod === 'password') {
      if (!password) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: 'Password required for password authentication',
          },
        };
      }
      return {
        success: true,
        credentials: {
          type: 'sftp',
          source: 'inline',
          password,
        },
      };
    }

    // For key auth
    if (authMethod === 'key') {
      if (!privateKeyPath) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: 'Private key path required for key authentication',
          },
        };
      }

      const expandedPath = expandPath(privateKeyPath);
      if (!existsSync(expandedPath)) {
        return {
          success: false,
          error: {
            code: 'not_found',
            message: `Private key file not found: ${privateKeyPath}`,
          },
        };
      }

      let privateKey: string;
      try {
        privateKey = readFileSync(expandedPath, 'utf-8');
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'access_denied',
            message: `Cannot read private key file: ${privateKeyPath}`,
            cause: err as Error,
          },
        };
      }

      return {
        success: true,
        credentials: {
          type: 'sftp',
          source: 'inline',
          privateKey,
          passphrase,
        },
      };
    }

    // For agent auth
    if (authMethod === 'agent') {
      return {
        success: true,
        credentials: {
          type: 'sftp',
          source: 'inline',
          useAgent: true,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'not_found',
        message: 'No valid SFTP authentication method configured',
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an array of SFTP credential providers in priority order
 */
export function createSFTPCredentialProviders(): CredentialProvider[] {
  return [
    new SFTPAgentCredentialProvider(),
    new SFTPEnvironmentCredentialProvider(),
    new SFTPKeyFileCredentialProvider(),
    new SFTPInlineCredentialProvider(),
  ];
}
