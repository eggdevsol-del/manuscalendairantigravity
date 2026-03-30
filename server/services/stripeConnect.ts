/**
 * Stripe Connect Service — Artist Account Management
 *
 * Manages connected Stripe accounts for individual artists.
 * Tattoi is the platform; each artist is a Standard Connected Account.
 *
 * Spec: v2.2 §6.1
 */

import { stripe } from "./stripe";
import { getDb } from "./core";
import { eq } from "drizzle-orm";
import { artistSettings } from "../../drizzle/schema";

// ─── Account Creation ─────────────────────────────────────────

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
        await db
            .update(artistSettings)
            .set({ stripeConnectAccountId: account.id })
            .where(eq(artistSettings.userId, artistId));
    }

    return account.id;
}

// ─── Onboarding Link ──────────────────────────────────────────

const getAppUrl = () =>
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    "https://www.tattoi.app";

/**
 * Generate a Stripe-hosted onboarding link for an artist.
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
 */
export async function syncAccountStatusToDb(
    accountId: string
): Promise<void> {
    const status = await getAccountStatus(accountId);

    const db = await getDb();
    if (!db) return;

    await db
        .update(artistSettings)
        .set({
            stripeConnectOnboardingComplete: status.onboardingComplete ? 1 : 0,
            stripeConnectPayoutsEnabled: status.payoutsEnabled ? 1 : 0,
        })
        .where(eq(artistSettings.stripeConnectAccountId, accountId));

    console.log(
        `[Stripe Connect] Synced account ${accountId}: charges=${status.chargesEnabled}, payouts=${status.payoutsEnabled}`
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
        })
        .where(eq(artistSettings.userId, artistId));

    console.log(`[Stripe Connect] Disconnected artist ${artistId}`);
}
