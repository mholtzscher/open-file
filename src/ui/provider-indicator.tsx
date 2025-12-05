/**
 * ProviderIndicator React component
 *
 * Renders a short provider type badge (e.g., [S3], [GCS]) using
 * the shared provider indicator mapping and provider-specific colors.
 */

import { Theme } from './theme.js';

export interface ProviderIndicatorProps {
  /** Provider type identifier (e.g., 's3', 'gcs', 'sftp') */
  providerType: string;
}

/**
 * Get a short icon/indicator for provider type
 */
function getProviderTypeDisplay(providerType: string): string {
  const indicators: Record<string, string> = {
    s3: 'S3',
    gcs: 'GCS',
    sftp: 'SFTP',
    ftp: 'FTP',
    smb: 'SMB',
    gdrive: 'Drive',
    local: 'Local',
  };

  return indicators[providerType] || providerType.toUpperCase();
}

/**
 * ProviderIndicator component
 *
 * Example output: "[S3]" in the S3 provider color.
 */
export function ProviderIndicator({ providerType }: ProviderIndicatorProps) {
  const indicator = getProviderTypeDisplay(providerType);
  const providerColor = Theme.getProviderColor(providerType);
  const badge = `[${indicator}]`;

  return <text fg={providerColor}>{badge}</text>;
}
