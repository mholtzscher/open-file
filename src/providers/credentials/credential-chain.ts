/**
 * Credential Chain
 *
 * Tries multiple credential providers in priority order until one succeeds.
 * This is the primary entry point for credential resolution.
 */

import type {
  CredentialProvider,
  CredentialContext,
  CredentialResult,
  Credentials,
  CredentialError,
} from './types.js';

// ============================================================================
// Credential Chain
// ============================================================================

/**
 * Options for CredentialChain
 */
export interface CredentialChainOptions {
  /**
   * Stop after first successful provider
   * Default: true
   */
  stopOnSuccess?: boolean;

  /**
   * Log provider attempts (for debugging)
   * Default: false
   */
  verbose?: boolean;
}

/**
 * Result of chain resolution with additional metadata
 */
export interface ChainResolutionResult<T extends Credentials = Credentials> {
  /** Whether credentials were resolved */
  success: boolean;
  /** Resolved credentials (if success) */
  credentials?: T;
  /** Name of provider that succeeded */
  resolvedBy?: string;
  /** Errors from all providers that were tried */
  errors: Array<{ provider: string; error: CredentialError }>;
  /** Names of providers that were skipped (canHandle returned false) */
  skipped: string[];
}

/**
 * CredentialChain tries multiple credential providers in priority order
 *
 * Usage:
 * ```typescript
 * const chain = new CredentialChain();
 * chain.register(new EnvironmentCredentialProvider());
 * chain.register(new KeychainCredentialProvider());
 * chain.register(new PromptCredentialProvider());
 *
 * const result = await chain.resolve({ providerType: 's3', profileId: 'prod' });
 * if (result.success) {
 *   console.log('Resolved by:', result.resolvedBy);
 *   console.log('Credentials:', result.credentials);
 * }
 * ```
 */
export class CredentialChain {
  private providers: CredentialProvider[] = [];
  private readonly options: Required<CredentialChainOptions>;

  constructor(options: CredentialChainOptions = {}) {
    this.options = {
      stopOnSuccess: options.stopOnSuccess ?? true,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Register a credential provider
   *
   * Providers are automatically sorted by priority (lower = tried first).
   *
   * @param provider - Provider to register
   * @returns this (for chaining)
   */
  register(provider: CredentialProvider): this {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /**
   * Unregister a credential provider by name
   *
   * @param name - Provider name to remove
   * @returns true if provider was removed
   */
  unregister(name: string): boolean {
    const index = this.providers.findIndex(p => p.name === name);
    if (index >= 0) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all registered providers
   */
  getProviders(): readonly CredentialProvider[] {
    return this.providers;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): CredentialProvider | undefined {
    return this.providers.find(p => p.name === name);
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers = [];
  }

  /**
   * Resolve credentials using the provider chain
   *
   * Tries each provider in priority order. Returns the first successful result
   * or an aggregated error if all providers fail.
   *
   * @param context - Resolution context
   * @returns Chain resolution result
   */
  async resolve<T extends Credentials = Credentials>(
    context: CredentialContext
  ): Promise<ChainResolutionResult<T>> {
    const errors: Array<{ provider: string; error: CredentialError }> = [];
    const skipped: string[] = [];

    if (this.options.verbose) {
      console.log(`[CredentialChain] Resolving credentials for ${context.providerType}`);
      console.log(`[CredentialChain] ${this.providers.length} providers registered`);
    }

    for (const provider of this.providers) {
      // Check if provider can handle this context
      if (!provider.canHandle(context)) {
        if (this.options.verbose) {
          console.log(`[CredentialChain] Skipping ${provider.name}: cannot handle context`);
        }
        skipped.push(provider.name);
        continue;
      }

      if (this.options.verbose) {
        console.log(`[CredentialChain] Trying ${provider.name}...`);
      }

      try {
        const result = await provider.resolve(context);

        if (result.success) {
          if (this.options.verbose) {
            console.log(`[CredentialChain] ${provider.name} succeeded`);
          }

          return {
            success: true,
            credentials: result.credentials as T,
            resolvedBy: provider.name,
            errors,
            skipped,
          };
        } else {
          if (this.options.verbose) {
            console.log(`[CredentialChain] ${provider.name} failed: ${result.error.message}`);
          }
          errors.push({ provider: provider.name, error: result.error });
        }
      } catch (err) {
        const error: CredentialError = {
          code: 'unknown',
          message: err instanceof Error ? err.message : String(err),
          cause: err instanceof Error ? err : undefined,
        };

        if (this.options.verbose) {
          console.log(`[CredentialChain] ${provider.name} threw: ${error.message}`);
        }

        errors.push({ provider: provider.name, error });
      }
    }

    // All providers failed or were skipped
    return {
      success: false,
      errors,
      skipped,
    };
  }

  /**
   * Resolve credentials, throwing an error if resolution fails
   *
   * @param context - Resolution context
   * @returns Resolved credentials
   * @throws CredentialChainError if resolution fails
   */
  async resolveOrThrow<T extends Credentials = Credentials>(
    context: CredentialContext
  ): Promise<T> {
    const result = await this.resolve<T>(context);

    if (!result.success) {
      throw new CredentialChainError(
        `Failed to resolve credentials for ${context.providerType}`,
        result.errors,
        result.skipped
      );
    }

    return result.credentials!;
  }
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when credential chain resolution fails
 */
export class CredentialChainError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ provider: string; error: CredentialError }>,
    public readonly skipped: string[]
  ) {
    super(message);
    this.name = 'CredentialChainError';
  }

  /**
   * Get a summary of what was tried and why it failed
   */
  getSummary(): string {
    const lines: string[] = [this.message];

    if (this.errors.length > 0) {
      lines.push('Errors:');
      for (const { provider, error } of this.errors) {
        lines.push(`  - ${provider}: ${error.message} (${error.code})`);
      }
    }

    if (this.skipped.length > 0) {
      lines.push(`Skipped: ${this.skipped.join(', ')}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Built-in Providers
// ============================================================================

/**
 * Environment variable credential provider
 *
 * Resolves credentials from environment variables.
 * Provider-specific variable names are used.
 */
export class EnvironmentCredentialProvider implements CredentialProvider {
  readonly name = 'environment';
  readonly description = 'Resolve credentials from environment variables';
  readonly priority = 100;

  canHandle(_context: CredentialContext): boolean {
    // Can handle any provider type
    return true;
  }

  async resolve(context: CredentialContext): Promise<CredentialResult> {
    switch (context.providerType) {
      case 's3':
        return this.resolveS3();
      case 'gcs':
        return this.resolveGCS();
      case 'sftp':
      case 'ftp':
      case 'smb':
        return this.resolveGenericPassword(context.providerType);
      default:
        return {
          success: false,
          error: {
            code: 'not_found',
            message: `No environment variables found for ${context.providerType}`,
          },
        };
    }
  }

  private resolveS3(): CredentialResult {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not set',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 's3',
        source: 'environment',
        accessKeyId,
        secretAccessKey,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    };
  }

  private resolveGCS(): CredentialResult {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!keyFilePath) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'GOOGLE_APPLICATION_CREDENTIALS not set',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'gcs',
        source: 'environment',
        keyFilePath,
      },
    };
  }

  private resolveGenericPassword(providerType: 'sftp' | 'ftp' | 'smb'): CredentialResult {
    // Look for provider-specific password env vars
    const envPrefix = providerType.toUpperCase();
    const password = process.env[`${envPrefix}_PASSWORD`];
    const username = process.env[`${envPrefix}_USERNAME`];

    if (!password) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: `${envPrefix}_PASSWORD not set`,
        },
      };
    }

    switch (providerType) {
      case 'sftp':
        return {
          success: true,
          credentials: {
            type: 'sftp',
            source: 'environment',
            password,
          },
        };
      case 'ftp':
        return {
          success: true,
          credentials: {
            type: 'ftp',
            source: 'environment',
            username,
            password,
          },
        };
      case 'smb':
        return {
          success: true,
          credentials: {
            type: 'smb',
            source: 'environment',
            username,
            password,
            domain: process.env.SMB_DOMAIN,
          },
        };
    }
  }
}

/**
 * Inline credential provider
 *
 * Extracts credentials from the profile configuration itself.
 * This is the fallback when credentials are stored directly in the profile.
 */
export class InlineCredentialProvider implements CredentialProvider {
  readonly name = 'inline';
  readonly description = 'Extract credentials from profile configuration';
  readonly priority = 1000; // Low priority - fallback

  private profileConfig?: Record<string, unknown>;

  /**
   * Set the profile configuration to extract credentials from
   */
  setProfileConfig(config: Record<string, unknown>): void {
    this.profileConfig = config;
  }

  canHandle(_context: CredentialContext): boolean {
    return this.profileConfig !== undefined;
  }

  async resolve(context: CredentialContext): Promise<CredentialResult> {
    if (!this.profileConfig) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No profile configuration provided',
        },
      };
    }

    const config = this.profileConfig;

    switch (context.providerType) {
      case 's3':
        return this.resolveS3(config);
      case 'sftp':
        return this.resolveSFTP(config);
      case 'ftp':
        return this.resolveFTP(config);
      case 'smb':
        return this.resolveSMB(config);
      case 'gcs':
        return this.resolveGCS(config);
      case 'gdrive':
        return this.resolveGDrive(config);
      case 'local':
        return {
          success: true,
          credentials: { type: 'local', source: 'inline' },
        };
      case 'nfs':
        return {
          success: true,
          credentials: { type: 'nfs', source: 'inline' },
        };
      default:
        return {
          success: false,
          error: {
            code: 'unsupported',
            message: `Inline credentials not supported for ${context.providerType}`,
          },
        };
    }
  }

  private resolveS3(config: Record<string, unknown>): CredentialResult {
    const accessKeyId = config.accessKeyId as string | undefined;
    const secretAccessKey = config.secretAccessKey as string | undefined;

    if (!accessKeyId || !secretAccessKey) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'accessKeyId or secretAccessKey not found in profile config',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 's3',
        source: 'inline',
        accessKeyId,
        secretAccessKey,
        sessionToken: config.sessionToken as string | undefined,
      },
    };
  }

  private resolveSFTP(config: Record<string, unknown>): CredentialResult {
    const password = config.password as string | undefined;
    const privateKeyPath = config.privateKeyPath as string | undefined;

    if (!password && !privateKeyPath) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No SFTP credentials (password or privateKeyPath) in profile config',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'sftp',
        source: 'inline',
        password,
        passphrase: config.passphrase as string | undefined,
        // Note: privateKey content would be loaded from privateKeyPath by the provider
      },
    };
  }

  private resolveFTP(config: Record<string, unknown>): CredentialResult {
    // FTP can work without credentials (anonymous)
    return {
      success: true,
      credentials: {
        type: 'ftp',
        source: 'inline',
        username: config.username as string | undefined,
        password: config.password as string | undefined,
      },
    };
  }

  private resolveSMB(config: Record<string, unknown>): CredentialResult {
    return {
      success: true,
      credentials: {
        type: 'smb',
        source: 'inline',
        username: config.username as string | undefined,
        password: config.password as string | undefined,
        domain: config.domain as string | undefined,
      },
    };
  }

  private resolveGCS(config: Record<string, unknown>): CredentialResult {
    const keyFilePath = config.keyFilePath as string | undefined;
    const useApplicationDefault = config.useApplicationDefault as boolean | undefined;

    return {
      success: true,
      credentials: {
        type: 'gcs',
        source: 'inline',
        keyFilePath,
        useApplicationDefault,
      },
    };
  }

  private resolveGDrive(config: Record<string, unknown>): CredentialResult {
    const refreshToken = config.refreshToken as string | undefined;
    const keyFilePath = config.keyFilePath as string | undefined;

    if (!refreshToken && !keyFilePath) {
      return {
        success: false,
        error: {
          code: 'not_found',
          message: 'No Google Drive credentials (refreshToken or keyFilePath) in profile config',
        },
      };
    }

    return {
      success: true,
      credentials: {
        type: 'gdrive',
        source: 'inline',
        refreshToken,
        keyFileContent: undefined, // Would be loaded from keyFilePath
      },
    };
  }
}

// ============================================================================
// Default Chain Factory
// ============================================================================

/**
 * Create a credential chain with default providers
 */
export function createDefaultCredentialChain(options?: CredentialChainOptions): CredentialChain {
  const chain = new CredentialChain(options);

  // Register providers in priority order
  chain.register(new EnvironmentCredentialProvider());
  chain.register(new InlineCredentialProvider());

  // Additional providers would be registered here:
  // - KeychainCredentialProvider (macOS Keychain, Windows Credential Manager)
  // - EncryptedConfigCredentialProvider
  // - PromptCredentialProvider

  return chain;
}
