import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Landing } from "./Landing";
import { LESSONS } from "../lessons/registry";
import { recordAnswer } from "../game/mastery";

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

describe("Landing — §11, real motion plus one-click access to every lesson", () => {
  it("shows the hero's real code and its animation, with real picture content", () => {
    renderLanding();
    // The hero's own source (bubble sort's committed recording) renders as real code — scoped
    // to the hero's own testid, since a lesson card below also previews its own starter code
    // and could otherwise collide with a loose text match.
    expect(screen.getByTestId("landing-hero-source")).toHaveTextContent(
      "def bubble_sort(nums):",
    );
    expect(screen.getByTestId("landing-picture")).toBeInTheDocument();
  });

  it("links every lesson in the registry, each to its own /lesson/:id route", () => {
    renderLanding();
    for (const lesson of LESSONS) {
      const link = screen.getByRole("link", { name: new RegExp(lesson.title) });
      expect(link).toHaveAttribute("href", `/lesson/${lesson.id}`);
    }
  });
});

describe("Landing — D25/AC-9.22, the mastery ring", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows every lesson as not-yet-mastered before any predictions are answered", () => {
    renderLanding();
    expect(screen.getAllByLabelText("not yet mastered")).toHaveLength(
      LESSONS.length,
    );
    expect(screen.queryByLabelText("mastered")).not.toBeInTheDocument();
  });

  it("reflects a real mastered lesson without touching any other lesson's ring", () => {
    const lessonId = LESSONS[0]!.id;
    for (let i = 0; i < 5; i++) recordAnswer(lessonId, true); // 5/5, well over 80%

    renderLanding();
    expect(screen.getAllByLabelText("mastered")).toHaveLength(1);
    expect(screen.getAllByLabelText("not yet mastered")).toHaveLength(
      LESSONS.length - 1,
    );
  });
});
