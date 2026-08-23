/** A small deterministic PRNG seeded from a string, shared by every exercise that must reshuffle
 * identically across reloads — a learner picking up a puzzle where they left it needs the same
 * arrangement, not a fresh roll of `Math.random()`. Originally `blocks.ts`'s own private
 * `shuffleBlocks` internals; extracted here once `flowchartBlanks.ts`'s card bank (m14b) needed
 * the identical determinism over a different item shape (`Card`, not `Block`). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fisher-Yates over a seeded stream, retried with a bumped seed if it lands on the original
 * order — a pre-solved exercise is a broken one, and for a short list that is a real, not
 * theoretical, event. Compares by `id`, not object identity, since every caller shuffles a fresh
 * array of small value objects built just before calling this. */
export function seededShuffle<T extends { id: string }>(
  items: T[],
  seed: string,
): T[] {
  if (items.length < 2) return [...items];

  for (let attempt = 0; attempt < 20; attempt++) {
    const random = mulberry32(hashSeed(`${seed}#${attempt}`));
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    if (shuffled.some((item, index) => item.id !== items[index]!.id)) {
      return shuffled;
    }
  }
  // Unreachable for any real corpus program; a rotation is still a valid non-identity ordering.
  return [...items.slice(1), items[0]!];
}
