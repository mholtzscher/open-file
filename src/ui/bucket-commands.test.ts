/**
 * Tests for bucket command execution
 *
 * Tests :buckets and :bucket <name> command parsing and execution
 */

import { describe, it, expect } from 'bun:test';

/**
 * Parse bucket command from command string
 */
function parseBucketCommand(command: string): {
  type: 'buckets' | 'bucket' | 'unknown';
  bucketName?: string;
} {
  const trimmed = command.trim();

  if (trimmed === ':buckets') {
    return { type: 'buckets' };
  }

  if (trimmed.startsWith(':bucket ')) {
    const bucketName = trimmed.substring(':bucket '.length).trim();
    if (bucketName) {
      return { type: 'bucket', bucketName };
    }
  }

  return { type: 'unknown' };
}

describe('Bucket Commands', () => {
  describe('command parsing', () => {
    it('should parse :buckets command', () => {
      const result = parseBucketCommand(':buckets');
      expect(result.type).toBe('buckets');
      expect(result.bucketName).toBeUndefined();
    });

    it('should parse :bucket <name> command', () => {
      const result = parseBucketCommand(':bucket my-bucket');
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('my-bucket');
    });

    it('should handle bucket names with hyphens', () => {
      const result = parseBucketCommand(':bucket my-data-bucket-2024');
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('my-data-bucket-2024');
    });

    it('should handle bucket names with numbers', () => {
      const result = parseBucketCommand(':bucket bucket123');
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('bucket123');
    });

    it('should handle bucket names with periods', () => {
      const result = parseBucketCommand(':bucket my.bucket.com');
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('my.bucket.com');
    });

    it('should trim whitespace around bucket name', () => {
      const result = parseBucketCommand(':bucket   my-bucket   ');
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('my-bucket');
    });

    it('should reject :bucket with no name', () => {
      const result = parseBucketCommand(':bucket ');
      expect(result.type).toBe('unknown');
    });

    it('should reject :bucket with only whitespace', () => {
      const result = parseBucketCommand(':bucket    ');
      expect(result.type).toBe('unknown');
    });

    it('should handle case-sensitive commands', () => {
      const result1 = parseBucketCommand(':Buckets');
      expect(result1.type).toBe('unknown');

      const result2 = parseBucketCommand(':BUCKET my-bucket');
      expect(result2.type).toBe('unknown');
    });

    it('should reject unrecognized commands', () => {
      const result = parseBucketCommand(':unknown');
      expect(result.type).toBe('unknown');
    });

    it('should reject partial commands', () => {
      const result = parseBucketCommand(':bucket');
      expect(result.type).toBe('unknown');
    });
  });

  describe('bucket navigation workflow', () => {
    it('should support switching from bucket listing to specific bucket', () => {
      // Simulate: user is at bucket list, types :bucket my-bucket, presses Enter
      const command = ':bucket my-bucket';
      const parsed = parseBucketCommand(command);

      expect(parsed.type).toBe('bucket');
      expect(parsed.bucketName).toBe('my-bucket');
    });

    it('should support returning to bucket list', () => {
      // Simulate: user is in a bucket, types :buckets, presses Enter
      const command = ':buckets';
      const parsed = parseBucketCommand(command);

      expect(parsed.type).toBe('buckets');
    });

    it('should support switching between buckets', () => {
      // Simulate: user switches from one bucket to another
      const command1 = ':bucket bucket-1';
      const parsed1 = parseBucketCommand(command1);
      expect(parsed1.bucketName).toBe('bucket-1');

      const command2 = ':bucket bucket-2';
      const parsed2 = parseBucketCommand(command2);
      expect(parsed2.bucketName).toBe('bucket-2');
    });
  });

  describe('command extraction', () => {
    it('should extract bucket name from valid command', () => {
      const command = ':bucket my-bucket';
      const result = parseBucketCommand(command);

      if (result.type === 'bucket' && result.bucketName) {
        expect(result.bucketName.length).toBeGreaterThan(0);
      }
    });

    it('should handle complex bucket names', () => {
      const complexNames = [
        'my-bucket-for-2024-data',
        'bucket.with.dots.com',
        'bucket-with-123-numbers',
        'b1-b2-b3-b4',
        'my.data.bucket-2024',
      ];

      for (const name of complexNames) {
        const result = parseBucketCommand(`:bucket ${name}`);
        expect(result.type).toBe('bucket');
        expect(result.bucketName).toBe(name);
      }
    });
  });

  describe('command examples', () => {
    it('should handle user command: list all buckets', () => {
      const command = ':buckets';
      const result = parseBucketCommand(command);
      expect(result.type).toBe('buckets');
    });

    it('should handle user command: switch to photo bucket', () => {
      const command = ':bucket my-photos';
      const result = parseBucketCommand(command);
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('my-photos');
    });

    it('should handle user command: switch to backup bucket', () => {
      const command = ':bucket backups-2024';
      const result = parseBucketCommand(command);
      expect(result.type).toBe('bucket');
      expect(result.bucketName).toBe('backups-2024');
    });
  });
});
