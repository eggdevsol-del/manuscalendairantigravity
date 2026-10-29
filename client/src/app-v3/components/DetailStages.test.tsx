import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  OrderTrack,
  ProposalStage,
  SplitBar,
  StageRing,
  Voucher,
} from "./DetailStages";
import { sittingNextStep } from "./SessionStage";

describe("detail stages", () => {
  it("sizes split bar parts by value and leaves out empty parts", () => {
    const { container } = render(
      <SplitBar
        parts={[
          { label: "You", value: 9000, tone: "ok" },
          { label: "Tattoi", value: 1000 },
          { label: "Card fee", value: 0 },
        ]}
      />
    );
    const parts = container.querySelectorAll(".iosm-sbar i");
    expect(parts).toHaveLength(2);
    expect((parts[0] as HTMLElement).style.flex).toContain("9000");
    expect(parts[0].className).toBe("ok");
    expect(container.textContent).not.toContain("Card fee");
  });

  it("shows nothing when every part is empty", () => {
    const { container } = render(
      <SplitBar parts={[{ label: "Paid", value: 0 }]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("lights each order step up to the one reached", () => {
    const { container } = render(
      <OrderTrack steps={["Ordered", "Paid", "Shipped"]} reached={1} />
    );
    const steps = [...container.querySelectorAll("li")];
    expect(steps.map(s => s.className)).toEqual(["on", "on", ""]);
    expect(screen.getByLabelText("Order: Paid")).toBeTruthy();
  });

  it("fills a ring to its fraction and clamps it", () => {
    const { container, rerender } = render(
      <StageRing fraction={0.5} label="3/6" size={92} />
    );
    const c = 2 * Math.PI * 41;
    expect(container.querySelector(".fg")?.getAttribute("stroke-dasharray")).toBe(
      `${c * 0.5} ${c}`
    );
    rerender(<StageRing fraction={0} label="0" />);
    expect(container.querySelector(".fg")).toBeNull();
  });

  it("shows a proposal's sittings and how the price splits", () => {
    render(
      <ProposalStage
        face={<span />}
        who="Sam Lee"
        title="Full sleeve"
        summary="3 sittings × 6h · $6,000"
        sittings={[
          { key: 1, label: "4 Nov", state: "confirmed" },
          { key: 2, label: "date", state: "todo" },
        ]}
        depositLabel="Deposit $1,500"
        laterLabel="On the days"
        depositCents={150000}
        laterCents={450000}
      />
    );
    const stage = screen.getByRole("img", {
      name: "Full sleeve for Sam Lee: 3 sittings × 6h · $6,000",
    });
    expect(stage.textContent).toContain("4 Nov");
    expect(stage.textContent).toContain("Deposit $1,500");
    expect(stage.querySelectorAll(".iosm-sprog li")[1].className).toBe("todo");
  });

  it("shows a voucher with its terms", () => {
    render(
      <Voucher
        label="20% off: until 4 Dec"
        from="P Mason"
        value="20% off"
        title="Winter offer"
        valid="Until 4 Dec"
        foot="Preview of what clients receive"
      />
    );
    const voucher = screen.getByRole("img", { name: "20% off: until 4 Dec" });
    expect(voucher.textContent).toContain("Winter offer");
    expect(voucher.textContent).toContain("Preview of what clients receive");
  });
});

describe("live sitting next step", () => {
  const start = new Date("2026-11-04T10:00:00Z").getTime();
  const session = {
    id: 7,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 4 * 3600000).toISOString(),
    timeZone: "Australia/Brisbane",
    status: "confirmed",
    remainingCents: 80000,
  };
  const min = 60000;

  it("asks whether the client arrived from 15 minutes before the start", () => {
    expect(sittingNextStep(session, false, start - 16 * min)).toBeNull();
    expect(sittingNextStep(session, false, start - 15 * min)).toBe("arrived");
    expect(sittingNextStep(session, false, start + 60 * min)).toBe("arrived");
  });

  it("offers to finish once the client is in and the sitting has started", () => {
    expect(sittingNextStep(session, true, start - 5 * min)).toBeNull();
    expect(sittingNextStep(session, true, start + 5 * min)).toBe("finish");
    expect(sittingNextStep(session, true, start + 5 * 3600000)).toBe("finish");
  });

  it("still offers to finish when today's calendar has no arrival record", () => {
    expect(sittingNextStep(session, null, start + 5 * min)).toBe("finish");
  });

  it("has no next step for sittings that aren't confirmed", () => {
    for (const status of ["pending", "completed", "cancelled", "no-show"])
      expect(
        sittingNextStep({ ...session, status }, false, start + 5 * min)
      ).toBeNull();
  });
});
