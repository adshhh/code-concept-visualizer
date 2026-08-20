// @vitest-environment node
//
// A measurement, not a gate — skipped unless MEASURE=1, so it never slows the normal suite:
//
//     MEASURE=1 npx vitest run src/practice/measureArrangements.test.ts
//
// It answers two questions m13b's UX depends on, by running real arrangements through the real
// engine rather than reasoning about them: (1) is any exercise trivially satisfiable — how many
// distinct orderings produce the expected output? and (2) how often is AC-9.16's animation path
// actually reachable — i.e. how many wrong arrangements produce a run to animate at all, rather
// than being rejected outright as invalid Python? Results are recorded in docs/GAME.md.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { validate } from "../subset/validate";
import { PRACTICE_PROGRAMS } from "./registry";
import { assembleSource, toBlocks, type Block } from "../game/blocks";
import { loadTestPyodide } from "../engine/loadTestPyodide";

const ENABLED = process.env.MEASURE === "1";

/** Full enumeration up to this many blocks; beyond it the space is sampled instead (8! is 40320
 * arrangements, and the answer does not get more true for being exhaustive). */
const EXHAUSTIVE_UP_TO = 6;
const SAMPLE_SIZE = 3000;

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield [...items];
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i]!, ...tail];
  }
}

function seededSamples(blocks: Block[], count: number): Block[][] {
  let state = 12345;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const samples: Block[][] = [];
  for (let n = 0; n < count; n++) {
    const shuffled = [...blocks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    samples.push(shuffled);
  }
  return samples;
}

/** Every arrangement one block away from correct — block `from` lifted out and dropped at `to`.
 * This is the population that actually matters for 13b's feedback UX: a learner produces
 * near-misses, not uniformly random permutations, so the whole-space numbers below answer "is
 * this trivially satisfiable" and these answer "what will someone actually see when they get it
 * wrong". */
function singleMoveArrangements(blocks: Block[]): Block[][] {
  const out: Block[][] = [];
  for (let from = 0; from < blocks.length; from++) {
    for (let to = 0; to < blocks.length; to++) {
      if (from === to) continue;
      const moved = [...blocks];
      const [block] = moved.splice(from, 1);
      moved.splice(to, 0, block!);
      out.push(moved);
    }
  }
  return out;
}

interface Tally {
  considered: number;
  exhaustive: boolean;
  rejected: number;
  correct: number;
  wrongRunnable: number;
  /** Non-`ok` but frame-bearing — a runtime error still records frames, so it animates. */
  crashed: number;
}

let pyodide: PyodideInterface;

describe.skipIf(!ENABLED)("arrangement space, measured", () => {
  beforeAll(async () => {
    pyodide = await loadTestPyodide();
  }, 30_000);

  it("reports how solvable and how animatable every exercise actually is", () => {
    const recordTrace = pyodide.globals.get("record_trace") as (
      src: string,
    ) => string;
    const rows: string[] = [];
    const tallies: { id: string; tally: Tally }[] = [];

    function measure(
      candidates: Block[][],
      expected: string,
      exhaustive: boolean,
    ): Tally {
      const tally: Tally = {
        considered: candidates.length,
        exhaustive,
        rejected: 0,
        correct: 0,
        wrongRunnable: 0,
        crashed: 0,
      };
      for (const candidate of candidates) {
        const source = assembleSource(candidate);
        if (!validate(source).ok) {
          tally.rejected++;
          continue;
        }
        const result = JSON.parse(recordTrace(source)) as {
          status: string;
          stdout?: string;
        };
        if (result.status === "ok" && result.stdout === expected)
          tally.correct++;
        else if (result.status === "ok") tally.wrongRunnable++;
        else tally.crashed++;
      }
      return tally;
    }

    const pct = (n: number, total: number) =>
      `${((n / total) * 100).toFixed(1)}%`;

    rows.push(
      "WHOLE SPACE — is any exercise trivially satisfiable?".padEnd(20) + "\n",
    );
    for (const program of PRACTICE_PROGRAMS) {
      const blocks = toBlocks(program.source);
      const expected = JSON.parse(recordTrace(program.source)).stdout as string;

      const exhaustive = blocks.length <= EXHAUSTIVE_UP_TO;
      // The original ordering is always included, so a sampled run still measures at least the
      // one solution we know exists — otherwise "0 correct" just means "never sampled it".
      const candidates = exhaustive
        ? [...permutations(blocks)]
        : [blocks, ...seededSamples(blocks, SAMPLE_SIZE)];

      const tally = measure(candidates, expected, exhaustive);
      rows.push(
        `${program.id.padEnd(20)} ${String(blocks.length).padStart(2)} blocks  ` +
          `${exhaustive ? "all    " : "sampled"} ${String(tally.considered).padStart(5)}  ` +
          `rejected ${pct(tally.rejected, tally.considered).padStart(6)}  ` +
          `animatable ${pct(tally.crashed + tally.wrongRunnable, tally.considered).padStart(6)}  ` +
          `correct ${String(tally.correct).padStart(4)}`,
      );
      tallies.push({ id: program.id, tally });
    }

    rows.push(
      "\nNEAR-MISS (one block moved) — what a learner actually sees when wrong:\n",
    );
    for (const program of PRACTICE_PROGRAMS) {
      const blocks = toBlocks(program.source);
      const expected = JSON.parse(recordTrace(program.source)).stdout as string;
      const tally = measure(singleMoveArrangements(blocks), expected, true);
      const animatable = tally.crashed + tally.wrongRunnable;
      rows.push(
        `${program.id.padEnd(20)} ${String(tally.considered).padStart(3)} near-misses  ` +
          `rejected ${pct(tally.rejected, tally.considered).padStart(6)}  ` +
          `animatable ${pct(animatable, tally.considered).padStart(6)}  ` +
          `still-correct ${String(tally.correct).padStart(3)}`,
      );
    }

    console.log("\n" + rows.join("\n") + "\n");

    // The exercise must have a solution, and the original ordering is always one of them.
    for (const { id, tally } of tallies) {
      expect(tally.correct, `${id} has no correct arrangement`).toBeGreaterThan(
        0,
      );
    }
  }, 600_000);
});
