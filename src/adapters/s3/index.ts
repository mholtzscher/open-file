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
