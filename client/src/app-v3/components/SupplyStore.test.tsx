import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductSheet, StoreShelves } from "./SupplyStore";
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
