/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order with j/k navigation.
 * Changes apply immediately as you navigate, Enter confirms and closes.
 */

import { createSignal, createEffect, For } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import { Theme } from '../theme.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../../utils/sorting.js';
import { BaseDialog } from './base.js';
import { HelpBar } from '../help-bar.js';

export interface SortMenuProps {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

const sortFields = [SortField.Name, SortField.Size, SortField.Modified, SortField.Type];

// Menu items: 4 sort fields + 1 sort order toggle
const TOTAL_ITEMS = sortFields.length + 1;
const ORDER_INDEX = sortFields.length; // Index of the order toggle option

/**
 * SortMenu SolidJS component with j/k navigation
 */
export function SortMenu(props: SortMenuProps) {
  // Track which menu item is selected (0-3 = fields, 4 = order toggle)
  const getInitialIndex = () => {
    const fieldIndex = sortFields.indexOf(props.currentField);
    return fieldIndex >= 0 ? fieldIndex : 0;
  };
  const [selectedIndex, setSelectedIndex] = createSignal(getInitialIndex());

  // Reset selection when dialog opens
  createEffect(() => {
    if (props.visible) {
      const fieldIndex = sortFields.indexOf(props.currentField);
      setSelectedIndex(fieldIndex >= 0 ? fieldIndex : 0);
    }
  });

  useKeyboard(evt => {
    if (!props.visible) return;

    // Navigation
    if (evt.name === 'j' || evt.name === 'down') {
      setSelectedIndex(prev => (prev + 1) % TOTAL_ITEMS);
      // Apply field selection after state update
      const nextIndex = (selectedIndex() + 1) % TOTAL_ITEMS;
      if (nextIndex < ORDER_INDEX) {
        props.onFieldSelect(sortFields[nextIndex]);
      }
      return;
    }

    if (evt.name === 'k' || evt.name === 'up') {
      setSelectedIndex(prev => (prev - 1 + TOTAL_ITEMS) % TOTAL_ITEMS);
      // Apply field selection after state update
      const nextIndex = (selectedIndex() - 1 + TOTAL_ITEMS) % TOTAL_ITEMS;
      if (nextIndex < ORDER_INDEX) {
        props.onFieldSelect(sortFields[nextIndex]);
      }
      return;
    }

    // Toggle order when on the order option, or with space anywhere
    if (evt.name === 'space') {
      props.onOrderToggle();
      return;
    }

    // Select current item with Enter
    if (evt.name === 'return') {
      if (selectedIndex() < ORDER_INDEX) {
        // Field is already applied, just close
        props.onClose();
      } else {
        // Toggle order and close
        props.onOrderToggle();
        props.onClose();
      }
      return;
    }

    // Close with escape
    if (evt.name === 'escape') {
      props.onClose();
    }
  });

  return (
    <BaseDialog visible={props.visible} title="Sort Options" borderColor={Theme.getInfoColor()}>
      {/* Section header */}
      <text fg={Theme.getInfoColor()}>SORT BY</text>

      {/* Sort field options */}
      <For each={sortFields}>
        {(field, index) => {
          const isSelected = () => selectedIndex() === index();
          const isCurrentField = () => props.currentField === field;
          return (
            <text
              fg={isCurrentField() ? Theme.getSuccessColor() : Theme.getTextColor()}
              bg={isSelected() ? Theme.getBgSurface() : undefined}
            >
              {isCurrentField() ? '▶ ' : '  '}
              {formatSortField(field)}
            </text>
          );
        }}
      </For>

      {/* Separator */}
      <text fg={Theme.getBgHighlight()}>{'─'.repeat(32)}</text>

      {/* Sort order option */}
      <text
        fg={Theme.getTextColor()}
        bg={selectedIndex() === ORDER_INDEX ? Theme.getBgSurface() : undefined}
      >
        {selectedIndex() === ORDER_INDEX ? '▶ ' : '  '}
        {formatSortOrder(props.currentOrder)}
      </text>

      {/* Help text */}
      <HelpBar
        items={[
          { key: 'j/k', description: 'navigate' },
          { key: 'Space', description: 'toggle order' },
          { key: 'Enter', description: 'confirm' },
          { key: 'Esc', description: 'close' },
        ]}
      />
    </BaseDialog>
  );
}
