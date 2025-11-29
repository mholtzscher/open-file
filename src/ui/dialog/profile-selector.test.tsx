/**
 * ProfileSelectorDialog tests
 */

import { describe, it, expect, mock } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { ProfileSelectorDialog } from './profile-selector.js';
import { KeyboardProvider, useKeyboardDispatch } from '../../contexts/KeyboardContext.js';
import { useEffect, act } from 'react';
import type { KeyboardKey } from '../../types/keyboard.js';
import type { Profile } from '../../providers/types/profile.js';
import type { ProfileManager } from '../../providers/services/profile-manager.js';

// Wrapper component that provides KeyboardContext and optional dispatch access
interface TestWrapperProps {
  children: React.ReactNode;
  onDispatchReady?: (dispatch: (key: KeyboardKey) => void) => void;
}

function TestWrapper({ children, onDispatchReady }: TestWrapperProps) {
  return (
    <KeyboardProvider>
      {onDispatchReady ? <DispatchExposer onDispatchReady={onDispatchReady} /> : null}
      {children}
    </KeyboardProvider>
  );
}

function DispatchExposer({
  onDispatchReady,
}: {
  onDispatchReady: (dispatch: (key: KeyboardKey) => void) => void;
}) {
  const dispatch = useKeyboardDispatch();
  useEffect(() => {
    onDispatchReady(dispatch);
  }, [dispatch, onDispatchReady]);
  return null;
}

// Helper to create a KeyboardKey for testing
function createKey(name: string, modifiers: Partial<KeyboardKey> = {}): KeyboardKey {
  return {
    name,
    ctrl: false,
    shift: false,
    meta: false,
    ...modifiers,
  };
}

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
  };
}

describe('ProfileSelectorDialog', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <TestWrapper>
          <ProfileSelectorDialog
            visible={false}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            currentProfileId="profile-2"
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Current profile should have filled circle
      expect(frame).toContain('●');
    });
  });

  describe('empty state', () => {
    it('shows empty message when no profiles exist', async () => {
      const profileManager = createMockProfileManager([]);
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});

      const { renderOnce, captureCharFrame } = await testRender(
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
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
        <TestWrapper>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 100, height: 40 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      const frame = captureCharFrame();
      // Check for help text (may be truncated, so check partial)
      expect(frame).toContain('Enter');
      expect(frame).toContain('jk');
    });
  });

  describe('keyboard handling', () => {
    it('calls onCancel when escape is pressed', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});
      let dispatchKey: ((key: KeyboardKey) => void) | null = null;

      const { renderOnce } = await testRender(
        <TestWrapper onDispatchReady={d => (dispatchKey = d)}>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      expect(dispatchKey).not.toBeNull();
      await act(async () => {
        dispatchKey!(createKey('escape'));
        await renderOnce();
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onProfileSelect when enter is pressed', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});
      let dispatchKey: ((key: KeyboardKey) => void) | null = null;

      const { renderOnce } = await testRender(
        <TestWrapper onDispatchReady={d => (dispatchKey = d)}>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      expect(dispatchKey).not.toBeNull();
      await act(async () => {
        dispatchKey!(createKey('enter'));
        await renderOnce();
      });

      expect(onProfileSelect).toHaveBeenCalledTimes(1);
    });

    it('moves selection down and up with j/k', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});
      let dispatchKey: ((key: KeyboardKey) => void) | null = null;

      const { renderOnce, captureCharFrame } = await testRender(
        <TestWrapper onDispatchReady={d => (dispatchKey = d)}>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      expect(dispatchKey).not.toBeNull();

      // Initial selection should be first profile, then move down and back up
      const initialFrame = captureCharFrame();
      expect(initialFrame).toContain('> ○ Production S3');

      await act(async () => {
        dispatchKey!(createKey('j'));
        await renderOnce();
      });
      const afterDown = captureCharFrame();
      expect(afterDown).toContain('> ○ Development GCS');

      await act(async () => {
        dispatchKey!(createKey('k'));
        await renderOnce();
      });
      const afterUp = captureCharFrame();
      expect(afterUp).toContain('> ○ Production S3');
    });

    it('moves to first and last profiles with g and G', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});
      let dispatchKey: ((key: KeyboardKey) => void) | null = null;

      const { renderOnce, captureCharFrame } = await testRender(
        <TestWrapper onDispatchReady={d => (dispatchKey = d)}>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      expect(dispatchKey).not.toBeNull();

      // Move to last profile with G
      await act(async () => {
        dispatchKey!(createKey('G'));
        await renderOnce();
      });
      const afterG = captureCharFrame();
      expect(afterG).toContain('> ○ Backup SFTP');

      // Move back to first profile with g
      await act(async () => {
        dispatchKey!(createKey('g'));
        await renderOnce();
      });
      const afterg = captureCharFrame();
      expect(afterg).toContain('> ○ Production S3');
    });

    it('supports arrow keys for navigation', async () => {
      const profileManager = createMockProfileManager();
      const onProfileSelect = mock(() => {});
      const onCancel = mock(() => {});
      let dispatchKey: ((key: KeyboardKey) => void) | null = null;

      const { renderOnce, captureCharFrame } = await testRender(
        <TestWrapper onDispatchReady={d => (dispatchKey = d)}>
          <ProfileSelectorDialog
            visible={true}
            profileManager={profileManager}
            onProfileSelect={onProfileSelect}
            onCancel={onCancel}
          />
        </TestWrapper>,
        { width: 80, height: 30 }
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      await renderOnce();

      expect(dispatchKey).not.toBeNull();

      // Use down arrow to move selection
      await act(async () => {
        dispatchKey!(createKey('down'));
        await renderOnce();
      });
      const afterDownArrow = captureCharFrame();
      expect(afterDownArrow).toContain('> ○ Development GCS');

      // Use up arrow to move back
      await act(async () => {
        dispatchKey!(createKey('up'));
        await renderOnce();
      });
      const afterUpArrow = captureCharFrame();
      expect(afterUpArrow).toContain('> ○ Production S3');
    });
  });

  describe('exports', () => {
    it('exports ProfileSelectorDialog component', async () => {
      const module = await import('./profile-selector.js');
      expect(module.ProfileSelectorDialog).toBeDefined();
      expect(typeof module.ProfileSelectorDialog).toBe('function');
    });
  });
});
