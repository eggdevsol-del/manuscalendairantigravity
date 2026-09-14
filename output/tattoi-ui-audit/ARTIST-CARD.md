# Artist card interaction verification

The Home artist card now gives portfolio expansion and Chat separate buttons. A saved artist without an existing conversation creates or retrieves a real conversation before navigating, rather than using the synthetic favourite-card ID as a chat route.

Browser checks ran at 390px against the real app with isolated API fixtures:

| Scenario | Checks | Result |
| --- | ---: | --- |
| Existing conversation Chat | 5 | Preserves the conversation URL, creates no new conversation, does not toggle the portfolio. |
| Favourite-only Chat failure and retry | 12 | Shows a disabled pending state, preserves Home on failure, offers retry, then opens the returned conversation. |
| Favourite-only portfolio Message | 8 | Uses the same creation path and pending guard as Chat; opens the returned conversation once. |
| Nearby artist map Message failure and retry | 11 | Keeps the popup open after failure, offers retry, then dismisses it and opens the returned conversation. |
| Discover artist card consultation and Chat | 17 | Consultation toggles independently; 44px controls remain separate; Chat preserves the portfolio state and supports failure/retry. |

All 53 checks passed. Retry text on both light error panels met a measured contrast ratio of at least 4.5:1. The Fine Line keyword chips on the map popup and Discover card each measured 15.28:1. Creation payloads used the selected artist ID and the authenticated client ID. No synthetic `fav-` conversation route or unhandled browser error was observed.

Evidence: `artist-card-results.json`, `screens/favourite-chat-retry-390.png`, `screens/map-chat-retry-390.png`, `screens/discovery-card-chat-retry-390.png`.

Run with `scripts/ui-audit/artist-card-check.mjs`. Requests were intercepted locally; no messages were sent and no real conversations were created.
