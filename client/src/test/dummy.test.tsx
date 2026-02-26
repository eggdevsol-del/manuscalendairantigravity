import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("Vitest Setup", () => {
  it("should render and query elements", () => {
    render(<div data-testid="test">Hello World</div>);
    expect(screen.getByTestId("test")).toHaveTextContent("Hello World");
  });
});
