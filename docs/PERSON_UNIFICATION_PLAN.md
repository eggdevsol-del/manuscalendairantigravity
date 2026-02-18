# Unified Person Model: Database Migration Plan

## Objective
Consolidate `users` and `leads` tables into a unified `people` (or enhanced `users`) table to ensure a Single Source of Truth for identity data, simplify joins, and improve system maintainability.

## Current State Analysis

### `users` table
- `id`: varchar (primary)
- `name`: single text field
- `email`: varchar
- `phone`: varchar
- `birthday`: datetime

### `leads` table
- `id`: int (primary)
- `clientName`: single text field (legacy)
- `clientFirstName`: varchar
- `clientLastName`: varchar
- `clientEmail`: varchar
- `clientPhone`: varchar
- `clientBirthdate`: varchar

## Phase 1: Schema Stabilization (In Progress)
- [x] Create shared `Person` and `Identity` types.
- [x] Implement name normalization utilities.
- [x] Standardize backend identity resolution via `identityService`.

## Phase 2: Schema Harmonization
1. **Enhance `users` table**:
   - Add `firstName`: varchar(100)
   - Add `lastName`: varchar(100)
   - Add `type`: enum('user', 'lead') default 'user'
2. **Backfill `users` name fields**:
   - Run a migration to split `name` into `firstName` and `lastName` using the `shared/identity` logic.
3. **Deprecate `users.name`**:
   - Keep for backward compatibility initially, then remove.

## Phase 3: Identity Unification
1. **Convert `leads` to use `users` as storage**:
   - Every lead should have a corresponding entry in the `users` table (even without a Clerk account).
   - The `leads` table becomes a "Lead Context" table, linking a `users.id` (as `personId`) to specific lead data (status, project type, funnel data).
2. **Migration Path**:
   - For each lead:
     - Create a user record if one doesn't exist for that email/phone.
     - Update `leads.clientId` to the new user record's ID.
   - Rename `leads.clientId` to `personId` to clarify it's a link to the unified `people` repository.

## Phase 4: Data SSOT
- Remove redundant identity fields from `leads` (`clientFirstName`, `clientLastName`, `clientEmail`, etc.).
- Update all queries to join `leads` with `users` (or use a view) to get identity data.

## Risks & Mitigations
- **Identity Collision**: Multiple leads with same email/phone but different names. 
  - *Mitigation*: Implementation of a deterministic "Merge or Create" identity resolution strategy.
- **Breaking Changes**: External integrations (Clerk, OneSignal) rely on specific IDs.
  - *Mitigation*: Use `Person` as the internal canonical ID, but keep `clerkId` as a secondary lookup for AUTH.
