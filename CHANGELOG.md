# Changelog

Notable changes to this project are documented here.

## [1.0.3] - 2026-11-19

### Changed

- Add a complete first-run workflow, troubleshooting guidance, and a contribution link.
- Document that Docker may reuse a cached package layer on persistent runners.
- Update usage examples to reference the v1.0.3 release.
- Exercise the documented AWS CLI S3 example in the smoke workflow.

## [1.0.2] - 2026-11-14

### Added

- Document AWS CLI usage, SDK endpoint and certificate configuration, and a Terraform provider example with a separate S3 backend note.

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
- Use the action's script directory for the Docker build and avoid retrying startup during post-job cleanup after an early failure.

## [1.0.0] - 2026-11-12

### Added

- Initial GitHub Action to run AWS Emulator in Docker, wait for its health check, configure AWS environment variables, and clean up after the job.
