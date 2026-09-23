# Project loading repair — 23 September 2026

Applied the existing additive `20260922-project-names.sql` migration to Railway production after confirming all three columns were missing. The migration completed successfully. A read-only call to `projects.summary` using the selected plan's artist and client contexts succeeded, returning 30 sittings for each. This checks server authorization and database access; it is not an end-to-end browser sign-in check.

Railway now has a proposed pre-deploy schema gate in repository configuration, comparing every Drizzle table/column against information_schema. It only reads metadata, exits nonzero for missing fields or database connection failures, and never applies migrations. The gate takes effect on deployments that include this configuration. Types and constraints are outside this gate's scope.

The broader existing deploy:check failed early because APP_URL and EMAIL_FROM are absent in production. These unrelated configuration findings are not bypassed or changed by the schema-only gate.

## Follow-up verification

- Full production schema comparison: no missing tables or columns.
- Live sessionPlans.getById succeeds for both the selected plan’s artist and client.
- Live dashboardTasks.getBusinessTasks succeeds with five visible tasks.
- Existing local suite: 98 files, 420 tests passed; TypeScript passed; production build passed.
- No browser end-to-end client/artist login was performed; server checks used the existing plan participants in process, without generating credentials.
- APP_URL configuration change was blocked by automatic approval review pending specific user approval. EMAIL_FROM requires a verified sender address from the user. Neither is a prerequisite for the completed database repair.
