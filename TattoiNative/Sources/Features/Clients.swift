import SwiftUI

struct ClientsView: View {
  @Environment(AppStore.self) private var store
  @State private var search = ""
  var body: some View {
    NativePage(title: "Clients") {
      QueryScreen(path: "conversations.getClients") { data in
        let clients = data.array.filter {
          search.isEmpty || $0["name"].string.localizedCaseInsensitiveContains(search)
        }
        if clients.isEmpty { Text("No clients match.").foregroundStyle(Ivory.muted) }
        ForEach(clients, id: \.id) { client in
          NavigationLink {
            ClientView(clientID: client.id)
          } label: {
            NativePanel {
              Text(client["name"].string).font(.headline)
              Text(client["city"].string).foregroundStyle(Ivory.muted)
              Text("\(client["sittings"].int) sittings")
            }
          }.buttonStyle(.plain)
        }
      }
    }.searchable(text: $search).refreshable { store.invalidate() }
  }
}
struct ClientView: View {
  @Environment(AppStore.self) private var store
  let clientID: String
  @State private var note = ""
  @State private var error: String?
  @State private var busy = false
  var body: some View {
    NativePage(title: "Client history") {
      QueryScreen(path: "projects.clientWorkspace", input: .object(["clientId": .string(clientID)]))
      { data in
        Text(data["client"]["name"].string).font(Ivory.heading(28))
        RecordRows(record: data["client"], fields: [("Email", "email"), ("Mobile", "phone")])
        NavigationLink("Message & book in") {
          ThreadView(
            conversationID: data["conversationId"].int, name: data["client"]["name"].string,
            clientID: clientID)
        }
        Text("Sittings").font(.headline)
        ForEach(data["sessions"].array, id: \.id) { session in
          NavigationLink {
            SittingView(sitting: session)
          } label: {
            SittingSummary(sitting: session)
          }.buttonStyle(.plain)
        }
        Text("Private notes").font(.headline)
        ForEach(data["notes"].array, id: \.id) { note in
          NativePanel {
            Text(note["note"].string)
            Text("Only visible in your artist account").font(.caption).foregroundStyle(Ivory.muted)
          }
        }
        TextField("Add a private note", text: $note, axis: .vertical).textFieldStyle(.roundedBorder)
        Button("Save note") {
          busy = true
          Task {
            defer { busy = false }
            do {
              try await store.mutate(
                "clientProfile.addClientNote",
                .object(["clientId": .string(clientID), "note": .string(note)]))
              note = ""
              error = nil
            } catch { self.error = error.localizedDescription }
          }
        }.disabled(busy || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        Text("Forms").font(.headline)
        ForEach(data["forms"].array, id: \.id) { form in
          HStack {
            Text(form["title"].string)
            Spacer()
            Text(form["status"].string.capitalized).foregroundStyle(Ivory.muted)
          }
        }
      }
      if let error { ErrorNotice(message: error) }
    }.refreshable { store.invalidate() }
  }
}
