import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ArtistSetupContext } from "./ArtistSetupContext";
import { useContext, useState } from "react";
const mocks = vi.hoisted(() => ({
  user: { id: "artist-a", role: "artist", hasCompletedOnboarding: 0 } as any,
  path: "/dashboard",
  go: vi.fn(),
  refresh: vi.fn(),
  complete: vi.fn(),
  progress: { nextStep: "profile", steps: [], complete: false } as any,
  next: null as any,
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    refresh: mocks.refresh,
    logout: vi.fn(),
  }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [mocks.path, mocks.go],
  Redirect: ({ to }: any) => <p>Redirect to {to}</p>,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      artistSetup: {
        useQuery: () => {
          const [data, setData] = useState(mocks.progress);
          return {
            data,
            refetch: async () => {
              setData(mocks.next);
              return { data: mocks.next };
            },
          };
        },
      },
      completeOnboarding: {
        useMutation: (options: any) => ({
          mutate: () => {
            mocks.complete();
            void options.onSuccess();
          },
          isPending: false,
        }),
      },
    },
  },
}));
function Step() {
  const setup = useContext(ArtistSetupContext)!;
  return (
    <>
      <p>Editing {setup.step}</p>
      <button onClick={() => void setup.onSaved()}>Save required step</button>
    </>
  );
}
vi.mock("@/app-v3/pages/SettingsEditors", () => ({
  AccountEditor: () => <Step />,
  BusinessEditor: () => <Step />,
}));
vi.mock("@/app-v3/pages/WorkingHours", () => ({ default: () => <Step /> }));
vi.mock("@/app-v3/pages/Bank", () => ({ default: () => <Step /> }));
vi.mock("@/app-v3/design/primitives", () => ({
  Action: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  Screen: ({ children }: any) => <main>{children}</main>,
  Feedback: () => null,
}));
import { ArtistSetupGate } from "./ArtistSetupGate";
const progress = (nextStep: string | null) => ({
  nextStep,
  complete: nextStep === null,
  steps: ["profile", "business", "hours", "services", "bank"].map(id => ({
    id,
    title: id,
    done: nextStep === null,
  })),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "artist-a", role: "artist", hasCompletedOnboarding: 0 };
  mocks.path = "/artist-setup";
  mocks.progress = progress("profile");
  mocks.refresh.mockResolvedValue({});
});
describe("compulsory artist setup flow", () => {
  it("redirects unfinished accounts away from live pages", () => {
    mocks.path = "/calendar";
    render(<ArtistSetupGate>Live calendar</ArtistSetupGate>);
    expect(screen.getByText("Redirect to /artist-setup")).toBeTruthy();
    expect(screen.queryByText("Live calendar")).toBeNull();
  });
  it("automatically opens every next requirement after a successful save", async () => {
    render(<ArtistSetupGate>Live app</ArtistSetupGate>);
    for (const step of ["business", "hours", "services", "bank"]) {
      mocks.next = progress(step);
      fireEvent.click(screen.getByText("Save required step"));
      await screen.findByText(`Editing ${step}`);
    }
    mocks.next = progress(null);
    fireEvent.click(screen.getByText("Save required step"));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.go).toHaveBeenCalledWith("/dashboard");
  });
  it("resumes the saved incomplete step without restarting", () => {
    mocks.progress = progress("services");
    render(<ArtistSetupGate>Live app</ArtistSetupGate>);
    expect(screen.getByText("Editing services")).toBeTruthy();
  });
  it("leaves completed accounts accessible", () => {
    mocks.user.hasCompletedOnboarding = 1;
    mocks.path = "/dashboard";
    render(<ArtistSetupGate>Live app</ArtistSetupGate>);
    expect(screen.getByText("Live app")).toBeTruthy();
  });
  it("allows safe practice without bypassing live setup", () => {
    mocks.path = "/practice";
    render(<ArtistSetupGate>Safe practice</ArtistSetupGate>);
    expect(screen.getByText("Safe practice")).toBeTruthy();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
