import { describe, expect, it } from "vitest";
import { projectNextStep } from "./projectStatus";
const session = {
  id: 1,
  status: "confirmed",
  paymentStatus: "deposit_paid",
  remainingCents: 5000,
};
describe("project next action", () => {
  it("keeps an enquiry distinct from a confirmed booking", () => {
    expect(
      projectNextStep({ sessions: [], plans: [], forms: [] }, false).title
    ).toBe("Your request is with your artist");
  });
  it("prioritises the client response to a pending proposal", () => {
    const data = {
      sessions: [session],
      plans: [{ status: "pending" }],
      forms: [],
    };
    expect(projectNextStep(data, true).title).toBe("Waiting for your client");
    expect(projectNextStep(data, false).action).toBe("Review proposal");
  });
  it("ignores unsigned forms for cancelled sessions", () => {
    const data = {
      sessions: [session, { ...session, id: 2, status: "cancelled" }],
      plans: [],
      forms: [{ appointmentId: 2, status: "pending" }],
    };
    expect(projectNextStep(data, false).title).toBe(
      "Your next session is confirmed"
    );
    data.forms[0].appointmentId = 1;
    expect(projectNextStep(data, false).action).toBe("Review forms");
  });
  it("never calls a pending or cancelled appointment confirmed", () => {
    for (const status of ["pending", "cancelled", "no-show"])
      expect(
        projectNextStep(
          { sessions: [{ ...session, status }], plans: [], forms: [] },
          false
        ).title
      ).not.toContain("confirmed");
  });
  it("flags an unpaid completed session without asking for duplicate payment", () => {
    const result = projectNextStep(
      { sessions: [{ ...session, status: "completed" }], plans: [], forms: [] },
      false
    );
    expect(result.action).toBe("Review balance");
    expect(result.body).toContain(
      "before requesting or making another payment"
    );
  });
});
