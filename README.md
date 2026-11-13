# AWS Emulator GitHub Action

Start [AWS Emulator](https://github.com/aws/aws-emulator) in a Docker container for a GitHub Actions job. The action waits for the emulator's HTTPS health check, exposes it only on the runner's loopback interface, configures AWS environment variables for later steps, and stops the container after the job.

AWS does not publish a prebuilt container image. This action builds one from the official AWS Emulator Linux package, following the [AWS Docker setup guide](https://docs.aws.amazon.com/emulator/latest/userguide/getting-started-docker.html). By default, it downloads the latest LTS package at build time.

The package's detached signature is verified against AWS's published signing key before installation. The `emulator-version` input can pin a specific LTS version; see [AWS Emulator versioning](https://docs.aws.amazon.com/emulator/latest/userguide/versioning.html#versioning-list) for available versions. The default remains `latest`.

## Usage

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Start AWS Emulator
    uses: willhallonline/aws-emulator-github-action@v1.0.1
    id: emulator

  - name: Check emulator health
    run: |
      curl --fail --silent --show-error \
        --cacert "$AWS_CA_BUNDLE" \
        "$AWS_ENDPOINT_URL/__admin/health"
```

The example uses the published `v1.0.1` tag. You can instead pin a commit SHA. The action requires a Linux runner with Docker available.

By default, the action turns telemetry off and configures these variables for subsequent workflow steps:

- `AWS_ENDPOINT_URL`
- `AWS_SHARED_CREDENTIALS_FILE`
- `AWS_CONFIG_FILE`
- `AWS_CA_BUNDLE`
- `AWS_EC2_METADATA_DISABLED=true`
- `AWS_DISABLE_HOST_PREFIX_INJECTION=true`
- `AWS_REGION=us-east-1`
- `AWS_DEFAULT_REGION=us-east-1`

The emulator generates temporary credentials for each run. Do not configure real AWS credentials in the environment of tests that should use the emulator; an explicit `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_PROFILE` can take precedence over the generated credentials.

## Using AWS CLI, SDKs, and other tools

The action makes the emulator settings available to **subsequent steps in the same job**. AWS CLI commands and SDKs that use the standard AWS credential/configuration chain can then use the emulator without specifying credentials or an endpoint on every command:

```yaml
- name: Start AWS Emulator
  uses: willhallonline/aws-emulator-github-action@v1.0.1
  id: emulator

- name: Verify the emulator and list S3 buckets
  run: |
    aws sts get-caller-identity
    aws s3 ls
```

The identity response should contain account `000000000000`. This is a useful check that a test is reaching the emulator rather than AWS. Keep real AWS credentials out of emulator test steps: credentials supplied through environment variables or `AWS_PROFILE` can override the generated credentials.

The action sets `AWS_CA_BUNDLE` to the emulator's generated certificate. AWS CLI, Boto3, and the AWS SDK for Go v2 use it directly. Some clients need an additional setting; for example, set `NODE_EXTRA_CA_CERTS` to `${{ steps.emulator.outputs.ca_bundle }}` for the AWS SDK for JavaScript v3, or configure the emulator trust store for Java. See the [AWS Emulator SDK guide](https://docs.aws.amazon.com/emulator/latest/userguide/point-sdk-to-emulator.html) for client-specific TLS and endpoint details.

## Using Terraform

Start the emulator before running Terraform. The action exports the endpoint, generated credentials file, region, and CA bundle for later steps. The HashiCorp AWS provider supports `AWS_ENDPOINT_URL` for routing service requests to a custom endpoint, so a current provider can use the action's environment directly:

```hcl
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true
}

resource "aws_s3_bucket" "example" {
  bucket = "example-bucket"
}
```

For example, after checking out your repository and setting up Terraform, run it in a later step:

```yaml
- name: Start AWS Emulator
  uses: willhallonline/aws-emulator-github-action@v1.0.1
  id: emulator

- uses: hashicorp/setup-terraform@v3

- name: Apply Terraform
  working-directory: terraform
  run: |
    terraform init
    terraform apply -auto-approve
```

The provider settings above are for Terraform-managed resources. Terraform's S3 state backend is configured separately from the provider; if you use an S3 backend against the emulator, configure its endpoint as well and start the emulator before `terraform init`. The AWS provider's [custom service endpoint guide](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/guides/custom-service-endpoints) describes global and per-service endpoint configuration. AWS-compatible services and individual Terraform resources can have compatibility differences; see the [AWS Emulator service guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html).

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `port` | `9297` | Host and emulator HTTPS port. Must be between 1 and 65535. |
| `telemetry` | `off` | Set to `on` or `off` to control emulator telemetry. |
| `startup-timeout` | `120` | Seconds to wait for the health check after starting the container. |
| `emulator-version` | `latest` | AWS Emulator LTS version to install, or `latest`. Use a version from the [AWS version list](https://docs.aws.amazon.com/emulator/latest/userguide/versioning.html#versioning-list) to pin it. |

## Outputs

| Output | Description |
| --- | --- |
| `endpoint_url` | Emulator endpoint, for example `https://127.0.0.1:9297`. |
| `ca_bundle` | Path to the generated `ca.pem` certificate. |
| `config_file` | Path to the generated AWS config file. |
| `credentials_file` | Path to the generated emulator credentials file. |
| `container_name` | Docker container name, useful for inspecting its logs. |

The action also stops and removes its container and temporary files automatically when the job finishes.

## License

This action's source code is licensed under the MIT License. AWS Emulator is a separate project; see its [repository](https://github.com/aws/aws-emulator) and [documentation](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html) for its terms and usage.
