import { expect, it, vi } from "vitest";
import { rescheduledSittingIds } from "./rescheduledSittings";

it("does not query history when there are no authorized sittings", async () => {
  const selectDistinct = vi.fn();
  expect(await rescheduledSittingIds({ selectDistinct } as any, [])).toEqual(new Set());
  expect(selectDistinct).not.toHaveBeenCalled();
});
it("uses saved appointment IDs for the rescheduled label", async () => {
  const where = vi.fn().mockResolvedValue([{ appointmentId: 42 }]);
  const db = { selectDistinct: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }) };
  expect(await rescheduledSittingIds(db as any, [42, 43])).toEqual(new Set([42]));
  expect(where).toHaveBeenCalledOnce();
});
