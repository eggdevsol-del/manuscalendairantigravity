// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "TattoiNativeCore", platforms: [.iOS(.v17), .macOS(.v14)],
  products: [.library(name: "TattoiNativeCore", targets: ["TattoiNativeCore"])],
  targets: [
    .target(name: "TattoiNativeCore", path: "Sources/Core"),
    .testTarget(name: "TattoiNativeCoreTests", dependencies: ["TattoiNativeCore"], path: "Tests"),
  ])
