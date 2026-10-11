import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ credit: 10000 }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    sessionPlans: {
      getById: {
        useQuery: () => ({
          data: {
            status: "pending",
            requiresDeposit: true,
            artist: { name: "QA Artist" },
            items: [],
            totalEstimateCents: 120000,
            depositTotalCents: state.credit ? 20000 : 30000,
            platformFeeCents: 680,
            offerSummary: state.credit ? { creditCents: state.credit } : null,
          },
          refetch: vi.fn(),
        }),
      },
      accept: { useMutation: () => ({ mutate: vi.fn() }) },
      // Reproduce an unavailable offer-options read: the persisted plan must suffice.
      offerOptions: {
        useQuery: () => ({ data: { applied: null }, refetch: vi.fn() }),
      },
    },
  },
}));
vi.mock("../components/Offers", () => ({
  CheckoutOffers: () => null,
  OfferBalancePayment: () => null,
}));
vi.mock("../components/ProposedSittingCard", () => ({
  ProposedSittingCard: () => null,
}));
vi.mock("@/components/ui/ssot/DotsCheckout", () => ({
  DotsCheckout: () => null,
}));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ children }: any) => <div>{children}</div>,
}));
import { SessionPlanCheckoutSheet } from "./Checkout";
beforeEach(() => {
  state.credit = 10000;
});
describe("voucher deposit review", () => {
  it("counts persisted voucher credit once alongside cash, even without offer options", () => {
    render(
      <SessionPlanCheckoutSheet
        sessionPlanId={21}
        conversationId={681}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Cash deposit due now")).toBeInTheDocument();
    expect(screen.getByText("Voucher credit applied")).toBeInTheDocument();
    expect(screen.getByText(/estimated session balance/)).toHaveTextContent(
      "$900.00"
    );
    expect(screen.getByText(/estimated session balance/)).not.toHaveTextContent(
      "$1,000.00"
    );
    expect(screen.getByText("$206.80")).toBeInTheDocument();
  });
  it("keeps ordinary deposits unchanged", () => {
    state.credit = 0;
    render(
      <SessionPlanCheckoutSheet
        sessionPlanId={21}
        conversationId={681}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Deposit due now")).toBeInTheDocument();
    expect(
      screen.queryByText("Voucher credit applied")
    ).not.toBeInTheDocument();
    expect(screen.getByText(/estimated session balance/)).toHaveTextContent(
      "$900.00"
    );
  });
});
