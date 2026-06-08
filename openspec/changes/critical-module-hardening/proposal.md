# Critical Module Hardening

## Why

The cleanup flows are destructive. A small account-detection or resume mistake can apply actions to the wrong X account, retry already failed targets, or overwrite a manually reviewed approval file.

## What Changes

- Prefer authenticated profile-link DOM over current URL when resolving the active username.
- Reject reserved X system paths such as `/i`, `/settings`, and `/notifications` as usernames.
- Bind following execution sessions to the current username and reject resume/execute when the session account differs.
- Preserve existing `approved-unfollow.jsonl` during classification instead of overwriting manual review work.
- Resume following execution from pending items only; failed items remain recorded for manual review.

## Impact

- Old `session.json` files without `username` must be regenerated before destructive resume.
- Re-running `classify` no longer clears manually curated approval files.
- Failed following items are no longer retried implicitly; users can edit the session or confirmation file after review.
