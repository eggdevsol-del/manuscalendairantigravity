import SwiftUI

struct BookingWizard: View {
  @Environment(AppStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  let conversationID: Int
  var offerID: Int? = nil
  @State private var services: [JSONValue] = []
  @State private var selected = -1
  @State private var frequency = "weekly"
  @State private var start = Date.now
  @State private var dates: [Date] = []
  @State private var price = ""
  @State private var deposit = ""
  @State private var error: String?
  @State private var busy = false
  @State private var review = false
  @State private var zone = TimeZone.current.identifier
  private var service: JSONValue {
    services.indices.contains(selected) ? services[selected] : .null
  }
  var body: some View {
    Form {
      Section {
        Text("Book in").font(Ivory.heading())
        Text(
          "Choose the service agreed in this conversation. Dates and pricing are reviewed before anything is sent."
        ).foregroundStyle(Ivory.muted)
      }
      Section("Service") {
        Picker("Service", selection: $selected) {
          Text("Choose a service").tag(-1)
          ForEach(Array(services.enumerated()), id: \.offset) { index, svc in
            Text(svc["name"].string).tag(index)
          }
        }
        if selected >= 0 {
          Text(
            "\(service["duration"].int) minutes per sitting · \(max(1, service["sittings"].int)) sittings"
          )
        }
        TextField("Price per sitting", text: $price).keyboardType(.decimalPad)
        TextField("Deposit per sitting", text: $deposit).keyboardType(.decimalPad)
      }
      Section("Find dates") {
        TextField("Booking time zone", text: $zone).textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        if service["sittings"].int > 1 {
          Picker("Frequency", selection: $frequency) {
            Text("Weekly").tag("weekly")
            Text("Fortnightly").tag("biweekly")
            Text("Monthly").tag("monthly")
            Text("Consecutive days").tag("consecutive")
          }
        }
        DatePicker(
          "Search from", selection: $start, in: Date.now...,
          displayedComponents: [.date, .hourAndMinute])
        Button(busy ? "Checking availability…" : "Find available dates") { findDates() }.disabled(
          busy || service.isNull)
      }
      if !dates.isEmpty {
        Section("Review sittings") {
          ForEach(Array(dates.enumerated()), id: \.offset) { index, date in
            Text("Sitting \(index + 1) · \(date.formatted(date: .abbreviated, time: .shortened))")
          }
          if let cents = NativeMoney.cents(price), let deposit = NativeMoney.cents(deposit) {
            MoneyRow(title: "Project estimate", cents: cents * dates.count)
            MoneyRow(title: "Deposit requested", cents: deposit * dates.count)
          }
          Text(
            "Proposed dates remain tentative until the deposit is confirmed. Server checks run again before payment and confirmation."
          ).font(.footnote)
        }
      }
      if let error { Section { Text(error).foregroundStyle(.red) } }
      if !dates.isEmpty {
        Section {
          Button("Review and send proposal") { review = true }.disabled(
            busy || NativeMoney.cents(price) == nil || NativeMoney.cents(deposit) == nil)
        }
      }
    }.scrollContentBackground(.hidden).background(Ivory.paper).disabled(busy)
      .interactiveDismissDisabled(busy)
      .confirmationDialog(
        "Send these dates and prices to your client?", isPresented: $review,
        titleVisibility: .visible
      ) {
        Button("Send booking proposal") { send() }
        Button("Cancel", role: .cancel) {}
      }
      .onChange(of: selected) { _, _ in
        dates = []
        if !service.isNull {
          price = String(service["price"].double)
          deposit = ""
        }
      }
      .onChange(of: frequency) { _, _ in dates = [] }.onChange(of: start) { _, _ in dates = [] }
      .onChange(of: price) { _, _ in dates = [] }.onChange(of: zone) { _, _ in dates = [] }
      .task {
        do {
          services =
            JSONValue.parse(try await store.query("artistSettings.get")["services"].string).array
        } catch { self.error = error.localizedDescription }
      }
  }
  private func findDates() {
    guard let cents = NativeMoney.cents(price), TimeZone(identifier: zone) != nil else {
      error = "Enter a valid price and IANA time zone."
      return
    }
    busy = true
    error = nil
    Task {
      defer { busy = false }
      do {
        var input: [String: JSONValue] = [
          "conversationId": .integer(conversationID), "serviceName": service["name"],
          "serviceDuration": service["duration"],
          "sittings": .integer(max(1, service["sittings"].int)),
          "price": .number(Double(cents) / 100),
          "frequency": .string(service["sittings"].int > 1 ? frequency : "single"),
          "startDate": .string(NativeDate.iso(start)), "timeZone": .string(zone),
        ]
        if let offerID { input["offerId"] = .integer(offerID) }
        let result = try await store.query(
          "booking.checkAvailability", .object(input), dates: ["startDate"], fresh: true)
        dates = result["dates"].array.compactMap { NativeDate.parse($0.string) }
        if dates.count != max(1, service["sittings"].int) {
          dates = []
          throw APIError(
            "A complete schedule could not be found. Choose another start or frequency.")
        }
      } catch { self.error = error.localizedDescription }
    }
  }
  private func send() {
    guard !busy, let cents = NativeMoney.cents(price), let paid = NativeMoney.cents(deposit),
      paid <= cents, !dates.isEmpty
    else {
      error = "Check the price and deposit. Deposit cannot exceed the sitting price."
      return
    }
    busy = true
    Task {
      defer { busy = false }
      do {
        let sessions = dates.enumerated().map { index, date in
          JSONValue.object([
            "sessionIndex": .integer(index + 1), "startsAt": .string(NativeDate.iso(date)),
            "durationMinutes": service["duration"], "estimateCents": .integer(cents),
            "depositCents": .integer(paid),
          ])
        }
        var input: [String: JSONValue] = [
          "conversationId": .integer(conversationID), "serviceName": service["name"],
          "sessions": .array(sessions),
          "scheduling": .object([
            "autoScheduled": .bool(true), "frequency": .string(frequency),
            "timeZone": .string(zone),
          ]),
        ]
        if let offerID { input["offerId"] = .integer(offerID) }
        try await store.mutate("sessionPlans.create", .object(input))
        dismiss()
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct ProposalView: View {
  @Environment(AppStore.self) private var store
  let planID: Int
  @State private var error: String?
  @State private var busy = false
  var body: some View {
    NativePage(title: "Tattoo sittings") {
      QueryScreen(path: "sessionPlans.getById", input: .object(["sessionPlanId": .integer(planID)]))
      { plan in
        NativePanel(green: true) {
          Text(plan["status"].string.capitalized).font(.headline)
          MoneyRow(title: "Sittings estimate", cents: plan["totalEstimateCents"].int)
          MoneyRow(title: "Deposit", cents: plan["depositTotalCents"].int)
          ForEach(plan["items"].array, id: \.id) { item in
            if let date = NativeDate.parse(item["startsAt"].string) {
              Text(
                "Sitting \(item["sessionIndex"].int) · \(date.formatted(date: .abbreviated, time: .shortened))"
              )
            }
          }
        }
        if store.isArtist && plan["status"].string == "pending" {
          Button("Withdraw proposal", role: .destructive) {
            busy = true
            Task {
              defer { busy = false }
              do {
                try await store.mutate(
                  "sessionPlans.withdraw", .object(["sessionPlanId": .integer(planID)]))
              } catch { self.error = error.localizedDescription }
            }
          }.disabled(busy)
        }
        if !store.isArtist && plan["status"].string == "pending" {
          Text(
            "Deposit checkout is not yet available in this native build. Use the Tattoi client PWA to review and pay."
          ).foregroundStyle(Ivory.muted)
        }
      }
      if let error { ErrorNotice(message: error) }
    }
  }
}
struct SittingView: View {
  @Environment(AppStore.self) private var store
  let sitting: JSONValue
  @State private var reschedule: JSONValue?
  @State private var finishing = false
  @State private var consent: JSONValue?
  @State private var busy = false
  @State private var error: String?
  var body: some View {
    NativePage(
      title: sitting["projectName"].string.isEmpty
        ? "Tattoo sitting" : sitting["projectName"].string
    ) {
      QueryScreen(
        path: sitting["conversationId"].int > 0
          ? "projects.summary"
          : store.isArtist ? "appointments.getArtistCalendar" : "appointments.getClientCalendar",
        input: sitting["conversationId"].int > 0
          ? .object(["conversationId": sitting["conversationId"]])
          : .object([store.isArtist ? "artistId" : "clientId": .string(store.userID)])
      ) { data in
        let source =
          (sitting["conversationId"].int > 0 ? data["sessions"].array : data.array).first {
            $0["id"] == sitting["id"]
          } ?? sitting
        let current = normalized(source)
        SittingSummary(sitting: current)
        NativePanel(green: true) {
          MoneyRow(
            title: "Estimate",
            cents: current["totalExpectedAmountCents"].isNull
              ? current["price"].int * 100 : current["totalExpectedAmountCents"].int)
          MoneyRow(title: "Paid, including credit", cents: current["totalPaidAmountCents"].int)
          MoneyRow(title: "Remaining", cents: current["remainingBalanceCents"].int)
          Text(
            "\(current["sessionIndex"].int) of \(current["sessionTotal"].int) sittings · \(current["timeZone"].string)"
          ).font(.footnote)
        }
        if current["conversationId"].int > 0 {
          NavigationLink("Message") { ThreadView(conversationID: current["conversationId"].int) }
          NavigationLink("Design & references") {
            ReferencesView(conversationID: current["conversationId"].int)
          }
        }
        if store.isArtist {
          Button("Reschedule sitting") { reschedule = current }.disabled(
            busy || ["completed", "cancelled"].contains(current["status"].string))
          if let date = NativeDate.parse(current["startTime"].string),
            date <= .now && current["status"].string == "confirmed"
          {
            Button("Finish session & request final payment") { finishing = true }.disabled(busy)
          }
        } else {
          QueryScreen(
            path: "forms.getPendingForms", input: .object(["appointmentId": current["id"]])
          ) { forms in
            ForEach(forms.array, id: \.id) { form in
              Button {
                consent = form
              } label: {
                NativePanel {
                  Text(form["title"].string)
                  Text("Review and complete").font(.footnote).foregroundStyle(Ivory.muted)
                }
              }.buttonStyle(.plain)
            }
          }
        }
      }
      if let error { ErrorNotice(message: error) }
    }.buttonStyle(.bordered).refreshable { store.invalidate() }
      .sheet(item: $consent) { form in NavigationStack { ConsentFormView(form: form) } }
      .sheet(item: $reschedule) { selected in NavigationStack { RescheduleView(sitting: selected) }
      }
      .confirmationDialog(
        "Finish this session and request its remaining balance?", isPresented: $finishing,
        titleVisibility: .visible
      ) {
        Button("Finish session") {
          busy = true
          Task {
            defer { busy = false }
            do { try await finish() } catch { self.error = error.localizedDescription }
          }
        }
        Button("Cancel", role: .cancel) {}
      }
  }
  private func normalized(_ source: JSONValue) -> JSONValue {
    guard !source["startsAt"].isNull else { return source }
    var data = source.object
    data["startTime"] = source["startsAt"]
    data["endTime"] = source["endsAt"]
    data["totalExpectedAmountCents"] = source["estimateCents"]
    data["totalPaidAmountCents"] = source["paidCents"]
    data["remainingBalanceCents"] = source["remainingCents"]
    data["conversationId"] = sitting["conversationId"]
    return .object(data)
  }
  private func finish() async throws {
    let summary = try await store.query(
      "projects.summary", .object(["conversationId": sitting["conversationId"]]), fresh: true)
    guard let current = summary["sessions"].array.first(where: { $0["id"] == sitting["id"] }) else {
      throw APIError("Refresh this sitting before finishing it.")
    }
    if current["remainingCents"].int > 0 {
      try await store.mutate(
        "dashboard.requestPayment",
        .object([
          "appointmentId": sitting["id"], "amountCents": current["remainingCents"],
          "completeSession": .bool(true),
        ]))
    } else {
      try await store.mutate(
        "appointments.update",
        .object([
          "id": sitting["id"], "status": .string("completed"),
          "actualEndTime": .string(NativeDate.iso(.now)),
        ]))
    }
  }
}
struct RescheduleView: View {
  @Environment(AppStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  let sitting: JSONValue
  @State private var date = Date.now
  @State private var keep = false
  @State private var terms: JSONValue = .null
  @State private var error: String?
  @State private var busy = false
  var body: some View {
    Form {
      Section("New time") {
        DatePicker("Sitting starts", selection: $date, in: Date.now...)
        Text("Existing duration and payments remain attached to this sitting.").font(.footnote)
        Toggle("Keep promotion outside its eligible dates", isOn: $keep)
        Text(
          "If the price changes, the client must review the proposed terms before the move is confirmed."
        ).font(.footnote)
      }
      if !terms.isNull {
        Section("Client approval required") {
          MoneyRow(title: "Original estimate", cents: terms["oldEstimateCents"].int)
          MoneyRow(title: "Revised estimate", cents: terms["estimateCents"].int)
          MoneyRow(title: "Remaining", cents: terms["remainingCents"].int)
          Text("The original sitting remains booked until the client accepts the new terms.").font(
            .footnote)
        }
      }
      if let error { Text(error).foregroundStyle(.red) }
      Button(busy ? "Saving…" : terms.isNull ? "Review new time" : "Send revised terms to client") {
        save()
      }.disabled(busy)
    }.navigationTitle("Reschedule").toolbar { Button("Cancel") { dismiss() } }.onAppear {
      date = NativeDate.parse(sitting["startTime"].string) ?? .now
    }.onChange(of: date) { _, _ in terms = .null }.onChange(of: keep) { _, _ in terms = .null }
  }
  private func save() {
    guard !busy, let start = NativeDate.parse(sitting["startTime"].string),
      let end = NativeDate.parse(sitting["endTime"].string)
    else {
      error = "The sitting duration could not be verified."
      return
    }
    busy = true
    Task {
      defer { busy = false }
      do {
        let result = try await store.mutate(
          "appointments.reschedule",
          .object([
            "appointmentId": sitting["id"], "newStartTime": .string(NativeDate.iso(date)),
            "newEndTime": .string(
              NativeDate.iso(date.addingTimeInterval(end.timeIntervalSince(start)))),
            "allowOutsideOfferDates": .bool(keep), "requestApproval": .bool(!terms.isNull),
          ]))
        if result["requiresApproval"].bool && !result["success"].bool {
          terms = result["terms"]
        } else {
          dismiss()
        }
      } catch { self.error = error.localizedDescription }
    }
  }
}

struct RescheduleDecisionView: View {
  @Environment(AppStore.self) private var store
  let requestID: Int
  @State private var action: String?
  @State private var error: String?
  @State private var busy = false
  var body: some View {
    NativePage(title: "Reschedule terms") {
      QueryScreen(path: "reschedules.get", input: .object(["id": .integer(requestID)])) { data in
        NativePanel {
          Text(data["status"].string.capitalized).font(.headline)
          let terms = data["terms"]
          if let date = NativeDate.parse(terms["newStart"].string) {
            Text(date.formatted(date: .complete, time: .shortened)).font(.title3)
          }
          MoneyRow(title: "Previous estimate", cents: terms["oldEstimateCents"].int)
          MoneyRow(title: "Revised estimate", cents: terms["estimateCents"].int)
          MoneyRow(title: "Already paid", cents: terms["paidCents"].int)
          MoneyRow(title: "Remaining", cents: terms["remainingCents"].int)
          Text(
            "Your original sitting remains booked until the revised terms are accepted. Existing payments remain attached."
          ).font(.footnote)
        }
        if data["status"].string == "pending" {
          if data["isClient"].bool {
            Button("Accept new date and price") { action = "accept" }
            Button("Decline", role: .destructive) { action = "decline" }
          } else {
            Button("Withdraw request", role: .destructive) { action = "withdraw" }
          }
        }
      }
      if let error { ErrorNotice(message: error) }
    }.disabled(busy).confirmationDialog(
      "Confirm this reschedule decision?",
      isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }),
      titleVisibility: .visible
    ) {
      if let selected = action {
        Button(selected.capitalized) {
          busy = true
          Task {
            defer {
              busy = false
              action = nil
            }
            do {
              try await store.mutate(
                "reschedules.resolve",
                .object(["id": .integer(requestID), "action": .string(selected)]))
            } catch { self.error = error.localizedDescription }
          }
        }
      }
      Button("Cancel", role: .cancel) { action = nil }
    }
  }
}
