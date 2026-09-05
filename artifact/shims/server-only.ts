/**
 * `server-only` is a build-time guard in the Next app. The single-file build
 * has no server, so it resolves to nothing — and the AI provider it guards is
 * absent by design here, which the UI already handles as "no provider
 * configured" rather than as an error.
 */
export {};
