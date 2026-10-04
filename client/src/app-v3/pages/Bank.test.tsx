import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  status: {
    connected: false,
    statusAvailable: true,
    accountType: "standard",
  } as any,
  create: vi.fn(),
  initialize: vi.fn((options: any) => ({ logout: vi.fn().mockResolvedValue(undefined) })),
  session: vi.fn(),
  refetch: vi.fn(),
  onboarding: null as any,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    artistSettings: {
      getPayoutSchedule: { useQuery: () => ({ data: null }) },
      updatePayoutSchedule: { useMutation: () => ({}) },
      disconnectStripe: { useMutation: () => ({}) },
      getStripeConnectStatus: {
        useQuery: () => ({
          data: mocks.status,
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
vi.mock("@stripe/connect-js/pure", () => ({
  loadConnectAndInitialize: mocks.initialize,
}));
vi.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: any) => <>{children}</>,
  ConnectAccountOnboarding: (props: any) => {
    mocks.onboarding = props;
    return <div>Embedded Stripe onboarding</div>;
  },
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
  mocks.status = {
    connected: false,
    statusAvailable: true,
    accountType: "standard",
  };
  mocks.refetch.mockResolvedValue({});
  mocks.initialize.mockReset().mockImplementation(() => ({ logout: vi.fn().mockResolvedValue(undefined) }));
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
  it.each(["standard", "express", "custom"])(
    "opens existing %s accounts in-app without replacing their account",
    async accountType => {
      mocks.status = { connected: true, statusAvailable: true, accountType };
      render(<Bank />);
      fireEvent.click(
        screen.getByRole("button", { name: "Review account details" })
      );
      await screen.findByText("Embedded Stripe onboarding");
      expect(mocks.create).not.toHaveBeenCalled();
    }
  );
  it("opens a newly created Standard account without waiting for the status refresh", async () => {
    mocks.create.mockResolvedValue({ accountType: "standard", url: null });
    mocks.refetch.mockReturnValue(new Promise(() => {}));
    render(<Bank />);
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await screen.findByText("Embedded Stripe onboarding");
    expect(mocks.create).toHaveBeenCalledWith({ embedded: true });
  });
  it("shows SDK initialisation errors and lets the artist retry in-app", async () => {
    mocks.create.mockResolvedValue({ accountType: "custom", url: null });
    mocks.initialize.mockImplementationOnce(() => {
      throw new Error("Stripe setup failed to initialise");
    });
    render(<Bank />);
    fireEvent.click(screen.getByRole("button", { name: "Set up payments" }));
    await screen.findByText("Stripe setup failed to initialise");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Embedded Stripe onboarding");
  });
});

describe("embedded verification loading", () => {
  it("shows recovery when the SDK never renders its loader", async () => {
    vi.useFakeTimers();
    try {
      mocks.status = {
        connected: true,
        statusAvailable: true,
        accountType: "custom",
      };
      render(<Bank />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Review account details" })
        );
      });
      expect(screen.getByRole("status").textContent).toContain(
        "Loading secure Stripe verification"
      );
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByRole("alert").textContent).toContain(
        "taking too long"
      );
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps the form open after Stripe begins rendering", async () => {
    vi.useFakeTimers();
    try {
      mocks.status = {
        connected: true,
        statusAvailable: true,
        accountType: "express",
      };
      render(<Bank />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Review account details" })
        );
      });
      act(() =>
        mocks.onboarding.onLoaderStart({ elementTagName: "account-onboarding" })
      );
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("Embedded Stripe onboarding")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
