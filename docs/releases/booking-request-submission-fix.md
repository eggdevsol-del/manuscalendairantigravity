# Booking request submission fix

- The client only shows success after the response contains a saved consultation and conversation, or a saved guest lead, conversation and claim token. Empty responses leave the review and entered details intact with a retry message.
- Signed-in requests create or reuse the artist/client conversation, link the consultation, save the request as a message, update its pin/activity timestamp and queue the artist notification in one transaction. The success link opens that exact conversation.
- Guest requests save the lead, consultation, conversation, their links, initial description and image messages, and notification job in one transaction. Initial message visibility no longer waits on an external AI call. Design brief generation remains available in the conversation.
- The current form supplies a stable UUID. Under an artist-row lock, retries reuse the existing saved request. Signed-in UUIDs are recorded in message metadata; guest UUIDs are recorded in lead source details. Older callers without a UUID retain compatibility but do not receive retry deduplication. Reloading and starting a fresh form creates a new request ID.
- Booking claim tokens now use the same configured signing-secret helper for creation and verification.
- Public phone formatting is normalized before applying the database's length limit.

Validation: 94 test files / 403 tests passed. TypeScript, frontend production build, server bundle, overlay and production-data checks passed. Browser fixtures at 320px and 390px verified empty-response rejection, preserved input, retry ID reuse, confirmed success, direct conversation navigation and guest claim UI. Transactional tests inject failures at each persistence stage and check retry reuse. No live database, real booking submission, notification delivery, migration or deployment was used. The original test user's specific production incident remains unverified without their error details/server logs.
