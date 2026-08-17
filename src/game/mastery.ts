/** D25/AC-9.22: "Progress = a mastery ring per lesson card, filled at ~5 predictions answered
 * with 80%+ accuracy. `localStorage` only, no accounts." Everything here is a thin,
 * fault-tolerant wrapper around that one browser API — no server, no schema migration, no
 * accounts to reconcile.
 *
 * Every read and write is wrapped in try/catch. `localStorage` throws in Safari private
 * browsing (a `SecurityError` on any access, not just writes) and is simply absent in some
 * test/SSR environments — a progress ring is decoration, and decoration must never be able to
 * break a lesson page. Failure degrades to "no progress recorded," never a thrown error.
 */

const STORAGE_KEY = "ccv:mastery:v1";

export interface MasteryRecord {
  answered: number;
  correct: number;
}

type MasteryStore = Record<string, MasteryRecord>;

/** ~5 predictions, 80%+ accuracy — D25's own numbers, not tunable per lesson. */
const MIN_ANSWERED = 5;
const MIN_ACCURACY = 0.8;

function readStore(): MasteryStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // A hand-edited or corrupted value is treated the same as "nothing recorded yet" rather
    // than thrown — the one existing failure mode `readMastery` already has to handle, so
    // `writeStore`'s own read-modify-write doesn't need a second one.
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as MasteryStore;
  } catch {
    return {};
  }
}

function writeStore(store: MasteryStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded, private-mode Safari, localStorage absent — progress simply isn't
    // recorded this time. Nothing here can surface that to the user without turning a
    // decorative ring into a source of error banners.
  }
}

/** A lesson's current record, or all-zeros if nothing has been answered yet. Never `null` —
 * every caller wants a record to read fields off of, not an existence check. */
export function readMastery(lessonId: string): MasteryRecord {
  return readStore()[lessonId] ?? { answered: 0, correct: 0 };
}

/** Records one answered prediction. Skipped prompts must never call this — "just show me" is
 * explicitly not a wrong answer (AC-9.4), and it is equally not a *measured* one; counting it
 * either way would make the ring reflect how often someone skipped rather than how often they
 * predicted correctly. */
export function recordAnswer(lessonId: string, wasCorrect: boolean): void {
  const store = readStore();
  const existing = store[lessonId] ?? { answered: 0, correct: 0 };
  store[lessonId] = {
    answered: existing.answered + 1,
    correct: existing.correct + (wasCorrect ? 1 : 0),
  };
  writeStore(store);
}

/** D25: has this lesson's ring filled? `answered === 0` short-circuits ahead of the division
 * so a never-attempted lesson reads as unfilled rather than `0/0` producing `NaN >= 0.8`. */
export function isMastered(record: MasteryRecord): boolean {
  return (
    record.answered >= MIN_ANSWERED &&
    record.answered > 0 &&
    record.correct / record.answered >= MIN_ACCURACY
  );
}
