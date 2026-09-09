// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  isPublicAddress,
  parseStoreUrl,
  publicStoreFetch,
} from "./publicStoreFetch";
describe("public storefront network boundary", () => {
  it("rejects private, metadata, mapped IPv6 and alternate IPv4 encodings", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "100.64.0.1",
      "192.168.1.1",
      "::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "fc00::1",
      "fe80::1",
      "2002:7f00:1::",
    ])
      expect(isPublicAddress(address), address).toBe(false);
    for (const url of [
      "http://2130706433",
      "http://0x7f000001",
      "http://[::ffff:7f00:1]",
      "http://localhost",
      "https://shop.internal",
      "https://user:pass@shop.example.com",
      "http://shop.example.com:3000",
    ])
      expect(() => parseStoreUrl(url), url).toThrow();
    await expect(
      publicStoreFetch("http://169.254.169.254/latest/meta-data")
    ).rejects.toThrow();
  });
  it("accepts public IPv4 and global IPv6 and normal storefront URLs", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(parseStoreUrl("shop.example.com/products.json").origin).toBe(
      "https://shop.example.com"
    );
  });
});
