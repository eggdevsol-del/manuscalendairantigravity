import Foundation

public enum CSVImport {
  /// RFC 4180-style quoting; preview and commit stay on the existing server.
  public static func rows(_ text: String) throws -> [JSONValue] {
    guard text.utf8.count <= 3_000_000 else { throw APIError("Import files must be under 3 MB.") }
    let chars = Array(text.replacingOccurrences(of: "\r\n", with: "\n"))
    var records: [[String]] = []
    var row: [String] = []
    var field = ""
    var quoted = false
    var i = 0
    while i < chars.count {
      let char = chars[i]
      if char == "\"" {
        if quoted && i + 1 < chars.count && chars[i + 1] == "\"" {
          field.append("\"")
          i += 1
        } else {
          quoted.toggle()
        }
      } else if char == "," && !quoted {
        row.append(field)
        field = ""
      } else if char == "\n" && !quoted {
        row.append(field)
        if row.contains(where: { !$0.isEmpty }) { records.append(row) }
        row = []
        field = ""
      } else {
        field.append(char)
      }
      i += 1
    }
    guard !quoted else { throw APIError("A quoted CSV value is missing its closing quote.") }
    if !field.isEmpty || !row.isEmpty {
      row.append(field)
      records.append(row)
    }
    guard let headers = records.first, records.count > 1, records.count <= 501 else {
      throw APIError("Include a header and 1–500 records per import.")
    }
    let canonical = [
      "name", "email", "phone", "date", "startTime", "endTime", "serviceName", "price",
    ]
    let normalized = headers.map {
      $0.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(
        of: "\u{feff}", with: ""
      ).lowercased()
    }
    guard normalized.contains("name"), Set(normalized).count == normalized.count else {
      throw APIError("Use unique CSV column names and include a name column.")
    }
    return try records.dropFirst().enumerated().map { index, fields in
      guard fields.count == headers.count else {
        throw APIError("Row \(index + 2) has a different number of columns than the header.")
      }
      var result: [String: JSONValue] = ["sourceRow": .integer(index + 2)]
      for (column, key) in normalized.enumerated() {
        guard let actual = canonical.first(where: { $0.lowercased() == key }) else { continue }
        if actual == "price" {
          if !fields[column].isEmpty {
            guard let cents = NativeMoney.cents(fields[column]) else {
              throw APIError("Row \(index + 2) has an invalid price.")
            }
            result[actual] = .number(Double(cents) / 100)
          }
        } else {
          result[actual] = .string(fields[column].trimmingCharacters(in: .whitespacesAndNewlines))
        }
      }
      return .object(result)
    }
  }
}
