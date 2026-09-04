import Foundation

/// Time as a dependency.
///
/// The learning engine's entire job is reasoning about elapsed days, so a test that
/// cannot move time forward cannot test it. Everything that needs "now" takes one of
/// these rather than calling `Date()`.
public protocol Clock: Sendable {
    var now: Date { get }
}

public struct SystemClock: Clock {
    public init() {}
    public var now: Date { Date() }
}

public final class TestClock: Clock, @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    public init(_ start: Date) { current = start }

    public var now: Date {
        lock.lock(); defer { lock.unlock() }
        return current
    }

    public func advance(days: Double) {
        lock.lock(); defer { lock.unlock() }
        current = current.addingTimeInterval(days * 86_400)
    }

    public func set(_ date: Date) {
        lock.lock(); defer { lock.unlock() }
        current = date
    }
}

public extension Date {
    /// Elapsed days as a `Double`. Used everywhere in the memory model, so it lives in
    /// one place with one definition rather than being re-derived at each call site.
    func days(since earlier: Date) -> Double {
        timeIntervalSince(earlier) / 86_400
    }
}
