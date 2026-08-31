import Foundation
import Security

/// Minimal Keychain wrapper for the one secret the app legitimately holds: the
/// device token issued by the Study Desk proxy.
///
/// No model or voice provider key is ever stored here, because none is ever
/// sent to the device. See `docs/security.md`.
enum Keychain {
    private static let service = "com.studydesk.app"

    static func string(for key: String) -> String? {
        guard let data = data(for: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ value: String, for key: String) {
        set(Data(value.utf8), for: key)
    }

    static func data(for key: String) -> Data? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    static func set(_ data: Data, for key: String) {
        let query = baseQuery(key)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            // Available after first unlock so a background refresh can still
            // reach the proxy, but never synced to other devices.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = query
            insert.merge(attributes) { current, _ in current }
            SecItemAdd(insert as CFDictionary, nil)
        }
    }

    static func remove(_ key: String) {
        SecItemDelete(baseQuery(key) as CFDictionary)
    }

    private static func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
    }
}
