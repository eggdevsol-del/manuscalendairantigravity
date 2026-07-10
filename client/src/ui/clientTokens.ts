/**
 * CLIENT DARK ACCENTS — SINGLE SOURCE OF TRUTH
 * TATTOI × Travel App Design System v2.0
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
 * DS v2.0: --primary is now #F8D057 (yellow) with #1B1B1B foreground.
 * Only values that are INHERENTLY dark-mode-only AND appear nowhere on the
 * artist app belong here (e.g. proposal status badge colours, chat card accents).
 *
 * DO NOT hardcode hex colors in shared components — they break the artist theme.
 */

export const clientDark = {
  /** Status badges — dark-mode semantic colours for client-only surfaces */
  badge: {
    accepted: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    pending:  "bg-amber-500/10  text-amber-400  border border-amber-500/20",
    paid:     "bg-blue-500/10   text-blue-400   border border-blue-500/20",
    declined: "bg-red-500/10    text-red-400    border border-red-500/20",
    confirmed:"bg-purple-500/10 text-purple-400 border border-purple-500/20",
  },

  /** Proposal portrait card accents — inline in client chat stream only */
  proposalCard: {
    /** Outer card shell — uses bg-card (auto-switches) + border */
    shell: "bg-card border border-border rounded-2xl overflow-hidden",
    /** Accent status bar at the top of the card */
    accentPending:  "bg-amber-500",
    accentAccepted: "bg-emerald-500",
    accentConfirmed:"bg-purple-500",
    accentDeclined: "bg-red-500",
    /** Stats grid background — subtle secondary fill */
    statsCell: "bg-secondary",
    /** CTA row top border */
    ctaRow: "border-t border-border",
  },
} as const;
