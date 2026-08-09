#!/bin/bash

set -Eeuo pipefail
umask 077
export LC_ALL=C
export PATH="/usr/sbin:/usr/bin:/sbin:/bin"
unset BASH_ENV ENV CDPATH GLOBIGNORE LD_PRELOAD LD_LIBRARY_PATH || true
IFS=$' \t\n'

readonly MANAGER_SOURCE="/opt/zzz-cicd-source/zzz-calculator-deploy"
readonly WORKER_SOURCE="/opt/zzz-cicd-source/zzz-calculator-validation-worker"
readonly DRIVER="/run/zzz-systemd239-sandbox-driver.$$"
readonly MOUNT_DRIVER="/run/zzz-systemd239-mount-driver.$$"
readonly MOUNT_FIXTURE="/run/zzz-systemd239-mountinfo.$$"
readonly MOUNT_AMBIGUOUS_FIXTURE="/run/zzz-systemd239-mountinfo-ambiguous.$$"

fail() {
    printf 'systemd 239 sandbox integration failure: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    local exit_code="$?"
    trap - EXIT HUP INT TERM
    systemctl stop 'zzz-calculator-validation-*' >/dev/null 2>&1 || true
    rm -f -- "$DRIVER" "$MOUNT_DRIVER" "$MOUNT_FIXTURE" "$MOUNT_AMBIGUOUS_FIXTURE"
    rm -rf --one-file-system -- /var/lib/zzz-calculator-deploy/validation/job.* 2>/dev/null || true
    chown root:root /var/lib/zzz-calculator-deploy/validation 2>/dev/null || true
    chmod 0750 /var/lib/zzz-calculator-deploy/validation 2>/dev/null || true
    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[[ "$(id -u)" -eq 0 ]] || fail "run inside the privileged test container as root"
[[ -f "$MANAGER_SOURCE" && -f "$WORKER_SOURCE" ]] || fail "test sources are missing"
[[ "$(/usr/bin/systemd-run --version | head -n 1)" == systemd\ 239* ]] \
    || fail "the compatibility container is not running systemd-run 239"
[[ "$(/usr/bin/systemctl show --property=Version --value)" == 239* ]] \
    || fail "PID 1 is not systemd 239"

getent group zzzvalidate >/dev/null || groupadd --system zzzvalidate
getent passwd zzzvalidate >/dev/null \
    || useradd --system --gid zzzvalidate --home-dir /nonexistent --shell /sbin/nologin zzzvalidate
passwd --lock zzzvalidate >/dev/null 2>&1 || true
getent group zzzcalc >/dev/null || groupadd --system zzzcalc
getent passwd zzzcalc >/dev/null \
    || useradd --system --gid zzzcalc --home-dir /nonexistent --shell /sbin/nologin zzzcalc
passwd --lock zzzcalc >/dev/null 2>&1 || true

install -d -o root -g root -m 0755 /var/lib/zzz-calculator-deploy
install -d -o root -g root -m 0750 /var/lib/zzz-calculator-deploy/validation
install -d -o root -g root -m 0755 /usr/local/libexec
install -o root -g root -m 0555 "$WORKER_SOURCE" /usr/local/libexec/zzz-calculator-validation-worker

# Linux may reuse a lower numeric mount ID for the top of a stack. Exercise
# the worker's parent-ID graph selection directly so an old hidden /run mount
# cannot be mistaken for the effective isolated tmpfs.
{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail' \
        'EFFECTIVE_MOUNT_ID=""' 'EFFECTIVE_MOUNT_FILESYSTEM=""' \
        'EFFECTIVE_MOUNT_OPTIONS=""' 'EFFECTIVE_MOUNT_SUPER_OPTIONS=""'
    sed -n '/^select_effective_mount_record() {$/,/^}$/p' "$WORKER_SOURCE"
    printf '%s\n' \
        'select_effective_mount_record /run "$1"' \
        '[[ "$EFFECTIVE_MOUNT_ID" == "42" && "$EFFECTIVE_MOUNT_FILESYSTEM" == "tmpfs" ]] || exit 1' \
        'if select_effective_mount_record /run "$2"; then exit 1; fi'
} >"$MOUNT_DRIVER"
cat >"$MOUNT_FIXTURE" <<'MOUNTINFO'
900 1 0:50 / /run rw,nosuid,nodev,noexec - tmpfs tmpfs rw,nosuid,nodev,noexec
42 900 0:51 / /run rw,nosuid,nodev,noexec - tmpfs tmpfs rw,nosuid,nodev,noexec
MOUNTINFO
cat >"$MOUNT_AMBIGUOUS_FIXTURE" <<'MOUNTINFO'
900 1 0:50 / /run rw,nosuid,nodev,noexec - tmpfs tmpfs rw,nosuid,nodev,noexec
42 900 0:51 / /run rw,nosuid,nodev,noexec - tmpfs tmpfs rw,nosuid,nodev,noexec
43 900 0:52 / /run rw,nosuid,nodev,noexec - tmpfs tmpfs rw,nosuid,nodev,noexec
MOUNTINFO
chmod 0700 "$MOUNT_DRIVER"
"$MOUNT_DRIVER" "$MOUNT_FIXTURE" "$MOUNT_AMBIGUOUS_FIXTURE" \
    || fail "worker did not select the unique top-most mount by parent-ID topology"

# Build a driver from the real manager functions. The production manager is
# never sourced directly because its final main call would execute an action.
sed '/^usage() {$/,$d' "$MANAGER_SOURCE" >"$DRIVER"
cat >>"$DRIVER" <<'DRIVER_HELPERS'
die() {
    printf 'fixture error: %s\n' "$*" >&2
    exit 1
}
log() {
    printf 'fixture log: %s\n' "$*" >&2
}
DRIVER_HELPERS
for function_name in \
    parse_systemd_major_version \
    select_validation_systemd_profile \
    detect_validation_systemd_profile \
    build_validation_systemd_properties \
    prepare_validation_job \
    prepare_validation_probe_root \
    remove_validation_probe_root \
    record_validation_unit_result \
    validation_cgroup_has_members \
    validation_unit_name_has_members \
    stop_validation_probe \
    run_validation_transient_unit \
    run_validation_sandbox_capability_probe; do
    sed -n "/^${function_name}() {$/,/^}$/p" "$MANAGER_SOURCE" >>"$DRIVER"
done
cat >>"$DRIVER" <<'DRIVER_TESTS'
array_has_value() {
    local expected="$1"
    local value
    for value in "${VALIDATION_SYSTEMD_PROPERTIES[@]}"; do
        [[ "$value" == "$expected" ]] && return 0
    done
    return 1
}

assert_profile() {
    local client="$1"
    local manager="$2"
    local expected_profile="$3"
    local expect_suid="$4"
    local expect_private_ipc="$5"

    select_validation_systemd_profile "$client" "$manager"
    build_validation_systemd_properties "$VALIDATION_JOB_DIR/matrix-source"
    [[ "$VALIDATION_SANDBOX_PROFILE" == "$expected_profile" ]] || exit 81
    [[ "$SYSTEMD_EFFECTIVE_VERSION" -eq $((client < manager ? client : manager)) ]] || exit 82
    array_has_value "RemoveIPC=yes" || exit 83
    array_has_value "SystemCallErrorNumber=EPERM" || exit 84
    array_has_value "InaccessiblePaths=-/opt/zzz_calculator -/var/lib/zzz-calculator -/srv/zzz-download-origin -/proc/sysvipc -/dev/mqueue" || exit 85
    array_has_value "SystemCallFilter=~ipc mq_getsetattr mq_notify mq_open mq_timedreceive mq_timedsend mq_unlink msgctl msgget msgrcv msgsnd semctl semget semop semtimedop shmat shmctl shmdt shmget" || exit 86
    array_has_value "SystemCallArchitectures=native" || exit 103
    ! array_has_value "SystemCallFilter=~@ipc" || exit 87
    if [[ "$expect_suid" == "1" ]]; then
        array_has_value "RestrictSUIDSGID=yes" || exit 88
    else
        ! array_has_value "RestrictSUIDSGID=yes" || exit 89
    fi
    if [[ "$expect_private_ipc" == "1" ]]; then
        array_has_value "PrivateIPC=yes" || exit 90
    else
        ! array_has_value "PrivateIPC=yes" || exit 91
    fi
}

[[ "$(parse_systemd_major_version 'systemd 239 (239-82.el8)')" == "239" ]] || exit 92
[[ "$(parse_systemd_major_version '248')" == "248" ]] || exit 93
if parse_systemd_major_version 'systemd unknown'; then exit 94; fi
if (select_validation_systemd_profile 238 239); then exit 95; fi
if (select_validation_systemd_profile invalid 239); then exit 96; fi

VALIDATION_UID="$(id -u "$VALIDATION_USER")"
VALIDATION_GID="$(id -g "$VALIDATION_USER")"
prepare_validation_job
install -d -o root -g root -m 0755 "$VALIDATION_JOB_DIR/matrix-source"
assert_profile 239 239 systemd-v239-seccomp 0 0
assert_profile 252 239 systemd-v239-seccomp 0 0
assert_profile 239 252 systemd-v239-seccomp 0 0
assert_profile 242 247 systemd-v239-seccomp+restrict-suidsgid 1 0
assert_profile 247 248 systemd-v239-seccomp+restrict-suidsgid 1 0
assert_profile 248 252 systemd-v239-seccomp+restrict-suidsgid+private-ipc 1 1

# Reset to the real client/PID1 pair, then create the actual transient unit.
detect_validation_systemd_profile
[[ "$SYSTEMD_RUN_VERSION" == "239" && "$SYSTEMD_MANAGER_VERSION" == "239" \
    && "$SYSTEMD_EFFECTIVE_VERSION" == "239" ]] || exit 97
run_validation_sandbox_capability_probe
[[ "$VALIDATION_SANDBOX_PROBE_RESULT" == "active/exited/success/0" ]] || exit 98
[[ -z "$VALIDATION_UNIT" && -z "$VALIDATION_PROBE_ROOT" ]] || exit 99
if systemctl list-units --all --no-legend 'zzz-calculator-validation-*' | grep -q .; then
    exit 100
fi

# An unknown property must fail before the marker command can execute. There is
# no retry with a reduced property set.
unknown_marker="/run/zzz-systemd239-unknown-property-marker"
rm -f -- "$unknown_marker"
if /usr/bin/systemd-run --quiet --unit "zzz-systemd239-unknown-$$" \
    --property ZzzDefinitelyUnsupported=yes -- /usr/bin/touch "$unknown_marker"; then
    exit 101
fi
[[ ! -e "$unknown_marker" ]] || exit 102

rm -rf --one-file-system -- "$VALIDATION_JOB_DIR"
VALIDATION_JOB_DIR=""
chown root:root "$VALIDATION_DIR"
chmod 0750 "$VALIDATION_DIR"
printf 'systemd 239 validation sandbox integration passed\n'
DRIVER_TESTS

chmod 0700 "$DRIVER"
/bin/bash --noprofile --norc "$DRIVER"
