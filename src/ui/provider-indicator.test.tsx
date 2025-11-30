/**
 * Tests for ProviderIndicator component
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { testRender } from '@opentui/react/test-utils';
import { ProviderIndicator } from './provider-indicator.js';
import { ThemeRegistry } from './theme-registry.js';
import { CatppuccinMochaTheme } from '../themes/catppuccin-mocha.js';

describe('ProviderIndicator', () => {
  beforeEach(() => {
    ThemeRegistry.clear();
    ThemeRegistry.register(CatppuccinMochaTheme);
  });
  it('renders the provider badge text in the frame', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ProviderIndicator providerType="s3" />,
      { width: 40, height: 3 }
    );

    await renderOnce();
    const frame = captureCharFrame();

    // Badge should use the shared indicator format: [S3]
    expect(frame).toContain('[S3]');
  });

  it('supports different provider types', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ProviderIndicator providerType="gcs" />,
      { width: 40, height: 3 }
    );

    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain('[GCS]');
  });

  it('uppercases unknown provider types in the badge', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ProviderIndicator providerType="minio" />,
      { width: 40, height: 3 }
    );

    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain('[MINIO]');
  });
});
