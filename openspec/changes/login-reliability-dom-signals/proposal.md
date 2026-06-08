# Login Reliability DOM Signals

## Why

The current login path treats URL shape as the primary source of truth. X / Twitter login is a client-side flow with redirects, verification detours, and delayed shell rendering, so `/home` or `/i/flow/login` alone can report the wrong state. This makes stored-session checks, automatic credential login, and manual-login waiting fragile.

## What Changes

- Replace URL-based login success detection with DOM-based authenticated-shell signals.
- Keep navigation as a way to reach a known page, but do not classify login success from URL alone.
- Split automatic login into retriable stages: navigate to login flow, fill username, handle intermediate verification detours, fill password, submit, and verify authenticated DOM.
- Make manual-login waiting resilient to verification and account-access detours by continuing while login/verification/restriction DOM signals are present and extending time once per verification detour.
- Improve login logs so failures identify the stage that failed without printing credentials.
- Update relevant `docs/` pages so operations, troubleshooting, architecture, and API references match the new behavior.

## Impact

- Login checks become slower by a small amount because they wait for DOM signals instead of only reading URL.
- Automatic login can recover from transient selector/render delays without immediately falling back to manual login.
- Headless runs fail explicitly when an interactive verification detour is detected.
- Existing public `LoginManager` API remains unchanged.
