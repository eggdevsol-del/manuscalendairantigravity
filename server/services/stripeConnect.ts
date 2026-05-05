/**
 * Stripe Connect Service — Artist Account Management
 *
 * Manages connected Stripe accounts for individual artists.
 * Tattoi is the platform; each artist is either a Standard or Custom Connected Account.
 *
 * Standard accounts: redirect-based onboarding (legacy)
 * Custom accounts: embedded in-app onboarding with no popups (new, feature-flagged)
 *   - Uses disable_stripe_user_authentication for popup-free PWA/Capacitor compatibility
 *   - Tattoi assumes negative balance liability (controller.losses.payments = "application")
 *   - Artists still pay Stripe processing fees (controller.fees.payer = "account")
 *
 * Spec: v2.2 §6.1 + Custom Migration v4
 */

import { stripe } from "./stripe";
import { getDb } from "./core";
import { eq } from "drizzle-orm";
import { artistSettings } from "../../drizzle/schema";

// ─── Feature Flag ─────────────────────────────────────────────

export function isCustomEnabled(): boolean {
    return process.env.STRIPE_CUSTOM_ENABLED !== "false";
}

/** @deprecated Use isCustomEnabled() — kept for backward compat */
export function isExpressEnabled(): boolean {
    return isCustomEnabled();
}

// ─── Standard Account Creation ────────────────────────────────

/**
 * Create a new Stripe Connect Standard account for an artist.
 * Returns the account ID (acct_xxx).
 */
export async function createConnectAccount(
    artistId: string,
    email: string,
    businessName?: string
): Promise<string> {
    const account = await stripe.accounts.create({
        type: "standard",
        email,
        business_profile: {
            name: businessName || undefined,
            mcc: "7299", // Miscellaneous personal services (tattoo)
        },
        metadata: {
            artistId,
            platform: "tattoi",
        },
    });

    // Save to DB
    const db = await getDb();
    if (db) {
        const existing = await db
            .select({ id: artistSettings.id })
            .from(artistSettings)
            .where(eq(artistSettings.userId, artistId))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(artistSettings)
                .set({
                    stripeConnectAccountId: account.id,
                    stripeConnectAccountType: "standard",
                })
                .where(eq(artistSettings.userId, artistId));
        } else {
            await db.insert(artistSettings).values({
                userId: artistId,
                stripeConnectAccountId: account.id,
                stripeConnectAccountType: "standard",
                workSchedule: JSON.stringify({}),
                services: JSON.stringify([]),
            });
        }
    }

    return account.id;
}

// ─── Custom Account Creation ──────────────────────────────────

/**
 * Create a new Stripe Connect Custom account for an artist.
 *
 * Key architecture decisions:
 * - controller.requirement_collection: "application" → enables disable_stripe_user_authentication
 * - controller.stripe_dashboard.type: "none" → artist never sees Stripe UI
 * - controller.losses.payments: "application" → Tattoi absorbs negative balances
 * - controller.fees.payer: "account" → artist pays Stripe processing fees (matches Express behavior)
 * - business_type: "individual" → artists are sole traders
 *
 * Returns the account ID (acct_xxx).
 */
export async function createCustomConnectAccount(
    artistId: string,
    email: string,
    businessCountry: string = "AU",
    businessName?: string
): Promise<string> {
    const account = await stripe.accounts.create({
        type: "custom",
        country: businessCountry,
        email,
        business_type: "individual",
        controller: {
            requirement_collection: "application",
            stripe_dashboard: { type: "none" },
            losses: { payments: "application" },
            fees: { payer: "account" },
        },
        business_profile: {
            name: businessName || undefined,
            mcc: "7299",
        },
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        settings: {
            payouts: {
                schedule: {
                    interval: "daily" as const,
                    delay_days: 2,
                },
            },
        },
        metadata: {
            artistId,
            platform: "tattoi",
        },
    } as any);

    // Save to DB
    const db = await getDb();
    if (db) {
        const existing = await db
            .select({ id: artistSettings.id })
            .from(artistSettings)
            .where(eq(artistSettings.userId, artistId))
            .limit(1);

        if (existing.length > 0) {
            await db
                .update(artistSettings)
                .set({
                    stripeConnectAccountId: account.id,
                    stripeConnectAccountType: "custom",
                })
                .where(eq(artistSettings.userId, artistId));
        } else {
            await db.insert(artistSettings).values({
                userId: artistId,
                stripeConnectAccountId: account.id,
                stripeConnectAccountType: "custom",
                workSchedule: JSON.stringify({}),
                services: JSON.stringify([]),
            });
        }
    }

    console.log(
        `[Stripe Connect] Created Custom account ${account.id} for artist ${artistId} (country=${businessCountry})`
    );

    return account.id;
}

/** @deprecated Use createCustomConnectAccount — kept for backward compat */
export const createExpressConnectAccount = createCustomConnectAccount;

// ─── Account Session (Custom Embedded Onboarding) ─────────────

/**
 * Create an AccountSession for embedded Connect onboarding.
 * Returns the client_secret needed by the frontend @stripe/connect-js.
 *
 * Key: disable_stripe_user_authentication removes the popup that breaks
 * in PWA and Capacitor webview environments.
 *
 * Guard: must be called only for Custom accounts.
 */
export async function createAccountSession(
    accountId: string
): Promise<string> {
    const session = await stripe.accountSessions.create({
        account: accountId,
        components: {
            account_onboarding: {
                enabled: true,
                features: {
                    disable_stripe_user_authentication: true,
                },
            },
        },
    } as any);

    return session.client_secret;
}

// ─── Onboarding Link (Standard only) ─────────────────────────

const getAppUrl = () =>
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    "https://www.tattoi.app";

/**
 * Generate a Stripe-hosted onboarding link for a Standard artist.
 * Redirects back to Settings after completion.
 */
export async function createAccountLink(
    accountId: string,
    artistId: string
): Promise<string> {
    const appUrl = getAppUrl();

    const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/settings?stripe_refresh=true`,
        return_url: `${appUrl}/settings?stripe_connected=true`,
        type: "account_onboarding",
    });

    return link.url;
}

// ─── Account Status ───────────────────────────────────────────

export interface ConnectAccountStatus {
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    onboardingComplete: boolean;
    detailsSubmitted: boolean;
}

/**
 * Get the current status of a connected Stripe account.
 */
export async function getAccountStatus(
    accountId: string
): Promise<ConnectAccountStatus> {
    const account = await stripe.accounts.retrieve(accountId);

    return {
        accountId: account.id,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        onboardingComplete:
            (account.charges_enabled && account.details_submitted) ?? false,
        detailsSubmitted: account.details_submitted ?? false,
    };
}

// ─── Sync Status to DB ───────────────────────────────────────

/**
 * Sync Stripe account status back to the database.
 * Called from the `account.updated` webhook.
 *
 * Defensively heals account type if Stripe reports a different type than DB.
 */
export async function syncAccountStatusToDb(
    accountId: string
): Promise<void> {
    const status = await getAccountStatus(accountId);

    const db = await getDb();
    if (!db) return;

    // Retrieve the actual Stripe account to check its type
    const account = await stripe.accounts.retrieve(accountId);

    // Map Stripe account type to our DB enum
    let stripeType: "standard" | "express" | "custom";
    if (account.type === "custom") {
        stripeType = "custom";
    } else if (account.type === "express") {
        stripeType = "express";
    } else {
        stripeType = "standard";
    }

    await db
        .update(artistSettings)
        .set({
            stripeConnectOnboardingComplete: status.onboardingComplete ? 1 : 0,
            stripeConnectPayoutsEnabled: status.payoutsEnabled ? 1 : 0,
            stripeConnectDetailsSubmitted: status.detailsSubmitted ? 1 : 0,
            // Defensive type heal: trust Stripe as SSOT
            stripeConnectAccountType: stripeType,
        })
        .where(eq(artistSettings.stripeConnectAccountId, accountId));

    console.log(
        `[Stripe Connect] Synced account ${accountId}: type=${stripeType}, charges=${status.chargesEnabled}, payouts=${status.payoutsEnabled}, details=${status.detailsSubmitted}`
    );
}

// ─── Disconnect ───────────────────────────────────────────────

/**
 * Remove the Stripe Connect association from an artist.
 * Note: Does NOT delete the Stripe account itself.
 */
export async function disconnectAccount(artistId: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
        .update(artistSettings)
        .set({
            stripeConnectAccountId: null,
            stripeConnectOnboardingComplete: 0,
            stripeConnectPayoutsEnabled: 0,
            stripeConnectDetailsSubmitted: 0,
            stripeConnectAccountType: "standard",
        })
        .where(eq(artistSettings.userId, artistId));

    console.log(`[Stripe Connect] Disconnected artist ${artistId}`);
}
