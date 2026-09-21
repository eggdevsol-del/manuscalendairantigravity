# Ivory business refinements

1. Saved service rows: per-sitting price and calculated project total.
2. Scheduling: optional completion deadline; consecutive calendar-day runs preferred; deadline-bounded fallback minimises breaks; gap notes persisted with proposal metadata and shown to both roles. Reject impossible deadlines without changing bookings.
3. Conversation tools: fixed centred New booking action under heading, one collapsed card per project, reuse existing project workspace inline.
4. Tours: business-specific authored guidance, omit generic headings/navigation and routine controls.
5. Earnings: daily ledger-backed bars reconciled with the same net total and period.
6. Calendar: inline heading, week strip higher, fixed Previous / Today / Next above navigation, retain native momentum and safe clearances.
7. Verify scheduling edge cases, money reconciliation, existing tests, typecheck/build and local fixture browser checks. Commit and push to the existing Ivory branch. No migrations or production data actions.

## Delivered and validated

All six refinements implemented. Validation: 83 test files / 354 tests passed; TypeScript and frontend production build passed. Ten isolated browser checks passed at 390px and 320px covering calendar controls, inline conversation projects, service totals, deadline gap notes and ledger chart. Screenshots and gallery: `output/tattoi-business-refinements/index.html`. No migrations, real messages, charges or deployment. Physical-device momentum and production payment-provider flows were not exercised.
