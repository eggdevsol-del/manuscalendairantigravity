import PhotosUI
import SwiftUI

struct InboxView: View {
  @Environment(AppStore.self) private var store
  @State private var search = ""
  @State private var unread = false
  var body: some View {
    NativePage(title: "tattoi Messages") {
      Toggle("Unread only", isOn: $unread)
      QueryScreen(path: "conversations.list") { value in
        let rows = value.array.filter { row in
          (!unread || row["unreadCount"].int > 0)
            && (search.isEmpty
              || row["otherUser"]["name"].string.localizedCaseInsensitiveContains(search))
        }
        if rows.isEmpty {
          Text(unread ? "No unread messages." : "Your conversations will appear here.")
            .foregroundStyle(Ivory.muted)
        }
        ForEach(rows, id: \.id) { row in
          NavigationLink {
            ThreadView(
              conversationID: row["id"].int, name: row["otherUser"]["name"].string,
              clientID: row["clientId"].string)
          } label: {
            HStack(spacing: 14) {
              Text(String(row["otherUser"]["name"].string.prefix(2))).font(Ivory.heading(23)).frame(
                width: 52, height: 52
              ).background(Ivory.soft, in: Circle())
              VStack(alignment: .leading, spacing: 6) {
                Text(row["otherUser"]["name"].string).font(.headline)
                Text(
                  row["lastMessage"].string.isEmpty
                    ? "Tattoo conversation" : row["lastMessage"].string
                ).font(.subheadline).foregroundStyle(Ivory.muted).lineLimit(2)
              }
              Spacer()
              if row["unreadCount"].int > 0 {
                Text(String(row["unreadCount"].int)).font(.caption.bold()).padding(8).background(
                  Ivory.soft, in: Circle())
              }
            }.padding(.vertical, 12)
          }.buttonStyle(.plain)
          Divider()
        }
      }
    }.searchable(text: $search, prompt: "Search clients or artists").refreshable {
      store.invalidate()
    }
  }
}
private enum ThreadSheet: String, Identifiable {
  case booking, promotion, references, brief
  var id: String { rawValue }
}
struct ThreadView: View {
  @Environment(AppStore.self) private var store
  let conversationID: Int
  var name = "Conversation"
  var clientID = ""
  @State private var messages: [JSONValue] = []
  @State private var text = ""
  @State private var error: String?
  @State private var busy = false
  @State private var sheet: ThreadSheet?
  @State private var photo: PhotosPickerItem?
  @State private var resolvedClientID = ""
  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 16) {
          if let error { ErrorNotice(message: error) { store.invalidate() } }
          ForEach(messages, id: \.id) { message in
            MessageBubble(message: message, own: message["senderId"].string == store.userID).id(
              message.id)
          }
          Color.clear.frame(height: 1).id("latest")
        }.padding(20)
      }.background(Ivory.paper).onChange(of: messages.count) { _, _ in
        withAnimation { proxy.scrollTo("latest", anchor: .bottom) }
      }
    }
    .navigationTitle(name.isEmpty ? "Conversation" : name).navigationBarTitleDisplayMode(.inline)
    .safeAreaInset(edge: .bottom) {
      VStack(alignment: .leading) {
        HStack(alignment: .bottom) {
          PhotosPicker(selection: $photo, matching: .images) {
            Image(systemName: "photo.badge.plus").padding(8).accessibilityLabel(
              "Send reference photo")
          }.disabled(busy)
          TextField("Write a message…", text: $text, axis: .vertical).lineLimit(1...5)
            .textFieldStyle(.roundedBorder)
          Button {
            send()
          } label: {
            Image(systemName: "paperplane.fill").padding(8)
          }.disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send message")
        }
        if busy { ProgressView("Sending…") }
      }.padding(12).background(Ivory.surface)
    }
    .toolbar {
      Menu {
        if store.isArtist {
          Button("Book in") { sheet = .booking }
          Button("Create promo") { sheet = .promotion }
          Button("Design brief") { sheet = .brief }
        }
        Button("Design & references") { sheet = .references }
      } label: {
        Image(systemName: "ellipsis").accessibilityLabel("Conversation actions")
      }
    }
    .sheet(item: $sheet) { selected in
      NavigationStack {
        switch selected {
        case .booking: BookingWizard(conversationID: conversationID)
        case .promotion:
          PromotionEditor(
            clientID: clientID.isEmpty
              ? (resolvedClientID.isEmpty ? nil : resolvedClientID) : clientID)
        case .references: ReferencesView(conversationID: conversationID)
        case .brief:
          NativePage(title: "Design brief") {
            QueryScreen(
              path: "designBrief.get", input: .object(["conversationId": .integer(conversationID)])
            ) { data in Text(data["brief"].string).textSelection(.enabled) }
          }
        }
      }.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { sheet = nil } } }
        .presentationDragIndicator(.visible)
    }
    .task(id: store.revision) { await load() }
    .onChange(of: photo) { _, next in if let next { upload(next) } }
  }
  private func load() async {
    do {
      if store.isArtist && clientID.isEmpty && resolvedClientID.isEmpty {
        resolvedClientID =
          try await store.query("conversations.list").array.first {
            $0["id"].int == conversationID
          }?["clientId"].string ?? ""
      }
      let rows = try await store.query(
        "messages.list",
        .object(["conversationId": .integer(conversationID), "limit": .integer(100)]))
      try Task.checkCancellation()
      messages = rows.array
      error = nil
      let unread = messages.filter {
        $0["senderId"].string != store.userID
          && !JSONValue.parse($0["readBy"].string).array.contains(.string(store.userID))
      }.map { $0["id"] }
      if !unread.isEmpty {
        try await store.mutate(
          "conversations.markAsRead",
          .object(["conversationId": .integer(conversationID), "messageIds": .array(unread)]),
          refresh: false)
      }
    } catch is CancellationError {} catch { self.error = error.localizedDescription }
  }
  private func send() {
    let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !busy && !content.isEmpty else { return }
    busy = true
    Task {
      defer { busy = false }
      do {
        try await store.mutate(
          "messages.send",
          .object([
            "conversationId": .integer(conversationID), "content": .string(content),
            "messageType": .string("text"),
          ]))
        text = ""
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
  private func upload(_ item: PhotosPickerItem) {
    guard !busy else { return }
    busy = true
    Task {
      defer {
        busy = false
        photo = nil
      }
      do {
        guard let data = try await item.loadTransferable(type: Data.self),
          let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.85),
          jpeg.count <= 20_000_000
        else { throw APIError("Choose an image that can be prepared under 20 MB.") }
        let target = try await store.mutate(
          "upload.getUploadUrl",
          .object([
            "filename": .string(UUID().uuidString + ".jpg"), "contentType": .string("image/jpeg"),
            "folder": .string("uploads"),
          ]))
        guard let url = URL(string: target["uploadUrl"].string), url.scheme == "https",
          !target["publicUrl"].string.isEmpty
        else { throw APIError("An upload address could not be created.") }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, from: jpeg)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode)
        else { throw APIError("The reference could not be uploaded. Please try again.") }
        try await store.mutate(
          "messages.send",
          .object([
            "conversationId": .integer(conversationID), "content": target["publicUrl"],
            "messageType": .string("image"),
          ]))
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct MessageBubble: View {
  let message: JSONValue
  let own: Bool
  private var metadata: JSONValue { JSONValue.parse(message["metadata"].string) }
  var body: some View {
    HStack {
      if own { Spacer(minLength: 32) }
      VStack(alignment: .leading, spacing: 8) {
        if message["messageType"].string == "image",
          let url = URL(string: message["content"].string), url.scheme == "https"
        {
          AsyncImage(url: url) { image in
            image.resizable().scaledToFit()
          } placeholder: {
            ProgressView()
          }.frame(maxHeight: 260).clipShape(RoundedRectangle(cornerRadius: 12))
        } else if metadata["type"].string == "reschedule_request" && metadata["requestId"].int > 0 {
          NavigationLink {
            RescheduleDecisionView(requestID: metadata["requestId"].int)
          } label: {
            Label("Review reschedule terms", systemImage: "calendar.badge.clock")
          }
          Text(message["content"].string)
        } else if metadata["sessionPlanId"].int > 0 {
          NavigationLink {
            ProposalView(planID: metadata["sessionPlanId"].int)
          } label: {
            Label("Tattoo sittings · View proposal", systemImage: "calendar")
          }
          Text(message["content"].string)
        } else {
          Text(message["content"].string).textSelection(.enabled)
        }
        HStack {
          if let date = NativeDate.parse(message["createdAt"].string) {
            Text(date.formatted(date: .abbreviated, time: .shortened))
          }
          if own && !JSONValue.parse(message["readBy"].string).array.isEmpty { Text("Read") }
        }.font(.caption2).foregroundStyle(Ivory.muted)
      }.padding(14).background(
        own ? Ivory.soft : Ivory.surface, in: RoundedRectangle(cornerRadius: 18))
      if !own { Spacer(minLength: 32) }
    }
  }
}
struct ReferencesView: View {
  let conversationID: Int
  var body: some View {
    NativePage(title: "Design & references") {
      QueryScreen(
        path: "messages.references", input: .object(["conversationId": .integer(conversationID)])
      ) { value in
        let images = value.array.filter { $0["messageType"].string == "image" }
        if images.isEmpty {
          Text("Photos shared in your conversation appear here.").foregroundStyle(Ivory.muted)
        }
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())]) {
          ForEach(Array(images.enumerated()), id: \.offset) { _, image in
            if let url = URL(string: image["content"].string), url.scheme == "https" {
              AsyncImage(url: url) { image in
                image.resizable().scaledToFit()
              } placeholder: {
                ProgressView()
              }.clipShape(RoundedRectangle(cornerRadius: 12))
            }
          }
        }
      }
    }
  }
}
