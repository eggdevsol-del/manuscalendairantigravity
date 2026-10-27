import SwiftUI

/// Native collection uses the existing authenticated server-side Stripe integration.
/// No secret key or bank data is written to preferences, analytics, or logs.
struct StripeOnboardingView: View {
  @Environment(AppStore.self) private var store
  @State private var firstName = ""
  @State private var lastName = ""
  @State private var email = ""
  @State private var phone = ""
  @State private var birthday = Calendar.current.date(byAdding: .year, value: -18, to: .now)!
  @State private var country = "AU"
  @State private var street = ""
  @State private var city = ""
  @State private var state = ""
  @State private var postcode = ""
  @State private var bsb = ""
  @State private var account = ""
  @State private var agreed = false
  @State private var busy = false
  @State private var error: String?
  @State private var result: JSONValue = .null
  var body: some View {
    Form {
      Section {
        Text("Get paid for your work").font(Ivory.heading(28))
        Text(
          "Your details are sent securely to Tattoi’s Stripe integration for account verification. Additional identity documents may be requested."
        ).foregroundStyle(Ivory.muted)
      }
      Section("Your identity") {
        TextField("First name", text: $firstName).textContentType(.givenName)
        TextField("Last name", text: $lastName).textContentType(.familyName)
        TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(
          .never)
        TextField("Mobile", text: $phone).keyboardType(.phonePad)
        DatePicker(
          "Date of birth", selection: $birthday, in: ...Date.now, displayedComponents: .date)
      }
      Section("Your address") {
        Picker("Country", selection: $country) {
          Text("Australia").tag("AU")
          Text("New Zealand").tag("NZ")
        }
        TextField("Street address", text: $street).textContentType(.streetAddressLine1)
        TextField("City", text: $city).textContentType(.addressCity)
        TextField("State or region", text: $state).textContentType(.addressState)
        TextField("Postcode", text: $postcode).textContentType(.postalCode)
      }
      Section("Your bank") {
        SecureField("BSB / routing number", text: $bsb).keyboardType(.numberPad)
        SecureField("Account number", text: $account).keyboardType(.numberPad)
        Text(
          "Bank formats and country support are validated by the existing server and Stripe. No funds are transferred by submitting this setup."
        ).font(.footnote)
      }
      Section {
        Link(
          "Read Stripe Connected Account Agreement",
          destination: URL(string: "https://stripe.com/connect-account/legal")!)
        Toggle(
          "I agree to the Stripe Connected Account Agreement and confirm these details are mine",
          isOn: $agreed)
        Button(busy ? "Submitting securely…" : "Submit to Stripe") { submit() }.disabled(
          !agreed || busy)
      }
      if let error { Text(error).foregroundStyle(.red) }
      if !result.isNull {
        Section("Verification") {
          Text(
            result["chargesEnabled"].bool
              ? "Payments enabled"
              : "Your details were submitted. Refresh Bank & payouts to check verification.")
          if result["requiresDocument"].bool {
            Text(
              "Stripe requires an identity document. Complete document verification in the web app; native document upload is still pending."
            )
          }
        }
      }
    }.navigationTitle("Payment setup").interactiveDismissDisabled(busy).disabled(busy).task {
      do {
        let profile = try await store.query("auth.me")
        email = profile["email"].string
        phone = profile["phone"].string
        city = profile["city"].string
      } catch { self.error = error.localizedDescription }
    }
  }
  private func submit() {
    guard agreed, !busy, !firstName.isEmpty, !lastName.isEmpty, !email.isEmpty, !street.isEmpty,
      !city.isEmpty, !state.isEmpty, postcode.count >= 4, (6...7).contains(bsb.count),
      (5...10).contains(account.count)
    else {
      error = "Complete every field. Bank details must match the formats supported by the server."
      return
    }
    busy = true
    Task {
      defer { busy = false }
      do {
        let connection = try await store.mutate(
          "artistSettings.connectStripe", .object(["embedded": .bool(true)]))
        guard connection["accountType"].string == "custom" else {
          throw APIError(
            "This account uses Stripe’s hosted onboarding. Use the secure Stripe option on Bank & payouts."
          )
        }
        let parts = Calendar(identifier: .gregorian).dateComponents(
          [.day, .month, .year], from: birthday)
        result = try await store.mutate(
          "artistSettings.submitStripeOnboarding",
          .object([
            "firstName": .string(firstName), "lastName": .string(lastName), "email": .string(email),
            "phone": .string(phone), "dobDay": .integer(parts.day!),
            "dobMonth": .integer(parts.month!), "dobYear": .integer(parts.year!),
            "country": .string(country), "addressLine1": .string(street),
            "addressCity": .string(city), "addressState": .string(state),
            "addressPostalCode": .string(postcode), "bankBsb": .string(bsb),
            "bankAccountNumber": .string(account),
          ]))
        account = ""
        bsb = ""
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
