/**
 * Header React component
 *
 * Displays the application title and current container/bucket at the top of the screen.
 *
 * Now supports both legacy adapter (bucket-based) and new provider system (container-based).
 * Automatically hides container selector for providers that don't support containers.
 */

import { CatppuccinMocha } from './theme.js';
import { getActiveAwsProfile } from '../utils/aws-profile.js';
import { useHasStorage } from '../contexts/StorageContext.js';
import { useStorageState, useStorageCapabilities } from '../hooks/useStorage.js';

export interface HeaderProps {
  /**
   * Legacy bucket prop (deprecated - prefer using StorageContext)
   * @deprecated Use StorageContext instead
   */
  bucket?: string;

  /** Height of header (optional) */
  height?: number;
}

/**
 * Header React component
 *
 * Displays "open-s3" in the title border and container/bucket info inside the box.
 * Shows the current AWS profile on the right side.
 * Uses padding to keep content inside the bordered box.
 *
 * Features:
 * - Shows container name from StorageContext when available
 * - Falls back to legacy bucket prop for backward compatibility
 * - Hides container selector for providers without container support
 * - Shows provider display name
 */
export function Header({ bucket: legacyBucket }: HeaderProps) {
  // Try to use StorageContext if available
  const hasStorage = useHasStorage();
  const state = hasStorage ? useStorageState() : null;
  const capabilities = hasStorage ? useStorageCapabilities() : null;

  // Determine what to display
  const hasContainers = capabilities?.hasContainers ?? false;
  const container = state?.currentContainer;
  const providerName = state?.providerDisplayName;

  // Use StorageContext data if available, otherwise fall back to legacy prop
  const displayContainer = container ?? legacyBucket;
  const containerText = displayContainer || 'none';
  const containerColor = displayContainer ? CatppuccinMocha.text : CatppuccinMocha.overlay0;

  // Get AWS profile (for legacy S3 adapter compatibility)
  const awsProfile = getActiveAwsProfile();

  // Determine label based on provider
  const containerLabel = hasContainers ? 'container: ' : 'bucket: ';

  return (
    <box
      width="100%"
      flexShrink={0}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.mauve}
      title="open-s3"
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      {/* Left side: container/bucket info (only if provider supports containers) */}
      {hasContainers && (
        <box flexDirection="row" alignItems="center">
          <text fg={CatppuccinMocha.mauve}>{containerLabel}</text>
          <text fg={containerColor}>{containerText}</text>
        </box>
      )}

      {/* Middle: provider name (if available) */}
      {providerName && (
        <box flexDirection="row" alignItems="center">
          <text fg={CatppuccinMocha.mauve}>provider: </text>
          <text fg={CatppuccinMocha.text}>{providerName}</text>
        </box>
      )}

      {/* Right side: AWS profile (for S3 compatibility) */}
      {awsProfile && (
        <box flexDirection="row" alignItems="center">
          <text fg={CatppuccinMocha.mauve}>profile: </text>
          <text fg={CatppuccinMocha.text}>{awsProfile}</text>
        </box>
      )}
    </box>
  );
}
