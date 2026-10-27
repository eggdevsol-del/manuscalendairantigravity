import PhotosUI
import SwiftUI

struct PromotionsView: View {
  @Environment(AppStore.self) private var store
  @State private var create = false
  var body: some View {
    NativePage(title: "Promotions", subtitle: "Fill your calendar or give the gift of tattoo work.")
    {
      Button("Create promotion") { create = true }.buttonStyle(.borderedProminent)
      QueryScreen(path: "offers.list") { data in
        if !data["enabled"].bool { Text("Promotions are not enabled on this server.") }
        ForEach(data["campaigns"].array, id: \.id) { campaign in
          NavigationLink {
            CampaignView(campaign: campaign)
          } label: {
            OfferTile(rules: campaign["rules"])
          }.buttonStyle(.plain)
        }
      }
    }.sheet(isPresented: $create) { NavigationStack { PromotionEditor() } }.refreshable {
      store.invalidate()
    }
  }
}
struct OfferTile: View {
  let rules: JSONValue
  var body: some View {
    NativePanel(green: true) {
      if let url = URL(string: rules["backgroundImageUrl"].string), url.scheme == "https" {
        AsyncImage(url: url) { image in
          image.resizable().scaledToFill()
        } placeholder: {
          Color.clear
        }.frame(height: 120).clipped().clipShape(RoundedRectangle(cornerRadius: 12))
      }
      Text(rules["name"].string).font(Ivory.heading(27))
      Text(
        rules["valueType"].string == "percentage"
          ? "\(rules["value"].double.formatted())% off"
          : NativeMoney.format(rules["value"].int, currency: rules["currency"].string)
      ).font(.title2)
      if !rules["description"].string.isEmpty { Text(rules["description"].string) }
      if let date = NativeDate.parse(rules["expiresAt"].string) {
        Text("Confirm by \(date.formatted(date: .abbreviated, time: .shortened))").font(.footnote)
      }
      if !rules["sittingMonths"].array.isEmpty {
        Text(
          "Eligible months: " + rules["sittingMonths"].array.map(\.string).joined(separator: ", ")
        ).font(.footnote)
      }
    }
  }
}
struct PromotionEditor: View {
  @Environment(AppStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  var clientID: String? = nil
  var campaign: JSONValue = .null
  @State private var name = ""
  @State private var description = ""
  @State private var kind = "discount"
  @State private var funding = "gift"
  @State private var valueType = "percentage"
  @State private var value = ""
  @State private var hours = 0
  @State private var expiryEnabled = false
  @State private var expiry = Date.now.addingTimeInterval(7 * 86400)
  @State private var months: Set<String> = []
  @State private var imageURL = ""
  @State private var backgroundPhoto: PhotosPickerItem?
  @State private var error: String?
  @State private var busy = false
  @State private var review = false
  private var availableMonths: [String] {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM"
    return (0..<24).compactMap {
      Calendar.current.date(byAdding: .month, value: $0, to: .now).map {
        formatter.string(from: $0)
      }
    }
  }
  var body: some View {
    Form {
      Section {
        Text("Create promo").font(Ivory.heading())
        if clientID != nil { Text("Just for this client").foregroundStyle(Ivory.muted) }
      }
      Section("Promotion") {
        Picker("Purpose", selection: $kind) {
          Text("Fill calendar space").tag("discount")
          Text("Gift voucher").tag("voucher")
        }
        TextField("Card title", text: $name)
        TextField("Personal message", text: $description, axis: .vertical)
        if kind == "voucher" {
          Picker("Funding", selection: $funding) {
            Text("Complimentary credit").tag("gift")
            Text("Client purchases voucher").tag("sale")
          }
        }
        if kind == "discount" {
          Picker("Value type", selection: $valueType) {
            Text("Percentage off").tag("percentage")
            Text("Amount off").tag("fixed")
          }
        }
        TextField(
          kind == "discount" && valueType == "percentage" ? "Discount (%)" : "Value (AUD)",
          text: $value
        ).keyboardType(.decimalPad)
      }
      if kind == "discount" {
        Section("Availability") {
          Picker("Available after sending", selection: $hours) {
            Text("No time limit").tag(0)
            Text("24 hours").tag(24)
            Text("48 hours").tag(48)
            Text("72 hours").tag(72)
            Text("7 days").tag(168)
          }
          Toggle("Book-by deadline", isOn: $expiryEnabled)
          if expiryEnabled { DatePicker("Confirm before", selection: $expiry, in: Date.now...) }
          DisclosureGroup("Offer for the month/months of") {
            ForEach(availableMonths, id: \.self) { month in
              Toggle(
                month,
                isOn: Binding(
                  get: { months.contains(month) },
                  set: { if $0 { months.insert(month) } else { months.remove(month) } }))
            }
          }
          Text(
            "A deposit must be confirmed before the offer expires. Sitting eligibility and claim deadlines are separate."
          ).font(.footnote)
        }
      } else {
        Section {
          Text(
            "Purchased vouchers are valid for three years after purchase. Applicable-law refund exceptions continue to apply."
          ).font(.footnote)
        }
      }
      Section("Appearance") {
        PhotosPicker("Upload background image", selection: $backgroundPhoto, matching: .images)
          .disabled(busy)
        if !imageURL.isEmpty { Text("Background image attached").foregroundStyle(Ivory.green) }
      }
      if let error { Text(error).foregroundStyle(.red) }
      Button(busy ? "Saving…" : clientID == nil ? "Save promotion" : "Review and send to client") {
        review = true
      }.disabled(busy)
    }.navigationTitle(campaign.isNull ? "New promotion" : "Edit promotion").toolbar {
      Button("Cancel") { dismiss() }
    }
    .confirmationDialog(
      clientID == nil
        ? "Save these promotion terms?" : "Send these promotion terms to this client?",
      isPresented: $review, titleVisibility: .visible
    ) {
      Button(clientID == nil ? "Save promotion" : "Send promotion") { save() }
      Button("Cancel", role: .cancel) {}
    }
    .onChange(of: backgroundPhoto) { _, item in
      if let item {
        busy = true
        Task {
          defer { busy = false }
          do { imageURL = try await store.uploadImage(item) } catch {
            self.error = error.localizedDescription
          }
        }
      }
    }
    .onChange(of: kind) { _, _ in
      if kind == "voucher" {
        valueType = "fixed"
        hours = 0
        expiryEnabled = false
      }
    }
    .onAppear {
      if !campaign.isNull {
        let r = campaign["rules"]
        name = r["name"].string
        description = r["description"].string
        kind = r["kind"].string
        funding = r["funding"].string.isEmpty ? "gift" : r["funding"].string
        valueType = r["valueType"].string
        value =
          r["valueType"].string == "percentage"
          ? String(r["value"].double) : String(Double(r["value"].int) / 100)
        hours = r["availableHours"].int
        months = Set(r["sittingMonths"].array.map(\.string))
        imageURL = r["backgroundImageUrl"].string
        if let date = NativeDate.parse(r["expiresAt"].string) {
          expiry = date
          expiryEnabled = true
        }
      }
    }
  }
  private func save() {
    let percentage = kind == "discount" && valueType == "percentage"
    guard name.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2,
      let parsed = NativeMoney.cents(value), parsed > 0, !percentage || parsed <= 10000
    else {
      error = "Enter a title and valid value. Percentages must be between 0.01 and 100."
      return
    }
    let editedRules: [String: JSONValue] = [
      "name": .string(name), "description": .string(description), "kind": .string(kind),
      "funding": .string(funding), "valueType": .string(percentage ? "percentage" : "fixed"),
      "value": .number(percentage ? Double(parsed) / 100 : Double(parsed)),
      "currency": .string("AUD"), "eligibility": .string("new"),
      "expiresAt": expiryEnabled && kind == "discount" ? .string(NativeDate.iso(expiry)) : .null,
      "availableHours": hours > 0 && kind == "discount" ? .integer(hours) : .null,
      "sittingFrom": .null, "sittingUntil": .null,
      "sittingMonths": .array(months.sorted().map(JSONValue.string)),
      "backgroundImageUrl": .string(imageURL),
      "validityYears": campaign["rules"]["validityYears"].isNull
        ? .integer(3) : campaign["rules"]["validityYears"],
    ]
    var existing = campaign["rules"].object
    existing.merge(editedRules) { _, value in value }
    if !campaign.isNull {
      existing["eligibility"] = campaign["rules"]["eligibility"]
      existing["currency"] = campaign["rules"]["currency"]
      existing["validityYears"] = campaign["rules"]["validityYears"]
    }
    let rules = JSONValue.object(existing)
    busy = true
    Task {
      defer { busy = false }
      do {
        var input: [String: JSONValue] = ["rules": rules]
        if !campaign.isNull { input["id"] = campaign["id"] }
        let result = try await store.mutate("offers.save", .object(input))
        if let clientID {
          let filters: JSONValue = .object(["clientId": .string(clientID)])
          let audience = try await store.query("offers.audience", filters, fresh: true)
          guard audience["count"].int == 1 else {
            throw APIError("This client is not available for this promotion.")
          }
          try await store.mutate(
            "offers.issue",
            .object([
              "id": result["id"], "filters": filters, "expectedCount": .integer(1),
              "channels": .object(["sms": .bool(false), "push": .bool(false)]),
            ]))
        }
        dismiss()
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct CampaignView: View {
  @Environment(AppStore.self) private var store
  let campaign: JSONValue
  @State private var latest: JSONValue = .null
  private var activeCampaign: JSONValue { latest.isNull ? campaign : latest }
  @State private var edit = false
  @State private var delivery = false
  @State private var archived = false
  @State private var error: String?
  var body: some View {
    NativePage(title: "Promotion") {
      OfferTile(rules: activeCampaign["rules"])
      Button("Edit future recipients’ terms") { edit = true }
      Button("Send to clients") { delivery = true }
      Button("Archive promotion", role: .destructive) { archived = true }
      if let error { ErrorNotice(message: error) }
    }
    .task(id: store.revision) {
      do {
        latest =
          try await store.query("offers.list")["campaigns"].array.first {
            $0["id"] == campaign["id"]
          } ?? campaign
      } catch { self.error = error.localizedDescription }
    }
    .sheet(isPresented: $edit) { NavigationStack { PromotionEditor(campaign: activeCampaign) } }
    .sheet(isPresented: $delivery) {
      NavigationStack { PromotionAudience(campaignID: campaign["id"].int) }
    }
    .confirmationDialog(
      "Archive this promotion? Existing issued terms remain unchanged.", isPresented: $archived
    ) {
      Button("Archive", role: .destructive) {
        Task {
          do { try await store.mutate("offers.archive", .object(["id": campaign["id"]])) } catch {
            self.error = error.localizedDescription
          }
        }
      }
    }
  }
}
struct PromotionAudience: View {
  @Environment(AppStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  let campaignID: Int
  @State private var mode = "all"
  @State private var clientIDs: Set<String> = []
  @State private var minSpend = 0
  @State private var bookings = 0
  @State private var inactive = 0
  @State private var birthMonth = 0
  @State private var city = ""
  @State private var push = false
  @State private var sms = false
  @State private var busy = false
  @State private var error: String?
  @State private var confirmation = false
  private var filters: JSONValue {
    var value: [String: JSONValue] = [:]
    if mode == "manual" { value["clientIds"] = .array(clientIDs.sorted().map(JSONValue.string)) }
    if mode == "filters" {
      value["minSpendCents"] = .integer(minSpend)
      value["minBookings"] = .integer(bookings)
      value["inactiveDays"] = .integer(inactive)
      if birthMonth > 0 { value["birthdayMonth"] = .integer(birthMonth) }
      if !city.isEmpty { value["city"] = .string(city) }
    }
    return .object(value)
  }
  var body: some View {
    Form {
      Picker("Audience", selection: $mode) {
        Text("All clients").tag("all")
        Text("Choose clients").tag("manual")
        Text("Filter clients").tag("filters")
      }
      if mode == "manual" {
        QueryScreen(path: "offers.audienceClients") { people in
          ForEach(people.array, id: \.id) { person in
            Toggle(
              person["name"].string,
              isOn: Binding(
                get: { clientIDs.contains(person.id) },
                set: { if $0 { clientIDs.insert(person.id) } else { clientIDs.remove(person.id) } })
            )
          }
        }
      }
      if mode == "filters" {
        Picker("Lifetime paid", selection: $minSpend) {
          Text("Any").tag(0)
          Text("$500+").tag(50000)
          Text("$1000+").tag(100000)
          Text("$5000+").tag(500000)
        }
        Picker("Completed bookings", selection: $bookings) {
          Text("Any").tag(0)
          ForEach([1, 3, 5, 10], id: \.self) { Text("\($0)+").tag($0) }
        }
        Picker("No sitting in", selection: $inactive) {
          Text("Any time").tag(0)
          ForEach([30, 90, 180, 365], id: \.self) { Text("\($0) days").tag($0) }
        }
        Picker("Birthday", selection: $birthMonth) {
          Text("Any month").tag(0)
          ForEach(1...12, id: \.self) { Text(Calendar.current.monthSymbols[$0 - 1]).tag($0) }
        }
        QueryScreen(path: "offers.audienceClients") { people in
          Picker("City", selection: $city) {
            Text("Any city").tag("")
            ForEach(
              Array(Set(people.array.map { $0["city"].string }.filter { !$0.isEmpty })).sorted(),
              id: \.self
            ) { Text($0).tag($0) }
          }
        }
      }
      QueryScreen(path: "offers.audience", input: filters) { audience in
        Section {
          Text("\(audience["count"].int) clients").font(Ivory.heading(28))
          Toggle("Push · \(audience["pushCount"].int) opted in", isOn: $push).disabled(
            !audience["pushAvailable"].bool)
          Toggle("SMS · \(audience["smsCount"].int) opted in", isOn: $sms).disabled(
            !audience["smsAvailable"].bool)
          Text(
            "Delivery uses the existing server provider and each client’s consent. This does not enable native APNs notifications."
          ).font(.footnote)
        }
      }
      if let error { Text(error).foregroundStyle(.red) }
      Button("Review and send") { confirmation = true }.disabled(
        busy || (mode == "manual" && clientIDs.isEmpty))
    }.navigationTitle("Who is this for?").toolbar { Button("Cancel") { dismiss() } }
      .confirmationDialog(
        "Send this offer to the selected audience?", isPresented: $confirmation,
        titleVisibility: .visible
      ) {
        Button("Send offers") {
          busy = true
          Task {
            defer { busy = false }
            do {
              let audience = try await store.query("offers.audience", filters, fresh: true)
              try await store.mutate(
                "offers.issue",
                .object([
                  "id": .integer(campaignID), "filters": filters,
                  "expectedCount": audience["count"],
                  "channels": .object(["push": .bool(push), "sms": .bool(sms)]),
                ]))
              dismiss()
            } catch { self.error = error.localizedDescription }
          }
        }
        Button("Cancel", role: .cancel) {}
      }
  }
}
struct ClientOffersView: View {
  var body: some View {
    QueryScreen(path: "offers.list") { data in
      ForEach(data["offers"].array, id: \.id) { offer in OfferTile(rules: offer["rules"]) }
    }
  }
}
