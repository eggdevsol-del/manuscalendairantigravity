# Project name reliability

The booking screen previously attempted LLM repairs on page load. Imported plans without a proposal message threw an error, producing a persistent client repair notice.

Names now live on `sessionPlans.projectName`. A server worker adopts valid legacy names or generates a design-only name without blocking proposal submission. Missing proposal messages are supported. Each unnamed plan receives at most three attempts, with increasing retry delays. When context is insufficient, the UI keeps the neutral “Tattoo project” fallback and booking details. Artists can edit the name in the project view; clients and other artists cannot write it. Plan row locks serialize generation and manual edits. Appointment and message names are compatibility mirrors, updated in the same transaction.

Existing projects are processed gradually, one per 15-second tick per host. Valid existing names are adopted without invoking AI. Older projects retain the existing chronological context boundary. Naming never changes dates, amounts, or proposal status.

## Activation

Apply `server/migrations/20260922-project-names.sql` before deploying this code. This migration is additive and has NOT been run in this workspace. The separately pending supplier visibility migration is also needed for the other uncommitted features. No production data, deployment, commit, or push was performed for this change.

No live database connection is available here, so actual migration execution, production LLM availability, and historical repair completion remain deployment checks.

## Validation

- Full existing suite plus initial naming coverage: 95 files / 409 tests passed.
- Additional access and canonical-precedence tests: targeted 3 files / 15 tests passed (includes three new tests).
- TypeScript, frontend production build, and server bundle passed.
- Overlay architecture and production-data guards passed.
- Isolated production-preview browser checks at 320 and 390 pixels: no client repair mutation or warning; no client name editor; artist editing saves the selected plan; no horizontal overflow or page errors.
- Screenshots: `output/tattoi-project-name-fix/`.

The tests use isolated fixtures and mocked database calls; they do not claim a live database integration test.
