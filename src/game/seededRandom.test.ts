import { describe, expect, it } from "vitest";
import { seededShuffle } from "./seededRandom";

interface Item {
  id: string;
}

function items(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));
}

describe("seededShuffle — deterministic across reloads, not Math.random()", () => {
  it("the same seed produces the same order every time", () => {
    const source = items(6);
    expect(seededShuffle(source, "seed-a").map((i) => i.id)).toEqual(
      seededShuffle(source, "seed-a").map((i) => i.id),
    );
  });

  it("different seeds produce different orders", () => {
    const source = items(6);
    const a = seededShuffle(source, "seed-a").map((i) => i.id);
    const b = seededShuffle(source, "seed-b").map((i) => i.id);
    expect(a).not.toEqual(b);
  });

  it("never returns the original order for a shufflable list", () => {
    const source = items(5);
    for (let i = 0; i < 20; i++) {
      const shuffled = seededShuffle(source, `seed-${i}`).map((x) => x.id);
      expect(shuffled).not.toEqual(source.map((x) => x.id));
    }
  });

  it("contains exactly the same ids, just reordered", () => {
    const source = items(6);
    const shuffled = seededShuffle(source, "seed");
    expect(shuffled.map((i) => i.id).sort()).toEqual(
      source.map((i) => i.id).sort(),
    );
  });

  it("leaves lists of 0 or 1 items alone rather than looping forever on an unavoidable identity", () => {
    expect(seededShuffle([], "seed")).toEqual([]);
    expect(seededShuffle([items(1)[0]!], "seed")).toEqual([items(1)[0]]);
  });
});
