# Design

## Authenticated DOM Signals

`LoginManager` treats the page as authenticated only when it sees stable logged-in shell elements such as the primary app shell, profile navigation, account switcher, or compose affordances. URL checks may still be used for diagnostics or username extraction, but `/home` is not a success condition by itself.

## Login State Model

The manual wait loop classifies the current DOM into:

- `logged_in`: authenticated-shell signal is present.
- `verification`: challenge, one-time code, account access, or suspicious-login form is present.
- `login_flow`: username or password inputs are present.
- `pending`: shell is still rendering, redirecting, or temporarily blank.

Verification detours extend the manual wait deadline once, but do not reset it forever.

## Automatic Login Stages

Automatic login is split into bounded, retriable stages:

1. `navigate`: open the X / Twitter login flow and wait for the login DOM.
2. `username`: fill the username/email field and submit the step.
3. `verification`: detect interactive detours. Headless runs fail fast; headful runs fall back to manual login.
4. `password`: fill the password field.
5. `submit`: submit the password step.
6. `verify`: wait for authenticated DOM signals.

Each stage logs its name and retries transient failures with a short fixed delay. The retry wrapper never logs usernames or passwords.

## Non-Goals

- Do not bypass CAPTCHA, 2FA, or account verification.
- Do not change stored browser state format.
- Do not change deletion or following-management behavior except where it depends on `LoginManager` results.
