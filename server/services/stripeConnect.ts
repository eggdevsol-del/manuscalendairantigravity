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
 * - controller.fees.payer: "application" → Tattoi pays Stripe processing fees (recouped via platform fee)
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
        country: businessCountry,
        email,
        business_type: "individual",
        controller: {
            requirement_collection: "application",
            stripe_dashboard: { type: "none" },
            losses: { payments: "application" },
            fees: { payer: "application" },
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
        `[Stripe Connect] Created Custom account ${account.id} for artist ${artistId} (country=${businessCountry}, type=${(account as any).type}, controller=${JSON.stringify((account as any).controller)})`
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
    // Verify the account has proper controller settings before creating session
    const account = await stripe.accounts.retrieve(accountId);
    console.log(
        `[Stripe Connect] Creating session for account ${accountId}: type=${account.type}, controller=${JSON.stringify((account as any).controller)}`
    );

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
        refresh_url: `${appUrl}/bank-payouts?stripe_refresh=true`,
        return_url: `${appUrl}/bank-payouts?stripe_connected=true`,
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
 * Returns safe fallback if the account doesn't exist on Stripe.
 */
export async function getAccountStatus(
    accountId: string
): Promise<ConnectAccountStatus> {
    try {
        const account = await stripe.accounts.retrieve(accountId);
        return {
            accountId: account.id,
            chargesEnabled: account.charges_enabled ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            onboardingComplete:
                (account.charges_enabled && account.details_submitted) ?? false,
            detailsSubmitted: account.details_submitted ?? false,
        };
    } catch (err: any) {
        console.error(`[Stripe Connect] Failed to retrieve account ${accountId}:`, err.message);
        return {
            accountId,
            chargesEnabled: false,
            payoutsEnabled: false,
            onboardingComplete: false,
            detailsSubmitted: false,
        };
    }
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
    try {
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
                stripeConnectAccountType: stripeType,
            })
            .where(eq(artistSettings.stripeConnectAccountId, accountId));

        console.log(
            `[Stripe Connect] Synced account ${accountId}: type=${stripeType}, charges=${status.chargesEnabled}, payouts=${status.payoutsEnabled}, details=${status.detailsSubmitted}`
        );
    } catch (err: any) {
        console.error(`[Stripe Connect] Failed to sync account ${accountId}:`, err.message);
    }
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

// ─── Native Onboarding ────────────────────────────────────────

export interface OnboardingFormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dobDay: number;
    dobMonth: number;
    dobYear: number;
    country: "AU" | "NZ";
    addressLine1: string;
    addressCity: string;
    addressState: string;
    addressPostalCode: string;
    bankBsb: string;
    bankAccountNumber: string;
    publicSlug?: string;
}

/**
 * Submit all onboarding data to Stripe for a Custom account.
 * Called after the artist completes the native 5-step wizard.
 *
 * Auto-sets:
 *   - business_profile.mcc = 7299 (Personal Services / Tattoo)
 *   - business_profile.url = tattoi.app/start/{slug}
 *   - tos_acceptance (timestamp + IP from request)
 */
export async function submitOnboardingData(
    accountId: string,
    data: OnboardingFormData,
    ipAddress: string
): Promise<{ chargesEnabled: boolean; requiresDocument: boolean }> {
    const appUrl = getAppUrl();

    const country = data.country || "AU";
    const currency = country === "NZ" ? "nzd" : "aud";

    const updated = await stripe.accounts.update(accountId, {
        business_profile: {
            mcc: "7299",
            url: data.publicSlug
                ? `${appUrl}/start/${data.publicSlug}`
                : appUrl,
        },
        individual: {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
            dob: {
                day: data.dobDay,
                month: data.dobMonth,
                year: data.dobYear,
            },
            address: {
                line1: data.addressLine1,
                city: data.addressCity,
                state: data.addressState,
                postal_code: data.addressPostalCode,
                country,
            },
        },
        external_account: {
            object: "bank_account",
            country,
            currency,
            routing_number: data.bankBsb,
            account_number: data.bankAccountNumber,
        } as any,
        tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: ipAddress,
        },
    });

    // Check if document verification is still pending
    const requiresDocument =
        updated.requirements?.pending_verification?.includes(
            "individual.verification.document"
        ) ||
        updated.requirements?.currently_due?.includes(
            "individual.verification.document"
        ) ||
        false;

    console.log(
        `[Stripe Connect] Onboarding submitted for ${accountId}: charges=${updated.charges_enabled}, payouts=${updated.payouts_enabled}, requiresDoc=${requiresDocument}`
    );

    return {
        chargesEnabled: updated.charges_enabled ?? false,
        requiresDocument,
    };
}

/**
 * Upload an identity document (driver's licence / passport) to Stripe
 * and attach it to the connected account's individual verification.
 *
 * In test mode, passing `useTestToken: true` skips the real upload
 * and uses `file_identity_document_success` for instant verification.
 */
export async function uploadIdentityDocument(
    accountId: string,
    fileBuffer: Buffer,
    fileName: string,
    useTestToken: boolean = false
): Promise<{ pending: boolean }> {
    let fileId: string;

    if (useTestToken) {
        // Test mode: use Stripe's auto-pass token
        fileId = "file_identity_document_success";
    } else {
        // Production: upload the actual file
        const file = await stripe.files.create(
            {
                purpose: "identity_document",
                file: {
                    data: fileBuffer,
                    name: fileName,
                    type: "application/octet-stream",
                },
            },
            { stripeAccount: accountId }
        );
        fileId = file.id;
    }

    // Attach to the individual's verification
    await stripe.accounts.update(accountId, {
        individual: {
            verification: {
                document: {
                    front: fileId,
                },
            },
        },
    });

    // Check updated status
    const account = await stripe.accounts.retrieve(accountId);
    const pending =
        account.requirements?.pending_verification?.includes(
            "individual.verification.document"
        ) ?? false;

    console.log(
        `[Stripe Connect] ID document uploaded for ${accountId}: pending=${pending}`
    );

    return { pending };
}

// ─── Payout Management ────────────────────────────────────────

export interface PayoutScheduleInfo {
    interval: "daily" | "weekly" | "monthly" | "manual";
    weeklyAnchor?: string;
    monthlyAnchor?: number;
    delayDays: number;
    bankLast4?: string;
    bankName?: string;
    payoutsEnabled: boolean;
    pendingVerification: boolean;
    availableBalance: number;
    pendingBalance: number;
}

/**
 * Get the current payout schedule, bank info, and balance for a connected account.
 */
export async function getPayoutSchedule(
    accountId: string
): Promise<PayoutScheduleInfo> {
    const account = await stripe.accounts.retrieve(accountId);
    const schedule = account.settings?.payouts?.schedule;

    // Get balance
    const balance = await stripe.balance.retrieve({
        stripeAccount: accountId,
    });

    const available =
        balance.available?.find((b) => b.currency === "aud")?.amount ?? 0;
    const pending =
        balance.pending?.find((b) => b.currency === "aud")?.amount ?? 0;

    // Get bank account last4
    let bankLast4: string | undefined;
    let bankName: string | undefined;
    const externalAccounts = account.external_accounts;
    if (externalAccounts?.data?.[0]) {
        const bank = externalAccounts.data[0] as any;
        bankLast4 = bank.last4;
        bankName = bank.bank_name;
    }

    const pendingVerification =
        account.requirements?.pending_verification?.includes(
            "individual.verification.document"
        ) ?? false;

    return {
        interval: (schedule?.interval as any) ?? "daily",
        weeklyAnchor: schedule?.weekly_anchor,
        monthlyAnchor: schedule?.monthly_anchor,
        delayDays: schedule?.delay_days ?? 2,
        bankLast4,
        bankName,
        payoutsEnabled: account.payouts_enabled ?? false,
        pendingVerification,
        availableBalance: available,
        pendingBalance: pending,
    };
}

/**
 * Update the payout schedule for a connected account.
 */
export async function updatePayoutSchedule(
    accountId: string,
    interval: "daily" | "weekly" | "monthly" | "manual",
    weeklyAnchor?: string,
    monthlyAnchor?: number
): Promise<void> {
    const schedule: any = { interval };

    if (interval === "weekly" && weeklyAnchor) {
        schedule.weekly_anchor = weeklyAnchor;
    }
    if (interval === "monthly" && monthlyAnchor) {
        schedule.monthly_anchor = monthlyAnchor;
    }

    await stripe.accounts.update(accountId, {
        settings: {
            payouts: { schedule },
        },
    });

    console.log(
        `[Stripe Connect] Payout schedule updated for ${accountId}: ${interval}`
    );
}

