import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackControls } from "./PlaybackControls";
import type { Playback } from "./usePlayback";

function fakePlayback(overrides: Partial<Playback> = {}): Playback {
  return {
    step: 0,
    playing: false,
    speed: 1,
    atEnd: false,
    stepForward: vi.fn(),
    stepBack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    goToStep: vi.fn(),
    setSpeed: vi.fn(),
    ...overrides,
  };
}

describe("PlaybackControls", () => {
  it("Play button reads Play normally and calls playback.play()", async () => {
    const user = userEvent.setup();
    const playback = fakePlayback();
    render(
      <PlaybackControls
        playback={playback}
        frameCount={5}
        currentFrameNumber={1}
      />,
    );
    const playButton = screen.getByRole("button", { name: "Play" });
    await user.click(playButton);
    expect(playback.play).toHaveBeenCalledOnce();
  });

  it("reads Replay at the end and Pause while playing", () => {
    const { rerender } = render(
      <PlaybackControls
        playback={fakePlayback({ atEnd: true })}
        frameCount={5}
        currentFrameNumber={5}
      />,
    );
    expect(screen.getByRole("button", { name: "Replay" })).toBeInTheDocument();

    rerender(
      // Found in a real-browser check, not a test: usePlayback's atEnd is also true when
      // frameCount is 0 (nothing has been run yet), which must never read "Replay" — there
      // is nothing to replay.
      <PlaybackControls
        playback={fakePlayback({ atEnd: true })}
        frameCount={0}
        currentFrameNumber={undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

    rerender(
      <PlaybackControls
        playback={fakePlayback({ playing: true })}
        frameCount={5}
        currentFrameNumber={2}
      />,
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("shows the counter using the Frame's own 1-indexed step, not the array index", () => {
    render(
      <PlaybackControls
        playback={fakePlayback({ step: 0 })}
        frameCount={42}
        currentFrameNumber={1}
      />,
    );
    expect(screen.getByText("step 1 of 42")).toBeInTheDocument();
  });

  it("shows 'no run yet' with zero frames", () => {
    render(
      <PlaybackControls
        playback={fakePlayback()}
        frameCount={0}
        currentFrameNumber={undefined}
      />,
    );
    expect(screen.getByText("no run yet")).toBeInTheDocument();
  });

  it("everything is disabled when frameCount is 0", () => {
    render(
      <PlaybackControls
        playback={fakePlayback()}
        frameCount={0}
        currentFrameNumber={undefined}
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("dragging the slider calls goToStep with the chosen value", () => {
    const playback = fakePlayback();
    render(
      <PlaybackControls
        playback={playback}
        frameCount={10}
        currentFrameNumber={4}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "6" } });
    expect(playback.goToStep).toHaveBeenCalledWith(6);
  });
});
