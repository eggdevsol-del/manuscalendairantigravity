/**
 * Exchange Rate Service
 *
 * Fetches and caches exchange rates for multi-currency support.
 * Used when artist's currency differs from supplier's currency.
 *
 * Cache strategy:
 * - In-memory cache with 1-hour TTL (primary)
 * - Database cache as fallback (survives restarts)
 * - Falls back to 1.0 rate if API fails (same-currency)
 */

import { getDb } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Country → Currency Mapping ───────────────────────────────

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AU: "AUD",
  NZ: "NZD",
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  EU: "EUR",
  // European countries
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", IE: "EUR", PT: "EUR", FI: "EUR",
  // Others
  JP: "JPY",
  SG: "SGD",
  HK: "HKD",
};

/** Resolve currency from a country code */
export function currencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return "AUD";
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || "AUD";
}

// ── In-Memory Cache ──────────────────────────────────────────

interface CachedRate {
  rate: number;
  fetchedAt: number; // ms timestamp
}

const rateCache = new Map<string, CachedRate>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}_${to.toUpperCase()}`;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Get the exchange rate from one currency to another.
 * Returns the multiplier: 1 unit of `from` = rate units of `to`.
 *
 * Examples:
 *   getExchangeRate("AUD", "NZD") → 1.08  (1 AUD = 1.08 NZD)
 *   getExchangeRate("NZD", "AUD") → 0.93  (1 NZD = 0.93 AUD)
 *   getExchangeRate("AUD", "AUD") → 1.0   (same currency)
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Same currency — no conversion needed
  if (fromUpper === toUpper) return 1.0;

  const key = cacheKey(fromUpper, toUpper);

  // 1. Check in-memory cache
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  // 2. Try fetching fresh rate
  try {
    const rate = await fetchFreshRate(fromUpper, toUpper);
    if (rate) {
      // Cache in memory
      rateCache.set(key, { rate, fetchedAt: Date.now() });
      // Also cache the inverse
      rateCache.set(cacheKey(toUpper, fromUpper), { rate: 1 / rate, fetchedAt: Date.now() });
      // Persist to DB
      await persistRate(fromUpper, toUpper, rate);
      return rate;
    }
  } catch (error) {
    console.error(`[ExchangeRate] API fetch failed for ${fromUpper}→${toUpper}:`, error);
  }

  // 3. Fallback to DB cache (may be stale but better than nothing)
  try {
    const dbRate = await getDbCachedRate(fromUpper, toUpper);
    if (dbRate) {
      rateCache.set(key, { rate: dbRate, fetchedAt: Date.now() - CACHE_TTL_MS + 5 * 60 * 1000 }); // Re-check in 5min
      return dbRate;
    }
  } catch {
    // DB also failed
  }

  // 4. Ultimate fallback — return 1.0 (no conversion)
  console.warn(`[ExchangeRate] All sources failed for ${fromUpper}→${toUpper}, using 1.0`);
  return 1.0;
}

/**
 * Convert an amount from one currency to another.
 * Works in cents — input and output are both in cents.
 */
export async function convertCents(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amountCents;
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return Math.round(amountCents * rate);
}

// ── Internal: API Fetch ──────────────────────────────────────

async function fetchFreshRate(from: string, to: string): Promise<number | null> {
  // Try open.er-api.com (free, no API key needed)
  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${from}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.result === "success" && data?.rates?.[to]) {
        return data.rates[to];
      }
    }
  } catch {
    // Try fallback
  }

  // Fallback: exchangerate.host (also free)
  try {
    const response = await fetch(
      `https://api.exchangerate.host/latest?base=${from}&symbols=${to}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.success && data?.rates?.[to]) {
        return data.rates[to];
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

// ── Internal: DB Cache ───────────────────────────────────────

async function persistRate(from: string, to: string, rate: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Upsert — delete old then insert
    await db.delete(schema.exchangeRateCache)
      .where(
        and(
          eq(schema.exchangeRateCache.fromCurrency, from),
          eq(schema.exchangeRateCache.toCurrency, to)
        )
      );

    await db.insert(schema.exchangeRateCache).values({
      fromCurrency: from,
      toCurrency: to,
      rate: String(rate),
    });
  } catch (error) {
    console.error("[ExchangeRate] DB persist failed:", error);
  }
}

async function getDbCachedRate(from: string, to: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const row = await db.query.exchangeRateCache.findFirst({
    where: and(
      eq(schema.exchangeRateCache.fromCurrency, from),
      eq(schema.exchangeRateCache.toCurrency, to)
    ),
  });

  if (!row) return null;
  return parseFloat(String(row.rate));
}
