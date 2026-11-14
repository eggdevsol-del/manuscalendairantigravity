# Android: app id, version, signing

The Android app is currently `com.manus.calendair`, displayed as "Tattoi".
An application id can never be changed once an app is published on Google
Play, so choose the permanent one before the first upload.

## Changing the app id

Replace `com.manus.calendair` with the new id in each place below.

Required (Android):

1. `android/variables.gradle`: `appId = '...'`. This sets both the Gradle
   `namespace` and the `applicationId` in `android/app/build.gradle`.
2. `android/app/src/main/res/values/strings.xml`: `package_name` and
   `custom_url_scheme`.
3. `android/app/src/main/java/com/manus/calendair/MainActivity.java`: the
   `package` line, and move the file to the folder that matches the new id
   (for example `java/app/tattoi/MainActivity.java` for `app.tattoi`). The
   manifest refers to `.MainActivity`, which resolves against the namespace, so
   the manifest itself needs no edit.
4. `android/app/google-services.json`: download a new file from the Firebase
   console after adding an Android app with the new id to the Firebase project
   (the build fails if no client in this file matches the application id).
   Do not hand-edit it.

Required (outside `android/`):

5. `capacitor.config.ts`: `appId`.
6. OneSignal dashboard: the Android (FCM) platform settings are tied to the
   Firebase project; confirm push still arrives after step 4.
7. The iOS bundle identifier is separate; see the iOS project if both should
   match.

Then run `npx cap sync android` and build.

Display name: `app_name` and `title_activity_main` in `strings.xml`, and
`appName` in `capacitor.config.ts`.

## Version code rule

`versionName` is the `version` field of the root `package.json`.
`versionCode` is computed in `android/app/build.gradle`:

    versionCode = major * 1_000_000 + minor * 10_000 + patch * 10 + build

- `3.2.3` gives `3020030`.
- The version must be exactly `major.minor.patch` in digits. A suffix such as
  `3.2.3-beta.1` stops the build (the iOS version script applies the same
  rule).
- It only increases as long as the package.json version only increases, which
  is what Google Play requires for every upload.
- `build` is a single digit, default 0. Use it only to upload the same version
  again (for example after a rejected upload):
  `./gradlew :app:bundleRelease -PtattoiBuildNumber=1`, or set
  `TATTOI_ANDROID_BUILD_NUMBER=1`.
- Limits: minor up to 99, patch up to 999. The build stops with a clear error
  if a version does not fit; never lower the multipliers, because that would
  produce a smaller code than one already uploaded.

## Release signing

No keystore is stored in this repository, and none must ever be committed
(`*.jks`, `*.keystore` and `keystore.properties` are git-ignored).

Provide the upload key in one of two ways:

- Copy `android/keystore.properties.example` to `android/keystore.properties`
  and fill in `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
- Or set `TATTOI_ANDROID_KEYSTORE_FILE`, `TATTOI_ANDROID_KEYSTORE_PASSWORD`,
  `TATTOI_ANDROID_KEY_ALIAS`, `TATTOI_ANDROID_KEY_PASSWORD` (for CI).

What happens at build time:

- Nothing configured (no `keystore.properties`, none of the four variables):
  the release build runs but its output is unsigned, and Gradle prints a
  warning saying so. Google Play will not accept that file.
- All four values set and the keystore file exists: the release is signed.
- Anything in between (one value missing, or `storeFile` pointing at a file
  that does not exist): every build that includes a release task stops with an
  error naming what is wrong. This is deliberate, so a typo cannot quietly
  produce an unsigned bundle.

Debug builds and Android Studio sync are never affected.

## Building

    pnpm build
    npx cap sync android     # also creates android/capacitor-cordova-android-plugins
    cd android
    ./gradlew :app:assembleDebug      # debug APK
    ./gradlew :app:bundleRelease      # AAB for Google Play

Needs JDK 21 and the Android SDK with platform 36.

## Launch configuration

- Target and compile SDK 36, minimum SDK 24 (Capacitor 8 defaults).
- Portrait only on phones (`android:screenOrientation="portrait"` on
  `MainActivity`). Android 16 ignores this on tablets and foldables, so the
  app can still rotate there.
- Permissions declared: `INTERNET`, `POST_NOTIFICATIONS`. The reasons for not
  declaring camera or location are in the manifest comment.
- The manifest has a `<queries>` block for the camera capture intents so that
  `<input type="file" capture>` in the web view can open the system camera app
  on Android 11+. It is not a permission and needs no Play declaration. Test
  it on a real Android 11+ device once a screen with a capture input is
  reachable in the app.
- Launcher icons and splash images are still the stock Capacitor placeholders.
