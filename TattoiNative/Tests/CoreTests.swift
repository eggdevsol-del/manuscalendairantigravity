import XCTest

@testable import TattoiNativeCore

final class CoreTests: XCTestCase {
  func testMoneyRejectsBlankNegativeAndFractionalCents() {
    XCTAssertNil(NativeMoney.cents(""))
    XCTAssertNil(NativeMoney.cents("-1"))
    XCTAssertNil(NativeMoney.cents("12.345"))
    XCTAssertEqual(NativeMoney.cents("100.50"), 10050)
    XCTAssertEqual(NativeMoney.cents("0"), 0)
    XCTAssertEqual(NativeMoney.cents("12,50"), 1250)
  }
  func testJSONPreservesCentsAndNulls() throws {
    let value = JSONValue.parse("{\"paid\":10050,\"optional\":null,\"ready\":true}")
    XCTAssertEqual(value["paid"].int, 10050)
    XCTAssertEqual(value["optional"], .null)
    XCTAssertEqual(value["missing"], .null)
    XCTAssertEqual(
      try JSONDecoder().decode(JSONValue.self, from: Data(value.encodedString.utf8)), value)
    XCTAssertEqual(
      JSONValue.object(["b": .integer(2), "a": .integer(1)]).encodedString, "{\"a\":1,\"b\":2}")
  }
  func testSuperJSONDateInputMatchesServerContract() {
    let input = RPCInput(
      .object(["startDate": .string("2026-10-27T00:00:00Z")]), dates: ["startDate"])
    XCTAssertEqual(input.envelope["meta"]["values"]["startDate"].array, [.string("Date")])
  }
  func testTRPCWrappedPlainNullAndErrorResponses() throws {
    let wrapped = Data("{\"result\":{\"data\":{\"json\":{\"total\":10050}}}}".utf8)
    XCTAssertEqual(try TRPCClient.decode(wrapped, status: 200)["total"].int, 10050)
    XCTAssertEqual(
      try TRPCClient.decode(Data("{\"result\":{\"data\":{\"json\":null}}}".utf8), status: 200),
      .null)
    XCTAssertThrowsError(
      try TRPCClient.decode(
        Data(
          "{\"error\":{\"json\":{\"message\":\"Sign in again\",\"data\":{\"code\":\"UNAUTHORIZED\"}}}}"
            .utf8), status: 401)
    ) { error in
      XCTAssertTrue((error as? APIError)?.unauthorized == true)
      XCTAssertEqual(error.localizedDescription, "Sign in again")
    }
    XCTAssertThrowsError(try TRPCClient.decode(Data("not json".utf8), status: 502))
  }
  func testCSVQuotesNewlinesAndLimits() throws {
    let rows = try CSVImport.rows(
      "name,email,price\n\"Bob, Jr\",bob@example.test,100.50\n\"Line\nBreak\",,0")
    XCTAssertEqual(rows.count, 2)
    XCTAssertEqual(rows[0]["name"].string, "Bob, Jr")
    XCTAssertEqual(rows[0]["price"].double, 100.5)
    XCTAssertEqual(rows[1]["name"].string, "Line\nBreak")
    XCTAssertThrowsError(try CSVImport.rows("name,name\na,b"))
    XCTAssertThrowsError(try CSVImport.rows("name,email\n\"unfinished"))
    XCTAssertThrowsError(try CSVImport.rows("name,email\na,b,c"))
  }
  func testUTCAndISODateParsingAgree() {
    XCTAssertEqual(
      NativeDate.parse("2026-10-27 09:00:00"), NativeDate.parse("2026-10-27T09:00:00Z"))
    XCTAssertNotNil(NativeDate.parse("2026-10-27T09:00:00.000Z"))
    XCTAssertNil(NativeDate.parse("invalid"))
  }
}
