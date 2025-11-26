# Provider & Profile System Design

> **Status**: Draft proposal for multi-provider storage abstraction
> **Date**: 2025-11-25

## Overview

This document proposes a unified abstraction layer for supporting multiple storage providers (S3, GCS, FTP/SFTP, SSH) behind a common interface with a profile-based configuration system.

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

Based on research of AWS S3, Google Cloud Storage, FTP (RFC 959), and SFTP (SSH File Transfer Protocol):

| Capability | S3 | GCS | SFTP | FTP |
|------------|:--:|:---:|:----:|:---:|
| List | ✅ | ✅ | ✅ | ✅ |
| Read | ✅ | ✅ | ✅ | ✅ |
| Write | ✅ | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ✅ | ✅ |
| Mkdir | ✅* | ✅ | ✅ | ✅ |
| Rmdir | ✅* | ✅ | ✅ | ✅ |
| Copy | ✅ | ✅ | ❌ | ❌ |
| Move | ✅ | ✅ | ✅ | ✅ |
| ServerSideCopy | ✅ | ✅ | ❌ | ❌ |
| Resume | ✅ | ✅ | ✅ | ⚠️ |
| Versioning | ✅ | ✅ | ❌ | ❌ |
| Metadata | ✅ | ✅ | ❌ | ❌ |
| Permissions | ❌ | ❌ | ✅ | ❌ |
| Symlinks | ❌ | ❌ | ✅ | ❌ |
| PresignedUrls | ✅ | ✅ | ❌ | ❌ |
| BatchDelete | ✅ | ✅ | ❌ | ❌ |
| Buckets/Containers | ✅ | ✅ | ❌ | ❌ |

*S3 directories are simulated via empty objects with trailing `/`

---

## Proposed Design

### 1. Profile Configuration

```typescript
// types/profile.ts

export type ProviderType = 's3' | 'gcs' | 'sftp' | 'ftp';

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
    profile?: string;           // AWS profile name
    accessKeyId?: string;       // Direct credentials (alternative to profile)
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;          // For MinIO, LocalStack, etc.
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
    keyFilePath?: string;       // Service account JSON path
    useApplicationDefault?: boolean;  // Use ADC
  };
}

/**
 * SFTP-specific profile configuration
 */
export interface SFTPProfile extends BaseProfile {
  provider: 'sftp';
  config: {
    host: string;
    port?: number;              // Default: 22
    username: string;
    authMethod: 'password' | 'key' | 'agent';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    basePath?: string;          // Starting directory
  };
}

/**
 * FTP-specific profile configuration
 */
export interface FTPProfile extends BaseProfile {
  provider: 'ftp';
  config: {
    host: string;
    port?: number;              // Default: 21
    username?: string;          // Optional for anonymous
    password?: string;
    secure?: boolean | 'implicit';  // FTPS
    basePath?: string;          // Starting directory
  };
}

export type Profile = S3Profile | GCSProfile | SFTPProfile | FTPProfile;
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
  Copy = 'copy',              // In-provider copy
  Move = 'move',              // Atomic rename/move
  ServerSideCopy = 'serverSideCopy',  // No data transfer needed
  
  // Transfers
  Download = 'download',      // To local filesystem
  Upload = 'upload',          // From local filesystem
  Resume = 'resume',          // Resumable transfers
  
  // Advanced
  Versioning = 'versioning',
  Metadata = 'metadata',      // Custom metadata support
  Permissions = 'permissions', // POSIX-style permissions
  Symlinks = 'symlinks',
  PresignedUrls = 'presignedUrls',
  BatchDelete = 'batchDelete',
  
  // Container concepts
  Containers = 'containers',  // S3/GCS bucket listing
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
    data 
  }),
  
  notFound: (path: string): OperationResult => ({
    status: OperationStatus.NotFound,
    error: { 
      code: 'NOT_FOUND', 
      message: `Path not found: ${path}`, 
      retryable: false 
    }
  }),
  
  permissionDenied: (path: string): OperationResult => ({
    status: OperationStatus.PermissionDenied,
    error: { 
      code: 'PERMISSION_DENIED', 
      message: `Access denied: ${path}`, 
      retryable: false 
    }
  }),
  
  unimplemented: (operation: string): OperationResult => ({
    status: OperationStatus.Unimplemented,
    error: { 
      code: 'UNIMPLEMENTED', 
      message: `${operation} not supported by this provider`, 
      retryable: false 
    }
  }),
  
  connectionFailed: (message: string): OperationResult => ({
    status: OperationStatus.ConnectionFailed,
    error: { 
      code: 'CONNECTION_FAILED', 
      message, 
      retryable: true 
    }
  }),
  
  error: (code: string, message: string, retryable = false, cause?: unknown): OperationResult => ({
    status: OperationStatus.Error,
    error: { code, message, retryable, cause }
  }),
};

// Type guard for success
export function isSuccess<T>(result: OperationResult<T>): result is OperationResult<T> & { data: T } {
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
  Bucket = 'bucket',        // S3/GCS containers
  Symlink = 'symlink',      // SFTP
}

export interface EntryMetadata {
  // Universal
  contentType?: string;
  
  // Cloud storage (S3/GCS)
  etag?: string;
  storageClass?: string;
  versionId?: string;
  
  // POSIX (SFTP/FTP)
  permissions?: number;       // e.g., 0o755
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
  providerData?: Record<string, unknown>;  // Raw provider data
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
  downloadToLocal(remotePath: string, localPath: string, options?: TransferOptions): Promise<OperationResult>;
  uploadFromLocal(localPath: string, remotePath: string, options?: TransferOptions): Promise<OperationResult>;
  
  // === Container Operations (S3/GCS buckets) ===
  listContainers?(): Promise<OperationResult<Entry[]>>;
  setContainer?(name: string): void;
  getContainer?(): string | undefined;
  
  // === Advanced Operations ===
  setMetadata?(path: string, metadata: Record<string, string>): Promise<OperationResult>;
  getPresignedUrl?(path: string, operation: 'read' | 'write', expiresInSeconds: number): Promise<OperationResult<string>>;
  readSymlink?(path: string): Promise<OperationResult<string>>;
  setPermissions?(path: string, mode: number): Promise<OperationResult>;
}
```

### 6. Base Provider with Fallbacks

```typescript
// adapters/base-provider.ts

import { StorageProvider, ListOptions, ListResult, ReadOptions, WriteOptions, DeleteOptions, TransferOptions } from './provider';
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
  
  async downloadToLocal(_remotePath: string, _localPath: string, _options?: TransferOptions): Promise<OperationResult> {
    return Result.unimplemented('downloadToLocal');
  }
  
  async uploadFromLocal(_localPath: string, _remotePath: string, _options?: TransferOptions): Promise<OperationResult> {
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
    if (this.hasCapability(Capability.Read) && 
        this.hasCapability(Capability.Write) && 
        this.hasCapability(Capability.Delete)) {
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
  protected async nativeMove(_source: string, _dest: string, _options?: TransferOptions): Promise<OperationResult> {
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
  protected async nativeCopy(_source: string, _dest: string, _options?: TransferOptions): Promise<OperationResult> {
    return Result.unimplemented('copy');
  }
}
```

### 7. Provider Factory

```typescript
// adapters/provider-factory.ts

import { Profile, S3Profile, GCSProfile, SFTPProfile, FTPProfile } from '../types/profile';
import { StorageProvider } from './provider';

// Provider implementations would be imported here
// import { S3Provider } from './s3-provider';
// import { GCSProvider } from './gcs-provider';
// import { SFTPProvider } from './sftp-provider';
// import { FTPProvider } from './ftp-provider';

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
    default:
      throw new Error(`Unknown provider type: ${(profile as any).provider}`);
  }
}

export function getSupportedProviders(): string[] {
  return ['s3', 'gcs', 'sftp', 'ftp'];
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
  validateProfile(profile: Profile): string[];  // Returns validation errors
  
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

---

## Migration Path

1. **Phase 1: Types** - Create new types (`Profile`, `Capability`, `OperationResult`)
2. **Phase 2: Interface** - Create `StorageProvider` interface and `BaseStorageProvider`
3. **Phase 3: S3 Wrapper** - Create `S3Provider` that wraps existing `S3Adapter`
4. **Phase 4: Profile Manager** - Add profile persistence and management
5. **Phase 5: UI Updates** - Update UI to use capability introspection
6. **Phase 6: New Providers** - Add GCS, SFTP, FTP providers incrementally

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

3. **Cross-Provider Operations**: Should we support copy/move between different providers (e.g., S3 to SFTP)?

4. **Progress Aggregation**: How should progress be reported for recursive operations across providers with different progress reporting capabilities?

5. **Offline/Cached Mode**: Should we cache directory listings for offline browsing?
