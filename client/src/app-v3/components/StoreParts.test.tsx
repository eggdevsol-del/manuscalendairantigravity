import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockShelf, StorePhone, stockOf, type ShelfProduct } from "./StoreParts";
import { PassCard, ProjectPostcards } from "./ClientParts";

const balm: ShelfProduct = {
  id: 1,
  title: "Tattoo balm",
  priceCents: 5000,
  inventoryCount: 40,
  imageUrl: null,
  isActive: 1,
  variants: [],
};
const needles: ShelfProduct = {
  id: 2,
  title: "Needles",
  priceCents: 4500,
  inventoryCount: 0,
  imageUrl: "/needles.jpg",
  isActive: 0,
  variants: [
    { id: 21, name: "3RL", priceCents: 4500, inventoryCount: 3 },
    { id: 22, name: "7RM", priceCents: 4800, inventoryCount: 17 },
  ],
};

describe("stock shelf", () => {
  it("fills each jar against the best-stocked product and marks low stock", () => {
    const { container } = render(
      <StockShelf products={[balm, needles]} threshold={5} saving={false} onSave={() => {}} />
    );
    expect(stockOf(needles)).toBe(20);
    const fills = [...container.querySelectorAll(".iosm-jar i")].map(
      i => (i as HTMLElement).style.height
    );
    expect(fills).toEqual(["100%", "50%"]);
    expect(screen.getByRole("button", { name: /Needles/ }).textContent).toContain(
      "20 left · low"
    );
  });

  it("does not mark low stock without the store's threshold", () => {
    render(<StockShelf products={[needles]} saving={false} onSave={() => {}} />);
    expect(screen.getByRole("button", { name: /Needles/ }).textContent).not.toContain("low");
  });

  it("slides each option's count and saves only the stock", () => {
    const onSave = vi.fn();
    render(<StockShelf products={[balm, needles]} saving={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Needles/ }));
    const save = screen.getByRole("button", { name: "Save stock" });
    expect(save).toHaveProperty("disabled", true);
    const slider = screen.getByRole("slider", { name: "3RL" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /Needles/ }).textContent).toContain("22 left");
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(needles, { 21: 5, 22: 17 });
  });

  it("counts a product without options on one slider", () => {
    const onSave = vi.fn();
    render(<StockShelf products={[balm]} saving={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Tattoo balm/ }));
    fireEvent.keyDown(screen.getByRole("slider", { name: "Tattoo balm in stock" }), {
      key: "ArrowLeft",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save stock" }));
    expect(onSave).toHaveBeenCalledWith(balm, { 0: 39 });
  });
});

describe("store phone", () => {
  it("shows the store's published products and whether it's open", () => {
    render(
      <StorePhone
        label="Your store as artists see it"
        name="Inkjecta"
        status="Open on Tattoi"
        open
        products={[balm, needles]}
        currency="AUD"
      />
    );
    const phone = screen.getByRole("img", { name: "Your store as artists see it" });
    expect(phone.textContent).toContain("Tattoo balm");
    expect(phone.textContent).toContain("$50.00");
    expect(phone.textContent).not.toContain("Needles");
    expect(phone.textContent).toContain("Shop");
  });

  it("says when nothing is published yet", () => {
    render(
      <StorePhone
        label="Shop"
        name="Inkjecta"
        status="Hidden from artists"
        open={false}
        products={[needles]}
        currency="AUD"
      />
    );
    expect(screen.getByRole("img", { name: "Shop" }).textContent).toContain(
      "No published products yet"
    );
  });
});

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: Record<string, any>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("client parts", () => {
  it("shows each tattoo with its sittings done", () => {
    render(
      <ProjectPostcards
        projects={[
          {
            key: "plan:7",
            name: "Back piece",
            artist: "P Mason",
            image: null,
            done: 2,
            total: 4,
            next: null,
            last: 0,
            href: "/projects/12?session=3",
          },
        ]}
      />
    );
    const card = screen.getByRole("link", {
      name: "Back piece with P Mason, 2 of 4 sittings done",
    });
    expect(card.getAttribute("href")).toBe("/projects/12?session=3");
  });

  it("shows the client's pass", () => {
    render(<PassCard name="Sam Lee" detail="sam@example.com" facts={["2 vouchers", "3 tattoos"]} />);
    const pass = screen.getByRole("region", { name: "Tattoi client pass for Sam Lee" });
    expect(pass.textContent).toContain("2 vouchers · 3 tattoos");
  });
});
