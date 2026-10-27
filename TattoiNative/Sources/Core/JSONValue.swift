import Foundation

/// The server owns the domain contracts; this representation preserves optional fields and cents.
public enum JSONValue: Codable, Hashable, Sendable, Identifiable {
  case object([String: JSONValue])
  case array([JSONValue])
  case string(String)
  case number(Double)
  case bool(Bool)
  case null
  public init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if c.decodeNil() {
      self = .null
    } else if let v = try? c.decode(Bool.self) {
      self = .bool(v)
    } else if let v = try? c.decode(Double.self) {
      self = .number(v)
    } else if let v = try? c.decode(String.self) {
      self = .string(v)
    } else if let v = try? c.decode([JSONValue].self) {
      self = .array(v)
    } else {
      self = .object(try c.decode([String: JSONValue].self))
    }
  }
  public func encode(to encoder: Encoder) throws {
    var c = encoder.singleValueContainer()
    switch self {
    case .object(let v): try c.encode(v)
    case .array(let v): try c.encode(v)
    case .string(let v): try c.encode(v)
    case .number(let v): try c.encode(v)
    case .bool(let v): try c.encode(v)
    case .null: try c.encodeNil()
    }
  }
  public subscript(_ key: String) -> JSONValue {
    if case .object(let v) = self { return v[key] ?? .null }
    return .null
  }
  public var string: String {
    if case .string(let v) = self { return v }
    return ""
  }
  public var double: Double {
    if case .number(let v) = self { return v }
    return Double(string) ?? 0
  }
  public var int: Int { Int(double) }
  public var bool: Bool {
    if case .bool(let v) = self { return v }
    return int == 1
  }
  public var array: [JSONValue] {
    if case .array(let v) = self { return v }
    return []
  }
  public var object: [String: JSONValue] {
    if case .object(let v) = self { return v }
    return [:]
  }
  public var isNull: Bool { self == .null }
  public var id: String {
    let value = self["id"]
    return value.string.isEmpty ? String(value.int) : value.string
  }
  public var encodedString: String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return (try? String(data: encoder.encode(self), encoding: .utf8)) ?? "null"
  }
  public static func parse(_ text: String) -> JSONValue {
    (try? JSONDecoder().decode(Self.self, from: Data(text.utf8))) ?? .null
  }
  public static func text(_ text: String) -> Self { .string(text) }
  public static func integer(_ value: Int) -> Self { .number(Double(value)) }
}

public enum NativeMoney {
  /// Parse user input without defaulting a blank or invalid field to zero.
  public static func cents(_ text: String) -> Int? {
    let normalized = text.replacingOccurrences(of: ",", with: ".")
    guard !normalized.isEmpty,
      normalized.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil,
      let decimal = Decimal(string: normalized, locale: Locale(identifier: "en_US_POSIX")),
      decimal <= 1_000_000
    else { return nil }
    return NSDecimalNumber(decimal: decimal * 100).intValue
  }
  public static func format(_ cents: Int, currency: String = "AUD") -> String {
    (Decimal(cents) / 100).formatted(.currency(code: currency.uppercased()))
  }
}

public enum NativeDate {
  public static func parse(_ string: String) -> Date? {
    let normalized =
      string.contains("T") ? string : string.replacingOccurrences(of: " ", with: "T") + "Z"
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: normalized) ?? ISO8601DateFormatter().date(from: normalized)
  }
  public static func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
}
