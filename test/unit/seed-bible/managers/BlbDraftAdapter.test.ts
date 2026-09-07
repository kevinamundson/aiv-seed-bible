import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLB_DRAFT_ID,
  canonicalizeBlbDraftTranslationId,
  convertBlbDraftChapterFromUsx,
  getBlbDraftTranslationMeta,
  isBlbDraftTranslationId,
} from "../../../../packages/seed-bible/seed-bible/managers/BlbDraftAdapter";

const GEN_USX = readFileSync(
  resolve(process.cwd(), "data/blb-draft/usx/GEN.usx"),
  "utf8"
);

const MANIFEST = {
  id: BLB_DRAFT_ID,
  displayName: "Berean Literal Bible (Draft)",
  books: [
    {
      usfm: "GEN",
      nameAsReceived: "Genesis",
      chapters: 50,
      verses: 1533,
    },
  ],
  stats: { verses: 31084 },
};

describe("convertBlbDraftChapterFromUsx()", () => {
  it("paints Genesis 2 from bundled USX (not Chapter unavailable)", () => {
    const chapter = convertBlbDraftChapterFromUsx(GEN_USX, "GEN", 2, MANIFEST);

    expect(chapter.translation.id).toBe(BLB_DRAFT_ID);
    expect(chapter.translation.name).toBe(getBlbDraftTranslationMeta().name);
    expect(chapter.chapter.number).toBe(2);
    expect(chapter.numberOfVerses).toBe(25);

    const headings = chapter.chapter.content.filter(
      (c): c is Extract<typeof c, { type: "heading" }> => c.type === "heading"
    );
    expect(headings.map((h) => h.content[0])).toEqual([
      "The Seventh Day",
      "Man and Woman in the Garden",
    ]);

    const verses = chapter.chapter.content.filter(
      (c): c is Extract<typeof c, { type: "verse" }> => c.type === "verse"
    );
    expect(verses.map((v) => v.number)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1)
    );

    const v1 = verses[0]!;
    const v1Text = v1.content
      .map((part) =>
        typeof part === "string" ? part : "text" in part ? part.text : ""
      )
      .join("");
    expect(v1Text).toContain(
      "And the heavens and the earth were finished, and all their host."
    );

    // Added words and footnotes must survive — empty/broken conversion is what
    // surfaces as the reader "Chapter unavailable" error state.
    expect(chapter.chapter.footnotes.length).toBeGreaterThan(0);
    const v4 = verses[3]!;
    expect(
      v4.content.some(
        (part) => typeof part !== "string" && "add" in part && part.add === true
      )
    ).toBe(true);
  });

  it("keeps Genesis 1 and 2 boundaries distinct", () => {
    const gen1 = convertBlbDraftChapterFromUsx(GEN_USX, "GEN", 1, MANIFEST);
    const gen2 = convertBlbDraftChapterFromUsx(GEN_USX, "GEN", 2, MANIFEST);

    expect(gen1.numberOfVerses).toBe(31);
    expect(gen2.numberOfVerses).toBe(25);
    expect(gen1.nextChapterApiLink).toBe(`/api/${BLB_DRAFT_ID}/GEN/2.json`);
    expect(gen2.previousChapterApiLink).toBe(`/api/${BLB_DRAFT_ID}/GEN/1.json`);
  });
});

describe("isBlbDraftTranslationId / canonicalizeBlbDraftTranslationId", () => {
  it("recognizes the plain id and legacy blb-draft books.json URL", () => {
    expect(isBlbDraftTranslationId(BLB_DRAFT_ID)).toBe(true);
    expect(
      isBlbDraftTranslationId("blb-draft://local/api/BLB-Draft/books.json")
    ).toBe(true);
    expect(isBlbDraftTranslationId("NIV")).toBe(false);
    expect(isBlbDraftTranslationId("BLB")).toBe(false);
  });

  it("collapses legacy URL path segments to BLB-Draft", () => {
    expect(canonicalizeBlbDraftTranslationId(BLB_DRAFT_ID)).toBe(BLB_DRAFT_ID);
    expect(
      canonicalizeBlbDraftTranslationId(
        "blb-draft://local/api/BLB-Draft/books.json"
      )
    ).toBe(BLB_DRAFT_ID);
    expect(canonicalizeBlbDraftTranslationId("NIV")).toBe("NIV");
  });
});
