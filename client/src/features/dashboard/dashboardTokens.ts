/**
 * Dashboard Design Tokens — §4 Visual System
 *
 * These tokens are used ONLY by rebuilt dashboard components (§3).
 * They do not affect the Clients tab or other existing screens.
 *
 * Source: Implementation spec §4, verbatim values.
 */

// ── Surfaces ──────────────────────────────────────────────
export const DT = {
  // Surfaces
  pageBg: "#111112",
  cardSurface: "#1a1a1b",
  rowHover: "#212123",
  quietRow: "rgba(255,255,255,.02)",
  sheetSurface: "#1c1c1e",

  // Borders
  hairline: "rgba(255,255,255,.06)",
  emphasisBorder: "rgba(242,202,92,.3)",

  // Text
  textPrimary: "#f5f5f4",
  textSecondary: "rgba(255,255,255,.62)",
  textTertiary: "rgba(255,255,255,.58)",

  // Semantic
  green: "#4ade80",
  amber: "#f2ca5c",
  amberHover: "#f6d472",
  amberOnColor: "#1a1a12",
  amberBorder40: "rgba(242,202,92,.4)",
  destructive: "#ef4444",
  destructiveText: "#f87171",

  // Track
  progressTrack: "rgba(255,255,255,.09)",

  // Fact panel
  factPanelBg: "rgba(255,255,255,.03)",

  // Active segment pill
  segmentPill: "rgba(255,255,255,.1)",
} as const;

// ── Type Scale ────────────────────────────────────────────
// Format: [size]/[weight]
export const DType = {
  headlineMoney: { fontSize: 30, fontWeight: 600 },
  screenTitle: { fontSize: 18, fontWeight: 600 },
  button: { fontSize: 15.5, fontWeight: 600 },
  rowTitle: { fontSize: 14.5, fontWeight: 600 },
  rowBody: { fontSize: 13, fontWeight: 400 },
  rowMeta: { fontSize: 12, fontWeight: 400 },
  exceptionPill: { fontSize: 11.5, fontWeight: 500 },
  sectionLabel: { fontSize: 10, fontWeight: 500, letterSpacing: "0.14em" },
  sectionCount: { fontSize: 11.5, fontWeight: 400 },
  moneyLabel: { fontSize: 9.5, fontWeight: 500, letterSpacing: "0.13em" },
  rowBodyLg: { fontSize: 12.5, fontWeight: 400 },
} as const;

// ── Spacing ───────────────────────────────────────────────
export const DSpace = [4, 7, 9, 11, 14, 16, 20, 22] as const;

// ── Radii ─────────────────────────────────────────────────
export const DRadius = {
  pill: 99,
  card: 15,
  row: 13,
  button: 11,
  small: 9,
  factPanel: 10,
} as const;
