# BLB-Draft USX validation (UBS CAP USX 3.x)

**Corpus:** `/workspace/aiv-translations/blb-draft/usx/` (66 books)  
**Keyed by:** Eliakim / Kevin Amundson  
**Office:** Ezra (AIV translation)  
**Docs fetched:** [UBS CAP USX](https://ubsicap.github.io/usx/) + [elements (chapter/verse)](https://ubsicap.github.io/usx/elements.html) + [notes](https://ubsicap.github.io/usx/notes.html)  
**Fetch / rebuild date:** **7 Sep 2026, 12:50 PM CDT** (America/Chicago)  
**Status:** draft — do **not** badge as finished; do **not** invent Scripture wording.

USX 3.0 requires chapter **and** verse milestones at both start and end, with matching `sid` / `eid` (see UBS CAP: “a `<verse>` milestone is required at the start and at the end of the verse text”).

---

## Summary

| Check | Before | After | Result |
| --- | ---: | ---: | --- |
| Books present (Protestant 66) | 66 | 66 | **PASS** |
| Well-formed XML (ElementTree parse) | 66/66 | 66/66 | **PASS** |
| `<usx version>` present | `3.1` × 66 | `3.1` × 66 | **PASS*** |
| Chapter `sid` count | 1189 | 1189 | **PASS** |
| Chapter `eid` count | 1189 | 1189 | **PASS** |
| Chapter `sid` set == `eid` set (per book) | yes | yes | **PASS** |
| Verse `sid` count | **31084** | **31084** | **PASS** |
| Verse `eid` count | **0** | **31084** | **PASS** (fixed) |
| Verse `sid` set == `eid` set (all 66 books) | fail | yes | **PASS** |
| Verse open/close order (no overlapping eids) | n/a | 0 errors | **PASS** |
| Sample GEN 1:1 has `sid` + `eid` | sid only | both | **PASS** |
| Sample GEN 1:2 has `sid` + `eid` | sid only | both | **PASS** |
| Sample chapter GEN 1 has `eid` | yes | yes | **PASS** |
| Markers preserved: `add` / `f` / `x` / `wj` | 15546 / 6305 / 1209 / 1312 | same | **PASS** |
| Draft status (`rem` `status=draft`) | 66/66 | 66/66 | **PASS** |
| `closed="false"` on note chars | 24186 | 24186 (unchanged) | **WARN** (see below) |

\*Version note: UBS CAP published docs are titled USX **3.0.0**; this corpus uses `version="3.1"` to align with USFM 3.1.1 mapping used at ingest. Acceptable for Seed/AIV draft pipeline; not a blocker.

---

## What was wrong

- Chapters already had paired milestones: `<chapter ... sid="BOOK N"/>` … `<chapter eid="BOOK N"/>`.
- Verses had start milestones only (`sid`), **zero** end milestones — non-compliant with USX 3.0.

## What we did

1. **Post-process** all 66 `usx/*.usx` files: after each verse’s content (last content para before next verse, heading, or chapter end), emit `<verse eid="BOOK C:V"/>` matching the open `sid`.
2. **Patched** `docx_to_usx.py` so future docx rebuilds append the same verse end milestone on the last content para of each verse (no full docx re-ingest required this pass).
3. **Re-ran** `usx_to_seed_chapter.py` fixtures: `seed-chapter-fixtures/GEN.1.json` (31 verses), `GEN.2.json` (25 verses). Adapter already skips `eid`-only verse nodes.
4. Did **not** change Scripture wording, `add` / `f` / `x` / `wj`, or draft badges.

Example (GEN 1:1–2 after rebuild):

```xml
<para style="p"><verse number="1" style="v" sid="GEN 1:1"/>…<verse eid="GEN 1:1"/></para>
<para style="p"><verse number="2" style="v" sid="GEN 1:2"/>…<verse eid="GEN 1:2"/></para>
```

Multi-para verse (GEN 1:5): `eid` on the final continuation para with `vid="GEN 1:5"`.

---

## Remaining schema warnings (non-blocking)

### `closed="false"` on note `char` (24186)

- Present on footnote/cross-ref chars (`fr`, `ft`, `fq`, `xt`, …) from `docx_to_usx.note_xml()`.
- Appears in some official UBS CAP samples (e.g. Nestle-Aland apparatus); omitted in many GNT samples; **not** listed as a formal required attribute in the attributes overview (USFM round-trip residue).
- **Recommendation:** keep for now (harmless for Seed adapter). Optional later cleanup: drop `closed="false"` in `note_xml()` for stricter minimal USX; do **not** treat as overwrite blocker.

### `usx version="3.1"` vs docs title 3.0.0

- **Recommendation:** leave as `3.1` unless Nehemiah’s host validator requires exactly `3.0`. If required, bump attr only after confirming Seed/host accept it — no content change.

### `para@vid` coverage

- Continuations already carry `vid` where the converter split verses across paras (USX 3.0 companion to verse milestones). No change needed this pass.

---

## Paths

| Path | Role |
| --- | --- |
| `/workspace/aiv-translations/blb-draft/usx/` | Rebuilt USX 3.x corpus (66 `*.usx`) |
| `/workspace/aiv-translations/blb-draft/docx_to_usx.py` | Ingest emitter now writes verse `eid` |
| `/workspace/aiv-translations/blb-draft/usx_to_seed_chapter.py` | Seed chapter adapter (unchanged logic; eid-aware) |
| `/workspace/aiv-translations/blb-draft/seed-chapter-fixtures/GEN.1.json` | Regenerated |
| `/workspace/aiv-translations/blb-draft/seed-chapter-fixtures/GEN.2.json` | Regenerated |
| `/workspace/aiv-translations/blb-draft/VALIDATION.md` | This report |
| `/workspace/aiv-translations/blb-draft/manifest.json` | Prior ingest manifest (counts still valid) |

---

## Ready for Nehemiah?

**YES — ready for Nehemiah to overwrite `aivbible` and rebundle Seed Bible** from this corpus.

Conditions met:

- Verse `sid` count **==** verse `eid` count (**31084**)
- Chapters remain paired (**1189** / **1189**)
- Markers and draft status preserved
- Seed fixtures regenerated for GEN.1 and GEN.2
- No git push / deploy / email performed from this workspace

Blockers: **none** for USX 3.0 verse/chapter milestone compliance.

When Nehemiah overwrites aivbible and rebundles Seed Bible: use `/workspace/aiv-translations/blb-draft/usx/` as source; keep translation id `BLB-Draft` and **draft** badge; do not claim finished.
