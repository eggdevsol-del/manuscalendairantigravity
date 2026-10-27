import SwiftUI
import UIKit

enum Ivory {
  static func color(_ light: UInt32, _ dark: UInt32) -> Color {
    func ui(_ hex: UInt32) -> UIColor {
      UIColor(
        red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255,
        blue: Double(hex & 255) / 255, alpha: 1)
    }
    return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? ui(dark) : ui(light) })
  }
  static let paper = color(0xf8f6f2, 0x211f1c)
  static let surface = color(0xfffdfa, 0x2d2a26)
  static let ink = color(0x2c2823, 0xf2ede5)
  static let muted = color(0x706960, 0xbbb3a7)
  static let line = color(0xe3ddd3, 0x474037)
  static let green = color(0x46634e, 0xb4c8ad)
  static let soft = color(0xe8eee5, 0x303e30)
  static func heading(_ size: CGFloat = 32) -> Font {
    .custom("Georgia", size: size, relativeTo: .title)
  }
}
struct NativePage<Content: View>: View {
  let title: String
  var subtitle: String = ""
  @ViewBuilder var content: Content
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        Text(title).font(Ivory.heading()).accessibilityAddTraits(.isHeader)
        if !subtitle.isEmpty { Text(subtitle).foregroundStyle(Ivory.muted) }
        content
      }.frame(maxWidth: 760, alignment: .leading).padding(20).frame(maxWidth: .infinity)
    }.background(Ivory.paper).foregroundStyle(Ivory.ink).navigationBarTitleDisplayMode(.inline)
  }
}
struct NativePanel<Content: View>: View {
  var green = false
  @ViewBuilder var content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: 14) { content }.frame(
      maxWidth: .infinity, alignment: .leading
    ).padding(18).background(
      green ? Ivory.soft : Ivory.surface, in: RoundedRectangle(cornerRadius: 18)
    ).overlay(RoundedRectangle(cornerRadius: 18).stroke(Ivory.line.opacity(green ? 0 : 1)))
  }
}
struct ErrorNotice: View {
  let message: String
  var retry: (() -> Void)? = nil
  var body: some View {
    NativePanel {
      Label("Something didn’t load", systemImage: "exclamationmark.circle").font(.headline)
      Text(message).foregroundStyle(Ivory.muted)
      if let retry { Button("Try again", action: retry).buttonStyle(.bordered) }
    }.accessibilityElement(children: .contain)
  }
}
struct RecordRows: View {
  let record: JSONValue
  let fields: [(String, String)]
  var body: some View {
    ForEach(fields, id: \.0) { field in
      if !record[field.1].isNull {
        HStack(alignment: .top) {
          Text(field.0).foregroundStyle(Ivory.muted)
          Spacer()
          Text(
            record[field.1].string.isEmpty ? String(record[field.1].double) : record[field.1].string
          ).multilineTextAlignment(.trailing)
        }
        Divider()
      }
    }
  }
}
struct MoneyRow: View {
  let title: String
  let cents: Int
  var currency = "AUD"
  var body: some View {
    HStack {
      Text(title)
      Spacer()
      Text(NativeMoney.format(cents, currency: currency)).monospacedDigit()
    }
  }
}
struct QueryScreen<Content: View>: View {
  @Environment(AppStore.self) private var store
  let path: String
  var input: JSONValue = .null
  @ViewBuilder let content: (JSONValue) -> Content
  @State private var value: JSONValue?
  @State private var error: String?
  @State private var attempt = 0
  var body: some View {
    Group {
      if let value { content(value) }
      if let error { ErrorNotice(message: error) { attempt += 1 } }
      if value == nil && error == nil {
        ProgressView("Loading…").frame(maxWidth: .infinity).padding()
      }
    }.task(id: "\(store.revision):\(attempt):\(path):\(input.encodedString)") {
      do {
        let next = try await store.query(path, input, fresh: attempt > 0)
        try Task.checkCancellation()
        value = next
        error = nil
      } catch is CancellationError {} catch { self.error = error.localizedDescription }
    }
  }
}
struct RemoteRecords: View {
  let title: String
  let path: String
  var input: JSONValue = .null
  var arrayKey: String? = nil
  var body: some View {
    NativePage(title: title) {
      QueryScreen(path: path, input: input) { value in
        let records = arrayKey.map { value[$0].array } ?? value.array
        if records.isEmpty { Text("Nothing here yet.").foregroundStyle(Ivory.muted) }
        ForEach(Array(records.enumerated()), id: \.offset) { _, row in
          NativePanel {
            Text(row["title"].string.isEmpty ? row["name"].string : row["title"].string).font(
              .headline)
            RecordRows(
              record: row,
              fields: [("Status", "status"), ("Date", "createdAt"), ("Description", "description")])
          }
        }
      }
    }
  }
}
