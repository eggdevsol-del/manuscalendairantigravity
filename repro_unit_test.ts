interface Policy {
  id: number;
  artistId: string;
  policyType: "deposit" | "design" | "reschedule" | "cancellation";
  title: string;
  content: string;
  enabled: boolean | null;
}

async function runTest() {
  console.log("Running unit test for policy integration logic...");

  // MOCK DATA
  const mockPolicies: Policy[] = [
    {
      id: 1,
      artistId: "artist1",
      policyType: "deposit",
      title: "Deposit Policy",
      content: "Pay 50%",
      enabled: true,
    },
    {
      id: 2,
      artistId: "artist1",
      policyType: "cancellation",
      title: "Cancel Policy",
      content: "No refunds",
      enabled: false, // Disabled
    },
    {
      id: 3,
      artistId: "artist1",
      policyType: "design",
      title: "Design Policy",
      content: "Custom design",
      enabled: true,
    },
  ];

  // TEST LOGIC (Copy of the logic added to booking.ts)
  const policies = mockPolicies; // Simulate await db.getPolicies(...)
  const enabledPolicies = policies.filter(p => p.enabled);

  const matchFirstAppt = { serviceName: "Tattoo", price: 200 };
  const matchDates = [new Date()];

  const proposalMetadata = JSON.stringify({
    serviceName: matchFirstAppt.serviceName,
    totalCost: 200,
    sittings: 1,
    dates: matchDates,
    status: "pending",
    policies: enabledPolicies,
  });

  // VERIFICATION
  const parsed = JSON.parse(proposalMetadata);

  console.log("Parsed Metadata Policies:", parsed.policies);

  if (parsed.policies.length !== 2) {
    throw new Error(
      `Expected 2 enabled policies, got ${parsed.policies.length}`
    );
  }

  const hasDeposit = parsed.policies.some(
    (p: any) => p.title === "Deposit Policy"
  );
  const hasCancel = parsed.policies.some(
    (p: any) => p.title === "Cancel Policy"
  );

  if (!hasDeposit) throw new Error("Missing Deposit Policy");
  if (hasCancel) throw new Error("Should not include disabled Cancel Policy");

  console.log("SUCCESS: Unit test passed.");
}

runTest().catch(e => {
  console.error("FAILED:", e);
  process.exit(1);
});
