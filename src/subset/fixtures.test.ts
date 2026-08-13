import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "./validate";

const FIXTURES_ROOT = join(process.cwd(), "tests", "fixtures");

function pyFiles(dir: string): string[] {
  return readdirSync(join(FIXTURES_ROOT, dir))
    .filter((name) => name.endsWith(".py"))
    .sort();
}

function read(dir: string, file: string): string {
  return readFileSync(join(FIXTURES_ROOT, dir, file), "utf-8");
}

/** Rejected/guardrail fixtures start with `# reject: line N`, naming the line the validator is
 * expected to point at. Keeping the expectation in the fixture file (rather than a separate
 * manifest) means the two can't drift apart. */
function expectedRejectionLine(source: string, file: string): number {
  const match = /^# reject: line (\d+)/.exec(source);
  if (!match)
    throw new Error(`${file}: missing a '# reject: line N' header comment`);
  return Number(match[1]);
}

describe("fixture suite — tests/fixtures/accepted", () => {
  const files = pyFiles("accepted");

  it("has at least 25 fixtures (AC-1.3)", () => {
    expect(files.length).toBeGreaterThanOrEqual(25);
  });

  for (const file of files) {
    it(`accepts ${file}`, () => {
      const result = validate(read("accepted", file));
      if (!result.ok) {
        throw new Error(
          `${file} was rejected but should validate cleanly: ${result.message}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});

describe("fixture suite — tests/fixtures/rejected", () => {
  const files = pyFiles("rejected");

  it("has at least 20 fixtures (AC-1.4)", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  for (const file of files) {
    it(`rejects ${file} at the documented line, with no raw traceback`, () => {
      const source = read("rejected", file);
      const expectedLine = expectedRejectionLine(source, file);
      const result = validate(source);
      if (result.ok) {
        throw new Error(`${file} was accepted but should have been rejected`);
      }
      expect(result.line).toBe(expectedLine);
      expect(result.message).toMatch(
        /^.+ isn't supported yet — line \d+\. .+$/,
      );
    });
  }
});

describe("fixture suite — tests/fixtures/guardrails (AC-1.6, milestone-2 portion)", () => {
  const files = pyFiles("guardrails");

  it("has the two guardrail fixtures checkable without an execution engine", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  for (const file of files) {
    it(`trips the guardrail in ${file} with a specific message`, () => {
      const source = read("guardrails", file);
      const expectedLine = expectedRejectionLine(source, file);
      const result = validate(source);
      if (result.ok) {
        throw new Error(
          `${file} was accepted but should have tripped a guardrail`,
        );
      }
      expect(result.line).toBe(expectedLine);
    });
  }
});
