#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';

const dir = process.cwd();
const version = process.env.OPEN_FILE_VERSION ?? 'local';

fs.rmSync(path.join(dir, 'dist'), { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./src/index.tsx'],
  outdir: './dist',
  target: 'bun',
  sourcemap: 'none',
  external: [
    '@opentui/core',
    // Native modules that need to be resolved at runtime
    'cpu-features',
    'ssh2',
    '@mapbox/node-pre-gyp',
  ],
  define: {
    OPEN_FILE_VERSION: `'${version}'`,
  },
});

if (!result.success) {
  console.error('bundle failed');
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
