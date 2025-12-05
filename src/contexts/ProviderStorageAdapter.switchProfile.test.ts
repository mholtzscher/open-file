/**
 * ProviderStorageAdapter - switchProfile tests
 *
 * Tests the profile switching functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ProviderStorageAdapter } from './ProviderStorageAdapter.js';
import type { StorageProvider } from '../providers/provider.js';
import type { ProfileManager, ValidationResult } from '../providers/services/profile-manager.js';
import type { Profile } from '../providers/types/profile.js';
import { Capability } from '../providers/types/capabilities.js';
import { Result } from '../providers/types/result.js';
import { EntryType } from '../types/entry.js';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockProvider implements StorageProvider {
  name: 'local' | 's3' | 'gcs' | 'sftp' | 'ftp' | 'smb' | 'gdrive' = 'local';
  displayName = 'Mock Provider';
  isConnectedFlag = false;
  disconnectCalled = false;
  connectCalled = false;

  getCapabilities(): Set<Capability> {
    return new Set([Capability.Read, Capability.Write]);
  }

  hasCapability(capability: Capability): boolean {
    return this.getCapabilities().has(capability);
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  async connect() {
    this.connectCalled = true;
    this.isConnectedFlag = true;
    return await Promise.resolve(Result.success(undefined));
  }

  async disconnect() {
    this.disconnectCalled = true;
    this.isConnectedFlag = false;
    return await Promise.resolve();
  }

  async list() {
    return await Promise.resolve(
      Result.success({ entries: [], continuationToken: undefined, hasMore: false })
    );
  }

  async read() {
    return await Promise.resolve(Result.success(Buffer.from('test')));
  }

  async write() {
    return await Promise.resolve(Result.success(undefined));
  }

  async delete() {
    return await Promise.resolve(Result.success(undefined));
  }

  async exists() {
    return await Promise.resolve(Result.success(true));
  }

  async getMetadata() {
    return await Promise.resolve(
      Result.success({
        id: 'test',
        name: 'test.txt',
        type: EntryType.File,
        path: '/test.txt',
        size: 100,
        modified: new Date(),
      })
    );
  }

  async mkdir() {
    return await Promise.resolve(Result.success(undefined));
  }

  async move() {
    return await Promise.resolve(Result.success(undefined));
  }

  async copy() {
    return await Promise.resolve(Result.success(undefined));
  }

  async downloadToLocal() {
    return await Promise.resolve(Result.success(undefined));
  }

  async uploadFromLocal() {
    return await Promise.resolve(Result.success(undefined));
  }
}

class MockProfileManager implements ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private providers: Map<string, StorageProvider> = new Map();

  constructor() {
    // Add some test profiles
    const profile1: Profile = {
      id: 'profile-1',
      displayName: 'Profile 1',
      provider: 's3',
      config: { region: 'us-east-1' },
    };

    const profile2: Profile = {
      id: 'profile-2',
      displayName: 'Profile 2',
      provider: 's3',
      config: { region: 'us-west-2' },
    };

    this.profiles.set('profile-1', profile1);
    this.profiles.set('profile-2', profile2);

    // Create mock providers for each profile
    const provider1 = new MockProvider();
    provider1.displayName = 'Profile 1';

    const provider2 = new MockProvider();
    provider2.displayName = 'Profile 2';

    this.providers.set('profile-1', provider1);
    this.providers.set('profile-2', provider2);
  }

  async listProfiles(): Promise<Profile[]> {
    return await Promise.resolve(Array.from(this.profiles.values()));
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    return await Promise.resolve(this.profiles.get(id));
  }

  async saveProfile(): Promise<ValidationResult> {
    return await Promise.resolve({ valid: true, errors: [] });
  }

  async deleteProfile(): Promise<boolean> {
    return await Promise.resolve(true);
  }

  async validateProfile(): Promise<ValidationResult> {
    return await Promise.resolve({ valid: true, errors: [] });
  }

  async createProviderFromProfile(profileId: string): Promise<StorageProvider> {
    const provider = this.providers.get(profileId);
    if (!provider) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    return await Promise.resolve(provider);
  }

  async reload(): Promise<void> {
    return await Promise.resolve();
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ProviderStorageAdapter - switchProfile', () => {
  let initialProvider: MockProvider;
  let profileManager: MockProfileManager;
  let adapter: ProviderStorageAdapter;

  beforeEach(() => {
    initialProvider = new MockProvider();
    initialProvider.displayName = 'Initial Provider';

    profileManager = new MockProfileManager();
    adapter = new ProviderStorageAdapter(initialProvider, '/', undefined, profileManager);
  });

  it('should throw error if ProfileManager not configured', async () => {
    const adapterWithoutProfileManager = new ProviderStorageAdapter(initialProvider);

    try {
      await adapterWithoutProfileManager.switchProfile('profile-1');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('ProfileManager not configured');
    }
  });

  it('should throw error for non-existent profile', async () => {
    try {
      await adapter.switchProfile('non-existent');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('Profile not found');
    }
  });

  it('should disconnect from old provider and connect to new one', async () => {
    // Switch to profile-1
    await adapter.switchProfile('profile-1');

    // Check that old provider was disconnected
    expect(initialProvider.disconnectCalled).toBe(true);

    // Check that adapter now uses new provider
    expect(adapter.state.providerId).toBe('local');
    expect(adapter.state.providerDisplayName).toBe('Profile 1');
  });

  it('should update state after successful switch', async () => {
    await adapter.switchProfile('profile-1');

    expect(adapter.state.providerId).toBe('local');
    expect(adapter.state.providerDisplayName).toBe('Profile 1');
    expect(adapter.state.currentPath).toBe('/');
    expect(adapter.state.isLoading).toBe(false);
    expect(adapter.state.error).toBeUndefined();
  });

  it('should reset path and container on switch', async () => {
    // Set some state
    adapter['internalState'].currentPath = '/some/path';
    adapter['internalState'].currentContainer = 'some-bucket';

    await adapter.switchProfile('profile-1');

    expect(adapter.state.currentPath).toBe('/');
    expect(adapter.state.currentContainer).toBeUndefined();
  });

  it('should rollback on connection failure', async () => {
    // Create a provider that fails to connect
    const failingProvider = new MockProvider();
    failingProvider.displayName = 'Failing Provider';
    failingProvider.connect = () => {
      throw new Error('Connection failed');
    };

    // Override the profile manager to return the failing provider
    const originalCreate = profileManager.createProviderFromProfile.bind(profileManager);
    profileManager.createProviderFromProfile = async (id: string) => {
      if (id === 'profile-1') {
        return await Promise.resolve(failingProvider);
      }
      return await originalCreate(id);
    };

    const originalProviderId = adapter.state.providerId;

    try {
      await adapter.switchProfile('profile-1');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      // Should have rolled back to original provider
      expect(adapter.state.providerId).toBe(originalProviderId);
    }
  });

  it('should notify listeners on state change', async () => {
    let notified = false;
    adapter.subscribe(() => {
      notified = true;
    });

    await adapter.switchProfile('profile-1');

    expect(notified).toBe(true);
  });
});
