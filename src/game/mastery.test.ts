import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMastered, readMastery, recordAnswer } from "./mastery";

beforeEach(() => {
  window.localStorage.clear();
});

describe("readMastery — a lesson with nothing recorded", () => {
  it("returns a zeroed record, not null or undefined", () => {
    expect(readMastery("01-first-loop")).toEqual({ answered: 0, correct: 0 });
  });
});

describe("recordAnswer", () => {
  it("increments answered and correct on a right answer", () => {
    recordAnswer("01-first-loop", true);
    expect(readMastery("01-first-loop")).toEqual({ answered: 1, correct: 1 });
  });

  it("increments answered but not correct on a wrong answer", () => {
    recordAnswer("01-first-loop", false);
    expect(readMastery("01-first-loop")).toEqual({ answered: 1, correct: 0 });
  });

  it("accumulates across several calls", () => {
    recordAnswer("01-first-loop", true);
    recordAnswer("01-first-loop", true);
    recordAnswer("01-first-loop", false);
    expect(readMastery("01-first-loop")).toEqual({ answered: 3, correct: 2 });
  });

  it("keeps each lesson's record independent", () => {
    recordAnswer("01-first-loop", true);
    recordAnswer("02-looping-over-a-list", false);

    expect(readMastery("01-first-loop")).toEqual({ answered: 1, correct: 1 });
    expect(readMastery("02-looping-over-a-list")).toEqual({
      answered: 1,
      correct: 0,
    });
  });

  it("persists across separate reads — the whole point of localStorage over in-memory state", () => {
    recordAnswer("01-first-loop", true);
    recordAnswer("01-first-loop", true);
    // Two independent reads, not one cached value — proves the record actually round-trips
    // through localStorage rather than living in a module-level variable.
    expect(readMastery("01-first-loop").answered).toBe(2);
    expect(readMastery("01-first-loop").answered).toBe(2);
  });
});

describe("isMastered — D25's exact thresholds", () => {
  it("is false with fewer than 5 answered, even at 100% accuracy", () => {
    expect(isMastered({ answered: 4, correct: 4 })).toBe(false);
  });

  it("is false at 5+ answered but under 80% accuracy", () => {
    expect(isMastered({ answered: 5, correct: 3 })).toBe(false); // 60%
  });

  it("is true at exactly 5 answered and exactly 80% accuracy", () => {
    expect(isMastered({ answered: 5, correct: 4 })).toBe(true); // 80%
  });

  it("stays true well past the threshold", () => {
    expect(isMastered({ answered: 20, correct: 18 })).toBe(true); // 90%
  });

  it("is false for a lesson with nothing recorded — 0/0 must not read as mastered", () => {
    expect(isMastered({ answered: 0, correct: 0 })).toBe(false);
  });
});

describe("skipped prompts are never recorded", () => {
  it("readMastery is unaffected by anything other than a real recordAnswer call", () => {
    // recordAnswer is the only write path this module exposes — a skip (AC-9.4's "just show
    // me") has no function to call here at all, which is what makes "skips don't count"
    // true by construction rather than by a caller remembering not to call the wrong thing.
    expect(readMastery("01-first-loop")).toEqual({ answered: 0, correct: 0 });
  });
});

describe("localStorage failure modes — a progress ring must never break the page", () => {
  const originalLocalStorage = window.localStorage;

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  function throwingStorage(): Storage {
    return {
      getItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
  }

  it("readMastery degrades to a zeroed record when localStorage throws on read", () => {
    Object.defineProperty(window, "localStorage", {
      value: throwingStorage(),
      configurable: true,
      writable: true,
    });

    expect(() => readMastery("01-first-loop")).not.toThrow();
    expect(readMastery("01-first-loop")).toEqual({ answered: 0, correct: 0 });
  });

  it("recordAnswer swallows a throw on write instead of propagating it", () => {
    Object.defineProperty(window, "localStorage", {
      value: throwingStorage(),
      configurable: true,
      writable: true,
    });

    expect(() => recordAnswer("01-first-loop", true)).not.toThrow();
  });

  it("readMastery treats corrupted stored JSON as nothing recorded", () => {
    window.localStorage.setItem("ccv:mastery:v1", "{not valid json");
    expect(() => readMastery("01-first-loop")).not.toThrow();
    expect(readMastery("01-first-loop")).toEqual({ answered: 0, correct: 0 });
  });

  it("readMastery treats a non-object stored value as nothing recorded", () => {
    window.localStorage.setItem("ccv:mastery:v1", "42");
    expect(readMastery("01-first-loop")).toEqual({ answered: 0, correct: 0 });
  });
});
