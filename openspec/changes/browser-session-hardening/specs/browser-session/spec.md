# Browser Session Specification

## ADDED Requirements

### Requirement: Persistent Browser Profile

`BrowserManager` SHALL launch browsers with a persistent context backed by a stable per-account profile directory.

#### Scenario: Browser starts for an account

- **GIVEN** `USER_DATA_DIR` resolves to a local account data directory
- **WHEN** `BrowserManager.initialize()` starts the browser
- **THEN** it launches Playwright with `launchPersistentContext()`
- **AND** the persistent browser profile is stored under `USER_DATA_DIR/profile/`
- **AND** the configured viewport, screen, user agent, locale, timezone, DPR, and HTTP language headers are applied to that persistent context.

### Requirement: Storage-State Snapshot Role

The repository SHALL document and implement `state.json` as a secondary snapshot, not the primary live browser profile.

#### Scenario: Login state is saved

- **GIVEN** a persistent browser context is initialized
- **WHEN** `BrowserManager.saveState()` is called
- **THEN** it writes `USER_DATA_DIR/state.json` from the current context storage state
- **AND** the live browser profile remains under `USER_DATA_DIR/profile/`.

### Requirement: Startup Failure Cleanup

`BrowserManager` SHALL clean up resources created during failed startup without deleting existing user profile data.

#### Scenario: Startup fails after partial initialization

- **GIVEN** `BrowserManager.initialize()` has opened a page or context
- **WHEN** a later initialization step fails
- **THEN** it closes any opened page and context
- **AND** it removes a newly created empty profile directory
- **AND** it leaves pre-existing profile directories untouched.

### Requirement: Atomic State Snapshot Writes

`BrowserManager.saveState()` SHALL avoid replacing a valid `state.json` with a partial write.

#### Scenario: State save fails

- **GIVEN** an existing `USER_DATA_DIR/state.json`
- **WHEN** writing a new storage-state snapshot fails
- **THEN** the previous `state.json` remains in place
- **AND** temporary state files are removed when possible.
