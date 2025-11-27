/**
 * CLI argument parsing and help
 */

/**
 * CLI arguments
 */
export interface CliArgs {
  bucket?: string;
  adapter?: 'mock' | 's3';
  mock?: boolean; // Shorthand for --adapter mock
  region?: string;
  profile?: string; // open-s3 profile ID from profiles.json
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  debug?: boolean;
  help?: boolean;
  version?: boolean;
}

/**
 * Parse CLI arguments
 */
export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--debug') {
      result.debug = true;
    } else if (arg === '--mock') {
      result.mock = true;
      result.adapter = 'mock';
    } else if (arg === '--bucket' || arg === '-b') {
      result.bucket = args[++i];
    } else if (arg === '--adapter' || arg === '-a') {
      const adapter = args[++i];
      if (adapter === 'mock' || adapter === 's3') {
        result.adapter = adapter;
      }
    } else if (arg === '--region' || arg === '-r') {
      result.region = args[++i];
    } else if (arg === '--profile' || arg === '-p') {
      result.profile = args[++i];
    } else if (arg === '--endpoint') {
      result.endpoint = args[++i];
    } else if (arg === '--access-key') {
      result.accessKey = args[++i];
    } else if (arg === '--secret-key') {
      result.secretKey = args[++i];
    } else if (!arg.startsWith('-')) {
      // First non-flag argument is the bucket
      if (!result.bucket) {
        result.bucket = arg;
      }
    }
  }

  return result;
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
open-s3 - Terminal UI for exploring cloud storage

USAGE:
  open-s3 [OPTIONS] [BUCKET]

ARGUMENTS:
  BUCKET              Bucket/container to open (optional)

OPTIONS:
    -p, --profile NAME      Use a saved profile from profiles.json
    -b, --bucket NAME       Bucket/container name to open directly
    --mock                  Use mock adapter for testing (no cloud required)
    -a, --adapter TYPE      Adapter type: mock or s3 (default: s3)
    -r, --region REGION     AWS region (for ad-hoc S3 connections)
    --endpoint URL          Custom S3 endpoint (for LocalStack, MinIO, etc.)
    --access-key KEY        AWS access key (for ad-hoc S3 connections)
    --secret-key KEY        AWS secret key (for ad-hoc S3 connections)
    --debug                 Enable debug logging to file
    -h, --help              Show this help message
    -v, --version           Show version

EXAMPLES:
   # Start with profile selector (default)
   open-s3

   # Use a saved profile
   open-s3 --profile localstack

   # Use a saved profile and open a specific bucket
   open-s3 --profile production --bucket my-bucket

   # Ad-hoc connection with custom endpoint (LocalStack)
   open-s3 --endpoint http://localhost:4566 --bucket test-bucket

   # Use mock adapter for testing (no cloud required)
   open-s3 --mock

KEYBINDINGS (vim-style):
  j/k         Navigate up/down
  g/G         Go to top/bottom
  Enter/l     Open file/directory
  h/Backspace Go to parent directory
  v           Start visual selection
  d           Delete selected entries
  i/a         Enter edit mode
  w           Save changes
  P           Switch profile
  q           Quit

For more information, see the README.md file.
`);
}

/**
 * Get version
 */
export function getVersion(): string {
  return '1.0.0';
}

/**
 * Print version
 */
export function printVersion(): void {
  console.log(`open-s3 v${getVersion()}`);
}
