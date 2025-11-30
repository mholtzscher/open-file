/**
 * HelpBar component
 *
 * Standardized component for displaying keyboard shortcut hints.
 * Matches the opencode style: bright key + dim description
 */

import { For, Show } from 'solid-js';
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
export function HelpBar(props: HelpBarProps) {
  return (
    <box flexDirection="row">
      <For each={props.items}>
        {(item, index) => (
          <box flexDirection="row">
            <Show when={index() > 0}>
              <text fg={Theme.getDimColor()}>{'  '}</text>
            </Show>
            <text fg={Theme.getTextColor()}>{item.key}</text>
            <text fg={Theme.getDimColor()}> {item.description}</text>
          </box>
        )}
      </For>
    </box>
  );
}

/**
 * formatHelpText - Returns help bar as plain text
 *
 * Use when you need help text as part of a larger text element
 * or when the parent container doesn't support flex children.
 *
 * Note: This returns plain text without rich styling since
 * terminal text elements can't have inline style changes.
 * For styled output, use HelpBar component instead.
 */
export function formatHelpText(items: HelpItem[]): string {
  return items.map(item => `${item.key} ${item.description}`).join('  ');
}
