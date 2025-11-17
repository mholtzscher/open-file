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
  profile?: string; // AWS profile name
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  config?: string;
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
     } else if (arg === '--config' || arg === '-c') {
       result.config = args[++i];
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
open-s3 - Terminal UI for exploring AWS S3 buckets

USAGE:
  open-s3 [OPTIONS] [BUCKET]

ARGUMENTS:
  BUCKET              S3 bucket to open (default: from config)

OPTIONS:
    -b, --bucket NAME       S3 bucket name
    --mock                  Use mock adapter for testing (no AWS required)
    -a, --adapter TYPE      Adapter type: mock or s3 (default: s3)
    -p, --profile NAME      AWS profile name (default: active profile or 'default')
    -r, --region REGION     AWS region (default: from profile, then us-east-1)
    --endpoint URL          Custom S3 endpoint (for LocalStack, etc.)
    --access-key KEY        AWS access key
    --secret-key KEY        AWS secret key
    -c, --config FILE       Config file path (default: ~/.open-s3rc.json)
    --debug                 Enable debug logging to file
    -h, --help              Show this help message
    -v, --version           Show version

EXAMPLES:
   # Open bucket using active AWS profile
   open-s3 my-bucket

   # Use specific AWS profile
   open-s3 --profile production my-bucket

   # Override region (takes precedence over profile region)
   open-s3 --region us-west-2 my-bucket

   # Use mock adapter for testing (no AWS required)
   open-s3 --mock

   # Use custom endpoint (LocalStack)
   open-s3 --endpoint http://localhost:4566 test-bucket

   # Specify AWS credentials explicitly
   open-s3 --profile staging --region us-east-1 my-bucket

KEYBINDINGS (vim-style):
  j/k         Navigate up/down
  g/G         Go to top/bottom
  Enter/l     Open file/directory
  h/Backspace Go to parent directory
  v           Start visual selection
  d           Delete selected entries
  i/a         Enter edit mode
  w           Save changes
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
