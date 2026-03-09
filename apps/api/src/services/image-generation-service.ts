import type { MediaAttachmentService } from "./media-attachment-service";
import type { NodeService } from "./node-service";

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

interface StylePreset {
  id: string;
  name: string;
  artStyle?: string;
  colorPalette?: string;
  moodKeywords?: string;
}

// v1: { artStyle, colorPalette, moodKeywords } — legacy flat format
// v2: { presets: StylePreset[], activePresetId?: string }
type StyleProfile =
  | { presets: StylePreset[]; activePresetId?: string }
  | { artStyle?: string; colorPalette?: string; moodKeywords?: string };

function resolveActivePreset(
  profile: StyleProfile,
):
  | StylePreset
  | { artStyle?: string; colorPalette?: string; moodKeywords?: string } {
  if ("presets" in profile) {
    return (
      profile.presets.find((p) => p.id === profile.activePresetId) ??
      profile.presets[0] ??
      {}
    );
  }
  return profile;
}

function buildPrompt(userPrompt: string, styleProfile?: StyleProfile): string {
  if (!styleProfile) return userPrompt;
  const preset = resolveActivePreset(styleProfile);
  const parts: string[] = [];
  if (preset.artStyle) parts.push(preset.artStyle);
  if (preset.colorPalette) parts.push(preset.colorPalette);
  if (preset.moodKeywords) parts.push(preset.moodKeywords);
  if (parts.length === 0) return userPrompt;
  return `${parts.join(", ")}. ${userPrompt}`;
}

export class ImageGenerationService {
  constructor(
    private readonly apiKey: string,
    private readonly mediaService: MediaAttachmentService,
    private readonly nodeService: NodeService,
    private readonly baseUrl: string = OPENAI_DEFAULT_BASE_URL,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async generateImage(prompt: string, projectId: string) {
    const project = await this.nodeService.getNodeById(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const meta = (project.metadata as Record<string, unknown>) ?? {};
    const styleProfile = meta.styleProfile as StyleProfile | undefined;
    const fullPrompt = buildPrompt(prompt, styleProfile);

    const response = await this.fetchFn(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        response_format: "b64_json",
        size: "1024x1024",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI image generation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json: string }>;
    };
    const b64 = data.data[0].b64_json;
    const buffer = Buffer.from(b64, "base64");

    return this.mediaService.createAttachment({
      nodeId: projectId,
      projectId,
      buffer,
      filename: `generated-${Date.now()}.png`,
      mimeType: "image/png",
      metadata: { generated: true, prompt: fullPrompt },
    });
  }
}
