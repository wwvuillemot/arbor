import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { MinioService } from "@/services/minio";
import * as Minio from "minio";

describe("MinioService", () => {
  let minioService: MinioService;

  beforeAll(async () => {
    // Initialize MinIO service with test configuration
    // Parse endpoint to extract hostname (remove port if present)
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const endPoint = endpoint.includes(":") ? endpoint.split(":")[0] : endpoint;

    minioService = new MinioService({
      endPoint,
      port: 9000,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || "arbor",
      secretKey: process.env.MINIO_SECRET_KEY || "local_dev_only",
    });

    // Ensure test bucket exists
    await minioService.ensureBucket("arbor-test");
  });

  afterAll(async () => {
    // Clean up test bucket
    try {
      const objects = await minioService.listObjects("arbor-test");
      for (const obj of objects) {
        await minioService.deleteObject("arbor-test", obj.name);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("ensureBucket", () => {
    it("should create bucket if it does not exist", async () => {
      const bucketName = "arbor-test-new";
      await minioService.ensureBucket(bucketName);

      const exists = await minioService.bucketExists(bucketName);
      expect(exists).toBe(true);

      // Cleanup
      await minioService.client.removeBucket(bucketName);
    });

    it("should not throw if bucket already exists", async () => {
      const bucketName = "arbor-test";
      await expect(
        minioService.ensureBucket(bucketName),
      ).resolves.not.toThrow();
    });
  });

  describe("uploadFile", () => {
    it("should upload a file and return object key", async () => {
      const buffer = Buffer.from("test file content");
      const fileName = "test.txt";
      const projectId = "proj-123";
      const nodeId = "node-456";

      const objectKey = await minioService.uploadFile(
        "arbor-test",
        buffer,
        fileName,
        projectId,
        nodeId,
        "text/plain",
      );

      expect(objectKey).toMatch(/^proj-123\/node-456\/\d+_test\.txt$/);

      // Verify file exists
      const stat = await minioService.client.statObject(
        "arbor-test",
        objectKey,
      );
      expect(stat.size).toBe(buffer.length);
    });

    it("should set correct metadata", async () => {
      const buffer = Buffer.from("test content");
      const fileName = "metadata-test.txt";

      const objectKey = await minioService.uploadFile(
        "arbor-test",
        buffer,
        fileName,
        "proj-123",
        "node-456",
        "text/plain",
      );

      const stat = await minioService.client.statObject(
        "arbor-test",
        objectKey,
      );

      // Verify content-type is set correctly
      expect(stat.metaData["content-type"]).toBe("text/plain");

      // Verify object was uploaded successfully
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe("getPresignedUrl", () => {
    it("should generate a presigned URL for download", async () => {
      // Upload a test file first
      const buffer = Buffer.from("presigned url test");
      const objectKey = await minioService.uploadFile(
        "arbor-test",
        buffer,
        "presigned.txt",
        "proj-123",
        "node-456",
        "text/plain",
      );

      const url = await minioService.getPresignedUrl(
        "arbor-test",
        objectKey,
        3600,
      );

      expect(url).toContain("arbor-test");
      expect(url).toContain(objectKey);
      expect(url).toContain("X-Amz-Signature");
    });

    it("should use default expiry of 1 hour", async () => {
      const buffer = Buffer.from("test");
      const objectKey = await minioService.uploadFile(
        "arbor-test",
        buffer,
        "default-expiry.txt",
        "proj-123",
        "node-456",
        "text/plain",
      );

      const url = await minioService.getPresignedUrl("arbor-test", objectKey);
      expect(url).toBeTruthy();
    });
  });

  describe("deleteObject", () => {
    it("should delete an object", async () => {
      // Upload a test file
      const buffer = Buffer.from("to be deleted");
      const objectKey = await minioService.uploadFile(
        "arbor-test",
        buffer,
        "delete-me.txt",
        "proj-123",
        "node-456",
        "text/plain",
      );

      // Delete it
      await minioService.deleteObject("arbor-test", objectKey);

      // Verify it's gone
      await expect(
        minioService.client.statObject("arbor-test", objectKey),
      ).rejects.toThrow();
    });
  });

  describe("listObjects", () => {
    it("should list objects in a bucket", async () => {
      // Upload a few test files
      await minioService.uploadFile(
        "arbor-test",
        Buffer.from("file 1"),
        "list-1.txt",
        "proj-123",
        "node-456",
        "text/plain",
      );
      await minioService.uploadFile(
        "arbor-test",
        Buffer.from("file 2"),
        "list-2.txt",
        "proj-123",
        "node-456",
        "text/plain",
      );

      const objects = await minioService.listObjects("arbor-test", "proj-123/");
      expect(objects.length).toBeGreaterThanOrEqual(2);
      expect(objects.every((obj) => obj.name.startsWith("proj-123/"))).toBe(
        true,
      );
    });
  });
});
