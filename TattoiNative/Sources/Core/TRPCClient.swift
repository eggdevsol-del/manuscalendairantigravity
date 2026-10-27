import Foundation

#if canImport(FoundationNetworking)
  import FoundationNetworking
#endif

public struct APIError: Error, LocalizedError, Sendable {
  public let message: String
  public let unauthorized: Bool
  public init(_ message: String, unauthorized: Bool = false) {
    self.message = message
    self.unauthorized = unauthorized
  }
  public var errorDescription: String? { message }
}
public struct RPCInput: Sendable {
  public var json: JSONValue
  public var dates: [String]
  public init(_ json: JSONValue = .null, dates: [String] = []) {
    self.json = json
    self.dates = dates
  }
  public var envelope: JSONValue {
    var value: [String: JSONValue] = ["json": json]
    if !dates.isEmpty {
      value["meta"] = .object([
        "values": .object(
          Dictionary(uniqueKeysWithValues: dates.map { ($0, .array([.string("Date")])) }))
      ])
    }
    return .object(value)
  }
}
public struct TRPCClient: Sendable {
  public let baseURL: URL
  public init(baseURL: URL) { self.baseURL = baseURL }
  public func request(
    path: String, input: RPCInput = RPCInput(), mutation: Bool = false, token: String? = nil
  ) async throws -> JSONValue {
    guard baseURL.scheme == "https", !path.isEmpty,
      path.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "." })
    else { throw APIError("Invalid API configuration.") }
    let endpoint = baseURL.appendingPathComponent("api/trpc/" + path)
    var parts = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
    if !mutation {
      parts.queryItems = [URLQueryItem(name: "input", value: input.envelope.encodedString)]
    }
    var request = URLRequest(
      url: parts.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
    request.httpMethod = mutation ? "POST" : "GET"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let token { request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
    if mutation { request.httpBody = try JSONEncoder().encode(input.envelope) }
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieStorage = nil
    let session = URLSession(
      configuration: configuration, delegate: NoRedirect(), delegateQueue: nil)
    defer { session.finishTasksAndInvalidate() }
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse else {
      throw APIError("The server response could not be verified.")
    }
    return try Self.decode(data, status: response.statusCode)
  }
  public static func decode(_ data: Data, status: Int) throws -> JSONValue {
    guard let value = try? JSONDecoder().decode(JSONValue.self, from: data) else {
      throw APIError(
        "The server returned an unreadable response. Please try again.", unauthorized: status == 401
      )
    }
    let error = value["error"]["json"].isNull ? value["error"] : value["error"]["json"]
    if !(200..<300).contains(status) || !error.isNull {
      let message = error["message"].string
      throw APIError(
        message.isEmpty ? "The request could not be completed (\(status))." : message,
        unauthorized: status == 401 || error["data"]["code"].string == "UNAUTHORIZED")
    }
    guard !value["result"].isNull else { throw APIError("The server response was incomplete.") }
    let result = value["result"]["data"]
    return result.object.keys.contains("json") ? result["json"] : result
  }
}
private final class NoRedirect: NSObject, URLSessionTaskDelegate, Sendable {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping @Sendable (URLRequest?) -> Void
  ) { completionHandler(nil) }
}
