import { db } from "../db/index";
import { mediaAttachments } from "../db/schema";
import type { MediaAttachment } from "../db/schema";
import { eq } from "drizzle-orm";
import { MinioService, createMinioService } from "./minio";

const DEFAULT_BUCKET = "arbor-media";

export interface CreateAttachmentParams {
  nodeId: string;
  projectId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  bucket?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

/**
 * MediaAttachmentService
 *
 * Combines MinIO object storage with database tracking for media files.
 * Each attachment is stored as a file in MinIO and tracked as a row in
 * the media_attachments table.
 */
export class MediaAttachmentService {
  private minioService: MinioService;

  constructor(minioService?: MinioService) {
    this.minioService = minioService || createMinioService();
  }

  /**
   * Create a new media attachment: uploads to MinIO and records in DB.
   */
  async createAttachment(
    params: CreateAttachmentParams,
  ): Promise<MediaAttachment> {
    const bucket = params.bucket || DEFAULT_BUCKET;
    const createdBy = params.createdBy || "user:system";

    // Upload file to MinIO
    const objectKey = await this.minioService.uploadFile(
      bucket,
      params.buffer,
      params.filename,
      params.projectId,
      params.nodeId,
      params.mimeType,
    );

    // Insert DB record
    const [attachment] = await db
      .insert(mediaAttachments)
      .values({
        nodeId: params.nodeId,
        bucket,
        objectKey,
        filename: params.filename,
        mimeType: params.mimeType,
        size: params.buffer.length,
        metadata: params.metadata || {},
        createdBy,
      })
      .returning();

    return attachment;
  }

  /**
   * Get a single attachment by ID.
   */
  async getAttachmentById(id: string): Promise<MediaAttachment | null> {
    const results = await db
      .select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.id, id));

    return results[0] || null;
  }

  /**
   * Get all attachments for a given node.
   */
  async getAttachmentsByNodeId(nodeId: string): Promise<MediaAttachment[]> {
    return await db
      .select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.nodeId, nodeId));
  }

  /**
   * Delete an attachment: removes from both DB and MinIO.
   * Throws if the attachment does not exist.
   */
  async deleteAttachment(id: string): Promise<void> {
    const attachment = await this.getAttachmentById(id);
    if (!attachment) {
      throw new Error(`Attachment not found: ${id}`);
    }

    // Delete from MinIO first (if this fails, DB record stays for retry)
    await this.minioService.deleteObject(
      attachment.bucket,
      attachment.objectKey,
    );

    // Delete from DB
    await db.delete(mediaAttachments).where(eq(mediaAttachments.id, id));
  }

  /**
   * Generate a presigned download URL for an attachment.
   * Throws if the attachment does not exist.
   */
  async getDownloadUrl(
    id: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    const attachment = await this.getAttachmentById(id);
    if (!attachment) {
      throw new Error(`Attachment not found: ${id}`);
    }

    return await this.minioService.getPresignedUrl(
      attachment.bucket,
      attachment.objectKey,
      expirySeconds,
    );
  }
}
