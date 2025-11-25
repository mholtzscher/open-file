/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order
 */

import { CatppuccinMocha } from './theme.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../utils/sorting.js';
import { BaseDialog } from './base-dialog-react.js';

export interface SortMenuProps {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

const DIALOG_WIDTH = 35;
const DIALOG_HEIGHT = 13;
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
      paddingLeft={1}
      paddingRight={0}
      zIndex={999}
    >
      {/* Title */}
      <text fg={CatppuccinMocha.blue}>SORT BY</text>

      {/* Sort field options */}
      {sortFields.map(field => (
        <text
          key={field}
          fg={currentField === field ? CatppuccinMocha.green : CatppuccinMocha.text}
        >
          {currentField === field ? '▶ ' : '  '} {formatSortField(field)}
        </text>
      ))}

      {/* Separator */}
      <text fg={CatppuccinMocha.surface1}>{Array(30).fill('─').join('')}</text>

      {/* Sort order option */}
      <text fg={CatppuccinMocha.text}>{formatSortOrder(currentOrder)}</text>

      {/* Help text */}
      <text fg={CatppuccinMocha.overlay2}>Keys: 1-4=field, Space/Enter=toggle, Esc/q=close</text>
    </BaseDialog>
  );
}
