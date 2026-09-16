import { renderHook, act } from "@testing-library/react";
import { useChatController } from "./useChatController";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: vi.fn(),
    conversations: {
      getById: { useQuery: vi.fn() },
      pinConsultation: { useMutation: vi.fn() },
      markAsRead: { useMutation: vi.fn() },
    },
    messages: {
      list: { useQuery: vi.fn() },
      send: { useMutation: vi.fn() },
      updateMetadata: { useMutation: vi.fn() },
    },
    quickActions: {
      list: { useQuery: vi.fn() },
    },
    artistSettings: {
      getPublicByArtistId: { useQuery: vi.fn(() => ({})) },
      get: { useQuery: vi.fn() },
    },
    consultations: {
      list: { useQuery: vi.fn() },
    },
    promotions: {
      redeemPromotion: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
    },
    appointments: {
      deleteProposal: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      bookProject: { useMutation: vi.fn() },
    },
    upload: {
      uploadImage: { useMutation: vi.fn() },
    },
  },
}));

// Import mocks to manipulate them
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

describe("useChatController", () => {
  // Setup mocks
  beforeEach(() => {
    (useAuth as any).mockReturnValue({
      user: { id: "123", role: "artist" },
      loading: false,
    });

    // Default mock implementations
    (trpc.useUtils as any).mockReturnValue({
      conversations: { getById: { invalidate: vi.fn() } },
      messages: {
        list: {
          invalidate: vi.fn(),
          cancel: vi.fn(),
          getData: vi.fn(),
          setData: vi.fn(),
        },
      },
      consultations: { list: { invalidate: vi.fn() } },
    });

    // Default queries
    (trpc.conversations.getById.useQuery as any).mockReturnValue({
      data: { id: 1 },
    });
    (trpc.messages.list.useQuery as any).mockReturnValue({ data: [] });
    (trpc.messages.send.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (trpc.quickActions.list.useQuery as any).mockReturnValue({});
    (trpc.artistSettings.get.useQuery as any).mockReturnValue({});
    (trpc.consultations.list.useQuery as any).mockReturnValue({});
    (trpc.conversations.markAsRead.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (trpc.upload.uploadImage.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (trpc.appointments.bookProject.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (trpc.messages.updateMetadata.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (trpc.conversations.pinConsultation.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
    });
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useChatController(1));
    expect(result.current.messageText).toBe("");
  });

  it("should update message text", () => {
    const { result } = renderHook(() => useChatController(1));
    act(() => {
      result.current.setMessageText("Hello");
    });
    expect(result.current.messageText).toBe("Hello");
  });

  it("should send a message", () => {
    const mutateMock = vi.fn();
    (trpc.messages.send.useMutation as any).mockReturnValue({
      mutate: mutateMock,
    });

    const { result } = renderHook(() => useChatController(1));

    act(() => {
      result.current.setMessageText("Hello");
    });

    act(() => {
      result.current.handleSendMessage();
    });

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Hello",
        conversationId: 1,
        messageType: "text",
      })
    );
  });

  it("follows a newly rendered message to the bottom without intermediate smooth-scroll events", () => {
    const { result, rerender } = renderHook(() => useChatController(1));
    const scrollTo = vi.fn();
    const viewport = document.createElement("div");
    Object.defineProperty(viewport, "scrollHeight", { value: 1800 });
    viewport.scrollTo = scrollTo;
    (result.current.viewportRef as any).current = viewport;
    (trpc.messages.list.useQuery as any).mockReturnValue({
      data: [{ id: 2, senderId: "123", content: "New message" }],
    });
    rerender();
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 1800,
      behavior: "instant",
    });
  });

  it("does not pull the reader away from older messages on an incoming update", () => {
    const { result, rerender } = renderHook(() => useChatController(1));
    const viewport = document.createElement("div");
    viewport.scrollTo = vi.fn();
    (result.current.viewportRef as any).current = viewport;
    act(() => result.current.setScrollIntent("USER_READING_HISTORY"));
    (trpc.messages.list.useQuery as any).mockReturnValue({
      data: [{ id: 2, senderId: "other", content: "Incoming message" }],
    });
    rerender();
    expect(viewport.scrollTo).not.toHaveBeenCalled();
  });

  it("should handle quick actions", () => {
    const mutateMock = vi.fn();
    (trpc.messages.send.useMutation as any).mockReturnValue({
      mutate: mutateMock,
    });
    const { result } = renderHook(() => useChatController(1));

    act(() => {
      result.current.handleQuickAction({
        actionType: "send_text",
        content: "Quick Reply",
      });
    });

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Quick Reply",
        messageType: "text",
      })
    );
  });
});
