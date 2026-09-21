# Release-check repair

## Cause
The workflow first failed during pnpm setup because its version duplicated the integrity-pinned packageManager value. That fix was already pushed. Once setup worked, the browser gate reached tests written for superseded sitting-list sheets, generic component tours, and older card dimensions.

## Changes
- Use Node 24 action runtimes: checkout v5, pnpm/action-setup v5, setup-node v6 and upload-artifact v6. Retain package.json as the pnpm version source.
- Follow project links and individual sitting sheets; assert removed request buttons stay absent. Retain amount, project attribution, forms, safe layout, and no-unintended-mutation checks.
- Measure compact cards against shared computed tokens. Check graphical message facts directly.
- Start tours through the existing walkthrough URL route. Explicitly enumerate intentionally unguided surfaces; other missing guides remain failures. Verify actual business targets, viewport fit, completion/replay and focus restoration.
- Replace an untracked image dependency with an isolated embedded fixture.
- Share one preview URL across scripts and group artifacts beneath output/release-regressions. Verification writes evidence to the artifact directory, not tracked documentation.
- Add business guidance to Stripe account verification explaining why identity/bank checks matter and why returning does not imply approval.

## Production observation
Railway showed the thirty-column chart deployment active and successful. https://www.tattoi.app/api/health returned status ok, version 3.2.3. This is a health/deployment check, not acceptance testing of real charges or messages. No manual deployment or production data mutation was performed.

## Local validation
The complete scripts/verify-release.mjs run exited 0: 83 test files / 356 tests; TypeScript; frontend and server builds; overlay and production-data checks; chat scrolling; sitting, project and compact-card checks; 86 role/page walkthroughs; 16 public routes; all 97 feature scenarios; focus and viewport checks at 320/390/820; walkthrough replay for three roles at 440/820/1180. Fresh evidence is grouped in output/release-regressions.
