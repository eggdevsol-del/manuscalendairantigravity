# Calendar scrolling — iOS momentum fix

The timeline no longer rewrites its native scroll position when a scroll-derived date comes back from the parent. That feedback loop could cancel iOS inertia at day boundaries.

Appointment responses are held until scrolling settles, so row heights do not change beneath an active drag or coast. Holding a finger stationary keeps those updates deferred. Virtual-window recentering also waits for idle. The current date and within-day position are preserved when deferred data changes the row heights.

Visible-row updates are coalesced into animation frames, with viewport-based overscan. Native WebKit owns touch deceleration; no synthetic drag or inertia simulation was added. The scroll region explicitly permits vertical panning and pinch zoom, retains momentum overflow and has no mandatory snapping. Nearby date-button navigation uses native smooth scrolling; reduced-motion users get immediate navigation. Selecting the same day intentionally returns to its start.

Row header padding and compact appointment text now fit the virtual row-height model, avoiding overlap/clipping.

## Verification

Eight targeted regression tests cover date echoes, drag/coast updates, stationary touch, deferred row-height anchoring, same-day navigation, reduced motion, both virtual-window edges, bounded rendering and unmount cleanup. The full suite passes **229 tests across 59 files**. TypeScript and the production client build pass. All **32 browser checks passed** across 390px and 820px layouts. Simulated touch flings and wheel scrolling crossed dates/months with **zero application scroll-position writes during motion**. Deferred data, idle rebasing, row alignment, date navigation, agenda expansion, resizing and booking entry also passed. Evidence: `calendar-scroll-results.json`. Browser: desktop Chromium with touch emulation. Native gesture feel still needs a physical iPhone check; a desktop browser cannot establish exact iOS deceleration.

## Technical references

WebKit documents inertia being cleared by JavaScript scroll-position writes in [bug 255193](https://bugs.webkit.org/show_bug.cgi?id=255193). Native accelerated overflow scrolling is described in [WebKit’s Safari 13 release notes](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/). This implementation avoids depending on a new Safari version to hide that feedback loop.

These changes are on `codex/tattoi-ivory-design-system`. No deployment was performed as part of this audit.
