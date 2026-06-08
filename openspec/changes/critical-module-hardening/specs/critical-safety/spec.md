# Critical Safety Specification

## ADDED Requirements

### Requirement: Authenticated Username Resolution

The login manager SHALL resolve the active username from authenticated profile DOM before using the current URL as a fallback.

#### Scenario: Current URL is an X system path

- **GIVEN** the current URL is `/i/flow/login`, `/settings`, `/notifications`, or another reserved system path
- **WHEN** the tool resolves the active username
- **THEN** it does not treat the system path segment as a username.

### Requirement: Following Session Account Binding

Following execution sessions SHALL be bound to the account that created them.

#### Scenario: Resume is attempted under a different account

- **GIVEN** `session.json` stores `username` for one X account
- **AND** the current logged-in account is different
- **WHEN** `followings resume` or an existing-session `execute` runs
- **THEN** the tool refuses to perform destructive actions.

#### Scenario: Legacy session lacks username

- **GIVEN** `session.json` does not contain `username`
- **WHEN** destructive resume is requested
- **THEN** the tool refuses the resume and asks for a new reviewed session.

### Requirement: Manual Approval Preservation

Classification SHALL NOT overwrite a manually edited approval file.

#### Scenario: Approval file already exists

- **GIVEN** `approved-unfollow.jsonl` already exists
- **WHEN** `followings classify` runs again
- **THEN** the existing file is preserved.

### Requirement: Pending-Only Resume

Following resume SHALL continue pending items without implicitly retrying failed items.

#### Scenario: Session contains failed and pending items

- **GIVEN** `session.json` has failed items from a previous run
- **WHEN** resume executes
- **THEN** failed items remain recorded
- **AND** only pending items are eligible for destructive action.
