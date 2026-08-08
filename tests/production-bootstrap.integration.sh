#!/bin/bash

set -Eeuo pipefail
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GLOBIGNORE NODE_OPTIONS NODE_PATH NPM_CONFIG_PREFIX \
    LD_PRELOAD LD_LIBRARY_PATH || true
IFS=$' \t\n'

readonly ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BOOTSTRAP="${ROOT_DIR}/deploy/production/bootstrap-zzz-calculator-deploy.sh"
readonly MANAGER_SOURCE="${ROOT_DIR}/deploy/production/zzz-calculator-deploy"
readonly VALIDATION_WORKER_SOURCE="${ROOT_DIR}/deploy/production/zzz-calculator-validation-worker"
readonly SSH_GATEWAY_SOURCE="${ROOT_DIR}/deploy/production/zzz-calculator-ssh-gateway"
readonly SUDOERS_SOURCE="${ROOT_DIR}/deploy/production/zzz-calculator-deploy.sudoers"
readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly SSH_DIR="${DEPLOY_ROOT}/.ssh"
readonly AUTHORIZED_KEYS="${SSH_DIR}/authorized_keys"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly HISTORY_DIR="${DEPLOY_ROOT}/history"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly INSTALLED_MANAGER="/usr/local/sbin/zzz-calculator-deploy"
readonly INSTALLED_VALIDATION_WORKER="/usr/local/libexec/zzz-calculator-validation-worker"
readonly INSTALLED_SSH_GATEWAY="/usr/local/libexec/zzz-calculator-ssh-gateway"
readonly SUDOERS_PATH="/etc/sudoers.d/zzz-calculator-deploy"
readonly RELEASE_PARENT="/opt/zzz_calculator"
readonly RELEASE_ROOT="${RELEASE_PARENT}/releases"
readonly LOCK_DIR="/run/lock"
readonly LOCK_FILE="${LOCK_DIR}/zzz-calculator-deploy.lock"
readonly VALIDATION_HOME="/nonexistent"
readonly -a SHELL_STARTUP_FILES=(
    "${DEPLOY_ROOT}/.bashrc"
    "${DEPLOY_ROOT}/.bash_profile"
    "${DEPLOY_ROOT}/.bash_login"
    "${DEPLOY_ROOT}/.profile"
    "${DEPLOY_ROOT}/.bash_logout"
)
readonly KEY_PREFIX='command="/usr/local/libexec/zzz-calculator-ssh-gateway",restrict,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc '
readonly EXTRA_GROUP="zzzdeploy-bootstrap-extra"
readonly SAFE_PATH="/usr/sbin:/usr/bin:/sbin:/bin"

fail() {
    printf 'bootstrap integration failure: %s\n' "$*" >&2
    exit 1
}

path_state() {
    local path="$1"
    if sudo test -e "$path" || sudo test -L "$path"; then
        sudo stat -c 'present:%d:%i:%u:%g:%a:%h' -- "$path"
    else
        printf 'absent\n'
    fi
}

file_state() {
    local path="$1"
    if sudo test -f "$path" && ! sudo test -L "$path"; then
        printf '%s:%s\n' "$(sudo stat -c '%d:%i:%u:%g:%a:%h' -- "$path")" \
            "$(sudo sha256sum -- "$path" | awk '{print $1}')"
    else
        path_state "$path"
    fi
}

assert_state_equal() {
    local label="$1"
    local expected="$2"
    local actual="$3"
    [[ "$actual" == "$expected" ]] \
        || fail "${label} changed unexpectedly (before=${expected}, after=${actual})"
}

assert_locked_password_status() {
    local user="$1"
    local password_status
    password_status="$(sudo passwd --status "$user" | awk '{print $2}')"
    case "$password_status" in
        L|LK) ;;
        *) fail "passwd does not report ${user} as locked: ${password_status}" ;;
    esac
}

assert_exact_deploy_user() {
    local expected_gid passwd_record account_name account_password account_uid account_gid
    local account_gecos account_home account_shell locked_password
    expected_gid="$(getent group zzzdeploy | cut -d: -f3)"
    passwd_record="$(getent passwd zzzdeploy)"
    IFS=: read -r account_name account_password account_uid account_gid account_gecos account_home account_shell <<<"$passwd_record"

    [[ "$account_name" == "zzzdeploy" ]] || fail "unexpected deployment account name"
    [[ "$account_uid" -ne 0 ]] || fail "zzzdeploy unexpectedly has uid 0"
    [[ "$account_gid" == "$expected_gid" ]] || fail "zzzdeploy does not use its exact primary group"
    [[ "$(id -gn zzzdeploy)" == "zzzdeploy" ]] || fail "zzzdeploy primary group name is not normalized"
    [[ "$(id -G zzzdeploy)" == "$expected_gid" ]] || fail "zzzdeploy retains supplementary groups"
    [[ "$account_home" == "$DEPLOY_ROOT" ]] || fail "zzzdeploy home is not normalized"
    [[ "$account_shell" == "/bin/bash" ]] || fail "zzzdeploy shell is not normalized"
    [[ -z "$(getent group zzzdeploy | cut -d: -f4)" ]] || fail "zzzdeploy group has explicit members"

    locked_password="$(sudo getent shadow zzzdeploy | cut -d: -f2)"
    [[ "$locked_password" == '!'* || "$locked_password" == '*'* ]] \
        || fail "zzzdeploy password is not locked"
    assert_locked_password_status zzzdeploy
}

assert_exact_validation_user() {
    local expected_gid passwd_record account_name account_password account_uid account_gid
    local account_gecos account_home account_shell locked_password
    expected_gid="$(getent group zzzvalidate | cut -d: -f3)"
    passwd_record="$(getent passwd zzzvalidate)"
    IFS=: read -r account_name account_password account_uid account_gid account_gecos account_home account_shell <<<"$passwd_record"

    [[ "$account_name" == "zzzvalidate" ]] || fail "unexpected validation account name"
    [[ "$account_uid" -ne 0 ]] || fail "zzzvalidate unexpectedly has uid 0"
    [[ "$account_gid" == "$expected_gid" ]] || fail "zzzvalidate does not use its exact primary group"
    [[ "$(id -gn zzzvalidate)" == "zzzvalidate" ]] || fail "zzzvalidate primary group name is not normalized"
    [[ "$(id -G zzzvalidate)" == "$expected_gid" ]] || fail "zzzvalidate retains supplementary groups"
    [[ "$account_home" == "$VALIDATION_HOME" ]] || fail "zzzvalidate home is not normalized"
    [[ "$account_shell" == "/usr/sbin/nologin" ]] || fail "zzzvalidate shell is not normalized"
    [[ -z "$(getent group zzzvalidate | cut -d: -f4)" ]] || fail "zzzvalidate group has explicit members"
    [[ ! -e "$VALIDATION_HOME" && ! -L "$VALIDATION_HOME" ]] || fail "zzzvalidate has a home path"

    locked_password="$(sudo getent shadow zzzvalidate | cut -d: -f2)"
    [[ "$locked_password" == '!'* || "$locked_password" == '*'* ]] \
        || fail "zzzvalidate password is not locked"
    assert_locked_password_status zzzvalidate
}

assert_sudo_allowed() {
    sudo -u zzzdeploy sudo -n -l -- "$@" >/dev/null 2>&1 \
        || fail "sudo denied an expected deployment command: $*"
}

assert_sudo_denied() {
    if sudo -u zzzdeploy sudo -n -l -- "$@" >/dev/null 2>&1; then
        fail "sudo allowed an unexpected deployment command: $*"
    fi
}

assert_active_files_match_sources() {
    local expected_authorized_key="$1"
    sudo cmp -- "$MANAGER_SOURCE" "$INSTALLED_MANAGER" \
        || fail "installed manager differs from source"
    sudo cmp -- "$VALIDATION_WORKER_SOURCE" "$INSTALLED_VALIDATION_WORKER" \
        || fail "installed validation worker differs from source"
    sudo cmp -- "$SSH_GATEWAY_SOURCE" "$INSTALLED_SSH_GATEWAY" \
        || fail "installed SSH gateway differs from source"
    sudo cmp -- "$SUDOERS_SOURCE" "$SUDOERS_PATH" \
        || fail "installed sudoers differs from source"
    [[ "$(sudo cat -- "$AUTHORIZED_KEYS")" == "$expected_authorized_key" ]] \
        || fail "authorized_keys does not contain the exact forced-command key"
}

[[ "$(id -u)" -ne 0 ]] || fail "run this integration test as the regular CI user"
command -v sudo >/dev/null || fail "sudo is required"
command -v ssh-keygen >/dev/null || fail "ssh-keygen is required"
[[ -f "$SSH_GATEWAY_SOURCE" ]] || fail "SSH gateway source is missing"
! getent passwd zzzdeploy >/dev/null 2>&1 || fail "zzzdeploy unexpectedly exists on the clean runner"
! getent group zzzdeploy >/dev/null 2>&1 || fail "zzzdeploy group unexpectedly exists on the clean runner"
! getent passwd zzzvalidate >/dev/null 2>&1 || fail "zzzvalidate unexpectedly exists on the clean runner"
! getent group zzzvalidate >/dev/null 2>&1 || fail "zzzvalidate group unexpectedly exists on the clean runner"
! getent passwd zzzcalc >/dev/null 2>&1 || fail "zzzcalc unexpectedly exists on the clean runner"
! getent group zzzcalc >/dev/null 2>&1 || fail "zzzcalc group unexpectedly exists on the clean runner"
[[ ! -e "$DEPLOY_ROOT" && ! -L "$DEPLOY_ROOT" ]] \
    || fail "deployment root unexpectedly exists on the clean runner"
for unexpected_path in "$INSTALLED_MANAGER" "$INSTALLED_VALIDATION_WORKER" \
    "$INSTALLED_SSH_GATEWAY" "$SUDOERS_PATH" "$LOCK_FILE"; do
    [[ ! -e "$unexpected_path" && ! -L "$unexpected_path" ]] \
        || fail "managed path unexpectedly exists on the clean runner: ${unexpected_path}"
done
unset unexpected_path

# GitHub's runner image ships this generated policy with a permissive mode.
# The VM is disposable; normalize it before taking the sudoers baseline.
if sudo test -f /etc/sudoers.d/runner; then
    sudo chmod 0440 /etc/sudoers.d/runner
fi
sudo visudo --check >/dev/null || fail "runner sudoers baseline is invalid"

# Reproduce the legacy production layout. The bootstrap must harden only this
# parent directory's ownership, without replacing its inode or touching current.
sudo groupadd --system zzzcalc
sudo useradd --system --gid zzzcalc --home-dir /nonexistent \
    --no-create-home --shell /usr/sbin/nologin zzzcalc
sudo install -d -o zzzcalc -g zzzcalc -m 0755 "$RELEASE_PARENT"

lock_dir_state_before="$(path_state "$LOCK_DIR")"
release_parent_state_before="$(path_state "$RELEASE_PARENT")"
release_parent_device_inode_before="$(sudo stat -c '%d:%i' -- "$RELEASE_PARENT")"
release_root_state_before="$(path_state "$RELEASE_ROOT")"
libexec_state_before="$(path_state /usr/local/libexec)"

if sudo env ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 not-base64' /bin/bash "$BOOTSTRAP"; then
    fail "bootstrap accepted an invalid public key"
fi
! getent passwd zzzdeploy >/dev/null 2>&1 || fail "invalid key created the deployment user"
! getent group zzzdeploy >/dev/null 2>&1 || fail "invalid key created the deployment group"
! getent passwd zzzvalidate >/dev/null 2>&1 || fail "invalid key created the validation user"
! getent group zzzvalidate >/dev/null 2>&1 || fail "invalid key created the validation group"
[[ ! -e "$DEPLOY_ROOT" && ! -L "$DEPLOY_ROOT" ]] \
    || fail "invalid key created deployment directories"
assert_state_equal "/run/lock" "$lock_dir_state_before" "$(path_state "$LOCK_DIR")"

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
    sudo usermod --groups '' zzzdeploy >/dev/null 2>&1 || true
    sudo groupdel "$EXTRA_GROUP" >/dev/null 2>&1 || true
    rm -rf -- "$test_root" "$sync_dir"
}
trap cleanup EXIT
chmod 0777 "$sync_dir"

ssh-keygen -q -t ed25519 -N '' -C production-bootstrap-test -f "$test_root/id_ed25519"
ssh-keygen -q -t ed25519 -N '' -C production-bootstrap-alternate -f "$test_root/id_ed25519_alternate"
public_key="$(<"$test_root/id_ed25519.pub")"
alternate_public_key="$(<"$test_root/id_ed25519_alternate.pub")"
expected_authorized_key="${KEY_PREFIX}${public_key}"

# Exercise a failure after every managed file and the SSH directory have been
# installed. A clean host must return to its exact pre-bootstrap footprint.
set +e
late_clean_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" \
    ZZZDEPLOY_BOOTSTRAP_FAILPOINT=after-install /bin/bash "$BOOTSTRAP" 2>&1)"
late_clean_status="$?"
set -e
[[ "$late_clean_status" -ne 0 ]] || fail "injected clean-host failure unexpectedly succeeded"
if ! grep -Fq -- 'injected failure after managed file installation' <<<"$late_clean_output"; then
    printf '%s\n' "$late_clean_output" >&2
    fail "clean-host failpoint did not reach the late installation boundary"
fi
! getent passwd zzzdeploy >/dev/null 2>&1 || fail "failed transaction retained zzzdeploy"
! getent group zzzdeploy >/dev/null 2>&1 || fail "failed transaction retained zzzdeploy group"
! getent passwd zzzvalidate >/dev/null 2>&1 || fail "failed transaction retained zzzvalidate"
! getent group zzzvalidate >/dev/null 2>&1 || fail "failed transaction retained zzzvalidate group"
[[ ! -e "$DEPLOY_ROOT" && ! -L "$DEPLOY_ROOT" ]] \
    || fail "failed clean-host transaction retained deployment state"
for rolled_back_path in "$INSTALLED_MANAGER" "$INSTALLED_VALIDATION_WORKER" \
    "$INSTALLED_SSH_GATEWAY" "$SUDOERS_PATH" "$LOCK_FILE"; do
    [[ ! -e "$rolled_back_path" && ! -L "$rolled_back_path" ]] \
        || fail "failed clean-host transaction retained ${rolled_back_path}"
done
unset rolled_back_path
assert_state_equal "release parent" "$release_parent_state_before" "$(path_state "$RELEASE_PARENT")"
assert_state_equal "release root" "$release_root_state_before" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/usr/local/libexec" "$libexec_state_before" "$(path_state /usr/local/libexec)"
assert_state_equal "/run/lock" "$lock_dir_state_before" "$(path_state "$LOCK_DIR")"
sudo visudo --check >/dev/null || fail "sudoers was damaged by the clean-host rollback"

# The bootstrap self-sends TERM in every account/group post-create window.
# Those narrow mutations must finish bookkeeping and password locking before
# normal signal handling is restored.
sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" \
    ZZZDEPLOY_BOOTSTRAP_FAILPOINT=signal-during-account-setup \
    /bin/bash "$BOOTSTRAP"
[[ "$(sudo stat -c '%d:%i' -- "$RELEASE_PARENT")" == "$release_parent_device_inode_before" ]] \
    || fail "bootstrap replaced the legacy release parent inode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$RELEASE_PARENT")" == "root:root:755" ]] \
    || fail "bootstrap did not harden the legacy release parent"
[[ "$(sudo stat -c '%U:%G:%a' -- "$SSH_DIR")" == "root:zzzdeploy:750" ]] \
    || fail "unexpected .ssh ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a:%h' -- "$AUTHORIZED_KEYS")" == "root:zzzdeploy:640:1" ]] \
    || fail "unexpected authorized_keys ownership, mode or link count"
[[ "$(sudo stat -c '%U:%G:%a' -- "$INCOMING_DIR")" == "root:zzzdeploy:770" ]] \
    || fail "unexpected incoming ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$HISTORY_DIR")" == "root:root:750" ]] \
    || fail "unexpected history ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$VALIDATION_DIR")" == "root:root:750" ]] \
    || fail "unexpected validation ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$PROCESSING_DIR")" == "root:root:700" ]] \
    || fail "unexpected processing ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$INSTALLED_MANAGER")" == "root:root:755" ]] \
    || fail "installed manager has unsafe ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$INSTALLED_VALIDATION_WORKER")" == "root:root:555" ]] \
    || fail "installed validation worker has unsafe ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$INSTALLED_SSH_GATEWAY")" == "root:root:555" ]] \
    || fail "installed SSH gateway has unsafe ownership or mode"
[[ "$(sudo stat -c '%U:%G:%a' -- "$SUDOERS_PATH")" == "root:root:440" ]] \
    || fail "installed sudoers has unsafe ownership or mode"
for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    [[ "$(sudo stat -c '%U:%G:%a:%h:%s' -- "$shell_startup_path")" == "root:root:644:1:0" ]] \
        || fail "shell startup file is not empty and root-owned: ${shell_startup_path}"
done
unset shell_startup_path
sudo -u zzzdeploy test -r "$AUTHORIZED_KEYS" || fail "zzzdeploy cannot read authorized_keys"
if sudo -u zzzdeploy test -w "$AUTHORIZED_KEYS"; then
    fail "zzzdeploy can write authorized_keys"
fi
sudo -u zzzdeploy test -w "$INCOMING_DIR" || fail "zzzdeploy cannot upload to incoming"
sudo -u zzzdeploy test -x "$INSTALLED_SSH_GATEWAY" \
    || fail "zzzdeploy cannot execute the SSH gateway"
if sudo -u zzzdeploy test -w "$INSTALLED_SSH_GATEWAY"; then
    fail "zzzdeploy can write the SSH gateway"
fi
sudo -u zzzvalidate test -x "$INSTALLED_VALIDATION_WORKER" \
    || fail "zzzvalidate cannot execute the validation worker"
if sudo -u zzzvalidate test -w "$INSTALLED_VALIDATION_WORKER"; then
    fail "zzzvalidate can write the validation worker"
fi
assert_exact_deploy_user
assert_exact_validation_user
assert_active_files_match_sources "$expected_authorized_key"
sudo grep -Fqx -- "${expected_authorized_key}" "$AUTHORIZED_KEYS" \
    || fail "authorized_keys forced-command line is not exact"
if sudo grep -Fqx -- "$public_key" "$AUTHORIZED_KEYS"; then
    fail "authorized_keys retained an unrestricted public key"
fi
sudo visudo --check >/dev/null || fail "aggregate sudoers is invalid after bootstrap"
sudo grep -Fqx -- "Defaults!ZZZ_CALCULATOR_DEPLOY env_reset, !setenv, secure_path=\"${SAFE_PATH}\"" "$SUDOERS_PATH" \
    || fail "deployment command does not have the required safe sudo defaults"
assert_sudo_allowed "$INSTALLED_MANAGER" audit
assert_sudo_allowed "$INSTALLED_MANAGER" dry-run --artifact candidate.tar.gz
assert_sudo_allowed "$INSTALLED_MANAGER" deploy --artifact candidate.tar.gz
assert_sudo_allowed "$INSTALLED_MANAGER" rollback --previous
assert_sudo_denied "$INSTALLED_MANAGER" audit unexpected
assert_sudo_denied "$INSTALLED_MANAGER" rollback
assert_sudo_denied "$INSTALLED_MANAGER" rollback --release arbitrary-release
assert_sudo_denied "$INSTALLED_MANAGER" rollback --previous unexpected
[[ ! -e /opt/zzz_calculator/current && ! -L /opt/zzz_calculator/current ]] \
    || fail "bootstrap created or changed current"

release_root_state_after_create="$(path_state "$RELEASE_ROOT")"
lock_dir_state_after_create="$(path_state "$LOCK_DIR")"
lock_file_state_after_create="$(file_state "$LOCK_FILE")"

# An exact rerun is a true no-op for every active inode and managed directory.
ssh_state_before_idempotent="$(path_state "$SSH_DIR")"
key_state_before_idempotent="$(file_state "$AUTHORIZED_KEYS")"
manager_state_before_idempotent="$(file_state "$INSTALLED_MANAGER")"
worker_state_before_idempotent="$(file_state "$INSTALLED_VALIDATION_WORKER")"
gateway_state_before_idempotent="$(file_state "$INSTALLED_SSH_GATEWAY")"
sudoers_state_before_idempotent="$(file_state "$SUDOERS_PATH")"
sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP"
assert_state_equal ".ssh idempotent rerun" "$ssh_state_before_idempotent" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys idempotent rerun" "$key_state_before_idempotent" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager idempotent rerun" "$manager_state_before_idempotent" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker idempotent rerun" "$worker_state_before_idempotent" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway idempotent rerun" "$gateway_state_before_idempotent" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers idempotent rerun" "$sudoers_state_before_idempotent" "$(file_state "$SUDOERS_PATH")"
assert_state_equal "release root idempotent rerun" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock idempotent rerun" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"
assert_state_equal "lock file idempotent rerun" "$lock_file_state_after_create" "$(file_state "$LOCK_FILE")"

# Legacy home files are account-writable and Bash may read .bashrc before an
# SSH forced command. A failed migration must restore them byte-for-byte; a
# successful rerun replaces every startup file with an empty root-owned inode.
for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    printf 'exit 97\n' >"${test_root}/legacy-startup"
    sudo install -o zzzdeploy -g zzzdeploy -m 0644 \
        "${test_root}/legacy-startup" "$shell_startup_path"
done
unset shell_startup_path
declare -a legacy_startup_states=()
for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    legacy_startup_states+=("$(file_state "$shell_startup_path")")
done
unset shell_startup_path

set +e
legacy_startup_failure_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" \
    ZZZDEPLOY_BOOTSTRAP_FAILPOINT=after-install /bin/bash "$BOOTSTRAP" 2>&1)"
legacy_startup_failure_status="$?"
set -e
[[ "$legacy_startup_failure_status" -ne 0 ]] \
    || fail "legacy startup failpoint unexpectedly succeeded"
grep -Fq -- 'injected failure after managed file installation' <<<"$legacy_startup_failure_output" \
    || fail "legacy startup failpoint did not reach the managed-file boundary"
for index in "${!SHELL_STARTUP_FILES[@]}"; do
    assert_state_equal "legacy startup rollback ${SHELL_STARTUP_FILES[$index]}" \
        "${legacy_startup_states[$index]}" "$(file_state "${SHELL_STARTUP_FILES[$index]}")"
done
unset index legacy_startup_states

sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP"
for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    [[ "$(sudo stat -c '%U:%G:%a:%h:%s' -- "$shell_startup_path")" == "root:root:644:1:0" ]] \
        || fail "bootstrap did not neutralize shell startup file: ${shell_startup_path}"
done
unset shell_startup_path

# Unsupported ownership and unsafe modes must fail before any managed inode is
# touched. The bootstrap must never normalize an unrecognized parent contract.
parent_reject_ssh_state="$(path_state "$SSH_DIR")"
parent_reject_key_state="$(file_state "$AUTHORIZED_KEYS")"
parent_reject_manager_state="$(file_state "$INSTALLED_MANAGER")"
parent_reject_worker_state="$(file_state "$INSTALLED_VALIDATION_WORKER")"
parent_reject_gateway_state="$(file_state "$INSTALLED_SSH_GATEWAY")"
parent_reject_sudoers_state="$(file_state "$SUDOERS_PATH")"

sudo chown "$(id -u):$(id -g)" "$RELEASE_PARENT"
untrusted_parent_state="$(path_state "$RELEASE_PARENT")"
set +e
untrusted_parent_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP" 2>&1)"
untrusted_parent_status="$?"
set -e
[[ "$untrusted_parent_status" -ne 0 ]] || fail "bootstrap accepted an unrecognized release parent owner"
grep -Fq -- 'existing release parent has unsupported ownership or mode' <<<"$untrusted_parent_output" \
    || fail "bootstrap did not report the unrecognized release parent contract"
assert_state_equal "unrecognized release parent rejection" "$untrusted_parent_state" "$(path_state "$RELEASE_PARENT")"

sudo chown root:root "$RELEASE_PARENT"
sudo chmod 0777 "$RELEASE_PARENT"
unsafe_parent_state="$(path_state "$RELEASE_PARENT")"
set +e
unsafe_parent_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP" 2>&1)"
unsafe_parent_status="$?"
set -e
[[ "$unsafe_parent_status" -ne 0 ]] || fail "bootstrap accepted a writable release parent"
grep -Fq -- 'existing release parent has unsupported ownership or mode' <<<"$unsafe_parent_output" \
    || fail "bootstrap did not report the unsafe release parent mode"
assert_state_equal "unsafe release parent rejection" "$unsafe_parent_state" "$(path_state "$RELEASE_PARENT")"
sudo chmod 0755 "$RELEASE_PARENT"

assert_state_equal ".ssh release parent rejection" "$parent_reject_ssh_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys release parent rejection" "$parent_reject_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager release parent rejection" "$parent_reject_manager_state" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker release parent rejection" "$parent_reject_worker_state" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway release parent rejection" "$parent_reject_gateway_state" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers release parent rejection" "$parent_reject_sudoers_state" "$(file_state "$SUDOERS_PATH")"
assert_state_equal "release root release parent rejection" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock release parent rejection" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"
assert_state_equal "lock file release parent rejection" "$lock_file_state_after_create" "$(file_state "$LOCK_FILE")"
[[ ! -e /opt/zzz_calculator/current && ! -L /opt/zzz_calculator/current ]] \
    || fail "release parent rejection created or changed current"

# Force TERM after the SSH backup state is prepared but before the original
# directory is moved. The original directory and key inodes must survive.
ssh_signal_dir_state="$(path_state "$SSH_DIR")"
ssh_signal_key_state="$(file_state "$AUTHORIZED_KEYS")"
ssh_signal_manager_state="$(file_state "$INSTALLED_MANAGER")"
ssh_signal_worker_state="$(file_state "$INSTALLED_VALIDATION_WORKER")"
ssh_signal_gateway_state="$(file_state "$INSTALLED_SSH_GATEWAY")"
ssh_signal_sudoers_state="$(file_state "$SUDOERS_PATH")"
set +e
ssh_signal_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$alternate_public_key" \
    ZZZDEPLOY_BOOTSTRAP_FAILPOINT=signal-before-ssh-move \
    /bin/bash "$BOOTSTRAP" 2>&1)"
ssh_signal_status="$?"
set -e
[[ "$ssh_signal_status" -eq 143 ]] \
    || fail "SSH pre-move TERM failpoint returned ${ssh_signal_status}, expected 143: ${ssh_signal_output}"
assert_state_equal ".ssh pre-move TERM" "$ssh_signal_dir_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys pre-move TERM" "$ssh_signal_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager pre-move TERM" "$ssh_signal_manager_state" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker pre-move TERM" "$ssh_signal_worker_state" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway pre-move TERM" "$ssh_signal_gateway_state" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers pre-move TERM" "$ssh_signal_sudoers_state" "$(file_state "$SUDOERS_PATH")"
[[ -z "$(sudo find "$DEPLOY_ROOT" -maxdepth 1 -name '.ssh.backup.*' -print -quit)" ]] \
    || fail "SSH pre-move TERM retained an empty backup directory"
assert_state_equal "release root pre-move TERM" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock pre-move TERM" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"
assert_state_equal "lock file pre-move TERM" "$lock_file_state_after_create" "$(file_state "$LOCK_FILE")"

initial_ssh_state="$(path_state "$SSH_DIR")"
initial_key_state="$(file_state "$AUTHORIZED_KEYS")"
if sudo env -u ZZZDEPLOY_PUBLIC_KEY /bin/bash "$BOOTSTRAP"; then
    fail "bootstrap accepted a rerun without a public key"
fi
assert_state_equal ".ssh missing-key rerun" "$initial_ssh_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys missing-key rerun" "$initial_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "release root missing-key rerun" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock missing-key rerun" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"

# Migrate the known old bootstrap's writable SSH layout. Keep the old file
# descriptor open to prove the replacement revokes a legacy writer.
sudo chown zzzdeploy:zzzdeploy "$SSH_DIR" "$AUTHORIZED_KEYS"
sudo chmod 0700 "$SSH_DIR"
sudo chmod 0600 "$AUTHORIZED_KEYS"
sudo -u zzzdeploy bash -c 'printf "%s\n" "$1" >>"$2"' -- "$public_key" "$AUTHORIZED_KEYS"
sudo -u zzzdeploy touch "$SSH_DIR/config"
legacy_ssh_inode="$(sudo stat -c '%i' -- "$SSH_DIR")"
legacy_key_inode="$(sudo stat -c '%i' -- "$AUTHORIZED_KEYS")"

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

sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP"
sudo touch "$release_file"
wait "$writer_pid"
writer_pid=""

[[ "$(sudo stat -c '%i' -- "$SSH_DIR")" != "$legacy_ssh_inode" ]] \
    || fail "bootstrap reused the legacy .ssh directory inode"
[[ "$(sudo stat -c '%i' -- "$AUTHORIZED_KEYS")" != "$legacy_key_inode" ]] \
    || fail "bootstrap reused the legacy authorized_keys inode"
[[ "$(sudo cat -- "$AUTHORIZED_KEYS")" == "$expected_authorized_key" ]] \
    || fail "bootstrap preserved or accepted legacy key content"
sudo test ! -e "$SSH_DIR/config" || fail "bootstrap preserved an unmanaged SSH account file"
assert_exact_deploy_user
assert_exact_validation_user

# A mismatched existing account is rejected before the transaction lock or any
# managed inode is touched. The test restores its own deliberate mismatch.
sudo groupadd "$EXTRA_GROUP"
sudo usermod --append --groups "$EXTRA_GROUP" zzzdeploy
account_reject_ssh_state="$(path_state "$SSH_DIR")"
account_reject_key_state="$(file_state "$AUTHORIZED_KEYS")"
account_reject_manager_state="$(file_state "$INSTALLED_MANAGER")"
account_reject_worker_state="$(file_state "$INSTALLED_VALIDATION_WORKER")"
account_reject_gateway_state="$(file_state "$INSTALLED_SSH_GATEWAY")"
account_reject_sudoers_state="$(file_state "$SUDOERS_PATH")"
if sudo env ZZZDEPLOY_PUBLIC_KEY="$public_key" /bin/bash "$BOOTSTRAP"; then
    fail "bootstrap took over an account with supplementary groups"
fi
assert_state_equal ".ssh account rejection" "$account_reject_ssh_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys account rejection" "$account_reject_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager account rejection" "$account_reject_manager_state" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker account rejection" "$account_reject_worker_state" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway account rejection" "$account_reject_gateway_state" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers account rejection" "$account_reject_sudoers_state" "$(file_state "$SUDOERS_PATH")"
sudo usermod --groups '' zzzdeploy
sudo groupdel "$EXTRA_GROUP"
assert_exact_deploy_user

# A candidate-only alias collision must be found by the staged aggregate
# validation. All candidate source files differ so an accidental fall-through
# would replace every active managed inode.
conflict_fixture="${test_root}/bootstrap-conflict"
mkdir -p "$conflict_fixture"
cp -- "$BOOTSTRAP" "$conflict_fixture/bootstrap-zzz-calculator-deploy.sh"
cp -- "$MANAGER_SOURCE" "$conflict_fixture/zzz-calculator-deploy"
cp -- "$VALIDATION_WORKER_SOURCE" "$conflict_fixture/zzz-calculator-validation-worker"
cp -- "$SSH_GATEWAY_SOURCE" "$conflict_fixture/zzz-calculator-ssh-gateway"
printf '\n# bootstrap conflict fixture\n' >>"$conflict_fixture/zzz-calculator-deploy"
printf '\n# bootstrap conflict fixture\n' >>"$conflict_fixture/zzz-calculator-validation-worker"
printf '\n# bootstrap conflict fixture\n' >>"$conflict_fixture/zzz-calculator-ssh-gateway"
sed 's/ZZZ_CALCULATOR_DEPLOY/ZZZ_BOOTSTRAP_CONFLICT/g' "$SUDOERS_SOURCE" \
    >"$conflict_fixture/zzz-calculator-deploy.sudoers"
printf 'Cmnd_Alias ZZZ_BOOTSTRAP_CONFLICT = /bin/true\n' >"${test_root}/conflict.sudoers"
sudo install -o root -g root -m 0440 "${test_root}/conflict.sudoers" "$conflict_file"
sudo visudo --check >/dev/null || fail "conflict fixture broke the baseline sudoers policy"

conflict_ssh_state="$(path_state "$SSH_DIR")"
conflict_key_state="$(file_state "$AUTHORIZED_KEYS")"
conflict_manager_state="$(file_state "$INSTALLED_MANAGER")"
conflict_worker_state="$(file_state "$INSTALLED_VALIDATION_WORKER")"
conflict_gateway_state="$(file_state "$INSTALLED_SSH_GATEWAY")"
conflict_sudoers_state="$(file_state "$SUDOERS_PATH")"
set +e
conflict_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$alternate_public_key" \
    /bin/bash "$conflict_fixture/bootstrap-zzz-calculator-deploy.sh" 2>&1)"
conflict_status="$?"
set -e
[[ "$conflict_status" -ne 0 ]] || fail "bootstrap accepted a conflicting aggregate sudoers policy"
grep -Fq -- 'candidate sudoers policy conflicts with the aggregate configuration' <<<"$conflict_output" \
    || fail "sudoers conflict fixture did not reach staged aggregate validation"
assert_state_equal ".ssh sudoers conflict" "$conflict_ssh_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys sudoers conflict" "$conflict_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager sudoers conflict" "$conflict_manager_state" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker sudoers conflict" "$conflict_worker_state" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway sudoers conflict" "$conflict_gateway_state" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers conflict rollback" "$conflict_sudoers_state" "$(file_state "$SUDOERS_PATH")"
assert_state_equal "release root sudoers conflict" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock sudoers conflict" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"
sudo visudo --check >/dev/null || fail "sudoers is invalid after candidate rejection"
sudo rm -f -- "$conflict_file"

# Force a late failure with different valid sources and a different SSH key.
# Rollback must restore the original bytes, inodes, ownership and modes.
late_fixture="${test_root}/bootstrap-late-failure"
mkdir -p "$late_fixture"
cp -- "$BOOTSTRAP" "$late_fixture/bootstrap-zzz-calculator-deploy.sh"
cp -- "$MANAGER_SOURCE" "$late_fixture/zzz-calculator-deploy"
cp -- "$VALIDATION_WORKER_SOURCE" "$late_fixture/zzz-calculator-validation-worker"
cp -- "$SSH_GATEWAY_SOURCE" "$late_fixture/zzz-calculator-ssh-gateway"
cp -- "$SUDOERS_SOURCE" "$late_fixture/zzz-calculator-deploy.sudoers"
printf '\n# bootstrap late-failure fixture\n' >>"$late_fixture/zzz-calculator-deploy"
printf '\n# bootstrap late-failure fixture\n' >>"$late_fixture/zzz-calculator-validation-worker"
printf '\n# bootstrap late-failure fixture\n' >>"$late_fixture/zzz-calculator-ssh-gateway"
printf '\n# bootstrap late-failure fixture\n' >>"$late_fixture/zzz-calculator-deploy.sudoers"

late_ssh_state="$(path_state "$SSH_DIR")"
late_key_state="$(file_state "$AUTHORIZED_KEYS")"
late_manager_state="$(file_state "$INSTALLED_MANAGER")"
late_worker_state="$(file_state "$INSTALLED_VALIDATION_WORKER")"
late_gateway_state="$(file_state "$INSTALLED_SSH_GATEWAY")"
late_sudoers_state="$(file_state "$SUDOERS_PATH")"
set +e
late_output="$(sudo env ZZZDEPLOY_PUBLIC_KEY="$alternate_public_key" \
    ZZZDEPLOY_BOOTSTRAP_FAILPOINT=after-install \
    /bin/bash "$late_fixture/bootstrap-zzz-calculator-deploy.sh" 2>&1)"
late_status="$?"
set -e
[[ "$late_status" -ne 0 ]] || fail "injected late rerun failure unexpectedly succeeded"
grep -Fq -- 'injected failure after managed file installation' <<<"$late_output" \
    || fail "late rerun failpoint did not reach the managed-file boundary"
assert_state_equal ".ssh late rollback" "$late_ssh_state" "$(path_state "$SSH_DIR")"
assert_state_equal "authorized_keys late rollback" "$late_key_state" "$(file_state "$AUTHORIZED_KEYS")"
assert_state_equal "manager late rollback" "$late_manager_state" "$(file_state "$INSTALLED_MANAGER")"
assert_state_equal "worker late rollback" "$late_worker_state" "$(file_state "$INSTALLED_VALIDATION_WORKER")"
assert_state_equal "gateway late rollback" "$late_gateway_state" "$(file_state "$INSTALLED_SSH_GATEWAY")"
assert_state_equal "sudoers late rollback" "$late_sudoers_state" "$(file_state "$SUDOERS_PATH")"
assert_state_equal "release root late rollback" "$release_root_state_after_create" "$(path_state "$RELEASE_ROOT")"
assert_state_equal "/run/lock late rollback" "$lock_dir_state_after_create" "$(path_state "$LOCK_DIR")"
assert_state_equal "lock file late rollback" "$lock_file_state_after_create" "$(file_state "$LOCK_FILE")"
assert_active_files_match_sources "$expected_authorized_key"
assert_exact_deploy_user
assert_exact_validation_user
sudo visudo --check >/dev/null || fail "sudoers is invalid after late rollback"

printf 'production bootstrap integration tests passed\n'
