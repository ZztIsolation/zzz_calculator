#!/bin/bash

set -Eeuo pipefail
umask 027
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GLOBIGNORE NODE_OPTIONS NODE_PATH NPM_CONFIG_PREFIX \
    LD_PRELOAD LD_LIBRARY_PATH TAR_OPTIONS GZIP BZIP BZIP2 XZ_OPT \
    AWKPATH AWKLIBPATH POSIXLY_CORRECT CURL_HOME || true
while read -r _ _ inherited_function; do
    unset -f "$inherited_function"
done < <(declare -F)
unalias -a 2>/dev/null || true
hash -r
IFS=$' \t\n'

readonly DEPLOY_USER="zzzdeploy"
readonly DEPLOY_GROUP="zzzdeploy"
readonly APP_USER="zzzcalc"
readonly APP_GROUP="zzzcalc"
readonly VALIDATION_USER="zzzvalidate"
readonly VALIDATION_GROUP="zzzvalidate"
readonly VALIDATION_HOME="/nonexistent"
readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly SSH_DIR="${DEPLOY_ROOT}/.ssh"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly HISTORY_DIR="${DEPLOY_ROOT}/history"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly INSTALL_PATH="/usr/local/sbin/zzz-calculator-deploy"
readonly VALIDATION_WORKER_DIR="/usr/local/libexec"
readonly VALIDATION_WORKER_PATH="${VALIDATION_WORKER_DIR}/zzz-calculator-validation-worker"
readonly SSH_GATEWAY_PATH="${VALIDATION_WORKER_DIR}/zzz-calculator-ssh-gateway"
readonly SUDOERS_PATH="/etc/sudoers.d/zzz-calculator-deploy"
readonly LOCK_DIR="/run/lock"
readonly LOCK_FILE="${LOCK_DIR}/zzz-calculator-deploy.lock"
readonly RELEASE_PARENT="/opt/zzz_calculator"
readonly RELEASE_ROOT="${RELEASE_PARENT}/releases"
readonly AUTHORIZED_KEY_PREFIX='command="/usr/local/libexec/zzz-calculator-ssh-gateway",restrict,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc '
readonly -a SHELL_STARTUP_FILES=(
    "${DEPLOY_ROOT}/.bashrc"
    "${DEPLOY_ROOT}/.bash_profile"
    "${DEPLOY_ROOT}/.bash_login"
    "${DEPLOY_ROOT}/.profile"
    "${DEPLOY_ROOT}/.bash_logout"
)

source_dir="$(cd -- "${BASH_SOURCE[0]%/*}" && pwd -P)"
readonly SOURCE_PATH="${source_dir}/zzz-calculator-deploy"
readonly VALIDATION_WORKER_SOURCE="${source_dir}/zzz-calculator-validation-worker"
readonly SSH_GATEWAY_SOURCE="${source_dir}/zzz-calculator-ssh-gateway"
readonly SUDOERS_SOURCE="${source_dir}/zzz-calculator-deploy.sudoers"
unset source_dir

transaction_root=""
key_validation_tmp=""
ssh_staged=""
ssh_backup_root=""
ssh_replacement_started="0"
ssh_had_original="0"
transaction_started="0"
transaction_committed="0"
rollback_failed="0"
deploy_user_created="0"
deploy_group_created="0"
validation_user_created="0"
validation_group_created="0"
lock_file_created="0"
lock_file_inode=""
lock_fd_open="0"
lock_acquired="0"
release_parent_metadata_changed="0"
release_parent_original_device=""
release_parent_original_inode=""
release_parent_original_uid=""
release_parent_original_gid=""
release_parent_original_mode=""
declare -a replaced_targets=()
declare -a replaced_backups=()
declare -a replaced_had_original=()
declare -a created_directories=()

fail() {
    printf 'bootstrap error: %s\n' "$*" >&2
    exit 1
}

password_status_is_locked() {
    case "${1:-}" in
        L|LK) return 0 ;;
        *) return 1 ;;
    esac
}

rollback_notice() {
    printf 'bootstrap rollback error: %s\n' "$*" >&2
    rollback_failed="1"
}

ignore_termination_signals() {
    trap '' HUP INT TERM
}

restore_termination_signals() {
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
}

inject_account_signal_if_requested() {
    if [[ "$failpoint" == "signal-during-account-setup" ]]; then
        kill -TERM "$$"
    fi
}

path_exists() {
    [[ -e "$1" || -L "$1" ]]
}

require_plain_directory_if_present() {
    local path="$1"
    if path_exists "$path"; then
        [[ -d "$path" && ! -L "$path" ]] \
            || fail "managed directory must be a real directory: ${path}"
    fi
}

require_regular_file_if_present() {
    local path="$1"
    if path_exists "$path"; then
        [[ -f "$path" && ! -L "$path" ]] \
            || fail "managed file must be a regular non-link file: ${path}"
    fi
}

require_exact_directory_if_present() {
    local path="$1"
    local expected_owner="$2"
    local expected_group="$3"
    local expected_mode="$4"
    require_plain_directory_if_present "$path"
    if path_exists "$path"; then
        [[ "$(stat -c '%U:%G:%a' -- "$path")" == "${expected_owner}:${expected_group}:${expected_mode}" ]] \
            || fail "existing directory has unexpected ownership or mode: ${path}"
    fi
}

require_release_parent_if_present() {
    local metadata
    require_plain_directory_if_present "$RELEASE_PARENT"
    if path_exists "$RELEASE_PARENT"; then
        metadata="$(stat -c '%U:%G:%a' -- "$RELEASE_PARENT")"
        case "$metadata" in
            root:root:755|"${APP_USER}:${APP_GROUP}:755") ;;
            *) fail "existing release parent has unsupported ownership or mode: ${RELEASE_PARENT}" ;;
        esac
    fi
}

require_safe_root_directory() {
    local path="$1"
    local mode
    [[ -d "$path" && ! -L "$path" && "$(stat -c '%U:%G' -- "$path")" == "root:root" ]] \
        || fail "required root directory is missing, linked or not root-owned: ${path}"
    mode="$(stat -c '%a' -- "$path")"
    [[ "$mode" =~ ^[0-7]{3,4}$ ]] || fail "directory has invalid mode: ${path}"
    (( (8#${mode} & 0002) == 0 )) || fail "directory is world-writable: ${path}"
    [[ -w "$path" && -x "$path" ]] || fail "directory is not usable by root: ${path}"
}

account_is_present() {
    getent passwd "$1" >/dev/null 2>&1
}

group_is_present() {
    getent group "$1" >/dev/null 2>&1
}

verify_existing_account_or_absence() {
    local user="$1"
    local group="$2"
    local expected_home="$3"
    local expected_shell="$4"
    local user_present="0"
    local group_present="0"
    local expected_gid passwd_record account_name account_password account_uid account_gid
    local account_gecos account_home account_shell group_record group_members lock_status

    account_is_present "$user" && user_present="1"
    group_is_present "$group" && group_present="1"
    [[ "$user_present" == "$group_present" ]] \
        || fail "refusing to take over a partial existing account/group pair: ${user}/${group}"
    [[ "$user_present" == "1" ]] || return 0

    [[ "$(getent passwd "$user" | wc -l)" == "1" ]] \
        || fail "account lookup is ambiguous: ${user}"
    [[ "$(getent group "$group" | wc -l)" == "1" ]] \
        || fail "group lookup is ambiguous: ${group}"
    expected_gid="$(getent group "$group" | awk -F: 'NR == 1 { print $3 }')"
    [[ "$expected_gid" =~ ^[1-9][0-9]*$ ]] \
        || fail "dedicated group must not use gid 0: ${group}"
    passwd_record="$(getent passwd "$user")"
    IFS=: read -r account_name account_password account_uid account_gid account_gecos account_home account_shell <<<"$passwd_record"
    [[ "$account_name" == "$user" && "$account_uid" =~ ^[1-9][0-9]*$ ]] \
        || fail "dedicated account must not use uid 0: ${user}"
    [[ "$account_gid" == "$expected_gid" && "$(id -g "$user")" == "$expected_gid" \
        && "$(id -G "$user")" == "$expected_gid" ]] \
        || fail "existing account has an unexpected primary or supplementary group: ${user}"
    [[ "$account_home" == "$expected_home" && "$account_shell" == "$expected_shell" ]] \
        || fail "existing account has an unexpected home or shell: ${user}"
    group_record="$(getent group "$group")"
    group_members="${group_record##*:}"
    [[ -z "$group_members" ]] \
        || fail "dedicated group contains explicit members and will not be taken over: ${group}"
    lock_status="$(passwd --status "$user" | awk 'NR == 1 { print $2 }')"
    password_status_is_locked "$lock_status" \
        || fail "existing account password is not locked: ${user}"
}

verify_account_contract() {
    verify_existing_account_or_absence "$@"
    account_is_present "$1" || fail "account was not created: $1"
}

create_exact_directory() {
    local path="$1"
    local owner="$2"
    local group="$3"
    local mode="$4"
    if path_exists "$path"; then
        [[ -d "$path" && ! -L "$path" \
            && "$(stat -c '%U:%G:%a' -- "$path")" == "${owner}:${group}:${mode}" ]] \
            || fail "existing directory does not match its managed contract: ${path}"
        return 0
    fi
    created_directories+=("$path")
    install -d -o "$owner" -g "$group" -m "$mode" "$path"
}

prepare_release_parent() {
    local metadata
    if ! path_exists "$RELEASE_PARENT"; then
        create_exact_directory "$RELEASE_PARENT" root root 755
        return 0
    fi

    require_release_parent_if_present
    metadata="$(stat -c '%U:%G:%a' -- "$RELEASE_PARENT")"
    [[ "$metadata" == "${APP_USER}:${APP_GROUP}:755" ]] || return 0

    release_parent_original_device="$(stat -c '%d' -- "$RELEASE_PARENT")"
    release_parent_original_inode="$(stat -c '%i' -- "$RELEASE_PARENT")"
    release_parent_original_uid="$(stat -c '%u' -- "$RELEASE_PARENT")"
    release_parent_original_gid="$(stat -c '%g' -- "$RELEASE_PARENT")"
    release_parent_original_mode="$(stat -c '%a' -- "$RELEASE_PARENT")"

    ignore_termination_signals
    if chown --no-dereference root:root -- "$RELEASE_PARENT"; then
        release_parent_metadata_changed="1"
        restore_termination_signals
    else
        restore_termination_signals
        fail "failed to harden release parent ownership: ${RELEASE_PARENT}"
    fi

    [[ -d "$RELEASE_PARENT" && ! -L "$RELEASE_PARENT" \
        && "$(stat -c '%d:%i:%U:%G:%a' -- "$RELEASE_PARENT")" \
            == "${release_parent_original_device}:${release_parent_original_inode}:root:root:755" ]] \
        || fail "release parent changed unexpectedly while hardening ownership: ${RELEASE_PARENT}"
}

file_matches_contract() {
    local source="$1"
    local target="$2"
    local mode="$3"
    [[ -f "$target" && ! -L "$target" \
        && "$(stat -c '%U:%G:%a:%h' -- "$target")" == "root:root:${mode}:1" ]] \
        || return 1
    cmp -s -- "$source" "$target"
}

replace_managed_file() {
    local source="$1"
    local target="$2"
    local mode="$3"
    local backup=""
    local had_original="0"

    if file_matches_contract "$source" "$target" "$mode"; then
        return 0
    fi
    if path_exists "$target"; then
        [[ -f "$target" && ! -L "$target" ]] \
            || fail "refusing to replace a non-regular managed file: ${target}"
        backup="$(mktemp "${target}.backup.XXXXXXXX")"
        rm -f -- "$backup"
        had_original="1"
    fi
    replaced_targets+=("$target")
    replaced_backups+=("$backup")
    replaced_had_original+=("$had_original")
    if [[ "$had_original" == "1" ]]; then
        mv -T -- "$target" "$backup"
    fi
    install -o root -g root -m "$mode" "$source" "$target"
    file_matches_contract "$source" "$target" "$mode" \
        || fail "installed file failed its ownership, mode or content check: ${target}"
}

ssh_state_matches_contract() {
    local expected_line="$1"
    local only_entry
    [[ -d "$SSH_DIR" && ! -L "$SSH_DIR" \
        && "$(stat -c '%U:%G:%a' -- "$SSH_DIR")" == "root:${DEPLOY_GROUP}:750" ]] \
        || return 1
    [[ -f "${SSH_DIR}/authorized_keys" && ! -L "${SSH_DIR}/authorized_keys" \
        && "$(stat -c '%U:%G:%a:%h' -- "${SSH_DIR}/authorized_keys")" == "root:${DEPLOY_GROUP}:640:1" ]] \
        || return 1
    [[ "$(cat -- "${SSH_DIR}/authorized_keys")" == "$expected_line" ]] || return 1
    only_entry="$(find "$SSH_DIR" -mindepth 1 -maxdepth 1 -printf '%f\n')"
    [[ "$only_entry" == "authorized_keys" ]]
}

install_ssh_directory() {
    local expected_line="$1"
    if ssh_state_matches_contract "$expected_line"; then
        return 0
    fi

    ssh_staged="$(mktemp -d "${DEPLOY_ROOT}/.ssh.bootstrap.XXXXXXXX")"
    chown root:"$DEPLOY_GROUP" "$ssh_staged"
    chmod 0750 "$ssh_staged"
    printf '%s\n' "$expected_line" >"${ssh_staged}/authorized_keys"
    chown root:"$DEPLOY_GROUP" "${ssh_staged}/authorized_keys"
    chmod 0640 "${ssh_staged}/authorized_keys"

    if path_exists "$SSH_DIR"; then
        ssh_backup_root="$(mktemp -d "${DEPLOY_ROOT}/.ssh.backup.XXXXXXXX")"
        chmod 0700 "$ssh_backup_root"
        ssh_had_original="1"
    fi
    ssh_replacement_started="1"
    if [[ "$failpoint" == "signal-before-ssh-move" ]]; then
        kill -TERM "$$"
        fail "TERM did not interrupt the SSH replacement failpoint"
    fi
    if [[ "$ssh_had_original" == "1" ]]; then
        mv -T -- "$SSH_DIR" "${ssh_backup_root}/original"
    fi
    mv -T -- "$ssh_staged" "$SSH_DIR"
    ssh_staged=""
    ssh_state_matches_contract "$expected_line" \
        || fail "installed SSH directory failed its ownership, mode or content check"
}

remove_temporary_tree() {
    local path="${1:-}"
    [[ -n "$path" ]] || return 0
    case "$path" in
        /run/zzz-calculator-bootstrap.*|"$DEPLOY_ROOT"/.ssh.bootstrap.*|"$DEPLOY_ROOT"/.ssh.backup.*)
            rm -rf --one-file-system -- "$path"
            ;;
        *)
            return 1
            ;;
    esac
}

rollback_ssh_directory() {
    local restore_failed="0"
    [[ "$ssh_replacement_started" == "1" ]] || return 0
    if [[ "$ssh_had_original" == "1" ]]; then
        if [[ -d "${ssh_backup_root}/original" && ! -L "${ssh_backup_root}/original" ]]; then
            if path_exists "$SSH_DIR"; then
                rm -rf --one-file-system -- "$SSH_DIR" \
                    || { rollback_notice "could not remove candidate SSH directory"; restore_failed="1"; }
            fi
            mv -T -- "${ssh_backup_root}/original" "$SSH_DIR" \
                || { rollback_notice "could not restore the previous SSH directory from ${ssh_backup_root}"; restore_failed="1"; }
        elif path_exists "$SSH_DIR"; then
            # The signal or failure happened before the original directory was moved.
            :
        else
            rollback_notice "previous SSH directory backup is missing at ${ssh_backup_root}"
            restore_failed="1"
        fi
    elif path_exists "$SSH_DIR"; then
        rm -rf --one-file-system -- "$SSH_DIR" \
            || { rollback_notice "could not remove candidate SSH directory"; restore_failed="1"; }
    fi
    ssh_replacement_started="0"
    if [[ "$restore_failed" == "0" && -n "$ssh_backup_root" ]]; then
        remove_temporary_tree "$ssh_backup_root" >/dev/null 2>&1 || true
        ssh_backup_root=""
    elif [[ "$restore_failed" == "1" && -n "$ssh_backup_root" ]]; then
        printf 'bootstrap rollback error: SSH backup retained at %s\n' "$ssh_backup_root" >&2
    fi
}

rollback_managed_files() {
    local index target backup had_original
    for ((index=${#replaced_targets[@]} - 1; index >= 0; index--)); do
        target="${replaced_targets[$index]}"
        backup="${replaced_backups[$index]}"
        had_original="${replaced_had_original[$index]}"
        if [[ "$had_original" == "1" ]]; then
            if [[ -f "$backup" && ! -L "$backup" ]]; then
                rm -f -- "$target" || rollback_notice "could not remove candidate file ${target}"
                mv -T -- "$backup" "$target" \
                    || rollback_notice "could not restore previous file ${target} from ${backup}"
            elif [[ -f "$target" && ! -L "$target" ]]; then
                # The failure happened before the original target was moved.
                :
            else
                rollback_notice "previous file backup is missing for ${target}"
            fi
        else
            rm -f -- "$target" || rollback_notice "could not remove candidate file ${target}"
        fi
    done
    replaced_targets=()
    replaced_backups=()
    replaced_had_original=()
}

remove_created_directories() {
    local index path
    for ((index=${#created_directories[@]} - 1; index >= 0; index--)); do
        path="${created_directories[$index]}"
        if path_exists "$path"; then
            rmdir -- "$path" 2>/dev/null \
                || rollback_notice "created directory is not empty and was retained: ${path}"
        fi
    done
    created_directories=()
}

rollback_release_parent_metadata() {
    [[ "$release_parent_metadata_changed" == "1" ]] || return 0
    if [[ -d "$RELEASE_PARENT" && ! -L "$RELEASE_PARENT" \
        && "$(stat -c '%d:%i' -- "$RELEASE_PARENT" 2>/dev/null)" \
            == "${release_parent_original_device}:${release_parent_original_inode}" ]]; then
        chown --no-dereference "${release_parent_original_uid}:${release_parent_original_gid}" -- "$RELEASE_PARENT" \
            || rollback_notice "could not restore release parent ownership"
        chmod "$release_parent_original_mode" -- "$RELEASE_PARENT" \
            || rollback_notice "could not restore release parent mode"
        [[ "$(stat -c '%u:%g:%a' -- "$RELEASE_PARENT" 2>/dev/null)" \
            == "${release_parent_original_uid}:${release_parent_original_gid}:${release_parent_original_mode}" ]] \
            || rollback_notice "release parent metadata did not return to its original state"
    else
        rollback_notice "release parent inode changed; refusing to restore metadata on a different path"
    fi
    release_parent_metadata_changed="0"
}

remove_created_accounts() {
    if [[ "$validation_user_created" == "1" ]] && account_is_present "$VALIDATION_USER"; then
        userdel "$VALIDATION_USER" >/dev/null 2>&1 \
            || rollback_notice "could not remove created account ${VALIDATION_USER}"
    fi
    if [[ "$deploy_user_created" == "1" ]] && account_is_present "$DEPLOY_USER"; then
        userdel "$DEPLOY_USER" >/dev/null 2>&1 \
            || rollback_notice "could not remove created account ${DEPLOY_USER}"
    fi
    if [[ "$validation_group_created" == "1" ]] && group_is_present "$VALIDATION_GROUP"; then
        groupdel "$VALIDATION_GROUP" >/dev/null 2>&1 \
            || rollback_notice "could not remove created group ${VALIDATION_GROUP}"
    fi
    if [[ "$deploy_group_created" == "1" ]] && group_is_present "$DEPLOY_GROUP"; then
        groupdel "$DEPLOY_GROUP" >/dev/null 2>&1 \
            || rollback_notice "could not remove created group ${DEPLOY_GROUP}"
    fi
}

release_transaction_lock() {
    if [[ "$lock_fd_open" == "1" ]]; then
        flock -u 9 >/dev/null 2>&1 || true
        exec 9>&-
        lock_fd_open="0"
    fi
    if [[ "$transaction_committed" == "0" && "$lock_acquired" == "1" \
        && "$lock_file_created" == "1" \
        && -n "$lock_file_inode" && -f "$LOCK_FILE" && ! -L "$LOCK_FILE" \
        && "$(stat -c '%i' -- "$LOCK_FILE" 2>/dev/null)" == "$lock_file_inode" ]]; then
        rm -f -- "$LOCK_FILE" || rollback_notice "could not remove the lock file created by this run"
    fi
}

discard_transaction_backups() {
    local backup
    if [[ "$ssh_replacement_started" == "1" && "$ssh_had_original" == "1" ]]; then
        if remove_temporary_tree "$ssh_backup_root"; then
            ssh_backup_root=""
        else
            printf 'bootstrap warning: committed SSH backup retained at %s\n' "$ssh_backup_root" >&2
        fi
    fi
    ssh_replacement_started="0"
    for backup in "${replaced_backups[@]}"; do
        [[ -n "$backup" ]] || continue
        rm -f -- "$backup" \
            || printf 'bootstrap warning: committed file backup retained at %s\n' "$backup" >&2
    done
    replaced_targets=()
    replaced_backups=()
    replaced_had_original=()
}

on_exit() {
    local status="$1"
    trap - EXIT HUP INT TERM
    set +e
    if [[ "$transaction_started" == "1" && "$transaction_committed" == "0" ]]; then
        rollback_ssh_directory
        if [[ "$rollback_failed" == "0" ]]; then
            rollback_managed_files
        else
            rollback_notice "managed files retained because the previous SSH directory could not be restored safely"
        fi
        visudo --check >/dev/null 2>&1 \
            || rollback_notice "aggregate sudoers validation failed after rollback"
        if [[ "$ssh_replacement_started" == "0" && -n "$ssh_backup_root" ]]; then
            remove_temporary_tree "$ssh_backup_root" >/dev/null 2>&1 || true
            ssh_backup_root=""
        fi
        remove_temporary_tree "$ssh_staged" >/dev/null 2>&1 || true
        remove_created_directories
        rollback_release_parent_metadata
        remove_created_accounts
    fi
    [[ -n "$key_validation_tmp" ]] && rm -f -- "$key_validation_tmp" >/dev/null 2>&1
    [[ -n "$transaction_root" ]] && remove_temporary_tree "$transaction_root" >/dev/null 2>&1
    release_transaction_lock
    if [[ "$rollback_failed" == "1" ]]; then
        printf 'bootstrap error: rollback was incomplete; inspect the errors above before retrying\n' >&2
        status=1
    fi
    exit "$status"
}

trap 'on_exit $?' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[[ "$EUID" -eq 0 ]] || fail "run this one-time initializer as root"

for required_command in \
    awk base64 basename cat chmod chown cmp cp curl cut date df diff env find \
    flock free getent grep groupadd groupdel head id install journalctl jq ln \
    dirname mkdir mktemp mv nginx passwd readlink realpath rm rmdir runuser scp sed seq \
    sha256sum sleep sort ssh-keygen stat sudo systemctl systemd-run tail tar \
    timeout tr uniq useradd userdel usermod visudo wc; do
    command -v "$required_command" >/dev/null || fail "${required_command} is required"
done
for required_absolute_command in \
    /bin/bash /usr/bin/awk /usr/bin/base64 /usr/bin/chmod /usr/bin/cmp \
    /usr/bin/cp /usr/bin/df /usr/bin/env /usr/bin/find /usr/bin/flock \
    /usr/bin/journalctl /usr/bin/mkdir /usr/bin/node /usr/bin/rm /usr/bin/scp \
    /usr/bin/stat /usr/bin/sudo /usr/bin/systemd-run /usr/bin/tail /usr/bin/test \
    /usr/bin/timeout /usr/bin/tr /usr/sbin/nologin; do
    [[ -x "$required_absolute_command" ]] || fail "${required_absolute_command} is required"
done
unset required_command required_absolute_command

public_key="${ZZZDEPLOY_PUBLIC_KEY:-}"
[[ -n "$public_key" ]] || fail "set ZZZDEPLOY_PUBLIC_KEY for every bootstrap run"
[[ "$public_key" != *$'\r'* && "$public_key" != *$'\n'* ]] \
    || fail "ZZZDEPLOY_PUBLIC_KEY must contain exactly one public key"
[[ "$public_key" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)[[:space:]]+[^[:space:]]+([[:space:]].*)?$ ]] \
    || fail "ZZZDEPLOY_PUBLIC_KEY is not an OpenSSH public key"
key_validation_tmp="$(mktemp)"
printf '%s\n' "$public_key" >"$key_validation_tmp"
chmod 0600 "$key_validation_tmp"
ssh-keygen -l -f "$key_validation_tmp" >/dev/null 2>&1 \
    || fail "ZZZDEPLOY_PUBLIC_KEY is not a valid OpenSSH public key"
rm -f -- "$key_validation_tmp"
key_validation_tmp=""

for source_path in "$SOURCE_PATH" "$VALIDATION_WORKER_SOURCE" "$SSH_GATEWAY_SOURCE" "$SUDOERS_SOURCE"; do
    [[ -f "$source_path" && ! -L "$source_path" ]] \
        || fail "bootstrap source is missing or linked: ${source_path}"
done
unset source_path

tar_version="$(tar --version 2>/dev/null)" || fail "cannot inspect tar version"
[[ "$tar_version" == tar\ \(GNU\ tar\)* ]] || fail "GNU tar is required"
cp --help 2>/dev/null | grep -q -- '--reflink' \
    || fail "GNU cp with --reflink support is required"
unset tar_version

verify_existing_account_or_absence "$DEPLOY_USER" "$DEPLOY_GROUP" "$DEPLOY_ROOT" /bin/bash
verify_existing_account_or_absence "$VALIDATION_USER" "$VALIDATION_GROUP" "$VALIDATION_HOME" /usr/sbin/nologin
[[ ! -e "$VALIDATION_HOME" && ! -L "$VALIDATION_HOME" ]] \
    || fail "validation account home path must not exist"

require_safe_root_directory "$LOCK_DIR"
if path_exists "$LOCK_FILE"; then
    [[ -f "$LOCK_FILE" && ! -L "$LOCK_FILE" \
        && "$(stat -c '%U:%G:%h' -- "$LOCK_FILE")" == "root:root:1" ]] \
        || fail "deployment lock must be a single-link root-owned regular file"
fi
require_safe_root_directory /etc
require_safe_root_directory /etc/sudoers.d
require_safe_root_directory /usr/local/sbin
require_regular_file_if_present "$INSTALL_PATH"
require_regular_file_if_present "$VALIDATION_WORKER_PATH"
require_regular_file_if_present "$SSH_GATEWAY_PATH"
require_regular_file_if_present "$SUDOERS_PATH"
[[ -f /etc/sudoers && ! -L /etc/sudoers ]] \
    || fail "/etc/sudoers must be a regular non-link file"

if account_is_present "$DEPLOY_USER"; then
    require_exact_directory_if_present "$DEPLOY_ROOT" root root 755
    require_exact_directory_if_present "$INCOMING_DIR" root "$DEPLOY_GROUP" 770
    require_exact_directory_if_present "$HISTORY_DIR" root root 750
    require_exact_directory_if_present "$VALIDATION_DIR" root root 750
    require_exact_directory_if_present "$PROCESSING_DIR" root root 700
    require_plain_directory_if_present "$SSH_DIR"
    for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
        require_regular_file_if_present "$shell_startup_path"
    done
    unset shell_startup_path
else
    for unexpected_path in "$DEPLOY_ROOT" "$INSTALL_PATH" "$VALIDATION_WORKER_PATH" "$SSH_GATEWAY_PATH" "$SUDOERS_PATH"; do
        ! path_exists "$unexpected_path" \
            || fail "deployment account is absent but managed state already exists: ${unexpected_path}"
    done
    unset unexpected_path
fi

require_release_parent_if_present
require_exact_directory_if_present "$RELEASE_ROOT" root root 755
require_exact_directory_if_present "$VALIDATION_WORKER_DIR" root root 755

visudo --check >/dev/null || fail "existing aggregate sudoers configuration is invalid"

failpoint="${ZZZDEPLOY_BOOTSTRAP_FAILPOINT:-}"
case "$failpoint" in
    ""|after-install|signal-before-ssh-move|signal-during-account-setup) ;;
    *) fail "unsupported bootstrap failpoint" ;;
esac

transaction_root="$(mktemp -d /run/zzz-calculator-bootstrap.XXXXXXXX)"
chmod 0700 "$transaction_root"

manager_snapshot="${transaction_root}/zzz-calculator-deploy"
worker_snapshot="${transaction_root}/zzz-calculator-validation-worker"
gateway_snapshot="${transaction_root}/zzz-calculator-ssh-gateway"
sudoers_snapshot="${transaction_root}/zzz-calculator-deploy.sudoers"
empty_shell_startup_snapshot="${transaction_root}/empty-shell-startup"
install -o root -g root -m 0600 "$SOURCE_PATH" "$manager_snapshot"
install -o root -g root -m 0600 "$VALIDATION_WORKER_SOURCE" "$worker_snapshot"
install -o root -g root -m 0600 "$SSH_GATEWAY_SOURCE" "$gateway_snapshot"
install -o root -g root -m 0600 "$SUDOERS_SOURCE" "$sudoers_snapshot"
install -o root -g root -m 0600 /dev/null "$empty_shell_startup_snapshot"
/bin/bash -n "$manager_snapshot" || fail "deployment program has invalid shell syntax"
/bin/bash -n "$worker_snapshot" || fail "validation worker has invalid shell syntax"
/bin/bash -n "$gateway_snapshot" || fail "SSH gateway has invalid shell syntax"
visudo --check --file "$sudoers_snapshot" >/dev/null \
    || fail "sudoers template validation failed"

aggregate_root="${transaction_root}/sudoers-aggregate"
aggregate_dir="${aggregate_root}/sudoers.d"
aggregate_main="${aggregate_root}/sudoers"
install -d -o root -g root -m 0700 "$aggregate_root" "$aggregate_dir"
cp -a -- /etc/sudoers.d/. "$aggregate_dir/"
rm -f -- "${aggregate_dir}/${SUDOERS_PATH##*/}"
install -o root -g root -m 0440 "$sudoers_snapshot" "${aggregate_dir}/${SUDOERS_PATH##*/}"
includedir_count="$(awk '
    /^[[:space:]]*([@#]includedir)[[:space:]]+\/etc\/sudoers[.]d[[:space:]]*$/ { count++ }
    END { print count + 0 }
' /etc/sudoers)"
[[ "$includedir_count" == "1" ]] \
    || fail "/etc/sudoers must contain exactly one standard /etc/sudoers.d include"
awk -v replacement="@includedir ${aggregate_dir}" '
    /^[[:space:]]*([@#]includedir)[[:space:]]+\/etc\/sudoers[.]d[[:space:]]*$/ { print replacement; next }
    { print }
' /etc/sudoers >"$aggregate_main"
chmod 0440 "$aggregate_main"
visudo --check --file "$aggregate_main" >/dev/null \
    || fail "candidate sudoers policy conflicts with the aggregate configuration"

lock_file_was_present="0"
path_exists "$LOCK_FILE" && lock_file_was_present="1"
exec 9>>"$LOCK_FILE"
lock_fd_open="1"
if [[ "$lock_file_was_present" == "0" ]]; then
    lock_file_created="1"
    lock_file_inode="$(stat -Lc '%i' -- "/proc/$$/fd/9")"
fi
[[ "$(stat -Lc '%U:%G:%h' -- "/proc/$$/fd/9")" == "root:root:1" ]] \
    || fail "deployment lock descriptor is not a safe root-owned regular file"
flock -n 9 || fail "another deployment or bootstrap operation is running"
lock_acquired="1"
unset lock_file_was_present
transaction_started="1"

if ! group_is_present "$DEPLOY_GROUP"; then
    ignore_termination_signals
    if groupadd --system "$DEPLOY_GROUP"; then
        inject_account_signal_if_requested
        deploy_group_created="1"
        restore_termination_signals
    else
        group_is_present "$DEPLOY_GROUP" && deploy_group_created="1"
        restore_termination_signals
        fail "failed to create deployment group"
    fi
fi
if ! account_is_present "$DEPLOY_USER"; then
    ignore_termination_signals
    if useradd --system --gid "$DEPLOY_GROUP" --home-dir "$DEPLOY_ROOT" \
        --no-create-home --shell /bin/bash "$DEPLOY_USER"; then
        inject_account_signal_if_requested
        deploy_user_created="1"
        if passwd --lock "$DEPLOY_USER" >/dev/null 2>&1; then
            restore_termination_signals
        else
            restore_termination_signals
            fail "failed to lock the deployment account password"
        fi
    else
        account_is_present "$DEPLOY_USER" && deploy_user_created="1"
        restore_termination_signals
        fail "failed to create deployment account"
    fi
fi
if ! group_is_present "$VALIDATION_GROUP"; then
    ignore_termination_signals
    if groupadd --system "$VALIDATION_GROUP"; then
        inject_account_signal_if_requested
        validation_group_created="1"
        restore_termination_signals
    else
        group_is_present "$VALIDATION_GROUP" && validation_group_created="1"
        restore_termination_signals
        fail "failed to create validation group"
    fi
fi
if ! account_is_present "$VALIDATION_USER"; then
    ignore_termination_signals
    if useradd --system --gid "$VALIDATION_GROUP" --home-dir "$VALIDATION_HOME" \
        --no-create-home --shell /usr/sbin/nologin "$VALIDATION_USER"; then
        inject_account_signal_if_requested
        validation_user_created="1"
        if passwd --lock "$VALIDATION_USER" >/dev/null 2>&1; then
            restore_termination_signals
        else
            restore_termination_signals
            fail "failed to lock the validation account password"
        fi
    else
        account_is_present "$VALIDATION_USER" && validation_user_created="1"
        restore_termination_signals
        fail "failed to create validation account"
    fi
fi
verify_account_contract "$DEPLOY_USER" "$DEPLOY_GROUP" "$DEPLOY_ROOT" /bin/bash
verify_account_contract "$VALIDATION_USER" "$VALIDATION_GROUP" "$VALIDATION_HOME" /usr/sbin/nologin

create_exact_directory "$DEPLOY_ROOT" root root 755
create_exact_directory "$INCOMING_DIR" root "$DEPLOY_GROUP" 770
create_exact_directory "$HISTORY_DIR" root root 750
create_exact_directory "$VALIDATION_DIR" root root 750
create_exact_directory "$PROCESSING_DIR" root root 700
prepare_release_parent
create_exact_directory "$RELEASE_ROOT" root root 755
create_exact_directory "$VALIDATION_WORKER_DIR" root root 755

for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    replace_managed_file "$empty_shell_startup_snapshot" "$shell_startup_path" 644
done
unset shell_startup_path

replace_managed_file "$manager_snapshot" "$INSTALL_PATH" 755
replace_managed_file "$worker_snapshot" "$VALIDATION_WORKER_PATH" 555
replace_managed_file "$gateway_snapshot" "$SSH_GATEWAY_PATH" 555
replace_managed_file "$sudoers_snapshot" "$SUDOERS_PATH" 440

expected_authorized_key="${AUTHORIZED_KEY_PREFIX}${public_key}"
install_ssh_directory "$expected_authorized_key"
unset public_key ZZZDEPLOY_PUBLIC_KEY

if [[ "$failpoint" == "after-install" ]]; then
    fail "injected failure after managed file installation"
fi

verify_account_contract "$DEPLOY_USER" "$DEPLOY_GROUP" "$DEPLOY_ROOT" /bin/bash
verify_account_contract "$VALIDATION_USER" "$VALIDATION_GROUP" "$VALIDATION_HOME" /usr/sbin/nologin
require_exact_directory_if_present "$RELEASE_PARENT" root root 755
ssh_state_matches_contract "$expected_authorized_key" \
    || fail "final SSH directory verification failed"
for shell_startup_path in "${SHELL_STARTUP_FILES[@]}"; do
    file_matches_contract "$empty_shell_startup_snapshot" "$shell_startup_path" 644 \
        || fail "final shell startup file verification failed: ${shell_startup_path}"
done
unset shell_startup_path
file_matches_contract "$manager_snapshot" "$INSTALL_PATH" 755 \
    || fail "final deployment program verification failed"
file_matches_contract "$worker_snapshot" "$VALIDATION_WORKER_PATH" 555 \
    || fail "final validation worker verification failed"
file_matches_contract "$gateway_snapshot" "$SSH_GATEWAY_PATH" 555 \
    || fail "final SSH gateway verification failed"
file_matches_contract "$sudoers_snapshot" "$SUDOERS_PATH" 440 \
    || fail "final sudoers verification failed"
visudo --check >/dev/null || fail "installed aggregate sudoers configuration is invalid"
runuser -u "$DEPLOY_USER" -- test -x "$SSH_GATEWAY_PATH" \
    || fail "deployment account cannot execute the SSH gateway"
runuser -u "$VALIDATION_USER" -- test -x "$VALIDATION_WORKER_PATH" \
    || fail "validation account cannot execute the validation worker"
runuser -u "$VALIDATION_USER" -- test ! -w "$VALIDATION_WORKER_PATH" \
    || fail "validation account can write the validation worker"

trap '' HUP INT TERM
transaction_committed="1"
discard_transaction_backups
if remove_temporary_tree "$transaction_root"; then
    transaction_root=""
else
    printf 'bootstrap warning: committed transaction directory retained at %s\n' "$transaction_root" >&2
fi
release_transaction_lock
trap - EXIT HUP INT TERM

printf 'initialized %s; current release and service were not modified\n' "$DEPLOY_USER"
