import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";

describe("CodeEditor — renders without throwing", () => {
  it("renders plain source with no active line or diagnostic", () => {
    expect(() =>
      render(<CodeEditor value={"x = 1\ny = 2\n"} onChange={() => {}} />),
    ).not.toThrow();
  });

  it("renders with an active line and a diagnostic set", () => {
    const onChange = vi.fn();
    expect(() =>
      render(
        <CodeEditor
          value={"x = 1\nprint(x)\n"}
          onChange={onChange}
          activeLine={2}
          diagnostic={{ line: 2, message: "something is wrong here" }}
        />,
      ),
    ).not.toThrow();
  });

  it("renders read-only without throwing", () => {
    expect(() =>
      render(<CodeEditor value={"x = 1\n"} onChange={() => {}} readOnly />),
    ).not.toThrow();
  });
});
