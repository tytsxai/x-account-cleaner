# Runtime Config Specification

## ADDED Requirements

### Requirement: User Data Directory Path Resolution

Runtime components that write account-scoped state SHALL resolve `USER_DATA_DIR` consistently and SHALL support both safe relative paths and safe absolute paths.

#### Scenario: Relative user data directory

- **GIVEN** `USER_DATA_DIR` is a relative path such as `./browser-data`
- **WHEN** the run lock is acquired
- **THEN** `run.lock` is written under the resolved account data directory.

#### Scenario: Absolute user data directory

- **GIVEN** `USER_DATA_DIR` is an absolute path to a dedicated account data directory
- **WHEN** the run lock is acquired
- **THEN** `run.lock` is written under that absolute directory.

#### Scenario: Dangerous user data directory

- **GIVEN** `USER_DATA_DIR` is empty, points at the project root, points at the filesystem root, or is a relative path containing `..`
- **WHEN** the run lock is acquired
- **THEN** startup fails before writing a lock file.
