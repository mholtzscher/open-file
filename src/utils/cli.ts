/**
 * CLI argument parsing and help
 */

/**
 * CLI arguments
 */
export interface CliArgs {
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
