# Security Policy

X Account Cleaner is a local browser automation tool. It can perform irreversible actions on the logged-in X / Twitter account, so security reports should focus on real account safety, local data exposure, and unsafe destructive behavior.

## Supported Versions

The `main` branch and the latest GitHub release are the supported targets.

## What to Report

Please report issues such as:

- Credentials, cookies, browser state, or logs being exposed unexpectedly.
- A command that performs destructive actions without the documented confirmation or safety checks.
- A bug that can cause the tool to operate on the wrong account or wrong confirmation file.
- Dependency or packaging issues that materially affect local execution safety.

Do not include real passwords, cookies, tokens, full browser profiles, or private account data in a public issue.

## Reporting

If the issue can be discussed publicly after redaction, open a GitHub issue with the `bug` template and remove sensitive data first.

If the issue contains sensitive account data or a private exploit path, use GitHub's private vulnerability reporting when it is available for this repository. If it is not enabled, open a minimal public issue saying that a private security report is needed, without including the sensitive details.

## Local Safety Expectations

- Prefer manual login over storing passwords in `.env`.
- Keep `HEADLESS=false` for destructive confirmation flows.
- Run small batches first, for example `maxDeletePerSession: 5`.
- Keep browser state, logs, and generated following review files out of git.
- Review `logs/run-summary-*.json` before sharing it; it can contain local paths and account handles.
