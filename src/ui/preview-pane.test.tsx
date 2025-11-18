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

  it('detects JavaScript filetype (supported)', () => {
    expect(detectTreeSitterFiletype('test.js')).toBe('javascript');
    expect(detectTreeSitterFiletype('test.jsx')).toBe('javascript');
    expect(detectTreeSitterFiletype('test.mjs')).toBe('javascript');
  });

  it('detects TypeScript filetype (supported)', () => {
    expect(detectTreeSitterFiletype('test.ts')).toBe('typescript');
    expect(detectTreeSitterFiletype('test.tsx')).toBe('typescript');
  });

  it('detects Markdown filetype (supported)', () => {
    expect(detectTreeSitterFiletype('README.md')).toBe('markdown');
    expect(detectTreeSitterFiletype('notes.markdown')).toBe('markdown');
  });

  it('detects Zig filetype (supported)', () => {
    expect(detectTreeSitterFiletype('main.zig')).toBe('zig');
  });

  it('returns undefined for unsupported languages (Python)', () => {
    // OpenTUI v0.1.44 does not include Python grammar
    expect(detectTreeSitterFiletype('test.py')).toBeUndefined();
  });

  it('returns undefined for unsupported languages (JSON)', () => {
    // OpenTUI v0.1.44 does not include JSON grammar
    expect(detectTreeSitterFiletype('package.json')).toBeUndefined();
  });

  it('returns undefined for unsupported languages (Rust)', () => {
    // OpenTUI v0.1.44 does not include Rust grammar
    expect(detectTreeSitterFiletype('main.rs')).toBeUndefined();
  });

  it('returns undefined for unknown extensions', () => {
    expect(detectTreeSitterFiletype('file.unknown')).toBeUndefined();
  });

  it('handles case-insensitive extensions', () => {
    expect(detectTreeSitterFiletype('TEST.JS')).toBe('javascript');
    expect(detectTreeSitterFiletype('TEST.TS')).toBe('typescript');
  });
});
