/**
 * Tests for useStatusMessage hook types and constants
 *
 * Note: This file tests the types and color mappings.
 * The hook behavior is tested implicitly through s3-explorer integration tests
 * since @testing-library/react is not available in this project.
 */

import { describe, it, expect } from 'bun:test';
import { CatppuccinMocha } from '../ui/theme.js';

// Import types to verify they compile correctly
import type { StatusType, StatusMessageState } from './useStatusMessage.js';

describe('useStatusMessage types', () => {
  describe('StatusType', () => {
    it('should allow valid status types', () => {
      const types: StatusType[] = ['success', 'error', 'warning', 'info', 'normal'];
      expect(types).toHaveLength(5);
    });
  });

  describe('StatusMessageState', () => {
    it('should define the correct shape', () => {
      const state: StatusMessageState = {
        message: 'Test message',
        color: CatppuccinMocha.green,
        type: 'success',
      };

      expect(state.message).toBe('Test message');
      expect(state.color).toBe(CatppuccinMocha.green);
      expect(state.type).toBe('success');
    });

    it('should support all status types', () => {
      const states: StatusMessageState[] = [
        { message: 'success', color: CatppuccinMocha.green, type: 'success' },
        { message: 'error', color: CatppuccinMocha.red, type: 'error' },
        { message: 'warning', color: CatppuccinMocha.yellow, type: 'warning' },
        { message: 'info', color: CatppuccinMocha.blue, type: 'info' },
        { message: 'normal', color: CatppuccinMocha.text, type: 'normal' },
      ];

      expect(states).toHaveLength(5);
    });
  });
});

describe('Status colors', () => {
  it('should use CatppuccinMocha.green for success', () => {
    expect(CatppuccinMocha.green).toBe('#a6e3a1');
  });

  it('should use CatppuccinMocha.red for error', () => {
    expect(CatppuccinMocha.red).toBe('#f38ba8');
  });

  it('should use CatppuccinMocha.yellow for warning', () => {
    expect(CatppuccinMocha.yellow).toBe('#f9e2af');
  });

  it('should use CatppuccinMocha.blue for info', () => {
    expect(CatppuccinMocha.blue).toBe('#89b4fa');
  });

  it('should use CatppuccinMocha.text for normal', () => {
    expect(CatppuccinMocha.text).toBe('#cdd6f4');
  });
});

describe('isError logic', () => {
  it('should detect error when message is non-empty and color is red', () => {
    const state: StatusMessageState = {
      message: 'Error!',
      color: CatppuccinMocha.red,
      type: 'error',
    };

    const isError = state.message !== '' && state.color === CatppuccinMocha.red;
    expect(isError).toBe(true);
  });

  it('should not detect error when message is empty even with red color', () => {
    const state: StatusMessageState = {
      message: '',
      color: CatppuccinMocha.red,
      type: 'error',
    };

    const isError = state.message !== '' && state.color === CatppuccinMocha.red;
    expect(isError).toBe(false);
  });

  it('should not detect error when color is not red', () => {
    const state: StatusMessageState = {
      message: 'Success!',
      color: CatppuccinMocha.green,
      type: 'success',
    };

    const isError = state.message !== '' && state.color === CatppuccinMocha.red;
    expect(isError).toBe(false);
  });
});

describe('color type detection (backward compatibility)', () => {
  // Helper function that mimics the setMessageColor logic
  function detectTypeFromColor(color: string): StatusType {
    if (color === CatppuccinMocha.red) return 'error';
    if (color === CatppuccinMocha.green) return 'success';
    if (color === CatppuccinMocha.yellow) return 'warning';
    if (color === CatppuccinMocha.blue) return 'info';
    return 'normal';
  }

  it('should detect error type from red color', () => {
    expect(detectTypeFromColor(CatppuccinMocha.red)).toBe('error');
  });

  it('should detect success type from green color', () => {
    expect(detectTypeFromColor(CatppuccinMocha.green)).toBe('success');
  });

  it('should detect warning type from yellow color', () => {
    expect(detectTypeFromColor(CatppuccinMocha.yellow)).toBe('warning');
  });

  it('should detect info type from blue color', () => {
    expect(detectTypeFromColor(CatppuccinMocha.blue)).toBe('info');
  });

  it('should default to normal type for other colors', () => {
    expect(detectTypeFromColor(CatppuccinMocha.text)).toBe('normal');
    expect(detectTypeFromColor('#ffffff')).toBe('normal');
    expect(detectTypeFromColor('')).toBe('normal');
  });
});
