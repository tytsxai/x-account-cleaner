# Deletion Reliability Blocking Backoff

## Why

The remaining deletion reliability gap is that X / Twitter blocking signals are detected as generic errors. Rate limits, transient page failures, login verification, and account access restrictions currently look similar to the deleter, so retries can be too short, non-retryable states can be swallowed as per-item failures, and duplicated fixed waits make runtime harder to reason about.

## What Changes

- Classify deletion blocking states into retryable rate limits, retryable transient page failures, and non-retryable account restrictions.
- Route blocking-state failures through the shared retry/error primitives instead of throwing plain errors.
- Use `RateLimitError.retryAfterMs` for longer rate-limit backoff while preserving the existing `retryConfig` contract.
- Abort the destructive deletion flow on account access restrictions or exhausted blocking-state retries instead of silently skipping targets.
- Remove duplicated fixed waits where selector helpers already wait after scrolling or clicking.
- Update operations and developer docs so users know how rate-limit backoff and blocking-state stops behave.

## Impact

- Rate limits pause longer and retry in a controlled way.
- Account restriction, verification, or access pages stop the run with actionable logs.
- Per-target selector failures can still be skipped, but global blocking states are no longer hidden inside normal error counts.
- Runtime pacing is easier to tune because redundant sleeps are reduced.
