import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { unconfirmedOutsideHours } from "@shared/businessHours";
import { OutsideHoursConfirm, useOutsideHours } from "./OutsideHoursConfirm";

const zone = "Australia/Brisbane";
const schedule = JSON.stringify(
  Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => [
      day,
      { enabled: true, start: "09:00", end: "17:30", type: "work" },
    ])
  )
);
// Monday 4:00–7:00 pm, Tuesday 10:00 am–12:00 pm (inside), Sunday 10:00 am–12:00 pm.
const sittings = [
  {
    start: "2027-02-01T06:00:00Z",
    end: "2027-02-01T09:00:00Z",
    sessionIndex: 1,
  },
  {
    start: "2027-02-02T00:00:00Z",
    end: "2027-02-02T02:00:00Z",
    sessionIndex: 2,
  },
  {
    start: "2027-02-07T00:00:00Z",
    end: "2027-02-07T02:00:00Z",
    sessionIndex: 3,
  },
];
const issues = unconfirmedOutsideHours(schedule, zone, sittings);

it("names each sitting outside hours with its time and the reason in plain words", () => {
  render(
    <OutsideHoursConfirm issues={issues} confirmed={[]} onToggle={() => {}} />
  );
  const group = screen.getByRole("group", {
    name: "Outside your business hours",
  });
  expect(group).toHaveAccessibleDescription(/Confirm each one/);
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Sitting 1 · Mon 1 Feb, 4:00 pm – 7:00 pm");
  expect(rows[0]).toHaveTextContent(
    "Ends 1 h 30 min after you close at 5:30 pm"
  );
  expect(rows[1]).toHaveTextContent(
    "Sitting 3 · Sun 7 Feb, 10:00 am – 12:00 pm"
  );
  expect(rows[1]).toHaveTextContent("You’re closed on Sundays");
});

it("confirms each sitting separately and offers a way back to change the time", () => {
  const onToggle = vi.fn(),
    onChangeTime = vi.fn();
  render(
    <OutsideHoursConfirm
      issues={issues}
      confirmed={[issues[0].key]}
      onToggle={onToggle}
      onChangeTime={onChangeTime}
    />
  );
  const [first, second] = screen.getAllByRole("button", {
    name: /^Book anyway/,
  });
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(first).toHaveTextContent("Confirmed");
  expect(second).toHaveAttribute("aria-pressed", "false");
  expect(second).toHaveAccessibleName(/Sitting 3 · Sun 7 Feb/);
  expect(screen.getByRole("status")).toHaveTextContent("1 still to confirm.");
  fireEvent.click(second);
  expect(onToggle).toHaveBeenCalledWith(issues[1].key);
  fireEvent.click(screen.getByRole("button", { name: "Change the time" }));
  expect(onChangeTime).toHaveBeenCalled();
});

it("renders nothing when every sitting is inside hours and takes focus when asked", () => {
  const { rerender, container } = render(
    <OutsideHoursConfirm issues={[]} confirmed={[]} onToggle={() => {}} />
  );
  expect(container).toBeEmptyDOMElement();
  rerender(
    <OutsideHoursConfirm
      issues={issues}
      confirmed={[]}
      onToggle={() => {}}
      attention={1}
    />
  );
  expect(screen.getByRole("group")).toHaveFocus();
});

function Harness() {
  const [list, setList] = useState(sittings);
  const hours = useOutsideHours(list, schedule, zone);
  return (
    <>
      <OutsideHoursConfirm
        issues={hours.issues}
        confirmed={hours.confirmed}
        onToggle={hours.toggle}
      />
      <pre data-testid="state">
        {JSON.stringify([hours.pending.length, hours.confirmed])}
      </pre>
      <button
        onClick={() =>
          setList(rows =>
            rows.map((row, i) =>
              i === 0 ? { ...row, end: "2027-02-01T10:00:00Z" } : row
            )
          )
        }
      >
        Lengthen first
      </button>
    </>
  );
}
it("keeps a confirmation tied to one sitting at one time", () => {
  render(<Harness />);
  const state = () => JSON.parse(screen.getByTestId("state").textContent!);
  expect(state()).toEqual([2, []]);
  fireEvent.click(screen.getAllByRole("button", { name: /^Book anyway/ })[0]);
  expect(state()).toEqual([1, [issues[0].key]]);
  // Changing that sitting drops its confirmation; the other sitting was never covered by it.
  fireEvent.click(screen.getByRole("button", { name: "Lengthen first" }));
  expect(state()).toEqual([2, []]);
  for (const button of screen.getAllByRole("button", { name: /^Book anyway/ }))
    expect(button).toHaveAttribute("aria-pressed", "false");
});

function Sheet({ list }: { list: typeof sittings }) {
  const hours = useOutsideHours(list, schedule, zone);
  const [message, setMessage] = useState("");
  return (
    <>
      <OutsideHoursConfirm
        issues={hours.issues}
        confirmed={hours.confirmed}
        onToggle={hours.toggle}
      />
      <pre data-testid="state">
        {JSON.stringify([hours.pending.length, hours.confirmed])}
      </pre>
      <p data-testid="message">{message}</p>
      <button
        onClick={() => {
          const error = Object.assign(new Error("server said no"), {
            data: {
              outsideHours: [
                { ...issues[0], key: "2027-02-01T20:00:00.000Z/x" },
              ],
            },
          });
          if (!hours.refuse(error)) setMessage(error.message);
        }}
      >
        Refuse another time
      </button>
      <button
        onClick={() => {
          const error = Object.assign(new Error("server said no"), {
            data: {
              outsideHours: [
                {
                  ...issues[0],
                  key: "2027-02-02T00:00:00.000Z/2027-02-02T02:00:00.000Z",
                  sessionIndex: undefined,
                },
              ],
            },
          });
          setMessage(String(Number(hours.refuse(error))));
        }}
      >
        Refuse the second
      </button>
      <button onClick={hours.reset}>Reopen</button>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
it("does not swallow a refusal about a time that is not on screen", () => {
  render(<Sheet list={sittings.slice(1, 2)} />);
  fireEvent.click(screen.getByRole("button", { name: "Refuse another time" }));
  // Nothing here can answer it, so the caller is told to show the server's message.
  expect(screen.getByTestId("message")).toHaveTextContent("server said no");
  expect(screen.queryByRole("group")).toBeNull();
  // A refusal about the sitting on screen is taken and asked about.
  fireEvent.click(screen.getByRole("button", { name: "Refuse the second" }));
  expect(screen.getByTestId("message")).toHaveTextContent("1");
  expect(screen.getByRole("group")).toBeInTheDocument();
  expect(state()).toEqual([1, []]);
});
it("forgets a confirmation when the sheet is opened again for another sitting", () => {
  render(<Sheet list={sittings.slice(2)} />);
  fireEvent.click(screen.getByRole("button", { name: /^Book anyway/ }));
  expect(state()).toEqual([0, [issues[1].key]]);
  fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
  expect(state()).toEqual([1, []]);
});
it("does not carry a confirmation to another sitting given the same time", () => {
  const { rerender } = render(<Sheet list={sittings} />);
  fireEvent.click(screen.getAllByRole("button", { name: /^Book anyway/ })[0]);
  expect(state()).toEqual([1, [issues[0].key]]);
  // Sitting 1 moves inside hours and sitting 2 takes the time that was confirmed for sitting 1.
  rerender(
    <Sheet
      list={[
        { ...sittings[1], sessionIndex: 1 },
        { ...sittings[0], sessionIndex: 2 },
        sittings[2],
      ]}
    />
  );
  expect(state()).toEqual([2, []]);
});
