import { describe, it, expect } from "vitest";
import { hasReadMessage } from "./readReceipt";
describe("read receipts", () => {
  it("requires the recipient, not the sender, to have read the message", () => {
    expect(hasReadMessage('["artist"]', "client")).toBe(false);
    expect(hasReadMessage('["artist","client"]', "client")).toBe(true);
  });
  it("does not report malformed or absent receipts as read", () => {
    for (const value of [null, undefined, "invalid", "{}", '"client"', "[]"]) {
      expect(hasReadMessage(value, "client")).toBe(false);
    }
    expect(hasReadMessage('["client"]', null)).toBe(false);
  });
});
