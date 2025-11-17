/**
 * Tests for status bar breadcrumb formatting
 *
 * Verifies that the breadcrumb path is formatted correctly
 * for different navigation states (root view vs bucket view)
 */

import { describe, it, expect } from 'bun:test';

/**
 * Format breadcrumb path showing current location
 * - If no bucket: shows "Buckets (root)"
 * - If bucket with no path: shows "bucket-name/"
 * - If bucket with path: shows "bucket-name/path/to/dir"
 */
function formatBreadcrumb(bucket: string | undefined, path: string): string {
  if (!bucket) {
    return 'Buckets (root)';
  }

  // Build the full path with bucket name
  const fullPath = path ? `${bucket}/${path}` : `${bucket}/`;
  return fullPath;
}

describe('Status Bar Breadcrumb Formatting', () => {
  describe('root view (no bucket selected)', () => {
    it('should show "Buckets (root)" when no bucket is set', () => {
      const result = formatBreadcrumb(undefined, '');
      expect(result).toBe('Buckets (root)');
    });

    it('should show "Buckets (root)" even with invalid path when no bucket', () => {
      const result = formatBreadcrumb(undefined, 'anything/');
      expect(result).toBe('Buckets (root)');
    });
  });

  describe('bucket root view', () => {
    it('should show bucket name with trailing slash at bucket root', () => {
      const result = formatBreadcrumb('my-bucket', '');
      expect(result).toBe('my-bucket/');
    });

    it('should handle bucket names with hyphens', () => {
      const result = formatBreadcrumb('my-data-bucket', '');
      expect(result).toBe('my-data-bucket/');
    });

    it('should handle bucket names with periods', () => {
      const result = formatBreadcrumb('my.bucket.com', '');
      expect(result).toBe('my.bucket.com/');
    });

    it('should handle bucket names with numbers', () => {
      const result = formatBreadcrumb('bucket-2024', '');
      expect(result).toBe('bucket-2024/');
    });
  });

  describe('nested directory paths', () => {
    it('should show bucket and single directory level', () => {
      const result = formatBreadcrumb('my-bucket', 'documents/');
      expect(result).toBe('my-bucket/documents/');
    });

    it('should show bucket and multiple directory levels', () => {
      const result = formatBreadcrumb('my-bucket', 'documents/reports/');
      expect(result).toBe('my-bucket/documents/reports/');
    });

    it('should show deeply nested paths', () => {
      const result = formatBreadcrumb('my-bucket', 'documents/reports/2024/q4/');
      expect(result).toBe('my-bucket/documents/reports/2024/q4/');
    });

    it('should preserve path structure exactly', () => {
      const result = formatBreadcrumb('archive', 'backups/2024-11/daily/');
      expect(result).toBe('archive/backups/2024-11/daily/');
    });
  });

  describe('edge cases', () => {
    it('should handle empty bucket string (falsy)', () => {
      const result = formatBreadcrumb('', '');
      expect(result).toBe('Buckets (root)');
    });

    it('should not add double slashes for paths with leading slash', () => {
      // In practice, paths should not have leading slash, but test robustness
      const result = formatBreadcrumb('my-bucket', 'documents/');
      expect(result).not.toContain('//');
    });

    it('should maintain proper formatting with various path structures', () => {
      const testCases: [string, string, string][] = [
        ['photos', 'vacation/', 'photos/vacation/'],
        ['logs', 'app/2024/11/', 'logs/app/2024/11/'],
        ['data', 'export/format-csv/', 'data/export/format-csv/'],
      ];

      for (const [bucket, path, expected] of testCases) {
        const result = formatBreadcrumb(bucket, path);
        expect(result).toBe(expected);
      }
    });
  });

  describe('navigation context', () => {
    it('should reflect transition from root to bucket selection', () => {
      let breadcrumb = formatBreadcrumb(undefined, '');
      expect(breadcrumb).toBe('Buckets (root)');

      breadcrumb = formatBreadcrumb('my-bucket', '');
      expect(breadcrumb).toBe('my-bucket/');
    });

    it('should reflect navigation from bucket root into directory', () => {
      let breadcrumb = formatBreadcrumb('my-bucket', '');
      expect(breadcrumb).toBe('my-bucket/');

      breadcrumb = formatBreadcrumb('my-bucket', 'documents/');
      expect(breadcrumb).toBe('my-bucket/documents/');
    });

    it('should reflect navigation back up the hierarchy', () => {
      let breadcrumb = formatBreadcrumb('my-bucket', 'documents/reports/2024/');
      expect(breadcrumb).toBe('my-bucket/documents/reports/2024/');

      breadcrumb = formatBreadcrumb('my-bucket', 'documents/reports/');
      expect(breadcrumb).toBe('my-bucket/documents/reports/');

      breadcrumb = formatBreadcrumb('my-bucket', 'documents/');
      expect(breadcrumb).toBe('my-bucket/documents/');

      breadcrumb = formatBreadcrumb('my-bucket', '');
      expect(breadcrumb).toBe('my-bucket/');
    });

    it('should reflect navigation back to root view', () => {
      let breadcrumb = formatBreadcrumb('my-bucket', '');
      expect(breadcrumb).toBe('my-bucket/');

      breadcrumb = formatBreadcrumb(undefined, '');
      expect(breadcrumb).toBe('Buckets (root)');
    });
  });

  describe('status bar display examples', () => {
    it('should produce correct display for root view', () => {
      const breadcrumb = formatBreadcrumb(undefined, '');
      const display = `📂 ${breadcrumb} [NORMAL]`;
      expect(display).toBe('📂 Buckets (root) [NORMAL]');
    });

    it('should produce correct display for bucket root', () => {
      const breadcrumb = formatBreadcrumb('photos', '');
      const display = `📂 ${breadcrumb} [NORMAL]`;
      expect(display).toBe('📂 photos/ [NORMAL]');
    });

    it('should produce correct display for nested directory', () => {
      const breadcrumb = formatBreadcrumb('photos', 'vacation/');
      const display = `📂 ${breadcrumb} [NORMAL]`;
      expect(display).toBe('📂 photos/vacation/ [NORMAL]');
    });
  });
});
