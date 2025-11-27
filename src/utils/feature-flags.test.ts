/**
 * Unit tests for feature flag system
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  FeatureFlag,
  FeatureFlagManager,
  isFeatureEnabled,
  isNewProviderSystemEnabled,
  isMultiProviderEnabled,
  isExperimentalEnabled,
  isDebugEnabled,
  initializeFeatureFlags,
  getAllFeatureFlags,
} from './feature-flags.js';
import { ConfigManager } from './config.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('FeatureFlagManager', () => {
  let tempDir: string;
  let configPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temp directory for config files
    tempDir = mkdtempSync(join(tmpdir(), 'open-s3-test-'));
    configPath = join(tempDir, 'test-config.json');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temp directory
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Default values', () => {
    it('should return false for all flags by default', () => {
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
      expect(manager.isEnabled(FeatureFlag.MULTI_PROVIDER)).toBe(false);
      expect(manager.isEnabled(FeatureFlag.EXPERIMENTAL)).toBe(false);
      expect(manager.isEnabled(FeatureFlag.DEBUG)).toBe(false);
    });

    it('should return all default values via getAllFlags', () => {
      const manager = new FeatureFlagManager();
      const flags = manager.getAllFlags();

      expect(flags[FeatureFlag.USE_NEW_PROVIDER_SYSTEM]).toBe(false);
      expect(flags[FeatureFlag.MULTI_PROVIDER]).toBe(false);
      expect(flags[FeatureFlag.EXPERIMENTAL]).toBe(false);
      expect(flags[FeatureFlag.DEBUG]).toBe(false);
    });
  });

  describe('Environment variable resolution', () => {
    it('should read from OPEN_S3_USE_PROVIDERS environment variable', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should read from OPEN_S3_MULTI_PROVIDER environment variable', () => {
      process.env.OPEN_S3_MULTI_PROVIDER = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.MULTI_PROVIDER)).toBe(true);
    });

    it('should read from OPEN_S3_EXPERIMENTAL environment variable', () => {
      process.env.OPEN_S3_EXPERIMENTAL = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.EXPERIMENTAL)).toBe(true);
    });

    it('should read from OPEN_S3_DEBUG environment variable', () => {
      process.env.OPEN_S3_DEBUG = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.DEBUG)).toBe(true);
    });

    it('should parse "true" as true', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should parse "false" as false', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'false';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });

    it('should parse "1" as true', () => {
      process.env.OPEN_S3_USE_PROVIDERS = '1';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should parse "0" as false', () => {
      process.env.OPEN_S3_USE_PROVIDERS = '0';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });

    it('should parse "yes" as true', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'yes';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should parse "no" as false', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'no';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });

    it('should parse "on" as true', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'on';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should parse "off" as false', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'off';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });

    it('should be case-insensitive', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'TRUE';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should trim whitespace', () => {
      process.env.OPEN_S3_USE_PROVIDERS = '  true  ';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });
  });

  describe('Config file resolution', () => {
    it('should read from config file when provided', () => {
      const configManager = new ConfigManager(configPath);
      configManager.setConfig({
        featureFlags: {
          useProviders: true,
        },
      });
      configManager.save();

      const manager = new FeatureFlagManager(configManager);
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should read multiple flags from config file', () => {
      const configManager = new ConfigManager(configPath);
      configManager.setConfig({
        featureFlags: {
          useProviders: true,
          multiProvider: true,
          experimental: false,
          debug: true,
        },
      });
      configManager.save();

      const manager = new FeatureFlagManager(configManager);
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
      expect(manager.isEnabled(FeatureFlag.MULTI_PROVIDER)).toBe(true);
      expect(manager.isEnabled(FeatureFlag.EXPERIMENTAL)).toBe(false);
      expect(manager.isEnabled(FeatureFlag.DEBUG)).toBe(true);
    });
  });

  describe('Precedence order', () => {
    it('should prefer environment variable over config file', () => {
      // Config says false
      const configManager = new ConfigManager(configPath);
      configManager.setConfig({
        featureFlags: {
          useProviders: false,
        },
      });
      configManager.save();

      // Environment says true
      process.env.OPEN_S3_USE_PROVIDERS = 'true';

      const manager = new FeatureFlagManager(configManager);
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should prefer config file over default', () => {
      const configManager = new ConfigManager(configPath);
      configManager.setConfig({
        featureFlags: {
          useProviders: true,
        },
      });
      configManager.save();

      // No environment variable set, default is false
      const manager = new FeatureFlagManager(configManager);
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should use default when neither env nor config is set', () => {
      const configManager = new ConfigManager(configPath);
      // Don't set featureFlags in config

      const manager = new FeatureFlagManager(configManager);
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should cache flag values', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'true';
      const manager = new FeatureFlagManager();

      // First call
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);

      // Change env (but cache should still return old value)
      process.env.OPEN_S3_USE_PROVIDERS = 'false';
      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
    });

    it('should clear cache and pick up new values', () => {
      process.env.OPEN_S3_USE_PROVIDERS = 'true';
      const manager = new FeatureFlagManager();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);

      // Change env and clear cache
      process.env.OPEN_S3_USE_PROVIDERS = 'false';
      manager.clearCache();

      expect(manager.isEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(false);
    });
  });
});

describe('Global convenience functions', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Initialize with a fresh manager
    initializeFeatureFlags();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should provide isFeatureEnabled convenience function', () => {
    process.env.OPEN_S3_USE_PROVIDERS = 'true';
    initializeFeatureFlags(); // Re-initialize to pick up env change

    expect(isFeatureEnabled(FeatureFlag.USE_NEW_PROVIDER_SYSTEM)).toBe(true);
  });

  it('should provide isNewProviderSystemEnabled convenience function', () => {
    process.env.OPEN_S3_USE_PROVIDERS = 'true';
    initializeFeatureFlags();

    expect(isNewProviderSystemEnabled()).toBe(true);
  });

  it('should provide isMultiProviderEnabled convenience function', () => {
    process.env.OPEN_S3_MULTI_PROVIDER = 'true';
    initializeFeatureFlags();

    expect(isMultiProviderEnabled()).toBe(true);
  });

  it('should provide isExperimentalEnabled convenience function', () => {
    process.env.OPEN_S3_EXPERIMENTAL = 'true';
    initializeFeatureFlags();

    expect(isExperimentalEnabled()).toBe(true);
  });

  it('should provide isDebugEnabled convenience function', () => {
    process.env.OPEN_S3_DEBUG = 'true';
    initializeFeatureFlags();

    expect(isDebugEnabled()).toBe(true);
  });

  it('should provide getAllFeatureFlags convenience function', () => {
    process.env.OPEN_S3_USE_PROVIDERS = 'true';
    process.env.OPEN_S3_DEBUG = 'true';
    initializeFeatureFlags();

    const flags = getAllFeatureFlags();
    expect(flags[FeatureFlag.USE_NEW_PROVIDER_SYSTEM]).toBe(true);
    expect(flags[FeatureFlag.DEBUG]).toBe(true);
    expect(flags[FeatureFlag.MULTI_PROVIDER]).toBe(false);
    expect(flags[FeatureFlag.EXPERIMENTAL]).toBe(false);
  });
});
