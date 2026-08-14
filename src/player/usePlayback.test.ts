import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayback } from "./usePlayback";

describe("usePlayback — manual navigation", () => {
  it("stepForward/stepBack move by one and clamp at both ends", () => {
    const { result } = renderHook(() => usePlayback(5));
    expect(result.current.step).toBe(0);

    act(() => result.current.stepBack());
    expect(result.current.step).toBe(0); // clamped, not negative

    act(() => result.current.stepForward());
    act(() => result.current.stepForward());
    expect(result.current.step).toBe(2);

    act(() => result.current.goToStep(999));
    expect(result.current.step).toBe(4); // clamped to lastFrameIndex
    expect(result.current.atEnd).toBe(true);
  });

  it("reset returns to step 0 and pauses, with no external calls of any kind", () => {
    const { result } = renderHook(() => usePlayback(5));
    act(() => result.current.goToStep(3));
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);

    act(() => result.current.reset());
    expect(result.current.step).toBe(0);
    expect(result.current.playing).toBe(false);
  });

  it("a manual step pauses an in-flight autoplay", () => {
    const { result } = renderHook(() => usePlayback(5));
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);
    act(() => result.current.stepForward());
    expect(result.current.playing).toBe(false);
  });
});

describe("usePlayback — autoplay (fake timers)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances one step per tick at 1x speed, stopping at the last frame without looping", () => {
    const { result } = renderHook(() => usePlayback(3)); // frames 0,1,2 — lastFrameIndex 2
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.step).toBe(1);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.step).toBe(2);
    expect(result.current.playing).toBe(false); // stopped, not looped
    expect(result.current.atEnd).toBe(true);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.step).toBe(2); // still at the end, never wraps back to 0
  });

  it("pressing Play again at the end (Replay) restarts from step 0", () => {
    const { result } = renderHook(() => usePlayback(3));
    act(() => result.current.goToStep(2));
    expect(result.current.atEnd).toBe(true);

    act(() => result.current.play());
    expect(result.current.step).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("does nothing when there are zero frames", () => {
    const { result } = renderHook(() => usePlayback(0));
    act(() => result.current.play());
    expect(result.current.playing).toBe(false);
    expect(result.current.atEnd).toBe(true);
  });

  it("a faster speed advances more steps in the same wall-clock time", () => {
    const { result } = renderHook(() => usePlayback(10));
    act(() => result.current.setSpeed(4));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.step).toBe(4);
  });
});
