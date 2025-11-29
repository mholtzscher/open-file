/**
 * Tests for AWS profile detection and configuration
 */

import { describe, it, expect } from 'bun:test';
import { parseAwsConfigFile, parseAwsCredentialsFile, loadAwsProfile } from './aws-profile.js';

describe('AWS Profile Detection', () => {
  describe('parseAwsConfigFile', () => {
    it('should parse AWS config file format', () => {
      const content = `
[default]
region = us-east-1
output = json

[profile staging]
region = us-west-2
role_arn = arn:aws:iam::123456789012:role/StagingRole
`;
      const parsed = parseAwsConfigFile(content);
      expect(parsed).toEqual({
        default: {
          region: 'us-east-1',
          output: 'json',
        },
        staging: {
          region: 'us-west-2',
          role_arn: 'arn:aws:iam::123456789012:role/StagingRole',
        },
      });
    });

    it('should ignore empty lines and comments', () => {
      const content = `
# This is a comment
; This is also a comment

[default]
; Commented setting
region = us-east-1
# region = us-west-2

[production]
region = eu-west-1
`;
      const parsed = parseAwsConfigFile(content);
      expect(parsed.default.region).toBe('us-east-1');
      expect(parsed.production.region).toBe('eu-west-1');
      expect(parsed.production['# region']).toBeUndefined();
    });

    it('should handle equals signs in values', () => {
      const content = `
[default]
role_arn = arn:aws:iam::123456789012:role/service-role=with=equals
`;
      const parsed = parseAwsConfigFile(content);
      expect(parsed.default.role_arn).toBe(
        'arn:aws:iam::123456789012:role/service-role=with=equals'
      );
    });

    it('should handle profile names with spaces in brackets', () => {
      const content = `
[default]
region = us-east-1

[profile my-profile]
region = us-west-2
`;
      const parsed = parseAwsConfigFile(content);
      expect(parsed['my-profile']).toBeDefined();
      expect(parsed['my-profile'].region).toBe('us-west-2');
    });

    it('should trim whitespace from keys and values', () => {
      const content = `
[default]
  region   =   us-east-1   
`;
      const parsed = parseAwsConfigFile(content);
      expect(parsed.default.region).toBe('us-east-1');
    });

    it('should return empty object for empty content', () => {
      const parsed = parseAwsConfigFile('');
      expect(parsed).toEqual({});
    });
  });

  describe('parseAwsCredentialsFile', () => {
    it('should parse AWS credentials file format', () => {
      const content = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[production]
aws_access_key_id = ASIATEMP0RARYEXAMPLE
aws_secret_access_key = ProdSecretKey12345678901234567890ABC
aws_session_token = SessionTokenExample
`;
      const parsed = parseAwsCredentialsFile(content);
      expect(parsed.default).toEqual({
        aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE',
        aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });
      expect(parsed.production).toEqual({
        aws_access_key_id: 'ASIATEMP0RARYEXAMPLE',
        aws_secret_access_key: 'ProdSecretKey12345678901234567890ABC',
        aws_session_token: 'SessionTokenExample',
      });
    });

    it('should ignore comments and empty lines', () => {
      const content = `
# Default profile
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
# aws_secret_access_key = commented-out
aws_secret_access_key = RealSecretKey

[staging]
; Another comment style
aws_access_key_id = ASIATEMP0RARYEXAMPLE
`;
      const parsed = parseAwsCredentialsFile(content);
      expect(parsed.default.aws_access_key_id).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(parsed.default.aws_secret_access_key).toBe('RealSecretKey');
      expect(parsed.staging.aws_access_key_id).toBe('ASIATEMP0RARYEXAMPLE');
    });

    it('should handle special characters in credentials', () => {
      const content = `
[default]
aws_access_key_id = AKIA/IO+SF/ODD=N7
aws_secret_access_key = wJalr/XUt+nFE/MI/K7MDN+G/bPx=Rf/iCY
`;
      const parsed = parseAwsCredentialsFile(content);
      expect(parsed.default.aws_access_key_id).toBe('AKIA/IO+SF/ODD=N7');
      expect(parsed.default.aws_secret_access_key).toBe('wJalr/XUt+nFE/MI/K7MDN+G/bPx=Rf/iCY');
    });

    it('should return empty object for empty content', () => {
      const parsed = parseAwsCredentialsFile('');
      expect(parsed).toEqual({});
    });
  });

  describe('loadAwsProfile', () => {
    it('should handle missing AWS config files gracefully', () => {
      const profile = loadAwsProfile('nonexistent');
      expect(profile).toBeDefined();
      expect(profile?.profile).toBe('nonexistent');
      expect(profile?.region).toBeUndefined();
      expect(profile?.accessKeyId).toBeUndefined();
    });

    it('should parse loaded profile configuration correctly', () => {
      // This test would require mocking file system reads
      // For now, we're just ensuring the function handles missing files
      const profile = loadAwsProfile('test-profile');
      expect(profile?.profile).toBe('test-profile');
    });
  });
});

describe('parseAwsConfigFile - Edge Cases', () => {
  it('should handle config with only comments', () => {
    const content = `
# Only comments
; No profiles here
`;
    const parsed = parseAwsConfigFile(content);
    expect(Object.keys(parsed).length).toBe(0);
  });

  it('should handle mixed line endings', () => {
    const content = '[default]\r\nregion = us-east-1\n[production]\rregion = us-west-2';
    const parsed = parseAwsConfigFile(content);
    // After split by \n, \r characters remain, but trimmed
    expect(parsed.default).toBeDefined();
  });

  it('should handle values with leading/trailing spaces', () => {
    const content = `
[default]
region =    us-east-1    
`;
    const parsed = parseAwsConfigFile(content);
    expect(parsed.default.region).toBe('us-east-1');
  });

  it('should handle profile names with underscores and hyphens', () => {
    const content = `
[default]
region = us-east-1

[profile my-prod_profile]
region = us-west-2
`;
    const parsed = parseAwsConfigFile(content);
    expect(parsed['my-prod_profile']).toBeDefined();
  });

  it('should ignore profile entries without values', () => {
    const content = `
[default]
region = us-east-1
incomplete_entry
another = value
`;
    const parsed = parseAwsConfigFile(content);
    expect(parsed.default.region).toBe('us-east-1');
    expect(parsed.default.another).toBe('value');
    expect(parsed.default.incomplete_entry).toBeUndefined();
  });
});
