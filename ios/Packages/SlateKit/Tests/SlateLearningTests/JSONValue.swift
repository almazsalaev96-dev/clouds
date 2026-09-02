import Foundation

/// A minimal JSON tree, so the golden fixture can be navigated without writing a
/// `Codable` struct for every scenario shape. The fixture is a test oracle, not an API.
public enum JSONValue: Decodable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "unrecognised JSON")
    }

    public subscript(key: String) -> JSONValue {
        if case .object(let o) = self, let v = o[key] { return v }
        return .null
    }

    public subscript(index: Int) -> JSONValue {
        if case .array(let a) = self, index >= 0, index < a.count { return a[index] }
        return .null
    }

    public var array: [JSONValue] { if case .array(let a) = self { return a }; return [] }
    public var object: [String: JSONValue] { if case .object(let o) = self { return o }; return [:] }
    public var double: Double? { if case .number(let n) = self { return n }; return nil }
    public var int: Int? { double.map(Int.init) }
    public var string: String? { if case .string(let s) = self { return s }; return nil }
    public var isNull: Bool { if case .null = self { return true }; return false }
}
