import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  initialize: vi.fn((options: any) => ({ logout: vi.fn() })),
  session: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    artistSettings: {
      getStripeConnectStatus: {
        useQuery: () => ({
          data: { connected: false, statusAvailable: true },
          refetch: mocks.refetch,
        }),
      },
      getStripeOnboardingConfig: {
        useQuery: () => ({ data: { publishableKey: "pk_test_runtime" } }),
      },
      connectStripe: { useMutation: () => ({ mutateAsync: mocks.create }) },
      getStripeAccountLink: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));
vi.mock("@/lib/trpcVanilla", () => ({
  trpcVanilla: {
    artistSettings: { createStripeAccountSession: { mutate: mocks.session } },
  },
}));
vi.mock("@stripe/connect-js", () => ({
  loadConnectAndInitialize: mocks.initialize,
}));
vi.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: any) => <>{children}</>,
  ConnectAccountOnboarding: () => <div>Embedded Stripe onboarding</div>,
}));
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: ({ children }: any) => <div role="dialog">{children}</div>,
}));
vi.mock("../design/primitives", () => ({
  Screen: ({ children }: any) => <main>{children}</main>,
  Panel: ({ children }: any) => <div>{children}</div>,
  Action: ({ tone, ...props }: any) => <button {...props} />,
  ActionLink: ({ children }: any) => <span>{children}</span>,
  Feedback: () => null,
  Row: () => null,
  Section: ({ children }: any) => <div>{children}</div>,
  Status: ({ children }: any) => <span>{children}</span>,
}));
import Bank from "./Bank";
beforeEach(() => {
  mocks.create.mockReset();
  mocks.initialize.mockClear();
  mocks.session.mockResolvedValue({ clientSecret: "session_secret" });
});
describe("new artist payment setup", () => {
  it("opens in-app Stripe onboarding with runtime publishable configuration", async () => {
    mocks.create.mockResolvedValue({ accountType: "custom", url: null });
    render(<Bank />);
    expect(screen.getByText("Your identity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await screen.findByText("Embedded Stripe onboarding");
    expect(mocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ publishableKey: "pk_test_runtime" })
    );
    const options = mocks.initialize.mock.calls[0][0] as any;
    expect(await options.fetchClientSecret()).toBe("session_secret");
  });
  it("reports creation failure and allows another attempt", async () => {
    mocks.create.mockRejectedValue(new Error("Stripe is unavailable"));
    render(<Bank />);
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Stripe is unavailable"
      )
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
