import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clients: [] as any[],
  addError: null as any,
  add: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    clientProfile: {
      getClientNotes: {
        useQuery: () => ({
          data: [{ id: "n1", note: "Prefers mornings" }],
          refetch: vi.fn(),
        }),
      },
      addClientNote: {
        useMutation: () => ({
          mutate: mocks.add,
          isPending: false,
          error: mocks.addError,
        }),
      },
    },
    conversations: {
      getClients: { useQuery: () => ({ data: mocks.clients }) },
    },
  },
}));

import { CLIENT_NOTES_PENDING, ClientNotes, isForbidden } from "./ClientNotes";

describe("ClientNotes", () => {
  beforeEach(() => {
    mocks.clients = [];
    mocks.addError = null;
    mocks.add.mockReset();
  });

  it("lets the artist save a note for a client they work with", () => {
    mocks.clients = [{ id: "c1", profileAvailable: true }];
    render(<ClientNotes clientId="c1" draft="Bring stencil" />);
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    expect(mocks.add).toHaveBeenCalledWith({
      clientId: "c1",
      note: "Bring stencil",
    });
    expect(screen.getByText("Prefers mornings")).toBeInTheDocument();
  });

  it("keeps the form when the client list has not loaded or is older", () => {
    mocks.clients = [null, { id: "c1" }];
    render(<ClientNotes clientId="c1" />);
    expect(screen.getByLabelText("New note")).toBeInTheDocument();
  });

  it("explains calmly, with no form or retry, when the relationship is not proven yet", () => {
    mocks.clients = [{ id: "c1", profileAvailable: false }];
    render(<ClientNotes clientId="c1" draft="Bring stencil" />);
    expect(screen.getByText(CLIENT_NOTES_PENDING)).toBeInTheDocument();
    expect(screen.queryByLabelText("New note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Notes the artist already wrote stay readable.
    expect(screen.getByText("Prefers mornings")).toBeInTheDocument();
  });

  it("shows the same explanation when the server refuses the save", () => {
    mocks.clients = [{ id: "c1", profileAvailable: true }];
    mocks.addError = { data: { code: "FORBIDDEN" } };
    render(<ClientNotes clientId="c1" />);
    expect(screen.getByText(CLIENT_NOTES_PENDING)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still reports other save failures and keeps the draft", () => {
    mocks.addError = { data: { code: "INTERNAL_SERVER_ERROR" } };
    render(<ClientNotes clientId="c1" draft="Bring stencil" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t save");
    expect(screen.getByLabelText("New note")).toHaveValue("Bring stencil");
  });

  it("recognises only a FORBIDDEN tRPC error", () => {
    expect(isForbidden({ data: { code: "FORBIDDEN" } })).toBe(true);
    expect(isForbidden({ data: { code: "NOT_FOUND" } })).toBe(false);
    expect(isForbidden(null)).toBe(false);
  });
});
