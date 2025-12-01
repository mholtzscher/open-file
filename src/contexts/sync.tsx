/**
 * Sync Context
 *
 * Manages all storage/server-synced state following the SST/OpenCode pattern.
 * This context handles:
 * - Current bucket/container
 * - Current path
 * - Entries (files/directories)
 * - Loading states
 * - Storage operations (list, navigate, etc.)
 */

import { createStore } from 'solid-js/store';
import { batch, createEffect, on, onMount } from 'solid-js';
import { createSimpleContext } from './helper.js';
import { useStorage } from './StorageContextProvider.js';
import { Capability } from '../providers/types/capabilities.js';
import { parseAwsError, formatErrorForDisplay } from '../utils/errors.js';
import { calculateParentPath } from '../utils/path-utils.js';
import type { Entry } from '../types/entry.js';

export interface SyncStore {
  /** Current bucket/container name */
  bucket: string | undefined;
  /** Current path within the bucket */
  currentPath: string;
  /** List of entries (files/directories) */
  entries: Entry[];
  /** Whether initial data has been loaded */
  isInitialized: boolean;
  /** Whether data is currently being loaded */
  isLoading: boolean;
  /** Last error message */
  error: string | undefined;
}

const INITIAL_SYNC_STORE: SyncStore = {
  bucket: undefined,
  currentPath: '',
  entries: [],
  isInitialized: false,
  isLoading: false,
  error: undefined,
};

export const { use: useSync, Provider: SyncProvider } = createSimpleContext({
  name: 'Sync',
  init: () => {
    const storage = useStorage();
    const [store, setStore] = createStore<SyncStore>(INITIAL_SYNC_STORE);

    // Track previous bucket to detect changes
    let prevBucket: string | undefined = undefined;

    // Load data function
    const loadData = async () => {
      console.error('[SYNC] loadData called, bucket:', store.bucket);
      setStore('isLoading', true);
      setStore('error', undefined);

      try {
        if (!store.bucket) {
          // Root view - load bucket/container listing or root directory
          if (storage.hasCapability(Capability.Containers)) {
            console.error('[SYNC] Calling storage.listContainers (no bucket set)');
            const entries = await storage.listContainers();
            console.error('[SYNC] listContainers returned', entries.length, 'entries');
            batch(() => {
              setStore('entries', [...entries]);
              setStore('currentPath', '');
              setStore('isInitialized', true);
            });
          } else {
            // Non-container providers - list root directory
            console.error('[SYNC] Calling storage.list for root (no bucket set)');
            const entries = await storage.list('');
            console.error('[SYNC] storage.list returned', entries.length, 'entries');
            batch(() => {
              setStore('entries', [...entries]);
              setStore('currentPath', '');
              setStore('isInitialized', true);
            });
          }
        } else {
          // Bucket selected - load bucket contents
          console.error('[SYNC] Calling storage.list for path:', store.currentPath);
          const entries = await storage.list(store.currentPath);
          console.error('[SYNC] storage.list returned', entries.length, 'entries');
          batch(() => {
            setStore('entries', [...entries]);
            setStore('isInitialized', true);
          });
        }
      } catch (err) {
        console.error('[SYNC] Error in loadData:', err);
        const parsedError = parseAwsError(
          err,
          store.bucket ? 'Failed to load bucket' : 'Failed to list buckets'
        );
        const errorDisplay = formatErrorForDisplay(parsedError, 70);
        setStore('error', errorDisplay);
        setStore('isInitialized', true);
      } finally {
        console.error('[SYNC] loadData finished');
        setStore('isLoading', false);
      }
    };

    // Load data when bucket changes
    createEffect(
      on(
        () => store.bucket,
        currentBucket => {
          console.error(
            '[SYNC] createEffect triggered, prevBucket:',
            prevBucket,
            'currentBucket:',
            currentBucket
          );
          if (prevBucket !== currentBucket) {
            prevBucket = currentBucket;
            console.error('[SYNC] Bucket changed');

            // Skip loading if storage already has entries (e.g., from switchProfile)
            // and we're setting bucket to undefined (container view)
            if (currentBucket === undefined && storage.state.entries.length > 0) {
              console.error('[SYNC] Storage already has entries, using those instead of reloading');
              batch(() => {
                setStore('entries', [...storage.state.entries]);
                setStore('currentPath', storage.state.currentPath);
                setStore('isInitialized', true);
                setStore('isLoading', false);
              });
            } else {
              console.error('[SYNC] Calling loadData');
              loadData();
            }
          } else {
            console.error('[SYNC] Bucket unchanged, skipping loadData');
          }
        }
      )
    );

    // Initial load
    onMount(() => {
      loadData();
    });

    // Actions
    const actions = {
      /** Set the current bucket/container */
      setBucket: async (bucket: string | undefined, region?: string) => {
        console.error('[SYNC] setBucket called, bucket:', bucket, 'region:', region);
        if (bucket && bucket !== store.bucket) {
          console.error('[SYNC] setBucket - calling storage.setContainer');
          await storage.setContainer(bucket, region || 'us-east-1');
          console.error('[SYNC] setBucket - storage.setContainer completed');
        }
        console.error('[SYNC] setBucket - updating store.bucket to:', bucket);
        setStore('bucket', bucket);
        console.error('[SYNC] setBucket completed');
      },

      /** Set the current path */
      setCurrentPath: (path: string) => {
        setStore('currentPath', path);
      },

      /** Set entries directly */
      setEntries: (entries: Entry[]) => {
        setStore('entries', [...entries]);
      },

      /** Reload current data */
      reload: async () => {
        await loadData();
      },

      /** Navigate into a directory or bucket */
      navigateInto: async (entry: Entry) => {
        if (entry.type === 'bucket') {
          // Navigate into a bucket from root view
          const bucketRegion = entry.metadata?.region || 'us-east-1';
          const containerIdentifier = entry.path || entry.name;
          await storage.setContainer(containerIdentifier, bucketRegion);
          batch(() => {
            setStore('bucket', entry.name);
            setStore('currentPath', '');
          });
        } else if (entry.type === 'directory') {
          // Navigate into a directory
          const newPath = store.currentPath
            ? `${store.currentPath}${entry.name}/`
            : `${entry.name}/`;
          setStore('currentPath', newPath);
          await loadData();
        }
      },

      /** Navigate to parent directory */
      navigateUp: async () => {
        if (store.currentPath) {
          // Go up within bucket
          const { parentPath } = calculateParentPath(store.currentPath);
          setStore('currentPath', parentPath);
          await loadData();
          return true;
        } else if (store.bucket && storage.hasCapability(Capability.Containers)) {
          // Go back to bucket list
          batch(() => {
            setStore('bucket', undefined);
            setStore('currentPath', '');
          });
          return true;
        }
        return false;
      },

      /** Navigate to a specific path */
      navigateTo: async (path: string) => {
        setStore('currentPath', path);
        await loadData();
      },
    };

    return {
      /** Reactive store data */
      data: store,
      /** Actions to modify state */
      ...actions,
    };
  },
});
