import { NodeService } from "./node-service";
import {
  buildImportedFolderNodeParams,
  buildImportedNoteNodeParams,
  collectSortedDirectoryPaths,
  createImportPathToNodeIdMap,
  getImportedPathParent,
  getSortedImportableNoteFiles,
} from "./node-directory-import-helpers";

export interface ImportedDirectoryFile {
  path: string;
  content?: unknown;
}

export interface ImportDirectoryParams {
  projectName: string;
  parentNodeId?: string;
  files: ImportedDirectoryFile[];
}

export interface ImportDirectoryResult {
  imported: number;
  folders: number;
  projectId: string;
  importTargetNodeId: string;
  nodeMap: Record<string, string>;
}

export class NodeDirectoryImportService {
  constructor(private readonly nodeService: NodeService = new NodeService()) {}

  async importDirectory(
    params: ImportDirectoryParams,
  ): Promise<ImportDirectoryResult> {
    const { importTargetNodeId, projectId } =
      await this.resolveImportTarget(params);
    const pathToNodeId = createImportPathToNodeIdMap(
      params.files,
      importTargetNodeId,
    );

    const sortedDirectoryPaths = collectSortedDirectoryPaths(params.files);
    await this.createFolders(
      sortedDirectoryPaths,
      pathToNodeId,
      importTargetNodeId,
    );

    const { importedCount, nodeMap } = await this.createNotes(
      params.files,
      pathToNodeId,
      importTargetNodeId,
    );

    return {
      imported: importedCount,
      folders: sortedDirectoryPaths.length,
      projectId,
      importTargetNodeId,
      nodeMap,
    };
  }

  private async resolveImportTarget(
    params: ImportDirectoryParams,
  ): Promise<{ importTargetNodeId: string; projectId: string }> {
    if (params.parentNodeId) {
      return {
        importTargetNodeId: params.parentNodeId,
        projectId: await this.nodeService.getProjectIdForNode(
          params.parentNodeId,
        ),
      };
    }

    const projectNode = await this.nodeService.createNode({
      type: "project",
      name: params.projectName,
      parentId: null,
      createdBy: "user:import",
      updatedBy: "user:import",
    });

    return {
      importTargetNodeId: projectNode.id,
      projectId: projectNode.id,
    };
  }

  private async createFolders(
    sortedDirectoryPaths: string[],
    pathToNodeId: Map<string, string>,
    importTargetNodeId: string,
  ): Promise<void> {
    for (const directoryPath of sortedDirectoryPaths) {
      const parentPath = getImportedPathParent(directoryPath);
      const parentId = pathToNodeId.get(parentPath) ?? importTargetNodeId;

      const folderNode = await this.nodeService.createNode(
        buildImportedFolderNodeParams(directoryPath, parentId),
      );

      pathToNodeId.set(directoryPath, folderNode.id);
    }
  }

  private async createNotes(
    files: ImportedDirectoryFile[],
    pathToNodeId: Map<string, string>,
    importTargetNodeId: string,
  ): Promise<{ importedCount: number; nodeMap: Record<string, string> }> {
    const nodeMap: Record<string, string> = {};
    const positionCounters = new Map<string, number>();
    let importedCount = 0;

    const sortedFiles = getSortedImportableNoteFiles(files);

    for (const file of sortedFiles) {
      const parentPath = getImportedPathParent(file.path);
      const parentId = pathToNodeId.get(parentPath) ?? importTargetNodeId;
      const notePosition = positionCounters.get(parentId) ?? 0;
      positionCounters.set(parentId, notePosition + 1);

      try {
        const noteNode = await this.nodeService.createNode(
          buildImportedNoteNodeParams(file, parentId, notePosition),
        );

        nodeMap[file.path] = noteNode.id;
        importedCount++;
      } catch (error) {
        console.error(`Failed to import file ${file.path}:`, error);
      }
    }

    return { importedCount, nodeMap };
  }
}
