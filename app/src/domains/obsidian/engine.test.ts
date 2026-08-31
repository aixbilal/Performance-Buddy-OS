import { describe, it, expect } from "vitest";
import {
  matchNoteByReference,
  noteMatchRank,
  resolveLink,
  searchNotes,
} from "./engine";
import type { NoteLink, ObsidianNote } from "./types";

const note = (relativePath: string, title = "", existsOnDisk = true): ObsidianNote => ({
  id: `id_${relativePath}`,
  relativePath,
  title: title || (relativePath.split("/").pop() ?? relativePath).replace(/\.md$/, ""),
  filename: relativePath.split("/").pop() ?? relativePath,
  modifiedAt: "1",
  sizeBytes: 10,
  existsOnDisk,
  indexedAt: "1",
});

const NOTES = [
  note("Binary Trees.md", "Binary Trees"),
  note("React/Hooks.md", "Hooks"),
  note("React/Effects deep dive.md", "Effects deep dive"),
  note("Notes/Ideas.md", "Ideas"),
];

describe("obsidian engine — deterministic lexical search only", () => {
  it("ranks exact over prefix over contains", () => {
    expect(noteMatchRank(note("Hooks.md", "Hooks"), "hooks")).toBe(0);
    expect(noteMatchRank(note("Hooksy.md", "Hooksy"), "hooks")).toBe(1);
    expect(noteMatchRank(note("React/Hooks.md", "Hooks"), "react")).toBe(1); // path prefix
    expect(noteMatchRank(note("A/Hooks.md", "Hooks"), "ook")).toBe(2);
    expect(noteMatchRank(note("Zzz.md", "Zzz"), "hooks")).toBe(-1);
  });

  it("searchNotes filters then orders by rank then path", () => {
    const r = searchNotes(NOTES, "react");
    expect(r.map((n) => n.relativePath)).toEqual([
      "React/Effects deep dive.md",
      "React/Hooks.md",
    ]);
  });

  it("an empty query returns everything, path-sorted", () => {
    expect(searchNotes(NOTES, "").length).toBe(4);
    expect(searchNotes(NOTES, "   ")[0].relativePath).toBe("Binary Trees.md");
  });

  it("resolveLink distinguishes ok / stale / unindexed", () => {
    const link = (relativePath: string): NoteLink => ({
      id: "l",
      topicId: "kt1",
      relativePath,
      title: "t",
      linkedAt: "1",
    });
    expect(resolveLink(link("Binary Trees.md"), NOTES)).toBe("ok");
    expect(
      resolveLink(link("Gone.md"), [...NOTES, note("Gone.md", "Gone", false)]),
    ).toBe("stale");
    expect(resolveLink(link("Never.md"), NOTES)).toBe("unindexed");
  });

  it("matchNoteByReference resolves a free-text pointer to an indexed note", () => {
    expect(matchNoteByReference(NOTES, "React/Hooks.md")?.relativePath).toBe("React/Hooks.md");
    expect(matchNoteByReference(NOTES, "hooks")?.relativePath).toBe("React/Hooks.md");
    expect(matchNoteByReference(NOTES, "Ideas")?.relativePath).toBe("Notes/Ideas.md");
    expect(matchNoteByReference(NOTES, "does not exist")).toBeUndefined();
  });
});
