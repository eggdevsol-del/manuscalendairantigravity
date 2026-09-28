# SMS-link client portal pilot

Branch: codex/tattoi-sms-client-portal. No database migration required.

## Test
1. Run this branch against a test database with JWT_SECRET of at least 32 characters.
2. Sign in as an artist, open Today → Clients and select an existing client.
3. Select Create test link in Private client portal. Open the link in a private browser to test without signing in.
4. Check the artist's sittings, open an existing pending payment request, and send a test message. Verify it reaches the artist's existing conversation.
5. Prepare SMS opens the device messaging composer. Nothing sends automatically. Use only test recipients and Stripe test mode when testing payments.
6. Test an expired/tampered link, a disabled client and another artist's client. Access must fail.

Links expire after 24 hours. Tokens are carried in the URL fragment, removed after opening, and held in sessionStorage for refresh/back navigation in the same tab. Portal APIs use POST so tokens do not appear in query strings. Artist/client relationships and enabled accounts are checked on every call. The token grants access only to that artist/client relationship; it does not create a normal login session. Existing payment checkout is reused, including fees and payment rules.

## Pilot scope and limits
The single-page portal includes project progress and dates, proposal/deposit checkout, payment requests and history, recent conversation and replies, pending form signing, artist aftercare, and available offers. Navigation jumps to sections of the same page. Checkout and details use the app's shared bottom sheets. Artist-only briefs and internal notes are excluded from the workspace response.

Checkout uses the existing financial procedures and webhook confirmation. Proposal and form operations additionally verify the token's conversation, artist and client scope. No database migration is required.

Remaining parity limits: photo uploads, discovery/purchases/waitlist, self-service profile editing and automatic promotion redemption are not implemented in this portal. Offers can be discussed with the artist. No automatic SMS/email delivery was added. This is not yet full client-app parity.

Validation: TypeScript, production frontend build, token/route and portal boundary tests. Use fictional accounts for browser testing; live payments and production form signing have not been exercised.

A forwarded bearer link grants its holder access until expiry. Before a public rollout, add contact verification for sensitive access, per-link revocation/audit persistence, durable delivery/recovery, and delivery consent controls. Test links should only be used with fictional clients until that work is complete.
