#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

readonly DEPLOY_USER="zzzdeploy"
readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly SSH_DIR="${DEPLOY_ROOT}/.ssh"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly HISTORY_DIR="${DEPLOY_ROOT}/history"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly INSTALL_PATH="/usr/local/sbin/zzz-calculator-deploy"
readonly SOURCE_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/zzz-calculator-deploy"
readonly SUDOERS_PATH="/etc/sudoers.d/zzz-calculator-deploy"
readonly LOCK_DIR="/run/lock"
readonly SUDOERS_SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/zzz-calculator-deploy.sudoers"
readonly AUTHORIZED_KEY_PREFIX="no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc,restrict "

key_validation_tmp=""
authorized_keys_tmp=""
sudoers_staged=""
sudoers_backup=""
sudoers_had_original="0"
sudoers_candidate_active="0"

fail() {
    printf 'bootstrap error: %s\n' "$*" >&2
    exit 1
}

cleanup_temporary_files() {
    local path
    if ! restore_previous_sudoers; then
        printf 'bootstrap error: failed to restore previous sudoers policy; backup retained at %s\n' "$sudoers_backup" >&2
    fi
    for path in "$key_validation_tmp" "$authorized_keys_tmp" "$sudoers_staged"; do
        [[ -n "$path" ]] || continue
        rm -f -- "$path" 2>/dev/null || true
    done
    if [[ "$sudoers_candidate_active" == "0" && -n "$sudoers_backup" ]]; then
        rm -f -- "$sudoers_backup" 2>/dev/null || true
    fi
}

restore_previous_sudoers() {
    [[ "$sudoers_candidate_active" == "1" ]] || return 0
    if [[ "$sudoers_had_original" == "1" ]]; then
        [[ -f "$sudoers_backup" && ! -L "$sudoers_backup" ]] || return 1
        mv -Tf -- "$sudoers_backup" "$SUDOERS_PATH" || return 1
        sudoers_backup=""
    else
        rm -f -- "$SUDOERS_PATH" || return 1
    fi
    sudoers_candidate_active="0"
}

require_plain_directory_if_present() {
    local path="$1"
    if [[ -e "$path" || -L "$path" ]]; then
        [[ -d "$path" && ! -L "$path" ]] || fail "managed directory must not be a symlink: ${path}"
    fi
}

trap cleanup_temporary_files EXIT

[[ "$(id -u)" -eq 0 ]] || fail "run this one-time initializer as root"
[[ -f "$SOURCE_PATH" && ! -L "$SOURCE_PATH" ]] || fail "deployment program is missing or linked"
[[ -f "$SUDOERS_SOURCE" && ! -L "$SUDOERS_SOURCE" ]] || fail "sudoers template is missing or linked"
command -v useradd >/dev/null || fail "useradd is required"
command -v usermod >/dev/null || fail "usermod is required"
command -v groupadd >/dev/null || fail "groupadd is required"
command -v getent >/dev/null || fail "getent is required"
command -v passwd >/dev/null || fail "passwd is required"
command -v install >/dev/null || fail "install is required"
command -v visudo >/dev/null || fail "visudo is required"
command -v mktemp >/dev/null || fail "mktemp is required"
command -v ssh-keygen >/dev/null || fail "ssh-keygen is required"

for managed_dir in "$DEPLOY_ROOT" "$SSH_DIR" "$INCOMING_DIR" "$HISTORY_DIR" "$VALIDATION_DIR" "$PROCESSING_DIR" /opt/zzz_calculator/releases; do
    require_plain_directory_if_present "$managed_dir"
done
if [[ -e "$SUDOERS_PATH" || -L "$SUDOERS_PATH" ]]; then
    [[ -f "$SUDOERS_PATH" && ! -L "$SUDOERS_PATH" ]] || fail "installed sudoers path must be a regular file"
fi

authorized_keys="$SSH_DIR/authorized_keys"
public_key="${ZZZDEPLOY_PUBLIC_KEY:-}"
[[ -n "$public_key" ]] || fail "set ZZZDEPLOY_PUBLIC_KEY for every bootstrap run"
[[ "$public_key" != *$'\r'* && "$public_key" != *$'\n'* ]] || fail "ZZZDEPLOY_PUBLIC_KEY must contain exactly one public key"
[[ "$public_key" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)[[:space:]]+[^[:space:]]+([[:space:]].*)?$ ]] || fail "ZZZDEPLOY_PUBLIC_KEY is not an OpenSSH public key"
key_validation_tmp="$(mktemp)"
printf '%s\n' "$public_key" >"$key_validation_tmp"
chmod 0600 "$key_validation_tmp"
ssh-keygen -l -f "$key_validation_tmp" >/dev/null 2>&1 || fail "ZZZDEPLOY_PUBLIC_KEY is not a valid OpenSSH public key"
rm -f -- "$key_validation_tmp"
key_validation_tmp=""

visudo --check >/dev/null || fail "existing aggregate sudoers configuration is invalid"
visudo --check --file "$SUDOERS_SOURCE" >/dev/null || fail "sudoers template validation failed"

if ! getent group "$DEPLOY_USER" >/dev/null 2>&1; then
    groupadd --system "$DEPLOY_USER"
fi

if id "$DEPLOY_USER" >/dev/null 2>&1; then
    # The account is password-locked, but needs a non-interactive shell so
    # scp and the restricted sudo command can run over the dedicated key.
    usermod --gid "$DEPLOY_USER" --home "$DEPLOY_ROOT" --shell /bin/bash "$DEPLOY_USER"
else
    useradd --system --gid "$DEPLOY_USER" --home-dir "$DEPLOY_ROOT" --create-home --shell /bin/bash "$DEPLOY_USER"
fi
passwd --lock "$DEPLOY_USER" >/dev/null 2>&1 || fail "failed to lock the deployment account password"

install -d -o root -g root -m 0755 "$DEPLOY_ROOT"
install -d -o root -g "$DEPLOY_USER" -m 0750 "$SSH_DIR"
install -d -o root -g "$DEPLOY_USER" -m 0770 "$INCOMING_DIR"
install -d -o root -g root -m 0750 "$HISTORY_DIR" "$VALIDATION_DIR"
install -d -o root -g root -m 0700 "$PROCESSING_DIR"
install -d -o root -g root -m 0755 /opt/zzz_calculator/releases
install -d -o root -g root -m 0755 "$LOCK_DIR"

# Always replace the legacy inode after .ssh is root-controlled. This revokes
# any writer that opened the old zzzdeploy-owned file before migration.
if [[ -e "$authorized_keys" || -L "$authorized_keys" ]]; then
    [[ -f "$authorized_keys" && ! -L "$authorized_keys" ]] || fail "authorized_keys must be a regular file after .ssh is secured"
fi
authorized_keys_tmp="$(mktemp "${authorized_keys}.tmp.XXXXXXXX")"
printf '%s%s\n' "$AUTHORIZED_KEY_PREFIX" "$public_key" >"$authorized_keys_tmp"
chown root:"$DEPLOY_USER" "$authorized_keys_tmp"
chmod 0640 "$authorized_keys_tmp"
mv -Tf -- "$authorized_keys_tmp" "$authorized_keys"
authorized_keys_tmp=""
unset public_key ZZZDEPLOY_PUBLIC_KEY

install -o root -g root -m 0750 "$SOURCE_PATH" "$INSTALL_PATH"
sudoers_staged="$(mktemp "${SUDOERS_PATH}.tmp.XXXXXXXX")"
install -o root -g root -m 0440 "$SUDOERS_SOURCE" "$sudoers_staged"
visudo --check --file "$sudoers_staged" >/dev/null || fail "staged sudoers validation failed"
if [[ -e "$SUDOERS_PATH" ]]; then
    sudoers_backup="$(mktemp "${SUDOERS_PATH}.backup.XXXXXXXX")"
    install -o root -g root -m 0440 "$SUDOERS_PATH" "$sudoers_backup"
    sudoers_had_original="1"
fi
sudoers_candidate_active="1"
mv -Tf -- "$sudoers_staged" "$SUDOERS_PATH"
sudoers_staged=""
if ! visudo --check >/dev/null; then
    restore_previous_sudoers || fail "failed to restore the previous sudoers policy"
    visudo --check >/dev/null || fail "sudoers rollback did not restore a valid aggregate configuration"
    fail "new sudoers policy conflicts with the aggregate configuration; previous policy restored"
fi
sudoers_candidate_active="0"
if [[ -n "$sudoers_backup" ]]; then
    rm -f -- "$sudoers_backup"
    sudoers_backup=""
fi
trap - EXIT

printf 'initialized %s; current release and service were not modified\n' "$DEPLOY_USER"
