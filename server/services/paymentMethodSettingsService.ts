import { eq, sql } from "drizzle-orm";
import { paymentMethodSettings } from "../../drizzle/schema";
import { getDb } from "./core";

export async function getPaymentMethodSettings(artistId: string) {
    const db = await getDb();
    if (!db) return null;

    const results = await db
        .select()
        .from(paymentMethodSettings)
        .where(eq(paymentMethodSettings.artistId, artistId))
        .limit(1);

    return results[0] || null;
}

export async function upsertPaymentMethodSettings(data: {
    artistId: string;
    stripeEnabled: number;
    paypalEnabled: number;
    bankEnabled: number;
    cashEnabled: number;
}) {
    const db = await getDb();
    if (!db) return null;

    const existing = await getPaymentMethodSettings(data.artistId);

    if (existing) {
        await db
            .update(paymentMethodSettings)
            .set({
                stripeEnabled: data.stripeEnabled,
                paypalEnabled: data.paypalEnabled,
                bankEnabled: data.bankEnabled,
                cashEnabled: data.cashEnabled,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(paymentMethodSettings.artistId, data.artistId));
    } else {
        await db.insert(paymentMethodSettings).values(data);
    }

    return getPaymentMethodSettings(data.artistId);
}
