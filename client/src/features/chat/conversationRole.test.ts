import { describe, expect, it } from "vitest";
import { isConversationArtist, isConversationClient } from "./conversationRole";

describe("conversation action permissions", () => {
  const conversation = { artistId: "provider", clientId: "recipient" };
  it("shows provider tools only to the artist assigned to the conversation", () => {
    expect(
      isConversationArtist({ id: "provider", role: "artist" }, conversation)
    ).toBe(true);
    expect(
      isConversationArtist({ id: "recipient", role: "artist" }, conversation)
    ).toBe(false);
    expect(
      isConversationArtist({ id: "unrelated", role: "admin" }, conversation)
    ).toBe(false);
  });
  it("keeps artist accounts on the client side of their own booking", () => {
    const artistAsClient = { id: "recipient", role: "artist" };
    expect(isConversationClient(artistAsClient, conversation.clientId)).toBe(
      true
    );
    expect(isConversationArtist(artistAsClient, conversation)).toBe(false);
  });
  it("never grants provider tools to a merchant or an unresolved conversation", () => {
    expect(
      isConversationArtist({ id: "provider", role: "merchant" }, conversation)
    ).toBe(false);
    expect(
      isConversationArtist({ id: "provider", role: "artist" }, undefined)
    ).toBe(false);
    expect(isConversationClient(undefined, "recipient")).toBe(false);
  });
});
