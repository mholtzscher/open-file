/**
 * Sort Menu Dialog Component
 *
 * Modal dialog for selecting sort field and order
 */

import { CatppuccinMocha } from './theme.js';
import { SortField, SortOrder, formatSortField, formatSortOrder } from '../utils/sorting.js';

export interface SortMenuProps {
  visible: boolean;
  currentField: SortField;
  currentOrder: SortOrder;
  onFieldSelect: (field: SortField) => void;
  onOrderToggle: () => void;
  onClose: () => void;
}

export function SortMenu({
  visible,
  currentField,
  currentOrder,
  onFieldSelect,
  onOrderToggle,
  onClose,
}: SortMenuProps) {
  if (!visible) {
    return null;
  }

  const sortFields = [SortField.Name, SortField.Size, SortField.Modified, SortField.Type];

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        backgroundColor: `${CatppuccinMocha.base}80`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => {
        // Close on background click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: CatppuccinMocha.surface0,
          border: `2px solid ${CatppuccinMocha.blue}`,
          borderRadius: 2,
          padding: '1 2',
          minWidth: 40,
          maxWidth: 60,
        }}
      >
        {/* Title */}
        <div style={{ color: CatppuccinMocha.blue, marginBottom: 1 }}>
          <strong> SORT BY </strong>
        </div>

        {/* Sort field options */}
        {sortFields.map((field, index) => (
          <div
            key={field}
            style={{
              color: currentField === field ? CatppuccinMocha.green : CatppuccinMocha.text,
              backgroundColor: currentField === field ? `${CatppuccinMocha.base}40` : 'transparent',
              padding: '0 1',
              marginBottom: index < sortFields.length - 1 ? 0 : 1,
            }}
            onClick={() => onFieldSelect(field)}
          >
            {currentField === field ? '▶ ' : '  '} {formatSortField(field)}
          </div>
        ))}

        {/* Separator */}
        <div style={{ color: CatppuccinMocha.surface1, marginBottom: 1 }}>{'─'.repeat(30)}</div>

        {/* Sort order option */}
        <div
          style={{
            color: CatppuccinMocha.text,
            padding: '0 1',
            marginBottom: 1,
          }}
          onClick={onOrderToggle}
        >
          {formatSortOrder(currentOrder)}
        </div>

        {/* Help text */}
        <div
          style={{
            color: CatppuccinMocha.overlay2,
            fontSize: 'small',
            padding: '0 1',
            marginBottom: 0,
          }}
        >
          <div>Select field or press</div>
          <div>Enter/Space: toggle order</div>
          <div>Esc: close menu</div>
        </div>
      </div>
    </div>
  );
}
