import Foundation
import Observation

@MainActor @Observable final class AppStore {
  let api: TRPCClient
  private let vault: TokenVault
  private var token: String?
  private var generation = 0
  var user: JSONValue = .null
  var restoring = true
  var loginError: String?
  var revision = 0
  private var serverRevision: String?
  private var cache: [String: JSONValue] = [:]
  private var pending: [String: Task<JSONValue, Error>] = [:]
  var isArtist: Bool { user["role"].string == "artist" }
  var userID: String { user["id"].string }
  init() {
    let address = Bundle.main.object(forInfoDictionaryKey: "TattoiAPIBaseURL") as? String ?? ""
    guard let url = URL(string: address), url.scheme == "https", url.host != nil else {
      preconditionFailure("Configure TattoiAPIBaseURL with the HTTPS backend URL.")
    }
    api = TRPCClient(baseURL: url)
    vault = TokenVault(service: "app.tattoi.native.session." + (url.host ?? "invalid"))
    token = vault.read()
    #if DEBUG
      let probe = TokenVault(service: "app.tattoi.native.secure-storage-check")
      do {
        try probe.save("keychain-check")
        guard probe.read() == "keychain-check" else {
          throw APIError("Secure storage could not be read.")
        }
        probe.clear()
      } catch { loginError = error.localizedDescription }
    #endif
  }
  func restore() async {
    defer { restoring = false }
    guard token != nil else { return }
    do {
      user = try await api.request(path: "auth.me", token: token)
      if user.isNull { clearSession() }
    } catch let error as APIError where error.unauthorized { clearSession() } catch {
      loginError = "Couldn’t restore your session. Check your connection and retry."
    }
  }
  func login(email: String, password: String) async throws {
    let result = try await api.request(
      path: "auth.login",
      input: RPCInput(
        .object([
          "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)),
          "password": .string(password),
        ])), mutation: true)
    guard ["artist", "client"].contains(result["user"]["role"].string),
      !result["token"].string.isEmpty
    else {
      throw APIError(
        "This native build supports artist and client accounts. Supplier and developer accounts remain in the web app."
      )
    }
    try vault.save(result["token"].string)
    clearMemory()
    token = result["token"].string
    user = result["user"]
    loginError = nil
  }
  func logout() {
    vault.clear()
    token = nil
    user = .null
    clearMemory()
  }
  private func clearSession() {
    logout()
    loginError = "Your session ended. Please sign in again."
  }
  private func clearMemory() {
    generation += 1
    pending.values.forEach { $0.cancel() }
    pending = [:]
    cache = [:]
    serverRevision = nil
    revision += 1
  }
  func query(_ path: String, _ json: JSONValue = .null, dates: [String] = [], fresh: Bool = false)
    async throws -> JSONValue
  {
    let key = path + json.encodedString
    if !fresh, let value = cache[key] { return value }
    if let task = pending[key] { return try await task.value }
    let current = generation
    let task = Task {
      try await api.request(path: path, input: RPCInput(json, dates: dates), token: token)
    }
    pending[key] = task
    defer { if current == generation { pending[key] = nil } }
    do {
      let value = try await task.value
      guard current == generation else { throw CancellationError() }
      cache[key] = value
      return value
    } catch let error as APIError {
      if error.unauthorized { clearSession() }
      throw error
    }
  }
  @discardableResult func mutate(_ path: String, _ json: JSONValue = .null, refresh: Bool = true)
    async throws -> JSONValue
  {
    let current = generation
    do {
      let value = try await api.request(
        path: path, input: RPCInput(json), mutation: true, token: token)
      guard current == generation else { throw CancellationError() }
      if refresh { invalidate() }
      return value
    } catch let error as APIError {
      if error.unauthorized { clearSession() }
      throw error
    }
  }
  func invalidate() {
    generation += 1
    pending.values.forEach { $0.cancel() }
    pending = [:]
    cache = [:]
    revision += 1
  }
  func watch() async {
    while !Task.isCancelled && !user.isNull {
      do {
        let next = try await query("system.workspaceRevision", fresh: true)["revision"].string
        if let previous = serverRevision, next != previous { invalidate() }
        serverRevision = next
      } catch is CancellationError { return } catch
      { /* Individual screens retain actionable errors; a poll never signs out on network failure. */
      }
      do { try await Task.sleep(for: .seconds(5)) } catch { return }
    }
  }
}
