/**
 * ConfirmationDialog component tests
 */

import { describe, it, expect } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { KeyboardProvider } from '../../contexts/KeyboardContext.js';
import { ConfirmationDialog, type Operation } from './confirmation.js';

const TERMINAL_WIDTH = 100;
const TERMINAL_HEIGHT = 100;

const WrappedConfirmationDialog = (props: any) => (
  <KeyboardProvider>
    <ConfirmationDialog {...props} />
  </KeyboardProvider>
);

describe('ConfirmationDialog', () => {
  describe('visibility', () => {
    it('renders when visible is true', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Confirm Operation');
    });

    it('renders by default (visible defaults to true)', async () => {
      const { renderOnce, captureCharFrame } = await testRender(<WrappedConfirmationDialog />, {
        width: TERMINAL_WIDTH,
        height: TERMINAL_HEIGHT,
      });
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Confirm Operation');
    });

    it('renders nothing when visible is false', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={false} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('Confirm Operation');
    });
  });

  describe('title', () => {
    it('displays default title when not provided', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Confirm Operation');
    });

    it('displays custom title when provided', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} title="Delete Files" />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Delete Files');
    });
  });

  describe('operations display', () => {
    it('displays message about operations to be performed', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('The following operations will be performed');
    });

    it('displays create operation', async () => {
      const operations: Operation[] = [{ id: '1', type: 'create', path: '/bucket/new-file.txt' }];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Create');
      expect(frame).toContain('new-file.txt');
    });

    it('displays delete operation', async () => {
      const operations: Operation[] = [{ id: '1', type: 'delete', path: '/bucket/old-file.txt' }];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Delete');
      expect(frame).toContain('old-file.txt');
    });

    it('displays move operation', async () => {
      const operations: Operation[] = [
        {
          id: '1',
          type: 'move',
          source: '/bucket/file.txt',
          destination: '/bucket/moved/file.txt',
        },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Move');
      expect(frame).toContain('file.txt');
    });

    it('displays copy operation', async () => {
      const operations: Operation[] = [
        {
          id: '1',
          type: 'copy',
          source: '/bucket/original.txt',
          destination: '/bucket/copy.txt',
        },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Copy');
      expect(frame).toContain('original.txt');
    });

    it('displays download operation', async () => {
      const operations: Operation[] = [
        {
          id: '1',
          type: 'download',
          source: '/bucket/remote.txt',
          destination: '/local/remote.txt',
        },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Download');
      expect(frame).toContain('remote.txt');
    });

    it('displays upload operation', async () => {
      const operations: Operation[] = [
        {
          id: '1',
          type: 'upload',
          source: '/local/file.txt',
          destination: '/bucket/file.txt',
        },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Upload');
      expect(frame).toContain('file.txt');
    });

    it('displays multiple operations', async () => {
      const operations: Operation[] = [
        { id: '1', type: 'create', path: '/bucket/file1.txt' },
        { id: '2', type: 'delete', path: '/bucket/file2.txt' },
        {
          id: '3',
          type: 'copy',
          source: '/bucket/file3.txt',
          destination: '/bucket/file3-copy.txt',
        },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Create');
      expect(frame).toContain('file1.txt');
      expect(frame).toContain('Delete');
      expect(frame).toContain('file2.txt');
      expect(frame).toContain('Copy');
      expect(frame).toContain('file3.txt');
    });

    it('displays bullet points for operations', async () => {
      const operations: Operation[] = [{ id: '1', type: 'delete', path: '/bucket/file.txt' }];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('•');
    });
  });

  describe('operation truncation', () => {
    it('limits displayed operations to MAX_OPERATIONS_DISPLAY (15)', async () => {
      const operations: Operation[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'delete' as const,
        path: `/bucket/file${i + 1}.txt`,
      }));

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Should show "... and X more" message
      expect(frame).toContain('and 5 more');
    });

    it('does not show "more" message when operations <= 15', async () => {
      const operations: Operation[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'create' as const,
        path: `/bucket/file${i + 1}.txt`,
      }));

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).not.toContain('more');
    });
  });

  describe('help text', () => {
    it('displays confirmation help text', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Uses standardized HelpBar format: "key description"
      expect(frame).toContain('y');
      expect(frame).toContain('confirm');
      expect(frame).toContain('Esc');
      expect(frame).toContain('cancel');
    });
  });

  describe('empty operations', () => {
    it('handles empty operations array', async () => {
      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={[]} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('Confirm Operation');
      expect(frame).toContain('The following operations will be performed');
    });
  });

  describe('formatOperation helper', () => {
    it('extracts basename from path for create operation', async () => {
      const operations: Operation[] = [
        { id: '1', type: 'create', path: '/very/long/path/to/file.txt' },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      // Should show basename, not full path
      expect(frame).toContain('file.txt');
      expect(frame).not.toContain('/very/long/path/to/');
    });

    it('shows arrow between source and destination for move', async () => {
      const operations: Operation[] = [
        { id: '1', type: 'move', source: '/src/file.txt', destination: '/dest/file.txt' },
      ];

      const { renderOnce, captureCharFrame } = await testRender(
        <WrappedConfirmationDialog visible={true} operations={operations} />,
        { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }
      );
      await renderOnce();

      const frame = captureCharFrame();
      expect(frame).toContain('→');
    });
  });

  describe('Operation interface', () => {
    it('supports all operation types', () => {
      const operations: Operation[] = [
        { id: '1', type: 'create', path: '/path' },
        { id: '2', type: 'delete', path: '/path' },
        { id: '3', type: 'move', source: '/src', destination: '/dest' },
        { id: '4', type: 'copy', source: '/src', destination: '/dest' },
        { id: '5', type: 'download', source: '/src', destination: '/dest' },
        { id: '6', type: 'upload', source: '/src', destination: '/dest' },
      ];

      expect(operations.length).toBe(6);
      expect(operations[0].type).toBe('create');
      expect(operations[1].type).toBe('delete');
      expect(operations[2].type).toBe('move');
      expect(operations[3].type).toBe('copy');
      expect(operations[4].type).toBe('download');
      expect(operations[5].type).toBe('upload');
    });

    it('has required id field', () => {
      const op: Operation = { id: 'unique-123', type: 'delete', path: '/file.txt' };
      expect(op.id).toBe('unique-123');
    });

    it('has optional path field', () => {
      const op: Operation = { id: '1', type: 'create', path: '/bucket/file.txt' };
      expect(op.path).toBe('/bucket/file.txt');
    });

    it('has optional source and destination fields', () => {
      const op: Operation = {
        id: '1',
        type: 'copy',
        source: '/bucket/original.txt',
        destination: '/bucket/copy.txt',
      };
      expect(op.source).toBe('/bucket/original.txt');
      expect(op.destination).toBe('/bucket/copy.txt');
    });
  });

  describe('exports', () => {
    it('exports ConfirmationDialog component', async () => {
      const module = await import('./confirmation.js');
      expect(module.ConfirmationDialog).toBeDefined();
      expect(typeof module.ConfirmationDialog).toBe('function');
    });

    it('exports Operation type', async () => {
      // TypeScript interface check - if this compiles, the type exists
      const op: import('./confirmation.js').Operation = {
        id: '1',
        type: 'delete',
        path: '/test',
      };
      expect(op.id).toBe('1');
    });

    it('exports ConfirmationDialogProps interface', async () => {
      const props: import('./confirmation.js').ConfirmationDialogProps = {
        visible: true,
        title: 'Test',
        operations: [],
      };
      expect(props.visible).toBe(true);
    });
  });
});
