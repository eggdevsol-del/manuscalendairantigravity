import { flows as original } from "./ivory-flows.mjs";
const click =
  (name, role = "button") =>
  p =>
    p.getByRole(role, { name }).filter({ visible: true }).first().click();
const overrides = {
  "flow-private-notes": [click("Conversation tools")],
  "flow-design-brief": [click("Conversation tools")],
  "flow-past-bookings": [click(/Completed projects/)],
  "flow-deposit-review": [click(/View booking proposal/)],
  "flow-client-consent": [click(/Complete your forms/, "link")],
  "flow-consent-signature": [
    click(/Complete your forms/, "link"),
    click("Continue to signature"),
  ],
  "flow-session-reschedule": [click("Details"), click("Reschedule")],
  "flow-session-cancel": [click("Details"), click("Cancel session")],
  "flow-session-finish": [click("Details"), click("Finish session")],
};
export const flows = original
  .filter(c => c.role !== "merchant")
  .map(c => ({
    ...c,
    ...(c.id === "flow-session-finish" ? { time: "2026-09-10T01:00:00Z" } : {}),
    ...(overrides[c.id]
      ? {
          before: async p => {
            for (const step of overrides[c.id]) await step(p);
          },
        }
      : {}),
  }));

for (const mode of ["reschedule", "cancel"]) {
  flows.push({
    id: `flow-${mode}-return`,
    role: "artist",
    path: "/projects/12",
    title: `Sitting ${mode} return`,
    before: async p => {
      await click("Details")(p);
      await click(mode === "cancel" ? "Cancel session" : "Reschedule")(p);
      if ((await p.getByRole("dialog").count()) !== 1)
        throw new Error("Expected a single review sheet");
      await click("Go back")(p);
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      await click("Details")(p);
      await click(mode === "cancel" ? "Cancel session" : "Reschedule")(p);
      if ((await p.getByRole("dialog").count()) !== 1)
        throw new Error("Review did not reopen cleanly");
    },
  });
}
