import SwiftUI

@main struct TattoiNativeApp: App {
  @State private var store = AppStore()
  @Environment(\.scenePhase) private var scenePhase
  var body: some Scene {
    WindowGroup {
      Group {
        if store.restoring {
          ProgressView("Opening Tattoi…")
        } else if store.user.isNull {
          LoginView()
        } else {
          MainTabs()
        }
      }.environment(store).tint(Ivory.green).background(Ivory.paper)
        .task { await store.restore() }
        .task(id: "\(store.userID):\(scenePhase == .active)") {
          if scenePhase == .active && !store.user.isNull {
            store.invalidate()
            await store.watch()
          }
        }
    }
  }
}
struct LoginView: View {
  @Environment(AppStore.self) private var store
  @State private var email = ""
  @State private var password = ""
  @State private var busy = false
  @State private var error: String?
  var body: some View {
    NavigationStack {
      NativePage(title: "tattoi", subtitle: "Your work. Your time. In one place.") {
        NativePanel {
          Text("Welcome back").font(Ivory.heading(26))
          TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress)
            .textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(
              .roundedBorder
            ).accessibilityIdentifier("login.email")
          SecureField("Password", text: $password).textContentType(.password).textFieldStyle(
            .roundedBorder
          ).accessibilityIdentifier("login.password")
          if let message = error ?? store.loginError {
            Text(message).foregroundStyle(.red).accessibilityLabel("Sign in error: " + message)
          }
          Button {
            busy = true
            error = nil
            Task {
              defer { busy = false }
              do {
                try await store.login(email: email, password: password)
                password = ""
              } catch { self.error = error.localizedDescription }
            }
          } label: {
            HStack {
              if busy { ProgressView() }
              Text(busy ? "Signing in…" : "Sign in").frame(maxWidth: .infinity)
            }
          }.buttonStyle(.borderedProminent).controlSize(.large).disabled(
            busy || email.isEmpty || password.isEmpty
          ).accessibilityIdentifier("login.submit")
        }
        Text("Uses your existing Tattoi account and the same live booking records.").font(.footnote)
          .foregroundStyle(Ivory.muted)
        if store.loginError != nil {
          Button("Retry saved session") { Task { await store.restore() } }
        }
        Link(
          "Create an account or recover your password",
          destination: store.api.baseURL.appendingPathComponent("login"))
      }
    }
  }
}
struct MainTabs: View {
  @Environment(AppStore.self) private var store
  @State private var selected = 2
  var body: some View {
    TabView(selection: $selected) {
      NavigationStack { InboxView() }.tabItem { Label("Messages", systemImage: "bubble.left") }.tag(
        0)
      NavigationStack { CalendarView() }.tabItem {
        Label(store.isArtist ? "Calendar" : "My Tattoos", systemImage: "calendar")
      }.tag(1)
      NavigationStack { TodayView() }.tabItem { Label("Today", systemImage: "house") }.tag(2)
      NavigationStack { BusinessView() }.tabItem {
        Label(store.isArtist ? "Business" : "Account", systemImage: "briefcase")
      }.tag(3)
    }.toolbarBackground(Ivory.paper, for: .tabBar).toolbarBackground(.visible, for: .tabBar)
  }
}
