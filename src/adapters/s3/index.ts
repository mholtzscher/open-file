/**
 * S3 Module - Barrel exports for S3 adapter components
 */

export {
  createS3Client,
  createS3ClientWithRegion,
  type S3ClientOptions,
  type S3ClientResult,
} from './client-factory.js';

export {
  uploadLargeFile,
  abortMultipartUpload,
  shouldUseMultipartUpload,
  MULTIPART_THRESHOLD,
  PART_SIZE,
  type MultipartUploadOptions,
} from './multipart-upload.js';

export {
  normalizeS3Path,
  getS3KeyName,
  isS3Directory,
  joinS3Path,
  getS3ParentPath,
  getS3RelativePath,
} from './path-utils.js';

export {
  parseS3ObjectToEntry,
  parseCommonPrefixToEntry,
  parseBucketToEntry,
  sortEntries,
  type BucketInfo,
} from './entry-parser.js';

export {
  listAllObjects,
  batchDeleteObjects,
  DELETE_BATCH_SIZE,
  type ListAllObjectsOptions,
  type BatchDeleteOptions,
} from './batch-operations.js';

export {
  copyObject,
  copyDirectory,
  moveObject,
  moveDirectory,
  batchObjectOperation,
  type CopyObjectOptions,
  type CopyDirectoryOptions,
  type CopyProgressCallback,
  type MoveObjectOptions,
  type MoveDirectoryOptions,
  type MoveProgressCallback,
  type ObjectOperationProgressCallback,
  type BatchObjectOperationOptions,
} from './object-operations.js';

export {
  downloadFileToLocal,
  downloadDirectoryToLocal,
  uploadFileToS3,
  uploadDirectoryToS3,
  type DownloadFileOptions,
  type DownloadDirectoryOptions,
  type UploadFileOptions,
  type UploadDirectoryOptions,
  type TransferProgressCallback,
  type S3ReadFunction,
} from './transfer-operations.js';

export { createProgressAdapter, type OperationProgressCallback } from './progress-adapter.js';

export {
  readObject,
  type ReadObjectOptions,
  type ReadOperationsLogger,
} from './read-operations.js';

export {
  listObjects,
  listBuckets,
  type ListObjectsOptions,
  type ListObjectsResult,
  type ListBucketsOptions,
  type ListOperationsLogger,
} from './list-operations.js';
