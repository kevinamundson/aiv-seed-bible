import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AIV_BASE_URL,
  AIV_ID,
  AIV_MANIFEST_TTL_MS,
  AIV_MANIFEST_URL,
  AIV_METADATA_URL,
  AivUnavailableError,
  aivUsxUrl,
  canonicalizeAivTranslationId,
  convertAivChapterFromUsx,
  getAivChapter,
  getAivTranslationMeta,
  injectAivTranslation,
  isAivTranslationId,
  parseAivChapterLink,
  resetAivCaches,
  type AivManifest,
} from "../../../../packages/seed-bible/seed-bible/managers/AivAdapter";
import type {
  ChapterContent,
  Translation,
} from "../../../../packages/seed-bible/seed-bible/managers/FreeUseBibleAPI";

// Excerpts of https://aivbible.kevinamundson.me/usx/{GEN,PSA}.usx (2026-11-02
// export): GEN 1–3 and PSA 3 with their book-level header paras.
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures/aiv", name), "utf8");
const GEN_USX = fixture("GEN.usx");
const PSA_USX = fixture("PSA.usx");

const MANIFEST: AivManifest = {
  id: AIV_ID,
  name: "Amundson Interpretive Version",
  shortName: "AIV",
  counts: { books: 66, chapters: 1189, verses: 31084 },
  books: [
    { usfm: "GEN", name: "Genesis", chapters: 50, verses: 1533, sha256: "g1" },
    { usfm: "PSA", name: "Psalms", chapters: 150, verses: 2461, sha256: "p1" },
  ],
};
const METADATA = {
  id: AIV_ID,
  name: "Amundson Interpretive Version",
  englishName: "Amundson Interpretive Version",
  shortName: "AIV",
  licenseNotice:
    "Amundson Interpretive Version (AIV) © 2026 Kevin Amundson. Licensed under CC BY 4.0.",
};

type Verse = Extract<ChapterContent, { type: "verse" }>;
const verses = (content: ChapterContent[]) =>
  content.filter((c): c is Verse => c.type === "verse");
const plain = (v: Verse) =>
  v.content
    .map((p) => (typeof p === "string" ? p : "text" in p ? p.text : ""))
    .join("");

describe("convertAivChapterFromUsx()", () => {
  it("paints Genesis 1–3 with the expected verse counts", () => {
    expect(
      convertAivChapterFromUsx(GEN_USX, "GEN", 1, MANIFEST).numberOfVerses
    ).toBe(31);
    expect(
      convertAivChapterFromUsx(GEN_USX, "GEN", 2, MANIFEST).numberOfVerses
    ).toBe(25);
    expect(
      convertAivChapterFromUsx(GEN_USX, "GEN", 3, MANIFEST).numberOfVerses
    ).toBe(24);
  });

  it("uses AIV identity, s1 headings, italic add and footnotes", () => {
    const chapter = convertAivChapterFromUsx(
      GEN_USX,
      "GEN",
      2,
      MANIFEST,
      METADATA
    );
    expect(chapter.translation.id).toBe(AIV_ID);
    expect(chapter.translation.name).toBe("Amundson Interpretive Version");
    expect(chapter.translation.shortName).toBe("AIV");
    expect(chapter.book.name).toBe("Genesis");

    const content = chapter.chapter.content;
    const headings = content.filter(
      (c): c is Extract<ChapterContent, { type: "heading" }> =>
        c.type === "heading" && !c.style
    );
    expect(headings.length).toBeGreaterThan(0);
    // Book-level h / toc1-3 / mt1 / rem never leak into a chapter.
    expect(JSON.stringify(content)).not.toContain("eng_aiv");
    expect(verses(content).map((v) => v.number)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1)
    );
    expect(chapter.chapter.footnotes.length).toBeGreaterThan(0);
    expect(
      verses(content).some((v) =>
        v.content.some(
          (p) => typeof p !== "string" && "add" in p && p.add === true
        )
      )
    ).toBe(true);
  });

  it("renders r as a parallel-reference heading, not verse text", () => {
    const chapter = convertAivChapterFromUsx(GEN_USX, "GEN", 1, MANIFEST);
    const refs = chapter.chapter.content.filter(
      (c) => c.type === "heading" && c.style === "r"
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const v of verses(chapter.chapter.content)) {
      expect(plain(v)).not.toMatch(/^\s*\(/);
    }
  });

  it("renders the PSA 3 superscription (d) as a hebrew_subtitle before verse 1", () => {
    const chapter = convertAivChapterFromUsx(PSA_USX, "PSA", 3, MANIFEST);
    const content = chapter.chapter.content;
    const types = content.map((c) =>
      c.type === "heading" && c.style ? `heading:${c.style}` : c.type
    );
    expect(types.slice(0, 4)).toEqual([
      "heading",
      "heading:r",
      "hebrew_subtitle",
      "verse",
    ]);
    expect(content[0]).toEqual({
      type: "heading",
      content: ["Deliver Me, O LORD!"],
    });
    expect(content[1]).toEqual({
      type: "heading",
      style: "r",
      content: ["(2 Samuel 15:13–29)"],
    });
    expect(content[2]).toEqual({
      type: "hebrew_subtitle",
      content: [
        "A Psalm of David, in his fleeing from the face of Absalom his son.",
      ],
    });
    const vs = verses(content);
    expect(vs.length).toBe(8);
    // The superscription is not folded into verse 1.
    expect(plain(vs[0]!)).not.toContain("A Psalm of David");
    // qs "Selah" stays with its verse (with its footnote marker).
    expect(plain(vs[1]!)).toContain("Selah");
    expect(
      vs[1]!.content.some((p) => typeof p !== "string" && "noteId" in p)
    ).toBe(true);
  });

  it("handles pass-4 markers: chapter-end d postscript, d holding a verse, cls colophon", () => {
    const usx = `<?xml version="1.0" encoding="UTF-8"?><usx version="3.1"><book code="HAB" style="id">eng_aiv</book>
<chapter number="3" style="c" sid="HAB 3"/>
<para style="s1">Habakkuk’s Prayer</para>
<para style="d"><verse number="1" style="v" sid="HAB 3:1"/>A prayer of Habakkuk the prophet. <verse eid="HAB 3:1"/></para>
<para style="cls"><verse number="2" style="v" sid="HAB 3:2"/>These are the generations, </para>
<para style="p" vid="HAB 3:2">in the day. <verse eid="HAB 3:2"/></para>
<para style="d">For the one directing. </para>
<chapter eid="HAB 3"/></usx>`;
    const m: AivManifest = {
      ...MANIFEST,
      books: [
        { usfm: "HAB", name: "Habakkuk", chapters: 3, verses: 56, sha256: "h" },
      ],
    };
    const content = convertAivChapterFromUsx(usx, "HAB", 3, m).chapter.content;
    expect(content.map((c) => c.type)).toEqual([
      "heading",
      "verse",
      "verse",
      "hebrew_subtitle",
    ]);
    const vs = verses(content);
    expect(vs.map((v) => v.number)).toEqual([1, 2]);
    expect(plain(vs[0]!)).toContain("A prayer of Habakkuk");
    expect(plain(vs[1]!)).toBe("These are the generations, in the day. ");
    expect(content[3]).toEqual({
      type: "hebrew_subtitle",
      content: ["For the one directing. "],
    });
  });

  it("links adjacent chapters with eng_aiv API links", () => {
    const gen1 = convertAivChapterFromUsx(GEN_USX, "GEN", 1, MANIFEST);
    const gen2 = convertAivChapterFromUsx(GEN_USX, "GEN", 2, MANIFEST);
    expect(gen1.nextChapterApiLink).toBe(`/api/${AIV_ID}/GEN/2.json`);
    expect(gen2.previousChapterApiLink).toBe(`/api/${AIV_ID}/GEN/1.json`);
    expect(parseAivChapterLink(gen1.nextChapterApiLink!)).toEqual({
      book: "GEN",
      chapter: 2,
    });
    expect(parseAivChapterLink("/api/BLB-Draft/JHN/3.json")).toEqual({
      book: "JHN",
      chapter: 3,
    });
  });
});

describe("AIV ids", () => {
  it("maps the discontinued BLB-Draft ids to eng_aiv", () => {
    expect(isAivTranslationId(AIV_ID)).toBe(true);
    expect(isAivTranslationId("BLB-Draft")).toBe(true);
    expect(
      isAivTranslationId("blb-draft://local/api/BLB-Draft/books.json")
    ).toBe(true);
    expect(isAivTranslationId("BSB")).toBe(false);
    expect(isAivTranslationId("BLB")).toBe(false);
    expect(canonicalizeAivTranslationId("BLB-Draft")).toBe(AIV_ID);
    expect(canonicalizeAivTranslationId("BSB")).toBe("BSB");
  });

  it("injects one AIV row with the DRAFT badge and drops cached BLB-Draft rows", () => {
    const cached = [
      { id: "BLB-Draft", name: "Berean Literal Bible (Draft)" },
      { id: "BSB", name: "Berean Standard Bible" },
    ] as Translation[];
    const result = injectAivTranslation(cached, METADATA, MANIFEST);
    expect(result.map((t) => t.id)).toEqual([AIV_ID, "BSB"]);
    const row = result[0] as Translation & {
      draft?: boolean;
      draftBadge?: string;
    };
    expect(row.name).toBe("Amundson Interpretive Version");
    expect(row.shortName).toBe("AIV");
    expect(row.draft).toBe(true);
    expect(row.draftBadge).toBe("DRAFT");
    expect(row.licenseNotice).toContain("CC BY 4.0");
  });

  it("defaults to aivbible.kevinamundson.me", () => {
    expect(AIV_BASE_URL).toBe("https://aivbible.kevinamundson.me");
    expect(aivUsxUrl("gen")).toBe(
      "https://aivbible.kevinamundson.me/usx/GEN.usx"
    );
    expect(getAivTranslationMeta().website).toBe(
      "https://aivbible.kevinamundson.me/"
    );
  });
});

describe("getAivChapter() — live from aivbible", () => {
  const originalFetch = globalThis.fetch;
  let manifest: AivManifest;
  let usx: string;
  let fetchMock: ReturnType<typeof vi.fn>;
  let clock = 1_000_000;

  const ok = (body: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(body),
    });

  beforeEach(() => {
    resetAivCaches();
    manifest = structuredClone(MANIFEST);
    usx = GEN_USX;
    clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    fetchMock = vi.fn((url: string) => {
      if (url === AIV_MANIFEST_URL) return ok(JSON.stringify(manifest));
      if (url === AIV_METADATA_URL) return ok(JSON.stringify(METADATA));
      if (url === aivUsxUrl("GEN")) return ok(usx);
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(""),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetAivCaches();
  });

  const usxCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url === aivUsxUrl("GEN")).length;

  it("fetches USX from aivbible with HTTP revalidation", async () => {
    const chapter = await getAivChapter("GEN", 1);
    expect(chapter.numberOfVerses).toBe(31);
    expect(fetchMock).toHaveBeenCalledWith(aivUsxUrl("GEN"), {
      cache: "no-cache",
    });
    expect(fetchMock).toHaveBeenCalledWith(AIV_MANIFEST_URL, {
      cache: "no-cache",
    });
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url).startsWith(AIV_BASE_URL)).toBe(true);
    }
  });

  it("reuses a book only while the manifest sha256 is unchanged", async () => {
    await getAivChapter("GEN", 1);
    await getAivChapter("GEN", 2);
    expect(usxCalls()).toBe(1);

    // aivbible publishes an edit: new sha256 in manifest.json.
    manifest.books[0]!.sha256 = "g2";
    clock += AIV_MANIFEST_TTL_MS + 1;
    await getAivChapter("GEN", 1);
    expect(usxCalls()).toBe(2);
  });

  it("throws (no stale fallback) when aivbible is unreachable", async () => {
    await getAivChapter("GEN", 1);
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("offline"))
    );
    manifest.books[0]!.sha256 = "g2";
    clock += AIV_MANIFEST_TTL_MS + 1;
    await expect(getAivChapter("GEN", 1)).rejects.toBeInstanceOf(
      AivUnavailableError
    );
  });

  it("throws on HTTP errors from aivbible", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === AIV_MANIFEST_URL
        ? Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve(""),
          })
        : ok("{}")
    );
    await expect(getAivChapter("GEN", 1)).rejects.toThrow(
      /aivbible\.kevinamundson\.me/
    );
  });
});
