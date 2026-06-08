# Deletion Reliability Specification

## ADDED Requirements

### Requirement: Structured Blocking-State Detection

The deleter SHALL classify blocking states during destructive cleanup instead of throwing generic errors.

#### Scenario: Rate limit is visible during deletion

- **GIVEN** the current page displays rate-limit or too-many-requests text
- **WHEN** the deleter checks state before or after a destructive action
- **THEN** it raises a retryable rate-limit error
- **AND** the error carries a backoff delay suitable for rate-limit recovery.

#### Scenario: Account access is restricted

- **GIVEN** the browser is on an account access page or displays account restriction, lock, suspension, unusual activity, or verification text
- **WHEN** the deleter checks state
- **THEN** it raises a non-retryable blocking error
- **AND** the destructive cleanup flow stops instead of counting the state as a skipped item.

#### Scenario: Page-level transient error appears

- **GIVEN** the page displays a generic platform error such as "Something went wrong"
- **WHEN** the deleter checks state
- **THEN** it raises a retryable blocking error using the shared retry path.

### Requirement: Backoff-Aware Deletion Retries

Deletion actions SHALL use shared retry/error primitives so blocking states and selector failures have different outcomes.

#### Scenario: Rate limit retry is attempted

- **GIVEN** a destructive action encounters a rate-limit blocking state
- **WHEN** `retryConfig.maxRetries` allows another attempt
- **THEN** the retry waits for the rate-limit backoff delay, bounded by retry options
- **AND** cancellation remains honored during the wait.

#### Scenario: Target-specific selector failure occurs

- **GIVEN** a single target cannot find or click the expected control
- **WHEN** retry attempts are exhausted without a blocking state
- **THEN** the target may be counted as an error and skipped
- **AND** the global deletion flow may continue to the next target.

### Requirement: Non-Duplicated Runtime Waits

The deleter SHALL avoid stacking fixed waits where selector helpers already wait for scroll or click settling.

#### Scenario: Loading more content after an empty batch

- **GIVEN** no candidate is found in the current viewport
- **WHEN** the deleter scrolls to load more content
- **THEN** it relies on the selector helper's scroll wait
- **AND** it does not add another fixed sleep for the same scroll operation.
