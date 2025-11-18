/**
 * Header React component
 *
 * Displays the application title and current bucket at the top of the screen
 */

import { CatppuccinMocha } from './theme.js';
import { getActiveAwsProfile } from '../utils/aws-profile.js';

export interface HeaderProps {
  bucket?: string;
  height?: number;
}

/**
 * Header React component
 *
 * Displays "open-s3" in the title border and bucket info inside the box.
 * Shows the current AWS profile on the right side.
 * Uses padding to keep content inside the bordered box.
 */
export function Header({ bucket }: HeaderProps) {
  const bucketText = bucket || 'none';
  const bucketColor = bucket ? CatppuccinMocha.text : CatppuccinMocha.overlay0;
  const awsProfile = getActiveAwsProfile();

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
      <box flexDirection="row" alignItems="center">
        <text fg={CatppuccinMocha.mauve}>bucket: </text>
        <text fg={bucketColor}>{bucketText}</text>
      </box>
      <box flexDirection="row" alignItems="center">
        <text fg={CatppuccinMocha.mauve}>profile: </text>
        <text fg={CatppuccinMocha.text}>{awsProfile}</text>
      </box>
    </box>
  );
}
