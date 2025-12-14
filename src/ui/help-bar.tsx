/**
 * HelpBar component
 *
 * Standardized component for displaying keyboard shortcut hints.
 * Matches the opencode style: bright key + dim description
 */

import { Theme } from './theme.js';

// ============================================================================
// Types
// ============================================================================

export interface HelpItem {
  /** The key or key combination (e.g., "Esc", "Ctrl+C", "j/k") */
  key: string;
  /** Description of what the key does (e.g., "cancel", "navigate") */
  description: string;
}

export interface HelpBarProps {
  /** Array of key-description pairs to display */
  items: HelpItem[];
}

// ============================================================================
// Components
// ============================================================================

/**
 * HelpBar - Horizontal bar of key hints
 *
 * Renders key hints inline with double-space separation.
 * Use this for status bars and dialog footers.
 *
 * @example
 * <HelpBar items={[
 *   { key: 'j/k', description: 'navigate' },
 *   { key: 'Enter', description: 'select' },
 *   { key: 'Esc', description: 'cancel' },
 * ]} />
 * // Renders: "j/k navigate  Enter select  Esc cancel"
 */
export function HelpBar({ items }: HelpBarProps) {
  return (
    <box flexDirection="row">
      {items.map((item, index) => (
        <box key={index} flexDirection="row">
          {index > 0 && <text fg={Theme.getDimColor()}>{'  '}</text>}
          <text fg={Theme.getTextColor()}>{item.key}</text>
          <text fg={Theme.getDimColor()}> {item.description}</text>
        </box>
      ))}
    </box>
  );
}
