import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: false,
  status: {
    tier: "free",
    tierLabel: "Free",
    renewalDate: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
  } as any,
  checkout: vi.fn(),
  portal: vi.fn(),
  offer: vi.fn(() => ({ data: { amountCents: 9900 }, isLoading: false })),
  earnings: vi.fn(() => ({ data: { grossCents: 800000 } })),
}));
vi.mock("@/lib/platform", () => ({ isNativeApp: () => mocks.native }));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "a1", role: "artist" } }),
}));
vi.mock("@/components/tooltip-tour/TourHelp", () => ({ TourHelp: () => null }));
vi.mock("@/features/practice/PracticeContext", () => ({
  usePractice: () => null,
}));
vi.mock("./SubscriptionCheckout", () => ({
  SubscriptionCheckoutSheet: () => <div>Subscription checkout</div>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    billing: {
      subscriptionStatus: {
        useQuery: () => ({
          data: mocks.status,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      artistOffer: { useQuery: mocks.offer },
      createArtistCheckoutSession: {
        useMutation: () => ({ mutate: mocks.checkout, isPending: false }),
      },
      createArtistPortalSession: {
        useMutation: () => ({ mutate: mocks.portal, isPending: false }),
      },
    },
    payouts: { earningsBreakdown: { useQuery: mocks.earnings } },
  },
}));
import Plans from "./Plans";
import { PAGE_GUIDES } from "@/components/tooltip-tour/pageGuides";

const purchaseWords =
  /\$|AUD|month|subscribe|upgrade|choose (pro|studio)|set up|checkout|billing|website|tattoi\.app|browser|online/i;

beforeEach(() => {
  mocks.native = false;
  mocks.status = {
    tier: "free",
    tierLabel: "Free",
    renewalDate: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
  };
  mocks.offer.mockClear();
  mocks.earnings.mockClear();
});

describe("Plans on the web", () => {
  it("shows prices and lets a Free artist choose Pro", () => {
    render(<Plans />);
    expect(screen.getByRole("button", { name: "Choose Pro" })).toBeTruthy();
    expect(screen.getByText("$99.00")).toBeTruthy();
    expect(screen.getByText("$499.00")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set up Studio" })).toBeTruthy();
  });

  it("offers the billing portal to a subscriber", () => {
    mocks.status = {
      ...mocks.status,
      tier: "pro",
      tierLabel: "Pro",
      stripeSubscriptionId: "sub_1",
    };
    render(<Plans />);
    expect(
      screen.getByRole("button", { name: "Manage Pro billing" })
    ).toBeTruthy();
  });
});

describe("Plans in the native app", () => {
  beforeEach(() => {
    mocks.native = true;
  });

  it("shows only the current plan, with no price or way to buy", () => {
    const { container } = render(<Plans />);
    expect(screen.getByRole("heading", { name: "Free" })).toBeTruthy();
    expect(screen.getByText("Current plan")).toBeTruthy();
    // The plan-comparison page guide must not attach to the native screen.
    const title = screen.getByRole("heading", { level: 1 }).textContent || "";
    expect(PAGE_GUIDES.some(guide => guide.pages.test(title))).toBe(false);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector('a[href="/studio"]')).toBeNull();
    expect(container.querySelector('a[href^="http"]')).toBeNull();
    expect(container.textContent).not.toMatch(purchaseWords);
    expect(container.textContent).not.toMatch(/\bPro\b|\bStudio\b/);
    expect(mocks.offer).not.toHaveBeenCalled();
    expect(mocks.earnings).not.toHaveBeenCalled();
  });

  it("shows a subscriber their status without billing controls", () => {
    mocks.status = {
      tier: "pro",
      tierLabel: "Pro",
      renewalDate: "2026-12-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: "sub_1",
    };
    const { container } = render(<Plans />);
    expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
    expect(screen.getByText(/^Renews/)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.textContent).not.toMatch(purchaseWords);
  });
});
