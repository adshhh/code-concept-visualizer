import { isBlankOrCommentLine, tokenize } from "../subset/tokenizer";
import { RejectionError } from "../subset/types";

/** D34: "the reverse-mode blocks are its shuffled lines." One block per non-blank source line,
 * carrying its own leading whitespace — §9 locks that for v1 ("blocks carry their own correct
 * indentation and the user orders them only; requiring the user to set indentation is held as a
 * v2 difficulty lever").
 *
 * Deliberately no `sourceLine` field. The answer check runs the user's arrangement and compares
 * output (D34), so nothing downstream ever needs to know where a block came from — leaving the
 * original position out means no future caller can quietly start checking against it instead. */
export interface Block {
  id: string;
  text: string;
  indent: number;
}

const INDENT_RE = /^\s*/;

export function toBlocks(source: string): Block[] {
  return source
    .split("\n")
    .filter((line) => !isBlankOrCommentLine(line))
    .map((text, index) => ({
      id: `b${index}`,
      text,
      indent: INDENT_RE.exec(text)![0].length,
    }));
}

/** The inverse of `toBlocks` for any source meeting `checkBlockSplittable` — pinned by a
 * round-trip test over the whole corpus. */
export function assembleSource(blocks: Block[]): string {
  return blocks.map((block) => block.text).join("\n") + "\n";
}

/** Moves the block at `from` to sit at `to`, leaving every other block in its relative order —
 * the one primitive both the keyboard grab/move/drop flow and a stray malformed drag event need
 * (m13b's `BlockList.tsx`). Out-of-range indices are a no-op (returns the same array reference,
 * not a copy) rather than a throw: a keyboard handler computing `index - 1` at the top of a list
 * or `index + 1` at the bottom is the normal case here, not a bug to guard against upstream. */
export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  if (
    from === to ||
    from < 0 ||
    from >= blocks.length ||
    to < 0 ||
    to >= blocks.length
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** `toBlocks` treats one physical line as one statement. That is only sound for source where it
 * is actually true, so this states the precondition rather than assuming it, and the corpus test
 * runs it over all 18 programs.
 *
 * Three ways real subset-valid Python breaks a line-based splitter, all of which the tokenizer
 * accepts happily: a statement continued across lines inside brackets; a suite on its header's
 * own line (`if True: print(1)` — `tests/fixtures/accepted/28_single_line_suites.py` exists
 * precisely because the parser supports this); and blank or comment-only lines, which the
 * tokenizer drops entirely so they never appear as statements at all. */
export function checkBlockSplittable(
  source: string,
): { ok: true } | { ok: false; reason: string } {
  const lines = source.split("\n");
  for (const [index, line] of lines.entries()) {
    // split("\n") on a trailing-newline-terminated file (the normal way editors save) produces
    // one synthetic empty final element that isn't a real line — exempt it, same as validate.ts
    // does for its own line-count check.
    if (isBlankOrCommentLine(line) && index < lines.length - 1) {
      return {
        ok: false,
        reason: `blank or comment-only line at line ${index + 1}`,
      };
    }
  }

  // tokenize() throws RejectionError on genuinely malformed source (a tab, an unclosed bracket
  // or string, an unrecognized character) — the same failure mode validate.ts already guards
  // against at src/subset/validate.ts:33-41. Every corpus program passes validate() first, so
  // this never fires for anything shipped, but checkBlockSplittable promises a return value, not
  // a throw, for any caller — including a future hand-authored program that hasn't been
  // validated yet.
  let tokens: ReturnType<typeof tokenize>;
  try {
    tokens = tokenize(source);
  } catch (err) {
    if (err instanceof RejectionError) {
      return { ok: false, reason: err.message };
    }
    throw err;
  }

  let statement: typeof tokens = [];
  for (const token of tokens) {
    if (token.type === "INDENT" || token.type === "DEDENT") continue;
    if (token.type === "NEWLINE" || token.type === "EOF") {
      const problem = checkStatement(statement);
      if (problem) return { ok: false, reason: problem };
      statement = [];
      continue;
    }
    statement.push(token);
  }
  return { ok: true };
}

function checkStatement(statement: ReturnType<typeof tokenize>): string | null {
  if (statement.length === 0) return null;

  const lines = new Set(statement.map((token) => token.line));
  if (lines.size > 1) {
    return `statement spanning lines ${[...lines].join(", ")} — one physical line per statement`;
  }

  // A top-level `:` only ever ends a compound header (dict literals and slices put theirs inside
  // brackets), so anything after one means the body shares the header's line.
  let depth = 0;
  for (const [index, token] of statement.entries()) {
    if (token.type !== "OP") continue;
    if ("([{".includes(token.value)) depth += 1;
    else if (")]}".includes(token.value)) depth -= 1;
    else if (
      token.value === ":" &&
      depth === 0 &&
      index !== statement.length - 1
    ) {
      return `single-line suite on line ${token.line} — put the body on its own line`;
    }
  }
  return null;
}

/** Seeded on the program id, never `Math.random()`: a user who reloads mid-solve must not get a
 * different puzzle, and the corpus test needs to assert the shipped arrangement for all 18. */
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
 * order — a pre-solved exercise is a broken one, and for a 4-block program that is a 1-in-24
 * event, not a theoretical one. */
export function shuffleBlocks(blocks: Block[], seed: string): Block[] {
  if (blocks.length < 2) return [...blocks];

  for (let attempt = 0; attempt < 20; attempt++) {
    const random = mulberry32(hashSeed(`${seed}#${attempt}`));
    const shuffled = [...blocks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    if (shuffled.some((block, index) => block.id !== blocks[index]!.id)) {
      return shuffled;
    }
  }
  // Unreachable for any real corpus program; a rotation is still a valid non-identity ordering.
  return [...blocks.slice(1), blocks[0]!];
}
