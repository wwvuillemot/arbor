import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { MediaAttachmentService } from "../../services/media-attachment-service";
import { ImageGenerationService } from "../../services/image-generation-service";
import { NodeService } from "../../services/node-service";
import { SettingsService } from "../../services/settings-service";

const mediaService = new MediaAttachmentService();
const nodeService = new NodeService();
const settingsService = new SettingsService();

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
   * Get the first image attachment ID for each of a batch of node IDs.
   * Returns a map of nodeId → attachmentId.
   */
  getFirstImageByNodes: publicProcedure
    .input(z.object({ nodeIds: z.array(z.string().uuid()) }))
    .query(async ({ input }) => {
      return await mediaService.getFirstImageByNodes(input.nodeIds);
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
   * Get all image attachments for a project (by projectId prefix on objectKey).
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await mediaService.getImageAttachmentsByProjectId(input.projectId);
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
   * Generate an image with DALL-E and store it as an attachment on a project node.
   * The project's metadata.styleProfile is prepended to the prompt if set.
   */
  generateImage: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        projectId: z.string().uuid(),
        masterKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = await settingsService.getSetting(
        "openai_api_key",
        input.masterKey,
      );
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }
      const imageService = new ImageGenerationService(
        apiKey,
        mediaService,
        nodeService,
      );
      return await imageService.generateImage(input.prompt, input.projectId);
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
