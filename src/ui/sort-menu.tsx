/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order
 */

import { CatppuccinMocha } from './theme.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../utils/sorting.js';
import { BaseDialog } from './base-dialog.js';

export interface SortMenuProps {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

const DIALOG_WIDTH = 40;
const DIALOG_HEIGHT = 12;
const sortFields = [SortField.Name, SortField.Size, SortField.Modified, SortField.Type];

/**
 * SortMenu React component
 */
export function SortMenu({ visible, currentField, currentOrder }: SortMenuProps) {
  return (
    <BaseDialog
      visible={visible}
      title="Sort Options"
      width={DIALOG_WIDTH}
      height={DIALOG_HEIGHT}
      borderColor={CatppuccinMocha.blue}
    >
      {/* Title */}
      <text fg={CatppuccinMocha.blue}>SORT BY</text>

      {/* Sort field options */}
      {sortFields.map(field => (
        <text
          key={field}
          fg={currentField === field ? CatppuccinMocha.green : CatppuccinMocha.text}
        >
          {currentField === field ? '▶ ' : '  '}
          {formatSortField(field)}
        </text>
      ))}

      {/* Separator */}
      <text fg={CatppuccinMocha.surface1}>{'─'.repeat(32)}</text>

      {/* Sort order option */}
      <text fg={CatppuccinMocha.text}>{formatSortOrder(currentOrder)}</text>

      {/* Help text */}
      <text fg={CatppuccinMocha.overlay2}>1-4=field Space=toggle q=close</text>
    </BaseDialog>
  );
}
