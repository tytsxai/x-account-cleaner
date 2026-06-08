# Safety Defaults Specification

## ADDED Requirements

### Requirement: Conservative Content Cleanup First Run

The repository SHALL ship with a first-run content cleanup cap of `executionConfig.maxDeletePerSession: 5`.

#### Scenario: User runs with the default config

- **GIVEN** the user has not changed `config.json`
- **WHEN** the default cleanup flow starts
- **THEN** each enabled content type is capped at 5 actions for that session
- **AND** `executionConfig.deletePerBatch` does not exceed `executionConfig.maxDeletePerSession`

### Requirement: Safe Following Cleanup Entry Point

New-user documentation SHALL describe `followings export` as the default first step for following cleanup and SHALL NOT instruct users to enable `deleteOptions.following` for onboarding.

#### Scenario: User wants to clean followings

- **GIVEN** the user reads `README.md`, `START_HERE.md`, or `QUICKSTART.md`
- **WHEN** they look for following cleanup instructions
- **THEN** they are directed to the `followings export -> classify -> manual approved-unfollow.jsonl -> dry-run -> execute` workflow
- **AND** legacy direct following deletion is clearly described as blocked by default.
