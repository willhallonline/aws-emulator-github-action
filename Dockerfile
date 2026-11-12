FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal

ARG EMULATOR_ARCH=x86_64
ARG EMULATOR_VERSION=latest
RUN set -eu; \
    if [ "$EMULATOR_VERSION" = "latest" ]; then \
        package_url="https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-${EMULATOR_ARCH}.rpm"; \
    else \
        case "$EMULATOR_VERSION" in \
            *.*.*.*) package_version="${EMULATOR_VERSION%.*}"; package_release="${EMULATOR_VERSION##*.}" ;; \
            *) package_version="$EMULATOR_VERSION"; package_release=1 ;; \
        esac; \
        package_url="https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/aws-emulator-${package_version}-${package_release}-${EMULATOR_ARCH}.rpm"; \
    fi; \
    mkdir -m 700 /tmp/gnupg; \
    export GNUPGHOME=/tmp/gnupg; \
    curl -fsSLo /tmp/aws-emulator.rpm "$package_url"; \
    curl -fsSLo /tmp/aws-emulator.rpm.sig "${package_url}.sig"; \
    curl -fsSLo /tmp/aws-publishing.asc https://downloads.aws.com/keys/gpg/current.asc; \
    gpg --no-autostart --import /tmp/aws-publishing.asc; \
    fingerprint="$(gpg --no-autostart --with-colons --fingerprint ssm-publishing@amazon.com | awk -F: '$1 == "fpr" { print $10; exit }')"; \
    test "$fingerprint" = "98BCF336A3BE53B734E967C52E5BF49BD940F624"; \
    gpg --no-autostart --batch --verify /tmp/aws-emulator.rpm.sig /tmp/aws-emulator.rpm; \
    rpm --import /tmp/aws-publishing.asc; \
    rpm -i /tmp/aws-emulator.rpm; \
    rm -rf /tmp/gnupg /tmp/aws-emulator.rpm /tmp/aws-emulator.rpm.sig /tmp/aws-publishing.asc; \
    mkdir -p /home/emulator && chown 1000 /home/emulator
USER 1000
ENV HOME=/home/emulator
EXPOSE 9297
ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0"]
