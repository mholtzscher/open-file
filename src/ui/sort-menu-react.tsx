/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order
 */

import { CatppuccinMocha } from './theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../utils/sorting.js';

export interface SortMenuProps {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

/**
 * SortMenu React component
 */
export function SortMenu({ visible, currentField, currentOrder }: SortMenuProps) {
  if (!visible) {
    return null;
  }

  const terminalSize = useTerminalSize();
  const dialogWidth = 35;
  const dialogHeight = 13;
  const centerLeft = Math.floor((terminalSize.width - dialogWidth) / 2);
  const centerTop = Math.max(2, Math.floor((terminalSize.height - dialogHeight) / 2));

  const sortFields = [SortField.Name, SortField.Size, SortField.Modified, SortField.Type];

  return (
    <box
      position="absolute"
      left={centerLeft}
      top={centerTop}
      width={dialogWidth}
      height={dialogHeight}
      backgroundColor={CatppuccinMocha.base}
      borderStyle="rounded"
      borderColor={CatppuccinMocha.blue}
      zIndex={999}
      flexDirection="column"
      paddingLeft={1}
      paddingTop={1}
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
      <text fg={CatppuccinMocha.overlay2}>Keys: 1-4=field, Space=toggle, Esc/q=close</text>
    </box>
  );
}
