# open-file

A terminal file explorer for cloud storage and remote filesystems. Navigate S3, GCS, SFTP, FTP, and local files with vim-style keybindings.

## Features

- **Multi-provider support** - S3, Google Cloud Storage, SFTP, FTP, and local filesystem
- **Vim-style navigation** - `j`/`k` movement, `dd` delete, `yy` copy, visual mode selection
- **Buffer-as-editor** - Edit filenames inline, create entries by typing
- **Profiles** - Save and switch between connection configurations
- **Themeable** - Multiple color themes with per-profile overrides

## Installation

```bash
# Clone and install
git clone https://github.com/yourusername/open-file.git
cd open-file
bun install

# Run
bun run src/index.tsx
```

Requires [Bun](https://bun.sh/) >= 1.0.0.

## Quick Start

```bash
# Start the application
bun run src/index.tsx

# Enable debug logging
bun run src/index.tsx --debug
```

Use `P` to open the profile selector and switch between configured connections.

## Keybindings

### Navigation

| Key                     | Action                 |
| ----------------------- | ---------------------- |
| `j` / `k`               | Move down / up         |
| `Enter` / `l`           | Open directory or file |
| `-` / `h` / `Backspace` | Go to parent           |
| `gg` / `G`              | Jump to top / bottom   |
| `Ctrl+n` / `Ctrl+p`     | Page down / up         |

### Operations

| Key  | Action                     |
| ---- | -------------------------- |
| `i`  | Create new entry           |
| `a`  | Rename entry               |
| `dd` | Delete (with confirmation) |
| `yy` | Copy to clipboard          |
| `p`  | Paste                      |
| `v`  | Visual selection mode      |
| `/`  | Search/filter              |
| `r`  | Refresh                    |

### Dialogs

| Key | Action           |
| --- | ---------------- |
| `?` | Help             |
| `P` | Profile selector |
| `o` | Sort options     |
| `q` | Quit             |

### Commands

| Command     | Action                     |
| ----------- | -------------------------- |
| `:q`        | Quit                       |
| `:w`        | Save                       |
| `:profiles` | Open profile selector      |
| `:theme`    | Open theme selector        |
| `:log`      | Copy log path to clipboard |

## Configuration

Profiles are stored in `~/.config/open-file/profiles.jsonc`:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/mholtzscher/open-file/refs/heads/main/profiles.schema.json",
  "profiles": [
    {
      "id": "my-s3",
      "displayName": "Production S3",
      "provider": "s3",
      "themeId": "catppuccin-mocha",
      "config": {
        "region": "us-east-1",
        "profile": "production",
      },
    },
    {
      "id": "my-sftp",
      "displayName": "Dev Server",
      "provider": "sftp",
      "config": {
        "host": "dev.example.com",
        "username": "deploy",
        "privateKeyPath": "~/.ssh/id_rsa",
      },
    },
  ],
}
```

## Supported Providers

| Provider  | Capabilities                                       |
| --------- | -------------------------------------------------- |
| **S3**    | List, read, write, delete, copy, move, buckets     |
| **GCS**   | List, read, write, delete, copy, move, buckets     |
| **SFTP**  | List, read, write, delete, move, permissions       |
| **FTP**   | List, read, write, delete, move                    |
| **Local** | List, read, write, delete, copy, move, permissions |

## License

MIT

## Acknowledgments

- Inspired by [oil.nvim](https://github.com/stevearc/oil.nvim)
- Built with [Bun](https://bun.sh/) and [OpenTUI](https://github.com/sst/opentui)
