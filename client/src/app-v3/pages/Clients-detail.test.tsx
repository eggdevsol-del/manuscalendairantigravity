import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clients: [] as any[],
  workspace: { data: undefined as any, error: null as any },
  location: "/clients",
  search: "",
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    conversations: {
      getClients: {
        useQuery: () => ({
          data: mocks.clients,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      createClient: {
        useMutation: () => ({
          mutate: vi.fn(),
          reset: vi.fn(),
          isPending: false,
          error: null,
        }),
      },
    },
    projects: {
      clientWorkspace: {
        useQuery: () => ({
          ...mocks.workspace,
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
    },
    clientProfile: {
      addClientNote: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
      },
    },
    appointments: {
      list: { useQuery: () => ({ data: [] }) },
      getArtistCalendar: { useQuery: () => ({ data: [] }) },
    },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "artist-1", role: "artist" } }),
}));
vi.mock("@/components/ui/overlays/sheet-shell", () => ({
  SheetShell: () => null,
}));
vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, vi.fn()],
  useSearch: () => mocks.search,
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import Clients, { ClientDetail } from "./Clients";
import {
  CLIENT_DETAILS_PENDING,
  CLIENT_NOTES_PENDING,
} from "../design/ClientNotes";

const workspace = {
  client: {
    id: "c1",
    name: "Mara Lind",
    email: "mara@example.com",
    phone: "+64 21 000 111",
    avatar: null,
    birthday: null,
  },
  conversationId: 7,
  sessions: [],
  notes: [{ id: 1, note: "Prefers mornings", createdAt: null }],
  forms: [],
};
const openNotes = () =>
  fireEvent.click(screen.getByRole("tab", { name: "Notes" }));

describe("ClientDetail", () => {
  beforeEach(() => {
    mocks.clients = [];
    mocks.workspace = { data: undefined, error: null };
    mocks.search = "";
  });

  it("explains calmly, with no retry, when the person is not the artist's client", () => {
    mocks.workspace.error = {
      data: { code: "FORBIDDEN" },
      message: "This client is not in your client list.",
    };
    render(<ClientDetail id="c1" onClose={vi.fn()} />);
    expect(
      screen.getByText(/isn’t one of your clients yet/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /try again|retry/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("This client is not in your client list.")
    ).not.toBeInTheDocument();
  });

  it("hides contact links and the note form while the relationship is not proven", () => {
    mocks.clients = [{ id: "c1", name: "Mara Lind", profileAvailable: false }];
    mocks.workspace.data = workspace;
    const { container } = render(<ClientDetail id="c1" onClose={vi.fn()} />);
    expect(screen.getByText(CLIENT_DETAILS_PENDING)).toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.queryByText("mara@example.com")).not.toBeInTheDocument();
    // Messaging stays open.
    expect(container.querySelector('a[href="/chat/7"]')).not.toBeNull();
    openNotes();
    expect(screen.getByText(CLIENT_NOTES_PENDING)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Private artist note")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Prefers mornings")).toBeInTheDocument();
  });

  it("also holds details back when the workspace answer itself says so", () => {
    mocks.clients = [{ id: "c1", name: "Mara Lind", profileAvailable: true }];
    mocks.workspace.data = { ...workspace, profileAvailable: false };
    const { container } = render(<ClientDetail id="c1" onClose={vi.fn()} />);
    expect(screen.getByText(CLIENT_DETAILS_PENDING)).toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("shows contact links and the note form for a proven client", () => {
    mocks.clients = [{ id: "c1", name: "Mara Lind", profileAvailable: true }];
    mocks.workspace.data = workspace;
    const { container } = render(<ClientDetail id="c1" onClose={vi.fn()} />);
    expect(screen.queryByText(CLIENT_DETAILS_PENDING)).not.toBeInTheDocument();
    expect(
      container.querySelector('a[href="mailto:mara@example.com"]')
    ).not.toBeNull();
    expect(container.querySelector('a[href^="tel:"]')).not.toBeNull();
    openNotes();
    expect(screen.getByLabelText("Private artist note")).toBeInTheDocument();
    expect(screen.queryByText(CLIENT_NOTES_PENDING)).not.toBeInTheDocument();
  });
});

describe("Clients search", () => {
  it("does not match clients whose contact details are held back on the word null", () => {
    mocks.clients = [
      { id: "c1", name: "Mara Lind", email: null, phone: null },
      { id: "c2", name: "Nulla Byrne", email: "n@example.com", phone: null },
    ];
    render(<Clients />);
    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "null" },
    });
    expect(
      screen.queryByRole("button", { name: /^Mara Lind/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Nulla Byrne/ })
    ).toBeInTheDocument();
  });
});
