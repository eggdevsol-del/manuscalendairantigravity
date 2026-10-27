import Foundation

#if canImport(Security)
  import Security
  public struct TokenVault {
    private let service: String
    public init(service: String) { self.service = service }
    private var query: [String: Any] {
      [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: "session",
      ]
    }
    public func read() -> String? {
      var q = query
      q[kSecReturnData as String] = true
      q[kSecMatchLimit as String] = kSecMatchLimitOne
      var result: CFTypeRef?
      guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
        let data = result as? Data
      else { return nil }
      return String(data: data, encoding: .utf8)
    }
    public func save(_ token: String) throws {
      let attributes: [String: Any] = [
        kSecValueData as String: Data(token.utf8),
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      ]
      var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
      if status == errSecItemNotFound {
        status = SecItemAdd(query.merging(attributes) { _, b in b } as CFDictionary, nil)
      }
      guard status == errSecSuccess else {
        throw APIError(
          "Your session could not be saved securely (Keychain status \(status)). Please try again.")
      }
    }
    public func clear() { SecItemDelete(query as CFDictionary) }
  }
#endif
