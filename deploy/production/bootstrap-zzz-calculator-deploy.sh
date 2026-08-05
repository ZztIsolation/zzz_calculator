#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

readonly DEPLOY_USER="zzzdeploy"
readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly HISTORY_DIR="${DEPLOY_ROOT}/history"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly INSTALL_PATH="/usr/local/sbin/zzz-calculator-deploy"
readonly SOURCE_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/zzz-calculator-deploy"
readonly SUDOERS_PATH="/etc/sudoers.d/zzz-calculator-deploy"
readonly LOCK_DIR="/run/lock"
readonly SUDOERS_SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/zzz-calculator-deploy.sudoers"

fail() {
    printf 'bootstrap error: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "run this one-time initializer as root"
[[ -f "$SOURCE_PATH" ]] || fail "deployment program is missing next to the bootstrap script"
[[ -f "$SUDOERS_SOURCE" ]] || fail "sudoers template is missing next to the bootstrap script"
command -v useradd >/dev/null || fail "useradd is required"
command -v install >/dev/null || fail "install is required"
command -v visudo >/dev/null || fail "visudo is required"

if id "$DEPLOY_USER" >/dev/null 2>&1; then
    # The account is password-locked, but needs a non-interactive shell so
    # scp and the restricted sudo command can run over the dedicated key.
    usermod --home "$DEPLOY_ROOT" --shell /bin/bash "$DEPLOY_USER"
else
    useradd --system --home-dir "$DEPLOY_ROOT" --create-home --shell /bin/bash "$DEPLOY_USER"
fi
passwd --lock "$DEPLOY_USER" >/dev/null 2>&1 || true

install -d -o root -g root -m 0755 "$DEPLOY_ROOT"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_ROOT/.ssh"
install -d -o root -g "$DEPLOY_USER" -m 0770 "$INCOMING_DIR"
install -d -o root -g root -m 0750 "$HISTORY_DIR" "$VALIDATION_DIR"
install -d -o root -g root -m 0755 /opt/zzz_calculator/releases
install -d -o root -g root -m 0755 "$LOCK_DIR"

# Keep public-key material outside the repository. Existing authorized_keys is
# preserved so rerunning this initializer never invalidates an installed key.
authorized_keys="$DEPLOY_ROOT/.ssh/authorized_keys"
if [[ ! -s "$authorized_keys" ]]; then
    public_key="${ZZZDEPLOY_PUBLIC_KEY:-}"
    [[ -n "$public_key" ]] || fail "set ZZZDEPLOY_PUBLIC_KEY for the first run, or install authorized_keys manually"
    [[ "$public_key" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)[[:space:]]+[^[:space:]]+([[:space:]].*)?$ ]] || fail "ZZZDEPLOY_PUBLIC_KEY is not an OpenSSH public key"
    printf 'no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc,restrict %s\n' "$public_key" >"$authorized_keys"
    unset public_key
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT/.ssh" "$authorized_keys"
chmod 0700 "$DEPLOY_ROOT/.ssh"
chmod 0600 "$authorized_keys"

install -o root -g root -m 0750 "$SOURCE_PATH" "$INSTALL_PATH"
install -o root -g root -m 0440 "$SUDOERS_SOURCE" "$SUDOERS_PATH"
visudo --check --file "$SUDOERS_PATH" >/dev/null || fail "sudoers validation failed"

printf 'initialized %s; current release and service were not modified\n' "$DEPLOY_USER"
