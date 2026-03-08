import {
  buildUnsupportedImportDirectoryMessage,
  deriveImportDirectoryHandling,
  prepareImportDirectoryEntries,
  summarizeImportFileExtensions,
  type ImportDirectoryEntry,
  type ImportDirectoryFile,
} from "./projects-page-helpers";

type ImportPreparationBase<TFile extends ImportDirectoryFile> = {
  entries: ImportDirectoryEntry[];
  imageFilesByNotePath: Map<string, Map<string, TFile>>;
};

export type PendingImportDirectoryRequest<TFile extends ImportDirectoryFile> = {
  entries: ImportDirectoryEntry[];
  imageFilesByNotePath: Map<string, Map<string, TFile>>;
  initialProjectName: string;
  createNewProject: boolean;
};

export type PreparedImportDirectoryOutcome<TFile extends ImportDirectoryFile> =
  | ({ kind: "unsupported"; message: string } & ImportPreparationBase<TFile>)
  | ({
      kind: "import-now";
      projectName: string;
      createNewProject: boolean;
    } & ImportPreparationBase<TFile>)
  | ({
      kind: "prompt-for-project-name";
      initialProjectName: string;
      createNewProject: boolean;
    } & ImportPreparationBase<TFile>);

export async function prepareImportDirectoryWorkflow<
  TFile extends ImportDirectoryFile,
>({
  allFiles,
  preferredProjectName,
  createNewProject,
}: {
  allFiles: TFile[];
  preferredProjectName: string;
  createNewProject: boolean;
}): Promise<PreparedImportDirectoryOutcome<TFile>> {
  const { entries, imageFilesByNotePath, rootDirectoryNames } =
    await prepareImportDirectoryEntries(allFiles);

  if (entries.length === 0) {
    const extensionSummary = summarizeImportFileExtensions(allFiles);
    return {
      kind: "unsupported",
      message: buildUnsupportedImportDirectoryMessage(
        allFiles.length,
        extensionSummary,
      ),
      entries,
      imageFilesByNotePath,
    };
  }

  const importDirectoryHandling = deriveImportDirectoryHandling(
    preferredProjectName,
    rootDirectoryNames,
    createNewProject,
  );

  if (importDirectoryHandling.kind === "import-now") {
    return {
      kind: "import-now",
      projectName: importDirectoryHandling.projectName,
      createNewProject: importDirectoryHandling.createNewProject,
      entries,
      imageFilesByNotePath,
    };
  }

  return {
    kind: "prompt-for-project-name",
    initialProjectName: importDirectoryHandling.initialProjectName,
    createNewProject: importDirectoryHandling.createNewProject,
    entries,
    imageFilesByNotePath,
  };
}

export async function applyPreparedImportDirectoryOutcome<
  TFile extends ImportDirectoryFile,
>({
  outcome,
  runImport,
  showUnsupportedImportMessage,
  setPendingImportRequest,
}: {
  outcome: PreparedImportDirectoryOutcome<TFile>;
  runImport: (
    projectName: string,
    entries: ImportDirectoryEntry[],
    imageFilesByNotePath: Map<string, Map<string, TFile>>,
    options?: { createNewProject?: boolean },
  ) => Promise<void>;
  showUnsupportedImportMessage: (message: string) => void;
  setPendingImportRequest: (
    pendingImportRequest: PendingImportDirectoryRequest<TFile>,
  ) => void;
}): Promise<void> {
  if (outcome.kind === "unsupported") {
    showUnsupportedImportMessage(outcome.message);
    return;
  }

  if (outcome.kind === "import-now") {
    await runImport(
      outcome.projectName,
      outcome.entries,
      outcome.imageFilesByNotePath,
      { createNewProject: outcome.createNewProject },
    );
    return;
  }

  setPendingImportRequest({
    entries: outcome.entries,
    imageFilesByNotePath: outcome.imageFilesByNotePath,
    initialProjectName: outcome.initialProjectName,
    createNewProject: outcome.createNewProject,
  });
}
