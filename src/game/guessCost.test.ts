import { describe, expect, it } from "vitest";
import { scoreGuess } from "./guessCost";

describe("scoreGuess", () => {
  it("is perfectly close on an exact guess", () => {
    expect(scoreGuess(45, 45)).toEqual({
      guess: 45,
      actual: 45,
      difference: 0,
      closeness: 1,
    });
  });

  it("scores closeness as a fraction of the actual count", () => {
    // 5 off out of 45 actual comparisons — a small miss, not a wild one.
    const result = scoreGuess(40, 45);
    expect(result.difference).toBe(5);
    expect(result.closeness).toBeCloseTo(1 - 5 / 45);
  });

  it("floors closeness at 0 for a guess off by 100% or more", () => {
    expect(scoreGuess(200, 45).closeness).toBe(0);
    expect(scoreGuess(90, 45).closeness).toBe(0); // exactly double
  });

  it("never goes negative even when the guess is absurdly high", () => {
    expect(scoreGuess(1_000_000, 45).closeness).toBe(0);
  });

  it("handles an actual count of zero without dividing by it", () => {
    expect(scoreGuess(0, 0)).toEqual({
      guess: 0,
      actual: 0,
      difference: 0,
      closeness: 1,
    });
    expect(scoreGuess(3, 0).closeness).toBe(0);
  });

  it("treats over- and under-guessing symmetrically", () => {
    expect(scoreGuess(40, 45).closeness).toBeCloseTo(
      scoreGuess(50, 45).closeness,
    );
  });
});
