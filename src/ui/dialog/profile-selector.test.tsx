/**
 * ProfileSelectorDialog tests
 */

import { describe, it, expect, mock } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { ProfileSelectorDialog } from './profile-selector.js';
import { KeyboardProvider } from '../../contexts/KeyboardContext.js';
import type { Profile } from '../../providers/types/profile.js';
import type { ProfileManager } from '../../providers/services/profile-manager.js';

// Wrapper component that provides KeyboardContext
const WrappedProfileSelectorDialog = (props: any) => (
  <KeyboardProvider>
    <ProfileSelectorDialog {...props} />
  </KeyboardProvider>
);

// Mock profiles for testing
const mockProfiles: Profile[] = [
  {
    id: 'profile-1',
    displayName: 'Production S3',
    provider: 's3',
    config: { region: 'us-east-1' },
  },
  {
    id: 'profile-2',
    displayName: 'Development GCS',
    provider: 'gcs',
    config: { projectId: 'dev-project' },
  },
  {
    id: 'profile-3',
    displayName: 'Backup SFTP',
    provider: 'sftp',
    config: { host: 'backup.example.com', username: 'backup', authMethod: 'key' },
  },
];

// Create a mock ProfileManager
function createMockProfileManager(profiles: Profile[] = mockProfiles): ProfileManager {
  return {
    listProfiles: mock(() => Promise.resolve(profiles)),
    getProfile: mock((id: string) => Promise.resolve(profiles.find(p => p.id === id))),
    saveProfile: mock(() => Promise.resolve({ valid: true, errors: [] })),
    deleteProfile: mock(() => Promise.resolve(true)),
    validateProfile: mock(() => Promise.resolve({ valid: true, errors: [] })),
    createProviderFromProfile: mock(() => Promise.resolve({} as any)),
    reload: mock(() => Promise.resolve()),
  };
}

describe('ProfileSelectorDialog', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={false}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Select Profile');
    });

    it('renders dialog when visible is true', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      // Wait for async profile loading
      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Select Profile');
    });
  });

  describe('loading state', () => {
    it('shows loading message initially', async () => {
      // Create a profile manager that delays
      const profileManager = {
        ...createMockProfileManager(),
        listProfiles: mock(
          () => new Promise<Profile[]>(resolve => setTimeout(() => resolve(mockProfiles), 200))
        ),
      };
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Loading');
    });
  });

  describe('profile list', () => {
    it('displays profile names after loading', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      // Wait for profiles to load
      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Production S3');
      expect(frame).toContain('Development GCS');
      expect(frame).toContain('Backup SFTP');
    });

    it('displays provider type badges', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('[S3]');
      expect(frame).toContain('[GCS]');
      expect(frame).toContain('[SFTP]');
    });

    it('highlights current profile', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          currentProfileId="profile-2"
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Current profile should have filled circle
      expect(frame).toContain('●');
    });

    it('selects current profile on initial render', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      // Render with profile-2 as current - it should be pre-selected
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          currentProfileId="profile-2"
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      // Profile 2 should be selected (cursor '>' on it along with current indicator '●')
      const frame = captureCharFrame();
      expect(frame).toContain('> ● Development GCS');
    });
  });

  describe('empty state', () => {
    it('shows empty message when no profiles exist', async () => {
      const profileManager = createMockProfileManager([]);
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('No profiles configured');
    });
  });

  describe('error state', () => {
    it('shows error message when loading fails', async () => {
      const profileManager = {
        ...createMockProfileManager(),
        listProfiles: mock(() => Promise.reject(new Error('Network error'))),
      };
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Error');
      expect(frame).toContain('Network error');
    });
  });

  describe('help text', () => {
    it('displays keyboard navigation help', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 100, height: 40 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format: "key description"
      expect(frame).toContain('Enter');
      expect(frame).toContain('switch');
      expect(frame).toContain('j/k');
      expect(frame).toContain('select');
    });

    it('displays edit keybind in help text', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
        />,
        { width: 100, height: 40 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format: "e edit"
      expect(frame).toContain('e');
      expect(frame).toContain('edit');
    });
  });

  describe('exports', () => {
    it('exports ProfileSelectorDialog component', async () => {
      const module = await import('./profile-selector.js');
      expect(module.ProfileSelectorDialog).toBeDefined();
      expect(typeof module.ProfileSelectorDialog).toBe('function');
    });
  });

  describe('profile reload', () => {
    it('reloads profiles when profilesReloadKey changes', async () => {
      const updatedProfiles: Profile[] = [
        {
          id: 'new-profile',
          displayName: 'New Profile',
          provider: 'local',
          config: { basePath: '/tmp' },
        },
      ];

      let callCount = 0;
      const profileManager: ProfileManager = {
        listProfiles: mock(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockProfiles);
          }
          return Promise.resolve(updatedProfiles);
        }),
        getProfile: mock(() => Promise.resolve(undefined)),
        saveProfile: mock(() => Promise.resolve({ valid: true, errors: [] })),
        deleteProfile: mock(() => Promise.resolve(true)),
        validateProfile: mock(() => Promise.resolve({ valid: true, errors: [] })),
        createProviderFromProfile: mock(() => Promise.resolve({} as any)),
        reload: mock(() => Promise.resolve()),
      };

      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      // First render with reload key = 1
      const { renderOnce: renderOnce1, captureCharFrame: captureCharFrame1 } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
          profilesReloadKey={1}
        />,
        { width: 80, height: 30 }
      );

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce1();

      const frame1 = captureCharFrame1();
      expect(frame1).toContain('Production S3');

      // Second render with reload key = 2 (simulates profile reload)
      const { renderOnce: renderOnce2, captureCharFrame: captureCharFrame2 } = await testRender(
        <WrappedProfileSelectorDialog
          visible={true}
          profileManager={profileManager}
          onProfileSelect={onProfileSelect}
          onCancel={onCancel}
          profilesReloadKey={2}
        />,
        { width: 80, height: 30 }
      );

      // Wait for profiles to reload
      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce2();

      const frame2 = captureCharFrame2();
      expect(frame2).toContain('New Profile');

      // Verify listProfiles was called twice
      expect(callCount).toBe(2);
    });
  });
});
