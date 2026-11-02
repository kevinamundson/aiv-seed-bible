/**
 * AIV (Amundson Interpretive Version, `eng_aiv`) USX → Seed Bible adapter.
 *
 * Single source of truth: https://aivbible.kevinamundson.me (Cloudflare Pages,
 * repo kevinamundson/aiv-text). Nothing is bundled; every book is fetched at
 * runtime from `${AIV_BASE_URL}/usx/{BOOK}.usx`, and the translation name and
 * license come from `${AIV_BASE_URL}/metadata.json`.
 *
 * Freshness (edits on aivbible show up without a Seed Bible redeploy):
 *  - Every request uses `cache: "no-cache"`, so the browser HTTP cache always
 *    revalidates with the server's ETag (aivbible already sends
 *    `Cache-Control: public, max-age=0, must-revalidate`).
 *  - `manifest.json` (sha256 per book) is re-checked at most every
 *    `AIV_MANIFEST_TTL_MS`; an in-memory USX copy is only reused while its
 *    sha256 still matches the manifest.
 *  - The service worker does not cache cross-origin aivbible requests, and
 *    nothing is persisted to IndexedDB/localStorage except the picker row.
 *  - If aivbible is unreachable the chapter load throws (reader error state);
 *    there is no bundled or stale fallback copy of the text.
 *
 * Marker map:
 *   para@s/s1/s2/ms/mr/qa → heading
 *   para@r               → heading with style "r" (parallel passage refs)
 *   para@d               → hebrew_subtitle (Psalm superscriptions and chapter-end
 *                          postscripts); a `d` holding a verse (HAB 3:1) is that verse
 *   para@cls             → verse text (colophons, e.g. GEN 2:4, PSA 72:20)
 *   para@h/toc1-3/mt1/rem/ide → ignored (book-level, before chapter 1)
 *   char@add → FormattedText { text, add: true } (italic)
 *   char@wj  → FormattedText { text, wordsOfJesus: true }
 *   note@f / note@x → chapter.footnotes
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

export const AIV_ID = "eng_aiv";
export const AIV_NAME = "Amundson Interpretive Version";
export const AIV_SHORT_NAME = "AIV";
export const AIV_BADGE = "DRAFT";
/** Synthetic endpoint that keeps AIV off the HelloAO API code paths. */
export const AIV_ENDPOINT = "aiv://live";

const DEFAULT_AIV_BASE_URL = "https://aivbible.kevinamundson.me";

/**
 * Where the AIV text lives. Override per deploy with `VITE_AIV_BASE_URL`
 * (e.g. a staging aivbible); defaults to production aivbible.
 */
export const AIV_BASE_URL: string = (
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_AIV_BASE_URL || DEFAULT_AIV_BASE_URL
).replace(/\/+$/, "");

/** How long a fetched manifest is trusted before it is revalidated. */
export const AIV_MANIFEST_TTL_MS = 60_000;

export function aivUsxUrl(book: string): string {
  return `${AIV_BASE_URL}/usx/${book.toUpperCase()}.usx`;
}
export const AIV_MANIFEST_URL = `${AIV_BASE_URL}/manifest.json`;
export const AIV_METADATA_URL = `${AIV_BASE_URL}/metadata.json`;

type VersePart = string | FormattedText | VerseFootnoteReference;

export type AivManifestBook = {
  usfm: string;
  name: string;
  shortName?: string;
  file?: string;
  chapters: number;
  verses?: number;
  sha256?: string;
};

export type AivManifest = {
  id?: string;
  name?: string;
  shortName?: string;
  status?: string;
  exportDate?: string;
  counts?: { books?: number; chapters?: number; verses?: number };
  books: AivManifestBook[];
};

export type AivMetadata = {
  id?: string;
  name?: string;
  englishName?: string;
  shortName?: string;
  language?: string;
  direction?: string;
  website?: string;
  licenseUrl?: string;
  licenseNotice?: string;
};

export class AivUnavailableError extends Error {
  constructor(what: string, cause?: unknown) {
    super(
      `AIV text is unavailable: could not load ${what} from ${AIV_BASE_URL}. ` +
        "Check your connection or try again later."
    );
    this.name = "AivUnavailableError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/**
 * Legacy ids that now mean AIV: the discontinued `BLB-Draft` id and the
 * `blb-draft://local/api/BLB-Draft/books.json` path segments older builds wrote
 * into reading URLs and saved tabs.
 */
const LEGACY_ID_RE =
  /^(?:BLB-Draft|blb-draft:\/\/[^/]*\/api\/BLB-Draft\/books\.json|aiv:\/\/[^/]*\/api\/eng_aiv\/books\.json)$/i;

export function isAivTranslationId(id: string): boolean {
  return id === AIV_ID || LEGACY_ID_RE.test(id);
}

/** Collapse legacy BLB-Draft ids/paths to `eng_aiv`. */
export function canonicalizeAivTranslationId(id: string): string {
  return isAivTranslationId(id) ? AIV_ID : id;
}

/** True for the old BLB-Draft catalog row / endpoint entries that must be dropped. */
export function isLegacyBlbDraftId(id: string): boolean {
  return id !== AIV_ID && isAivTranslationId(id);
}

export function getAivTranslationMeta(
  metadata?: AivMetadata | null,
  manifest?: AivManifest | null
): Translation {
  const name = metadata?.name || manifest?.name || AIV_NAME;
  const shortName =
    metadata?.shortName || manifest?.shortName || AIV_SHORT_NAME;
  const books = manifest?.books ?? [];
  return {
    id: AIV_ID,
    name,
    englishName: metadata?.englishName || name,
    shortName,
    website: metadata?.website || `${AIV_BASE_URL}/`,
    licenseUrl: metadata?.licenseUrl || `${AIV_BASE_URL}/LICENSE`,
    licenseNotice:
      metadata?.licenseNotice ||
      "Amundson Interpretive Version (AIV) © 2026 Kevin Amundson. Licensed under CC BY 4.0.",
    language: "eng",
    languageEnglishName: "English",
    textDirection: metadata?.direction === "rtl" ? "rtl" : "ltr",
    availableFormats: ["json"],
    listOfBooksApiLink: `/api/${AIV_ID}/books.json`,
    numberOfBooks: manifest?.counts?.books ?? (books.length || 66),
    totalNumberOfChapters:
      manifest?.counts?.chapters ??
      (books.reduce((n, b) => n + b.chapters, 0) || 1189),
    totalNumberOfVerses: manifest?.counts?.verses ?? 31084,
    // Extended fields consumed by the picker badge (optional on catalog rows).
    ...({
      draft: true,
      draftBadge: AIV_BADGE,
    } as Partial<Translation>),
  } as Translation;
}

async function fetchLive(url: string, what: string): Promise<string> {
  let response: Response;
  try {
    // `no-cache` = always revalidate with aivbible (ETag), never serve a
    // stored copy without asking.
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    throw new AivUnavailableError(what, error);
  }
  if (!response.ok) {
    throw new AivUnavailableError(`${what} (HTTP ${response.status})`);
  }
  return await response.text();
}

function looksLikeUsx(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<usx") ||
    trimmed.includes("<usx ")
  );
}

type Timed<T> = { value: T; fetchedAt: number };
let manifestState: Timed<AivManifest> | null = null;
let manifestInFlight: Promise<AivManifest> | null = null;
let metadataState: Timed<AivMetadata | null> | null = null;
let metadataInFlight: Promise<AivMetadata | null> | null = null;
const usxCache = new Map<string, { sha256: string | null; text: string }>();

const now = () => Date.now();

/** Test hook: forget every in-memory AIV copy. */
export function resetAivCaches(): void {
  manifestState = null;
  manifestInFlight = null;
  metadataState = null;
  metadataInFlight = null;
  usxCache.clear();
}

export async function loadAivManifest(): Promise<AivManifest> {
  if (manifestState && now() - manifestState.fetchedAt < AIV_MANIFEST_TTL_MS) {
    return manifestState.value;
  }
  if (!manifestInFlight) {
    manifestInFlight = (async () => {
      try {
        const text = await fetchLive(AIV_MANIFEST_URL, "manifest.json");
        let parsed: AivManifest;
        try {
          parsed = JSON.parse(text) as AivManifest;
        } catch (error) {
          throw new AivUnavailableError("manifest.json (invalid JSON)", error);
        }
        if (!Array.isArray(parsed.books) || parsed.books.length === 0) {
          throw new AivUnavailableError("manifest.json (no books)");
        }
        manifestState = { value: parsed, fetchedAt: now() };
        return parsed;
      } finally {
        manifestInFlight = null;
      }
    })();
  }
  return manifestInFlight;
}

/** Metadata only supplies names/license; constants are used if it fails. */
export async function loadAivMetadata(): Promise<AivMetadata | null> {
  if (metadataState && now() - metadataState.fetchedAt < AIV_MANIFEST_TTL_MS) {
    return metadataState.value;
  }
  if (!metadataInFlight) {
    metadataInFlight = (async () => {
      try {
        const text = await fetchLive(AIV_METADATA_URL, "metadata.json");
        const parsed = JSON.parse(text) as AivMetadata;
        metadataState = { value: parsed, fetchedAt: now() };
        return parsed;
      } catch {
        metadataState = { value: null, fetchedAt: now() };
        return null;
      } finally {
        metadataInFlight = null;
      }
    })();
  }
  return metadataInFlight;
}

async function loadUsx(book: string, manifest: AivManifest): Promise<string> {
  const key = book.toUpperCase();
  const sha256 = manifest.books.find((b) => b.usfm === key)?.sha256 ?? null;
  const cached = usxCache.get(key);
  // Reuse only while the manifest still vouches for the same file.
  if (cached && sha256 && cached.sha256 === sha256) {
    return cached.text;
  }
  const text = await fetchLive(aivUsxUrl(key), `usx/${key}.usx`);
  if (!looksLikeUsx(text)) {
    throw new AivUnavailableError(`usx/${key}.usx (not USX)`);
  }
  usxCache.set(key, { sha256, text });
  return text;
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
    const name = m[1];
    if (!name) continue;
    attrs[name] = m[3] ?? m[4] ?? "";
  }
  return attrs;
}

function parseXml(xml: string): XmlEl {
  const cleaned = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const root: XmlEl = { tag: "#root", attrs: {}, children: [] };
  const stack: XmlEl[] = [root];
  const tokenRe =
    /([^<]+)|<\/([:\w.-]+)\s*>|<([:\w.-]+)([^>]*?)\s*\/>|<([:\w.-]+)([^>]*?)\s*>/g;
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

/** Book-level / non-rendered paragraph styles (they precede chapter 1). */
const IGNORED_PARA_STYLES =
  /^(?:h|toc\d*|toca\d*|mt\d*|mte\d*|imt\d*|rem|ide|sts|restore|cl|cd)$/;
/** Section headings (incl. acrostic letters, `qa`). Parallel refs `r` are separate. */
const HEADING_PARA_STYLES = /^(?:s\d*|ms\d*|mr|sr|qa|sp)$/;

/** Heading text without any note bodies, whitespace-collapsed. */
function collectHeadingText(el: XmlEl): string {
  const walk = (node: XmlEl | string): string =>
    typeof node === "string"
      ? node
      : node.tag === "note" || node.tag === "verse"
        ? ""
        : node.children.map(walk).join("");
  return walk(el).replace(/\s+/g, " ").trim();
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

export function convertAivChapterFromUsx(
  usxXml: string,
  book: string,
  chapterNum: number,
  manifest: AivManifest,
  metadata?: AivMetadata | null
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

  const addNote = (note: XmlEl): number => {
    const noteId = noteIdCounter++;
    footnotes.push({
      noteId,
      caller: note.attrs.caller || "+",
      text: collectPlain(note).trim(),
    });
    return noteId;
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
    if (IGNORED_PARA_STYLES.test(style)) {
      continue;
    }
    if (HEADING_PARA_STYLES.test(style)) {
      flushVerse();
      const heading = collectHeadingText(node);
      if (heading) {
        content.push({ type: "heading", content: [heading] });
      }
      continue;
    }
    if (style === "r") {
      flushVerse();
      const refs = collectHeadingText(node);
      if (refs) {
        content.push({ type: "heading", content: [refs], style: "r" });
      }
      continue;
    }
    const dHoldsVerse =
      style === "d" &&
      node.children.some(
        (c) =>
          typeof c !== "string" &&
          c.tag === "verse" &&
          c.attrs.sid !== undefined
      );
    if (style === "d" && !dHoldsVerse) {
      // Psalm superscription or chapter-end postscript: its own block, never
      // part of a verse. A `d` that carries a verse (HAB 3:1) is read as
      // that verse below so the verse is not lost.
      flushVerse();
      const parts: VersePart[] = [];
      for (const child of node.children) {
        if (typeof child === "string") {
          if (child) parts.push(child);
        } else if (child.tag === "char") {
          parts.push(parseChar(child));
        } else if (child.tag === "note") {
          parts.push({ noteId: addNote(child) });
        } else if (child.tag !== "verse") {
          const text = collectPlain(child);
          if (text) parts.push(text);
        }
      }
      if (parts.length > 0) {
        content.push({ type: "hebrew_subtitle", content: parts });
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
        // f and x notes both land in footnotes (apparatus).
        const noteId = addNote(child);
        if (currentVerse !== null) {
          verseContent.push({ noteId });
        }
        continue;
      }
      addText(collectPlain(child));
    }
  }
  flushVerse();

  const translation = getAivTranslationMeta(metadata, manifest);
  const bookMeta = manifest.books.find((b) => b.usfm === book);
  const bookName = bookMeta?.name ?? book;
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
    firstChapterApiLink: `/api/${AIV_ID}/${book}/1.json`,
    lastChapterNumber: numberOfChapters,
    lastChapterApiLink: `/api/${AIV_ID}/${book}/${numberOfChapters}.json`,
    totalNumberOfVerses: bookMeta?.verses ?? numberOfVerses,
  };

  const prev =
    chapterNum > 1
      ? {
          previousChapterApiLink: `/api/${AIV_ID}/${book}/${chapterNum - 1}.json`,
          previousChapterAudioLinks: null,
          previousChapterAudioTimings: null,
        }
      : {
          previousChapterApiLink: null,
          previousChapterAudioLinks: null,
          previousChapterAudioTimings: null,
        };

  let nextChapterApiLink: string | null = null;
  let nextBookId: string | null = null;
  if (chapterNum < numberOfChapters) {
    nextChapterApiLink = `/api/${AIV_ID}/${book}/${chapterNum + 1}.json`;
  } else {
    const idx = manifest.books.findIndex((b) => b.usfm === book);
    if (idx >= 0 && idx + 1 < manifest.books.length) {
      nextBookId = manifest.books[idx + 1]!.usfm;
      nextChapterApiLink = `/api/${AIV_ID}/${nextBookId}/1.json`;
    }
  }

  return {
    translation,
    book: bookInfo,
    thisChapterLink: `/api/${AIV_ID}/${book}/${chapterNum}.json`,
    thisChapterAudioLinks: {},
    // AIV has no audio; empty/null timings satisfy the upstream shape.
    thisChapterAudioTimings: {},
    nextChapterApiLink,
    nextChapterAudioLinks: nextChapterApiLink ? {} : null,
    nextChapterAudioTimings: nextChapterApiLink ? {} : null,
    ...prev,
    numberOfVerses,
    chapter: {
      number: chapterNum,
      content,
      footnotes,
    },
  };
}

export async function getAivBooks(): Promise<TranslationBooks> {
  const [manifest, metadata] = await Promise.all([
    loadAivManifest(),
    loadAivMetadata(),
  ]);
  const translation = getAivTranslationMeta(metadata, manifest);
  const books: TranslationBook[] = manifest.books.map((b, index) => ({
    id: b.usfm,
    name: b.name,
    commonName: b.name,
    title: b.name,
    order: index + 1,
    numberOfChapters: b.chapters,
    firstChapterNumber: 1,
    firstChapterApiLink: `/api/${AIV_ID}/${b.usfm}/1.json`,
    lastChapterNumber: b.chapters,
    lastChapterApiLink: `/api/${AIV_ID}/${b.usfm}/${b.chapters}.json`,
    totalNumberOfVerses: b.verses ?? 0,
  }));

  return { translation, books };
}

export async function getAivChapter(
  book: string,
  chapter: number | string
): Promise<TranslationBookChapter> {
  const chapterNum = Number(chapter);
  if (!Number.isFinite(chapterNum) || chapterNum < 1) {
    throw new Error(`Invalid AIV chapter: ${chapter}`);
  }
  const bookId = book.toUpperCase();
  const [manifest, metadata] = await Promise.all([
    loadAivManifest(),
    loadAivMetadata(),
  ]);
  if (!manifest.books.some((b) => b.usfm === bookId)) {
    throw new Error(`AIV has no book ${bookId}`);
  }
  const usx = await loadUsx(bookId, manifest);
  return convertAivChapterFromUsx(usx, bookId, chapterNum, manifest, metadata);
}

/** Parse `/api/eng_aiv/{BOOK}/{N}.json` (or legacy BLB-Draft) links. */
export function parseAivChapterLink(
  link: string
): { book: string; chapter: number } | null {
  const match = link.match(
    /\/api\/(?:eng_aiv|BLB-Draft)\/([^/]+)\/(\d+)\.json/
  );
  if (!match) return null;
  return { book: match[1]!, chapter: Number(match[2]) };
}

/**
 * Put AIV into a HelloAO catalog list (once) and drop any discontinued
 * BLB-Draft row a returning visitor's cached catalog still carries.
 */
export function injectAivTranslation(
  translations: Translation[],
  metadata?: AivMetadata | null,
  manifest?: AivManifest | null
): Translation[] {
  const cleaned = translations.filter(
    (t) => !isLegacyBlbDraftId(t.id) && t.id !== AIV_ID
  );
  const existing = translations.find((t) => t.id === AIV_ID);
  const meta =
    metadata || manifest
      ? getAivTranslationMeta(metadata, manifest)
      : (existing ?? getAivTranslationMeta());
  return [meta, ...cleaned];
}
