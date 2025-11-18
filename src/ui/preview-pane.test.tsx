/**
 * PreviewPane component tests
 *
 * These tests verify the PreviewPane component using CodeRenderable with Tree-sitter
 */

import { describe, it, expect } from 'bun:test';
import { createTreeSitterStyle, detectTreeSitterFiletype } from '../utils/treesitter-theme.js';

describe('PreviewPane utilities', () => {
  it('creates Tree-sitter syntax style', () => {
    const style = createTreeSitterStyle();
    expect(style).toBeDefined();
    expect(typeof style.getStyleCount).toBe('function');
  });

  it('detects filetype from JavaScript extension', () => {
    expect(detectTreeSitterFiletype('test.js')).toBe('javascript');
    expect(detectTreeSitterFiletype('test.jsx')).toBe('javascript');
    expect(detectTreeSitterFiletype('test.mjs')).toBe('javascript');
  });

  it('detects filetype from TypeScript extension', () => {
    expect(detectTreeSitterFiletype('test.ts')).toBe('typescript');
    expect(detectTreeSitterFiletype('test.tsx')).toBe('tsx');
  });

  it('detects filetype from Python extension', () => {
    expect(detectTreeSitterFiletype('test.py')).toBe('python');
  });

  it('detects filetype from JSON extension', () => {
    expect(detectTreeSitterFiletype('package.json')).toBe('json');
  });

  it('detects filetype from Rust extension', () => {
    expect(detectTreeSitterFiletype('main.rs')).toBe('rust');
  });

  it('detects filetype from Go extension', () => {
    expect(detectTreeSitterFiletype('main.go')).toBe('go');
  });

  it('returns undefined for unknown extensions', () => {
    expect(detectTreeSitterFiletype('file.unknown')).toBeUndefined();
  });

  it('detects makefile extension', () => {
    expect(detectTreeSitterFiletype('Makefile')).toBe('make');
  });

  it('handles case-insensitive extensions', () => {
    expect(detectTreeSitterFiletype('TEST.JS')).toBe('javascript');
    expect(detectTreeSitterFiletype('TEST.PY')).toBe('python');
  });
});
