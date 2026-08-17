// @vitest-environment node
//
// Same Pyodide-in-Node strategy as traces.test.ts/registry.test.ts: traces
// `game/algorithms.ts`'s generated source against the real engine rather than trusting a
// hand simulation of Python's own semantics. Lives here, not under src/game/ (where
// algorithms.ts itself is defined), because architecture.test.ts forbids src/game/ from
// importing src/engine/ — the same reason registry.test.ts's own real-engine checks live
// under src/lessons/, not src/player/.
//
// The exact numbers below were found by running this file against the real engine while
// building 12b, not assumed: a first hand simulation predicted 18 shifts + 9 key placements
// = 27 moves for insertion sort, but two of those nine placements are no-ops (the item is
// already in its correct position, so the write doesn't change the value and diffFrames
// correctly reports nothing) — the real count is 25. A second, more serious finding: the
// generated source (`nums = [...]; print(bubble_sort(nums))`) binds the list at module scope
// before passing it into the function — the same shape all three shipped Mode B lessons'
// own starterCode already uses — and since Python passes lists by reference, the mutation is
// visible from both scopes at once; the first version of `countRun` reported every swap
// twice as a result (see counters.ts's own fix and counters.test.ts's pinning test).
//
// The search pairing's own default size (8, not the 25 originally intended) was forced down
// by two more findings, both in the rendered UI rather than in these counts: NumberList.tsx's
// grid has a hard 2.5rem-per-cell floor, and CallStackCards.tsx stringifies a list argument
// with no spaces (one unbreakable line of text) — both overflow compare mode's narrower
// columns well before 25 items, the second one before even 12. See algorithms.ts's own
// comment on the search pairing's `default` for the full account. The honest consequence
// pinned below: linear search wins at the shipped default, not binary search.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { loadTestPyodide } from "./loadTestPyodide";
import {
  PAIRINGS,
  getPairing,
  effectiveValues,
  type Algorithm,
  type Pairing,
} from "../game/algorithms";
import { countRun, type RunCounts } from "../game/counters";
import type { Recording } from "../recording/types";

let pyodide: PyodideInterface;
beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

function trace(source: string): Recording {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  const result = JSON.parse(recordTrace(source)) as {
    status: string;
  } & Recording;
  if (result.status !== "ok") {
    throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  }
  return { source: result.source, frames: result.frames };
}

function runCounts(pairing: Pairing, algo: Algorithm): RunCounts {
  const values = effectiveValues(pairing, pairing.defaultValues);
  return countRun(trace(algo.buildSource(values)));
}

function n(pairing: Pairing): number {
  const values = effectiveValues(pairing, pairing.defaultValues);
  return (values.nums as number[]).length;
}

describe("search pairing — real numbers, at the shipped default", () => {
  const pairing = getPairing("search")!;

  it("both algorithms see the identical, sorted list", () => {
    const values = pairing.normalizeValues!(pairing.defaultValues);
    const nums = values.nums as number[];
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  // The shipped default is small enough to render without overflowing (see algorithms.ts's
  // own comment on this pairing's `default`), which means it's also small enough that
  // linear search wins — binary's own per-iteration overhead (three comparison lines,
  // `while`/`if`/`elif`) only pays off from around 12 items. Asserted as the real, honest
  // outcome, not the one originally intended — the Big-O text says why explicitly rather
  // than the default quietly picking a number that hides it.
  it("linear search wins at the shipped (small, layout-constrained) default", () => {
    const linear = runCounts(pairing, pairing.left);
    const binary = runCounts(pairing, pairing.right);

    expect(linear.comparisons).toBe(8);
    expect(binary.comparisons).toBe(11);
    expect(linear.comparisons).toBeLessThan(binary.comparisons);
  });

  it("neither search algorithm reports swaps or moves — searching doesn't mutate the list", () => {
    const linear = runCounts(pairing, pairing.left);
    const binary = runCounts(pairing, pairing.right);
    expect(linear.swaps).toBe(0);
    expect(linear.moves).toBe(0);
    expect(binary.swaps).toBe(0);
    expect(binary.moves).toBe(0);
  });
});

describe("sort pairing — real numbers, at the shipped default", () => {
  const pairing = getPairing("sort")!;

  it("bubble sort: 45 comparisons, 18 swaps, 36 moves on [5,2,9,1,7,3,10,4,8,6]", () => {
    expect(runCounts(pairing, pairing.left)).toEqual({
      steps: expect.any(Number),
      comparisons: 45,
      swaps: 18,
      moves: 36,
    });
  });

  // Insertion sort never swaps a pair — it shifts elements one place right, plus one final
  // placement of the key. `swaps: 0` would read as "did nothing" without `moves`.
  it("insertion sort: 27 comparisons, 0 swaps, 25 real moves — not 0", () => {
    expect(runCounts(pairing, pairing.right)).toEqual({
      steps: expect.any(Number),
      comparisons: 27,
      swaps: 0,
      moves: 25,
    });
  });
});

describe("bigO — cites the counts actually observed this run (AC-9.9)", () => {
  for (const pairing of PAIRINGS) {
    for (const algo of ["left", "right"] as const) {
      it(`${pairing.id}/${pairing[algo].id} cites its own real comparison count and n`, () => {
        const counts = runCounts(pairing, pairing[algo]);
        const sentence = pairing[algo].bigO(counts, n(pairing));

        expect(sentence).toContain(String(counts.comparisons));
        expect(sentence).toContain(String(n(pairing)));
        expect(sentence.toLowerCase()).not.toMatch(/\bms\b|millisecond/);
      });
    }
  }
});

describe("stays inside the step cap at the shipped defaults (D11/D39)", () => {
  for (const pairing of PAIRINGS) {
    for (const algo of ["left", "right"] as const) {
      it(`${pairing.id}/${pairing[algo].id} runs well under the 2,000-step cap`, () => {
        expect(runCounts(pairing, pairing[algo]).steps).toBeLessThan(2000);
      });
    }
  }
});
