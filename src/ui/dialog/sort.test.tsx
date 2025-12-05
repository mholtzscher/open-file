/**
 * SortMenu component tests
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { KeyboardProvider } from '../../contexts/KeyboardContext.js';
import { SortMenu } from './sort.js';
import { SortField, SortOrder } from '../../utils/sorting.js';

const TERMINAL_WIDTH = 100;
const TERMINAL_HEIGHT = 80;

const WrappedSortMenu = (props: {
  visible: boolean;
  currentField?: SortField;
  currentOrder?: SortOrder;
  onFieldSelect?: (field: SortField) => void;
  onOrderToggle?: () => void;
  onClose?: () => void;
}) => (
  <KeyboardProvider>
    <SortMenu
      visible={props.visible}
      currentField={props.currentField ?? SortField.Name}
      currentOrder={props.currentOrder ?? SortOrder.Ascending}
      onFieldSelect={props.onFieldSelect ?? (() => {})}
      onOrderToggle={props.onOrderToggle ?? (() => {})}
      onClose={props.onClose ?? (() => {})}
    />
  </KeyboardProvider>
);

describe('SortMenu', () => {
  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Sort Options');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={false} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Sort Options');
      expect(frame).not.toContain('SORT BY');
    });
  });

  describe('content', () => {
    it('displays SORT BY header', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('SORT BY');
    });

    it('displays all sort field options', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Name');
      expect(frame).toContain('Size');
      expect(frame).toContain('Modified Date');
      expect(frame).toContain('Type');
    });

    it('displays current sort order as ascending', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentOrder={SortOrder.Ascending} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Ascending');
    });

    it('displays current sort order as descending', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentOrder={SortOrder.Descending} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Descending');
    });

    it('displays help text', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      console.debug(frame);
      // Help text: "j/k=navigate Space=toggle order Enter=close"
      expect(frame).toContain('navigate');
      expect(frame).toContain('toggle');
      expect(frame).toContain('close');
    });

    it('shows indicator for current field', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Name} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Current field should have triangle indicator
      expect(frame).toContain('▶ Name');
    });
  });

  describe('visual indicators', () => {
    it('shows triangle indicator for current field', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Size} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('▶ Size');
    });
  });

  describe('different sort fields', () => {
    it('highlights Name when selected', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Name} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('▶ Name');
    });

    it('highlights Size when selected', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Size} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('▶ Size');
    });

    it('highlights Modified when selected', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Modified} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('▶ Modified');
    });

    it('highlights Type when selected', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentField={SortField.Type} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('▶ Type');
    });
  });

  describe('sort order display', () => {
    it('shows ascending arrow for ascending order', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentOrder={SortOrder.Ascending} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('↑');
    });

    it('shows descending arrow for descending order', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedSortMenu visible={true} currentOrder={SortOrder.Descending} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('↓');
    });
  });

  describe('exports', () => {
    it('exports SortMenu component', async () => {
      const module = await import('./sort.js');
      expect(module.SortMenu).toBeDefined();
      expect(typeof module.SortMenu).toBe('function');
    });

    it('exports SortMenuProps interface', () => {
      const props: import('./sort.js').SortMenuProps = {
        visible: true,
        currentField: SortField.Name,
        currentOrder: SortOrder.Ascending,
        onFieldSelect: () => {},
        onOrderToggle: () => {},
        onClose: () => {},
      };
      expect(props.visible).toBe(true);
    });
  });
});
