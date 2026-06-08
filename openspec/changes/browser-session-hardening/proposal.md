# Browser Session Hardening

## Why

`BrowserManager` currently starts a regular browser with `launch()` and then creates an isolated `newContext()` loaded from `state.json`. That keeps cookies portable, but it does not preserve the full browser profile state that X can use across normal browser sessions, such as IndexedDB, local storage details, service worker state, profile preferences, and browser-level artifacts.

For an account cleanup tool, the safer baseline is a stable per-account browser profile plus an explicit storage-state snapshot. The code also needs predictable cleanup when startup or state persistence fails so a half-created profile or partial `state.json` does not poison later runs.

## What Changes

- Start Playwright with `launchPersistentContext()` instead of `launch() + newContext()`.
- Store the persistent browser profile under `USER_DATA_DIR/profile/`.
- Keep `USER_DATA_DIR/state.json` as an explicit storage-state snapshot for audit, migration, and recovery.
- Document that the profile is the primary live session store and `state.json` is a secondary snapshot.
- Add rollback/cleanup for failed browser startup and atomic cleanup for failed state saves.
- Update affected docs under `docs/`.

## Impact

- Existing users keep using the same `USER_DATA_DIR`, but new persistent browser data is written under `profile/`.
- Deleting only `state.json` no longer guarantees a fresh browser login; users who need a full reset must remove `profile/` too.
- Multiple concurrent runs with the same `USER_DATA_DIR` remain unsupported because persistent browser profiles require exclusive access.
