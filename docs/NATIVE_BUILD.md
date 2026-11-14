# Native build (iOS and Android)

## The one production mode

The store apps are **bundled** apps. The web assets built by Vite
(`dist/public`) are copied into the binary and served from the device. The app
does not load a remote website.

- Page origin on iOS: `capacitor://localhost`. On Android: `https://localhost`.
- Every server call goes to an absolute HTTPS address taken from
  `VITE_API_BASE_URL` at build time: tRPC (`/api/trpc`), the error reporter,
  the Google client id lookup and the offline check.
- Sign-in is by Bearer token only. The token returned by email/password
  sign-in is kept in the web view's local storage and sent in the
  `Authorization` header. The native app does not send cookies.
- `CAPACITOR_SERVER_URL` (see `capacitor.config.ts`) is for development only.
  It must be unset when syncing a store build. While it is set, the shell
  loads the page from that server, calls to `/api` go to the same server, and
  the web build served there does not need `VITE_API_BASE_URL`.

## Environment variables

Set these in the shell, or in `.env.production`, **before** `vite build`.
They are compiled into the web assets, so changing one means rebuilding and
syncing again.

| Variable                      | Required      | Value                                                                                                                                                     |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`           | Yes           | HTTPS origin of the Tattoi server, no path, for example `https://www.tattoi.app`.                                                                         |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes           | Stripe publishable key, for client deposits, balances and supplier orders.                                                                                |
| `VITE_ONESIGNAL_APP_ID`       | For push      | OneSignal app id.                                                                                                                                         |
| `VITE_PUBLIC_WEB_URL`         | Optional      | HTTPS origin of the public web app, used for links other people open. Defaults to `VITE_API_BASE_URL`. Only needed when the web app is on another origin. |
| `CAPACITOR_SERVER_URL`        | Must be unset | Development only.                                                                                                                                         |

If `VITE_API_BASE_URL` is missing or is not an `https://` address, the bundled
native app (page origin `localhost` with no port) stops at first launch on a screen titled "Tattoi can’t start" and logs the
reason to the console. It does not fail the Vite build, because the same build
command also produces the website, where the variable is optional. Check for
that screen on a simulator before archiving.

## Server requirements

The server (`server/_core/index.ts`) already allows the native origins
`capacitor://localhost` and `https://localhost` in CORS, and
`server/_core/sdk.ts` accepts the Bearer token before it looks for a cookie.
No server change is needed for sign-in or API calls.

The server's `APP_URL` must be the public HTTPS address of the web app. Emailed
links and Stripe return addresses are built from it.

## Commands

All of these already exist in `package.json`.

iOS:

```sh
unset CAPACITOR_SERVER_URL
export VITE_API_BASE_URL=https://www.tattoi.app   # the real server address
pnpm ios:prepare   # vite build, then ios:sync, then check-native-assets
pnpm ios:build     # simulator build without signing, to prove it compiles
```

`pnpm ios:sync` on its own copies an existing `dist/public` into the iOS
project and prepares its Swift packages. `pnpm check-native-assets` confirms
the iOS project holds exactly the files in `dist/public`. Archive and upload
from Xcode (`ios/App/App.xcodeproj`).

Android has no script in `package.json`. Use the Capacitor command line that
is already installed, then Gradle:

```sh
unset CAPACITOR_SERVER_URL
export VITE_API_BASE_URL=https://www.tattoi.app
pnpm exec vite build
pnpm exec cap sync android
cd android && ./gradlew bundleRelease
```

Signing and the app id are described in `android/README-APP-ID.md`.

## What the native app does differently from the website

All of it keys off one helper, `isNativeApp()` in `client/src/lib/platform.ts`.

- **Subscriptions.** The plan screen (`/subscriptions`) shows the current plan
  and its status only. There is no price, no way to subscribe or change plan,
  no billing portal, and nothing that says where a plan can be bought. The
  studio screen shows membership status only. Features that need another plan
  show as unavailable on the current plan.
- **Payments for real-world goods and services** are unchanged: client
  deposits and balances for tattoo sittings, and supplier orders of physical
  goods, are still paid by card through Stripe.
- **Sign-in.** The Google button renders nothing. Email and password, and
  emailed sign-in links, remain.
- **Updates.** The "Update available" banner, the server version poll and the
  service worker are off. The native app updates through the stores.
- **Offline.** "You’re offline. Reconnect to continue." with a Try again
  button shows on every screen, on the website too.
