# Changelog

Notable changes to this project are documented here.

## [1.0.1] - 2026-11-12

### Added

- Optional `emulator-version` input for pinning an AWS Emulator LTS version.
- GitHub Actions smoke workflow covering the latest and a pinned emulator version.
- Marketplace `server` icon.

### Changed

- Verify the AWS Emulator RPM's detached signature and AWS signing-key fingerprint before installation.
- Document version pinning, signature verification, and the `v1.0.1` usage example.

### Fixed

- Read the hyphenated `startup-timeout` input from the correct GitHub Actions environment variable.

## [1.0.0] - 2026-11-12

### Added

- Initial GitHub Action to run AWS Emulator in Docker, wait for its health check, configure AWS environment variables, and clean up after the job.
