# AWS Profile & Region Support Implementation Plan

## Overview
Implement automatic detection and usage of the active AWS profile and its configured region for S3 authentication. This will allow users to run `open-s3 my-bucket` without needing to specify `--region` every time - it will use their AWS profile's settings instead.

## Problem Statement
Currently, the application:
- Uses hardcoded fallback region (`us-east-1`)
- Requires explicit `--region` flag or `AWS_REGION` env var
- Doesn't respect the user's active AWS profile
- Doesn't read the profile's configured region from `~/.aws/config`

## Solution
Integrate with AWS SDK v3's credential chain and profile loading to:
1. Detect active AWS profile from `AWS_PROFILE` env var or `~/.aws/config`
2. Load the profile's configured region from `~/.aws/config`
3. Use AWS SDK's credential provider chain for automatic credential resolution
4. Allow CLI flag override when needed

## Key Features
- **Automatic profile detection**: Read `AWS_PROFILE` environment variable
- **Region from profile**: Extract region from `~/.aws/config` for the active profile
- **Credential chain**: Use AWS SDK v3's built-in credential providers
- **CLI override**: `--profile` flag to manually specify profile
- **Config file support**: Add profile field to `.open-s3rc.json`
- **Backward compatibility**: Maintain support for explicit credentials

## Tickets Created

### Epic: bd-5qq
**Use active AWS profile and its region for authentication**
- Priority: High (1)
- Status: Open

### Subtasks

| ID | Title | Priority | Status |
|---|---|---|---|
| bd-al9 | Detect active AWS profile from environment | 1 | Open |
| bd-8k3 | Load region from AWS profile config | 1 | Open |
| bd-ams | Update S3Adapter to use AWS SDK credential chain | 1 | Open |
| bd-cvy | Replace hardcoded region defaults with profile region | 1 | Open |
| bd-q3a | Add --profile CLI flag for profile override | 1 | Open |
| bd-52s | Update config file to support AWS profile setting | 1 | Open |
| bd-6k9 | Update CLI help and documentation | 2 | Open |
| bd-7sh | Add tests for AWS profile detection | 2 | Open |

## Technical Approach

### 1. Profile Detection (bd-al9)
- Create utility function `getActiveAwsProfile()` in `src/utils/aws-profile.ts`
- Check `AWS_PROFILE` environment variable first
- Default to 'default' profile if not set
- Handle missing profile gracefully

### 2. Region Loading (bd-8k3)
- Parse `~/.aws/config` file format
- Extract region for specified profile
- Create `loadProfileRegion(profile: string)` utility function
- Support both named profiles and default profile

### 3. S3Adapter Credential Chain (bd-ams)
- Update `S3AdapterConfig` to accept `profile` parameter
- Use AWS SDK v3's `fromSharedConfigFiles()` or credential chain
- Remove hardcoded credential logic when profile is provided
- Maintain backward compatibility with explicit credentials

### 4. Region Handling (bd-cvy)
- Priority order: CLI --region > config file region > profile region > us-east-1
- Update S3Adapter constructor to use profile region
- Pass region from profile to S3Client config

### 5. CLI Changes (bd-q3a)
- Add `--profile` or `-p` flag to CLI args parser
- Update help documentation with profile examples
- Parse profile argument in `parseArgs()`

### 6. Config File Updates (bd-52s)
- Add optional `profile` field to config schema
- Update `ConfigManager` to read/write profile setting
- Support config file at `~/.open-s3rc.json`

### 7. Documentation (bd-6k9)
- Update help text with profile usage examples
- Document AWS credentials resolution order
- Add examples for different AWS credential scenarios

### 8. Testing (bd-7sh)
- Unit tests for profile detection
- Tests for region loading from config
- Integration tests with mock AWS configs
- Test priority ordering of credentials

## Usage Examples

### After Implementation

```bash
# Use active AWS profile and its region
open-s3 my-bucket

# Override profile explicitly
open-s3 --profile production my-bucket

# Override region (highest priority)
open-s3 --region us-west-2 my-bucket

# Use specific profile AND region
open-s3 --profile staging --region eu-west-1 my-bucket

# Use config file
# ~/.open-s3rc.json:
# { "profile": "default", "bucket": "my-bucket" }
open-s3
```

## Implementation Order
1. **bd-al9**: Implement profile detection utility
2. **bd-8k3**: Implement region loading from config
3. **bd-ams**: Update S3Adapter to use credential chain
4. **bd-cvy**: Update region handling logic
5. **bd-q3a**: Add CLI profile flag
6. **bd-52s**: Update config file support
7. **bd-6k9**: Update documentation
8. **bd-7sh**: Add comprehensive tests

## Dependencies
- AWS SDK v3 already installed (`@aws-sdk/client-s3`)
- No additional dependencies needed
- Standard Node.js `fs` module for reading config files

## Acceptance Criteria
- ✅ Active AWS profile automatically detected
- ✅ Profile's configured region used by default
- ✅ CLI `--profile` flag works for override
- ✅ Config file supports profile setting
- ✅ Backward compatibility maintained
- ✅ All tests passing
- ✅ Documentation updated
- ✅ No region needed in typical workflows

## Task Dependencies (Established)

```
bd-al9 (Profile detection)         ┐
                                    ├─> bd-ams (S3Adapter update)
bd-8k3 (Region loading)            ┘
                                    ↓
                        bd-cvy (Region defaults)
                                    ↓
                        bd-q3a (CLI flag)
                                    ↓
                        bd-52s (Config file)
                                   / \
                                  /   \
                    bd-6k9 (Docs) ← · → bd-7sh (Tests)
```

### Ready Tasks (No Blockers)
- ✅ bd-al9 - Can start immediately
- ✅ bd-8k3 - Can start immediately (can work in parallel with bd-al9)

### Workflow
1. Complete bd-al9 and bd-8k3 (can do in parallel)
2. Then bd-ams becomes ready
3. Then bd-cvy becomes ready
4. Then bd-q3a becomes ready
5. Then bd-52s becomes ready
6. Finally bd-6k9 and bd-7sh (can do in parallel)

### Handy Commands
```bash
# Check what's ready to work on
bd ready --json

# Start working on a task
bd update bd-al9 --status in_progress

# When done, close it
bd close bd-al9 --reason "Implementation complete"

# See dependency tree
bd dep tree bd-ams

# View blocked tasks
bd blocked --json
```

