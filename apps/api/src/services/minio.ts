import * as Minio from "minio";

export interface MinioConfig {
  endPoint: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
}

export interface UploadedFile {
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  etag: string;
}

export class MinioService {
  public client: Minio.Client;

  constructor(config: MinioConfig) {
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port || 9000,
      useSSL: config.useSSL || false,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  /**
   * Check if a bucket exists
   */
  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      return await this.client.bucketExists(bucketName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure a bucket exists, create if it doesn't
   */
  async ensureBucket(bucketName: string): Promise<void> {
    const exists = await this.bucketExists(bucketName);
    if (!exists) {
      await this.client.makeBucket(bucketName, "us-east-1");
    }
  }

  /**
   * Upload a file to MinIO
   * @param bucket - Bucket name
   * @param buffer - File buffer
   * @param fileName - Original file name
   * @param projectId - Project ID
   * @param nodeId - Node ID
   * @param mimeType - MIME type
   * @returns Object key
   */
  async uploadFile(
    bucket: string,
    buffer: Buffer,
    fileName: string,
    projectId: string,
    nodeId: string,
    mimeType: string,
  ): Promise<string> {
    // Generate object key: {project_id}/{node_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const objectKey = `${projectId}/${nodeId}/${timestamp}_${fileName}`;

    // Metadata
    const metaData = {
      "Content-Type": mimeType,
      "X-Amz-Meta-Project-Id": projectId,
      "X-Amz-Meta-Node-Id": nodeId,
      "X-Amz-Meta-Original-Filename": fileName,
    };

    // Upload
    await this.client.putObject(
      bucket,
      objectKey,
      buffer,
      buffer.length,
      metaData,
    );

    return objectKey;
  }

  /**
   * Get a presigned URL for downloading a file
   * @param bucket - Bucket name
   * @param objectKey - Object key
   * @param expirySeconds - URL expiry in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrl(
    bucket: string,
    objectKey: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    return await this.client.presignedGetObject(
      bucket,
      objectKey,
      expirySeconds,
    );
  }

  /**
   * Delete an object
   * @param bucket - Bucket name
   * @param objectKey - Object key
   */
  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.removeObject(bucket, objectKey);
  }

  /**
   * List objects in a bucket
   * @param bucket - Bucket name
   * @param prefix - Optional prefix filter
   * @returns Array of objects
   */
  async listObjects(
    bucket: string,
    prefix?: string,
  ): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
    return new Promise((resolve, reject) => {
      const objects: Array<{ name: string; size: number; lastModified: Date }> =
        [];
      const stream = this.client.listObjects(bucket, prefix, true);

      stream.on("data", (obj) => {
        objects.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
        });
      });

      stream.on("error", (err) => {
        reject(err);
      });

      stream.on("end", () => {
        resolve(objects);
      });
    });
  }

  /**
   * Get object metadata
   * @param bucket - Bucket name
   * @param objectKey - Object key
   * @returns Object stat
   */
  async getObjectStat(
    bucket: string,
    objectKey: string,
  ): Promise<Minio.BucketItemStat> {
    return await this.client.statObject(bucket, objectKey);
  }
}

/**
 * Create a MinIO service instance from environment variables
 */
export function createMinioService(): MinioService {
  const config: MinioConfig = {
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "arbor",
    secretKey: process.env.MINIO_SECRET_KEY || "local_dev_only",
  };

  return new MinioService(config);
}
