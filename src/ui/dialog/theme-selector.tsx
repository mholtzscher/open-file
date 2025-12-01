/**
 * Theme Selector Dialog Component
 *
 * Modal dialog for selecting application theme.
 * Triggered by :theme command in command mode.
 * Uses j/k navigation, Enter to confirm.
 */

import { createSignal, createEffect, For, Show } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import { ThemeRegistry } from '../theme-registry.js';
import { Theme } from '../theme.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';

export interface ThemeSelectorDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * ThemeSelectorDialog SolidJS component
 *
 * Shows available themes with j/k navigation.
 * Theme changes apply immediately as you navigate (preview).
 * Enter confirms the selection, Escape reverts to original theme.
 */
export function ThemeSelectorDialog(props: ThemeSelectorDialogProps) {
  // Get available themes
  const themes = () => ThemeRegistry.listThemes();
  const currentThemeId = () => ThemeRegistry.getActiveId();

  // Track which theme is selected and the original theme for reverting
  const getInitialIndex = () => {
    const index = themes().findIndex(t => t.id === currentThemeId());
    return index >= 0 ? index : 0;
  };
  const [selectedIndex, setSelectedIndex] = createSignal(getInitialIndex());
  const [originalThemeId, setOriginalThemeId] = createSignal<string | null>(currentThemeId());

  // Reset selection when dialog opens
  createEffect(() => {
    if (!props.visible) {
      return;
    }

    // Use the currently active theme ID at the moment the dialog opens.
    // This avoids fighting with navigation updates while the dialog is open.
    const activeId = ThemeRegistry.getActiveId();
    const themeList = themes();
    const idToUse = activeId ?? themeList[0]?.id ?? null;

    if (idToUse) {
      const index = themeList.findIndex(t => t.id === idToUse);
      setSelectedIndex(index >= 0 ? index : 0);
      setOriginalThemeId(idToUse);
    } else {
      setSelectedIndex(0);
      setOriginalThemeId(null);
    }
  });

  // Apply theme preview as selection changes
  createEffect(() => {
    const themeList = themes();
    const idx = selectedIndex();
    if (props.visible && themeList[idx]) {
      const themeId = themeList[idx].id;
      if (ThemeRegistry.has(themeId)) {
        ThemeRegistry.setActive(themeId);
      }
    }
  });

  useKeyboard(evt => {
    if (!props.visible) return;

    const themeList = themes();

    // Navigation
    if (evt.name === 'j' || evt.name === 'down') {
      setSelectedIndex(prev => (prev + 1) % themeList.length);
      return;
    }

    if (evt.name === 'k' || evt.name === 'up') {
      setSelectedIndex(prev => (prev - 1 + themeList.length) % themeList.length);
      return;
    }

    // Confirm selection with Enter
    if (evt.name === 'return') {
      // Theme is already applied, just close
      props.onClose();
      return;
    }

    // Cancel and revert with Escape
    if (evt.name === 'escape') {
      // Revert to original theme
      const origId = originalThemeId();
      if (origId && ThemeRegistry.has(origId)) {
        ThemeRegistry.setActive(origId);
      }
      props.onClose();
    }
  });

  return (
    <Show
      when={themes().length > 0}
      fallback={
        <BaseDialog visible={props.visible} title="Theme" borderColor={Theme.getInfoColor()}>
          <text fg={Theme.getWarningColor()}>No themes available</text>
          <HelpBar items={[{ key: 'Esc', description: 'close' }]} />
        </BaseDialog>
      }
    >
      <BaseDialog visible={props.visible} title="Select Theme" borderColor={Theme.getInfoColor()}>
        {/* Theme list */}
        <For each={themes()}>
          {(theme, index) => {
            const isSelected = () => selectedIndex() === index();
            const isCurrent = () => theme.id === ThemeRegistry.getActiveId();
            return (
              <text
                fg={isCurrent() ? Theme.getSuccessColor() : Theme.getTextColor()}
                bg={isSelected() ? Theme.getBgSurface() : undefined}
              >
                {isSelected() ? '▶ ' : '  '}
                {theme.name}
                {theme.variant === 'light' ? ' (light)' : ''}
                {isCurrent() ? ' ✓' : ''}
              </text>
            );
          }}
        </For>

        {/* Separator */}
        <text fg={Theme.getBgHighlight()}>{'─'.repeat(32)}</text>

        {/* Help text */}
        <HelpBar
          items={[
            { key: 'j/k', description: 'navigate' },
            { key: 'Enter', description: 'confirm' },
            { key: 'Esc', description: 'cancel' },
          ]}
        />
      </BaseDialog>
    </Show>
  );
}
