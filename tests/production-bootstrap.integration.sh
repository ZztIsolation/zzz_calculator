#!/usr/bin/env bash

set -Eeuo pipefail

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BOOTSTRAP="${ROOT_DIR}/deploy/production/bootstrap-zzz-calculator-deploy.sh"
readonly MANAGER_SOURCE="${ROOT_DIR}/deploy/production/zzz-calculator-deploy"
readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly SSH_DIR="${DEPLOY_ROOT}/.ssh"
readonly AUTHORIZED_KEYS="${SSH_DIR}/authorized_keys"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly INSTALLED_MANAGER="/usr/local/sbin/zzz-calculator-deploy"
readonly SUDOERS_PATH="/etc/sudoers.d/zzz-calculator-deploy"
readonly KEY_PREFIX="no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc,restrict "

fail() {
    printf 'bootstrap integration failure: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -ne 0 ]] || fail "run this integration test as the regular CI user"
command -v sudo >/dev/null || fail "sudo is required"
command -v ssh-keygen >/dev/null || fail "ssh-keygen is required"
! getent passwd zzzdeploy >/dev/null 2>&1 || fail "zzzdeploy unexpectedly exists on the clean runner"
[[ ! -e "$DEPLOY_ROOT" ]] || fail "deployment root unexpectedly exists on the clean runner"

if sudo env ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 not-base64' bash "$BOOTSTRAP"; then
    fail "bootstrap accepted an invalid public key"
fi
! getent passwd zzzdeploy >/dev/null 2>&1 || fail "invalid key created the deployment user"
! getent group zzzdeploy >/dev/null 2>&1 || fail "invalid key created the deployment group"
[[ ! -e "$DEPLOY_ROOT" ]] || fail "invalid key created deployment directories"

test_root="$(mktemp -d)"
sync_dir="$(mktemp -d)"
writer_pid=""
conflict_file="/etc/sudoers.d/zzz-calculator-bootstrap-integration-conflict"
cleanup() {
    if [[ -n "$writer_pid" ]]; then
        sudo kill "$writer_pid" >/dev/null 2>&1 || true
        wait "$writer_pid" >/dev/null 2>&1 || true
    fi
    sudo rm -f -- "$conflict_file" >/dev/null 2>&1 || true
    rm -rf -- "$test_root" "$sync_dir"
}
trap cleanup EXIT
chmod 0777 "$sync_dir"

ssh-keygen -q -t ed25519 -N '' -C production-bootstrap-test -f "$test_root/id_ed25519"
public_key="$(<"$test_root/id_ed25519.pub")"
expected_authorized_key="${KEY_PREFIX}${public_key}"

sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" bash "$BOOTSTRAP"
[[ "$(stat -c '%U:%G:%a' -- "$SSH_DIR")" == "root:zzzdeploy:750" ]] || fail "unexpected .ssh ownership or mode"
[[ "$(stat -c '%U:%G:%a' -- "$AUTHORIZED_KEYS")" == "root:zzzdeploy:640" ]] || fail "unexpected authorized_keys ownership or mode"
[[ "$(stat -c '%U:%G:%a' -- "$INCOMING_DIR")" == "root:zzzdeploy:770" ]] || fail "unexpected incoming ownership or mode"
[[ "$(stat -c '%U:%G:%a' -- "$PROCESSING_DIR")" == "root:root:700" ]] || fail "unexpected processing ownership or mode"
sudo -u zzzdeploy test -r "$AUTHORIZED_KEYS" || fail "zzzdeploy cannot read authorized_keys"
if sudo -u zzzdeploy test -w "$AUTHORIZED_KEYS"; then
    fail "zzzdeploy can write authorized_keys"
fi
sudo -u zzzdeploy test -w "$INCOMING_DIR" || fail "zzzdeploy cannot upload to incoming"
locked_password="$(sudo getent shadow zzzdeploy | cut -d: -f2)"
[[ "$locked_password" == '!'* || "$locked_password" == '*'* ]] || fail "zzzdeploy password is not locked"
[[ "$(sudo passwd --status zzzdeploy | awk '{print $2}')" == "L" ]] || fail "passwd does not report zzzdeploy as locked"
sudo cmp -- "$MANAGER_SOURCE" "$INSTALLED_MANAGER" || fail "installed manager differs from source"
sudo visudo --check >/dev/null || fail "aggregate sudoers is invalid after bootstrap"
[[ ! -e /opt/zzz_calculator/current && ! -L /opt/zzz_calculator/current ]] || fail "bootstrap created or changed current"

# Simulate the old bootstrap's user-owned SSH directory and an unrestricted
# extra key, then keep the legacy authorized_keys inode open across migration.
sudo chown zzzdeploy:zzzdeploy "$SSH_DIR" "$AUTHORIZED_KEYS"
sudo chmod 0700 "$SSH_DIR"
sudo chmod 0600 "$AUTHORIZED_KEYS"
sudo -u zzzdeploy bash -c 'printf "%s\n" "$1" >>"$2"' -- "$public_key" "$AUTHORIZED_KEYS"
legacy_inode="$(sudo stat -c '%i' -- "$AUTHORIZED_KEYS")"

ready_file="${sync_dir}/ready"
release_file="${sync_dir}/release"
sudo -u zzzdeploy bash -c '
    exec 3>>"$1"
    : >"$2"
    while [[ ! -e "$3" ]]; do sleep 0.05; done
    printf "%s\n" "$4" >&3
' -- "$AUTHORIZED_KEYS" "$ready_file" "$release_file" "$public_key" &
writer_pid="$!"
for _ in $(seq 1 100); do
    [[ -e "$ready_file" ]] && break
    sleep 0.05
done
[[ -e "$ready_file" ]] || fail "legacy writer did not open authorized_keys"

sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" bash "$BOOTSTRAP"
sudo touch "$release_file"
wait "$writer_pid"
writer_pid=""

new_inode="$(sudo stat -c '%i' -- "$AUTHORIZED_KEYS")"
[[ "$new_inode" != "$legacy_inode" ]] || fail "bootstrap reused the legacy authorized_keys inode"
[[ "$(sudo cat -- "$AUTHORIZED_KEYS")" == "$expected_authorized_key" ]] || fail "bootstrap preserved or accepted legacy key content"
[[ "$(stat -c '%U:%G:%a' -- "$SSH_DIR")" == "root:zzzdeploy:750" ]] || fail "rerun did not secure .ssh"
[[ "$(stat -c '%U:%G:%a' -- "$AUTHORIZED_KEYS")" == "root:zzzdeploy:640" ]] || fail "rerun did not secure authorized_keys"
sudo visudo --check >/dev/null || fail "aggregate sudoers is invalid after rerun"

# Force a candidate-only alias collision. The bootstrap must reject the new
# aggregate sudoers policy and restore the previously installed policy.
bootstrap_fixture="${test_root}/bootstrap-conflict"
mkdir -p "$bootstrap_fixture"
cp -- "$BOOTSTRAP" "$bootstrap_fixture/bootstrap-zzz-calculator-deploy.sh"
cp -- "$MANAGER_SOURCE" "$bootstrap_fixture/zzz-calculator-deploy"
sed 's/ZZZ_CALCULATOR_DEPLOY/ZZZ_BOOTSTRAP_CONFLICT/g' \
    "$ROOT_DIR/deploy/production/zzz-calculator-deploy.sudoers" \
    >"$bootstrap_fixture/zzz-calculator-deploy.sudoers"
printf 'Cmnd_Alias ZZZ_BOOTSTRAP_CONFLICT = /bin/true\n' >"${test_root}/conflict.sudoers"
sudo install -o root -g root -m 0440 "${test_root}/conflict.sudoers" "$conflict_file"
sudo visudo --check >/dev/null || fail "conflict fixture broke the baseline sudoers policy"
sudoers_sha_before="$(sudo sha256sum -- "$SUDOERS_PATH" | awk '{print $1}')"
if sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" bash "$bootstrap_fixture/bootstrap-zzz-calculator-deploy.sh"; then
    fail "bootstrap accepted a conflicting aggregate sudoers policy"
fi
sudoers_sha_after="$(sudo sha256sum -- "$SUDOERS_PATH" | awk '{print $1}')"
[[ "$sudoers_sha_after" == "$sudoers_sha_before" ]] || fail "bootstrap did not restore the previous sudoers policy"
sudo visudo --check >/dev/null || fail "sudoers is invalid after candidate rollback"
sudo rm -f -- "$conflict_file"

printf 'production bootstrap integration tests passed\n'
