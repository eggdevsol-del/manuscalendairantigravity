// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { masterDevRouter } from "./masterDev";
afterEach(() => vi.unstubAllEnvs());
describe("developer router authorization", () => {
  for (const role of ["client", "artist", "merchant", "admin", "master_dev"])
    it(`denies ${role} without dedicated session`, async () => {
      vi.stubEnv("MASTER_DEV_USER_ID", "owner");
      const c = masterDevRouter.createCaller({
        user: { id: "owner", role },
        req: { headers: {} },
        res: {},
      } as any);
      await expect(c.overview()).rejects.toThrow(
        "Private developer session required"
      );
      await expect(
        c.people({ search: "", role: "all", page: 0 })
      ).rejects.toThrow();
      await expect(c.person({ id: "other" })).rejects.toThrow();
      await expect(
        c.savePerson({
          name: "Test",
          email: "test@example.com",
          city: "",
          country: "",
        })
      ).rejects.toThrow();
      await expect(
        c.setAccountEnabled({ id: "other", enabled: false })
      ).rejects.toThrow();
      await expect(c.suppliers()).rejects.toThrow();
      await expect(c.setSupplierVisible({ id: 1, visible: false })).rejects.toThrow();
      await expect(
        c.saveSupplier({
          name: "Store",
          websiteUrl: "https://example.com",
          contactEmail: "",
        })
      ).rejects.toThrow();
    });
});
