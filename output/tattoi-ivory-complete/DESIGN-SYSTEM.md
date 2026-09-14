# Tattoi Ivory

Ivory brings warm paper, dark ink and generous spacing to the existing React/Capacitor app. Display typography gives the brand character; familiar controls and plain labels keep daily work predictable.

## Foundations

| Token | Light value | Purpose |
|---|---|---|
| Background | #f8f6f2 | Warm paper |
| Surface | #fffdfa | Cards and sheets |
| Ink | #29231e | Main text |
| Muted | #746c64 | Supporting text |
| Line | #e5e0d9 | Quiet boundaries |
| Soft | #efebe5 | Grouping and secondary controls |
| Primary | #382c24 | Main action, with light text |

Dark mode uses warm charcoal surfaces and light ivory actions. Status colours retain their meaning and must be accompanied by words. Existing gold-named variables remain compatibility aliases, not a separate gold theme.

Display: native serif stack (Iowan/Georgia where available). Functional text: system sans serif. Forms use 17px text; controls generally target at least 44px, with prominent actions around 50px. Cards, grouped lists, pill selectors and bottom sheets share rounded shapes. The CSS is authoritative for exact component values.

## Interaction rules

- Keep the next action visible and specific: View booking, View artist, Send proposal.
- Reveal complex booking decisions in steps, then show dates and amounts together before submission.
- Keep optional design briefs collapsed initially; remember the user's choice.
- Use familiar back navigation, labelled destinations and role-specific navigation.
- Put artwork ahead of decorative chrome in discovery. Keep artist identity and the booking entry point readable.
- Keep messages and the composer together; remove competing root navigation in the focused mobile conversation.
- Preserve drafts, explicit payment confirmation, destructive-action confirmation and existing domain safeguards.
- Honour reduced-motion and reduced-transparency preferences. Maintain safe-area spacing, readable focus indicators and semantic control labels.
- Give each modal layer one close control. The enclosing sheet owns dismissal when a detail view is embedded inside it; standalone details retain their own close button. Keep field-clearing and attachment-removal actions local and explicitly labelled.

These choices aim to reduce memory demands, support recognition and make progress visible. No conversion-rate improvement or user-satisfaction uplift has been experimentally established for this implementation.

## Implementation

`client/src/app-v3/design/system.css` supplies tokens; `ivory.css` applies the shared presentation. The design also updates navigation, Today, public artist discovery, portfolio navigation, shared sheets and Stripe Elements appearance. Existing products, orders and events screens are connected to the artist workspace.

This remains the existing React/Capacitor application. It is not a SwiftUI rewrite. Real-device accessibility, keyboard and payment-provider validation remain release checks.

## Cohesion audit update

Page-level section controls now live in `Screen.subheader`, outside the scrolling page body. On iPhone they span the safe-area width, use equal segments and a 52px control height. All 13 page families share this placement. Nested controls retain the width of their containing detail view.

Shared geometry tokens: `--v3-control-height: 50px`, `--v3-icon-size: 44px`, `--v3-segment-height: 52px`, `--v3-header-title-height: 72px`, `--v3-header-subtitle-height: 42px`. Header rows reserve consistent space; unusually long or enlarged text is allowed to grow instead of being clipped. Focused conversation and media-view layouts remain deliberate contextual variants.

See `audit/AUDIT.md` for the complete findings, fixes and verification scope.
