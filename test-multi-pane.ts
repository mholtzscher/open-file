/**
 * Test script for multi-pane functionality
 */

import { useMultiPaneLayout } from './src/hooks/useMultiPaneLayout.js';
import { useBufferState } from './src/hooks/useBufferState.js';

// Simple test to verify multi-pane layout works
console.log('Testing multi-pane layout...');

// Mock terminal size
const terminalSize = { width: 120, height: 40 };
const layout = { headerHeight: 2, footerHeight: 1, contentHeight: 37 };

// Create buffer states
const bufferState1 = useBufferState([], '');
const bufferState2 = useBufferState([], '');

// Test multi-pane layout
const multiPaneLayout = useMultiPaneLayout(terminalSize, layout);

// Add panes
const pane1Id = multiPaneLayout.addPane(bufferState1);
const pane2Id = multiPaneLayout.addPane(bufferState2);

console.log('Added 2 panes');
console.log('Pane 1 ID:', pane1Id);
console.log('Pane 2 ID:', pane2Id);
console.log('Active pane ID:', multiPaneLayout.activePaneId);
console.log('Is multi-pane mode:', multiPaneLayout.isMultiPaneMode);

// Test toggle multi-pane mode
multiPaneLayout.toggleMultiPaneMode();
console.log('After toggle - Is multi-pane mode:', multiPaneLayout.isMultiPaneMode);

// Test pane switching
multiPaneLayout.activatePane(pane2Id);
console.log('After activate pane 2 - Active pane ID:', multiPaneLayout.activePaneId);

// Test dimensions
console.log('Pane dimensions:', multiPaneLayout.paneDimensions);

console.log('Multi-pane layout test completed successfully!');
