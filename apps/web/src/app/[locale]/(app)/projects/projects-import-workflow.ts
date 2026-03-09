import type { ImportDirectoryEntry } from "./projects-page-helpers";

type ImportedProjectResult = {
  projectId: string;
  nodeMap: Record<string, string>;
};

type ImageFilesByNotePath = Map<string, Map<string, File>>;

type AsyncStep = () => Promise<unknown>;

export type RunProjectImportWorkflowParams = {
  projectName: string;
  entries: ImportDirectoryEntry[];
  imageFilesByNotePath: ImageFilesByNotePath;
  createNewProject?: boolean;
  getImportTargetNodeId: (createNewProject?: boolean) => string | undefined;
  importDirectory: (input: {
    projectName: string;
    parentNodeId: string | undefined;
    files: ImportDirectoryEntry[];
  }) => Promise<ImportedProjectResult>;
  uploadImagesAndPatch: RunImportedProjectPostProcessingParams["uploadImagesAndPatch"];
  patchInternalLinks: RunImportedProjectPostProcessingParams["patchInternalLinks"];
  healImportedInternalLinks: RunImportedProjectPostProcessingParams["healImportedInternalLinks"];
  setCurrentProject: RunImportedProjectPostProcessingParams["setCurrentProject"];
  invalidateAllProjects: AsyncStep;
  invalidateChildren: AsyncStep;
  invalidateNodeById: AsyncStep;
  invalidateDescendants: AsyncStep;
  navigateToProjects: () => void;
};

export type RunImportedProjectPostProcessingParams = {
  importResult: ImportedProjectResult;
  entries: ImportDirectoryEntry[];
  imageFilesByNotePath: ImageFilesByNotePath;
  uploadImagesAndPatch: (
    nodeMap: Record<string, string>,
    projectId: string,
    imageFilesByNotePath: ImageFilesByNotePath,
  ) => Promise<void>;
  patchInternalLinks: (
    nodeMap: Record<string, string>,
    entries: ImportDirectoryEntry[],
  ) => Promise<void>;
  healImportedInternalLinks: (
    projectId: string,
    importedNodeMap: Record<string, string>,
  ) => Promise<void>;
  setCurrentProject: (projectId: string) => Promise<unknown>;
  invalidateAllProjects: AsyncStep;
  invalidateChildren: AsyncStep;
  invalidateNodeById: AsyncStep;
  invalidateDescendants: AsyncStep;
  navigateToProjects: () => void;
};

export async function runProjectImportWorkflow({
  projectName,
  entries,
  imageFilesByNotePath,
  createNewProject,
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
}: RunProjectImportWorkflowParams): Promise<void> {
  const importTargetNodeId = getImportTargetNodeId(createNewProject);

  const importResult = await importDirectory({
    projectName,
    parentNodeId: importTargetNodeId,
    files: entries,
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
}

export async function runImportedProjectPostProcessing({
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
}: RunImportedProjectPostProcessingParams): Promise<void> {
  if (imageFilesByNotePath.size > 0) {
    await uploadImagesAndPatch(
      importResult.nodeMap,
      importResult.projectId,
      imageFilesByNotePath,
    );
    await invalidateNodeById();
  }

  await patchInternalLinks(importResult.nodeMap, entries);
  await invalidateDescendants();
  await healImportedInternalLinks(importResult.projectId, importResult.nodeMap);
  await setCurrentProject(importResult.projectId);
  await Promise.all([
    invalidateAllProjects(),
    invalidateChildren(),
    invalidateNodeById(),
    invalidateDescendants(),
  ]);
  navigateToProjects();
}
