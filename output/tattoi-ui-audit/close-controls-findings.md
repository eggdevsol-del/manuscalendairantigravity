# Portfolio and map close controls

This focused audit supplements the shared sheet/calendar close-control audit. It follows active paths from the current app shells and distinguishes closing a surface from clearing a search or removing an attachment.

## Fixed

- **Client Home → artist → portfolio artwork:** the top-left back chevron and top-right X both dismissed the same lightbox. The lightbox now has one labelled, 44px **Close artwork** control. Previous/next controls still change artwork, with separate labels and arrow-key support.
- **Portfolio overlay placement and keyboard handling:** the viewer previously lived inside a clipped artist card. It now renders as a dialog in `document.body`, respects shared safe areas, closes with Escape, and restores focus to the originating thumbnail.
- **Client Home → artist map:** the map's close button was behind the Home header because the overlay remained inside the scroll container. The map now renders in `document.body`, so the close control receives taps. Its header, search, filters and lower controls use shared native safe-area variables.
- **Map search:** **Close artist map** and **Clear artist search** have distinct accessible labels and 44px targets. Clearing search keeps the map open; closing the map returns to Home. These are separate actions, not duplicate dismissals.

## Reviewed without a duplicate close finding

- Session-plan, balance, storefront, supply and event checkouts: the sheet owns dismissal; payment back controls return to a preceding step.
- Consent review/signature and client form sheets: the enclosing sheet owns dismissal; signature cancellation changes the signing step.
- Artist profile portfolio upload, artwork preview and delete confirmation: one shell close per surface.
- Booking request attachment X controls remove an image. They do not close the request.
- Artist profile/booking-request overlays: raw dialog primitives do not add an implicit X alongside their custom navigation controls.
- Legacy `ClientProfileSheet` uses a raw `BottomSheet` without an implicit close control; its header X is not doubled by that wrapper.

## Verification

- `PortfolioExpand.test.tsx`: two component integration tests verify a single dismissal control, real previous/next behavior, the portal, Escape, arrow keys and focus restoration.
- `close-portfolio-check.mjs`: 15 checks at each of 390px and 820px, using the real React app with isolated API fixtures. Checks cover dismissal, navigation, focus, 44px targets, a simulated 54px top safe area, map close/search separation, matching map-marker/legend colours and absence of unhandled browser errors.
- Browser data: `close-portfolio-results.json`.
- Screenshots: `screens/portfolio-single-close-390.png`, `screens/portfolio-single-close-820.png`, `screens/map-close-and-clear-390.png`, `screens/map-close-and-clear-820.png`.

External requests are blocked in these checks. The map screenshots intentionally show no downloaded map tiles; they validate overlay controls and placement, not the external tile service. Physical iPhone behavior remains a release check.
