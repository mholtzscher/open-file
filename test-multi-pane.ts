/**
 * Test script for multi-pane functionality
 */

import type { MutableRefObject } from 'react';
import { useMultiPaneLayout } from './src/hooks/useMultiPaneLayout.js';
import { useBufferState, type UseBufferStateReturn } from './src/hooks/useBufferState.js';

// Simple test to verify multi-pane layout works
console.log('Testing multi-pane layout...');

const createBufferRef = (buffer: UseBufferStateReturn): MutableRefObject<UseBufferStateReturn> => ({
  current: buffer,
});

// Mock terminal size
const terminalSize = { width: 120, height: 40 };
const layout = {
  headerHeight: 2,
  footerHeight: 1,
  contentHeight: 37,
  contentWidth: 80,
  maxWidth: 120,
  minContentHeight: 10,
};

// Create buffer states
const bufferState1 = useBufferState([], '');
const bufferState2 = useBufferState([], '');
const bufferStateRef1 = createBufferRef(bufferState1);
const bufferStateRef2 = createBufferRef(bufferState2);

// Test multi-pane layout
const multiPaneLayout = useMultiPaneLayout(terminalSize, layout);

// Add panes
multiPaneLayout.addPane(bufferStateRef1);
const pane1Id = multiPaneLayout.activePaneId;
multiPaneLayout.addPane(bufferStateRef2);
const pane2Id = multiPaneLayout.activePaneId;

console.log('Added 2 panes');
console.log('Pane 1 ID:', pane1Id);
console.log('Pane 2 ID:', pane2Id);
console.log('Active pane ID:', multiPaneLayout.activePaneId);
console.log('Is multi-pane mode:', multiPaneLayout.isMultiPaneMode);

// Test toggle multi-pane mode
multiPaneLayout.toggleMultiPaneMode();
console.log('After toggle - Is multi-pane mode:', multiPaneLayout.isMultiPaneMode);

// Test pane switching
if (pane2Id) {
  multiPaneLayout.activatePane(pane2Id);
}
console.log('After activate pane 2 - Active pane ID:', multiPaneLayout.activePaneId);

// Test dimensions
console.log('Pane dimensions:', multiPaneLayout.paneDimensions);

console.log('Multi-pane layout test completed successfully!');
