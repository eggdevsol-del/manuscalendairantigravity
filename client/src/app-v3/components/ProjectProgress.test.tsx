import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { ProjectProgress } from "./ProjectProgress";
import { ProjectSittings, ProjectDisclosure } from "./ProjectSittings";
vi.mock("@/_core/contexts/UIDebugContext", () => ({
  useUIDebug: () => ({ showDebugLabels: false }),
}));
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
it("shows date text and opens sitting controls in a sheet", async () => {
  const { container } = render(
    <ProjectDisclosure
      sittings={sittings.map(s => ({ ...s, rescheduled: s.id === 3 }))}
    >
      <ProjectSittings
        sittings={sittings}
        render={s => <button>Sitting {s.id}</button>}
      />
    </ProjectDisclosure>
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText("Rescheduled")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sitting 3" })).toBeNull();
  fireEvent.click(screen.getByText("View sittings"));
  await waitFor(() =>
    expect(
      screen.getByRole("dialog", { name: "Project sittings" })
    ).toBeTruthy()
  );
  expect(screen.getAllByRole("button", { name: /^Sitting / })).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Sitting 3" })).toBeNull()
  );
});
it("opens the project for a sitting deep link", () => {
  render(
    <ProjectDisclosure sittings={sittings} reveal>
      <ProjectSittings
        sittings={sittings}
        render={s => <button>Sitting {s.id}</button>}
      />
    </ProjectDisclosure>
  );
  expect(screen.getByRole("button", { name: "Sitting 5" })).toBeTruthy();
});
