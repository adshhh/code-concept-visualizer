import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "./validate";

describe("validate — accepted smoke cases", () => {
  it("accepts a simple for loop with print", () => {
    const result = validate("for i in range(10):\n    print(i)\n");
    expect(result.ok).toBe(true);
  });

  it("accepts if/elif/else", () => {
    const src =
      "x = 5\nif x > 0:\n    print('pos')\nelif x < 0:\n    print('neg')\nelse:\n    print('zero')\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts a recursive function", () => {
    const src =
      "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts list indexing, append, and f-strings", () => {
    const src =
      "nums = [1, 2, 3]\nnums.append(4)\ni = 0\nprint(f'value is {nums[i]}')\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts dict literal and key access", () => {
    const src =
      "scores = {'a': 1, 'b': 2}\nscores['c'] = 3\nprint(scores['a'])\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts the two-item swap idiom", () => {
    const src =
      "nums = [1, 2, 3]\ni = 0\nj = 1\nnums[i], nums[j] = nums[j], nums[i]\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts chained and augmented assignment", () => {
    const src = "a = b = 0\na += 1\nb -= 1\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts while with break/continue", () => {
    const src =
      "i = 0\nwhile i < 10:\n    if i == 5:\n        break\n    i += 1\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts negative indexing and slicing", () => {
    const src = "nums = [1, 2, 3]\nprint(nums[-1])\nprint(nums[1:2])\n";
    expect(validate(src).ok).toBe(true);
  });

  it("accepts a bubble sort body using the swap idiom", () => {
    const src = [
      "def bubble_sort(nums):",
      "    n = len(nums)",
      "    for i in range(n):",
      "        for j in range(n - i - 1):",
      "            if nums[j] > nums[j + 1]:",
      "                nums[j], nums[j + 1] = nums[j + 1], nums[j]",
      "    return nums",
      "",
    ].join("\n");
    expect(validate(src).ok).toBe(true);
  });
});

describe("validate — rejected smoke cases", () => {
  it("rejects class with a line-numbered message", () => {
    const result = validate("class Foo:\n    pass\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBe(1);
      expect(result.message).toMatch(
        /class definitions isn't supported yet — line 1\./,
      );
    }
  });

  it("rejects import", () => {
    const result = validate("import os\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/^import isn't supported yet — line 1\./);
  });

  it("rejects a bare tuple literal", () => {
    const result = validate("t = (1, 2)\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/tuples isn't supported yet/);
  });

  it("rejects a 3-way rotation even though it looks swap-shaped", () => {
    const result = validate("a, b, c = c, a, b\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/tuples isn't supported yet/);
  });

  it("rejects a two-target assignment that isn't a reversal", () => {
    const result = validate("a, b = c, d\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/tuples isn't supported yet/);
  });

  it("rejects a list comprehension", () => {
    const result = validate("squares = [x * x for x in range(10)]\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/comprehensions isn't supported yet/);
  });

  it("rejects a chained comparison", () => {
    const result = validate("x = 5\nif 0 < x < 10:\n    print(x)\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/chained comparisons/);
  });

  it("rejects a keyword argument", () => {
    const result = validate("def f(x):\n    return x\nf(x=1)\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/keyword arguments/);
  });

  it("rejects slice assignment", () => {
    const result = validate("nums = [1, 2, 3]\nnums[0:2] = [9, 9]\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/assigning to a slice/);
  });

  it("rejects a nested function definition (closures)", () => {
    const src =
      "def outer():\n    def inner():\n        return 1\n    return inner()\n";
    const result = validate(src);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(
        /functions defined inside other functions/,
      );
  });

  it("rejects lambda", () => {
    const result = validate("f = lambda x: x + 1\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.message).toMatch(/lambda isn't supported yet/);
  });

  it("rejects a set literal", () => {
    const result = validate("s = {1, 2, 3}\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/sets isn't supported yet/);
  });

  it("rejects a while/else form", () => {
    const src = "i = 0\nwhile i < 3:\n    i += 1\nelse:\n    print('done')\n";
    const result = validate(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/while\/else/);
  });

  it("rejects a for/else form", () => {
    const src =
      "nums = [1, 2, 3]\nfor n in nums:\n    print(n)\nelse:\n    print('done')\n";
    const result = validate(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/for\/else/);
  });

  it("rejects a program over 100 lines", () => {
    const src =
      Array.from({ length: 101 }, (_, i) => `x${i} = ${i}`).join("\n") + "\n";
    const result = validate(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/programs over 100 lines/);
  });

  it("does not reject an exactly-100-line program that ends with a trailing newline", () => {
    const src =
      Array.from({ length: 100 }, (_, i) => `x${i} = ${i}`).join("\n") + "\n";
    expect(validate(src).ok).toBe(true);
  });

  it("does not misdecode an escaped backslash followed by n as a newline", () => {
    // Python source containing \\n (backslash, backslash, n) should decode to a literal
    // backslash followed by the letter n — not an actual newline character.
    const result = validate("s = 'a\\\\nb'\n");
    expect(result.ok).toBe(true);
  });

  it("rejects a list literal with more than 25 items", () => {
    const src = `nums = [${Array.from({ length: 26 }, (_, i) => i).join(", ")}]\n`;
    const result = validate(src);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/more than 25 items/);
  });
});

describe("validate — structural proof for AC-1.2", () => {
  it("the validator module never executes or evaluates the source it checks", () => {
    const files = ["validate.ts", "parser.ts", "tokenizer.ts"];
    for (const file of files) {
      const text = readFileSync(
        join(process.cwd(), "src/subset", file),
        "utf-8",
      );
      expect(text).not.toMatch(/\beval\s*\(/);
      expect(text).not.toMatch(/new\s+Function\s*\(/);
      expect(text).not.toMatch(/\bimport\s*\(/); // dynamic import of user source
    }
  });
});
