import { describe, expect, it, vi } from "vitest";

import {
  applyPreparedImportDirectoryOutcome,
  prepareImportDirectoryWorkflow,
} from "@/app/[locale]/(app)/projects/projects-import-directory";
import type { ImportDirectoryFile } from "@/app/[locale]/(app)/projects/projects-page-helpers";

describe("prepareImportDirectoryWorkflow", () => {
  it("returns an unsupported outcome when no importable files are found", async () => {
    const files: ImportDirectoryFile[] = [
      {
        name: "field-guide.pdf",
        webkitRelativePath: "maps/field-guide.pdf",
        text: async () => "",
      },
    ];

    const outcome = await prepareImportDirectoryWorkflow({
      allFiles: files,
      preferredProjectName: "",
      createNewProject: false,
    });

    expect(outcome.kind).toBe("unsupported");
    if (outcome.kind !== "unsupported") {
      throw new Error("Expected unsupported outcome");
    }
    expect(outcome.message).toContain("No supported files found among 1 files");
  });

  it("returns an import-now outcome for a single root directory", async () => {
    const files: ImportDirectoryFile[] = [
      {
        name: "readme.md",
        webkitRelativePath: "pathfinders/readme.md",
        text: async () => "# Pathfinders",
      },
    ];

    const outcome = await prepareImportDirectoryWorkflow({
      allFiles: files,
      preferredProjectName: "",
      createNewProject: true,
    });

    expect(outcome.kind).toBe("import-now");
    if (outcome.kind !== "import-now") {
      throw new Error("Expected import-now outcome");
    }
    expect(outcome.projectName).toBe("pathfinders");
    expect(outcome.createNewProject).toBe(true);
    expect(outcome.entries.map((entry) => entry.path)).toEqual([
      "pathfinders/readme.md",
    ]);
  });

  it("returns a prompt outcome when multiple roots require a name", async () => {
    const files: ImportDirectoryFile[] = [
      {
        name: "alpha.md",
        webkitRelativePath: "alpha/alpha.md",
        text: async () => "# Alpha",
      },
      {
        name: "beta.md",
        webkitRelativePath: "beta/beta.md",
        text: async () => "# Beta",
      },
    ];

    const outcome = await prepareImportDirectoryWorkflow({
      allFiles: files,
      preferredProjectName: "Imported Notes",
      createNewProject: false,
    });

    expect(outcome.kind).toBe("prompt-for-project-name");
    if (outcome.kind !== "prompt-for-project-name") {
      throw new Error("Expected prompt-for-project-name outcome");
    }
    expect(outcome.initialProjectName).toBe("Imported Notes");
    expect(outcome.createNewProject).toBe(false);
    expect(outcome.entries).toHaveLength(2);
  });
});

describe("applyPreparedImportDirectoryOutcome", () => {
  it("shows an error message for unsupported imports", async () => {
    const showUnsupportedImportMessage = vi.fn();
    const runImport = vi.fn();
    const setPendingImportRequest = vi.fn();

    await applyPreparedImportDirectoryOutcome({
      outcome: {
        kind: "unsupported",
        message: "No supported files found",
        entries: [],
        imageFilesByNotePath: new Map(),
      },
      runImport,
      showUnsupportedImportMessage,
      setPendingImportRequest,
    });

    expect(showUnsupportedImportMessage).toHaveBeenCalledWith(
      "No supported files found",
    );
    expect(runImport).not.toHaveBeenCalled();
    expect(setPendingImportRequest).not.toHaveBeenCalled();
  });

  it("runs the import immediately when the outcome is import-now", async () => {
    const imageFilesByNotePath = new Map<
      string,
      Map<string, ImportDirectoryFile>
    >();
    const runImport = vi.fn(async () => {});
    const showUnsupportedImportMessage = vi.fn();
    const setPendingImportRequest = vi.fn();

    await applyPreparedImportDirectoryOutcome({
      outcome: {
        kind: "import-now",
        projectName: "Imported Notes",
        createNewProject: true,
        entries: [{ path: "incoming/readme.md", content: { type: "doc" } }],
        imageFilesByNotePath,
      },
      runImport,
      showUnsupportedImportMessage,
      setPendingImportRequest,
    });

    expect(runImport).toHaveBeenCalledWith(
      "Imported Notes",
      [{ path: "incoming/readme.md", content: { type: "doc" } }],
      imageFilesByNotePath,
      { createNewProject: true },
    );
    expect(showUnsupportedImportMessage).not.toHaveBeenCalled();
    expect(setPendingImportRequest).not.toHaveBeenCalled();
  });

  it("stores pending import state when the outcome needs a project name", async () => {
    const imageFilesByNotePath = new Map<
      string,
      Map<string, ImportDirectoryFile>
    >();
    const runImport = vi.fn();
    const showUnsupportedImportMessage = vi.fn();
    const setPendingImportRequest = vi.fn();

    await applyPreparedImportDirectoryOutcome({
      outcome: {
        kind: "prompt-for-project-name",
        initialProjectName: "Imported Notes",
        createNewProject: false,
        entries: [{ path: "incoming/readme.md", content: { type: "doc" } }],
        imageFilesByNotePath,
      },
      runImport,
      showUnsupportedImportMessage,
      setPendingImportRequest,
    });

    expect(setPendingImportRequest).toHaveBeenCalledWith({
      entries: [{ path: "incoming/readme.md", content: { type: "doc" } }],
      imageFilesByNotePath,
      initialProjectName: "Imported Notes",
      createNewProject: false,
    });
    expect(runImport).not.toHaveBeenCalled();
    expect(showUnsupportedImportMessage).not.toHaveBeenCalled();
  });
});
