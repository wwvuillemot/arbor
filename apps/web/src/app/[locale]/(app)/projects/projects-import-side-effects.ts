import { arrayBufferToBase64 } from "@/lib/base64";
import { getMediaAttachmentUrl } from "@/lib/media-url";

import {
  createImportHealingContext,
  deriveImportHealingUpdates,
  replaceImportedImageSourceUrls,
  rewriteImportedNoteContent,
  type ImportDirectoryEntry,
  type ImportHealingNode,
} from "./projects-page-helpers";

type ImportedMediaFile = Pick<File, "name" | "type" | "arrayBuffer">;

type LoadedNode = { content?: unknown } | null | undefined;

type UpdateNodeContentInput = {
  id: string;
  content: Record<string, unknown>;
};

export async function uploadImportedImagesAndPatchNodes<
  TFile extends ImportedMediaFile,
>({
  nodeMap,
  projectId,
  imageFilesByNotePath,
  uploadImportedMedia,
  fetchNodeById,
  updateNodeContent,
}: {
  nodeMap: Record<string, string>;
  projectId: string;
  imageFilesByNotePath: Map<string, Map<string, TFile>>;
  uploadImportedMedia: (input: {
    nodeId: string;
    projectId: string;
    filename: string;
    mimeType: string;
    data: string;
    createdBy: string;
  }) => Promise<{ id: string }>;
  fetchNodeById: (input: { id: string }) => Promise<LoadedNode>;
  updateNodeContent: (input: UpdateNodeContentInput) => Promise<unknown>;
}): Promise<void> {
  for (const [notePath, imageFiles] of imageFilesByNotePath.entries()) {
    const nodeId = nodeMap[notePath];
    if (!nodeId) {
      continue;
    }

    const uploadedImageUrlsBySourcePath = new Map<string, string>();
    for (const [localPath, file] of imageFiles.entries()) {
      try {
        const imageBuffer = await file.arrayBuffer();
        const imageBase64 = arrayBufferToBase64(imageBuffer);
        const attachment = await uploadImportedMedia({
          nodeId,
          projectId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          data: imageBase64,
          createdBy: "user:import",
        });
        uploadedImageUrlsBySourcePath.set(
          localPath,
          getMediaAttachmentUrl(attachment.id),
        );
      } catch (error) {
        console.error("Image upload failed for", file.name, error);
      }
    }

    if (uploadedImageUrlsBySourcePath.size === 0) {
      continue;
    }

    try {
      const node = await fetchNodeById({ id: nodeId });
      if (!node?.content) {
        continue;
      }

      const { changed, content: patchedContent } =
        replaceImportedImageSourceUrls(
          node.content,
          uploadedImageUrlsBySourcePath,
        );

      if (!changed || !patchedContent) {
        continue;
      }

      await updateNodeContent({ id: nodeId, content: patchedContent });
    } catch {
      // Non-fatal
    }
  }
}

export async function patchImportedNodeInternalLinks({
  nodeMap,
  entries,
  fetchNodeById,
  updateNodeContent,
}: {
  nodeMap: Record<string, string>;
  entries: ImportDirectoryEntry[];
  fetchNodeById: (input: { id: string }) => Promise<LoadedNode>;
  updateNodeContent: (input: UpdateNodeContentInput) => Promise<unknown>;
}): Promise<void> {
  for (const { path } of entries) {
    const nodeId = nodeMap[path];
    if (!nodeId) {
      continue;
    }

    try {
      const node = await fetchNodeById({ id: nodeId });
      if (!node?.content) {
        continue;
      }

      const { changed, content: patchedContent } = rewriteImportedNoteContent(
        node.content,
        [path],
        nodeMap,
      );

      if (changed && patchedContent) {
        await updateNodeContent({ id: nodeId, content: patchedContent });
      }
    } catch {
      // Non-fatal — skip this node
    }
  }
}

export async function healImportedProjectInternalLinks({
  projectId,
  importedNodeMap,
  fetchDescendants,
  updateNodeContent,
}: {
  projectId: string;
  importedNodeMap: Record<string, string>;
  fetchDescendants: (input: { nodeId: string }) => Promise<ImportHealingNode[]>;
  updateNodeContent: (input: UpdateNodeContentInput) => Promise<unknown>;
}): Promise<void> {
  const descendants = await fetchDescendants({ nodeId: projectId });
  const importHealingContext = createImportHealingContext(
    projectId,
    descendants,
    importedNodeMap,
  );

  for (const importHealingUpdate of deriveImportHealingUpdates(
    descendants,
    importHealingContext,
  )) {
    await updateNodeContent({
      id: importHealingUpdate.id,
      content: importHealingUpdate.content,
    });
  }
}
