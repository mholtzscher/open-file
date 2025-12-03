/**
 * CLI argument parsing and help
 */

/**
 * Subcommand types
 */
export type SubCommand = 'auth';

/**
 * Auth subcommand providers
 */
export type AuthProvider = 'gdrive';

/**
 * CLI arguments
 */
export interface CliArgs {
  debug?: boolean;
  help?: boolean;
  version?: boolean;
  /** Subcommand (e.g., 'auth') */
  subCommand?: SubCommand;
  /** For auth subcommand: the provider type */
  authProvider?: AuthProvider;
  /** Remaining args after subcommand */
  subArgs?: string[];
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
    } else if (arg === 'auth') {
      // Auth subcommand
      result.subCommand = 'auth';
      // Next arg should be provider type
      const provider = args[i + 1];
      if (provider === 'gdrive') {
        result.authProvider = provider;
        result.subArgs = args.slice(i + 2);
      } else if (provider === '--help' || provider === '-h') {
        result.help = true;
        result.subArgs = [];
      } else {
        // Unknown provider or help requested
        result.subArgs = args.slice(i + 1);
      }
      break; // Stop parsing main args
    }
  }

  return result;
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
open-file - Terminal UI for exploring cloud storage

USAGE:
  open-file [OPTIONS]
  open-file auth <provider> [AUTH_OPTIONS]

COMMANDS:
  auth gdrive     Authenticate with Google Drive

OPTIONS:
    --debug                 Enable debug logging to file
    -h, --help              Show this help message
    -v, --version           Show version

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
Run 'open-file auth --help' for authentication help.
`);
}

/**
 * Print auth help message
 */
export function printAuthHelp(): void {
  console.log(`
open-file auth - Authenticate with storage providers

USAGE:
  open-file auth <provider> [OPTIONS]

PROVIDERS:
  gdrive          Google Drive (OAuth2)

EXAMPLES:
  open-file auth gdrive my-profile --client-id <id> --client-secret <secret>

Run 'open-file auth <provider> --help' for provider-specific help.
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
  console.log(`open-file v${getVersion()}`);
}
