// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  getUser: vi.fn(),
  list: vi.fn(),
  byId: vi.fn(),
  identity: vi.fn(),
  settings: vi.fn(),
  relationships: vi.fn(),
  shareStudio: vi.fn(),
  createUser: vi.fn(),
  database: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../db", () => ({
  getConversation: mocks.getConversation,
  createConversation: mocks.createConversation,
  createMessage: mocks.createMessage,
  getUser: mocks.getUser,
  createUser: mocks.createUser,
  getConversationsForUser: mocks.list,
  getConversationById: mocks.byId,
  resolveIdentity: mocks.identity,
  getArtistSettings: mocks.settings,
  getUnreadMessageCount: vi.fn(async () => 0),
}));
vi.mock("../services/core", () => ({ getDb: mocks.database }));
vi.mock("../services/pushService", () => ({
  hasActiveSubscription: mocks.push,
}));
vi.mock("../services/userService", () => ({
  getClientRelationships: mocks.relationships,
  shareStudio: mocks.shareStudio,
}));
import { conversationsRouter } from "./conversations";

const caller = (role: string, id: string) =>
  conversationsRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as any);
const sets = (related: string[] = [], unclaimed: string[] = []) => ({
  related: new Set(related),
  unclaimed: new Set(unclaimed),
});
const fullIdentity = {
  id: "mia",
  type: "user",
  name: "Mia Wong",
  firstName: "Mia",
  lastName: "Wong",
  email: "mia@example.com",
  phone: "0400000000",
  birthday: "1990-01-01",
  avatar: "a.png",
  role: "client",
  clerkId: "clerk_1",
  hasPassword: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConversation.mockResolvedValue(undefined);
  mocks.createConversation.mockImplementation(async input => ({
    id: 1,
    ...input,
  }));
  mocks.relationships.mockResolvedValue(sets());
  mocks.shareStudio.mockResolvedValue(false);
  mocks.database.mockResolvedValue({});
  mocks.push.mockResolvedValue(false);
  mocks.identity.mockResolvedValue({ ...fullIdentity });
  mocks.settings.mockResolvedValue(null);
});

describe("conversations.getOrCreate", () => {
  it("stops an artist opening a conversation with an unrelated user id", async () => {
    mocks.getUser.mockResolvedValue({ id: "victim", role: "client" });
    await expect(
      caller("artist", "artist").getOrCreate({
        artistId: "artist",
        clientId: "victim",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createConversation).not.toHaveBeenCalled();
  });

  it("stops an artist opening a conversation with an id that is not a user", async () => {
    mocks.getUser.mockResolvedValue(undefined);
    mocks.relationships.mockResolvedValue(sets(["ghost"]));
    await expect(
      caller("artist", "artist").getOrCreate({
        artistId: "artist",
        clientId: "ghost",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createConversation).not.toHaveBeenCalled();
  });

  it("lets an artist open a conversation with a client they already work with", async () => {
    mocks.getUser.mockResolvedValue({ id: "mia", role: "client" });
    mocks.relationships.mockResolvedValue(sets(["mia"]));
    await caller("artist", "artist").getOrCreate({
      artistId: "artist",
      clientId: "mia",
    });
    expect(mocks.createConversation).toHaveBeenCalledWith({
      artistId: "artist",
      clientId: "mia",
    });
  });

  it("lets studio colleagues talk", async () => {
    mocks.getUser.mockResolvedValue({ id: "colleague", role: "artist" });
    mocks.shareStudio.mockResolvedValue(true);
    await caller("artist", "artist").getOrCreate({
      artistId: "artist",
      clientId: "colleague",
    });
    expect(mocks.createConversation).toHaveBeenCalled();
  });

  it("returns an existing conversation without further checks", async () => {
    mocks.getConversation.mockResolvedValue({ id: 9 });
    expect(
      await caller("artist", "artist").getOrCreate({
        artistId: "artist",
        clientId: "mia",
      })
    ).toEqual({ id: 9 });
    expect(mocks.createConversation).not.toHaveBeenCalled();
  });

  it("lets a client start a conversation with a real artist only", async () => {
    mocks.getUser.mockResolvedValue({ id: "artist", role: "artist" });
    await caller("client", "mia").getOrCreate({
      artistId: "artist",
      clientId: "mia",
    });
    expect(mocks.createConversation).toHaveBeenCalledTimes(1);

    mocks.getUser.mockResolvedValue({ id: "other", role: "client" });
    await expect(
      caller("client", "mia").getOrCreate({
        artistId: "other",
        clientId: "mia",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createConversation).toHaveBeenCalledTimes(1);
  });
});

describe("the other person in a conversation", () => {
  beforeEach(() => {
    mocks.list.mockResolvedValue([
      { id: 1, artistId: "artist", clientId: "mia" },
    ]);
  });

  it("never carries sign-in details or birthday", async () => {
    mocks.relationships.mockResolvedValue(sets(["mia"], ["mia"]));
    const [row] = await caller("artist", "artist").list();
    expect(row.otherUser).not.toHaveProperty("clerkId");
    expect(row.otherUser).not.toHaveProperty("hasPassword");
    expect(row.otherUser).not.toHaveProperty("birthday");
  });

  it("gives an artist no contact details without a real relationship", async () => {
    const [row] = await caller("artist", "artist").list();
    expect(row.otherUser).toEqual({
      id: "mia",
      type: "user",
      name: "Mia Wong",
      firstName: "Mia",
      lastName: "Wong",
      avatar: "a.png",
      role: "client",
    });
  });

  it("gives an artist the email and phone of a client they work with", async () => {
    mocks.relationships.mockResolvedValue(sets(["mia"]));
    const [row] = await caller("artist", "artist").list();
    expect(row.otherUser?.email).toBe("mia@example.com");
    // The booking editor prefills from this and saves it back, so a missing
    // number here would wipe the client's real one.
    expect(row.otherUser?.phone).toBe("0400000000");
    expect(row.otherUser).not.toHaveProperty("unclaimed");

    mocks.byId.mockResolvedValue({
      id: 1,
      artistId: "artist",
      clientId: "mia",
    });
    const one = await caller("artist", "artist").getById(1);
    expect(one.otherUser?.phone).toBe("0400000000");
  });

  it("marks a client record nobody has signed in to", async () => {
    mocks.relationships.mockResolvedValue(sets(["mia"], ["mia"]));
    const [row] = await caller("artist", "artist").list();
    expect(row.otherUser?.unclaimed).toBe(true);
  });

  it("gives a client only the artist's public details", async () => {
    mocks.identity.mockResolvedValue({
      ...fullIdentity,
      id: "artist",
      role: "artist",
    });
    mocks.settings.mockResolvedValue({
      displayName: "Ink Studio",
      publicSlug: "ink",
    });
    const [row] = await caller("client", "mia").list();
    expect(row.otherUser).toMatchObject({
      name: "Ink Studio",
      publicSlug: "ink",
    });
    expect(row.otherUser).not.toHaveProperty("email");
    expect(row.otherUser).not.toHaveProperty("phone");
    expect(mocks.relationships).not.toHaveBeenCalled();

    mocks.byId.mockResolvedValue({
      id: 1,
      artistId: "artist",
      clientId: "mia",
    });
    const one = await caller("client", "mia").getById(1);
    expect(one.otherUser).not.toHaveProperty("email");
    expect(one.otherUser).not.toHaveProperty("clerkId");
  });
});

describe("conversations.bulkMessageClients", () => {
  it("only messages people the artist already has a conversation with", async () => {
    mocks.getConversation.mockImplementation(async (_artist, client) =>
      client === "mia" ? { id: 4 } : undefined
    );
    mocks.relationships.mockResolvedValue(sets(["mia"]));
    mocks.database.mockResolvedValue({
      select: () => ({ from: () => ({ where: async () => [] }) }),
    });
    const result = await caller("artist", "artist").bulkMessageClients({
      clientIds: ["mia", "victim"],
      messageContent: "Hello",
    });
    expect(result.count).toBe(1);
    expect(mocks.createConversation).not.toHaveBeenCalled();
    expect(mocks.createMessage).toHaveBeenCalledTimes(1);
  });
});

describe("conversations.createClient", () => {
  /** A database whose users lookup by email returns these rows. */
  const withAccounts = (rows: { id: string }[]) =>
    mocks.database.mockResolvedValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => rows }) }),
      }),
    });

  it("does not attach the artist to an existing account just because they know its email", async () => {
    withAccounts([{ id: "user_victim" }]);
    const conversation = await caller("artist", "artist").createClient({
      name: "x",
      email: "victim@example.com",
    });
    expect(mocks.relationships).toHaveBeenCalledWith(
      expect.anything(),
      "artist",
      ["user_victim"]
    );
    expect(conversation.clientId).not.toBe("user_victim");
    expect(conversation.clientId).toMatch(/^client_/);
    expect(mocks.getConversation).not.toHaveBeenCalledWith(
      "artist",
      "user_victim"
    );
    // The new record must not shadow the real account at sign-in.
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "client", email: null })
    );
  });

  it("reuses an account that is already this artist's client", async () => {
    withAccounts([{ id: "user_mia" }]);
    mocks.relationships.mockResolvedValue(sets(["user_mia"]));
    const conversation = await caller("artist", "artist").createClient({
      name: "Mia",
      email: "mia@example.com",
    });
    expect(conversation.clientId).toBe("user_mia");
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("creates a new client record with the details the artist typed", async () => {
    withAccounts([]);
    const conversation = await caller("artist", "artist").createClient({
      name: "New Person",
      email: "new@example.com",
      phone: "0411111111",
    });
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: conversation.clientId,
        name: "New Person",
        email: "new@example.com",
        phone: "0411111111",
      })
    );
  });
});

describe("conversations.getClients", () => {
  it("shows only a name and picture for someone who is just a conversation row", async () => {
    mocks.list.mockResolvedValue([
      { id: 1, artistId: "artist", clientId: "mia" },
      { id: 2, artistId: "artist", clientId: "victim" },
    ]);
    mocks.database.mockResolvedValue({
      query: {
        appointments: { findMany: async () => [] },
        leads: { findMany: async () => [] },
      },
    });
    mocks.relationships.mockResolvedValue(sets(["mia"]));
    mocks.getUser.mockImplementation(async (id: string) => ({
      id,
      name: id,
      avatar: "a.png",
      email: `${id}@example.com`,
      phone: "0400000000",
      city: "Brisbane",
      country: "Australia",
      gender: "female",
      birthday: "1990-01-01",
    }));
    const rows = await caller("artist", "artist").getClients();
    expect(rows.find(r => r?.id === "mia")).toMatchObject({
      email: "mia@example.com",
      phone: "0400000000",
      city: "Brisbane",
      profileAvailable: true,
    });
    expect(rows.find(r => r?.id === "victim")).toMatchObject({
      name: "victim",
      avatar: "a.png",
      email: null,
      phone: null,
      city: null,
      country: null,
      gender: null,
      birthday: null,
      profileAvailable: false,
    });
  });
});
