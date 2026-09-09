import { spawnSync } from "node:child_process";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Capacitor 8 cannot translate OneSignal's CocoaPods-only plugin.xml to SPM.
// Regenerate a local SPM bridge from the installed plugin source after every sync.
const sync = spawnSync(
  process.execPath,
  ["node_modules/@capacitor/cli/bin/capacitor", "sync", "ios"],
  { stdio: "inherit" }
);
if (sync.status !== 0) process.exit(sync.status || 1);
const bridge =
  "ios/capacitor-cordova-ios-plugins/sources/OnesignalCordovaPlugin";
await mkdir(path.join(bridge, "Sources/include"), { recursive: true });
await copyFile(
  "node_modules/onesignal-cordova-plugin/src/ios/OneSignalPush.m",
  path.join(bridge, "Sources/OneSignalPush.m")
);
await copyFile(
  "node_modules/onesignal-cordova-plugin/src/ios/OneSignalPush.h",
  path.join(bridge, "Sources/include/OneSignalPush.h")
);
await writeFile(
  path.join(bridge, "Package.swift"),
  `// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "OnesignalCordovaPlugin",
  platforms: [.iOS(.v15)],
  products: [.library(name: "OnesignalCordovaPlugin", targets: ["OnesignalCordovaPlugin"])],
  dependencies: [
    .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
    .package(url: "https://github.com/OneSignal/OneSignal-iOS-SDK.git", exact: "5.4.1")
  ],
  targets: [.target(name: "OnesignalCordovaPlugin", dependencies: [
    .product(name: "Cordova", package: "capacitor-swift-pm"),
    .product(name: "OneSignalFramework", package: "OneSignal-iOS-SDK"),
    .product(name: "OneSignalInAppMessages", package: "OneSignal-iOS-SDK"),
    .product(name: "OneSignalLocation", package: "OneSignal-iOS-SDK")
  ], path: "Sources", publicHeadersPath: "include")]
)
`
);
const manifest = "ios/App/CapApp-SPM/Package.swift";
const source = await readFile(manifest, "utf8");
await writeFile(
  manifest,
  source.replace(
    /\.package\(name: "CapacitorStatusBar", path: "[^"]+"\)/,
    '.package(name: "CapacitorStatusBar", path: "../../../node_modules/@capacitor/status-bar")'
  )
);
console.log("iOS dependencies prepared. Open ios/App/App.xcodeproj in Xcode.");
