import SwiftUI
import UniformTypeIdentifiers

struct ImportsView: View {
  @Environment(AppStore.self) private var store
  @State private var picking = false
  @State private var mode = "clients"
  @State private var rows: [JSONValue] = []
  @State private var preview: JSONValue = .null
  @State private var filename = ""
  @State private var zone = TimeZone.current.identifier
  @State private var error: String?
  @State private var busy = false
  @State private var confirm = false
  var body: some View {
    NativePage(title: "Import your records") {
      NavigationLink("Import Instagram portfolio") { InstagramImportView() }
      NativePanel {
        Picker("Import", selection: $mode) {
          Text("Clients").tag("clients")
          Text("Sittings (pending backend update)").tag("appointments").disabled(true)
        }.pickerStyle(.segmented)
        Text(
          "CSV columns: name, email, phone. For sittings also include date, startTime, endTime, serviceName and price. Up to 500 rows per file."
        ).font(.footnote)
        TextField("IANA time zone", text: $zone).textInputAutocapitalization(.never)
          .autocorrectionDisabled().textFieldStyle(.roundedBorder)
        Button("Choose CSV file") { picking = true }.disabled(busy)
        if !filename.isEmpty {
          Text("\(filename) · \(rows.count) records").foregroundStyle(Ivory.muted)
        }
        if !rows.isEmpty {
          Button(busy ? "Checking records…" : "Preview import") { run(commit: false) }.disabled(
            busy)
        }
      }
      if !preview.isNull {
        let results = preview.array.isEmpty ? preview["rows"].array : preview.array
        ForEach(Array(results.enumerated()), id: \.offset) { _, row in
          NativePanel {
            Text(row["name"].string).font(.headline)
            Text(row["status"].string.capitalized)
            Text(row["detail"].string).foregroundStyle(Ivory.muted)
          }
        }
        if !rows.isEmpty {
          Button("Import reviewed records") { confirm = true }.buttonStyle(.borderedProminent)
            .disabled(busy)
        } else {
          Label("Import finished", systemImage: "checkmark.circle.fill").foregroundStyle(
            Ivory.green)
        }
      }
      if let error { ErrorNotice(message: error) }
    }.fileImporter(isPresented: $picking, allowedContentTypes: [.commaSeparatedText, .plainText]) {
      result in
      do {
        let url = try result.get()
        guard url.startAccessingSecurityScopedResource() else {
          throw APIError("Access to that file was not granted.")
        }
        defer { url.stopAccessingSecurityScopedResource() }
        rows = try CSVImport.rows(String(contentsOf: url, encoding: .utf8))
        filename = url.lastPathComponent
        preview = .null
        error = nil
      } catch { self.error = error.localizedDescription }
    }.onChange(of: mode) { _, _ in preview = .null }.onChange(of: zone) { _, _ in preview = .null }
      .confirmationDialog(
        "Import these records into your account?", isPresented: $confirm, titleVisibility: .visible
      ) {
        Button("Import records") { run(commit: true) }
        Button("Cancel", role: .cancel) {}
      }
  }
  private func run(commit: Bool) {
    guard !busy, !rows.isEmpty else { return }
    busy = true
    Task {
      defer { busy = false }
      do {
        preview = try await store.mutate(
          commit ? "dataImport.commit" : "dataImport.preview",
          .object([
            "mode": .string(mode), "rows": .array(rows), "timeZone": .string(zone),
            "serviceMap": .object([:]),
          ]))
        if commit {
          rows = []
          filename = ""
        }
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct InstagramImportView: View {
  @Environment(AppStore.self) private var store
  @State private var username = ""
  @State private var maxPosts = ""
  @State private var importID = 0
  @State private var status: JSONValue = .null
  @State private var busy = false
  @State private var error: String?
  var body: some View {
    NativePage(title: "Instagram import", subtitle: "Bring your existing portfolio into Tattoi.") {
      TextField("Instagram username", text: $username).textInputAutocapitalization(.never)
        .autocorrectionDisabled().textFieldStyle(.roundedBorder)
      TextField("Maximum posts (1–500)", text: $maxPosts).keyboardType(.numberPad).textFieldStyle(
        .roundedBorder)
      Button(busy ? "Starting…" : "Import portfolio") { start() }.buttonStyle(.borderedProminent)
        .disabled(
          busy
            || ["in_progress", "pending", "processing", "scraping", "importing"].contains(
              status["status"].string)
        )
      if !status.isNull {
        NativePanel {
          Image(
            systemName: ["completed", "complete"].contains(status["status"].string)
              ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath"
          ).font(.system(size: 44)).foregroundStyle(Ivory.green).frame(maxWidth: .infinity)
          Text(status["status"].string.capitalized).font(.headline)
          RecordRows(
            record: status,
            fields: [
              ("Processed", "totalProcessed"), ("Imported", "totalAdded"),
              ("Found", "totalDiscovered"), ("Skipped", "totalSkipped"), ("Failed", "totalFailed"),
              ("Error", "errorMessage"),
            ])
        }
      }
      if let error { ErrorNotice(message: error) }
    }.task(id: importID) {
      guard importID > 0 else { return }
      while !Task.isCancelled {
        do {
          status = try await store.query(
            "instagram.getImportStatus", .object(["importId": .integer(importID)]), fresh: true)
          if ["completed", "failed", "cancelled", "complete"].contains(status["status"].string) {
            store.invalidate()
            return
          }
          try await Task.sleep(for: .seconds(3))
        } catch is CancellationError { return } catch {
          self.error = error.localizedDescription
          return
        }
      }
    }
    .task {
      do {
        let latest = try await store.query("instagram.getLatestImport")
        if !latest.isNull {
          status = latest
          importID = latest["id"].int
        }
      } catch { self.error = error.localizedDescription }
    }
  }
  private func start() {
    guard !busy, !username.isEmpty, let count = Int(maxPosts), (1...500).contains(count) else {
      error = "Enter a username and 1–500 posts."
      return
    }
    busy = true
    Task {
      defer { busy = false }
      do {
        let result = try await store.mutate(
          "instagram.startImport",
          .object(["username": .string(username), "maxPosts": .integer(count)]))
        importID = result["importId"].int
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
