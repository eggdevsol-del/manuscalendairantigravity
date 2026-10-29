import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChairStage, ProductSheet, StoreShelves } from "./SupplyStore";
import type { StoreProduct } from "../design/supplyStore";

vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ isOpen, children }: any) => (isOpen ? <div>{children}</div> : null),
}));

const liners: StoreProduct = {
  id: 5,
  title: "Liner cartridges",
  category: "Needles",
  imageUrl: null,
  variants: [
    { id: 50, name: "3RL", priceCents: 2500, stock: 4 },
    { id: 51, name: "5RL", priceCents: 2700, stock: 0 },
  ],
};

describe("ProductSheet", () => {
  it("prices the quantity on the slider and adds it to the tray", () => {
    const onAdd = vi.fn();
    render(
      <ProductSheet
        product={liners}
        sub="Needles"
        currency="AUD"
        inTray={id => (id === 50 ? 1 : 0)}
        onAdd={onAdd}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("1 already in your tray")).toBeTruthy();
    expect(screen.getByRole("button", { name: /5RL/ })).toHaveProperty("disabled", true);
    const slider = screen.getByRole("slider", { name: "Quantity" });
    expect(slider.getAttribute("aria-valuemax")).toBe("3");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(screen.getByText("1 left after yours")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Add 2 to tray/ }));
    expect(onAdd).toHaveBeenCalledWith(liners.variants[0], 2);
  });
});

describe("StoreShelves", () => {
  it("shows one shelf per category and a grid once a category is picked", () => {
    const ink: StoreProduct = {
      id: 6,
      title: "Lining black",
      category: "Ink",
      imageUrl: null,
      variants: [{ id: 60, name: "Default Title", priceCents: 1800, stock: 12 }],
    };
    const onOpen = vi.fn();
    render(
      <StoreShelves
        products={[liners, ink]}
        currency="AUD"
        storeName="Harbour Supply"
        onOpen={onOpen}
      />
    );
    expect(screen.getByRole("heading", { name: "Needles" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ink" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ink" }));
    expect(screen.queryByRole("heading", { name: "Needles" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Lining black/ }));
    expect(onOpen).toHaveBeenCalledWith(ink);
  });
});

describe("StoreShelves paging", () => {
  it("shows every product on its shelf, and the category as a grid sixty at a time", () => {
    const many = (category: string, from: number, n: number): StoreProduct[] =>
      Array.from({ length: n }, (_, i) => ({
        id: from + i,
        title: `${category} ${i + 1}`,
        category,
        imageUrl: null,
        variants: [{ id: from + i, name: "", priceCents: 1000, stock: 1 }],
      }));
    render(
      <StoreShelves
        products={[...many("Needles", 1, 70), ...many("Ink", 200, 3)]}
        currency="AUD"
        storeName="Harbour Supply"
        counts={false}
        onOpen={() => {}}
      />
    );
    expect(screen.getAllByRole("button", { name: /^Needles \d+,/ })).toHaveLength(70);
    expect(screen.getAllByRole("button", { name: /^Ink \d+,/ })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /In stock$/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "See all 70 in Needles" }));
    expect(screen.getAllByRole("button", { name: /^Needles \d+,/ })).toHaveLength(60);
    fireEvent.click(screen.getByRole("button", { name: "Show more · 10 to go" }));
    expect(screen.getAllByRole("button", { name: /^Needles \d+,/ })).toHaveLength(70);
  });
});

describe("ChairStage", () => {
  // jsdom has no PointerEvent; a MouseEvent with a pointer id carries clientX the same way.
  if (!("PointerEvent" in window))
    (window as any).PointerEvent = class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: any = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    };
  // Friday 30 October 2026 onwards: open Monday to Wednesday for 8 hours, 6 hours booked on Tuesday 3 November
  // and 4 on Monday 30 November.
  const days = Array.from({ length: 90 }, (_, i) => {
    const day = new Date(2026, 9, 30 + i).getTime();
    const dow = new Date(day).getDay();
    const hours = i === 4 ? 6 : i === 31 ? 4 : 0;
    return { day, open: dow >= 1 && dow <= 3 ? 8 : 0, hours, sittings: hours ? 1 : 0 };
  });
  const current = () =>
    screen.getAllByRole("button", { name: /^Show your next/ }).find(b => b.getAttribute("aria-current") === "true")
      ?.getAttribute("aria-label");

  it("swipes between the week, the month and 90 days", () => {
    const { container } = render(<ChairStage days={days} />);
    const slide = (n: string) => container.querySelector(`[aria-label="${n}"]`)?.textContent;
    const card = screen.getByLabelText(/Swipe or use the arrow keys/);
    expect(current()).toBe("Show your next 7 days");
    expect(slide("1 of 3: Your next 7 days")).toContain("Booked 6 of 24 open hours");
    expect(slide("2 of 3: Your next month")).toContain("Booked 6 of 96 open hours");
    expect(slide("2 of 3: Your next month")).toContain("2 Nov");
    expect(slide("3 of 3: Your next 90 days")).toContain("2 sittings");
    expect(slide("3 of 3: Your next 90 days")).toContain("Dec");
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(current()).toBe("Show your next month");
    fireEvent.keyDown(card, { key: "ArrowRight" });
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(current()).toBe("Show your next 90 days");
    fireEvent.click(screen.getByRole("button", { name: "Show your next 7 days" }));
    expect(current()).toBe("Show your next 7 days");
  });

  it("follows a sideways drag and settles on the next range", () => {
    render(<ChairStage days={days} />);
    const card = screen.getByLabelText(/Swipe or use the arrow keys/);
    fireEvent.pointerDown(card, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 200, pointerId: 1 });
    expect(current()).toBe("Show your next month");
    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 210, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 210, pointerId: 1 });
    expect(current()).toBe("Show your next month");
  });
});
