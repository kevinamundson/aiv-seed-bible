import { describe, expect, it } from "vitest";
import {
  bookHasSections,
  getAdjacentSections,
  getChaptersInSection,
  getSection,
  getSectionForChapterVerse,
  getSectionsForBook,
} from "@packages/seed-bible/seed-bible/lib/bibleSections";

describe("bibleSections", () => {
  it("returns Genesis toledoth sections", () => {
    const sections = getSectionsForBook("GEN");
    expect(sections.length).toBe(9);
    expect(sections[0]?.title).toContain("Toledoth of God");
  });

  it("bookHasSections is true for GEN and false for MAT", () => {
    expect(bookHasSections("GEN")).toBe(true);
    expect(bookHasSections("MAT")).toBe(false);
  });

  it("getSection looks up by id", () => {
    const s = getSection("PSA", 3);
    expect(s?.title).toBe("Book III");
    expect(s?.startChapter).toBe(73);
  });

  it("getSectionForChapterVerse finds enclosing section", () => {
    const s = getSectionForChapterVerse("GEN", 3, 1);
    expect(s?.id).toBe(2);
  });

  it("getAdjacentSections returns neighbors", () => {
    const { previous, next } = getAdjacentSections("EXO", 2);
    expect(previous?.id).toBe(1);
    expect(next?.id).toBe(3);
  });

  it("getChaptersInSection lists every chapter", () => {
    const s = getSection("NUM", 1)!;
    expect(getChaptersInSection(s)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
