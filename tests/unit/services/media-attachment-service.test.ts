import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { MediaAttachmentService } from "@/services/media-attachment-service";
import { MinioService } from "@/services/minio";
import { resetTestDb } from "@tests/helpers/db";
import { createTestProject, createTestNote } from "@tests/helpers/fixtures";

describe("MediaAttachmentService", () => {
  let mediaService: MediaAttachmentService;
  let minioService: MinioService;

  beforeAll(async () => {
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const endPoint = endpoint.includes(":") ? endpoint.split(":")[0] : endpoint;

    minioService = new MinioService({
      endPoint,
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || "arbor",
      secretKey: process.env.MINIO_SECRET_KEY || "local_dev_only",
    });

    await minioService.ensureBucket("arbor-test");
    await minioService.ensureBucket("arbor-media");
    mediaService = new MediaAttachmentService(minioService);
  });

  beforeEach(async () => {
    await resetTestDb();
    // Clean up test bucket objects
    for (const bucket of ["arbor-test", "arbor-media"]) {
      try {
        const objects = await minioService.listObjects(bucket);
        for (const obj of objects) {
          await minioService.deleteObject(bucket, obj.name);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("createAttachment", () => {
    it("should create a DB record and upload file to MinIO", async () => {
      const project = await createTestProject("Media Project");
      const note = await createTestNote("My Note", project.id);
      const buffer = Buffer.from("hello world");

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer,
        filename: "test.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
        createdBy: "user:test",
      });

      expect(attachment).toBeDefined();
      expect(attachment.id).toBeDefined();
      expect(attachment.nodeId).toBe(note.id);
      expect(attachment.bucket).toBe("arbor-test");
      expect(attachment.objectKey).toContain(project.id);
      expect(attachment.objectKey).toContain(note.id);
      expect(attachment.objectKey).toContain("test.txt");
      expect(attachment.filename).toBe("test.txt");
      expect(attachment.mimeType).toBe("text/plain");
      expect(attachment.size).toBe(buffer.length);
      expect(attachment.createdBy).toBe("user:test");
      expect(attachment.createdAt).toBeInstanceOf(Date);

      // Verify file actually exists in MinIO
      const stat = await minioService.client.statObject(
        "arbor-test",
        attachment.objectKey,
      );
      expect(stat.size).toBe(buffer.length);
    });

    it("should use default bucket and createdBy when not specified", async () => {
      const project = await createTestProject("Default Project");
      const note = await createTestNote("Note", project.id);
      const buffer = Buffer.from("content");

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer,
        filename: "default.txt",
        mimeType: "text/plain",
      });

      expect(attachment.bucket).toBe("arbor-media");
      expect(attachment.createdBy).toBe("user:system");
    });

    it("should store metadata when provided", async () => {
      const project = await createTestProject("Meta Project");
      const note = await createTestNote("Note", project.id);
      const buffer = Buffer.from("image data");

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer,
        filename: "photo.png",
        mimeType: "image/png",
        bucket: "arbor-test",
        metadata: { width: 800, height: 600, thumbnail: "thumb_photo.png" },
      });

      expect(attachment.metadata).toEqual({
        width: 800,
        height: 600,
        thumbnail: "thumb_photo.png",
      });
    });

    it("should throw when nodeId references a non-existent node", async () => {
      const buffer = Buffer.from("orphan");
      const fakeNodeId = "00000000-0000-0000-0000-000000000000";

      await expect(
        mediaService.createAttachment({
          nodeId: fakeNodeId,
          projectId: "proj-123",
          buffer,
          filename: "orphan.txt",
          mimeType: "text/plain",
          bucket: "arbor-test",
        }),
      ).rejects.toThrow();
    });
  });

  describe("getAttachmentById", () => {
    it("should return attachment by ID", async () => {
      const project = await createTestProject("Get Project");
      const note = await createTestNote("Note", project.id);
      const buffer = Buffer.from("get me");

      const created = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer,
        filename: "get.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      const found = await mediaService.getAttachmentById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.filename).toBe("get.txt");
    });

    it("should return null for non-existent ID", async () => {
      const found = await mediaService.getAttachmentById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });
  });

  describe("getAttachmentsByNodeId", () => {
    it("should return all attachments for a node", async () => {
      const project = await createTestProject("List Project");
      const note = await createTestNote("Note", project.id);

      await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("file 1"),
        filename: "one.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("file 2"),
        filename: "two.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      const attachments = await mediaService.getAttachmentsByNodeId(note.id);
      expect(attachments).toHaveLength(2);
      const filenames = attachments.map((a) => a.filename).sort();
      expect(filenames).toEqual(["one.txt", "two.txt"]);
    });

    it("should return empty array for node with no attachments", async () => {
      const project = await createTestProject("Empty Project");
      const note = await createTestNote("Note", project.id);

      const attachments = await mediaService.getAttachmentsByNodeId(note.id);
      expect(attachments).toEqual([]);
    });

    it("should not return attachments from other nodes", async () => {
      const project = await createTestProject("Isolation Project");
      const noteA = await createTestNote("Note A", project.id);
      const noteB = await createTestNote("Note B", project.id);

      await mediaService.createAttachment({
        nodeId: noteA.id,
        projectId: project.id,
        buffer: Buffer.from("A file"),
        filename: "a.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      await mediaService.createAttachment({
        nodeId: noteB.id,
        projectId: project.id,
        buffer: Buffer.from("B file"),
        filename: "b.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      const attachmentsA = await mediaService.getAttachmentsByNodeId(noteA.id);
      expect(attachmentsA).toHaveLength(1);
      expect(attachmentsA[0].filename).toBe("a.txt");
    });
  });

  describe("deleteAttachment", () => {
    it("should delete from DB and MinIO", async () => {
      const project = await createTestProject("Delete Project");
      const note = await createTestNote("Note", project.id);

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("delete me"),
        filename: "doomed.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      await mediaService.deleteAttachment(attachment.id);

      // Verify removed from DB
      const found = await mediaService.getAttachmentById(attachment.id);
      expect(found).toBeNull();

      // Verify removed from MinIO
      await expect(
        minioService.client.statObject("arbor-test", attachment.objectKey),
      ).rejects.toThrow();
    });

    it("should throw when deleting non-existent attachment", async () => {
      await expect(
        mediaService.deleteAttachment("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow();
    });
  });

  describe("getDownloadUrl", () => {
    it("should generate a presigned URL", async () => {
      const project = await createTestProject("URL Project");
      const note = await createTestNote("Note", project.id);

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("download me"),
        filename: "download.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      const url = await mediaService.getDownloadUrl(attachment.id);
      expect(url).toContain("arbor-test");
      expect(url).toContain(attachment.objectKey);
      expect(url).toContain("X-Amz-Signature");
    });

    it("should accept custom expiry", async () => {
      const project = await createTestProject("Expiry Project");
      const note = await createTestNote("Note", project.id);

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("expiry test"),
        filename: "expiry.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      const url = await mediaService.getDownloadUrl(attachment.id, 60);
      expect(url).toBeTruthy();
    });

    it("should throw for non-existent attachment", async () => {
      await expect(
        mediaService.getDownloadUrl("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow();
    });
  });

  describe("cascade delete", () => {
    it("should delete media attachments when parent node is deleted", async () => {
      const project = await createTestProject("Cascade Project");
      const note = await createTestNote("Note", project.id);

      const attachment = await mediaService.createAttachment({
        nodeId: note.id,
        projectId: project.id,
        buffer: Buffer.from("cascade test"),
        filename: "cascade.txt",
        mimeType: "text/plain",
        bucket: "arbor-test",
      });

      // Import NodeService to delete the node
      const { NodeService } = await import("@/services/node-service");
      const nodeService = new NodeService();
      await nodeService.deleteNode(note.id);

      // DB record should be gone due to CASCADE
      const found = await mediaService.getAttachmentById(attachment.id);
      expect(found).toBeNull();
    });
  });
});
