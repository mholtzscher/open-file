/**
 * AWS Profile Detection and Configuration
 *
 * Utilities for detecting and loading AWS profile configuration,
 * including credentials and region from AWS config files.
 */

import { existsSync, readFileSync } from 'fs';
import { expandUser } from './path-utils.js';

/**
 * AWS profile configuration loaded from ~/.aws/config and ~/.aws/credentials
 */
export interface AwsProfileConfig {
  /** Profile name */
  profile: string;
  /** AWS region for this profile */
  region?: string;
  /** Access key ID (from credentials file) */
  accessKeyId?: string;
  /** Secret access key (from credentials file) */
  secretAccessKey?: string;
  /** Session token for temporary credentials */
  sessionToken?: string;
  /** AWS account ID */
  roleArn?: string;
}

/**
 * Parse AWS config file format
 *
 * Format:
 * [profile-name]
 * region = us-east-1
 * ...
 *
 * The 'default' profile has no prefix:
 * [default]
 * region = us-west-2
 *
 * @param configContent Raw content of ~/.aws/config file
 * @returns Parsed profiles with their settings
 */
export function parseAwsConfigFile(configContent: string): Record<string, Record<string, string>> {
  const profiles: Record<string, Record<string, string>> = {};
  let currentProfile = '';

  const lines = configContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Check for profile header: [profile-name]
    const profileMatch = trimmed.match(/^\[(?:profile\s+)?([^\]]+)\]$/);
    if (profileMatch) {
      currentProfile = profileMatch[1];
      if (!profiles[currentProfile]) {
        profiles[currentProfile] = {};
      }
      continue;
    }

    // Parse key = value lines
    if (currentProfile && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const parsedKey = key.trim();
      const parsedValue = valueParts.join('=').trim();

      if (parsedKey && parsedValue) {
        profiles[currentProfile][parsedKey] = parsedValue;
      }
    }
  }

  return profiles;
}

/**
 * Parse AWS credentials file format
 *
 * Format:
 * [profile-name]
 * aws_access_key_id = AKIAIOSFODNN7EXAMPLE
 * aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 * aws_session_token = optional-session-token
 *
 * @param credentialsContent Raw content of ~/.aws/credentials file
 * @returns Parsed profiles with their credentials
 */
export function parseAwsCredentialsFile(
  credentialsContent: string
): Record<string, Record<string, string>> {
  const profiles: Record<string, Record<string, string>> = {};
  let currentProfile = '';

  const lines = credentialsContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Check for profile header: [profile-name]
    const profileMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (profileMatch) {
      currentProfile = profileMatch[1];
      if (!profiles[currentProfile]) {
        profiles[currentProfile] = {};
      }
      continue;
    }

    // Parse key = value lines
    if (currentProfile && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const parsedKey = key.trim();
      const parsedValue = valueParts.join('=').trim();

      if (parsedKey && parsedValue) {
        profiles[currentProfile][parsedKey] = parsedValue;
      }
    }
  }

  return profiles;
}

/**
 * Load AWS profile configuration from files
 *
 * Reads from:
 * - ~/.aws/config (for region and other settings)
 * - ~/.aws/credentials (for access keys)
 *
 * @param profileName Name of the profile to load
 * @returns AWS profile configuration or undefined if not found
 */
export function loadAwsProfile(profileName: string): AwsProfileConfig | undefined {
  const configPath = expandUser('~/.aws/config');
  const credentialsPath = expandUser('~/.aws/credentials');

  const config: AwsProfileConfig = {
    profile: profileName,
  };

  // Load from config file
  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      const parsedConfigs = parseAwsConfigFile(configContent);
      const profileConfig = parsedConfigs[profileName];

      if (profileConfig) {
        if (profileConfig.region) {
          config.region = profileConfig.region;
        }
        if (profileConfig.role_arn) {
          config.roleArn = profileConfig.role_arn;
        }
      }
    } catch (error) {
      console.error(`Failed to read AWS config file: ${error}`);
    }
  }

  // Load from credentials file
  if (existsSync(credentialsPath)) {
    try {
      const credentialsContent = readFileSync(credentialsPath, 'utf-8');
      const parsedCredentials = parseAwsCredentialsFile(credentialsContent);
      const profileCredentials = parsedCredentials[profileName];

      if (profileCredentials) {
        if (profileCredentials.aws_access_key_id) {
          config.accessKeyId = profileCredentials.aws_access_key_id;
        }
        if (profileCredentials.aws_secret_access_key) {
          config.secretAccessKey = profileCredentials.aws_secret_access_key;
        }
        if (profileCredentials.aws_session_token) {
          config.sessionToken = profileCredentials.aws_session_token;
        }
      }
    } catch (error) {
      console.error(`Failed to read AWS credentials file: ${error}`);
    }
  }

  return config;
}
