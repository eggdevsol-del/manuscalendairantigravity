import PhotosUI
import SwiftUI

struct SettingsView: View {
  @Environment(AppStore.self) private var store
  @State private var name = ""
  @State private var phone = ""
  @State private var city = ""
  @State private var country = ""
  @State private var bio = ""
  @State private var avatar = ""
  @State private var business = ""
  @State private var address = ""
  @State private var businessCountry = "AU"
  @State private var photo: PhotosPickerItem?
  @State private var busy = false
  @State private var message: String?
  @State private var error: String?
  var body: some View {
    Form {
      Section("Profile & location") {
        if let url = URL(string: avatar), url.scheme == "https" {
          AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
          } placeholder: {
            ProgressView()
          }.frame(width: 80, height: 80).clipShape(Circle())
        }
        PhotosPicker("Choose profile photo", selection: $photo, matching: .images).disabled(busy)
        TextField("Full name", text: $name).textContentType(.name)
        TextField("Mobile", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
        TextField("City", text: $city).textContentType(.addressCity)
        TextField("Country", text: $country).textContentType(.countryName)
        TextField("About you", text: $bio, axis: .vertical)
        Button("Save profile") { saveProfile() }.disabled(
          busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
      }
      if store.isArtist {
        Section("Tattooing location") {
          TextField("Business name", text: $business)
          TextField("Tattooing address", text: $address).textContentType(.fullStreetAddress)
          Picker("Country", selection: $businessCountry) {
            Text("Australia").tag("AU")
            Text("New Zealand").tag("NZ")
          }
          Button("Save business location") {
            busy = true
            Task {
              defer { busy = false }
              do {
                try await store.mutate(
                  "artistSettings.upsert",
                  .object([
                    "businessName": .string(business), "businessAddress": .string(address),
                    "businessCountry": .string(businessCountry),
                  ]))
                message = "Business location saved."
                error = nil
              } catch { self.error = error.localizedDescription }
            }
          }.disabled(busy || address.isEmpty)
        }
        Section("Finish setup") {
          NavigationLink("Services & working hours") { ServicesView() }
          NavigationLink("Bank & payouts") { BankView() }
          Button("Check and complete setup") {
            busy = true
            Task {
              defer { busy = false }
              do {
                try await store.mutate("auth.completeOnboarding")
                _ = await store.restore()
                message = "Setup complete."
                error = nil
              } catch { self.error = error.localizedDescription }
            }
          }.disabled(busy)
        }
      }
      if let message { Text(message).foregroundStyle(Ivory.green) }
      if let error { Text(error).foregroundStyle(.red) }
      Section {
        Text("Native build 0.1 · \(store.api.baseURL.host ?? "")").font(.footnote).foregroundStyle(
          Ivory.muted)
        Button("Sign out", role: .destructive) { store.logout() }
      }
    }.navigationTitle("Settings").scrollContentBackground(.hidden).background(Ivory.paper).task {
      do {
        let profile = try await store.query("auth.me")
        name = profile["name"].string
        phone = profile["phone"].string
        city = profile["city"].string
        country = profile["country"].string
        bio = profile["bio"].string
        avatar = profile["avatar"].string
        if store.isArtist {
          let settings = try await store.query("artistSettings.get")
          business = settings["businessName"].string
          address = settings["businessAddress"].string
          businessCountry =
            settings["businessCountry"].string.isEmpty ? "AU" : settings["businessCountry"].string
        }
      } catch { self.error = error.localizedDescription }
    }.onChange(of: photo) { _, next in
      if let next {
        busy = true
        Task {
          defer {
            busy = false
            photo = nil
          }
          do {
            avatar = try await store.uploadImage(next)
            message = "Photo uploaded. Save your profile to apply it."
          } catch { self.error = error.localizedDescription }
        }
      }
    }
  }
  private func saveProfile() {
    busy = true
    Task {
      defer { busy = false }
      do {
        try await store.mutate(
          "auth.updateProfile",
          .object([
            "name": .string(name), "phone": .string(phone), "city": .string(city),
            "country": .string(country), "bio": .string(bio), "avatar": .string(avatar),
          ]))
        await store.restore()
        message = "Profile saved."
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct NativeService: Identifiable {
  let id = UUID()
  var record: [String: JSONValue]
  var name: String
  var price: String
  var duration: String
  var sittings: String
  var publicService: Bool
  init(_ value: JSONValue = .null) {
    record = value.object
    name = value["name"].string
    price = value.isNull ? "" : String(value["price"].double)
    duration = value.isNull ? "" : String(value["duration"].int)
    sittings = value.isNull ? "" : String(max(1, value["sittings"].int))
    publicService = value["showInFunnel"].bool
  }
  func json() throws -> JSONValue {
    guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      let cents = NativeMoney.cents(price), let minutes = Int(duration), minutes > 0,
      minutes <= 1440, let count = Int(sittings), (1...52).contains(count)
    else {
      throw APIError(
        "Each service needs a name, valid price, duration (1–1440 minutes) and 1–52 sittings.")
    }
    var data = record
    data["name"] = .string(name)
    data["price"] = .number(Double(cents) / 100)
    data["duration"] = .integer(minutes)
    data["sittings"] = .integer(count)
    data["showInFunnel"] = .bool(publicService)
    return .object(data)
  }
}
struct ServicesView: View {
  @Environment(AppStore.self) private var store
  @State private var services: [NativeService] = []
  @State private var schedule: [String: JSONValue] = [:]
  @State private var error: String?
  @State private var message: String?
  @State private var busy = false
  private let days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  var body: some View {
    Form {
      Section("Services") {
        ForEach($services) { $service in
          DisclosureGroup(service.name.isEmpty ? "New service" : service.name) {
            TextField("Name", text: $service.name)
            TextField("Price per sitting", text: $service.price).keyboardType(.decimalPad)
            TextField("Duration in minutes", text: $service.duration).keyboardType(.numberPad)
            TextField("Number of sittings", text: $service.sittings).keyboardType(.numberPad)
            Toggle("Show on booking page", isOn: $service.publicService)
            Button("Remove service", role: .destructive) {
              services.removeAll { $0.id == service.id }
            }
          }
        }
        Button("Add service") { services.append(NativeService()) }
        Button("Save services") { saveServices() }.disabled(busy)
      }
      Section("Working hours") {
        ForEach(days, id: \.self) { day in
          DisclosureGroup(day.capitalized) {
            Toggle("Working day", isOn: boolBinding(day, "enabled"))
            if schedule[day]?["enabled"].bool == true {
              TextField("Start (HH:mm)", text: textBinding(day, "start"))
              TextField("End (HH:mm)", text: textBinding(day, "end"))
              Text("Existing breaks and other day settings are preserved.").font(.footnote)
                .foregroundStyle(Ivory.muted)
            }
          }
        }
        Button("Save working hours") { saveSchedule() }.disabled(busy)
      }
      if let message { Text(message).foregroundStyle(Ivory.green) }
      if let error { Text(error).foregroundStyle(.red) }
    }.navigationTitle("Services & hours").scrollContentBackground(.hidden).background(Ivory.paper)
      .task {
        do {
          let settings = try await store.query("artistSettings.get")
          services = JSONValue.parse(settings["services"].string).array.map(NativeService.init)
          let raw = JSONValue.parse(settings["workSchedule"].string)
          for day in days {
            var data =
              (raw.object.isEmpty
              ? raw.array.first { $0["day"].string.lowercased() == day } ?? .null : raw[day]).object
            data["day"] = .string(day)
            if data["enabled"] == nil { data["enabled"] = .bool(false) }
            data["start"] = data["start"] ?? data["startTime"] ?? .string("09:00")
            data["end"] = data["end"] ?? data["endTime"] ?? .string("17:00")
            schedule[day] = .object(data)
          }
        } catch { self.error = error.localizedDescription }
      }
  }
  private func boolBinding(_ day: String, _ key: String) -> Binding<Bool> {
    Binding(
      get: { schedule[day]?[key].bool ?? false },
      set: { value in
        var data = schedule[day]?.object ?? [:]
        data[key] = .bool(value)
        schedule[day] = .object(data)
      })
  }
  private func textBinding(_ day: String, _ key: String) -> Binding<String> {
    Binding(
      get: { schedule[day]?[key].string ?? "" },
      set: { value in
        var data = schedule[day]?.object ?? [:]
        data[key] = .string(value)
        data[key + "Time"] = .string(value)
        schedule[day] = .object(data)
      })
  }
  private func saveServices() {
    do {
      let values = try services.map { try $0.json() }
      save(.object(["services": .string(JSONValue.array(values).encodedString)]), "Services saved.")
    } catch { self.error = error.localizedDescription }
  }
  private func saveSchedule() {
    for value in schedule.values where value["enabled"].bool {
      let start = value["start"].string
      let end = value["end"].string
      guard start.range(of: #"^([01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil,
        end.range(of: #"^([01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil,
        end > start
      else {
        error = "Each working day needs valid start/end times, with end after start."
        return
      }
    }
    save(
      .object(["workSchedule": .string(JSONValue.object(schedule).encodedString)]),
      "Working hours saved.")
  }
  private func save(_ input: JSONValue, _ success: String) {
    busy = true
    Task {
      defer { busy = false }
      do {
        try await store.mutate("artistSettings.upsert", input)
        message = success
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
