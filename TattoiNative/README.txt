TATTOI NATIVE — iOS 17+

Project: TattoiNative.xcodeproj
Scheme: TattoiNative
Branch: ios-native
Bundle identifier: app.tattoi.native

This is a separate SwiftUI app, not a Capacitor or WKWebView wrapper. It does not replace client/, server/, shared/, or the existing ios/ Capacitor project. The existing uncommitted repository changes were preserved, not included in the native app's implementation commit.

IMPORTANT STATUS
This is an initial native implementation, not a completed feature-parity conversion or an App Store-ready release. See COVERAGE.txt for implemented flows and remaining work. Authenticated production workflows have not been exercised without a test-account sign-in. The app connects to the same backend and records as the PWA. Use a disposable artist account for testing; mutations can change real data.

OPEN AND BUILD
1. Open TattoiNative.xcodeproj in Xcode 26.
2. Select the TattoiNative scheme and an iPhone simulator.
3. Run. No signing team is needed for Simulator.
4. For a physical device, select your development team in Signing & Capabilities. Do not commit personal signing credentials or provisioning profiles.

Simulator SDK build:
xcodebuild -project TattoiNative.xcodeproj -scheme TattoiNative -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=- build

Foundation contract tests:
swift test --package-path .

CONFIGURATION
Config.xcconfig contains TATTOI_API_HOST. Its default is www.tattoi.app. For staging, override this build setting. Info.plist resolves TattoiAPIBaseURL from the setting. HTTPS is mandatory. There are no API keys or account passwords in the source.

DATA AND AUTHENTICATION
- Existing auth.login / auth.me endpoints; bearer JWT saved in device-only Keychain storage.
- No password persistence or credential-bearing browser URLs.
- URLSession refuses redirects to avoid forwarding bearer credentials to a different origin.
- Logout cancels in-flight work and clears account-scoped memory and Keychain session.
- Shared observable workspace cache; actions invalidate active views. Account-scoped server revision is checked every five seconds while foregrounded; background polling stops. This is not APNs or a claim of websocket delivery.
- Explicit loading/error/retry states. Failed mutations do not automatically retry.
- Money is represented in cents. Project balances use projects.summary, including server reconciliation of legacy payments and voucher credit.
- Photos use the existing authenticated upload/R2 services. Signing uses a native PencilKit canvas and the existing consent endpoint; the app does not generate answers or sign on the user's behalf.

NATIVE VS WEB BOUNDARIES
The screens in this project are native SwiftUI. Hosted Stripe onboarding and account recovery can open external HTTPS pages where appropriate; they are not an embedded PWA. Native checkout, identity-document upload, push registration and all remaining web feature parity are not silently simulated.

VERIFICATION — 27 OCTOBER 2026
- Generic iOS Simulator SDK build succeeded (arm64 and x86_64). Simulator signing must stay enabled for Keychain; use ad-hoc signing and the app-scoped entitlement.
- Six Swift package tests passed: cents and blank-input validation; stable JSON; SuperJSON dates; tRPC success/null/error decoding; quoted/multiline CSV handling; UTC date parsing.
- Installed and launched on the user's booted iPhone 17 / iOS 26.5 Simulator.
- Native sign-in screen visually verified; Evidence/sign-in.png.
- Initial unsigned-build Keychain failure fixed with simulator ad-hoc signing and app-scoped entitlements. Debug write/read/clear self-check passes on the booted Simulator.
- Live unauthenticated auth.me endpoint confirmed the expected tRPC/SuperJSON response without transmitting credentials.
- No account creation, medical submission, bank submission, payment, import, booking or promotion was executed during this validation.

The Build iOS Apps plugin's SwiftUI patterns and debugger guidance were used. Its XcodeBuildMCP tools were not exposed in this session, so the installed Xcode command-line tools were used for build/install/launch and Codex computer-use tools for visual verification.
