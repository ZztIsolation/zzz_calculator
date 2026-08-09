FROM rockylinux/rockylinux:8.10@sha256:e8a49c5403b687db05d4d67333fa45808fbe74f36e683cec7abb1f7d0f2338c6

RUN dnf -y install \
        bash coreutils-single curl findutils gawk grep iproute procps-ng shadow-utils \
        systemd systemd-libs util-linux \
    && dnf clean all \
    && rm -rf /var/cache/dnf

COPY deploy/production/zzz-calculator-deploy /opt/zzz-cicd-source/zzz-calculator-deploy
COPY deploy/production/zzz-calculator-validation-worker /opt/zzz-cicd-source/zzz-calculator-validation-worker
COPY tests/production-systemd239-sandbox.integration.sh /usr/local/bin/production-systemd239-sandbox.integration.sh

RUN chmod 0555 \
        /opt/zzz-cicd-source/zzz-calculator-deploy \
        /opt/zzz-cicd-source/zzz-calculator-validation-worker \
        /usr/local/bin/production-systemd239-sandbox.integration.sh \
    && systemctl mask \
        console-getty.service \
        getty@.service \
        systemd-logind.service

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
