/**
 * BLB-Draft USX → Seed Bible chapter adapter.
 *
 * Id is exactly `BLB-Draft` (not HelloAO `BLB`). Chapters are converted from USX:
 *   preferred https://aivbible.kevinamundson.me/usx/{BOOK}.usx
 *   fallback  https://cdn.jsdelivr.net/gh/kevinamundson/aiv-seed-bible@develop/data/blb-draft/usx/{BOOK}.usx
 *
 * Marker map:
 *   char@add → FormattedText { text, add: true }
 *   char@wj  → FormattedText { text, wordsOfJesus: true }
 *   note@f / note@x → chapter.footnotes (apparatus — not AIV notes)
 */
import type {
  ChapterContent,
  ChapterFootnote,
  FormattedText,
  Translation,
  TranslationBook,
  TranslationBookChapter,
  TranslationBooks,
  VerseFootnoteReference,
} from "./FreeUseBibleAPI";

export const BLB_DRAFT_ID = "BLB-Draft";
export const BLB_DRAFT_NAME = "Berean Literal Bible (Draft)";
export const BLB_DRAFT_BADGE = "DRAFT";

const PREFERRED_USX_BASE = "https://aivbible.kevinamundson.me/usx";
const FALLBACK_USX_BASE =
  "https://cdn.jsdelivr.net/gh/kevinamundson/aiv-seed-bible@develop/data/blb-draft/usx";
const FALLBACK_MANIFEST_URL =
  "https://cdn.jsdelivr.net/gh/kevinamundson/aiv-seed-bible@develop/data/blb-draft/manifest.json";
const PREFERRED_MANIFEST_URL =
  "https://aivbible.kevinamundson.me/manifest.json";

type VersePart = string | FormattedText | VerseFootnoteReference;

type ManifestBook = {
  usfm: string;
  nameAsReceived: string;
  chapters: number;
  verses?: number;
};

type BlbManifest = {
  id?: string;
  displayName?: string;
  fetchedAtAmericaChicago?: string;
  fetchedAtUtc?: string;
  sourceUrl?: string;
  sourcePage?: string;
  books: ManifestBook[];
  stats?: { verses?: number };
  counts?: { verses?: number };
};

const EMBEDDED_MANIFEST_BOOKS: ManifestBook[] = [
  {
    "usfm": "GEN",
    "nameAsReceived": "Genesis",
    "chapters": 50,
    "verses": 1533
  },
  {
    "usfm": "EXO",
    "nameAsReceived": "Exodus",
    "chapters": 40,
    "verses": 1213
  },
  {
    "usfm": "LEV",
    "nameAsReceived": "Leviticus",
    "chapters": 27,
    "verses": 859
  },
  {
    "usfm": "NUM",
    "nameAsReceived": "Numbers",
    "chapters": 36,
    "verses": 1288
  },
  {
    "usfm": "DEU",
    "nameAsReceived": "Deuteronomy",
    "chapters": 34,
    "verses": 959
  },
  {
    "usfm": "JOS",
    "nameAsReceived": "Joshua",
    "chapters": 24,
    "verses": 658
  },
  {
    "usfm": "JDG",
    "nameAsReceived": "Judges",
    "chapters": 21,
    "verses": 618
  },
  {
    "usfm": "RUT",
    "nameAsReceived": "Ruth",
    "chapters": 4,
    "verses": 85
  },
  {
    "usfm": "1SA",
    "nameAsReceived": "1 Samuel",
    "chapters": 31,
    "verses": 810
  },
  {
    "usfm": "2SA",
    "nameAsReceived": "2 Samuel",
    "chapters": 24,
    "verses": 695
  },
  {
    "usfm": "1KI",
    "nameAsReceived": "1 Kings",
    "chapters": 22,
    "verses": 816
  },
  {
    "usfm": "2KI",
    "nameAsReceived": "2 Kings",
    "chapters": 25,
    "verses": 719
  },
  {
    "usfm": "1CH",
    "nameAsReceived": "1 Chronicles",
    "chapters": 29,
    "verses": 942
  },
  {
    "usfm": "2CH",
    "nameAsReceived": "2 Chronicles",
    "chapters": 36,
    "verses": 822
  },
  {
    "usfm": "EZR",
    "nameAsReceived": "Ezra",
    "chapters": 10,
    "verses": 280
  },
  {
    "usfm": "NEH",
    "nameAsReceived": "Nehemiah",
    "chapters": 13,
    "verses": 406
  },
  {
    "usfm": "EST",
    "nameAsReceived": "Esther",
    "chapters": 10,
    "verses": 167
  },
  {
    "usfm": "JOB",
    "nameAsReceived": "Job",
    "chapters": 42,
    "verses": 1070
  },
  {
    "usfm": "PSA",
    "nameAsReceived": "Psalm",
    "chapters": 150,
    "verses": 2460
  },
  {
    "usfm": "PRO",
    "nameAsReceived": "Proverbs",
    "chapters": 31,
    "verses": 915
  },
  {
    "usfm": "ECC",
    "nameAsReceived": "Ecclesiastes",
    "chapters": 12,
    "verses": 222
  },
  {
    "usfm": "SNG",
    "nameAsReceived": "Song of Solomon",
    "chapters": 8,
    "verses": 117
  },
  {
    "usfm": "ISA",
    "nameAsReceived": "Isaiah",
    "chapters": 66,
    "verses": 1292
  },
  {
    "usfm": "JER",
    "nameAsReceived": "Jeremiah",
    "chapters": 52,
    "verses": 1364
  },
  {
    "usfm": "LAM",
    "nameAsReceived": "Lamentations",
    "chapters": 5,
    "verses": 154
  },
  {
    "usfm": "EZK",
    "nameAsReceived": "Ezekiel",
    "chapters": 48,
    "verses": 1273
  },
  {
    "usfm": "DAN",
    "nameAsReceived": "Daniel",
    "chapters": 12,
    "verses": 357
  },
  {
    "usfm": "HOS",
    "nameAsReceived": "Hosea",
    "chapters": 14,
    "verses": 197
  },
  {
    "usfm": "JOL",
    "nameAsReceived": "Joel",
    "chapters": 3,
    "verses": 73
  },
  {
    "usfm": "AMO",
    "nameAsReceived": "Amos",
    "chapters": 9,
    "verses": 146
  },
  {
    "usfm": "OBA",
    "nameAsReceived": "Obadiah",
    "chapters": 1,
    "verses": 21
  },
  {
    "usfm": "JON",
    "nameAsReceived": "Jonah",
    "chapters": 4,
    "verses": 48
  },
  {
    "usfm": "MIC",
    "nameAsReceived": "Micah",
    "chapters": 7,
    "verses": 105
  },
  {
    "usfm": "NAM",
    "nameAsReceived": "Nahum",
    "chapters": 3,
    "verses": 47
  },
  {
    "usfm": "HAB",
    "nameAsReceived": "Habakkuk",
    "chapters": 3,
    "verses": 56
  },
  {
    "usfm": "ZEP",
    "nameAsReceived": "Zephaniah",
    "chapters": 3,
    "verses": 53
  },
  {
    "usfm": "HAG",
    "nameAsReceived": "Haggai",
    "chapters": 2,
    "verses": 38
  },
  {
    "usfm": "ZEC",
    "nameAsReceived": "Zechariah",
    "chapters": 14,
    "verses": 210
  },
  {
    "usfm": "MAL",
    "nameAsReceived": "Malachi",
    "chapters": 4,
    "verses": 55
  },
  {
    "usfm": "MAT",
    "nameAsReceived": "Matthew",
    "chapters": 28,
    "verses": 1068
  },
  {
    "usfm": "MRK",
    "nameAsReceived": "Mark",
    "chapters": 16,
    "verses": 673
  },
  {
    "usfm": "LUK",
    "nameAsReceived": "Luke",
    "chapters": 24,
    "verses": 1149
  },
  {
    "usfm": "JHN",
    "nameAsReceived": "John",
    "chapters": 21,
    "verses": 878
  },
  {
    "usfm": "ACT",
    "nameAsReceived": "Acts",
    "chapters": 28,
    "verses": 1003
  },
  {
    "usfm": "ROM",
    "nameAsReceived": "Romans",
    "chapters": 16,
    "verses": 432
  },
  {
    "usfm": "1CO",
    "nameAsReceived": "1 Corinthians",
    "chapters": 16,
    "verses": 437
  },
  {
    "usfm": "2CO",
    "nameAsReceived": "2 Corinthians",
    "chapters": 13,
    "verses": 257
  },
  {
    "usfm": "GAL",
    "nameAsReceived": "Galatians",
    "chapters": 6,
    "verses": 149
  },
  {
    "usfm": "EPH",
    "nameAsReceived": "Ephesians",
    "chapters": 6,
    "verses": 155
  },
  {
    "usfm": "PHP",
    "nameAsReceived": "Philippians",
    "chapters": 4,
    "verses": 104
  },
  {
    "usfm": "COL",
    "nameAsReceived": "Colossians",
    "chapters": 4,
    "verses": 95
  },
  {
    "usfm": "1TH",
    "nameAsReceived": "1 Thessalonians",
    "chapters": 5,
    "verses": 89
  },
  {
    "usfm": "2TH",
    "nameAsReceived": "2 Thessalonians",
    "chapters": 3,
    "verses": 47
  },
  {
    "usfm": "1TI",
    "nameAsReceived": "1 Timothy",
    "chapters": 6,
    "verses": 113
  },
  {
    "usfm": "2TI",
    "nameAsReceived": "2 Timothy",
    "chapters": 4,
    "verses": 83
  },
  {
    "usfm": "TIT",
    "nameAsReceived": "Titus",
    "chapters": 3,
    "verses": 46
  },
  {
    "usfm": "PHM",
    "nameAsReceived": "Philemon",
    "chapters": 1,
    "verses": 25
  },
  {
    "usfm": "HEB",
    "nameAsReceived": "Hebrews",
    "chapters": 13,
    "verses": 303
  },
  {
    "usfm": "JAS",
    "nameAsReceived": "James",
    "chapters": 5,
    "verses": 108
  },
  {
    "usfm": "1PE",
    "nameAsReceived": "1 Peter",
    "chapters": 5,
    "verses": 105
  },
  {
    "usfm": "2PE",
    "nameAsReceived": "2 Peter",
    "chapters": 3,
    "verses": 61
  },
  {
    "usfm": "1JN",
    "nameAsReceived": "1 John",
    "chapters": 5,
    "verses": 105
  },
  {
    "usfm": "2JN",
    "nameAsReceived": "2 John",
    "chapters": 1,
    "verses": 13
  },
  {
    "usfm": "3JN",
    "nameAsReceived": "3 John",
    "chapters": 1,
    "verses": 14
  },
  {
    "usfm": "JUD",
    "nameAsReceived": "Jude",
    "chapters": 1,
    "verses": 25
  },
  {
    "usfm": "REV",
    "nameAsReceived": "Revelation",
    "chapters": 22,
    "verses": 404
  }
];

const EMBEDDED_MANIFEST: BlbManifest = {
  id: BLB_DRAFT_ID,
  displayName: BLB_DRAFT_NAME,
  fetchedAtAmericaChicago: "1 Sep 2026, 10:43 AM CDT",
  fetchedAtUtc: "2026-09-01T15:43:00Z",
  sourceUrl: "https://literalbible.com/blb.docx",
  sourcePage: "https://literalbible.com/",
  books: EMBEDDED_MANIFEST_BOOKS,
  stats: { verses: 31084 },
  counts: { verses: 31084 },
};

const usxCache = new Map<string, string>();
let manifestPromise: Promise<BlbManifest> | null = null;

export function isBlbDraftTranslationId(id: string): boolean {
  return id === BLB_DRAFT_ID;
}

export function getBlbDraftTranslationMeta(
  manifest?: BlbManifest | null
): Translation {
  const totalVerses =
    manifest?.stats?.verses ??
    manifest?.counts?.verses ??
    31084;
  return {
    id: BLB_DRAFT_ID,
    name: BLB_DRAFT_NAME,
    englishName: BLB_DRAFT_NAME,
    shortName: BLB_DRAFT_ID,
    website: manifest?.sourcePage || "https://literalbible.com/",
    licenseUrl: manifest?.sourcePage || "https://literalbible.com/",
    licenseNotice:
      "Snapshot of Berean Literal Bible (Draft). Not a finished-translation claim. Source: literalbible.com.",
    language: "eng",
    languageEnglishName: "English",
    textDirection: "ltr",
    availableFormats: ["json"],
    listOfBooksApiLink: `/api/${BLB_DRAFT_ID}/books.json`,
    numberOfBooks: 66,
    totalNumberOfChapters: 1189,
    totalNumberOfVerses: totalVerses,
    // Extended fields consumed by the picker badge (optional on catalog rows).
    ...( {
      draft: true,
      draftBadge: BLB_DRAFT_BADGE,
    } as Partial<Translation>),
  } as Translation;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function looksLikeUsx(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<usx") ||
    trimmed.includes("<usx ")
  );
}

function looksLikeJsonObject(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{");
}

export async function loadBlbDraftManifest(): Promise<BlbManifest> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      for (const url of [PREFERRED_MANIFEST_URL, FALLBACK_MANIFEST_URL]) {
        const text = await fetchText(url);
        if (text && looksLikeJsonObject(text)) {
          try {
            return JSON.parse(text) as BlbManifest;
          } catch {
            // try next
          }
        }
      }
      // Prefer the embedded corpus map so books/chapter counts work even when
      // both remote manifests are unreachable (bot wall / CDN lag).
      return EMBEDDED_MANIFEST;
    })();
  }
  return manifestPromise;
}

async function loadUsx(book: string): Promise<string> {
  const key = book.toUpperCase();
  const cached = usxCache.get(key);
  if (cached) {
    return cached;
  }

  for (const base of [PREFERRED_USX_BASE, FALLBACK_USX_BASE]) {
    const text = await fetchText(`${base}/${encodeURIComponent(key)}.usx`);
    if (text && looksLikeUsx(text)) {
      usxCache.set(key, text);
      return text;
    }
  }

  throw new Error(
    `BLB-Draft USX unavailable for ${key} (preferred host and jsDelivr fallback both failed)`
  );
}

/** Minimal XML element for USX walking (isomorphic — no DOM required). */
type XmlEl = {
  tag: string;
  attrs: Record<string, string>;
  children: Array<XmlEl | string>;
};

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1]] = m[3] ?? m[4] ?? "";
  }
  return attrs;
}

function parseXml(xml: string): XmlEl {
  const cleaned = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const root: XmlEl = { tag: "#root", attrs: {}, children: [] };
  const stack: XmlEl[] = [root];
  const tokenRe = /([^<]+)|<\/([:\w.-]+)\s*>|<([:\w.-]+)([^>]*?)\s*\/>|<([:\w.-]+)([^>]*?)\s*>/g;
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(cleaned))) {
    if (token[1] !== undefined) {
      const text = token[1];
      if (text) {
        stack[stack.length - 1]!.children.push(text);
      }
      continue;
    }
    if (token[2] !== undefined) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    if (token[3] !== undefined) {
      const el: XmlEl = {
        tag: token[3],
        attrs: parseAttrs(token[4] ?? ""),
        children: [],
      };
      stack[stack.length - 1]!.children.push(el);
      continue;
    }
    if (token[5] !== undefined) {
      const el: XmlEl = {
        tag: token[5],
        attrs: parseAttrs(token[6] ?? ""),
        children: [],
      };
      stack[stack.length - 1]!.children.push(el);
      stack.push(el);
    }
  }
  const usx = root.children.find(
    (c): c is XmlEl => typeof c !== "string" && c.tag === "usx"
  );
  return usx ?? root;
}

function collectPlain(node: XmlEl | string): string {
  if (typeof node === "string") {
    return node;
  }
  return node.children.map(collectPlain).join("");
}

function parseChar(el: XmlEl): FormattedText {
  const text = collectPlain(el);
  const style = el.attrs.style;
  const fmt: FormattedText = { text };
  if (style === "add") {
    fmt.add = true;
  }
  if (style === "wj") {
    fmt.wordsOfJesus = true;
  }
  return fmt;
}

function convertChapterFromUsx(
  usxXml: string,
  book: string,
  chapterNum: number,
  manifest: BlbManifest
): TranslationBookChapter {
  const root = parseXml(usxXml);
  const content: ChapterContent[] = [];
  const footnotes: ChapterFootnote[] = [];
  let noteIdCounter = 1;
  let currentVerse: number | null = null;
  let verseContent: VersePart[] = [];
  let inChapter = false;

  const flushVerse = () => {
    if (currentVerse !== null) {
      const merged: VersePart[] = [];
      for (const item of verseContent) {
        if (
          typeof item === "string" &&
          merged.length > 0 &&
          typeof merged[merged.length - 1] === "string"
        ) {
          merged[merged.length - 1] =
            (merged[merged.length - 1] as string) + item;
        } else {
          merged.push(item);
        }
      }
      content.push({
        type: "verse",
        number: currentVerse,
        content: merged,
      });
    }
    currentVerse = null;
    verseContent = [];
  };

  const addText = (s: string | undefined | null) => {
    if (s && currentVerse !== null) {
      verseContent.push(s);
    }
  };

  for (const node of root.children) {
    if (typeof node === "string") {
      continue;
    }
    if (node.tag === "chapter") {
      flushVerse();
      const n = Number(node.attrs.number || 0);
      if (node.attrs.eid !== undefined) {
        if (inChapter) {
          break;
        }
        inChapter = false;
        continue;
      }
      if (n === chapterNum) {
        inChapter = true;
      } else if (inChapter) {
        break;
      } else {
        inChapter = false;
      }
      continue;
    }
    if (!inChapter || node.tag !== "para") {
      continue;
    }
    const style = node.attrs.style || "";
    if (style === "s" || style === "s1" || style === "s2" || style === "ms" || style === "mr") {
      flushVerse();
      const heading = collectPlain(node).trim();
      if (heading) {
        content.push({ type: "heading", content: [heading] });
      }
      continue;
    }

    // Walk para children in document order (text nodes + elements).
    // Leading text on the para itself (before first child) is rare but handled.
    // Our parser puts all text in children array interleaved.
    for (const child of node.children) {
      if (typeof child === "string") {
        addText(child);
        continue;
      }
      if (child.tag === "verse") {
        if (child.attrs.eid !== undefined) {
          continue;
        }
        flushVerse();
        currentVerse = Number(child.attrs.number);
        verseContent = [];
        continue;
      }
      if (child.tag === "char") {
        if (currentVerse !== null) {
          verseContent.push(parseChar(child));
        }
        continue;
      }
      if (child.tag === "note") {
        const noteStyle = child.attrs.style;
        const caller = child.attrs.caller || "+";
        const body = collectPlain(child).trim();
        const noteId = noteIdCounter++;
        footnotes.push({
          noteId,
          caller,
          text: body,
        });
        if (currentVerse !== null) {
          verseContent.push({ noteId });
        }
        // noteStyle f vs x both land in footnotes (apparatus).
        void noteStyle;
        continue;
      }
      addText(collectPlain(child));
    }
  }
  flushVerse();

  const translation = getBlbDraftTranslationMeta(manifest);
  const bookMeta = manifest.books.find((b) => b.usfm === book);
  const bookName = bookMeta?.nameAsReceived ?? book;
  const numberOfChapters = bookMeta?.chapters ?? chapterNum;
  const numberOfVerses = content.filter((c) => c.type === "verse").length;

  const bookInfo: TranslationBook = {
    id: book,
    name: bookName,
    commonName: bookName,
    title: bookName,
    order: manifest.books.findIndex((b) => b.usfm === book) + 1 || 1,
    numberOfChapters,
    firstChapterNumber: 1,
    firstChapterApiLink: `/api/${BLB_DRAFT_ID}/${book}/1.json`,
    lastChapterNumber: numberOfChapters,
    lastChapterApiLink: `/api/${BLB_DRAFT_ID}/${book}/${numberOfChapters}.json`,
    totalNumberOfVerses: bookMeta?.verses ?? numberOfVerses,
  };

  const prev =
    chapterNum > 1
      ? {
          previousChapterApiLink: `/api/${BLB_DRAFT_ID}/${book}/${chapterNum - 1}.json`,
          previousChapterAudioLinks: null,
        }
      : { previousChapterApiLink: null, previousChapterAudioLinks: null };

  let nextChapterApiLink: string | null = null;
  let nextBookId: string | null = null;
  if (chapterNum < numberOfChapters) {
    nextChapterApiLink = `/api/${BLB_DRAFT_ID}/${book}/${chapterNum + 1}.json`;
  } else {
    const idx = manifest.books.findIndex((b) => b.usfm === book);
    if (idx >= 0 && idx + 1 < manifest.books.length) {
      nextBookId = manifest.books[idx + 1]!.usfm;
      nextChapterApiLink = `/api/${BLB_DRAFT_ID}/${nextBookId}/1.json`;
    }
  }

  return {
    translation,
    book: bookInfo,
    thisChapterLink: `/api/${BLB_DRAFT_ID}/${book}/${chapterNum}.json`,
    thisChapterAudioLinks: {},
    nextChapterApiLink,
    nextChapterAudioLinks: nextChapterApiLink ? {} : null,
    ...prev,
    numberOfVerses,
    chapter: {
      number: chapterNum,
      content,
      footnotes,
    },
  };
}

export async function getBlbDraftBooks(): Promise<TranslationBooks> {
  const manifest = await loadBlbDraftManifest();
  const translation = getBlbDraftTranslationMeta(manifest);
  const books: TranslationBook[] = (manifest.books.length
    ? manifest.books
    : []
  ).map((b, index) => ({
    id: b.usfm,
    name: b.nameAsReceived,
    commonName: b.nameAsReceived,
    title: b.nameAsReceived,
    order: index + 1,
    numberOfChapters: b.chapters,
    firstChapterNumber: 1,
    firstChapterApiLink: `/api/${BLB_DRAFT_ID}/${b.usfm}/1.json`,
    lastChapterNumber: b.chapters,
    lastChapterApiLink: `/api/${BLB_DRAFT_ID}/${b.usfm}/${b.chapters}.json`,
    totalNumberOfVerses: b.verses ?? 0,
  }));

  return { translation, books };
}

export async function getBlbDraftChapter(
  book: string,
  chapter: number | string
): Promise<TranslationBookChapter> {
  const chapterNum = Number(chapter);
  if (!Number.isFinite(chapterNum) || chapterNum < 1) {
    throw new Error(`Invalid BLB-Draft chapter: ${chapter}`);
  }
  const bookId = book.toUpperCase();
  const [manifest, usx] = await Promise.all([
    loadBlbDraftManifest(),
    loadUsx(bookId),
  ]);
  return convertChapterFromUsx(usx, bookId, chapterNum, manifest);
}

/** Inject BLB-Draft into a HelloAO catalog list if missing. */
export function injectBlbDraftTranslation(
  translations: Translation[],
  manifest?: BlbManifest | null
): Translation[] {
  if (translations.some((t) => t.id === BLB_DRAFT_ID)) {
    return translations;
  }
  const meta = getBlbDraftTranslationMeta(manifest);
  // Prefer English group placement: put near the front of eng list by unshift.
  return [meta, ...translations];
}
