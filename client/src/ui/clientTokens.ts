/**
 * CLIENT DARK UI — SINGLE SOURCE OF TRUTH
 * ─────────────────────────────────────────────────────────────────────────────
 * All dark-mode visual values specific to the CLIENT experience live here.
 * The client app is always in dark mode (forceTheme="dark").
 *
 * DO NOT hardcode colors in client-facing components.
 * DO NOT duplicate these values in other files.
 * Import from this file and compose via cn().
 *
 * Hierarchy (darkest → lightest):
 *   background  #050505
 *   card        #111111   (--card after fix)
 *   sheet       #0e0e0e   (ActionPanel, slightly lifted)
 *   surface     #1a1a1a   (elevated surface, modals)
 */

export const clientDark = {
  /** Bottom sheet container (ActionPanel, FAB panel) */
  sheet: {
    bg: "bg-[#0e0e0e]",
    handle: "bg-white/20",
    border: "border-white/[0.06]",
    shadow: "shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.6)]",
  },

  /** Card surfaces (use tokens.card.bg / bg-card for CSS-var-driven cards) */
  card: {
    lifted: "bg-[#111111]",          // matches --card after fix
    elevated: "bg-[#1a1a1a]",        // modals, popovers
    stats: "bg-white/[0.04]",        // stats grid cells, inner panels
    border: "border-white/[0.08]",
  },

  /** Status badges — dark-mode semantic colours */
  badge: {
    accepted: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    pending:  "bg-amber-500/10  text-amber-400  border border-amber-500/20",
    paid:     "bg-blue-500/10   text-blue-400   border border-blue-500/20",
    declined: "bg-red-500/10    text-red-400    border border-red-500/20",
    confirmed:"bg-purple-500/10 text-purple-400 border border-purple-500/20",
  },

  /** Proposal portrait card — inline in chat stream */
  proposalCard: {
    /** Outer card shell */
    shell: "bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden",
    /** Accent status bar at the top of the card */
    accentPending:  "bg-amber-500",
    accentAccepted: "bg-emerald-500",
    accentConfirmed:"bg-purple-500",
    accentDeclined: "bg-red-500",
    /** Stats grid background */
    statsCell: "bg-white/[0.04]",
    /** CTA row background */
    ctaRow: "bg-white/[0.03]",
  },
} as const;
