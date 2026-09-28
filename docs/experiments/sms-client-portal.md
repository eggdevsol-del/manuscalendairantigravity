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
Includes sittings, existing payment requests, recent text conversation and replies, and an artist-controlled SMS composer. No automatic SMS/email delivery or scheduled notifications were added. No production messages or charges have been sent.

This is an initial testable portal, not replacement parity with the full client app: proposal acceptance, promotions redemption, attachments, sensitive consent/medical forms and aftercare remain outside this pilot. Existing client app remains intact. Conversation shows the most recent 100 messages filtered to text; older messages and structured cards remain in the existing app.

A forwarded bearer link grants its holder access until expiry. Before a public rollout, add contact verification for sensitive access, per-link revocation/audit persistence, durable delivery/recovery, and delivery consent controls. Test links should only be used with fictional clients until that work is complete.
