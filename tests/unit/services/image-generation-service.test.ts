import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageGenerationService } from "@server/services/image-generation-service";
import { NodeService } from "@server/services/node-service";
import { resetTestDb } from "@tests/helpers/db";

const nodeService = new NodeService();

async function createTestProject(
  name = "Test Project",
  metadata?: Record<string, unknown>,
) {
  return nodeService.createNode({
    type: "project",
    name,
    metadata,
    createdBy: "user:test",
    updatedBy: "user:test",
  });
}

function makeOpenAiFetch(b64 = "aGVsbG8=") {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ b64_json: b64 }],
    }),
  });
}

function makeMediaService(attachmentId = "attach-1") {
  return {
    createAttachment: vi.fn().mockResolvedValue({
      id: attachmentId,
      metadata: { generated: true },
    }),
  };
}

describe("ImageGenerationService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("should call OpenAI images API with the given prompt", async () => {
    const project = await createTestProject("PlainProject");
    const mockFetch = makeOpenAiFetch();
    const mockMedia = makeMediaService();

    const service = new ImageGenerationService(
      "sk-test",
      mockMedia as any,
      nodeService,
      "https://api.openai.com/v1",
      mockFetch as any,
    );

    await service.generateImage("a red dragon", project.id);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
  });

  it("should prepend the project style profile to the prompt", async () => {
    const project = await createTestProject("StyleProject", {
      styleProfile: {
        artStyle: "watercolor illustration",
        colorPalette: "muted earth tones",
      },
    });
    const mockFetch = makeOpenAiFetch();
    const mockMedia = makeMediaService();

    const service = new ImageGenerationService(
      "sk-test",
      mockMedia as any,
      nodeService,
      "https://api.openai.com/v1",
      mockFetch as any,
    );

    await service.generateImage("a red dragon", project.id);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toContain("watercolor illustration");
    expect(body.prompt).toContain("muted earth tones");
    expect(body.prompt).toContain("a red dragon");
  });

  it("should use the prompt verbatim when no style profile is set", async () => {
    const project = await createTestProject("NoStyleProject");
    const mockFetch = makeOpenAiFetch();
    const mockMedia = makeMediaService();

    const service = new ImageGenerationService(
      "sk-test",
      mockMedia as any,
      nodeService,
      "https://api.openai.com/v1",
      mockFetch as any,
    );

    await service.generateImage("a red dragon", project.id);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toBe("a red dragon");
  });

  it("should create a mediaAttachment record with generated metadata", async () => {
    const project = await createTestProject("AttachProject");
    const mockFetch = makeOpenAiFetch();
    const mockMedia = makeMediaService();

    const service = new ImageGenerationService(
      "sk-test",
      mockMedia as any,
      nodeService,
      "https://api.openai.com/v1",
      mockFetch as any,
    );

    await service.generateImage("a blue sky", project.id);

    expect(mockMedia.createAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: project.id,
        projectId: project.id,
        mimeType: "image/png",
        metadata: expect.objectContaining({ generated: true }),
      }),
    );
  });

  it("should throw a descriptive error when OpenAI returns non-ok status", async () => {
    const project = await createTestProject("ErrorProject");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    const mockMedia = makeMediaService();

    const service = new ImageGenerationService(
      "sk-test",
      mockMedia as any,
      nodeService,
      "https://api.openai.com/v1",
      mockFetch as any,
    );

    await expect(
      service.generateImage("a red dragon", project.id),
    ).rejects.toThrow("429");
  });
});
