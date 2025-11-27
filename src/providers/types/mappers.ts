/**
 * Type Mapper Functions
 *
 * Mapper functions for converting between provider-specific types
 * and existing UI/legacy types. These enable backward compatibility
 * during the transition to the new provider system.
 *
 * Mappers are designed for roundtrip compatibility where possible,
 * though some provider-specific fields may be lost when converting
 * to the simpler UI types.
 */

import { Entry, EntryType, EntryMetadata } from '../../types/entry.js';
import { ProviderEntry, ProviderEntryType, ProviderEntryMetadata } from './entry.js';
import { ProviderProgressEvent } from './progress.js';
import { ProviderListResult, ProviderListOptions } from './list.js';
import { ListResult, ListOptions, ProgressEvent } from '../provider.js';

// ============================================================================
// Entry Type Mappers
// ============================================================================

/**
 * Map UI EntryType to ProviderEntryType
 */
export function toProviderEntryType(type: EntryType): ProviderEntryType {
  switch (type) {
    case EntryType.File:
      return ProviderEntryType.File;
    case EntryType.Directory:
      return ProviderEntryType.Directory;
    case EntryType.Bucket:
      return ProviderEntryType.Bucket;
    default:
      // Fallback for any unknown types
      return ProviderEntryType.File;
  }
}

/**
 * Map ProviderEntryType to UI EntryType
 * Note: ProviderEntryType.Symlink maps to File (UI doesn't support symlinks)
 */
export function fromProviderEntryType(type: ProviderEntryType): EntryType {
  switch (type) {
    case ProviderEntryType.File:
      return EntryType.File;
    case ProviderEntryType.Directory:
      return EntryType.Directory;
    case ProviderEntryType.Bucket:
      return EntryType.Bucket;
    case ProviderEntryType.Symlink:
      // Symlinks appear as files in the UI
      return EntryType.File;
    default:
      return EntryType.File;
  }
}

// ============================================================================
// Entry Metadata Mappers
// ============================================================================

/**
 * Map UI EntryMetadata to ProviderEntryMetadata
 */
export function toProviderEntryMetadata(
  metadata: EntryMetadata | undefined
): ProviderEntryMetadata | undefined {
  if (!metadata) return undefined;

  return {
    contentType: metadata.contentType,
    etag: metadata.etag,
    storageClass: metadata.storageClass,
    region: metadata.region,
    createdAt: metadata.createdAt,
    totalSize: metadata.totalSize,
    objectCount: metadata.objectCount,
    custom: metadata.custom,
  };
}

/**
 * Map ProviderEntryMetadata to UI EntryMetadata
 * Note: POSIX-specific fields (permissions, owner, group, symlinkTarget) are lost
 */
export function fromProviderEntryMetadata(
  metadata: ProviderEntryMetadata | undefined
): EntryMetadata | undefined {
  if (!metadata) return undefined;

  return {
    contentType: metadata.contentType,
    etag: metadata.etag,
    storageClass: metadata.storageClass,
    region: metadata.region,
    createdAt: metadata.createdAt,
    totalSize: metadata.totalSize,
    objectCount: metadata.objectCount,
    custom: metadata.custom,
  };
}

// ============================================================================
// Entry Mappers
// ============================================================================

/**
 * Map UI Entry to ProviderEntry
 */
export function toProviderEntry(entry: Entry): ProviderEntry {
  return {
    id: entry.id,
    name: entry.name,
    type: toProviderEntryType(entry.type),
    path: entry.path,
    size: entry.size,
    modified: entry.modified,
    metadata: toProviderEntryMetadata(entry.metadata),
  };
}

/**
 * Map ProviderEntry to UI Entry
 */
export function fromProviderEntry(entry: ProviderEntry): Entry {
  return {
    id: entry.id,
    name: entry.name,
    type: fromProviderEntryType(entry.type),
    path: entry.path,
    size: entry.size,
    modified: entry.modified,
    metadata: fromProviderEntryMetadata(entry.metadata),
  };
}

/**
 * Map array of UI Entries to ProviderEntries
 */
export function toProviderEntries(entries: Entry[]): ProviderEntry[] {
  return entries.map(toProviderEntry);
}

/**
 * Map array of ProviderEntries to UI Entries
 */
export function fromProviderEntries(entries: ProviderEntry[]): Entry[] {
  return entries.map(fromProviderEntry);
}

// ============================================================================
// Progress Event Mappers
// ============================================================================

/**
 * Map UI ProgressEvent to ProviderProgressEvent
 */
export function toProviderProgressEvent(event: ProgressEvent): ProviderProgressEvent {
  return {
    operation: event.operation,
    bytesTransferred: event.bytesTransferred,
    totalBytes: event.totalBytes,
    percentage: event.percentage,
    currentFile: event.currentFile,
  };
}

/**
 * Map ProviderProgressEvent to UI ProgressEvent
 * Note: Extended fields (filesProcessed, totalFiles, estimatedTimeRemaining, bytesPerSecond) are lost
 */
export function fromProviderProgressEvent(event: ProviderProgressEvent): ProgressEvent {
  return {
    operation: event.operation,
    bytesTransferred: event.bytesTransferred,
    totalBytes: event.totalBytes,
    percentage: event.percentage,
    currentFile: event.currentFile,
  };
}

// ============================================================================
// List Options Mappers
// ============================================================================

/**
 * Map UI ListOptions to ProviderListOptions
 */
export function toProviderListOptions(
  options: ListOptions | undefined
): ProviderListOptions | undefined {
  if (!options) return undefined;

  return {
    limit: options.limit,
    continuationToken: options.continuationToken,
    recursive: options.recursive,
  };
}

/**
 * Map ProviderListOptions to UI ListOptions
 * Note: Extended fields (prefix, extension, includeHidden, sortBy, sortOrder) are lost
 */
export function fromProviderListOptions(
  options: ProviderListOptions | undefined
): ListOptions | undefined {
  if (!options) return undefined;

  return {
    limit: options.limit,
    continuationToken: options.continuationToken,
    recursive: options.recursive,
  };
}

// ============================================================================
// List Result Mappers
// ============================================================================

/**
 * Map UI ListResult to ProviderListResult
 */
export function toProviderListResult(result: ListResult): ProviderListResult {
  return {
    entries: toProviderEntries(result.entries),
    continuationToken: result.continuationToken,
    hasMore: result.hasMore,
  };
}

/**
 * Map ProviderListResult to UI ListResult
 * Note: Extended fields (totalCount, path) are lost
 */
export function fromProviderListResult(result: ProviderListResult): ListResult {
  return {
    entries: fromProviderEntries(result.entries),
    continuationToken: result.continuationToken,
    hasMore: result.hasMore,
  };
}
