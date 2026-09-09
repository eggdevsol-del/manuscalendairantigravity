# Completion pass — all roles

This pass continues from deployed 2.11.6. A checked item means implemented and verified as described in the testing report, not merely inspected.

- [ ] Merchant onboarding, settings and dashboard: mounted routes, actionable setup, truthful metrics and connection states.
- [ ] Merchant profile: explicit safe projection; never return provider credentials.
- [ ] Supplier imports: authorized writes, public-network requests only, bounded responses/timeouts, stable imports.
- [ ] Storefront checkout: variant identity, stock/capacity reservations, expiry release, payment binding and refund state.
- [ ] Studio membership: active-member access, paid eligibility at acceptance, atomic invitation/response, owner protections and departure history.
- [ ] Client and artist cross-role UI regression checks, including forms, rescheduling, notifications and purchase history.
- [ ] Studio operational workflows and entitlement-backed UI.
- [ ] Automated regressions, real database acceptance, deployed provider tests, web/native builds and GitHub push.

External prerequisites: Resend API key and verified sender; identified Shopify test/development store. Neither secret belongs in source or chat. Physical-device signing and actual push delivery need their own acceptance evidence.
