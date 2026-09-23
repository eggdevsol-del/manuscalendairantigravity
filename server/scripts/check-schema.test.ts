import { afterEach, expect, it, vi } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn() }));
vi.mock("mysql2/promise", () => ({ default: {
  createConnection: vi.fn(async () => mocks),
} }));
const columns = Object.values(schema).flatMap(value => {
  if (!is(value, MySqlTable)) return [];
  const config = getTableConfig(value);
  return config.columns.map(column => ({ TABLE_NAME: config.name, COLUMN_NAME: column.name }));
});
const originalExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});
it("blocks a database with the exact missing project-name migration", async () => {
  vi.stubEnv("DATABASE_URL", "mysql://fixture");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.query.mockResolvedValue([columns.filter(c => !(c.TABLE_NAME === "sessionPlans" &&
    ["projectName", "projectNameAttempts", "projectNameRetryAt"].includes(c.COLUMN_NAME)))]);
  await import("./check-schema");
  expect(process.exitCode).toBe(1);
  expect(error).toHaveBeenCalledWith(expect.stringContaining("sessionPlans.projectNameRetryAt"));
  expect(mocks.end).toHaveBeenCalledOnce();
});
it("accepts a complete schema without writing data", async () => {
  vi.stubEnv("DATABASE_URL", "mysql://fixture");
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.query.mockResolvedValue([columns]);
  await import("./check-schema");
  expect(process.exitCode).toBe(originalExitCode);
  expect(mocks.query).toHaveBeenCalledOnce();
  expect(mocks.query.mock.calls[0][0]).toMatch(/^SELECT /);
  expect(mocks.end).toHaveBeenCalledOnce();
});
it("fails closed when the database cannot be read", async () => {
  vi.stubEnv("DATABASE_URL", "mysql://fixture");
  mocks.query.mockRejectedValue(new Error("Database unavailable"));
  await expect(import("./check-schema")).rejects.toThrow("Database unavailable");
  expect(mocks.end).toHaveBeenCalledOnce();
});
