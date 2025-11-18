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
      expect(result[0].segments).toBeDefined();
      expect(result[0].segments.length).toBeGreaterThan(0);
      expect(result[0].segments[0].text).toBeDefined();
    });

    it('handles multiple lines', () => {
      const code = 'const x = 5;\nconst y = 10;';
      const result = highlightCode(code, 'test.js');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('returns plaintext for unsupported extensions', () => {
      const code = 'some content';
      const result = highlightCode(code, 'file.unknown');
      expect(result[0].segments[0].text).toBe('some content');
      expect(result[0].segments[0].color).toBeUndefined();
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

    it('applies different colors to different tokens', () => {
      const code = 'const x = 5;';
      const result = highlightCode(code, 'test.js');
      expect(result[0].segments.length).toBeGreaterThan(1);

      // Find keyword and number segments
      const keywordSeg = result[0].segments.find(s => s.text === 'const');
      const numberSeg = result[0].segments.find(s => s.text === '5');

      expect(keywordSeg).toBeDefined();
      expect(numberSeg).toBeDefined();
      expect(keywordSeg?.color).toBeDefined();
      expect(numberSeg?.color).toBeDefined();
      // Keywords and numbers should have different colors
      expect(keywordSeg?.color).not.toBe(numberSeg?.color);
    });

    it('preserves line structure', () => {
      const code = 'line1\nline2\nline3';
      const result = highlightCode(code, 'test.txt');
      expect(result.length).toBe(3);
      expect(result[0].segments[0].text).toBe('line1');
      expect(result[1].segments[0].text).toBe('line2');
      expect(result[2].segments[0].text).toBe('line3');
    });
  });
});
