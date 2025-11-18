/**
 * Tests for syntax highlighting utilities
 */

import { describe, it, expect } from 'bun:test';
import { detectLanguage, highlightCode } from './syntax-highlighting.js';

describe('Syntax Highlighting', () => {
  describe('detectLanguage', () => {
    it('detects JavaScript', () => {
      expect(detectLanguage('script.js')).toBe('javascript');
      expect(detectLanguage('index.jsx')).toBe('javascript');
    });

    it('detects TypeScript', () => {
      expect(detectLanguage('app.ts')).toBe('typescript');
      expect(detectLanguage('component.tsx')).toBe('typescript');
    });

    it('detects Python', () => {
      expect(detectLanguage('script.py')).toBe('python');
    });

    it('detects JSON', () => {
      expect(detectLanguage('config.json')).toBe('json');
    });

    it('detects Markdown', () => {
      expect(detectLanguage('README.md')).toBe('markdown');
    });

    it('detects YAML', () => {
      expect(detectLanguage('config.yaml')).toBe('yaml');
      expect(detectLanguage('config.yml')).toBe('yaml');
    });

    it('returns null for unknown extensions', () => {
      expect(detectLanguage('file.unknown')).toBeNull();
    });
  });

  describe('highlightCode', () => {
    it('highlights JavaScript code', () => {
      const code = 'const x = 5;';
      const result = highlightCode(code, 'test.js');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].text).toBeDefined();
    });

    it('handles multiple lines', () => {
      const code = 'const x = 5;\nconst y = 10;';
      const result = highlightCode(code, 'test.js');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('returns plaintext for unsupported extensions', () => {
      const code = 'some content';
      const result = highlightCode(code, 'file.unknown');
      expect(result[0].text).toBe('some content');
      expect(result[0].color).toBeUndefined();
    });

    it('handles empty code', () => {
      const result = highlightCode('', 'test.js');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles JSON highlighting', () => {
      const code = '{"key": "value"}';
      const result = highlightCode(code, 'config.json');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
