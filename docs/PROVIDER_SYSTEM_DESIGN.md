# Provider & Profile System Design

> **Status**: Draft proposal for multi-provider storage abstraction
> **Date**: 2025-11-25

## Overview

This document proposes a unified abstraction layer for supporting multiple storage providers (S3, GCS, FTP/SFTP, NFS, SMB) behind a common interface with a profile-based configuration system.

## Goals

1. Support multiple provider types with a single codebase
2. Allow users to configure named profiles for quick access
3. Handle provider capability differences gracefully (not all providers support all operations)
4. Preserve existing S3 functionality while enabling extension

---

## Current State Analysis

The existing interface hierarchy (`adapter.ts`) follows ISP principles:

```
ReadableStorageAdapter
    └── MutableStorageAdapter
            └── TransferableStorageAdapter
                    └── BucketAwareAdapter
```

**Issues with current design:**

- S3-specific assumptions baked in (bucket concepts, regions)
- Uses interface inheritance rather than capability declaration
- No support for connection-oriented protocols (SFTP/FTP)
- No profile/configuration management

---

## Provider Capability Comparison

Based on research of AWS S3, Google Cloud Storage, FTP (RFC 959), SFTP (SSH File Transfer Protocol), NFS (RFC 8881), and SMB (MS-SMB2):

| Capability          |  S3  | GCS | SFTP | FTP | NFS | SMB | GDrive |
| ------------------- | :--: | :-: | :--: | :-: | :-: | :-: | :----: |
| List                |  ✅  | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Read                |  ✅  | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Write               |  ✅  | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Delete              |  ✅  | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Mkdir               | ✅\* | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Rmdir               | ✅\* | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| Copy                |  ✅  | ✅  |  ❌  | ❌  | ✅  | ✅  |   ✅   |
| Move                |  ✅  | ✅  |  ✅  | ✅  | ✅  | ✅  |   ✅   |
| ServerSideCopy      |  ✅  | ✅  |  ❌  | ❌  | ✅² | ✅³ |   ✅   |
| Resume              |  ✅  | ✅  |  ✅  | ⚠️  | ✅  | ✅  |   ✅   |
| Versioning          |  ✅  | ✅  |  ❌  | ❌  | ❌  | ❌  |   ✅   |
| Metadata            |  ✅  | ✅  |  ❌  | ❌  | ✅⁴ | ⚠️  |   ✅   |
| Permissions         |  ❌  | ❌  |  ✅  | ❌  | ✅  | ✅⁵ |  ⚠️⁹   |
| Symlinks            |  ❌  | ❌  |  ✅  | ❌  | ✅  | ⚠️  |   ❌   |
| Hardlinks           |  ❌  | ❌  |  ⚠️  | ❌  | ✅  | ❌  |   ❌   |
| PresignedUrls       |  ✅  | ✅  |  ❌  | ❌  | ❌  | ❌  |  ⚠️¹⁰  |
| BatchDelete         |  ✅  | ✅  |  ❌  | ❌  | ❌  | ❌  |   ❌   |
| Buckets/Containers  |  ✅  | ✅  |  ❌  | ❌  | ❌  | ✅⁶ |  ✅¹¹  |
| FileLocking         |  ❌  | ❌  |  ❌  | ❌  | ✅  | ✅  |   ❌   |
| ExtendedAttrs       |  ❌  | ❌  |  ❌  | ❌  | ✅⁷ | ⚠️⁸ |  ⚠️¹²  |
| Delegations/Oplocks |  ❌  | ❌  |  ❌  | ❌  | ✅  | ✅  |   ❌   |

\*S3 directories are simulated via empty objects with trailing `/`

**Notes:**

- ² NFSv4.2 supports server-side copy via COPY/OFFLOAD_COPY operations
- ³ SMB 3.0+ supports server-side copy via FSCTL_SRV_COPYCHUNK
- ⁴ NFSv4.2 supports extended attributes (xattr)
- ⁵ SMB uses Windows ACLs, not POSIX permissions
- ⁶ SMB shares are similar to containers
- ⁷ NFSv4.2 only, via GETXATTR/SETXATTR operations
- ⁸ SMB alternate data streams (different paradigm)
- ⁹ Google Drive uses ACL-based sharing model, not POSIX permissions
- ¹⁰ Google Drive has `webContentLink` but not true presigned URLs
- ¹¹ Google Drive: My Drive + Shared Drives as containers
- ¹² Google Drive custom properties serve similar purpose

---

## Proposed Design

### 1. Profile Configuration

```typescript
// types/profile.ts

export type ProviderType = 's3' | 'gcs' | 'sftp' | 'ftp' | 'nfs' | 'smb' | 'gdrive';

/**
 * Base profile that all providers share
 */
export interface BaseProfile {
  id: string;
  displayName: string;
  provider: ProviderType;
}

/**
 * S3-specific profile configuration
 */
export interface S3Profile extends BaseProfile {
  provider: 's3';
  config: {
    region?: string;
    profile?: string; // AWS profile name
    accessKeyId?: string; // Direct credentials (alternative to profile)
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string; // For MinIO, LocalStack, etc.
    forcePathStyle?: boolean;
  };
}

/**
 * GCS-specific profile configuration
 */
export interface GCSProfile extends BaseProfile {
  provider: 'gcs';
  config: {
    projectId?: string;
    keyFilePath?: string; // Service account JSON path
    useApplicationDefault?: boolean; // Use ADC
  };
}

/**
 * SFTP-specific profile configuration
 */
export interface SFTPProfile extends BaseProfile {
  provider: 'sftp';
  config: {
    host: string;
    port?: number; // Default: 22
    username: string;
    authMethod: 'password' | 'key' | 'agent';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    basePath?: string; // Starting directory
  };
}

/**
 * FTP-specific profile configuration
 */
export interface FTPProfile extends BaseProfile {
  provider: 'ftp';
  config: {
    host: string;
    port?: number; // Default: 21
    username?: string; // Optional for anonymous
    password?: string;
    secure?: boolean | 'implicit'; // FTPS
    basePath?: string; // Starting directory
  };
}

/**
 * NFS-specific profile configuration
 */
export interface NFSProfile extends BaseProfile {
  provider: 'nfs';
  config: {
    host: string;
    exportPath: string; // Server export path (e.g., /exports/data)
    version?: 3 | 4 | 4.1 | 4.2; // NFS version (default: auto-negotiate)
    port?: number; // Default: 2049
    uid?: number; // Override local UID
    gid?: number; // Override local GID
    authMethod?: 'sys' | 'krb5' | 'krb5i' | 'krb5p'; // Default: sys
    mountOptions?: string[]; // Additional mount options
  };
}

/**
 * SMB/CIFS-specific profile configuration
 */
export interface SMBProfile extends BaseProfile {
  provider: 'smb';
  config: {
    host: string;
    share: string; // Share name (e.g., "documents")
    port?: number; // Default: 445
    domain?: string; // AD domain or WORKGROUP
    username?: string;
    password?: string;
    version?: '2.0' | '2.1' | '3.0' | '3.1.1'; // SMB version
    encryption?: boolean; // SMB 3.0+ encryption
  };
}

/**
 * Google Drive-specific profile configuration
 */
export interface GoogleDriveProfile extends BaseProfile {
  provider: 'gdrive';
  config: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string; // Obtained after OAuth flow
    keyFilePath?: string; // For service accounts
    impersonateEmail?: string; // User to impersonate (service account)
    rootFolderId?: string; // Starting folder (default: 'root')
    includeSharedDrives?: boolean; // List shared drives as containers
    exportFormat?: 'pdf' | 'docx' | 'txt'; // For Google Workspace docs
    cacheTtlMs?: number; // Path cache TTL (default: 60000)
  };
}

export type Profile =
  | S3Profile
  | GCSProfile
  | SFTPProfile
  | FTPProfile
  | NFSProfile
  | SMBProfile
  | GoogleDriveProfile;
```

### 2. Capability System

Instead of interface inheritance, declare capabilities explicitly:

```typescript
// types/capabilities.ts

export enum Capability {
  // Core operations
  List = 'list',
  Read = 'read',
  Write = 'write',
  Delete = 'delete',

  // Navigation
  Mkdir = 'mkdir',
  Rmdir = 'rmdir',

  // File management
  Copy = 'copy', // In-provider copy
  Move = 'move', // Atomic rename/move
  ServerSideCopy = 'serverSideCopy', // No data transfer needed

  // Transfers
  Download = 'download', // To local filesystem
  Upload = 'upload', // From local filesystem
  Resume = 'resume', // Resumable transfers

  // Advanced
  Versioning = 'versioning',
  Metadata = 'metadata', // Custom metadata support
  Permissions = 'permissions', // POSIX-style permissions
  Symlinks = 'symlinks',
  Hardlinks = 'hardlinks', // NFS hardlinks
  PresignedUrls = 'presignedUrls',
  BatchDelete = 'batchDelete',
  ExtendedAttrs = 'extendedAttrs', // xattr (NFS) or ADS (SMB)

  // Container concepts
  Containers = 'containers', // S3/GCS bucket listing, SMB shares

  // Locking (NFS/SMB)
  FileLocking = 'fileLocking', // Byte-range locks
  Delegations = 'delegations', // NFS delegations / SMB oplocks
}
```

### 3. Operation Result with Status Codes

```typescript
// types/operation-result.ts

export enum OperationStatus {
  Success = 'success',
  NotFound = 'not_found',
  PermissionDenied = 'permission_denied',
  Unimplemented = 'unimplemented',
  ConnectionFailed = 'connection_failed',
  Error = 'error',
}

export interface OperationError {
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export interface OperationResult<T = void> {
  status: OperationStatus;
  data?: T;
  error?: OperationError;
}

// Helper factory functions
export const Result = {
  success: <T>(data?: T): OperationResult<T> => ({
    status: OperationStatus.Success,
    data,
  }),

  notFound: (path: string): OperationResult => ({
    status: OperationStatus.NotFound,
    error: {
      code: 'NOT_FOUND',
      message: `Path not found: ${path}`,
      retryable: false,
    },
  }),

  permissionDenied: (path: string): OperationResult => ({
    status: OperationStatus.PermissionDenied,
    error: {
      code: 'PERMISSION_DENIED',
      message: `Access denied: ${path}`,
      retryable: false,
    },
  }),

  unimplemented: (operation: string): OperationResult => ({
    status: OperationStatus.Unimplemented,
    error: {
      code: 'UNIMPLEMENTED',
      message: `${operation} not supported by this provider`,
      retryable: false,
    },
  }),

  connectionFailed: (message: string): OperationResult => ({
    status: OperationStatus.ConnectionFailed,
    error: {
      code: 'CONNECTION_FAILED',
      message,
      retryable: true,
    },
  }),

  error: (code: string, message: string, retryable = false, cause?: unknown): OperationResult => ({
    status: OperationStatus.Error,
    error: { code, message, retryable, cause },
  }),
};

// Type guard for success
export function isSuccess<T>(
  result: OperationResult<T>
): result is OperationResult<T> & { data: T } {
  return result.status === OperationStatus.Success;
}
```

### 4. Enhanced Entry Type

Extend the existing `Entry` type to handle provider-specific metadata:

```typescript
// types/entry.ts (enhanced)

export enum EntryType {
  File = 'file',
  Directory = 'directory',
  Bucket = 'bucket', // S3/GCS containers
  Symlink = 'symlink', // SFTP
}

export interface EntryMetadata {
  // Universal
  contentType?: string;

  // Cloud storage (S3/GCS)
  etag?: string;
  storageClass?: string;
  versionId?: string;

  // POSIX (SFTP/FTP)
  permissions?: number; // e.g., 0o755
  owner?: string;
  group?: string;
  accessed?: Date;

  // Symlink target (SFTP)
  symlinkTarget?: string;

  // Container info (buckets)
  region?: string;
  createdAt?: Date;
  totalSize?: number;
  objectCount?: number;

  // Custom/provider-specific
  custom?: Record<string, string>;
  providerData?: Record<string, unknown>; // Raw provider data
}

export interface Entry {
  id: string;
  name: string;
  type: EntryType;
  path: string;
  size?: number;
  modified?: Date;
  metadata?: EntryMetadata;
}
```

### 5. Unified Storage Provider Interface

```typescript
// adapters/provider.ts

import { Entry, EntryType } from '../types/entry';
import { Capability } from '../types/capabilities';
import { OperationResult } from '../types/operation-result';

export interface ListOptions {
  limit?: number;
  continuationToken?: string;
  recursive?: boolean;
}

export interface ListResult {
  entries: Entry[];
  continuationToken?: string;
  hasMore: boolean;
}

export interface ReadOptions {
  offset?: number;
  length?: number;
  onProgress?: ProgressCallback;
}

export interface WriteOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  onProgress?: ProgressCallback;
}

export interface DeleteOptions {
  recursive?: boolean;
  onProgress?: ProgressCallback;
}

export interface TransferOptions {
  recursive?: boolean;
  overwrite?: boolean;
  onProgress?: ProgressCallback;
}

export interface ProgressEvent {
  operation: string;
  bytesTransferred: number;
  totalBytes?: number;
  percentage: number;
  currentFile?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Unified storage provider interface
 *
 * All operations return OperationResult to handle:
 * - Success with data
 * - Unimplemented (provider doesn't support this operation)
 * - Errors with context
 */
export interface StorageProvider {
  readonly name: string;
  readonly displayName: string;

  // === Capability Introspection ===
  getCapabilities(): Set<Capability>;
  hasCapability(cap: Capability): boolean;

  // === Lifecycle (for connection-oriented protocols) ===
  connect?(): Promise<OperationResult>;
  disconnect?(): Promise<void>;
  isConnected?(): boolean;

  // === Core Read Operations (all providers must implement) ===
  list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>>;
  getMetadata(path: string): Promise<OperationResult<Entry>>;
  exists(path: string): Promise<OperationResult<boolean>>;
  read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>>;

  // === Mutable Operations ===
  write(path: string, content: Buffer, options?: WriteOptions): Promise<OperationResult>;
  mkdir(path: string): Promise<OperationResult>;
  delete(path: string, options?: DeleteOptions): Promise<OperationResult>;

  // === Move/Copy ===
  move(source: string, dest: string, options?: TransferOptions): Promise<OperationResult>;
  copy(source: string, dest: string, options?: TransferOptions): Promise<OperationResult>;

  // === Local Filesystem Transfers ===
  downloadToLocal(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<OperationResult>;
  uploadFromLocal(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<OperationResult>;

  // === Container Operations (S3/GCS buckets) ===
  listContainers?(): Promise<OperationResult<Entry[]>>;
  setContainer?(name: string): void;
  getContainer?(): string | undefined;

  // === Advanced Operations ===
  setMetadata?(path: string, metadata: Record<string, string>): Promise<OperationResult>;
  getPresignedUrl?(
    path: string,
    operation: 'read' | 'write',
    expiresInSeconds: number
  ): Promise<OperationResult<string>>;
  readSymlink?(path: string): Promise<OperationResult<string>>;
  setPermissions?(path: string, mode: number): Promise<OperationResult>;
}
```

### 6. Base Provider with Fallbacks

```typescript
// adapters/base-provider.ts

import {
  StorageProvider,
  ListOptions,
  ListResult,
  ReadOptions,
  WriteOptions,
  DeleteOptions,
  TransferOptions,
} from './provider';
import { Entry } from '../types/entry';
import { Capability } from '../types/capabilities';
import { OperationResult, OperationStatus, Result, isSuccess } from '../types/operation-result';

/**
 * Abstract base class for storage providers
 *
 * Provides:
 * - Capability management
 * - Default unimplemented responses
 * - Fallback strategies (e.g., move = copy + delete)
 */
export abstract class BaseStorageProvider implements StorageProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;

  protected capabilities = new Set<Capability>();

  // === Capability Management ===

  getCapabilities(): Set<Capability> {
    return new Set(this.capabilities);
  }

  hasCapability(cap: Capability): boolean {
    return this.capabilities.has(cap);
  }

  protected addCapability(...caps: Capability[]): void {
    caps.forEach(cap => this.capabilities.add(cap));
  }

  // === Abstract methods that must be implemented ===

  abstract list(path: string, options?: ListOptions): Promise<OperationResult<ListResult>>;
  abstract getMetadata(path: string): Promise<OperationResult<Entry>>;
  abstract exists(path: string): Promise<OperationResult<boolean>>;
  abstract read(path: string, options?: ReadOptions): Promise<OperationResult<Buffer>>;

  // === Default implementations (return unimplemented) ===

  async write(_path: string, _content: Buffer, _options?: WriteOptions): Promise<OperationResult> {
    return Result.unimplemented('write');
  }

  async mkdir(_path: string): Promise<OperationResult> {
    return Result.unimplemented('mkdir');
  }

  async delete(_path: string, _options?: DeleteOptions): Promise<OperationResult> {
    return Result.unimplemented('delete');
  }

  async downloadToLocal(
    _remotePath: string,
    _localPath: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Result.unimplemented('downloadToLocal');
  }

  async uploadFromLocal(
    _localPath: string,
    _remotePath: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Result.unimplemented('uploadFromLocal');
  }

  // === Move with fallback to copy + delete ===

  async move(source: string, dest: string, options?: TransferOptions): Promise<OperationResult> {
    // If provider has native move, use it
    if (this.hasCapability(Capability.Move)) {
      return this.nativeMove(source, dest, options);
    }

    // Fallback: copy + delete
    if (this.hasCapability(Capability.Copy) && this.hasCapability(Capability.Delete)) {
      const copyResult = await this.copy(source, dest, options);
      if (!isSuccess(copyResult)) {
        return copyResult;
      }
      return this.delete(source, { recursive: options?.recursive });
    }

    // Fallback: read + write + delete (for providers without copy)
    if (
      this.hasCapability(Capability.Read) &&
      this.hasCapability(Capability.Write) &&
      this.hasCapability(Capability.Delete)
    ) {
      const readResult = await this.read(source);
      if (!isSuccess(readResult)) {
        return readResult;
      }
      const writeResult = await this.write(dest, readResult.data!);
      if (!isSuccess(writeResult)) {
        return writeResult;
      }
      return this.delete(source);
    }

    return Result.unimplemented('move');
  }

  /**
   * Override this for native move support
   */
  protected async nativeMove(
    _source: string,
    _dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Result.unimplemented('move');
  }

  // === Copy with fallback to read + write ===

  async copy(source: string, dest: string, options?: TransferOptions): Promise<OperationResult> {
    // If provider has native copy, use it
    if (this.hasCapability(Capability.Copy) || this.hasCapability(Capability.ServerSideCopy)) {
      return this.nativeCopy(source, dest, options);
    }

    // Fallback: read + write
    if (this.hasCapability(Capability.Read) && this.hasCapability(Capability.Write)) {
      const readResult = await this.read(source);
      if (!isSuccess(readResult)) {
        return readResult;
      }
      return this.write(dest, readResult.data!);
    }

    return Result.unimplemented('copy');
  }

  /**
   * Override this for native copy support
   */
  protected async nativeCopy(
    _source: string,
    _dest: string,
    _options?: TransferOptions
  ): Promise<OperationResult> {
    return Result.unimplemented('copy');
  }
}
```

### 7. Provider Factory

```typescript
// adapters/provider-factory.ts

import {
  Profile,
  S3Profile,
  GCSProfile,
  SFTPProfile,
  FTPProfile,
  NFSProfile,
  SMBProfile,
} from '../types/profile';
import { StorageProvider } from './provider';

// Provider implementations would be imported here
// import { S3Provider } from './s3-provider';
// import { GCSProvider } from './gcs-provider';
// import { SFTPProvider } from './sftp-provider';
// import { FTPProvider } from './ftp-provider';
// import { NFSProvider } from './nfs-provider';
// import { SMBProvider } from './smb-provider';

export interface ProviderFactory {
  createProvider(profile: Profile): StorageProvider;
  getSupportedProviders(): string[];
}

export function createProvider(profile: Profile): StorageProvider {
  switch (profile.provider) {
    case 's3':
      // return new S3Provider(profile as S3Profile);
      throw new Error('S3Provider not yet implemented');
    case 'gcs':
      // return new GCSProvider(profile as GCSProfile);
      throw new Error('GCSProvider not yet implemented');
    case 'sftp':
      // return new SFTPProvider(profile as SFTPProfile);
      throw new Error('SFTPProvider not yet implemented');
    case 'ftp':
      // return new FTPProvider(profile as FTPProfile);
      throw new Error('FTPProvider not yet implemented');
    case 'nfs':
      // return new NFSProvider(profile as NFSProfile);
      throw new Error('NFSProvider not yet implemented');
    case 'smb':
      // return new SMBProvider(profile as SMBProfile);
      throw new Error('SMBProvider not yet implemented');
    case 'gdrive':
      // return new GoogleDriveProvider(profile as GoogleDriveProfile);
      throw new Error('GoogleDriveProvider not yet implemented');
    default:
      throw new Error(`Unknown provider type: ${(profile as any).provider}`);
  }
}

export function getSupportedProviders(): string[] {
  return ['s3', 'gcs', 'sftp', 'ftp', 'nfs', 'smb', 'gdrive'];
}
```

### 8. Profile Manager

```typescript
// services/profile-manager.ts

import { Profile } from '../types/profile';
import { StorageProvider } from '../adapters/provider';
import { createProvider } from '../adapters/provider-factory';

export interface ProfileManager {
  // CRUD operations
  listProfiles(): Profile[];
  getProfile(id: string): Profile | undefined;
  saveProfile(profile: Profile): void;
  deleteProfile(id: string): void;

  // Validation
  validateProfile(profile: Profile): string[]; // Returns validation errors

  // Connection
  createProviderFromProfile(id: string): StorageProvider;
}

/**
 * Example implementation using local storage/config file
 */
export class FileProfileManager implements ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
    this.loadProfiles();
  }

  private loadProfiles(): void {
    // Load from config file
    // Implementation depends on config format (JSON, YAML, etc.)
  }

  private saveProfilesToDisk(): void {
    // Persist to config file
  }

  listProfiles(): Profile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  saveProfile(profile: Profile): void {
    this.profiles.set(profile.id, profile);
    this.saveProfilesToDisk();
  }

  deleteProfile(id: string): void {
    this.profiles.delete(id);
    this.saveProfilesToDisk();
  }

  validateProfile(profile: Profile): string[] {
    const errors: string[] = [];

    if (!profile.id) errors.push('Profile ID is required');
    if (!profile.displayName) errors.push('Display name is required');
    if (!profile.provider) errors.push('Provider type is required');

    // Provider-specific validation
    switch (profile.provider) {
      case 'sftp':
        if (!profile.config.host) errors.push('SFTP host is required');
        if (!profile.config.username) errors.push('SFTP username is required');
        break;
      case 'ftp':
        if (!profile.config.host) errors.push('FTP host is required');
        break;
      case 'nfs':
        if (!profile.config.host) errors.push('NFS host is required');
        if (!profile.config.exportPath) errors.push('NFS export path is required');
        break;
      case 'smb':
        if (!profile.config.host) errors.push('SMB host is required');
        if (!profile.config.share) errors.push('SMB share name is required');
        break;
      // S3 and GCS can use default credentials, so no required fields
    }

    return errors;
  }

  createProviderFromProfile(id: string): StorageProvider {
    const profile = this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }
    return createProvider(profile);
  }
}
```

---

## Key Design Decisions

### 1. Capability Declaration over Inheritance

**Why**: Providers explicitly declare what they support via `getCapabilities()`. The UI can introspect and adapt (e.g., disable copy button if `Capability.Copy` not supported, hide permissions column for S3).

**Alternative considered**: Deep interface hierarchy (current approach). Rejected because it assumes all providers follow the same capability progression.

### 2. OperationResult Instead of Exceptions

**Why**: Every operation returns a result with a status code. `Unimplemented` is a valid result, not an error. This makes it explicit when a feature isn't available and allows the UI to handle it gracefully.

**Example**:

```typescript
const result = await provider.copy(src, dest);
if (result.status === OperationStatus.Unimplemented) {
  showToast('Copy not supported by this provider');
} else if (!isSuccess(result)) {
  showError(result.error?.message);
}
```

### 3. Profile-Based Configuration

**Why**: Each provider type has its own config schema with type safety. The profile includes:

- `displayName` for UI presentation
- `provider` type for factory dispatch
- `config` with provider-specific auth and settings

### 4. Fallback Strategies in Base Class

**Why**: Providers get sensible fallbacks automatically:

- `move()` → `copy()` + `delete()` if no native move
- `copy()` → `read()` + `write()` if no server-side copy

Providers can override `nativeMove()` or `nativeCopy()` if they have optimized implementations.

### 5. Container Abstraction

**Why**: S3 buckets and GCS buckets are abstracted as "containers". SFTP/FTP don't have containers - they start at a filesystem path. This allows the UI to show a container picker for cloud providers while skipping it for traditional file protocols.

### 6. Connection Lifecycle

**Why**: SFTP/FTP need explicit `connect()` and `disconnect()` methods to manage TCP connections. Cloud providers (S3/GCS) can be stateless per-request. The `connect()` and `isConnected()` methods are optional on the interface.

### 7. No Cross-Provider Operations

**Limitation**: This design explicitly does **not** support cross-provider operations (e.g., copying directly from S3 to SFTP, or moving files between GCS and SMB).

**Rationale**:

- Cross-provider transfers would require streaming data through the client, negating server-side copy benefits
- Each provider has different semantics for metadata, permissions, and path handling
- Error handling and rollback for partial transfers across providers is complex
- The UI/UX for selecting source and destination providers adds significant complexity

**Workaround**: Users can download files locally first, then upload to the target provider. This makes the two-step process explicit and keeps each provider's operations self-contained.

**Future consideration**: If cross-provider support is needed, it should be implemented as a separate `TransferService` layer above the provider abstraction, not within the providers themselves.

---

## Migration Path

Build the new provider system alongside the existing implementation, then cutover.

### Phase 1: Foundation (Parallel to Existing)

Create new types and interfaces in a separate directory structure:

```
src/
  providers/           # NEW - provider system
    types/
      profile.ts       # Profile, ProviderType
      capabilities.ts  # Capability enum
      result.ts        # OperationResult, Result helpers
    base-provider.ts   # BaseStorageProvider abstract class
    provider.ts        # StorageProvider interface
    factory.ts         # createProvider()
    index.ts           # Public exports
  adapters/            # EXISTING - keep untouched
    s3-adapter.ts
    adapter.ts
    ...
```

**Deliverables:**

- `Profile` types for all providers (S3, GCS, SFTP, FTP, NFS, SMB)
- `Capability` enum with all capabilities
- `OperationResult` type and `Result` factory functions
- `StorageProvider` interface
- `BaseStorageProvider` abstract class with fallback strategies

#### Tickets

**P1-1: Create provider types directory structure**

- Create `src/providers/` directory
- Create `src/providers/types/` subdirectory
- Create `src/providers/index.ts` with placeholder exports
- Estimated: 0.5 hours

**P1-2: Implement Capability enum**

- Create `src/providers/types/capabilities.ts`
- Define all capabilities: List, Read, Write, Delete, Mkdir, Rmdir, Copy, Move, ServerSideCopy, Resume, Versioning, Metadata, Permissions, Symlinks, Hardlinks, PresignedUrls, BatchDelete, ExtendedAttrs, Containers, FileLocking, Delegations
- Add JSDoc comments for each capability
- Export from index
- Estimated: 1 hour

**P1-3: Implement OperationResult types**

- Create `src/providers/types/result.ts`
- Define `OperationStatus` enum (Success, NotFound, PermissionDenied, Unimplemented, ConnectionFailed, Error)
- Define `OperationError` interface
- Define `OperationResult<T>` generic type
- Implement `Result` factory object with helper methods (success, notFound, permissionDenied, unimplemented, connectionFailed, error)
- Implement `isSuccess<T>()` type guard
- Add unit tests for Result factory
- Export from index
- Estimated: 2 hours

**P1-4: Implement Profile types**

- Create `src/providers/types/profile.ts`
- Define `ProviderType` union type
- Define `BaseProfile` interface
- Define `S3Profile` interface with config (region, profile, accessKeyId, secretAccessKey, sessionToken, endpoint, forcePathStyle)
- Define `GCSProfile` interface with config (projectId, keyFilePath, useApplicationDefault)
- Define `SFTPProfile` interface with config (host, port, username, authMethod, password, privateKeyPath, passphrase, basePath)
- Define `FTPProfile` interface with config (host, port, username, password, secure, basePath)
- Define `NFSProfile` interface with config (host, exportPath, version, port, uid, gid, authMethod, mountOptions)
- Define `SMBProfile` interface with config (host, share, port, domain, username, password, version, encryption)
- Define `Profile` union type
- Export from index
- Estimated: 2 hours

**P1-5: Implement StorageProvider interface**

- Create `src/providers/provider.ts`
- Define `ListOptions` interface (limit, continuationToken, recursive)
- Define `ListResult` interface (entries, continuationToken, hasMore)
- Define `ReadOptions` interface (offset, length, onProgress)
- Define `WriteOptions` interface (contentType, metadata, onProgress)
- Define `DeleteOptions` interface (recursive, onProgress)
- Define `TransferOptions` interface (recursive, overwrite, onProgress)
- Define `ProgressEvent` interface (operation, bytesTransferred, totalBytes, percentage, currentFile)
- Define `ProgressCallback` type
- Define `StorageProvider` interface with all methods
- Add JSDoc comments for each method
- Export from index
- Estimated: 3 hours

**P1-6: Implement BaseStorageProvider abstract class**

- Create `src/providers/base-provider.ts`
- Implement capability management (getCapabilities, hasCapability, addCapability)
- Define abstract methods (list, getMetadata, exists, read)
- Implement default unimplemented responses for optional methods (write, mkdir, delete, downloadToLocal, uploadFromLocal)
- Implement `move()` with fallback strategy (native → copy+delete → read+write+delete)
- Implement `copy()` with fallback strategy (native → read+write)
- Add protected `nativeMove()` and `nativeCopy()` methods for subclasses to override
- Add unit tests for fallback strategies
- Export from index
- Estimated: 4 hours

**P1-7: Implement provider factory**

- Create `src/providers/factory.ts`
- Implement `createProvider(profile: Profile): StorageProvider` function (initially throws "not implemented" for all providers)
- Implement `getSupportedProviders(): ProviderType[]` function
- Export from index
- Estimated: 1 hour

**P1-8: Finalize Phase 1 exports and documentation**

- Update `src/providers/index.ts` to export all public types and functions
- Add README.md to providers directory explaining the architecture
- Verify all types compile correctly
- Run linter and fix any issues
- Estimated: 1 hour

**Phase 1 Total Estimate: 14.5 hours**

### Phase 2: S3 Provider (Parallel Implementation)

Create `S3Provider` that wraps the existing `S3Adapter`:

```typescript
// src/providers/s3-provider.ts
import { S3Adapter } from '../adapters/s3-adapter';

export class S3Provider extends BaseStorageProvider {
  private adapter: S3Adapter;

  constructor(profile: S3Profile) {
    this.adapter = new S3Adapter(/* map profile to adapter config */);
    // ... delegate all operations to adapter
  }
}
```

**Key principle:** The existing `S3Adapter` continues to work. `S3Provider` is a thin wrapper that translates between the new interface and the existing implementation.

**Deliverables:**

- `S3Provider` class wrapping `S3Adapter`
- Unit tests for `S3Provider`
- Verify feature parity with direct `S3Adapter` usage

#### Tickets

**P2-1: Create S3Provider class skeleton**

- Create `src/providers/s3/s3-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `S3Profile`
- Declare S3 capabilities in constructor (List, Read, Write, Delete, Mkdir, Rmdir, Copy, Move, ServerSideCopy, Resume, Versioning, Metadata, PresignedUrls, BatchDelete, Containers)
- Add placeholder methods that throw "not implemented"
- Estimated: 1 hour

**P2-2: Implement profile-to-adapter configuration mapping**

- Create `src/providers/s3/config-mapper.ts`
- Implement `mapProfileToAdapterConfig(profile: S3Profile): S3AdapterConfig`
- Handle region, credentials (profile vs direct), endpoint, forcePathStyle
- Add unit tests for config mapping
- Estimated: 2 hours

**P2-3: Implement S3Provider.list()**

- Delegate to `S3Adapter.listObjects()`
- Map adapter response to `OperationResult<ListResult>`
- Handle pagination (continuationToken)
- Convert adapter entries to provider Entry type
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 3 hours

**P2-4: Implement S3Provider.read()**

- Delegate to `S3Adapter.getObject()`
- Support offset/length options via Range header
- Map response to `OperationResult<Buffer>`
- Wire up progress callback if provided
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 2 hours

**P2-5: Implement S3Provider.write()**

- Delegate to `S3Adapter.putObject()` for small files
- Delegate to multipart upload for large files (>5MB threshold)
- Support contentType and metadata options
- Wire up progress callback
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 3 hours

**P2-6: Implement S3Provider.delete()**

- Delegate to `S3Adapter.deleteObject()` for single objects
- Delegate to `S3Adapter.deleteObjects()` for recursive deletes
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 2 hours

**P2-7: Implement S3Provider.mkdir()**

- Create empty object with trailing `/` (S3 directory convention)
- Delegate to `S3Adapter.putObject()` with empty body
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 1 hour

**P2-8: Implement S3Provider.copy() and nativeCopy()**

- Delegate to `S3Adapter.copyObject()` for server-side copy
- Handle cross-bucket copies
- Support recursive directory copies
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 3 hours

**P2-9: Implement S3Provider.move()**

- Implement as copy + delete (S3 has no native move)
- Reuse copy() and delete() implementations
- Ensure atomic-ish behavior (don't delete if copy fails)
- Add unit tests
- Estimated: 2 hours

**P2-10: Implement S3Provider.getMetadata() and exists()**

- Delegate to `S3Adapter.headObject()`
- Map S3 metadata to Entry.metadata
- Handle 404 → NotFound result
- Add unit tests
- Estimated: 2 hours

**P2-11: Implement S3Provider container operations**

- Implement `listContainers()` → `S3Adapter.listBuckets()`
- Implement `setContainer(name)` and `getContainer()`
- Store current bucket in provider instance
- Add unit tests
- Estimated: 2 hours

**P2-12: Implement S3Provider.downloadToLocal() and uploadFromLocal()**

- Delegate to existing adapter transfer operations
- Wire up progress callbacks
- Handle recursive transfers
- Map errors to OperationResult errors
- Add unit tests
- Estimated: 3 hours

**P2-13: Implement S3Provider advanced operations**

- Implement `getPresignedUrl()` for read/write operations
- Implement `setMetadata()` via copy-in-place with new metadata
- Add unit tests
- Estimated: 2 hours

**P2-14: Update provider factory for S3**

- Update `createProvider()` to instantiate `S3Provider` for 's3' type
- Add integration test creating provider from profile
- Estimated: 1 hour

**P2-15: S3Provider integration tests**

- Create integration test suite using LocalStack or mock
- Test full workflow: list → read → write → copy → delete
- Test error handling scenarios
- Verify feature parity with direct S3Adapter usage
- Estimated: 4 hours

**P2-16: S3Provider documentation**

- Add JSDoc comments to all public methods
- Document S3-specific behavior and limitations
- Add usage examples
- Estimated: 1 hour

**Phase 2 Total Estimate: 34 hours**

### Phase 3: Profile Manager

```
src/
  providers/
    services/
      profile-manager.ts    # FileProfileManager
      profile-storage.ts    # Config file I/O
```

**Deliverables:**

- `ProfileManager` interface and `FileProfileManager` implementation
- Profile persistence to `~/.config/open-s3/profiles.json`
- Profile validation
- CLI integration for profile management (optional)

#### Tickets

**P3-1: Define ProfileManager interface**

- Create `src/providers/services/profile-manager.ts`
- Define `ProfileManager` interface with methods:
  - `listProfiles(): Profile[]`
  - `getProfile(id: string): Profile | undefined`
  - `saveProfile(profile: Profile): void`
  - `deleteProfile(id: string): void`
  - `validateProfile(profile: Profile): ValidationError[]`
  - `createProviderFromProfile(id: string): StorageProvider`
- Define `ValidationError` type (field, message)
- Export from providers index
- Estimated: 1 hour

**P3-2: Implement profile storage utilities**

- Create `src/providers/services/profile-storage.ts`
- Implement `getConfigDir(): string` (platform-aware: ~/.config/open-s3 on Unix, %APPDATA%/open-s3 on Windows)
- Implement `getProfilesPath(): string`
- Implement `loadProfilesFromDisk(): Profile[]`
- Implement `saveProfilesToDisk(profiles: Profile[]): void`
- Handle missing directory (create on first save)
- Handle corrupted/invalid JSON gracefully
- Add unit tests with temp directories
- Estimated: 3 hours

**P3-3: Implement profile validation**

- Create `src/providers/services/profile-validator.ts`
- Implement `validateBaseProfile(profile: Profile): ValidationError[]`
  - Check id is non-empty and valid (alphanumeric + hyphens)
  - Check displayName is non-empty
  - Check provider is valid ProviderType
- Implement `validateS3Profile(profile: S3Profile): ValidationError[]`
  - Warn if no credentials and no profile name (will use default)
  - Validate endpoint URL format if provided
- Implement `validateSFTPProfile(profile: SFTPProfile): ValidationError[]`
  - Require host
  - Require username
  - Require authMethod
  - If authMethod is 'key', require privateKeyPath
  - If authMethod is 'password', require password
- Implement `validateFTPProfile(profile: FTPProfile): ValidationError[]`
  - Require host
- Implement `validateGCSProfile(profile: GCSProfile): ValidationError[]`
  - Validate keyFilePath exists if provided
- Implement `validateNFSProfile(profile: NFSProfile): ValidationError[]`
  - Require host
  - Require exportPath
  - Validate version if provided (3, 4, 4.1, 4.2)
- Implement `validateSMBProfile(profile: SMBProfile): ValidationError[]`
  - Require host
  - Require share
- Add unit tests for all validators
- Estimated: 4 hours

**P3-4: Implement FileProfileManager class**

- Create `FileProfileManager` class implementing `ProfileManager`
- Constructor loads profiles from disk
- Implement `listProfiles()` - return cached profiles
- Implement `getProfile(id)` - find by id
- Implement `saveProfile(profile)`:
  - Validate profile
  - If validation fails, throw with errors
  - Add/update in cache
  - Persist to disk
- Implement `deleteProfile(id)`:
  - Remove from cache
  - Persist to disk
- Implement `validateProfile(profile)` - delegate to validators
- Implement `createProviderFromProfile(id)`:
  - Get profile by id
  - Call `createProvider(profile)` from factory
- Add unit tests
- Estimated: 4 hours

**P3-5: Implement sensitive data handling**

- Create `src/providers/services/credential-helper.ts`
- Implement `maskSensitiveFields(profile: Profile): Profile` (for logging/display)
- Implement `hasSensitiveData(profile: Profile): boolean`
- Add warning when saving profiles with plaintext passwords
- Document security considerations (recommend env vars or keychain in future)
- Add unit tests
- Estimated: 2 hours

**P3-6: Add profile import/export utilities**

- Implement `exportProfiles(profiles: Profile[], includeSensitive: boolean): string` (JSON)
- Implement `importProfiles(json: string): Profile[]`
- Validate imported profiles
- Handle merge vs replace on import
- Add unit tests
- Estimated: 2 hours

**P3-7: Integration tests for ProfileManager**

- Test full lifecycle: create → save → load → update → delete
- Test persistence across ProfileManager instances
- Test validation error scenarios
- Test createProviderFromProfile integration
- Estimated: 3 hours

**P3-8: CLI commands for profile management (optional)**

- Add `open-s3 profile list` command
- Add `open-s3 profile add` command (interactive prompts)
- Add `open-s3 profile remove <id>` command
- Add `open-s3 profile show <id>` command (masked sensitive data)
- Add `open-s3 profile test <id>` command (test connection)
- Estimated: 6 hours (optional, can defer)

**Phase 3 Total Estimate: 19-25 hours (depending on CLI)**

### Phase 4: Additional Providers

Add providers incrementally, each in isolation:

```
src/
  providers/
    s3/                 # ✅ Done in Phase 2
    gcs/                # Google Cloud Storage
    sftp/               # SSH File Transfer Protocol
    ftp/                # FTP/FTPS
    nfs/                # NFS (OS mount approach)
    smb/                # SMB/CIFS
    local/              # Local filesystem (for testing/completeness)
```

**Order of implementation:**

1. **GCS** - Similar to S3, good for validating the abstraction
2. **SFTP** - Connection-oriented, tests lifecycle methods
3. **FTP** - Similar to SFTP
4. **SMB** - Uses `@marsaud/smb2` or OS mount
5. **NFS** - OS mount + fs module
6. **Local** - Local filesystem provider (useful for testing)

Each provider should be independently testable without affecting existing functionality.

#### Phase 4A: GCS Provider

**P4A-1: Add @google-cloud/storage dependency**

- Add `@google-cloud/storage` to package.json
- Add `@types/google-cloud__storage` if needed
- Verify installation and basic import
- Estimated: 0.5 hours

**P4A-2: Create GCSProvider class skeleton**

- Create `src/providers/gcs/gcs-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `GCSProfile`
- Declare GCS capabilities (similar to S3: List, Read, Write, Delete, Mkdir, Copy, Move, ServerSideCopy, Versioning, Metadata, PresignedUrls, BatchDelete, Containers)
- Estimated: 1 hour

**P4A-3: Implement GCS authentication**

- Create `src/providers/gcs/auth.ts`
- Implement authentication from profile:
  - keyFilePath → service account JSON
  - useApplicationDefault → ADC
  - projectId handling
- Add unit tests with mocked credentials
- Estimated: 2 hours

**P4A-4: Implement GCSProvider core operations**

- Implement `list()` using `bucket.getFiles()`
- Implement `read()` using `file.download()`
- Implement `write()` using `file.save()`
- Implement `delete()` using `file.delete()`
- Implement `mkdir()` (empty object with trailing /)
- Implement `getMetadata()` using `file.getMetadata()`
- Implement `exists()` using `file.exists()`
- Map GCS errors to OperationResult
- Add unit tests
- Estimated: 6 hours

**P4A-5: Implement GCSProvider advanced operations**

- Implement `copy()` using `file.copy()`
- Implement `move()` as copy + delete
- Implement `listContainers()` using `storage.getBuckets()`
- Implement `getPresignedUrl()` using `file.getSignedUrl()`
- Implement `downloadToLocal()` and `uploadFromLocal()`
- Add unit tests
- Estimated: 4 hours

**P4A-6: GCS integration tests**

- Create integration test suite (requires GCS emulator or real bucket)
- Test full workflow
- Document test setup
- Estimated: 3 hours

**P4A-7: Update factory and exports**

- Update `createProvider()` for 'gcs' type
- Export GCSProvider from index
- Add documentation
- Estimated: 1 hour

**Phase 4A Total: 17.5 hours**

---

#### Phase 4B: SFTP Provider

**P4B-1: Add ssh2-sftp-client dependency**

- Add `ssh2-sftp-client` to package.json
- Add `@types/ssh2-sftp-client`
- Verify installation
- Estimated: 0.5 hours

**P4B-2: Create SFTPProvider class skeleton**

- Create `src/providers/sftp/sftp-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `SFTPProfile`
- Declare SFTP capabilities (List, Read, Write, Delete, Mkdir, Rmdir, Move, Resume, Permissions, Symlinks)
- Add connection state tracking
- Estimated: 1 hour

**P4B-3: Implement SFTP connection lifecycle**

- Implement `connect()`:
  - Handle password auth
  - Handle key-based auth (privateKeyPath, passphrase)
  - Handle ssh-agent auth
  - Return OperationResult with connection errors
- Implement `disconnect()`
- Implement `isConnected()`
- Add connection timeout handling
- Add unit tests with mocked ssh2
- Estimated: 4 hours

**P4B-4: Implement SFTPProvider core operations**

- Implement `list()` using `sftp.list()`
- Implement `read()` using `sftp.get()` with Buffer
- Implement `write()` using `sftp.put()`
- Implement `delete()` using `sftp.delete()`
- Implement `mkdir()` using `sftp.mkdir()`
- Implement `getMetadata()` using `sftp.stat()`
- Implement `exists()` using `sftp.exists()`
- Map SFTP errors to OperationResult
- Add unit tests
- Estimated: 5 hours

**P4B-5: Implement SFTPProvider file operations**

- Implement `nativeMove()` using `sftp.rename()`
- Implement `downloadToLocal()` using `sftp.fastGet()`
- Implement `uploadFromLocal()` using `sftp.fastPut()`
- Wire up progress callbacks
- Add unit tests
- Estimated: 3 hours

**P4B-6: Implement SFTPProvider advanced operations**

- Implement `setPermissions()` using `sftp.chmod()`
- Implement `readSymlink()` using `sftp.readlink()`
- Handle recursive directory operations
- Add unit tests
- Estimated: 2 hours

**P4B-7: SFTP integration tests**

- Create integration test suite (requires SFTP server or Docker container)
- Test connection with different auth methods
- Test full workflow
- Document test setup
- Estimated: 3 hours

**P4B-8: Update factory and exports**

- Update `createProvider()` for 'sftp' type
- Export SFTPProvider from index
- Add documentation
- Estimated: 1 hour

**Phase 4B Total: 19.5 hours**

---

#### Phase 4C: FTP Provider

**P4C-1: Add basic-ftp dependency**

- Add `basic-ftp` to package.json (modern, Promise-based FTP client)
- Verify installation
- Estimated: 0.5 hours

**P4C-2: Create FTPProvider class skeleton**

- Create `src/providers/ftp/ftp-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `FTPProfile`
- Declare FTP capabilities (List, Read, Write, Delete, Mkdir, Rmdir, Move)
- Add connection state tracking
- Estimated: 1 hour

**P4C-3: Implement FTP connection lifecycle**

- Implement `connect()`:
  - Handle anonymous access
  - Handle username/password auth
  - Handle FTPS (secure: true or 'implicit')
  - Set passive mode
- Implement `disconnect()`
- Implement `isConnected()`
- Add unit tests
- Estimated: 3 hours

**P4C-4: Implement FTPProvider core operations**

- Implement `list()` using `client.list()`
- Implement `read()` using `client.downloadTo()` with Buffer stream
- Implement `write()` using `client.uploadFrom()` with Buffer stream
- Implement `delete()` using `client.remove()`
- Implement `mkdir()` using `client.ensureDir()`
- Implement `getMetadata()` using `client.list()` for single file
- Implement `exists()` - try list, catch errors
- Map FTP errors to OperationResult
- Add unit tests
- Estimated: 5 hours

**P4C-5: Implement FTPProvider file operations**

- Implement `nativeMove()` using `client.rename()`
- Implement `downloadToLocal()` using `client.downloadTo()`
- Implement `uploadFromLocal()` using `client.uploadFrom()`
- Wire up progress callbacks via client.trackProgress()
- Add unit tests
- Estimated: 3 hours

**P4C-6: FTP integration tests**

- Create integration test suite (requires FTP server or Docker)
- Test anonymous and authenticated access
- Test FTPS
- Document test setup
- Estimated: 2 hours

**P4C-7: Update factory and exports**

- Update `createProvider()` for 'ftp' type
- Export FTPProvider from index
- Add documentation
- Estimated: 1 hour

**Phase 4C Total: 15.5 hours**

---

#### Phase 4D: SMB Provider

**P4D-1: Add @marsaud/smb2 dependency**

- Add `@marsaud/smb2` to package.json
- Note: Consider `@awo00/smb2` for TypeScript support
- Document library limitations (no encryption, no Kerberos)
- Estimated: 0.5 hours

**P4D-2: Create SMBProvider class skeleton**

- Create `src/providers/smb/smb-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `SMBProfile`
- Declare SMB capabilities (List, Read, Write, Delete, Mkdir, Rmdir, Move, Copy)
- Add connection state tracking
- Estimated: 1 hour

**P4D-3: Implement SMB connection lifecycle**

- Implement `connect()`:
  - Build UNC path from host + share
  - Handle domain/workgroup
  - Handle username/password (NTLM auth)
  - Set autoCloseTimeout
- Implement `disconnect()`
- Implement `isConnected()`
- Add unit tests
- Estimated: 3 hours

**P4D-4: Implement SMBProvider core operations**

- Implement `list()` using `smb.readdir()` with stats option
- Implement `read()` using `smb.readFile()`
- Implement `write()` using `smb.writeFile()`
- Implement `delete()` using `smb.unlink()` / `smb.rmdir()`
- Implement `mkdir()` using `smb.mkdir()`
- Implement `getMetadata()` using `smb.stat()`
- Implement `exists()` using `smb.exists()`
- Handle path separator conversion (/ → \)
- Map SMB errors to OperationResult
- Add unit tests
- Estimated: 5 hours

**P4D-5: Implement SMBProvider file operations**

- Implement `nativeMove()` using `smb.rename()`
- Implement `copy()` as read + write (no native SMB copy in library)
- Implement `downloadToLocal()` using streams
- Implement `uploadFromLocal()` using streams
- Add unit tests
- Estimated: 3 hours

**P4D-6: Implement SMB container operations**

- Implement `listContainers()` - list available shares (if possible)
- Implement `setContainer()` / `getContainer()` - switch shares
- Note: May require reconnection when switching shares
- Add unit tests
- Estimated: 2 hours

**P4D-7: SMB integration tests**

- Create integration test suite (requires Samba server or Windows share)
- Test against Samba (Linux) and Windows Server if possible
- Document test setup
- Estimated: 3 hours

**P4D-8: Update factory and exports**

- Update `createProvider()` for 'smb' type
- Export SMBProvider from index
- Document limitations (no encryption, NTLM only)
- Estimated: 1 hour

**Phase 4D Total: 18.5 hours**

---

#### Phase 4E: NFS Provider

**P4E-1: Design decision - OS mount approach**

- Document that NFS provider uses OS-level mounts
- User must mount NFS share before using provider
- Provider uses standard fs module on mounted path
- Create design doc for mount detection
- Estimated: 1 hour

**P4E-2: Create NFSProvider class skeleton**

- Create `src/providers/nfs/nfs-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `NFSProfile`
- Constructor takes `mountPoint` as required config
- Declare NFS capabilities (List, Read, Write, Delete, Mkdir, Rmdir, Move, Copy, Permissions, Symlinks, Hardlinks)
- Estimated: 1 hour

**P4E-3: Implement mount point validation**

- Create `src/providers/nfs/mount-utils.ts`
- Implement `isMountPoint(path: string): Promise<boolean>`
- Implement `getMountInfo(path: string): MountInfo | null`
- Detect if path is actually an NFS mount (parse /proc/mounts on Linux, mount output on macOS)
- Add warning if path doesn't appear to be NFS mount
- Add unit tests
- Estimated: 3 hours

**P4E-4: Implement NFSProvider core operations**

- Implement `list()` using `fs.readdir()` with `withFileTypes`
- Implement `read()` using `fs.readFile()`
- Implement `write()` using `fs.writeFile()`
- Implement `delete()` using `fs.unlink()` / `fs.rmdir()`
- Implement `mkdir()` using `fs.mkdir()`
- Implement `getMetadata()` using `fs.stat()`
- Implement `exists()` using `fs.access()`
- Map fs errors to OperationResult
- Add unit tests
- Estimated: 4 hours

**P4E-5: Implement NFSProvider advanced operations**

- Implement `nativeMove()` using `fs.rename()`
- Implement `nativeCopy()` using `fs.copyFile()`
- Implement `setPermissions()` using `fs.chmod()`
- Implement `readSymlink()` using `fs.readlink()`
- Implement hardlink creation using `fs.link()`
- Implement `downloadToLocal()` / `uploadFromLocal()` using streams
- Add unit tests
- Estimated: 3 hours

**P4E-6: NFS integration tests**

- Create integration test suite
- Test with actual NFS mount if available
- Test with local filesystem as fallback (note in docs)
- Document test setup (how to create NFS mount for testing)
- Estimated: 2 hours

**P4E-7: Update factory and exports**

- Update `createProvider()` for 'nfs' type
- Export NFSProvider from index
- Document OS mount requirement
- Add example mount commands for Linux/macOS
- Estimated: 1 hour

**Phase 4E Total: 15 hours**

---

#### Phase 4F: Local Filesystem Provider

**P4F-1: Create LocalProvider class**

- Create `src/providers/local/local-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `LocalProfile` (basePath only)
- Declare capabilities (all filesystem operations)
- Useful for testing and as reference implementation
- Estimated: 1 hour

**P4F-2: Implement LocalProvider operations**

- Reuse implementations from NFSProvider (both use fs module)
- Consider extracting shared `FilesystemProvider` base class
- Full implementation of all fs operations
- Add unit tests
- Estimated: 3 hours

**P4F-3: Update factory and exports**

- Add 'local' to ProviderType
- Update `createProvider()` for 'local' type
- Export LocalProvider
- Estimated: 1 hour

**Phase 4F Total: 5 hours**

---

#### Phase 4G: Google Drive Provider

> **Note:** Google Drive has a fundamentally different data model (ID-based, not path-based). See Appendix D for detailed research. Recommended to implement after core filesystem providers are stable.

**P4G-1: Add googleapis dependency and OAuth utilities**

- Add `googleapis` and `@google-cloud/local-auth` to package.json
- Create OAuth utility functions for token management
- Verify installation and basic import
- Estimated: 2 hours

**P4G-2: Implement OAuth flow with local callback server**

- Create `src/providers/gdrive/auth.ts`
- Implement browser-based OAuth consent flow
- Create local HTTP server for OAuth callback
- Handle token storage and refresh
- Support service account authentication as alternative
- Add unit tests with mocked OAuth
- Estimated: 4 hours

**P4G-3: Create path-to-ID resolution layer with caching**

- Create `src/providers/gdrive/path-resolver.ts`
- Implement `resolvePath(path: string): Promise<string>` (returns file ID)
- Implement path segment walking with Drive API queries
- Add LRU cache with configurable TTL
- Handle cache invalidation on mutations (write, delete, move)
- Handle edge cases: duplicate names, trashed files
- Add unit tests
- Estimated: 6 hours

**P4G-4: Create GoogleDriveProvider class and core operations**

- Create `src/providers/gdrive/gdrive-provider.ts`
- Extend `BaseStorageProvider`
- Define constructor accepting `GoogleDriveProfile`
- Declare capabilities (List, Read, Write, Delete, Mkdir, Rmdir, Copy, Move, ServerSideCopy, Resume, Versioning, Metadata, Containers, Download, Upload)
- Implement `list()` using `files.list()` with path resolution
- Implement `read()` using `files.get()` with `alt=media`
- Implement `write()` using `files.create()` / `files.update()`
- Implement `delete()` using `files.delete()`
- Implement `mkdir()` with folder MIME type
- Implement `getMetadata()` and `exists()`
- Map Drive API errors to OperationResult
- Add unit tests
- Estimated: 8 hours

**P4G-5: Implement Shared Drive support**

- Implement `listContainers()` returning My Drive + Shared Drives
- Implement `setContainer()` / `getContainer()` for drive switching
- Handle `supportsAllDrives` and `includeItemsFromAllDrives` params
- Update path resolution for shared drive context
- Add unit tests
- Estimated: 4 hours

**P4G-6: Handle Google Workspace document export**

- Detect Google Docs/Sheets/Slides by MIME type
- Implement export to configured format (PDF, DOCX, etc.)
- Handle in `read()` method transparently
- Add `exportFormat` config option
- Document limitation: exported files are read-only snapshots
- Estimated: 3 hours

**P4G-7: Rate limiting and error handling**

- Implement exponential backoff for rate limit errors (403, 429)
- Map Google Drive error codes to OperationResult statuses
- Handle quota exceeded, auth failures, not found
- Add retry logic with configurable max attempts
- Estimated: 3 hours

**P4G-8: Integration tests**

- Create integration test suite (requires Google Cloud project)
- Test OAuth flow (manual verification)
- Test full workflow: list → read → write → copy → delete
- Test Shared Drive operations
- Test Google Workspace doc export
- Document test setup (create test project, enable API)
- Estimated: 4 hours

**Phase 4G Total: 34 hours**

---

**Phase 4 Grand Total: ~125 hours**

### Phase 5: UI Abstraction Layer

Create a UI adapter that can work with either system:

```typescript
// src/ui/storage-context.tsx

// Option A: Legacy mode (existing S3Adapter)
// Option B: Provider mode (new StorageProvider)

interface StorageContextValue {
  // Unified interface for UI components
  list(path: string): Promise<Entry[]>;
  read(path: string): Promise<Buffer>;
  // ...
}
```

**Deliverables:**

- `StorageContext` that abstracts over both systems
- Feature flags or config to switch between legacy/new
- UI components updated to use `StorageContext` instead of direct adapter access

#### Tickets

**P5-1: Audit current UI adapter usage**

- Search codebase for all `S3Adapter` imports and usages
- Document all UI components that directly use adapter
- List all adapter methods called from UI
- Identify any adapter-specific assumptions in UI code
- Create migration checklist
- Estimated: 2 hours

**P5-2: Design StorageContext interface**

- Create `src/contexts/StorageContext.tsx`
- Define `StorageContextValue` interface matching UI needs:

  ```typescript
  interface StorageContextValue {
    // State
    provider: StorageProvider | null;
    currentPath: string;
    entries: Entry[];
    isLoading: boolean;
    error: string | null;

    // Actions
    navigate(path: string): Promise<void>;
    refresh(): Promise<void>;
    read(path: string): Promise<Buffer>;
    write(path: string, content: Buffer): Promise<void>;
    delete(paths: string[]): Promise<void>;
    copy(src: string, dest: string): Promise<void>;
    move(src: string, dest: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    download(remotePath: string, localPath: string): Promise<void>;
    upload(localPath: string, remotePath: string): Promise<void>;

    // Capabilities
    hasCapability(cap: Capability): boolean;

    // Profile/Provider management
    switchProvider(profile: Profile): Promise<void>;
    disconnect(): Promise<void>;
  }
  ```

- Document interface
- Estimated: 2 hours

**P5-3: Implement feature flag system**

- Create `src/utils/feature-flags.ts`
- Define `USE_NEW_PROVIDER_SYSTEM` flag
- Read from environment variable: `OPEN_S3_USE_PROVIDERS=true`
- Read from config file as fallback
- Add helper `isNewProviderSystemEnabled(): boolean`
- Add unit tests
- Estimated: 1 hour

**P5-4: Implement LegacyStorageAdapter**

- Create `src/contexts/LegacyStorageAdapter.ts`
- Implement `StorageContextValue` interface
- Wrap existing `S3Adapter` and `AdapterContext`
- Maintain backward compatibility with all existing behavior
- This allows UI to work with either system via same interface
- Add unit tests
- Estimated: 4 hours

**P5-5: Implement ProviderStorageAdapter**

- Create `src/contexts/ProviderStorageAdapter.ts`
- Implement `StorageContextValue` interface
- Wrap `StorageProvider` from new provider system
- Map `OperationResult` to UI-friendly errors
- Handle capability checking for UI features
- Add unit tests
- Estimated: 4 hours

**P5-6: Create unified StorageProvider React context**

- Implement `StorageContextProvider` component
- Based on feature flag, use Legacy or Provider adapter
- Provide context value to children
- Handle provider lifecycle (connect/disconnect)
- Handle errors and loading states
- Add unit tests
- Estimated: 3 hours

**P5-7: Create useStorage hook**

- Create `src/hooks/useStorage.ts`
- Provide typed access to StorageContext
- Add convenience hooks:
  - `useStorageList()` - current entries
  - `useStorageNavigation()` - navigate, currentPath
  - `useStorageOperations()` - read, write, delete, etc.
  - `useStorageCapabilities()` - hasCapability checks
- Add unit tests
- Estimated: 2 hours

**P5-8: Update BufferView component**

- Replace direct adapter usage with useStorage hook
- Update to handle capability-based feature hiding
- Ensure all operations go through StorageContext
- Test with both legacy and new systems
- Estimated: 3 hours

**P5-9: Update PreviewPane component**

- Replace direct adapter usage with useStorage hook
- Use `read()` from context for file preview
- Handle errors via context error state
- Test with both systems
- Estimated: 2 hours

**P5-10: Update HeaderBar component**

- Replace direct adapter usage with useStorage hook
- Update bucket/container selector to use context
- Handle providers without containers (hide selector)
- Test with both systems
- Estimated: 2 hours

**P5-11: Update operation dialogs**

- Update UploadDialog to use StorageContext
- Update ConfirmationDialog for delete operations
- Update any copy/move dialogs
- Ensure progress callbacks work with new system
- Test with both systems
- Estimated: 3 hours

**P5-12: Update keyboard handlers**

- Ensure keyboard operations use StorageContext
- Update yy (copy), dd (delete), p (paste) handlers
- Verify all keybindings work with new system
- Test with both systems
- Estimated: 2 hours

**P5-13: Capability-based UI adaptation**

- Create `src/components/CapabilityGate.tsx`:
  ```tsx
  <CapabilityGate requires={Capability.Copy}>
    <CopyButton />
  </CapabilityGate>
  ```
- Update UI to hide/disable features based on capabilities
- Hide copy button if no Copy capability
- Hide permissions column if no Permissions capability
- Hide versioning UI if no Versioning capability
- Add visual indicators for unsupported operations
- Estimated: 3 hours

**P5-14: Error handling standardization**

- Create `src/utils/storage-errors.ts`
- Map `OperationResult` errors to user-friendly messages
- Handle `Unimplemented` errors gracefully (show "not supported" toast)
- Handle connection errors with retry option
- Standardize error display across UI
- Estimated: 2 hours

**P5-15: Integration testing with feature flag**

- Test full UI with `USE_NEW_PROVIDER_SYSTEM=false` (legacy)
- Test full UI with `USE_NEW_PROVIDER_SYSTEM=true` (new)
- Verify feature parity
- Document any differences
- Create test matrix
- Estimated: 4 hours

**P5-16: Profile selector UI**

- Create `src/components/ProfileSelector.tsx`
- List available profiles from ProfileManager
- Allow switching between profiles
- Show provider type icon/indicator
- Handle connection state during switch
- Only shown when new provider system enabled
- Estimated: 4 hours

**P5-17: Connection status indicator**

- Create `src/components/ConnectionStatus.tsx`
- Show connected/disconnected state for connection-oriented providers
- Show reconnect button on disconnect
- Integrate into status bar
- Estimated: 2 hours

**Phase 5 Total Estimate: 45 hours**

### Phase 6: Cutover

Once the new system is validated:

1. **Feature flag cutover** - Switch default from legacy to new provider system
2. **Deprecation period** - Keep legacy code but mark as deprecated
3. **Removal** - Remove legacy adapter code after validation

```typescript
// Before cutover
const adapter = new S3Adapter(config);

// After cutover
const provider = createProvider(profile);
```

#### Tickets

**P6-1: Pre-cutover validation checklist**

- Create comprehensive test checklist covering all features
- Test S3 operations: list, read, write, delete, copy, move, mkdir
- Test bucket switching
- Test upload/download with progress
- Test preview pane
- Test keyboard shortcuts
- Test error scenarios
- Test with real AWS S3 (not just LocalStack)
- Document any behavioral differences between systems
- Get sign-off from stakeholders
- Estimated: 4 hours

**P6-2: Performance benchmarking**

- Create benchmark script comparing legacy vs new system
- Measure: list latency, read throughput, write throughput
- Measure: memory usage, connection overhead
- Document results
- Ensure no significant regression (target: <5% slower)
- If regression found, create tickets to address before cutover
- Estimated: 3 hours

**P6-3: Migration documentation**

- Write user-facing migration guide
- Document new profile configuration
- Document any breaking changes
- Create FAQ for common issues
- Update README with new provider information
- Estimated: 3 hours

**P6-4: Flip feature flag default**

- Change `USE_NEW_PROVIDER_SYSTEM` default from `false` to `true`
- Update environment variable documentation
- Add `OPEN_S3_USE_LEGACY=true` escape hatch for rollback
- Commit with clear message about cutover
- Estimated: 1 hour

**P6-5: Monitor and support cutover**

- Deploy to staging/beta users first if possible
- Monitor for errors and issues
- Be prepared to rollback via environment variable
- Collect feedback for 1-2 weeks
- Address critical issues immediately
- Estimated: 8 hours (spread over 1-2 weeks)

**P6-6: Mark legacy code as deprecated**

- Add `@deprecated` JSDoc comments to S3Adapter
- Add `@deprecated` comments to old AdapterContext
- Add console warnings when legacy system is used
- Update imports to show deprecation in IDE
- Estimated: 2 hours

**P6-7: Create legacy removal timeline**

- Announce deprecation timeline (suggest: 2-3 releases)
- Document removal date
- Create tracking ticket for Phase 7
- Estimated: 1 hour

**Phase 6 Total Estimate: 22 hours**

### Phase 7: Cleanup

- Remove legacy `S3Adapter` and related code
- Remove feature flags
- Update documentation
- Archive migration code

#### Tickets

**P7-1: Final validation before removal**

- Confirm no users reporting issues with new system
- Confirm feature flag override is not being used in production
- Check analytics/logs for legacy system usage
- Get sign-off for removal
- Estimated: 2 hours

**P7-2: Remove legacy adapter code**

- Delete `src/adapters/s3-adapter.ts`
- Delete `src/adapters/adapter.ts` (old interfaces)
- Delete related test files
- Delete `src/adapters/s3/` subdirectory if exists
- Keep mock-adapter.ts if still useful for testing
- Estimated: 2 hours

**P7-3: Remove legacy context code**

- Delete `src/contexts/AdapterContext.tsx`
- Delete `LegacyStorageAdapter.ts`
- Remove legacy-related imports from all files
- Estimated: 2 hours

**P7-4: Remove feature flag system**

- Delete `src/utils/feature-flags.ts`
- Remove all feature flag checks from codebase
- Remove environment variable handling
- Simplify StorageContext to only use new system
- Estimated: 2 hours

**P7-5: Clean up dependencies**

- Review package.json for unused dependencies
- Remove any packages only used by legacy system
- Run `npm prune` or equivalent
- Update lock file
- Estimated: 1 hour

**P7-6: Consolidate and reorganize**

- Move `src/providers/` to `src/adapters/` if preferred
- Or keep as `src/providers/` - decide on final naming
- Update all imports
- Ensure consistent directory structure
- Estimated: 2 hours

**P7-7: Update all documentation**

- Update README.md
- Update any architecture docs
- Remove references to legacy system
- Update code comments
- Update JSDoc
- Estimated: 2 hours

**P7-8: Final testing**

- Run full test suite
- Manual testing of all features
- Verify no dead code or broken imports
- Estimated: 2 hours

**P7-9: Archive migration artifacts**

- Create `docs/archive/` directory
- Move migration-related docs to archive
- Keep for historical reference
- Tag git commit as "post-migration"
- Estimated: 1 hour

**Phase 7 Total Estimate: 16 hours**

---

### Migration Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Current State                           │
├─────────────────────────────────────────────────────────────────┤
│  UI Components ──────► S3Adapter ──────► AWS SDK                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Phase 1-4: Build parallel system
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Parallel Systems                           │
├─────────────────────────────────────────────────────────────────┤
│  UI Components ──┬──► S3Adapter ──────► AWS SDK                 │
│                  │    (legacy)                                  │
│                  │                                              │
│                  └──► StorageContext ──► S3Provider ──► S3Adapter
│                       (new, behind      (wraps legacy)          │
│                        feature flag)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Phase 5-6: Cutover
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Final State                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UI Components ──► StorageContext ──► Provider ──► Backend      │
│                                         │                       │
│                         ┌───────────────┼───────────────┐       │
│                         ▼               ▼               ▼       │
│                    S3Provider      SFTPProvider    SMBProvider  │
│                         │               │               │       │
│                         ▼               ▼               ▼       │
│                      AWS SDK        ssh2 lib      @marsaud/smb2 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Effort Summary

| Phase     | Description                   | Tickets | Estimated Hours |
| --------- | ----------------------------- | ------- | --------------- |
| 1         | Foundation Types & Interfaces | 8       | 14.5            |
| 2         | S3 Provider                   | 16      | 34              |
| 3         | Profile Manager               | 8       | 19-25           |
| 4A        | GCS Provider                  | 7       | 17.5            |
| 4B        | SFTP Provider                 | 8       | 19.5            |
| 4C        | FTP Provider                  | 7       | 15.5            |
| 4D        | SMB Provider                  | 8       | 18.5            |
| 4E        | NFS Provider                  | 7       | 15              |
| 4F        | Local Provider                | 3       | 5               |
| 4G        | Google Drive Provider         | 8       | 34              |
| 5         | UI Abstraction Layer          | 17      | 45              |
| 6         | Cutover                       | 7       | 22              |
| 7         | Cleanup                       | 9       | 16              |
| **Total** |                               | **113** | **~276 hours**  |

**Notes:**

- Phase 4 providers can be implemented in parallel by different developers
- Phase 4 providers can be shipped incrementally (S3 first, others as ready)
- CLI commands in P3-8 are optional and can be deferred
- Estimates assume familiarity with codebase; add 20% for ramp-up

### Risk Mitigation

| Risk                                | Mitigation                                                 |
| ----------------------------------- | ---------------------------------------------------------- |
| Breaking existing S3 functionality  | S3Provider wraps existing adapter; no changes to adapter   |
| UI regressions                      | Feature flag allows instant rollback                       |
| Performance regression              | Benchmark before/after; thin wrapper adds minimal overhead |
| Incomplete provider implementations | Each provider is independent; partial rollout possible     |

---

## Example Usage

```typescript
// Load user's saved profiles
const profileManager = new FileProfileManager('~/.config/open-s3/profiles.json');
const profiles = profileManager.listProfiles();

// User selects a profile from the UI
const selectedProfile = profiles[0];

// Create provider from profile
const provider = profileManager.createProviderFromProfile(selectedProfile.id);

// Connect if needed (SFTP/FTP)
if (provider.connect) {
  const connectResult = await provider.connect();
  if (!isSuccess(connectResult)) {
    showError(`Connection failed: ${connectResult.error?.message}`);
    return;
  }
}

// Use the provider
const listResult = await provider.list('/');
if (isSuccess(listResult)) {
  displayEntries(listResult.data.entries);
}

// Check capabilities before showing UI elements
if (provider.hasCapability(Capability.Copy)) {
  showCopyButton();
}
if (provider.hasCapability(Capability.Permissions)) {
  showPermissionsColumn();
}

// Cleanup
if (provider.disconnect) {
  await provider.disconnect();
}
```

---

## Open Questions

1. **Credential Storage**: Should sensitive credentials (passwords, keys) be stored in profiles, or should we integrate with system keychains?

2. **Connection Pooling**: For SFTP/FTP, should we pool connections or create new ones per operation?

3. ~~**Cross-Provider Operations**: Should we support copy/move between different providers (e.g., S3 to SFTP)?~~ **Resolved**: Not supported. See "Key Design Decisions §7: No Cross-Provider Operations".

4. **Progress Aggregation**: How should progress be reported for recursive operations across providers with different progress reporting capabilities?

5. ~~**Offline/Cached Mode**: Should we cache directory listings for offline browsing?~~ **Resolved**: Not supported. This is a real-time file browser; offline mode is out of scope.

6. **NFS/SMB Mount Strategy**: Should we require OS-level mounts (using fs module) or implement native protocol clients?

---

## Appendix A: NFS Protocol Research

### Protocol Versions

| Version     | Key Characteristics                                                    | Recommendation      |
| ----------- | ---------------------------------------------------------------------- | ------------------- |
| **NFSv3**   | Stateless, UDP/TCP, separate NLM for locking, multiple ports           | Legacy support only |
| **NFSv4.0** | Stateful, TCP only, integrated locking, ACLs, single port (2049)       | ✅ Minimum target   |
| **NFSv4.1** | Sessions, pNFS (parallel NFS), trunking, directory delegations         | ✅ Recommended      |
| **NFSv4.2** | Server-side copy, sparse files, extended attributes, space reservation | ✅ Preferred        |

### NFS Operations

**Core Operations (all versions):**

- `LOOKUP` - Resolve filename to file handle
- `READ` / `WRITE` - Data transfer
- `CREATE` / `REMOVE` - File creation/deletion
- `MKDIR` / `RMDIR` - Directory operations
- `RENAME` - Atomic rename/move
- `READDIR` / `READDIRPLUS` - Directory listing (plus includes attributes)
- `GETATTR` / `SETATTR` - Metadata operations
- `LINK` / `SYMLINK` / `READLINK` - Link operations

**NFSv4+ Compound Operations:**

```
COMPOUND {
  PUTROOTFH          // Set root file handle
  LOOKUP "dir1"      // Navigate
  LOOKUP "file.txt"  // Navigate
  READ 0, 4096       // Read first 4KB
}
```

**NFSv4.2 Advanced Operations:**

- `COPY` / `OFFLOAD_COPY` - Server-side copy (sync/async)
- `SEEK` - Find data/holes in sparse files
- `READ_PLUS` - Read with hole information
- `GETXATTR` / `SETXATTR` / `LISTXATTR` - Extended attributes

### Authentication Methods

| Method      | Description                     | Security Level   |
| ----------- | ------------------------------- | ---------------- |
| `AUTH_SYS`  | UID/GID based, client-asserted  | ⚠️ Low (default) |
| `AUTH_NONE` | Anonymous access                | ❌ Insecure      |
| `krb5`      | Kerberos authentication         | ✅ Good          |
| `krb5i`     | Kerberos + integrity checking   | ✅ Better        |
| `krb5p`     | Kerberos + privacy (encryption) | ✅ Best          |

**Security Consideration**: AUTH_SYS trusts the client's UID/GID assertion. Any user with raw socket access can impersonate any user. Use Kerberos (krb5p) for production environments.

### Connection Model

**NFSv3 (Stateless):**

```
Client ──RPC──► Portmapper (111)  ← Get NFS port
Client ──RPC──► Mountd            ← Get file handle
Client ──RPC──► NFS (2049)        ← File operations
Client ──RPC──► NLM               ← Locking (separate)
Client ──RPC──► NSM               ← Lock recovery
```

**NFSv4+ (Stateful):**

```
Client ──TCP──► NFS (2049)        ← Single port
       │
       ├── SETCLIENTID / EXCHANGE_ID
       ├── CREATE_SESSION (v4.1+)
       ├── File operations with state IDs
       └── SEQUENCE (session slots, v4.1+)
```

### Node.js Library Assessment

| Package               | Status              | Notes                           |
| --------------------- | ------------------- | ------------------------------- |
| `node-nfs` (Joyent)   | Server SDK only     | NFSv3 server implementation     |
| `node-nfsc` (Scality) | **Archived** (2022) | Native C++ bindings, NFSv3 only |
| `tspace-nfs`          | Active              | Pure JS, limited features       |

**Recommendation**: No production-ready Node.js NFS client exists. Options:

1. **OS Mount + fs module** (recommended) - Mount NFS share at OS level
2. **Native bindings** - Develop custom bindings using libnfs
3. **Child process** - Shell out to NFS tools

### Locking Mechanisms

**NFSv3 (NLM):**

- Separate Network Lock Manager protocol
- Advisory locks only (not enforced)
- Requires NSM for crash recovery

**NFSv4+ (Integrated):**

- Lease-based locking (default 90s lease)
- Lock types: `READ_LT`, `WRITE_LT`, `READW_LT`, `WRITEW_LT`
- Delegations (similar to SMB oplocks):
  - `OPEN_DELEGATE_READ` - Cache reads locally
  - `OPEN_DELEGATE_WRITE` - Exclusive access, cache writes

### Special Features

**NFSv4 ACLs:**

- Richer than POSIX mode bits
- Access types: ALLOW, DENY, AUDIT, ALARM
- Special identifiers: `OWNER@`, `GROUP@`, `EVERYONE@`
- Inheritance flags for directories

**pNFS (NFSv4.1+):**

- Separates metadata (MDS) from data (DS) servers
- Layout types: Files, Blocks, Objects, Flex Files
- 3-10x throughput improvement via parallel access

### Performance Considerations

```
Mount Options:
  rsize=1048576      # 1MB read buffer
  wsize=1048576      # 1MB write buffer
  nconnect=8         # Multiple TCP connections (v4.1+)
  async              # Async writes (faster, less safe)
  actimeo=60         # Attribute cache timeout

Write Modes:
  FILE_SYNC   - Data + metadata committed (slowest)
  DATA_SYNC   - Data committed, metadata async
  UNSTABLE    - May be cached, requires COMMIT (fastest)
```

---

## Appendix B: SMB Protocol Research

### Protocol Versions

| Version       | Released      | Key Features                         | Recommendation                               |
| ------------- | ------------- | ------------------------------------ | -------------------------------------------- |
| **SMB1/CIFS** | 1983-2006     | Original, NetBIOS-based              | ❌ **Deprecated** - Security vulnerabilities |
| **SMB 2.0**   | 2006 (Vista)  | Reduced chattiness, pipelining       | ⚠️ Legacy only                               |
| **SMB 2.1**   | 2008 (Win 7)  | Oplock improvements, large MTU       | ✅ Minimum target                            |
| **SMB 3.0**   | 2012 (Win 8)  | Encryption, multichannel, SMB Direct | ✅ Recommended                               |
| **SMB 3.0.2** | 2013          | Performance improvements             | ✅ Recommended                               |
| **SMB 3.1.1** | 2015 (Win 10) | Pre-auth integrity, AES-GCM          | ✅ **Preferred**                             |

**Important**: SMB1 is disabled by default in Windows 10+ and should never be used.

### SMB Operations

**Core Operations:**
| Command | Description |
|---------|-------------|
| `SMB2_CREATE` | Open or create files/directories |
| `SMB2_CLOSE` | Close file handles |
| `SMB2_READ` | Read file data |
| `SMB2_WRITE` | Write file data |
| `SMB2_QUERY_DIRECTORY` | List directory contents |
| `SMB2_QUERY_INFO` | Get file/directory metadata |
| `SMB2_SET_INFO` | Set metadata, delete, rename |
| `SMB2_LOCK` | Byte-range locking |
| `SMB2_CHANGE_NOTIFY` | Watch for filesystem changes |

**SMB 3.0+ IOCTL Operations:**
| IOCTL | Purpose |
|-------|---------|
| `FSCTL_SRV_COPYCHUNK` | Server-side copy |
| `FSCTL_VALIDATE_NEGOTIATE_INFO` | Secure negotiation |
| `FSCTL_QUERY_NETWORK_INTERFACE_INFO` | Multichannel support |

### Authentication Methods

| Method       | Use Case                     | Security                          |
| ------------ | ---------------------------- | --------------------------------- |
| **NTLM v2**  | Workgroup environments       | Acceptable with signing           |
| **Kerberos** | Active Directory (preferred) | ✅ Best (SSO, mutual auth)        |
| **Guest**    | Anonymous access             | ❌ Disabled by default in Win 10+ |

### Connection Model

```
Connection Hierarchy:
  TCP Socket (Port 445)
    └── Session (authenticated user)
          └── Tree Connect (share)
                └── Open (file handle)

Lifecycle:
  1. TCP Connection
  2. SMB2_NEGOTIATE (version/capabilities)
  3. SMB2_SESSION_SETUP (NTLM or Kerberos)
  4. SMB2_TREE_CONNECT (\\server\share)
  5. File operations
  6. SMB2_TREE_DISCONNECT / SMB2_LOGOFF
```

### Node.js Library Assessment

| Package         | Version | Status              | Notes                  |
| --------------- | ------- | ------------------- | ---------------------- |
| `@marsaud/smb2` | 0.18.0  | ⚠️ Stale (4+ years) | Most used, fs-like API |
| `@awo00/smb2`   | 1.1.1   | ✅ Active (2025)    | TypeScript, Node 17+   |

**@marsaud/smb2 Features:**

```javascript
const SMB2 = require('@marsaud/smb2');
const client = new SMB2({
  share: '\\\\192.168.1.100\\share$',
  domain: 'WORKGROUP',
  username: 'user',
  password: 'pass',
});

// fs-like API
await client.readdir('path\\to\\dir');
await client.readFile('file.txt');
await client.writeFile('output.txt', 'Hello');
await client.rename('old.txt', 'new.txt');
await client.unlink('file.txt');
await client.mkdir('newdir');
```

**Library Limitations:**

- ❌ No Kerberos support (NTLM only)
- ❌ No SMB3 encryption
- ❌ No signing support
- ❌ No DFS support
- ❌ No symbolic link support
- ❌ No ACL management

### Locking Mechanisms

**Opportunistic Locks (Oplocks):**
| Type | Caching | Use Case |
|------|---------|----------|
| Level 2 (Shared) | Read only | Multiple readers |
| Level 1 (Exclusive) | Read/write | Single accessor |
| Batch | Full + defer close | Frequently opened files |

**SMB 2.x+ Lease-Based Locking:**

- Read (R), Write (W), Handle (H) lease flags
- Combinations: R, RW, RH, RWH
- Byte-range locks via `SMB2_LOCK`

### Special Features

**Windows ACLs:**

- Security Descriptors with ACEs (Access Control Entries)
- Richer than POSIX: includes DENY rules, inheritance flags
- Not exposed by current Node.js libraries

**Alternate Data Streams (ADS):**

- NTFS feature: multiple data streams per file
- Access via `filename:streamname` syntax
- Common use: Zone identifiers, metadata

**DFS (Distributed File System):**

- Virtual namespace across multiple servers
- Transparent redirection via referrals
- Not supported by Node.js libraries

### Cross-Platform Considerations

| Aspect            | Windows Server     | Samba (Linux)            |
| ----------------- | ------------------ | ------------------------ |
| Protocol versions | All (SMB1-3.1.1)   | SMB2/3 (SMB1 deprecated) |
| Authentication    | NTLM, Kerberos, AD | NTLM, Kerberos, LDAP     |
| DFS               | Full support       | Limited                  |
| ACLs              | Native NTFS        | Mapped to POSIX or VFS   |
| Case sensitivity  | Case-insensitive   | Configurable             |

**Path Handling:**

```typescript
// SMB uses backslashes
const smbPath = unixPath.replace(/\//g, '\\\\');

// UNC format: \\\\server\\share\\path\\to\\file
// URI format: smb://server/share/path/to/file
```

### Performance Considerations

**Signing (Required for security):**

- 5-15% overhead
- Uses AES-CMAC (hardware accelerated with AES-NI)

**Encryption (SMB 3.0+):**
| Algorithm | Windows Version | Performance |
|-----------|-----------------|-------------|
| AES-128-CCM | Win 8+ | Slower |
| AES-128-GCM | Win 10+ | Fast (with AES-NI) |
| AES-256-GCM | Win 11/Server 2022 | ~5% slower than 128 |

**Optimization Tips:**

- Use large buffers (64KB-1MB) for sequential I/O
- Batch small operations
- Cache directory listings locally
- Reuse authenticated sessions (connection pooling)

---

## Appendix C: Implementation Recommendations

### NFS Implementation Strategy

**Recommended: OS Mount + fs Module**

```typescript
// User mounts NFS at OS level:
// Linux: mount -t nfs4 server:/export /mnt/nfs
// macOS: mount -t nfs server:/export /mnt/nfs

class NFSProvider extends BaseStorageProvider {
  private basePath: string;

  constructor(profile: NFSProfile) {
    // Assume already mounted at basePath
    this.basePath = profile.config.mountPoint;
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Move,
      Capability.Copy,
      Capability.Permissions,
      Capability.Symlinks
    );
  }

  async list(path: string): Promise<OperationResult<ListResult>> {
    const fullPath = join(this.basePath, path);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    // ... convert to Entry[]
  }
}
```

**Alternative: Native Client (Future)**

```typescript
// Would require custom libnfs bindings or pure-JS RPC implementation
class NativeNFSProvider extends BaseStorageProvider {
  async connect(): Promise<OperationResult> {
    // NFS SETCLIENTID / EXCHANGE_ID
    // CREATE_SESSION (v4.1+)
  }
}
```

### SMB Implementation Strategy

**Option 1: @marsaud/smb2 (Current best option)**

```typescript
import SMB2 from '@marsaud/smb2';

class SMBProvider extends BaseStorageProvider {
  private client: SMB2;

  constructor(profile: SMBProfile) {
    this.client = new SMB2({
      share: `\\\\${profile.config.host}\\${profile.config.share}`,
      domain: profile.config.domain || 'WORKGROUP',
      username: profile.config.username,
      password: profile.config.password,
    });
    this.addCapability(
      Capability.List,
      Capability.Read,
      Capability.Write,
      Capability.Delete,
      Capability.Mkdir,
      Capability.Move
    );
  }

  async list(path: string): Promise<OperationResult<ListResult>> {
    try {
      const files = await this.client.readdir(path, { stats: true });
      return Result.success({ entries: this.convertEntries(files), hasMore: false });
    } catch (err) {
      return this.mapError(err);
    }
  }
}
```

**Option 2: OS Mount (Alternative)**

- Mount SMB share using OS tools (mount.cifs on Linux, mount_smbfs on macOS)
- Use standard fs module
- Better for production (supports encryption, Kerberos)

### Error Mapping

```typescript
// SMB status codes to OperationResult
const SMB_ERROR_MAP: Record<string, () => OperationResult> = {
  STATUS_OBJECT_NAME_NOT_FOUND: path => Result.notFound(path),
  STATUS_ACCESS_DENIED: path => Result.permissionDenied(path),
  STATUS_SHARING_VIOLATION: () => Result.error('FILE_LOCKED', 'File is locked'),
  STATUS_DISK_FULL: () => Result.error('STORAGE_FULL', 'Storage full'),
  STATUS_LOGON_FAILURE: () => Result.error('AUTH_FAILED', 'Authentication failed'),
};

// NFS error codes
const NFS_ERROR_MAP: Record<number, () => OperationResult> = {
  2: path => Result.notFound(path), // NFS4ERR_NOENT
  13: path => Result.permissionDenied(path), // NFS4ERR_PERM
  28: () => Result.error('STORAGE_FULL', 'No space left'), // NFS4ERR_NOSPC
};
```

### Connection Lifecycle

```typescript
// SMB requires explicit connection management
const provider = new SMBProvider(profile);
await provider.connect(); // SMB2_NEGOTIATE + SMB2_SESSION_SETUP + SMB2_TREE_CONNECT
try {
  // Operations...
} finally {
  await provider.disconnect(); // SMB2_TREE_DISCONNECT + SMB2_LOGOFF
}

// NFS with OS mount - no explicit connection needed
const nfsProvider = new NFSProvider(profile);
// Just use fs module, OS handles connection
```

---

## Appendix D: Google Drive Research

### Overview

Google Drive can be supported as a storage provider, but with significant architectural considerations due to its fundamentally different data model. Recommended for **Phase 5 or later** after core filesystem providers are stable.

### API Capabilities

| Operation            | Support | API Method                        | Notes                                           |
| -------------------- | ------- | --------------------------------- | ----------------------------------------------- |
| List files/folders   | ✅ Full | `files.list()`                    | Pagination via `pageToken`, max 1000 items/page |
| Read/download files  | ✅ Full | `files.get()` with `alt=media`    | Supports partial downloads via Range headers    |
| Write/upload files   | ✅ Full | `files.create()`                  | Simple (<5MB), multipart (<5MB), resumable      |
| Delete files         | ✅ Full | `files.delete()`                  | Also supports trash/untrash                     |
| Create folders       | ✅ Full | `files.create()` with folder MIME | `application/vnd.google-apps.folder`            |
| Copy files           | ✅ Full | `files.copy()`                    | Server-side copy within same Drive              |
| Move/rename files    | ✅ Full | `files.update()`                  | Via `addParents`/`removeParents` params         |
| File metadata        | ✅ Rich | `files.get()` / `files.update()`  | Custom properties, labels, thumbnails           |
| Revisions/versioning | ✅ Full | `revisions.*` methods             | Full revision history                           |

### Key Architectural Challenge: ID-based vs Path-based

**Critical difference:** Google Drive uses **file IDs**, not paths.

```
Filesystem:   /documents/reports/q1-2024.pdf
Google Drive: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs04 (opaque file ID)
              + parent: 0AHV9S5FKlmnMUk9PVA (folder ID)
```

**Solution: Path-to-ID resolution layer**

```typescript
class GoogleDriveProvider extends BaseStorageProvider {
  private pathCache = new Map<string, string>(); // path -> fileId

  async resolvePath(path: string): Promise<string> {
    if (path === '/' || path === 'root') return 'root';

    // Walk path segments, resolving each to ID
    const segments = path.split('/').filter(Boolean);
    let currentId = 'root';

    for (const segment of segments) {
      const cacheKey = `${currentId}/${segment}`;
      if (this.pathCache.has(cacheKey)) {
        currentId = this.pathCache.get(cacheKey)!;
      } else {
        // Query Drive for child with this name
        const response = await this.drive.files.list({
          q: `'${currentId}' in parents and name = '${segment}' and trashed = false`,
          fields: 'files(id)',
        });
        if (response.data.files?.length !== 1) {
          throw new Error(`Path not found: ${path}`);
        }
        currentId = response.data.files[0].id!;
        this.pathCache.set(cacheKey, currentId);
      }
    }
    return currentId;
  }
}
```

### Authentication Methods

**OAuth 2.0 (Required for user files):**

```typescript
// Recommended scopes
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Non-sensitive, per-file access
  'https://www.googleapis.com/auth/drive.readonly', // Restricted, full read access
  'https://www.googleapis.com/auth/drive', // Restricted, full access
];
```

| Method          | Use Case              | Notes                                 |
| --------------- | --------------------- | ------------------------------------- |
| OAuth 2.0       | User files (required) | Browser-based consent flow            |
| Service Account | Workspace domains     | Cannot own files; needs impersonation |
| API Key         | ❌ Not supported      | Cannot access user Drive files        |

**Security considerations:**

- Refresh tokens should be stored securely (keychain/credential manager)
- OAuth flow requires browser-based consent (complicates CLI/headless usage)
- Token refresh handled automatically by `googleapis` library

### Node.js Library

**Official library: `googleapis`**

```bash
npm install googleapis @google-cloud/local-auth
```

- ✅ Official Google-maintained
- ✅ ~2.5M weekly npm downloads
- ✅ TypeScript definitions included
- ✅ Active development
- ✅ Built-in resumable uploads, batching, media downloads

```typescript
import { google } from 'googleapis';

const drive = google.drive({ version: 'v3', auth });
const response = await drive.files.list({
  pageSize: 100,
  fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
});
```

### Capability Mapping

**Supported (15/19):**

| Capability       | Google Drive Support                         |
| ---------------- | -------------------------------------------- |
| `List`           | ✅ Via `files.list()` with query params      |
| `Read`           | ✅ Via `files.get()` with `alt=media`        |
| `Write`          | ✅ Via `files.create()` / `files.update()`   |
| `Delete`         | ✅ Via `files.delete()` (also trash/untrash) |
| `Mkdir`          | ✅ Create with folder MIME type              |
| `Rmdir`          | ✅ Same as delete                            |
| `Copy`           | ✅ Via `files.copy()` (server-side)          |
| `Move`           | ✅ Via `files.update()` with parent changes  |
| `ServerSideCopy` | ✅ `files.copy()` is server-side             |
| `Resume`         | ✅ Resumable uploads built-in                |
| `Versioning`     | ✅ Full revision history via `revisions.*`   |
| `Metadata`       | ✅ Rich metadata + custom properties         |
| `Containers`     | ✅ My Drive + Shared Drives as containers    |
| `Download`       | ✅ To local filesystem                       |
| `Upload`         | ✅ From local filesystem                     |

**Not Supported:**

| Capability      | Notes                                           |
| --------------- | ----------------------------------------------- |
| `Permissions`   | ACL-based, not POSIX (different model)          |
| `Symlinks`      | Has "shortcuts" but different concept           |
| `Hardlinks`     | Not applicable                                  |
| `PresignedUrls` | `webContentLink` exists but not true presigned  |
| `BatchDelete`   | Must delete one-by-one (can batch API requests) |
| `ExtendedAttrs` | Custom properties serve similar purpose         |
| `FileLocking`   | Not supported                                   |
| `Delegations`   | Not applicable                                  |

### Folder Structure Differences

- **My Drive:** Files can have **multiple parents** (same file in multiple folders)
- **Shared Drives:** Files can only have **one parent**
- **No true hierarchy:** Files reference parents, not paths
- **Folder limits:** 500,000 items per folder, 100 levels of nesting

### Shared Drives / Team Drives

```typescript
// List shared drives
const drives = await drive.drives.list();

// Access files in shared drive
const files = await drive.files.list({
  driveId: 'SHARED_DRIVE_ID',
  corpora: 'drive',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
```

**Container mapping:**

- S3/GCS: Buckets
- SMB: Shares
- Google Drive: My Drive + Shared Drives (as separate "containers")

### Rate Limits

| Limit                         | Value       |
| ----------------------------- | ----------- |
| Queries per minute            | 12,000      |
| Queries per minute per user   | 12,000      |
| Upload limit per user per day | 750 GB      |
| Maximum file size             | 5 TB        |
| Maximum items per user        | 500 million |

**Error handling:**

- `403 User rate limit exceeded` → Exponential backoff
- `429 Too many requests` → Exponential backoff
- Recommended: `min(((2^n)+random_ms), 64000)`

### Google Workspace Documents

Google Docs, Sheets, and Slides have no "raw" content - they must be exported:

```typescript
// Export Google Doc as PDF
const response = await drive.files.export({
  fileId: 'DOC_ID',
  mimeType: 'application/pdf',
});

// Export formats by type
const EXPORT_FORMATS = {
  'application/vnd.google-apps.document': 'application/pdf', // or docx, txt
  'application/vnd.google-apps.spreadsheet': 'text/csv', // or xlsx
  'application/vnd.google-apps.presentation': 'application/pdf', // or pptx
};
```

### Profile Configuration

```typescript
export interface GoogleDriveProfile extends BaseProfile {
  provider: 'gdrive';
  config: {
    // OAuth 2.0 credentials (from Google Cloud Console)
    clientId: string;
    clientSecret: string;

    // Obtained after OAuth flow
    refreshToken?: string;

    // Optional: for service accounts
    keyFilePath?: string;
    impersonateEmail?: string;

    // Behavior settings
    rootFolderId?: string; // Default: 'root' (My Drive)
    includeSharedDrives?: boolean; // List shared drives as containers
    exportFormat?: 'pdf' | 'docx' | 'txt'; // For Google Workspace docs

    // Performance
    cacheTtlMs?: number; // Path cache TTL (default: 60000)
  };
}
```

### Implementation Complexity

| Task                           | Hours      | Notes                           |
| ------------------------------ | ---------- | ------------------------------- |
| OAuth flow implementation      | 4-6h       | Browser consent for CLI app     |
| Path-to-ID resolution layer    | 6-8h       | Cache, invalidation, edge cases |
| Core operations                | 6-8h       | Straightforward mapping         |
| Folder operations              | 2-3h       | Different semantics             |
| Shared Drive support           | 3-4h       | Additional parameters needed    |
| Google Workspace doc export    | 2-3h       | Optional but useful             |
| Error handling & rate limiting | 2-3h       | Exponential backoff             |
| **Total**                      | **25-35h** |                                 |

### Implementation Concerns

1. **Path Resolution Performance:** Every operation requires path → ID lookup. Solution: Aggressive caching with TTL and invalidation on mutations.

2. **OAuth Flow in CLI:** Requires opening browser for consent. Solution: Local HTTP server callback or OAuth device flow.

3. **Multiple Parents:** Same file can appear in multiple folders (My Drive only). Your model assumes single path per file. Solution: Pick canonical parent or document limitation.

4. **Eventual Consistency:** Some Drive operations are not immediately consistent. Listing may not show just-created files.

### Recommended Phase: 5 or 6

**Rationale:**

1. Core providers (S3, SFTP, FTP) should be stable first
2. Google Drive's different model will stress-test the abstraction
3. OAuth complexity adds development overhead
4. High user demand likely - cloud storage is expected

### Phase 5/6 Tickets (Estimated)

| Ticket    | Description                              | Hours   |
| --------- | ---------------------------------------- | ------- |
| P5-GD-1   | Add `googleapis` dependency, OAuth utils | 2h      |
| P5-GD-2   | Implement OAuth flow with local callback | 4h      |
| P5-GD-3   | Create path-to-ID resolution layer       | 6h      |
| P5-GD-4   | Implement core operations                | 8h      |
| P5-GD-5   | Implement Shared Drive support           | 4h      |
| P5-GD-6   | Handle Google Workspace document export  | 3h      |
| P5-GD-7   | Rate limiting and error handling         | 3h      |
| P5-GD-8   | Integration tests                        | 4h      |
| **Total** |                                          | **34h** |
