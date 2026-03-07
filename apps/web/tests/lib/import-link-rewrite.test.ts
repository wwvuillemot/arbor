import { describe, expect, it } from "vitest";
import { rewriteImportedInternalHref } from "@/lib/import-link-rewrite";

describe("rewriteImportedInternalHref", () => {
  describe("standard note links with extensions", () => {
    it.each([
      [
        "draft.md",
        "project/notes/source.md",
        "project/notes/draft.md",
        "id-md",
      ],
      [
        "draft.txt",
        "project/notes/source.md",
        "project/notes/draft.txt",
        "id-txt",
      ],
      [
        "../guides/intro.markdown#top",
        "project/notes/source.md",
        "project/guides/intro.markdown",
        "id-markdown",
      ],
      [
        "../guides/intro.mdown",
        "project/notes/source.md",
        "project/guides/intro.mdown",
        "id-mdown",
      ],
      [
        "../guides/intro.mkd",
        "project/notes/source.md",
        "project/guides/intro.mkd",
        "id-mkd",
      ],
      [
        "../guides/intro.mdx",
        "project/notes/source.md",
        "project/guides/intro.mdx",
        "id-mdx",
      ],
    ])(
      "rewrites %s",
      (href, importingNotePath, mappedNodePath, expectedNodeId) => {
        const nodeMap = { [mappedNodePath]: expectedNodeId };
        expect(
          rewriteImportedInternalHref(href, importingNotePath, nodeMap),
        ).toBe(`?node=${expectedNodeId}`);
      },
    );
  });

  describe("extensionless links", () => {
    it("resolves a sibling note without extension", () => {
      const nodeMap = { "project/notes/draft.md": "id-draft" };
      expect(
        rewriteImportedInternalHref(
          "draft",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-draft");
    });

    it("resolves a relative extensionless link across folders", () => {
      const nodeMap = { "project/guides/intro.md": "id-intro" };
      expect(
        rewriteImportedInternalHref(
          "../guides/intro",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-intro");
    });

    it("resolves extensionless link with .txt target", () => {
      const nodeMap = { "project/notes/draft.txt": "id-txt" };
      expect(
        rewriteImportedInternalHref(
          "draft",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-txt");
    });
  });

  describe("basename fallback (Obsidian wikilinks)", () => {
    it("resolves a bare page name link by filename match", () => {
      const nodeMap = { "project/chapters/chapter-one.md": "id-ch1" };
      expect(
        rewriteImportedInternalHref(
          "chapter-one.md",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-ch1");
    });

    it("resolves a wikilink-style href (Page Name.md) by basename", () => {
      const nodeMap = { "project/chars/Character Bio.md": "id-char" };
      expect(
        rewriteImportedInternalHref(
          "Character Bio.md",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-char");
    });

    it("resolves a bare page name without extension by basename", () => {
      const nodeMap = { "project/notes/my-note.md": "id-note" };
      expect(
        rewriteImportedInternalHref(
          "my-note",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-note");
    });

    it("returns null when basename fallback is ambiguous across folders", () => {
      const nodeMap = {
        "project/places/bedlam.md": "id-place-bedlam",
        "project/characters/bedlam.md": "id-character-bedlam",
      };

      expect(
        rewriteImportedInternalHref(
          "bedlam",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBeNull();
    });
  });

  describe("normalized path handling", () => {
    it("resolves URI-encoded paths with spaces", () => {
      const nodeMap = {
        "project/guides/Character Bio.md": "id-character-bio",
      };

      expect(
        rewriteImportedInternalHref(
          "../guides/Character%20Bio.md",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-character-bio");
    });

    it("resolves folder-style note targets", () => {
      const nodeMap = { "project/guides/intro.md": "id-intro" };

      expect(
        rewriteImportedInternalHref(
          "../guides/intro/",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-intro");
    });

    it("normalizes repeated separators and dot segments", () => {
      const nodeMap = { "project/guides/intro.md": "id-intro" };

      expect(
        rewriteImportedInternalHref(
          "../guides//./intro",
          "project/notes/source.md",
          nodeMap,
        ),
      ).toBe("?node=id-intro");
    });
  });

  describe("unresolved links", () => {
    it("returns null (not '#') for unresolved links — preserving original href", () => {
      expect(
        rewriteImportedInternalHref(
          "missing.markdown",
          "project/notes/source.md",
          {},
        ),
      ).toBeNull();
    });

    it("returns null for extensionless links with no match", () => {
      expect(
        rewriteImportedInternalHref(
          "missing-page",
          "project/notes/source.md",
          {},
        ),
      ).toBeNull();
    });
  });

  describe("links that should not be rewritten", () => {
    it("leaves external http links unchanged", () => {
      expect(
        rewriteImportedInternalHref(
          "https://example.com/reference.md",
          "project/notes/source.md",
          { "project/notes/reference.md": "id-reference" },
        ),
      ).toBeNull();
    });

    it("leaves image links unchanged", () => {
      expect(
        rewriteImportedInternalHref(
          "./diagram.png",
          "project/notes/source.md",
          {},
        ),
      ).toBeNull();
    });

    it("leaves already-resolved ?node= links unchanged", () => {
      expect(
        rewriteImportedInternalHref(
          "?node=some-uuid",
          "project/notes/source.md",
          {},
        ),
      ).toBeNull();
    });

    it("leaves # anchor unchanged", () => {
      expect(
        rewriteImportedInternalHref("#", "project/notes/source.md", {}),
      ).toBeNull();
    });

    it("leaves other binary file links unchanged", () => {
      expect(
        rewriteImportedInternalHref(
          "./report.pdf",
          "project/notes/source.md",
          {},
        ),
      ).toBeNull();
    });
  });
});
