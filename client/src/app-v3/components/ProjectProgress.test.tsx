import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { ProjectProgress } from "./ProjectProgress";
import { ProjectSittings } from "./ProjectSittings";
const sittings = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  sessionPlanId: 11,
  sessionTotal: 6,
  status: i < 2 ? "completed" : "confirmed",
  startsAt: `2030-10-${10 + i}T00:00:00Z`,
}));
it("labels native progress accessibly with sitting completion rather than payment", () => {
  render(<ProjectProgress sittings={sittings} />);
  const bar = screen.getByRole("progressbar", {
    name: "2 of 6 sittings completed",
  });
  expect(bar.getAttribute("value")).toBe("2");
  expect(bar.getAttribute("max")).toBe("6");
});
it("shows unknown progress honestly without an invented bar", () => {
  render(<ProjectProgress sittings={[{ id: 1, status: "completed" }]} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByText(/total to be confirmed/)).toBeTruthy();
});
it("keeps a long project compact and expands its rows on request", () => {
  render(
    <ProjectSittings
      sittings={sittings}
      render={s => <span>Sitting {s.id}</span>}
    />
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Sitting 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View all 6 sittings" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Show fewer sittings" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});
it("keeps a deep-linked sitting visible even in a compact long project", () => {
  render(
    <ProjectSittings
      sittings={sittings}
      selectedId={5}
      render={s => <span>Sitting {s.id}</span>}
    />
  );
  expect(screen.getByText("Sitting 5")).toBeTruthy();
  expect(screen.queryByText("Sitting 3")).toBeNull();
});
