# Contributing

Thanks for helping improve the AWS Emulator GitHub Action.

## Before opening a pull request

- Keep changes focused and update `README.md` and `CHANGELOG.md` when behavior or user-facing configuration changes.
- Preserve the action's security boundaries: verify the official AWS Emulator package signature, bind the endpoint to runner loopback, and avoid using real AWS credentials for emulator tests.
- Describe the behavior changed and the checks you ran in the pull request.

## Validation

The action has no package installation or build step. For JavaScript changes, run:

```sh
node --check index.js
```

The GitHub Actions smoke workflow runs on pull requests. It exercises the latest and a pinned AWS Emulator version, validates generated AWS configuration and credentials, checks the HTTPS health endpoint, and verifies invalid startup-timeout input is rejected.

For changes to the Docker build or emulator startup behavior, also run the action on a Linux runner with Docker available when practical.

## Releases

Releases use `vMAJOR.MINOR.PATCH` tags. Update `CHANGELOG.md` for the release, merge the changes to `main`, then create the version tag from the released commit.
