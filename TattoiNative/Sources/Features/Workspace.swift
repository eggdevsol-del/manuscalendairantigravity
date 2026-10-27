import Charts
import SwiftUI

struct TodayView: View {
  @Environment(AppStore.self) private var store
  var body: some View {
    NativePage(
      title: "tattoi Today",
      subtitle: Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide))
    ) {
      if store.isArtist {
        HStack {
          NavigationLink("Clients") { ClientsView() }
          Spacer()
          NavigationLink("Promotions") { PromotionsView() }
          Spacer()
          NavigationLink("Supplies") { SuppliersView() }
        }.buttonStyle(.bordered)
        QueryScreen(path: "auth.artistSetup") { progress in
          if !progress["complete"].bool {
            NativePanel {
              Text("Finish setup").font(.headline)
              ForEach(progress["steps"].array, id: \.id) { step in
                Label(
                  step["title"].string,
                  systemImage: step["done"].bool ? "checkmark.circle.fill" : "circle")
              }
              NavigationLink("Continue setup") { SettingsView() }
            }
          }
        }
        QueryScreen(path: "dashboardTasks.getBusinessTasks") { data in
          Text("Needs attention").font(.headline)
          if data["tasks"].array.isEmpty { Text("You’re up to date.").foregroundStyle(Ivory.muted) }
          ForEach(data["tasks"].array, id: \.id) { task in
            NativePanel {
              Text(task["title"].string).font(.headline)
              Text(task["description"].string).foregroundStyle(Ivory.muted)
              if task["conversationId"].int > 0 {
                NavigationLink("Open conversation") {
                  ThreadView(
                    conversationID: task["conversationId"].int, name: task["clientName"].string)
                }
              }
            }
          }
        }
        QueryScreen(
          path: "dashboard.getUpcomingWeek",
          input: .object(["timeZone": .string(TimeZone.current.identifier)])
        ) { week in
          Text("Next 7 days").font(.headline)
          NativePanel(green: true) {
            MoneyRow(
              title: "Booked work estimate", cents: week["estimateCents"].int,
              currency: week["currency"].string)
            MoneyRow(
              title: "Still to collect", cents: week["remainingCents"].int,
              currency: week["currency"].string)
          }
          ForEach(week["sittings"].array, id: \.id) { sitting in
            NavigationLink {
              SittingView(sitting: sitting)
            } label: {
              SittingSummary(sitting: sitting)
            }.buttonStyle(.plain)
          }
          if week["sittings"].array.isEmpty {
            Text("No sittings in the next seven days.").foregroundStyle(Ivory.muted)
          }
        }
      } else {
        Text("Your next tattoo, at a glance.").font(Ivory.heading(25))
        CalendarContents()
        ClientOffersView()
      }
    }.refreshable { store.invalidate() }.toolbar {
      NavigationLink {
        SettingsView()
      } label: {
        Image(systemName: "gearshape").accessibilityLabel("Settings")
      }
    }
  }
}
struct SittingSummary: View {
  let sitting: JSONValue
  var body: some View {
    NativePanel {
      HStack {
        Text(sitting["title"].string.isEmpty ? "Tattoo sitting" : sitting["title"].string).font(
          .headline)
        Spacer()
        Text(sitting["status"].string.capitalized).font(.caption).foregroundStyle(Ivory.green)
      }
      Text(
        sitting["clientName"].string.isEmpty
          ? sitting["client"]["name"].string : sitting["clientName"].string)
      if let date = NativeDate.parse(sitting["startTime"].string) {
        Text(date.formatted(date: .abbreviated, time: .shortened)).foregroundStyle(Ivory.muted)
      }
    }
  }
}
struct CalendarView: View {
  @Environment(AppStore.self) private var store
  @State private var date = Date.now
  var body: some View {
    NativePage(title: store.isArtist ? "tattoi Calendar" : "My Tattoos") {
      if store.isArtist {
        DatePicker("Week containing", selection: $date, displayedComponents: .date).datePickerStyle(
          .compact)
      }
      CalendarContents(date: store.isArtist ? date : nil)
    }.refreshable { store.invalidate() }
  }
}
struct CalendarContents: View {
  @Environment(AppStore.self) private var store
  var date: Date? = nil
  private var request: JSONValue {
    var input: [String: JSONValue] = [
      store.isArtist ? "artistId" : "clientId": .string(store.userID)
    ]
    if let date, store.isArtist {
      let start = Calendar.current.dateInterval(of: .weekOfYear, for: date)!.start
      input["startDate"] = .string(NativeDate.iso(start))
      input["endDate"] = .string(
        NativeDate.iso(Calendar.current.date(byAdding: .day, value: 7, to: start)!))
    }
    return .object(input)
  }
  @State private var appointments: [JSONValue] = []
  @State private var error: String?
  var body: some View {
    Group {
      if let error { ErrorNotice(message: error) { store.invalidate() } }
      ForEach(appointments, id: \.id) { sitting in
        NavigationLink {
          SittingView(sitting: sitting)
        } label: {
          SittingSummary(sitting: sitting)
        }.buttonStyle(.plain)
      }
      if appointments.isEmpty && error == nil {
        ContentUnavailableView(
          "No sittings", systemImage: "calendar",
          description: Text("Bookings made in your conversations appear here."))
      }
    }.task(id: "\(store.revision):\(request.encodedString)") {
      do {
        appointments = try await store.query(
          store.isArtist ? "appointments.getArtistCalendar" : "appointments.getClientCalendar",
          request, dates: date == nil ? [] : ["startDate", "endDate"]
        ).array
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct BusinessView: View {
  @Environment(AppStore.self) private var store
  var body: some View {
    NativePage(
      title: store.isArtist ? "tattoi Business" : "Your account",
      subtitle: "Your studio, at a glance"
    ) {
      if store.isArtist {
        QueryScreen(
          path: "payouts.earningsBreakdown",
          input: .object([
            "period": .string("30d"), "timeZone": .string(TimeZone.current.identifier),
          ])
        ) { data in
          NativePanel(green: true) {
            Text("Last 30 days").font(.subheadline)
            Text(NativeMoney.format(data["netCents"].int)).font(Ivory.heading(38))
            Text("Net earnings").foregroundStyle(Ivory.muted)
            if !data["daily"].array.isEmpty {
              Chart(Array(data["daily"].array.enumerated()), id: \.offset) { index, day in
                BarMark(x: .value("Day", index), y: .value("Net", day["netCents"].int))
                  .foregroundStyle(Ivory.green)
              }.frame(height: 120).accessibilityLabel("Daily net earnings")
            }
          }
        }
        NavigationLink("Bank & payouts") { BankView() }
        NavigationLink("Services & working hours") { ServicesView() }
        NavigationLink("Clients") { ClientsView() }
        NavigationLink("Import clients & portfolio") { ImportsView() }
        NavigationLink("Promotions & gift cards") { PromotionsView() }
        NavigationLink("Supplies") { SuppliersView() }
        NavigationLink("Supply orders") {
          RemoteRecords(title: "Supply orders", path: "supplierOrders.getSupplierOrders")
        }
        NavigationLink("Procedure records") {
          RemoteRecords(title: "Procedure records", path: "forms.getProcedureLogs")
        }
      }
      NavigationLink("Profile & settings") { SettingsView() }
      Button("Sign out", role: .destructive) { store.logout() }
    }.buttonStyle(.bordered).refreshable { store.invalidate() }
  }
}
struct BankView: View {
  @Environment(AppStore.self) private var store
  @Environment(\.openURL) private var openURL
  @State private var error: String?
  @State private var busy = false
  var body: some View {
    NativePage(title: "Bank & payouts", subtitle: "Your payment account, in one place.") {
      QueryScreen(path: "artistSettings.getStripeConnectStatus") { status in
        NativePanel {
          Text("Payment readiness").font(Ivory.heading(26))
          RecordRows(
            record: status,
            fields: [
              ("Charges", "chargesEnabled"), ("Payouts", "payoutsEnabled"),
              ("Onboarding", "onboardingComplete"),
            ])
        }
      }
      QueryScreen(path: "payouts.nextPayout") { payout in
        NativePanel(green: true) {
          MoneyRow(title: "Pending", cents: payout["pendingAmountCents"].int)
          if !payout["nextPayoutAmountCents"].isNull {
            MoneyRow(title: "Next payout", cents: payout["nextPayoutAmountCents"].int)
          }
        }
      }
      NavigationLink("Set up bank details in Tattoi") { StripeOnboardingView() }.buttonStyle(
        .borderedProminent)
      Text(
        "Stripe securely handles your identity and bank details. Continue in Stripe’s secure browser flow, then return here and refresh."
      ).foregroundStyle(Ivory.muted)
      Button(busy ? "Opening Stripe…" : "Connect or continue Stripe setup") {
        busy = true
        Task {
          defer { busy = false }
          do {
            let connection = try await store.mutate(
              "artistSettings.connectStripe", .object(["embedded": .bool(false)]))
            var address = connection["url"].string
            if address.isEmpty {
              address = try await store.mutate("artistSettings.getStripeAccountLink")["url"].string
            }
            guard let url = URL(string: address), url.scheme == "https", let host = url.host,
              host == "stripe.com" || host.hasSuffix(".stripe.com")
            else {
              throw APIError(
                "This account needs embedded Stripe onboarding, which has not yet been ported. Continue setup in the web app."
              )
            }
            openURL(url)
          } catch { self.error = error.localizedDescription }
        }
      }.buttonStyle(.borderedProminent).disabled(busy)
      Button("Refresh status") {
        Task {
          do { try await store.mutate("artistSettings.refreshStripeConnectStatus") } catch {
            self.error = error.localizedDescription
          }
        }
      }
      if let error { ErrorNotice(message: error) }
    }.refreshable { store.invalidate() }
  }
}
