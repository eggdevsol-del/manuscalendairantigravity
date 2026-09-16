# Original workflows with the Ivory design

## Branches and baseline

- Candidate: `codex/tattoi-original-workflows-ivory`.
- Preserved latest version: `codex/tattoi-ivory-design-system`, commit `ed84523`.
- Original presentation baseline: `main`, commit `aca9ee8`. The user did not specify an older commit; this is the pre-rebuild route and workflow structure selected for this candidate.

The candidate starts from the latest code, restores the original route shells and primary screens, and applies the latest Ivory foundations through shared components. It does not reset the repository to an old commit. Server, database, payment fee, authentication, and security implementations remain at the latest checkpoint.

## Implemented

Original artist Today/Clients/Supplies home, pushed Money screen, conversation list, chat, dual-layer calendar, profile/settings, client Discover/Messages/Bookings/Profile, supplier navigation, and public artist/booking/consultation entry points are active again. Added working destinations for the current shared project, purchase, waitlist and supply-order links.

The shared visual adapter is `client/src/ui/original-ivory.css`. Colours and fonts reference the existing Ivory foundations. Page headers, navigation, segmented controls, cards, inputs, authentication and overlay surfaces use the shared presentation. Original page-specific information order and actions remain in their original components.

Integration repairs retain message history and media-resize scroll anchoring, expose older messages, mount one responsive chat controller, prevent tablet composer overlap, and give chat booking a single sheet owner. The original calendar controller retains the newer personal-plus-studio appointment query fix. Dashboard tours no longer substitute demo records.

## Validation

- TypeScript: passed.
- Unit/integration tests: 288 passed across 72 files.
- Production web build: passed.
- Production data and overlay guards: passed, 295 reachable modules.
- iOS sync and asset parity: passed, 40 files.
- Browser suite: `scripts/ui-audit/original-workflow-regressions.mjs`. Covers role screen rendering, public routes, phone/tablet sent-message visibility, single booking sheets, original Home/Money/Clients/Supplies controls, calendar navigation/quick booking, and narrow/tablet dark presentation.

The release verifier invokes the original-workflow browser suite on this branch. The earlier v3 suites remain in the repository for that UI; their v3 selectors do not describe the restored screens.

Screenshots and detailed results are in the local `output/tattoi-original-ivory` directory. They are captures of the compiled app with isolated API fixtures, not a separate prototype. This validation is not live payment processing, production booking acceptance, or physical iPhone keyboard/momentum testing. Those require device and service acceptance before release.

## Compare safely

Each design is on its own branch. Switch to `codex/tattoi-ivory-design-system` to recover the previous version, then rebuild and run `ios:sync` before installing its iOS bundle. Switching Git branches alone does not replace generated native web assets. No deployment or remote push is performed by this conversion.
