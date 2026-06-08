# Login Reliability Specification

## ADDED Requirements

### Requirement: DOM-Based Authenticated State

The login manager SHALL classify a session as logged in only from authenticated DOM signals, not from the current URL alone.

#### Scenario: Browser reaches `/home` before the app shell is authenticated

- **GIVEN** the browser URL contains `/home`
- **AND** authenticated shell DOM signals are not present
- **WHEN** the login manager checks the login state
- **THEN** it does not report logged in
- **AND** it continues waiting or falls back according to the active login mode.

#### Scenario: Authenticated shell is present after a redirect

- **GIVEN** an authenticated shell DOM signal is present
- **WHEN** the login manager checks the login state
- **THEN** it reports logged in regardless of whether the current URL is `/home`.

### Requirement: Retriable Automatic Login Stages

Automatic credential login SHALL be split into retriable stages for navigation, username input, password input, submit, and final authenticated-state verification.

#### Scenario: Login page renders slowly

- **GIVEN** credentials are configured
- **AND** the login page does not render the username field immediately
- **WHEN** the automatic login navigation stage runs
- **THEN** the stage retries within its bounded retry budget before falling back or failing.

#### Scenario: Verification detour appears during automatic login

- **GIVEN** automatic login reaches an interactive verification, challenge, or account-access page
- **WHEN** the run is headless
- **THEN** login fails with an explicit message that manual verification is required.

- **GIVEN** automatic login reaches an interactive verification, challenge, or account-access page
- **WHEN** the run is headful
- **THEN** login falls back to manual-login waiting without discarding the current page state.

### Requirement: Resilient Manual Login Waiting

Manual-login waiting SHALL continue through login, verification, challenge, account-access, and delayed-render states until authenticated DOM appears or the bounded timeout expires.

#### Scenario: User is redirected through verification

- **GIVEN** the user is manually completing login
- **WHEN** the page shows verification or account-access DOM
- **THEN** the login manager keeps waiting
- **AND** it extends the deadline once by the verification grace period.

#### Scenario: Verification completes successfully

- **GIVEN** the user completes a verification detour
- **WHEN** authenticated shell DOM appears
- **THEN** manual login succeeds without requiring the URL to be `/home`.
