/**
 * CLIENT DARK ACCENTS — SINGLE SOURCE OF TRUTH
 * CalendAIr × Travel App Design System v3.0
 * ===================================================================================
 * Dark-mode accent values SPECIFIC to the client experience.
 *
 * ✅  For backgrounds and surfaces, use semantic Tailwind tokens instead:
 *     bg-background  — page background   (#1B1B1B in dark / #F5F5F7 in light)
 *     bg-card        — card surface      (#242424 in dark / #FFFFFF in light)
 *     bg-popover     — sheet / overlay   (#2A2A2A in dark / #EBEBEF in light)
 *     bg-secondary   — subtle fill       (#2A2A2A in dark)
 *     bg-muted       — ghost fill        (#242424 in dark)
 *     text-foreground / text-muted-foreground / text-primary
 *
 * DS v3.0: --primary is #F8D057 (yellow) with #1B1B1B foreground.
 * Status colours use statusColor tokens from tokens.ts.
 *
 * Only values that are INHERENTLY dark-mode-only AND appear nowhere on the
 * artist app belong here (e.g. proposal status badge colours, chat card accents).
 *
 * DO NOT hardcode hex colors in shared components — they break the artist theme.
 */

export const clientDark = {
  /** Status badges — use statusColor tokens from tokens.ts for new code */
  badge: {
    accepted: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)] border border-[var(--color-status-success-border)]",
    pending:  "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)] border border-[var(--color-status-warning-border)]",
    paid:     "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] border border-[var(--color-status-info-border)]",
    declined: "bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)] border border-[var(--color-status-danger-border)]",
    confirmed:"bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)] border border-[var(--color-status-success-border)]",
  },

  /** Proposal portrait card accents — inline in client chat stream only */
  proposalCard: {
    /** Outer card shell — uses bg-card (auto-switches) + border */
    shell: "bg-card border border-border rounded-[var(--radius-md)] overflow-hidden",
    /** Accent status bar at the top of the card */
    accentPending:  "bg-[var(--color-status-warning-text)]",
    accentAccepted: "bg-[var(--color-status-success-text)]",
    accentConfirmed:"bg-[var(--color-status-success-text)]",
    accentDeclined: "bg-[var(--color-status-danger-text)]",
    /** Stats grid background — subtle secondary fill */
    statsCell: "bg-secondary",
    /** CTA row top border */
    ctaRow: "border-t border-border",
  },
} as const;
