/**
 * Theme Selector Dialog Component
 *
 * Modal dialog for selecting application theme.
 * Triggered by :theme command in command mode.
 * Uses j/k navigation, Enter to confirm.
 */

import { useState, useCallback, useEffect } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { ThemeRegistry } from '../theme-registry.js';
import { Theme } from '../theme.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';

export interface ThemeSelectorDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * ThemeSelectorDialog React component
 *
 * Shows available themes with j/k navigation.
 * Theme changes apply immediately as you navigate (preview).
 * Enter confirms the selection, Escape reverts to original theme.
 */
export function ThemeSelectorDialog({ visible, onClose }: ThemeSelectorDialogProps) {
  // Get available themes
  const themes = ThemeRegistry.listThemes();
  const currentThemeId = ThemeRegistry.getActiveId();

  // Track which theme is selected and the original theme for reverting
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const index = themes.findIndex(t => t.id === currentThemeId);
    return index >= 0 ? index : 0;
  });
  const [originalThemeId, setOriginalThemeId] = useState<string | null>(currentThemeId);

  // Reset selection when dialog opens
  useEffect(() => {
    if (visible) {
      const index = themes.findIndex(t => t.id === currentThemeId);
      setSelectedIndex(index >= 0 ? index : 0);
      setOriginalThemeId(currentThemeId);
    }
  }, [visible, currentThemeId, themes]);

  // Apply theme preview as selection changes
  useEffect(() => {
    if (visible && themes[selectedIndex]) {
      const themeId = themes[selectedIndex].id;
      if (ThemeRegistry.has(themeId)) {
        ThemeRegistry.setActive(themeId);
      }
    }
  }, [visible, selectedIndex, themes]);

  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      // Navigation
      if (key.name === 'j' || key.name === 'down') {
        setSelectedIndex(prev => (prev + 1) % themes.length);
        return true;
      }

      if (key.name === 'k' || key.name === 'up') {
        setSelectedIndex(prev => (prev - 1 + themes.length) % themes.length);
        return true;
      }

      // Confirm selection with Enter
      if (key.name === 'return') {
        // Theme is already applied, just close
        onClose();
        return true;
      }

      // Cancel and revert with Escape or q
      if (key.name === 'escape' || key.name === 'q') {
        // Revert to original theme
        if (originalThemeId && ThemeRegistry.has(originalThemeId)) {
          ThemeRegistry.setActive(originalThemeId);
        }
        onClose();
        return true;
      }

      return true; // Block all other keys when dialog is open
    },
    [visible, themes.length, onClose, originalThemeId]
  );

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  if (themes.length === 0) {
    return (
      <BaseDialog visible={visible} title="Theme" borderColor={Theme.getInfoColor()}>
        <text fg={Theme.getWarningColor()}>No themes available</text>
        <HelpBar items={[{ key: 'Esc', description: 'close' }]} />
      </BaseDialog>
    );
  }

  return (
    <BaseDialog visible={visible} title="Select Theme" borderColor={Theme.getInfoColor()}>
      {/* Theme list */}
      {themes.map((theme, index) => {
        const isSelected = selectedIndex === index;
        const isCurrent = theme.id === originalThemeId;
        return (
          <text
            key={theme.id}
            fg={isCurrent ? Theme.getSuccessColor() : Theme.getTextColor()}
            bg={isSelected ? Theme.getBgSurface() : undefined}
          >
            {isSelected ? '▶ ' : '  '}
            {theme.name}
            {theme.variant === 'light' ? ' (light)' : ''}
            {isCurrent ? ' ✓' : ''}
          </text>
        );
      })}

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
  );
}
