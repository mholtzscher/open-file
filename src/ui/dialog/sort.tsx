/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order with j/k navigation.
 * Changes apply immediately as you navigate, Enter confirms and closes.
 */

import { useState, useCallback, useEffect } from 'react';
import { useKeyboardHandler, KeyboardPriority } from '../../contexts/KeyboardContext.js';
import { CatppuccinMocha } from '../theme.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../../utils/sorting.js';
import { BaseDialog } from './base.js';

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
 * SortMenu React component with j/k navigation
 */
export function SortMenu({
  visible,
  currentField,
  currentOrder,
  onFieldSelect,
  onOrderToggle,
  onClose,
}: SortMenuProps) {
  // Track which menu item is selected (0-3 = fields, 4 = order toggle)
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const fieldIndex = sortFields.indexOf(currentField);
    return fieldIndex >= 0 ? fieldIndex : 0;
  });

  // Reset selection when dialog opens
  useEffect(() => {
    if (visible) {
      const fieldIndex = sortFields.indexOf(currentField);
      setSelectedIndex(fieldIndex >= 0 ? fieldIndex : 0);
    }
  }, [visible, currentField]);

  const handleKey = useCallback<Parameters<typeof useKeyboardHandler>[0]>(
    key => {
      if (!visible) return false;

      // Navigation
      if (key.name === 'j' || key.name === 'down') {
        setSelectedIndex(prev => {
          const next = (prev + 1) % TOTAL_ITEMS;
          // Apply immediately when navigating to a field
          if (next < ORDER_INDEX) {
            onFieldSelect(sortFields[next]);
          }
          return next;
        });
        return true;
      }

      if (key.name === 'k' || key.name === 'up') {
        setSelectedIndex(prev => {
          const next = (prev - 1 + TOTAL_ITEMS) % TOTAL_ITEMS;
          // Apply immediately when navigating to a field
          if (next < ORDER_INDEX) {
            onFieldSelect(sortFields[next]);
          }
          return next;
        });
        return true;
      }

      // Toggle order when on the order option, or with space anywhere
      if (key.name === 'space') {
        onOrderToggle();
        return true;
      }

      // Select current item with Enter
      if (key.name === 'return') {
        if (selectedIndex < ORDER_INDEX) {
          // Field is already applied, just close
          onClose();
        } else {
          // Toggle order and close
          onOrderToggle();
          onClose();
        }
        return true;
      }

      // Close with escape or q
      if (key.name === 'escape' || key.name === 'q') {
        onClose();
        return true;
      }

      return true; // Block all other keys when dialog is open
    },
    [visible, selectedIndex, onFieldSelect, onOrderToggle, onClose]
  );

  useKeyboardHandler(handleKey, KeyboardPriority.High);

  return (
    <BaseDialog visible={visible} title="Sort Options" borderColor={CatppuccinMocha.blue}>
      {/* Section header */}
      <text fg={CatppuccinMocha.blue}>SORT BY</text>

      {/* Sort field options */}
      {sortFields.map((field, index) => {
        const isSelected = selectedIndex === index;
        const isCurrentField = currentField === field;
        return (
          <text
            key={field}
            fg={isCurrentField ? CatppuccinMocha.green : CatppuccinMocha.text}
            bg={isSelected ? CatppuccinMocha.surface0 : undefined}
          >
            {isCurrentField ? '● ' : '  '}
            {formatSortField(field)}
            {isSelected ? ' ◀' : ''}
          </text>
        );
      })}

      {/* Separator */}
      <text fg={CatppuccinMocha.surface1}>{'─'.repeat(32)}</text>

      {/* Sort order option */}
      <text
        fg={CatppuccinMocha.text}
        bg={selectedIndex === ORDER_INDEX ? CatppuccinMocha.surface0 : undefined}
      >
        {formatSortOrder(currentOrder)}
        {selectedIndex === ORDER_INDEX ? ' ◀' : ''}
      </text>

      {/* Help text */}
      <text fg={CatppuccinMocha.overlay0}>j/k=navigate Space=toggle order Enter=close</text>
    </BaseDialog>
  );
}
