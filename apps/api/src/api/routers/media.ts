import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { MediaAttachmentService } from "../../services/media-attachment-service";

const mediaService = new MediaAttachmentService();

/**
 * Media Router
 *
 * tRPC endpoints for media attachment CRUD operations.
 * Files are stored in MinIO and tracked in the media_attachments table.
 */
export const mediaRouter = router({
  /**
   * Upload a media attachment to a node.
   * Accepts base64-encoded file data (tRPC doesn't support raw buffers).
   */
  upload: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        projectId: z.string().uuid(),
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        data: z.string(), // base64-encoded file content
        bucket: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        createdBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.data, "base64");
      return await mediaService.createAttachment({
        nodeId: input.nodeId,
        projectId: input.projectId,
        buffer,
        filename: input.filename,
        mimeType: input.mimeType,
        bucket: input.bucket,
        metadata: input.metadata,
        createdBy: input.createdBy,
      });
    }),

  /**
   * Get a single attachment by ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const attachment = await mediaService.getAttachmentById(input.id);
      if (!attachment) {
        throw new Error("Attachment not found");
      }
      return attachment;
    }),

  /**
   * Get all attachments for a node.
   */
  getByNode: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await mediaService.getAttachmentsByNodeId(input.nodeId);
    }),

  /**
   * Delete an attachment (removes from DB and MinIO).
   */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await mediaService.deleteAttachment(input.id);
      return { success: true };
    }),

  /**
   * Get a presigned download URL for an attachment.
   */
  getDownloadUrl: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        expirySeconds: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      const url = await mediaService.getDownloadUrl(
        input.id,
        input.expirySeconds,
      );
      return { url };
    }),
});
