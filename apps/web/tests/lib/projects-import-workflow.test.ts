import { describe, expect, it, vi } from "vitest";

import {
  runImportedProjectPostProcessing,
  runProjectImportWorkflow,
} from "@/app/[locale]/(app)/projects/projects-import-workflow";

function createTrackedAsyncStep(stepName: string, executionSteps: string[]) {
  return vi.fn(async () => {
    executionSteps.push(stepName);
  });
}

describe("runImportedProjectPostProcessing", () => {
  it("resolves the import target and runs post-processing after import", async () => {
    const executionSteps: string[] = [];
    const entries = [{ path: "incoming/readme.md", content: { type: "doc" } }];
    const imageFilesByNotePath = new Map<string, Map<string, File>>();

    const getImportTargetNodeId = vi.fn((createNewProject?: boolean) => {
      executionSteps.push(`getImportTargetNodeId:${String(createNewProject)}`);
      return "folder-1";
    });
    const importDirectory = vi.fn(async () => {
      executionSteps.push("importDirectory");
      return {
        projectId: "proj-imported",
        nodeMap: { "incoming/readme.md": "node-readme" },
      };
    });
    const uploadImagesAndPatch = createTrackedAsyncStep(
      "uploadImagesAndPatch",
      executionSteps,
    );
    const patchInternalLinks = createTrackedAsyncStep(
      "patchInternalLinks",
      executionSteps,
    );
    const healImportedInternalLinks = createTrackedAsyncStep(
      "healImportedInternalLinks",
      executionSteps,
    );
    const setCurrentProject = vi.fn(async (projectId: string) => {
      executionSteps.push(`setCurrentProject:${projectId}`);
    });
    const invalidateAllProjects = createTrackedAsyncStep(
      "invalidateAllProjects",
      executionSteps,
    );
    const invalidateChildren = createTrackedAsyncStep(
      "invalidateChildren",
      executionSteps,
    );
    const invalidateNodeById = createTrackedAsyncStep(
      "invalidateNodeById",
      executionSteps,
    );
    const invalidateDescendants = createTrackedAsyncStep(
      "invalidateDescendants",
      executionSteps,
    );
    const navigateToProjects = vi.fn(() => {
      executionSteps.push("navigateToProjects");
    });

    await runProjectImportWorkflow({
      projectName: "Imported Readme",
      entries,
      imageFilesByNotePath,
      createNewProject: true,
      getImportTargetNodeId,
      importDirectory,
      uploadImagesAndPatch,
      patchInternalLinks,
      healImportedInternalLinks,
      setCurrentProject,
      invalidateAllProjects,
      invalidateChildren,
      invalidateNodeById,
      invalidateDescendants,
      navigateToProjects,
    });

    expect(getImportTargetNodeId).toHaveBeenCalledWith(true);
    expect(importDirectory).toHaveBeenCalledWith({
      projectName: "Imported Readme",
      parentNodeId: "folder-1",
      files: entries,
    });
    expect(uploadImagesAndPatch).not.toHaveBeenCalled();
    expect(executionSteps).toEqual([
      "getImportTargetNodeId:true",
      "importDirectory",
      "patchInternalLinks",
      "invalidateDescendants",
      "healImportedInternalLinks",
      "setCurrentProject:proj-imported",
      "invalidateAllProjects",
      "invalidateChildren",
      "invalidateNodeById",
      "invalidateDescendants",
      "navigateToProjects",
    ]);
  });

  it("uploads images before link patching and finalizes the imported project", async () => {
    const executionSteps: string[] = [];
    const importResult = {
      projectId: "proj-imported",
      nodeMap: { "incoming/map.md": "node-map" },
    };
    const entries = [{ path: "incoming/map.md", content: { type: "doc" } }];
    const imageFilesByNotePath = new Map([
      [
        "incoming/map.md",
        new Map([
          [
            "./map.png",
            new File(["image-bytes"], "map.png", { type: "image/png" }),
          ],
        ]),
      ],
    ]);

    const uploadImagesAndPatch = createTrackedAsyncStep(
      "uploadImagesAndPatch",
      executionSteps,
    );
    const patchInternalLinks = createTrackedAsyncStep(
      "patchInternalLinks",
      executionSteps,
    );
    const healImportedInternalLinks = createTrackedAsyncStep(
      "healImportedInternalLinks",
      executionSteps,
    );
    const setCurrentProject = vi.fn(async (projectId: string) => {
      executionSteps.push(`setCurrentProject:${projectId}`);
    });
    const invalidateAllProjects = createTrackedAsyncStep(
      "invalidateAllProjects",
      executionSteps,
    );
    const invalidateChildren = createTrackedAsyncStep(
      "invalidateChildren",
      executionSteps,
    );
    const invalidateNodeById = createTrackedAsyncStep(
      "invalidateNodeById",
      executionSteps,
    );
    const invalidateDescendants = createTrackedAsyncStep(
      "invalidateDescendants",
      executionSteps,
    );
    const navigateToProjects = vi.fn(() => {
      executionSteps.push("navigateToProjects");
    });

    await runImportedProjectPostProcessing({
      importResult,
      entries,
      imageFilesByNotePath,
      uploadImagesAndPatch,
      patchInternalLinks,
      healImportedInternalLinks,
      setCurrentProject,
      invalidateAllProjects,
      invalidateChildren,
      invalidateNodeById,
      invalidateDescendants,
      navigateToProjects,
    });

    expect(uploadImagesAndPatch).toHaveBeenCalledWith(
      importResult.nodeMap,
      "proj-imported",
      imageFilesByNotePath,
    );
    expect(patchInternalLinks).toHaveBeenCalledWith(
      importResult.nodeMap,
      entries,
    );
    expect(healImportedInternalLinks).toHaveBeenCalledWith(
      "proj-imported",
      importResult.nodeMap,
    );
    expect(setCurrentProject).toHaveBeenCalledWith("proj-imported");
    expect(executionSteps).toEqual([
      "uploadImagesAndPatch",
      "invalidateNodeById",
      "patchInternalLinks",
      "invalidateDescendants",
      "healImportedInternalLinks",
      "setCurrentProject:proj-imported",
      "invalidateAllProjects",
      "invalidateChildren",
      "invalidateNodeById",
      "invalidateDescendants",
      "navigateToProjects",
    ]);
  });

  it("skips the image follow-up branch when the import has no images", async () => {
    const executionSteps: string[] = [];
    const importResult = {
      projectId: "proj-imported",
      nodeMap: { "incoming/readme.md": "node-readme" },
    };
    const entries = [{ path: "incoming/readme.md", content: { type: "doc" } }];
    const imageFilesByNotePath = new Map<string, Map<string, File>>();

    const uploadImagesAndPatch = createTrackedAsyncStep(
      "uploadImagesAndPatch",
      executionSteps,
    );
    const patchInternalLinks = createTrackedAsyncStep(
      "patchInternalLinks",
      executionSteps,
    );
    const healImportedInternalLinks = createTrackedAsyncStep(
      "healImportedInternalLinks",
      executionSteps,
    );
    const setCurrentProject = vi.fn(async () => {
      executionSteps.push("setCurrentProject");
    });
    const invalidateAllProjects = createTrackedAsyncStep(
      "invalidateAllProjects",
      executionSteps,
    );
    const invalidateChildren = createTrackedAsyncStep(
      "invalidateChildren",
      executionSteps,
    );
    const invalidateNodeById = createTrackedAsyncStep(
      "invalidateNodeById",
      executionSteps,
    );
    const invalidateDescendants = createTrackedAsyncStep(
      "invalidateDescendants",
      executionSteps,
    );
    const navigateToProjects = vi.fn(() => {
      executionSteps.push("navigateToProjects");
    });

    await runImportedProjectPostProcessing({
      importResult,
      entries,
      imageFilesByNotePath,
      uploadImagesAndPatch,
      patchInternalLinks,
      healImportedInternalLinks,
      setCurrentProject,
      invalidateAllProjects,
      invalidateChildren,
      invalidateNodeById,
      invalidateDescendants,
      navigateToProjects,
    });

    expect(uploadImagesAndPatch).not.toHaveBeenCalled();
    expect(invalidateNodeById).toHaveBeenCalledTimes(1);
    expect(invalidateDescendants).toHaveBeenCalledTimes(2);
    expect(executionSteps).toEqual([
      "patchInternalLinks",
      "invalidateDescendants",
      "healImportedInternalLinks",
      "setCurrentProject",
      "invalidateAllProjects",
      "invalidateChildren",
      "invalidateNodeById",
      "invalidateDescendants",
      "navigateToProjects",
    ]);
  });
});
