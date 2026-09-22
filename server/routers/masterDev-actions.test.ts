// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
const state = vi.hoisted(() => ({
  results: [] as unknown[][],
  values: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../services/core", () => {
  const select = () => {
    const chain: any = {};
    for (const k of [
      "from",
      "where",
      "limit",
      "for",
      "groupBy",
      "orderBy",
      "offset",
      "leftJoin",
      "innerJoin",
    ])
      chain[k] = () => chain;
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve(state.results.shift() || []).then(resolve, reject);
    return chain;
  };
  const db = {
    select,
    insert: () => ({ values: state.values }),
    update: () => ({
      set: (v: unknown) => {
        state.set(v);
        return { where: async () => undefined };
      },
    }),
    delete: () => ({ where: state.remove }),
  };
  return {
    getDb: async () => db,
    withDatabaseTransaction: async (fn: any) => fn(db),
  };
});
import { masterDevRouter } from "./masterDev";
import { getAuthSecret } from "../_core/auth-secret";
const caller = () =>
  masterDevRouter.createCaller({
    user: { id: "owner", role: "master_dev" },
    req: {
      headers: {
        authorization:
          "Bearer " +
          jwt.sign({ userId: "owner", masterDev: true }, getAuthSecret(), {
            expiresIn: 1800,
          }),
      },
    },
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  state.results = [];
  vi.stubEnv("MASTER_DEV_USER_ID", "owner");
});
afterEach(() => vi.unstubAllEnvs());
it("deactivates without deleting records and writes an audit record", async () => {
  state.results = [[{ role: "artist" }]];
  await caller().setAccountEnabled({ id: "artist-1", enabled: false });
  expect(state.set).toHaveBeenCalledWith({ role: "disabled_artist" });
  expect(state.remove).not.toHaveBeenCalled();
  expect(state.values).toHaveBeenCalledWith(
    expect.objectContaining({
      category: "master_dev:audit",
      userId: "owner",
      message: "Deactivated account",
    })
  );
});
it("cannot disable privileged identities", async () => {
  state.results = [[{ role: "master_dev" }]];
  await expect(
    caller().setAccountEnabled({ id: "owner", enabled: false })
  ).rejects.toThrow();
  expect(state.set).not.toHaveBeenCalled();
});
it("restores original account role", async () => {
  state.results = [[{ role: "disabled_merchant" }]];
  await caller().setAccountEnabled({ id: "supplier-1", enabled: true });
  expect(state.set).toHaveBeenCalledWith({ role: "merchant" });
});
it("hides suppliers without deleting order history", async () => {
  state.results = [[{ id: 1 }]];
  await caller().setSupplierVisible({ id: 1, visible: false });
  expect(state.set).toHaveBeenCalledWith({ isActive: 0 });
  expect(state.remove).not.toHaveBeenCalled();
  expect(state.values).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Removed supplier from directory" })
  );
});
it("restores hidden suppliers", async () => {
  state.results = [[{ id: 1 }]];
  await caller().setSupplierVisible({ id: 1, visible: true });
  expect(state.set).toHaveBeenCalledWith({ isActive: 1 });
});
it("cannot create another privileged role", async () => {
  await expect(
    caller().savePerson({
      name: "Another",
      email: "x@example.com",
      role: "master_dev",
    } as any)
  ).rejects.toThrow();
  expect(state.values).not.toHaveBeenCalled();
});
it("rejects duplicate account email", async () => {
  state.results = [[], [{ id: "existing" }]];
  await expect(
    caller().savePerson({
      name: "Another",
      email: "x@example.com",
      role: "client",
      city: "",
      country: "",
    })
  ).rejects.toThrow("Email already");
  expect(state.values).not.toHaveBeenCalled();
});

it("issues a short private session without returning credentials", async () => {
  const { hashPassword } = await import("../_core/auth-new");
  const password = "fixture-only-secret-value";
  state.results = [
    [
      {
        id: "owner",
        role: "master_dev",
        name: "Developer",
        email: "dev@example.com",
        password: await hashPassword(password),
      },
    ],
  ];
  const c = masterDevRouter.createCaller({
    user: null,
    req: { headers: {}, ip: "fixture-success" },
    res: {},
  } as any);
  const result = await c.login({ username: "MasterDevP", password });
  const payload = jwt.verify(result.token, getAuthSecret()) as jwt.JwtPayload;
  expect(payload.masterDev).toBe(true);
  expect(payload.userId).toBe("owner");
  expect(payload.exp! - payload.iat!).toBe(1800);
  expect(result.user).not.toHaveProperty("password");
  expect(JSON.stringify(state.values.mock.calls)).not.toContain(password);
});
it("does not allow the username alone to grant developer access", async () => {
  const { hashPassword } = await import("../_core/auth-new");
  state.results = [
    [
      {
        id: "owner",
        role: "client",
        password: await hashPassword("fixture-only-secret-value"),
      },
    ],
  ];
  const c = masterDevRouter.createCaller({
    user: null,
    req: { headers: {}, ip: "fixture-no-role" },
    res: {},
  } as any);
  await expect(
    c.login({ username: "MasterDevP", password: "fixture-only-secret-value" })
  ).rejects.toThrow("Invalid credentials");
});
