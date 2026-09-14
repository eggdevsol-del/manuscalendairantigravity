import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMutations } from "./useChatMutations";

const mocks = vi.hoisted(() => ({
  sendOptions: null as any,
  cachedMessages: undefined as any[] | undefined,
  invalidate: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    trpc: {
      useUtils: () => ({
        conversations: { getById: { invalidate: mocks.invalidate } },
        messages: {
          list: {
            cancel: vi.fn(),
            getData: () => mocks.cachedMessages,
            setData: (_key: unknown, value: any) => {
              mocks.cachedMessages =
                typeof value === "function"
                  ? value(mocks.cachedMessages)
                  : value;
            },
            invalidate: mocks.invalidate,
          },
        },
        appointments: { getByConversation: { invalidate: mocks.invalidate } },
      }),
      conversations: {
        pinConsultation: { useMutation: mutation },
        markAsRead: { useMutation: mutation },
      },
      messages: {
        updateMetadata: { useMutation: mutation },
        send: {
          useMutation: (options: any) => {
            mocks.sendOptions = options;
            return mutation();
          },
        },
      },
      upload: { uploadImage: { useMutation: mutation } },
      appointments: {
        bookProject: { useMutation: mutation },
        deleteProposal: { useMutation: mutation },
      },
    },
  };
});

function useTestComposer(initial: string) {
  const [text, setText] = useState(initial);
  useChatMutations(
    12,
    { id: "artist", name: "Artist" },
    {
      setMessageText: setText,
      setShowClientConfirmDialog: vi.fn(),
      setUploadingImage: vi.fn(),
    }
  );
  return { text, setText };
}

beforeEach(() => {
  mocks.cachedMessages = undefined;
  vi.clearAllMocks();
});

describe("chat send recovery", () => {
  it("clears a text draft only after that exact message succeeds", async () => {
    const hook = renderHook(() => useTestComposer("The first message"));
    await act(() =>
      mocks.sendOptions.onSuccess(
        {},
        {
          messageType: "text",
          content: "The first message",
        }
      )
    );
    expect(hook.result.current.text).toBe("");
  });

  it("preserves a newer draft typed while the previous message is sending", async () => {
    const hook = renderHook(() => useTestComposer("The first message"));
    act(() => hook.result.current.setText("A second message in progress"));
    await act(() =>
      mocks.sendOptions.onSuccess(
        {},
        {
          messageType: "text",
          content: "The first message",
        }
      )
    );
    expect(hook.result.current.text).toBe("A second message in progress");
  });

  it("does not discard a text draft when a photo finishes sending", async () => {
    const hook = renderHook(() =>
      useTestComposer("Here is the placement I meant")
    );
    await act(() =>
      mocks.sendOptions.onSuccess(
        {},
        {
          messageType: "image",
          content: "https://example.com/placement.png",
        }
      )
    );
    expect(hook.result.current.text).toBe("Here is the placement I meant");
  });

  it("removes a failed optimistic first message and keeps its draft for retry", async () => {
    const hook = renderHook(() => useTestComposer("Please book this date"));
    const message = {
      conversationId: 12,
      messageType: "text",
      content: "Please book this date",
    };
    const context = await mocks.sendOptions.onMutate(message);
    expect(mocks.cachedMessages).toHaveLength(1);
    act(() =>
      mocks.sendOptions.onError(new Error("Offline"), message, context)
    );
    expect(mocks.cachedMessages).toEqual([]);
    expect(hook.result.current.text).toBe("Please book this date");
  });

  it("keeps messages received while a send was pending when that send fails", async () => {
    renderHook(() => useTestComposer("Outgoing message"));
    const original = { id: 1, content: "Earlier message" };
    const incoming = { id: 2, content: "New message from the client" };
    mocks.cachedMessages = [original];
    const outgoing = {
      conversationId: 12,
      messageType: "text",
      content: "Outgoing message",
    };
    const context = await mocks.sendOptions.onMutate(outgoing);
    mocks.cachedMessages = [...mocks.cachedMessages!, incoming];
    act(() =>
      mocks.sendOptions.onError(new Error("Offline"), outgoing, context)
    );
    expect(mocks.cachedMessages).toEqual([original, incoming]);
  });
});
