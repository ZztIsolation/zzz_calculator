#!/bin/bash

set -Eeuo pipefail
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GLOBIGNORE NODE_OPTIONS NODE_PATH NPM_CONFIG_PREFIX \
    LD_PRELOAD LD_LIBRARY_PATH TAR_OPTIONS GZIP BZIP BZIP2 XZ_OPT || true
IFS=$' \t\n'

readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly HISTORY_DIR="${DEPLOY_ROOT}/history"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly RELEASE_ROOT="/opt/zzz_calculator/releases"
readonly CURRENT_LINK="/opt/zzz_calculator/current"
readonly LOCK_FILE="/run/lock/zzz-calculator-deploy.lock"
readonly MANAGER="/usr/local/sbin/zzz-calculator-deploy"
readonly SERVICE_NAME="zzz-calculator.service"
readonly HELPER_MANIFEST="/srv/zzz-download-origin/downloads/zzz-scanner/helper-manifest.json"
readonly SCANNER_MANIFEST="/srv/zzz-download-origin/downloads/zzz-scanner/manifest.json"
readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_MANAGER="${REPO_ROOT}/deploy/production/zzz-calculator-deploy"
readonly COMMIT="$(printf '%s\n' "$$-$(date -u +%s%N)" | sha256sum | cut -c1-40)"
readonly ARCHIVE_NAME="zzz-calculator-server-${COMMIT:0:12}.tar.gz"
readonly EVIDENCE_NAME="zzz-calculator-server-${COMMIT:0:12}.evidence.json"

fail() {
    printf 'deploy manager integration failure: %s\n' "$*" >&2
    exit 1
}

history_count() {
    sudo find "$HISTORY_DIR" -mindepth 1 -maxdepth 1 -type f -name '*.json' -printf '.\n' \
        | wc -l | tr -d '[:space:]'
}

history_list() {
    sudo find "$HISTORY_DIR" -mindepth 1 -maxdepth 1 -type f -name '*.json' -printf '%f\n' \
        | LC_ALL=C sort
}

tree_digest() {
    local root="$1"
    sudo tar --sort=name --mtime='@0' --format=gnu -cf - -C "$root" . 2>/dev/null \
        | sha256sum | awk '{print $1}'
}

path_fingerprint() {
    local path="$1"
    if sudo test -e "$path" || sudo test -L "$path"; then
        {
            sudo stat -c '%F|%U:%G:%a|%s|%Y' -- "$path"
            if sudo test -f "$path" && ! sudo test -L "$path"; then
                sudo sha256sum -- "$path" | awk '{print $1}'
            elif sudo test -L "$path"; then
                sudo readlink -- "$path"
            fi
        }
    else
        printf 'absent\n'
    fi
}

service_snapshot() {
    systemctl show "$SERVICE_NAME" \
        --property ActiveState \
        --property MainPID \
        --property NRestarts \
        --property ExecMainStartTimestampMonotonic \
        2>/dev/null || true
}

expected_evidence_count=0
run_manager_failure() {
    local label="$1"
    local expected_error="$2"
    shift 2
    local action="$1"
    local stdout_path="${test_root}/${label}.stdout.json"
    local stderr_path="${test_root}/${label}.stderr.log"
    local before_count after_count exit_code

    before_count="$(history_count)"
    set +e
    sudo -u zzzdeploy sudo -n "$MANAGER" "$@" >"$stdout_path" 2>"$stderr_path"
    exit_code="$?"
    set -e

    [[ "$exit_code" -ne 0 ]] || fail "${label} unexpectedly succeeded"
    if ! grep -F -- "$expected_error" "$stderr_path" >/dev/null; then
        printf '%s\n' "--- ${label} stderr ---" >&2
        cat -- "$stderr_path" >&2
        printf '%s\n' "--- ${label} stdout ---" >&2
        cat -- "$stdout_path" >&2
        fail "${label} did not report the expected rejection"
    fi
    jq -e --arg action "$action" --arg error "$expected_error" '
        .status == "failed"
        and .action == $action
        and (.error | contains($error))
        and .switchState == "not-switched"
    ' "$stdout_path" >/dev/null || fail "${label} did not emit valid failed evidence"

    after_count="$(history_count)"
    [[ "$after_count" -eq $((before_count + 1)) ]] \
        || fail "${label} did not persist exactly one evidence record"
    expected_evidence_count=$((expected_evidence_count + 1))
}

[[ "$(id -u)" -ne 0 ]] || fail "run this integration test as the regular CI user"
for dependency in cmp jq sudo tar sha256sum stat find flock systemctl; do
    command -v "$dependency" >/dev/null || fail "${dependency} is required"
done
getent passwd zzzdeploy >/dev/null || fail "bootstrap integration test did not create zzzdeploy"
[[ -x "$MANAGER" ]] || fail "deployment manager is not installed"
cmp -s -- "$REPO_MANAGER" "$MANAGER" \
    || fail "installed deployment manager differs from the checked-out source"
[[ -d "$INCOMING_DIR" && -d "$PROCESSING_DIR" && -d "$HISTORY_DIR" && -d "$VALIDATION_DIR" ]] \
    || fail "deployment control directories are not initialized"
[[ -d "$RELEASE_ROOT" && ! -L "$RELEASE_ROOT" ]] || fail "release root is not initialized"

# This test is deliberately a rejection-only test. Refuse to run where a real
# production target exists so that no test case can reach validation or switch
# logic, even if a future preflight becomes less strict.
[[ ! -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]] \
    || fail "refusing to run rejection tests when a current release exists"

test_root="$(mktemp -d)"
# The fixture files are copied by the restricted deployment user below. Keep
# the disposable parent traversable while all generated files remain read-only.
chmod 0755 "$test_root"
validation_access_root="${test_root}/validation-access"
production_access_root="${test_root}/production-access"
legacy_access_root="${test_root}/legacy-access"
legacy_snapshot_root="${test_root}/legacy-snapshot"
release_assert_driver="${test_root}/assert-immutable-release.sh"
atomic_switch_driver="${test_root}/atomic-switch.sh"
evidence_schema_driver="${test_root}/evidence-schema.sh"
health_gate_driver="${test_root}/health-gate.sh"
validation_stop_driver="${test_root}/validation-stop.sh"
driver_deploy_root="${test_root}/driver-state"
driver_release_root="$production_access_root"
driver_processing_root="$legacy_snapshot_root"
driver_current_state_file="${test_root}/driver-current"
lock_launcher_pid=""
lock_holder_pid=""
remote_archive="${INCOMING_DIR}/${ARCHIVE_NAME}.part"
remote_evidence="${INCOMING_DIR}/${EVIDENCE_NAME}.part"
cleanup() {
    if [[ -n "$lock_holder_pid" ]]; then
        sudo kill "$lock_holder_pid" >/dev/null 2>&1 || true
    fi
    if [[ -n "$lock_launcher_pid" ]]; then
        wait "$lock_launcher_pid" >/dev/null 2>&1 || true
    fi
    sudo rm -f -- "$remote_archive" "$remote_evidence" >/dev/null 2>&1 || true
    if [[ -n "${validation_access_root:-}" && "$validation_access_root" == "$test_root/"* ]]; then
        sudo rm -rf --one-file-system -- "$validation_access_root" >/dev/null 2>&1 || true
    fi
    if [[ -n "${production_access_root:-}" && "$production_access_root" == "$test_root/"* ]]; then
        sudo rm -rf --one-file-system -- "$production_access_root" >/dev/null 2>&1 || true
    fi
    if [[ -n "${legacy_access_root:-}" && "$legacy_access_root" == "$test_root/"* ]]; then
        sudo rm -rf --one-file-system -- "$legacy_access_root" >/dev/null 2>&1 || true
    fi
    if [[ -n "${legacy_snapshot_root:-}" && "$legacy_snapshot_root" == "$test_root/"* ]]; then
        sudo rm -rf --one-file-system -- "$legacy_snapshot_root" >/dev/null 2>&1 || true
    fi
    if [[ -n "${driver_deploy_root:-}" && "$driver_deploy_root" == "$test_root/"* ]]; then
        sudo rm -rf --one-file-system -- "$driver_deploy_root" >/dev/null 2>&1 || true
    fi
    sudo rm -f -- "${driver_current_state_file:-/nonexistent}" >/dev/null 2>&1 || true
    if [[ -n "$test_root" && "$test_root" == /tmp/* ]]; then
        rm -rf -- "$test_root"
    fi
}
trap cleanup EXIT

run_release_driver() {
    sudo env \
        TEST_DEPLOY_ROOT="$driver_deploy_root" \
        TEST_RELEASE_ROOT="$driver_release_root" \
        TEST_PROCESSING_DIR="$driver_processing_root" \
        TEST_CURRENT_STATE_FILE="$driver_current_state_file" \
        /bin/bash --noprofile --norc "$release_assert_driver" "$@"
}

# Exercise the installed evidence renderer and jq schema without touching any
# production path. Each fixture runs in a fresh process so no global evidence
# field can leak between action types.
{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail'
    sed -n '/^ACTION="${1:-}"$/,/^STARTED_AT=/p' "$MANAGER"
    printf '%s\n' 'readonly HISTORY_DIR="${TEST_OUTPUT_DIR:?}/history"' \
        'die() { printf "evidence fixture error: %s\\n" "$*" >&2; exit 1; }'
    sed -n '/^json_field() {$/,/^}$/p' "$MANAGER"
    sed -n '/^emit_evidence_json() {$/,/^}$/p' "$MANAGER"
    sed -n '/^validate_evidence_json() {$/,/^}$/p' "$MANAGER"
    sed -n '/^preflight_evidence_storage() {$/,/^}$/p' "$MANAGER"
    printf '%s\n' \
        'readonly LEGACY_COMMIT="2e7f874bc034871f03b5738f48d7d05685b36ea9"' \
        'readonly CANDIDATE_COMMIT="1111111111111111111111111111111111111111"' \
        'readonly TARGET_COMMIT="2222222222222222222222222222222222222222"' \
        'readonly HASH_A="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' \
        'readonly HASH_B="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' \
        'readonly HASH_C="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"' \
        'readonly HASH_D="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"' \
        'readonly VALIDATION_RESULTS=$'"'"'current:active/exited/success/0\ncandidate:active/exited/success/0\nrollback:active/exited/success/0\ncandidate:active/exited/success/0\n'"'"'' \
        'mkdir -p -- "$HISTORY_DIR"' \
        'set_common_success() {' \
        '  STATUS="success"; ERROR_MESSAGE=""; STARTED_AT="2026-08-09T00:00:00Z"' \
        '  CURRENT_RELEASE_POLICY="legacy-writable"' \
        '  CURRENT_BEFORE="/opt/zzz_calculator/releases/git-2e7f874bc034"; CURRENT_AFTER="$CURRENT_BEFORE"' \
        '  CURRENT_COMMIT_BEFORE="$LEGACY_COMMIT"; CURRENT_COMMIT_AFTER="$LEGACY_COMMIT"' \
        '  CURRENT_TREE_SHA256_BEFORE="$HASH_A"; CURRENT_TREE_SHA256_AFTER="$HASH_A"' \
        '  CURRENT_PORTABLE_SHA256_BEFORE="$HASH_A"; CURRENT_PORTABLE_SHA256_AFTER="$HASH_A"' \
        '  CURRENT_STATIC_SHA256_BEFORE="$HASH_A"; CURRENT_STATIC_SHA256_AFTER="$HASH_A"' \
        '  CURRENT_TREE_METADATA_SHA256_BEFORE="$HASH_B"; CURRENT_TREE_METADATA_SHA256_AFTER="$HASH_B"' \
        '  CURRENT_TREE_ENTRY_COUNT="705"; CURRENT_TREE_FILE_COUNT="657"; CURRENT_TREE_BYTES="58357431"' \
        '  STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="rollback-2e7f874bc034"' \
        '  STATE_PREVIOUS_EXISTED_AFTER="1"; STATE_PREVIOUS_AFTER="$STATE_PREVIOUS_BEFORE"' \
        '  STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="git-2e7f874bc034"' \
        '  STATE_LAST_EXISTED_AFTER="1"; STATE_LAST_AFTER="$STATE_LAST_BEFORE"' \
        '  LEGACY_MIGRATION_MARKER_EXISTED="0"; LEGACY_MIGRATION_MARKER_VALUE=""' \
        '  LEGACY_MIGRATION_MARKER_EXISTED_AFTER="0"; LEGACY_MIGRATION_MARKER_VALUE_AFTER=""' \
        '  SERVICE_BEFORE="active"; SERVICE_AFTER="active"; PID_BEFORE="101"; PID_AFTER="101"' \
        '  RESTARTS_BEFORE="0"; RESTARTS_AFTER="0"; NGINX_STATUS="valid"; NGINX_STATUS_AFTER="valid"' \
        '  SYSTEMD_RUN_VERSION="239"; SYSTEMD_MANAGER_VERSION="239"; SYSTEMD_EFFECTIVE_VERSION="239"' \
        '  VALIDATION_SANDBOX_PROFILE="systemd-v239-seccomp"; VALIDATION_SANDBOX_PROBE_RESULT="not-run"' \
        '  HELPER_MANIFEST_SHA256_BEFORE="$HASH_C"; HELPER_MANIFEST_SHA256_AFTER="$HASH_C"' \
        '  SCANNER_MANIFEST_SHA256_BEFORE="$HASH_D"; SCANNER_MANIFEST_SHA256_AFTER="$HASH_D"' \
        '  DISK_STATUS="fixture"; DISK_STATUS_AFTER="fixture"; MEMORY_STATUS="fixture"; MEMORY_STATUS_AFTER="fixture"' \
        '}' \
        'set_artifact_metadata() {' \
        '  ARTIFACT_BASENAME="zzz-calculator-server-111111111111.tar.gz"; ARTIFACT_SIZE_BYTES="1024"' \
        '  ARTIFACT_SHA256="$HASH_A"; DEPLOYED_COMMIT="$CANDIDATE_COMMIT"; RELEASE_BASENAME="git-111111111111"' \
        '  ARCHIVE_ENTRY_COUNT="700"; ARCHIVE_EXPANDED_BYTES="58000000"' \
        '  DISK_REQUIRED_BYTES="900000000"; DISK_AVAILABLE_BYTES="30000000000"' \
        '  DISK_REQUIRED_INODES="50000"; DISK_AVAILABLE_INODES="2000000"' \
        '  RELEASE_TREE_SHA256="$HASH_B"; PAGES_TREE_SHA256="$HASH_C"' \
        '}' \
        'set_managed_candidate_baseline() {' \
        '  CURRENT_RELEASE_POLICY="managed-immutable"' \
        '  CURRENT_BEFORE="/opt/zzz_calculator/releases/git-111111111111"; CURRENT_AFTER="$CURRENT_BEFORE"' \
        '  CURRENT_COMMIT_BEFORE="$CANDIDATE_COMMIT"; CURRENT_COMMIT_AFTER="$CANDIDATE_COMMIT"' \
        '  STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="rollback-111111111111"' \
        '  STATE_PREVIOUS_EXISTED_AFTER="1"; STATE_PREVIOUS_AFTER="$STATE_PREVIOUS_BEFORE"' \
        '  STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="git-111111111111"' \
        '  STATE_LAST_EXISTED_AFTER="1"; STATE_LAST_AFTER="$STATE_LAST_BEFORE"' \
        '  LEGACY_MIGRATION_MARKER_EXISTED="1"; LEGACY_MIGRATION_MARKER_VALUE="$LEGACY_COMMIT"' \
        '  LEGACY_MIGRATION_MARKER_EXISTED_AFTER="1"; LEGACY_MIGRATION_MARKER_VALUE_AFTER="$LEGACY_COMMIT"' \
        '}' \
        'fixture="$1"; reported_switch="not-switched"; mutation=""' \
        'if [[ "$fixture" == "probe" ]]; then' \
        '  ACTION="audit"; STATUS="started"; ERROR_MESSAGE=""; preflight_evidence_storage' \
        '  [[ "$STATUS" == "started" && -z "$ERROR_MESSAGE" ]] || die "preflight did not restore caller state"' \
        '  [[ -z "$(find "$HISTORY_DIR" -mindepth 1 -print -quit)" ]] || die "preflight left a history file"' \
        '  STATUS="failed"; ERROR_MESSAGE=""' \
        '  invalid="$TEST_OUTPUT_DIR/probe-invalid.json"; emit_evidence_json "not-switched" "2026-08-09T00:00:01Z" >"$invalid"' \
        '  if validate_evidence_json "$invalid"; then die "failed evidence without an error was accepted"; fi' \
        '  exit 0' \
        'fi' \
        'set_common_success' \
        'case "$fixture" in' \
        '  audit)' \
        '    ACTION="audit"; mutation='"'"'.stateLastAfter = "git-deadbee"'"'"' ;;' \
        '  dry-run)' \
        '    ACTION="dry-run"; set_artifact_metadata; ROLLBACK_BASENAME="validation-rollback-2e7f874bc034"' \
        '    VALIDATION_SEQUENCE="current,candidate,rollback,candidate"; VALIDATION_UNIT_RESULTS="$VALIDATION_RESULTS"; VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"' \
        '    VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.validationSequence = "candidate"'"'"' ;;' \
        '  dry-run-effective-version)' \
        '    ACTION="dry-run"; set_artifact_metadata; ROLLBACK_BASENAME="validation-rollback-2e7f874bc034"' \
        '    VALIDATION_SEQUENCE="current,candidate,rollback,candidate"; VALIDATION_UNIT_RESULTS="$VALIDATION_RESULTS"; VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"' \
        '    VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.systemdEffectiveVersion = "240"'"'"' ;;' \
        '  dry-run-profile)' \
        '    ACTION="dry-run"; set_artifact_metadata; ROLLBACK_BASENAME="validation-rollback-2e7f874bc034"' \
        '    VALIDATION_SEQUENCE="current,candidate,rollback,candidate"; VALIDATION_UNIT_RESULTS="$VALIDATION_RESULTS"; VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"' \
        '    VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.validationSandboxProfile = "systemd-v239-seccomp+restrict-suidsgid"'"'"' ;;' \
        '  dry-run-probe)' \
        '    ACTION="dry-run"; set_artifact_metadata; ROLLBACK_BASENAME="validation-rollback-2e7f874bc034"' \
        '    VALIDATION_SEQUENCE="current,candidate,rollback,candidate"; VALIDATION_UNIT_RESULTS="$VALIDATION_RESULTS"; VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"' \
        '    VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.validationSandboxProbe = "failed/failed/failed/69"'"'"' ;;' \
        '  deploy)' \
        '    ACTION="deploy"; set_artifact_metadata; ROLLBACK_BASENAME="rollback-111111111111"; PREVIOUS_BASENAME="git-2e7f874bc034"' \
        '    CURRENT_AFTER="/opt/zzz_calculator/releases/git-111111111111"; CURRENT_COMMIT_AFTER="$CANDIDATE_COMMIT"' \
        '    CURRENT_TREE_SHA256_AFTER="$HASH_B"; CURRENT_PORTABLE_SHA256_AFTER="$HASH_B"; CURRENT_STATIC_SHA256_AFTER="$HASH_B"; CURRENT_TREE_METADATA_SHA256_AFTER="$HASH_C"' \
        '    STATE_PREVIOUS_AFTER="$ROLLBACK_BASENAME"; STATE_LAST_AFTER="$RELEASE_BASENAME"' \
        '    LEGACY_MIGRATION_MARKER_EXISTED_AFTER="1"; LEGACY_MIGRATION_MARKER_VALUE_AFTER="$LEGACY_COMMIT"' \
        '    VALIDATION_SEQUENCE="current,candidate,rollback,candidate"; VALIDATION_UNIT_RESULTS="$VALIDATION_RESULTS"; VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"; VALIDATION_CLEANUP_RESULT="clean"; reported_switch="committed"' \
        '    mutation='"'"'.statePreviousAfter = "rollback-deadbee"'"'"' ;;' \
        '  deploy-noop)' \
        '    ACTION="deploy"; set_managed_candidate_baseline; set_artifact_metadata; ROLLBACK_BASENAME="rollback-111111111111"; PREVIOUS_BASENAME="git-111111111111"' \
        '    VALIDATION_SANDBOX_PROBE_RESULT="active/exited/success/0"; VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.currentAfter = "/opt/zzz_calculator/releases/git-deadbee"'"'"' ;;' \
        '  rollback)' \
        '    ACTION="rollback"; set_managed_candidate_baseline; DEPLOYED_COMMIT="$TARGET_COMMIT"' \
        '    ROLLBACK_BASENAME="rollback-111111111111"; PREVIOUS_BASENAME="git-111111111111"' \
        '    CURRENT_AFTER="/opt/zzz_calculator/releases/$ROLLBACK_BASENAME"; CURRENT_COMMIT_AFTER="$TARGET_COMMIT"' \
        '    CURRENT_TREE_SHA256_AFTER="$HASH_B"; CURRENT_PORTABLE_SHA256_AFTER="$HASH_B"; CURRENT_STATIC_SHA256_AFTER="$HASH_B"; CURRENT_TREE_METADATA_SHA256_AFTER="$HASH_C"' \
        '    STATE_PREVIOUS_AFTER="$PREVIOUS_BASENAME"; STATE_LAST_AFTER="$ROLLBACK_BASENAME"; reported_switch="committed"' \
        '    mutation='"'"'.stateLastAfter = "rollback-deadbee"'"'"' ;;' \
        '  rollback-noop)' \
        '    ACTION="rollback"; CURRENT_RELEASE_POLICY="managed-immutable"; DEPLOYED_COMMIT="$TARGET_COMMIT"' \
        '    ROLLBACK_BASENAME="rollback-111111111111"; PREVIOUS_BASENAME="$ROLLBACK_BASENAME"' \
        '    CURRENT_BEFORE="/opt/zzz_calculator/releases/$ROLLBACK_BASENAME"; CURRENT_AFTER="$CURRENT_BEFORE"' \
        '    CURRENT_COMMIT_BEFORE="$TARGET_COMMIT"; CURRENT_COMMIT_AFTER="$TARGET_COMMIT"' \
        '    STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="$ROLLBACK_BASENAME"; STATE_PREVIOUS_EXISTED_AFTER="1"; STATE_PREVIOUS_AFTER="$ROLLBACK_BASENAME"' \
        '    STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="$ROLLBACK_BASENAME"; STATE_LAST_EXISTED_AFTER="1"; STATE_LAST_AFTER="$ROLLBACK_BASENAME"' \
        '    LEGACY_MIGRATION_MARKER_EXISTED="1"; LEGACY_MIGRATION_MARKER_VALUE="$LEGACY_COMMIT"; LEGACY_MIGRATION_MARKER_EXISTED_AFTER="1"; LEGACY_MIGRATION_MARKER_VALUE_AFTER="$LEGACY_COMMIT"' \
        '    mutation='"'"'.currentCommitAfter = "3333333333333333333333333333333333333333"'"'"' ;;' \
        '  failed-invalid)' \
        '    ACTION="deploy"; STATUS="failed"; ERROR_MESSAGE="fixture failure"; STATE_LAST_EXISTED_AFTER="invalid"; STATE_LAST_AFTER=""; reported_switch="rolled-back"' \
        '    mutation='"'"'.error = ""'"'"' ;;' \
        '  failed-systemd)' \
        '    ACTION="dry-run"; STATUS="failed"; ERROR_MESSAGE="fixture systemd failure"; VALIDATION_SANDBOX_PROBE_RESULT="failed/failed/exit-code/68"; VALIDATION_CLEANUP_RESULT="clean"' \
        '    mutation='"'"'.validationSandboxProbe = "failed/failed/exit-code\n/68"'"'"' ;;' \
        '  failed-pending-cleanup)' \
        '    ACTION="dry-run"; STATUS="failed"; ERROR_MESSAGE="fixture cleanup failure"; VALIDATION_SANDBOX_PROBE_RESULT="failed/failed/exit-code/68"; VALIDATION_CLEANUP_RESULT="failed"' \
        '    mutation='"'"'.validationCleanup = "pending"'"'"' ;;' \
        '  *) die "unknown evidence fixture $fixture" ;;' \
        'esac' \
        'valid="$TEST_OUTPUT_DIR/$fixture.valid.json"; invalid="$TEST_OUTPUT_DIR/$fixture.invalid.json"' \
        'emit_evidence_json "$reported_switch" "2026-08-09T00:00:01Z" >"$valid"' \
        'validate_evidence_json "$valid" || die "$fixture valid evidence was rejected"' \
        'jq "$mutation" "$valid" >"$invalid"' \
        'if validate_evidence_json "$invalid"; then die "$fixture tampered evidence was accepted"; fi'
} >"$evidence_schema_driver"
bash -n "$evidence_schema_driver" || fail "extracted evidence schema driver is not valid Bash"
for evidence_fixture in \
    probe audit dry-run dry-run-effective-version dry-run-profile dry-run-probe \
    deploy deploy-noop rollback rollback-noop failed-invalid failed-systemd failed-pending-cleanup; do
    evidence_output="${test_root}/evidence-${evidence_fixture}"
    mkdir -p -- "$evidence_output"
    TEST_OUTPUT_DIR="$evidence_output" /bin/bash --noprofile --norc \
        "$evidence_schema_driver" "$evidence_fixture" \
        || fail "${evidence_fixture} evidence schema fixture failed"
done

{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail' \
        'readonly SERVICE_NAME="fixture.service"' 'readonly HEALTH_URL="http://127.0.0.1/health"' \
        'readonly HEALTH_STARTUP_GRACE_SECONDS="5"' 'readonly HEALTH_STABILITY_SECONDS="3"' \
        'HEALTH_GATE_PID=""' 'readonly COUNTER_FILE="${TEST_COUNTER_FILE:?}"' \
        'readonly FAILURE_COUNT="${TEST_FAILURE_COUNT:?}"' \
        'readonly FAIL_AT_COUNT="${TEST_FAIL_AT_COUNT:-0}"' \
        'readonly PID_CHANGE_AFTER_COUNT="${TEST_PID_CHANGE_AFTER_COUNT:-0}"' \
        'sleep() { SECONDS="$((SECONDS + ${1:-0}))"; }' \
        'systemctl() { printf "active\\n"; }' \
        'service_property() { count="$(<"$COUNTER_FILE")"; if (( PID_CHANGE_AFTER_COUNT > 0 && count >= PID_CHANGE_AFTER_COUNT )); then printf "1"; else printf "%s" "$$"; fi; }' \
        'curl() { count="$(<"$COUNTER_FILE")"; count="$((count + 1))"; printf "%s" "$count" >"$COUNTER_FILE"; if (( count <= FAILURE_COUNT || (FAIL_AT_COUNT > 0 && count == FAIL_AT_COUNT) )); then return 1; fi; printf '"'"'{"ok":true}'"'"'; }' \
        'jq() { cat >/dev/null; }'
    sed -n '/^healthy_runtime_pid() {$/,/^}$/p' "$MANAGER"
    sed -n '/^health_gate() {$/,/^}$/p' "$MANAGER"
    printf '%s\n' \
        'if [[ "$1" == "recover" ]]; then' \
        '  health_gate || { printf "delayed startup was rejected\\n" >&2; exit 1; }' \
        '  [[ "$HEALTH_GATE_PID" == "$$" ]] || { printf "stable PID was not retained\\n" >&2; exit 1; }' \
        '  [[ "$(<"$COUNTER_FILE")" == "$((FAILURE_COUNT + 1 + HEALTH_STABILITY_SECONDS))" ]] || { printf "unexpected health sample count\\n" >&2; exit 1; }' \
        'elif [[ "$1" == "fail" ]]; then' \
        '  if health_gate; then printf "permanently unhealthy service was accepted\\n" >&2; exit 1; fi' \
        '  [[ -z "$HEALTH_GATE_PID" ]] || { printf "failed health gate retained a PID\\n" >&2; exit 1; }' \
        '  [[ "$(<"$COUNTER_FILE")" == "$HEALTH_STARTUP_GRACE_SECONDS" ]] || { printf "startup deadline was not bounded\\n" >&2; exit 1; }' \
        'elif [[ "$1" == "stable-fail" ]]; then' \
        '  if health_gate; then printf "unstable health window was accepted\\n" >&2; exit 1; fi' \
        '  [[ -z "$HEALTH_GATE_PID" && "$(<"$COUNTER_FILE")" == "$FAIL_AT_COUNT" ]] || exit 1' \
        'elif [[ "$1" == "pid-change" ]]; then' \
        '  [[ "$$" != "1" ]] || exit 77' \
        '  if health_gate; then printf "PID change during stability was accepted\\n" >&2; exit 1; fi' \
        '  [[ -z "$HEALTH_GATE_PID" && "$(<"$COUNTER_FILE")" == "2" ]] || exit 1' \
        'else exit 64; fi'
} >"$health_gate_driver"
bash -n "$health_gate_driver" || fail "extracted health gate driver is not valid Bash"
printf '0' >"${test_root}/health-recover.count"
TEST_COUNTER_FILE="${test_root}/health-recover.count" TEST_FAILURE_COUNT="2" \
    /bin/bash --noprofile --norc "$health_gate_driver" recover \
    || fail "health gate did not allow bounded startup grace before the stability window"
printf '0' >"${test_root}/health-fail.count"
TEST_COUNTER_FILE="${test_root}/health-fail.count" TEST_FAILURE_COUNT="20" \
    /bin/bash --noprofile --norc "$health_gate_driver" fail \
    || fail "health gate did not enforce its startup deadline"
printf '0' >"${test_root}/health-stable-fail.count"
TEST_COUNTER_FILE="${test_root}/health-stable-fail.count" TEST_FAILURE_COUNT="0" TEST_FAIL_AT_COUNT="3" \
    /bin/bash --noprofile --norc "$health_gate_driver" stable-fail \
    || fail "health gate accepted a failure during the stability window"
printf '0' >"${test_root}/health-pid-change.count"
TEST_COUNTER_FILE="${test_root}/health-pid-change.count" TEST_FAILURE_COUNT="0" TEST_PID_CHANGE_AFTER_COUNT="1" \
    /bin/bash --noprofile --norc "$health_gate_driver" pid-change \
    || fail "health gate accepted a PID change during the stability window"

# Exercise transient-unit cleanup with systemd query failures and unit garbage
# collection races. All process-group checks still run against the real /proc;
# the synthetic unit name is deliberately unique to this fixture.
{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail' \
        'readonly MODE="${1:?}"' \
        'readonly STATE_ROOT="${TEST_STATE_ROOT:?}"' \
        'readonly UNIT_NAME="zzz-calculator-validation-999999-1.service"' \
        'VALIDATION_UNIT="$UNIT_NAME"' \
        'systemctl() {' \
        '  local command="${1:-}" property="" argument expect_property="0"' \
        '  shift || true' \
        '  if [[ "$command" == "show" ]]; then' \
        '    for argument in "$@"; do' \
        '      if [[ "$expect_property" == "1" ]]; then property="$argument"; expect_property="0"; continue; fi' \
        '      case "$argument" in --property) expect_property="1" ;; --property=*) property="${argument#--property=}" ;; esac' \
        '    done' \
        '    case "$property" in' \
        '      LoadState)' \
        '        [[ "$MODE" != "query-error" ]] || return 1' \
        '        if [[ "$MODE" == "absent" ]]; then printf "not-found\n"' \
        '        elif [[ ! -e "$STATE_ROOT/stopped" ]]; then printf "loaded\n"' \
        '        elif [[ "$MODE" == "gc-after-stop" || -e "$STATE_ROOT/reset" ]]; then printf "not-found\n"' \
        '        else printf "loaded\n"; fi ;;' \
        '      ControlGroup) printf "/system.slice/%s\n" "$UNIT_NAME" ;;' \
        '      ActiveState) printf "inactive\n" ;;' \
        '      *) return 1 ;;' \
        '    esac' \
        '  elif [[ "$command" == "stop" ]]; then : >"$STATE_ROOT/stopped"' \
        '  elif [[ "$command" == "reset-failed" ]]; then' \
        '    : >"$STATE_ROOT/reset"; [[ "$MODE" != "reset-race" ]]' \
        '  else return 1; fi' \
        '}'
    sed -n '/^validation_cgroup_has_members() {$/,/^}$/p' "$MANAGER"
    sed -n '/^validation_unit_name_has_members() {$/,/^}$/p' "$MANAGER"
    sed -n '/^stop_validation_probe() {$/,/^}$/p' "$MANAGER"
    printf '%s\n' \
        'status=0; stop_validation_probe || status="$?"' \
        'printf "%s|%s|%s|%s\n" "$status" "${VALIDATION_UNIT:-}" "$([[ -e "$STATE_ROOT/stopped" ]] && printf 1 || printf 0)" "$([[ -e "$STATE_ROOT/reset" ]] && printf 1 || printf 0)"'
} >"$validation_stop_driver"
bash -n "$validation_stop_driver" || fail "extracted validation stop driver is not valid Bash"
for stop_fixture in query-error absent gc-after-stop reset-race clean; do
    stop_state="${test_root}/validation-stop-${stop_fixture}"
    mkdir -p -- "$stop_state"
    stop_result="$(TEST_STATE_ROOT="$stop_state" /bin/bash --noprofile --norc \
        "$validation_stop_driver" "$stop_fixture")"
    case "$stop_fixture" in
        query-error)
            [[ "$stop_result" == "1|zzz-calculator-validation-999999-1.service|0|0" ]] \
                || fail "a failed systemd query was treated as a clean validation stop"
            ;;
        absent)
            [[ "$stop_result" == "0||0|0" ]] \
                || fail "an already unloaded validation unit was not accepted safely"
            ;;
        gc-after-stop)
            [[ "$stop_result" == "0||1|0" ]] \
                || fail "post-stop transient-unit garbage collection was misclassified"
            ;;
        reset-race|clean)
            [[ "$stop_result" == "0||1|1" ]] \
                || fail "validation cleanup did not handle ${stop_fixture} safely"
            ;;
    esac
done

# A private validation parent deliberately blocks the production application
# account. Root-owned 0755/0644 release contents remain readable by the
# dedicated validator without making the parent world-traversable.
sudo install -d -o root -g zzzvalidate -m 0750 -- "$validation_access_root"
sudo install -d -o root -g root -m 0755 -- \
    "$validation_access_root/release" \
    "$validation_access_root/release/backend" \
    "$validation_access_root/release/dist" \
    "$validation_access_root/release/dist/pages"
printf '%s\n' "$COMMIT" | sudo tee "$validation_access_root/release/.deployed-commit" >/dev/null
printf 'console.log("validation access fixture")\n' \
    | sudo tee "$validation_access_root/release/backend/server.js" >/dev/null
printf '<!doctype html><title>validation access fixture</title>\n' \
    | sudo tee "$validation_access_root/release/dist/pages/index.html" >/dev/null
sudo chown -R root:root "$validation_access_root/release"
sudo find "$validation_access_root/release" -type d -exec chmod 0755 {} +
sudo find "$validation_access_root/release" -type f -exec chmod 0644 {} +
sudo -u zzzvalidate test -r "$validation_access_root/release/.deployed-commit" \
    || fail "validation account cannot read an immutable private release"
if sudo -u zzzcalc test -r "$validation_access_root/release/.deployed-commit"; then
    fail "application account can read an isolated validation release"
fi

# Execute the exact installed manager functions so this test covers both the
# root-opened working-directory behavior and every immutable-tree rejection.
{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail' \
        'readonly APP_USER="zzzcalc"' 'readonly APP_GROUP="zzzcalc"' \
        'readonly VALIDATION_USER="zzzvalidate"' \
        'readonly VALIDATION_GROUP="zzzvalidate"' \
        'readonly DEPLOY_ROOT="${TEST_DEPLOY_ROOT:?}"' \
        'readonly RELEASE_ROOT="${TEST_RELEASE_ROOT:?}"' \
        'readonly PROCESSING_DIR="${TEST_PROCESSING_DIR:?}"' \
        'readonly CURRENT_LINK="${TEST_CURRENT_LINK:-/nonexistent-current}"' \
        'readonly SERVICE_NAME="zzz-calculator-fixture.service"' \
        'readonly LEGACY_CURRENT_BASENAME="git-2e7f874bc034"' \
        'readonly LEGACY_CURRENT_COMMIT="2e7f874bc034871f03b5738f48d7d05685b36ea9"' \
        'readonly LEGACY_CURRENT_TREE_SHA256="d5d9e7a43f20a899c3638e0a675a774e80930ca0f878d5fd188f04e85fc16f8e"' \
        'readonly LEGACY_CURRENT_PORTABLE_SHA256="c77a6bfed6417cf8c27a90c0515f70e26127d08a6edff447e89e1c9bbc37cb51"' \
        'readonly LEGACY_CURRENT_STATIC_SHA256="c77a6bfed6417cf8c27a90c0515f70e26127d08a6edff447e89e1c9bbc37cb51"' \
        'readonly LEGACY_EXAMPLE_INVENTORY_SHA256="a4c1d79d9e0b24dddb85f94e9a6b43924584f9bd4c5af3d4f197f8b36f34e2a7"' \
        'readonly LEGACY_STATE_LAST="git-2e7f874bc034"' \
        'readonly LEGACY_STATE_PREVIOUS="rollback-2e7f874bc034"' \
        'readonly LEGACY_MIGRATION_MARKER="${DEPLOY_ROOT}/legacy-current-migrated"' \
        'readonly MIN_DISK_HEADROOM_BYTES=1' 'readonly MIN_DISK_HEADROOM_INODES=1' \
        'readonly MAX_CURRENT_SNAPSHOT_BYTES=1073741824' \
        'readonly MAX_CURRENT_SNAPSHOT_ENTRIES=20000' 'readonly MAX_RELEASE_DEPTH=64' \
        'readonly MAX_VALIDATION_SEED_BYTES=67108864' \
        'readonly MAX_VALIDATION_SEED_ENTRIES=8192' \
        'readonly MAX_VALIDATION_SEED_FILE_BYTES=1048576' \
        'CURRENT_BEFORE=""' 'CURRENT_COMMIT_BEFORE=""' \
        'CURRENT_TREE_SHA256_BEFORE=""' 'CURRENT_PORTABLE_SHA256_BEFORE=""' \
        'CURRENT_STATIC_SHA256_BEFORE=""' 'CURRENT_TREE_METADATA_SHA256_BEFORE=""' \
        'CURRENT_TREE_ENTRY_COUNT=""' 'CURRENT_TREE_FILE_COUNT=""' 'CURRENT_TREE_BYTES=""' \
        'PROCESSING_JOB_DIR=""' \
        'CURRENT_RELEASE_POLICY=""' 'STATE_LAST_EXISTED="0"' 'STATE_PREVIOUS_EXISTED="0"' \
        'STATE_LAST_BEFORE=""' 'STATE_PREVIOUS_BEFORE=""' \
        'LEGACY_MIGRATION_MARKER_EXISTED="0"' 'LEGACY_MIGRATION_MARKER_VALUE=""' \
        'SWITCH_STATE="not-switched"' 'SWITCH_ROLLBACK_TARGET=""' \
        'SWITCH_TARGET=""' 'SWITCH_ORIGINAL_TARGET=""' \
        'AUTOMATIC_ROLLBACK_FAILED="0"' 'AUTOMATIC_ROLLBACK_FAILURE_DETAIL=""' \
        'ERROR_MESSAGE=""'
    printf '%s\n' 'readonly -a VALIDATION_CATALOG_FILES=(agents.json agent_skills.json anomaly_effects.json bosses.json combat_buffs.json drive_disc_sets.json stat_rules.json w_engines.json)'
    printf '%s\n' 'die() { printf "fixture error: %s\\n" "$*" >&2; exit 1; }'
    printf '%s\n' 'log() { printf "fixture log: %s\\n" "$*" >&2; }'
    printf '%s\n' 'current_target() { if [[ -n "${TEST_CURRENT_STATE_FILE:-}" && -f "$TEST_CURRENT_STATE_FILE" ]]; then cat -- "$TEST_CURRENT_STATE_FILE"; else printf "%s" "$CURRENT_BEFORE"; fi; }'
    printf '%s\n' 'atomic_switch() { printf "%s" "$1" >"$TEST_CURRENT_STATE_FILE"; }'
    printf '%s\n' 'systemctl() { if [[ "$1" != restart ]]; then return 1; fi; if [[ -n "${FAIL_RESTART_COUNT_FILE:-}" && -f "$FAIL_RESTART_COUNT_FILE" ]]; then remaining="$(<"$FAIL_RESTART_COUNT_FILE")"; if (( remaining > 0 )); then printf "%s" "$((remaining - 1))" >"$FAIL_RESTART_COUNT_FILE"; return 1; fi; fi; return 0; }'
    printf '%s\n' 'health_gate() { return 0; }'
    printf '%s\n' 'verify_rollback_runtime() { [[ "$(current_target)" == "$1" ]]; }'
    printf '%s\n' 'assert_state_snapshot_unchanged() { :; }'
    printf '%s\n' 'tar() { /usr/bin/tar "$@"; if [[ "${MUTATE_CURRENT_AFTER_COPY:-0}" == "1" && " $* " == *" -cf "* ]]; then printf "mutated\\n" >>"$CURRENT_BEFORE/backend/server.js"; fi; }'
    sed -n '/^read_commit() {$/,/^}$/p' "$MANAGER"
    sed -n '/^validate_release_basename() {$/,/^}$/p' "$MANAGER"
    sed -n '/^read_state_file_snapshot() {$/,/^}$/p' "$MANAGER"
    sed -n '/^read_migration_marker_snapshot() {$/,/^}$/p' "$MANAGER"
    sed -n '/^read_state_snapshot() {$/,/^}$/p' "$MANAGER"
    sed -n '/^restore_state_snapshot() {$/,/^}$/p' "$MANAGER"
    sed -n '/^write_state_file() {$/,/^}$/p' "$MANAGER"
    sed -n '/^write_migration_marker() {$/,/^}$/p' "$MANAGER"
    sed -n '/^record_managed_current() {$/,/^}$/p' "$MANAGER"
    sed -n '/^tree_usage() {$/,/^}$/p' "$MANAGER"
    sed -n '/^tree_sha256() {$/,/^}$/p' "$MANAGER"
    sed -n '/^portable_tree_sha256() {$/,/^}$/p' "$MANAGER"
    sed -n '/^tree_metadata_sha256() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_snapshot_capacity() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_release_tree_access_for_user() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_release_path_readable_for_user() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_release_path_not_writable_for_user() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_release_path_access_for_user() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_release_tree_shape() {$/,/^}$/p' "$MANAGER"
    sed -n '/^release_matches_exact_contract() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_immutable_release() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_legacy_current_release() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_exact_legacy_state_tuple() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_managed_state_tuple() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_private_validation_release_access() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_root_private_release_access() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_production_release() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_current_release_compatible() {$/,/^}$/p' "$MANAGER"
    sed -n '/^rollback_uncommitted_switch() {$/,/^}$/p' "$MANAGER"
    sed -n '/^attempt_automatic_rollback() {$/,/^}$/p' "$MANAGER"
    sed -n '/^prepare_immutable_release() {$/,/^}$/p' "$MANAGER"
    sed -n '/^prepare_private_validation_release() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_sanitized_validation_data() {$/,/^}$/p' "$MANAGER"
    sed -n '/^copy_release_for_validation() {$/,/^}$/p' "$MANAGER"
    sed -n '/^assert_live_current_matches_baseline() {$/,/^}$/p' "$MANAGER"
    sed -n '/^seal_current_release() {$/,/^}$/p' "$MANAGER"
    printf '%s\n' \
        'case "$1" in' \
        '  private) assert_immutable_release "$2"; assert_private_validation_release_access "$2" ;;' \
        '  root-private) assert_root_private_release_access "$2" ;;' \
        '  sanitize) copy_release_for_validation fixture "$2" "$3" ;;' \
        '  capacity) CURRENT_TREE_BYTES="$2"; CURRENT_TREE_ENTRY_COUNT="$3"; assert_snapshot_capacity "$4" ;;' \
        '  production) assert_production_release "$2" ;;' \
        '  legacy) CURRENT_TREE_SHA256_BEFORE="$LEGACY_CURRENT_TREE_SHA256"; CURRENT_PORTABLE_SHA256_BEFORE="$LEGACY_CURRENT_PORTABLE_SHA256"; CURRENT_STATIC_SHA256_BEFORE="$LEGACY_CURRENT_STATIC_SHA256"; assert_legacy_current_release "$2" ;;' \
        '  digest) content="$(tree_sha256 "$2")"; portable="$(portable_tree_sha256 "$2" full)"; static="$(portable_tree_sha256 "$2" static)"; metadata="$(tree_metadata_sha256 "$2")"; printf "%s %s %s %s\\n" "$content" "$portable" "$static" "$metadata" ;;' \
        '  check) CURRENT_BEFORE="$2"; printf "%s" "$CURRENT_BEFORE" >"$TEST_CURRENT_STATE_FILE"; CURRENT_COMMIT_BEFORE="$3"; CURRENT_TREE_SHA256_BEFORE="$4"; CURRENT_PORTABLE_SHA256_BEFORE="$5"; CURRENT_STATIC_SHA256_BEFORE="$6"; CURRENT_TREE_METADATA_SHA256_BEFORE="$7"; assert_live_current_matches_baseline fixture ;;' \
        '  seal) CURRENT_BEFORE="$2"; printf "%s" "$CURRENT_BEFORE" >"$TEST_CURRENT_STATE_FILE"; PROCESSING_JOB_DIR="$PROCESSING_DIR"; CURRENT_COMMIT_BEFORE="$(read_commit "$2")"; usage="$(tree_usage "$2")"; IFS=: read -r CURRENT_TREE_ENTRY_COUNT CURRENT_TREE_FILE_COUNT CURRENT_TREE_BYTES <<<"$usage"; CURRENT_TREE_SHA256_BEFORE="$(tree_sha256 "$2")"; CURRENT_PORTABLE_SHA256_BEFORE="$(portable_tree_sha256 "$2" full)"; CURRENT_STATIC_SHA256_BEFORE="$(portable_tree_sha256 "$2" static)"; CURRENT_TREE_METADATA_SHA256_BEFORE="$(tree_metadata_sha256 "$2")"; seal_current_release "$2" "$3" ;;' \
        '  classify-legacy) CURRENT_BEFORE="$2"; CURRENT_COMMIT_BEFORE="$LEGACY_CURRENT_COMMIT"; CURRENT_TREE_SHA256_BEFORE="$LEGACY_CURRENT_TREE_SHA256"; CURRENT_PORTABLE_SHA256_BEFORE="$LEGACY_CURRENT_PORTABLE_SHA256"; CURRENT_STATIC_SHA256_BEFORE="$LEGACY_CURRENT_STATIC_SHA256"; CURRENT_TREE_METADATA_SHA256_BEFORE="$(tree_metadata_sha256 "$2")"; STATE_LAST_EXISTED="${3:-1}"; STATE_LAST_BEFORE="${4:-$LEGACY_STATE_LAST}"; STATE_PREVIOUS_EXISTED="${5:-1}"; STATE_PREVIOUS_BEFORE="${6:-$LEGACY_STATE_PREVIOUS}"; LEGACY_MIGRATION_MARKER_EXISTED="${7:-0}"; [[ "$LEGACY_MIGRATION_MARKER_EXISTED" == 0 ]] || LEGACY_MIGRATION_MARKER_VALUE="$LEGACY_CURRENT_COMMIT"; assert_current_release_compatible; printf "%s\\n" "$CURRENT_RELEASE_POLICY" ;;' \
        '  classify-observed) CURRENT_BEFORE="$2"; CURRENT_COMMIT_BEFORE="$(read_commit "$2")"; CURRENT_TREE_SHA256_BEFORE="$(tree_sha256 "$2")"; CURRENT_PORTABLE_SHA256_BEFORE="$(portable_tree_sha256 "$2" full)"; CURRENT_STATIC_SHA256_BEFORE="$(portable_tree_sha256 "$2" static)"; CURRENT_TREE_METADATA_SHA256_BEFORE="$(tree_metadata_sha256 "$2")"; STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="$LEGACY_STATE_LAST"; STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="$LEGACY_STATE_PREVIOUS"; LEGACY_MIGRATION_MARKER_EXISTED="0"; assert_current_release_compatible; printf "%s\\n" "$CURRENT_RELEASE_POLICY" ;;' \
        '  classify-managed) CURRENT_BEFORE="$2"; CURRENT_COMMIT_BEFORE="$(read_commit "$2")"; CURRENT_TREE_SHA256_BEFORE="$(tree_sha256 "$2")"; CURRENT_PORTABLE_SHA256_BEFORE="$(portable_tree_sha256 "$2" full)"; CURRENT_STATIC_SHA256_BEFORE="$(portable_tree_sha256 "$2" static)"; CURRENT_TREE_METADATA_SHA256_BEFORE="$(tree_metadata_sha256 "$2")"; STATE_LAST_EXISTED="1"; STATE_PREVIOUS_EXISTED="1"; STATE_LAST_BEFORE="$(basename -- "$2")"; STATE_PREVIOUS_BEFORE="$3"; LEGACY_MIGRATION_MARKER_EXISTED="1"; LEGACY_MIGRATION_MARKER_VALUE="$LEGACY_CURRENT_COMMIT"; assert_current_release_compatible; printf "%s\\n" "$CURRENT_RELEASE_POLICY" ;;' \
        '  read-state) read_state_snapshot; printf "%s|%s|%s|%s|%s|%s\\n" "$STATE_LAST_EXISTED" "$STATE_LAST_BEFORE" "$STATE_PREVIOUS_EXISTED" "$STATE_PREVIOUS_BEFORE" "$LEGACY_MIGRATION_MARKER_EXISTED" "$LEGACY_MIGRATION_MARKER_VALUE" ;;' \
        '  rollback-state) CURRENT_RELEASE_POLICY="$2"; STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="$3"; SWITCH_ORIGINAL_TARGET="$4"; STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="$(basename -- "$SWITCH_ORIGINAL_TARGET")"; SWITCH_TARGET="$5"; SWITCH_ROLLBACK_TARGET="$6"; SWITCH_STATE="switched"; printf "%s" "$SWITCH_TARGET" >"$TEST_CURRENT_STATE_FILE"; rollback_uncommitted_switch; printf "%s|%s|%s|%s|%s\\n" "$SWITCH_STATE" "$(current_target)" "$(<"$DEPLOY_ROOT/previous-release")" "$(<"$DEPLOY_ROOT/last-release")" "$(<"$LEGACY_MIGRATION_MARKER")" ;;' \
        '  rollback-armed) CURRENT_RELEASE_POLICY="$2"; STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="$3"; SWITCH_ORIGINAL_TARGET="$4"; STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="$(basename -- "$SWITCH_ORIGINAL_TARGET")"; SWITCH_TARGET="$5"; SWITCH_ROLLBACK_TARGET="$6"; SWITCH_STATE="armed"; printf "%s" "$7" >"$TEST_CURRENT_STATE_FILE"; if rollback_uncommitted_switch; then result=0; else result=$?; fi; printf "%s|%s|%s\\n" "$result" "$SWITCH_STATE" "$(current_target)" ;;' \
        '  automatic-rollback) CURRENT_RELEASE_POLICY="$2"; STATE_PREVIOUS_EXISTED="1"; STATE_PREVIOUS_BEFORE="$3"; SWITCH_ORIGINAL_TARGET="$4"; STATE_LAST_EXISTED="1"; STATE_LAST_BEFORE="$(basename -- "$SWITCH_ORIGINAL_TARGET")"; SWITCH_TARGET="$5"; SWITCH_ROLLBACK_TARGET="$6"; SWITCH_STATE="switched"; printf "%s" "$SWITCH_TARGET" >"$TEST_CURRENT_STATE_FILE"; printf "%s" "$7" >"${FAIL_RESTART_COUNT_FILE:?}"; if attempt_automatic_rollback fixture; then result=0; else result=$?; fi; printf "%s|%s|%s|%s|%s|%s\\n" "$result" "$SWITCH_STATE" "$(current_target)" "$AUTOMATIC_ROLLBACK_FAILED" "$ERROR_MESSAGE" "$AUTOMATIC_ROLLBACK_FAILURE_DETAIL" ;;' \
        '  *) exit 64 ;;' \
        'esac'
} >"$release_assert_driver"
grep -Fq 'assert_release_tree_access_for_user()' "$release_assert_driver" \
    || fail "could not extract installed release access helper"
grep -Fq 'assert_immutable_release()' "$release_assert_driver" \
    || fail "could not extract installed immutable release assertion"
grep -Fq 'assert_private_validation_release_access()' "$release_assert_driver" \
    || fail "could not extract installed private validation assertion"
grep -Fq 'assert_production_release()' "$release_assert_driver" \
    || fail "could not extract installed production release assertion"
bash -n "$release_assert_driver" || fail "extracted release assertion is not valid Bash"

{
    printf '%s\n' '#!/bin/bash' 'set -Eeuo pipefail' \
        'readonly CURRENT_LINK="${TEST_CURRENT_LINK:?}"' \
        'NEXT_LINK_PATH=""'
    printf '%s\n' 'mv() { if [[ "${FAIL_ATOMIC_MV:-0}" == "1" ]]; then return 1; fi; /usr/bin/mv "$@"; }'
    sed -n '/^current_target() {$/,/^}$/p' "$MANAGER"
    sed -n '/^atomic_switch() {$/,/^}$/p' "$MANAGER"
    printf '%s\n' 'if atomic_switch "$1"; then result=0; else result=$?; fi' \
        'printf "%s|%s|%s\n" "$result" "$(current_target)" "$NEXT_LINK_PATH"'
} >"$atomic_switch_driver"
bash -n "$atomic_switch_driver" || fail "extracted atomic switch driver is not valid Bash"

assert_private_release() {
    run_release_driver private "$validation_access_root/release" \
        >/dev/null 2>&1
}

assert_private_release_rejected() {
    local label="$1"
    if assert_private_release; then
        fail "immutable release assertion accepted ${label}"
    fi
}

assert_release_driver_rejected() {
    local label="$1"
    shift
    if run_release_driver "$@" \
        >"${test_root}/${label}.stdout" 2>"${test_root}/${label}.stderr"; then
        fail "release assertion accepted ${label}"
    fi
}

assert_release_driver_rejected_with_error() {
    local label="$1"
    local expected_error="$2"
    shift 2
    assert_release_driver_rejected "$label" "$@"
    grep -F -- "$expected_error" "${test_root}/${label}.stderr" >/dev/null \
        || fail "release assertion ${label} did not report ${expected_error}"
}

# State files are data, not hints. The exact legacy pair must be read with its
# root-owned 0640 single-link contract; unsafe paths never count as absent.
sudo install -d -o root -g root -m 0755 -- "$driver_deploy_root"
printf '%s\n' 'git-2e7f874bc034' | sudo tee "$driver_deploy_root/last-release" >/dev/null
printf '%s\n' 'rollback-2e7f874bc034' | sudo tee "$driver_deploy_root/previous-release" >/dev/null
sudo chown root:root "$driver_deploy_root/last-release" "$driver_deploy_root/previous-release"
sudo chmod 0640 "$driver_deploy_root/last-release" "$driver_deploy_root/previous-release"
[[ "$(run_release_driver read-state)" == '1|git-2e7f874bc034|1|rollback-2e7f874bc034|0|' ]] \
    || fail "the exact audited legacy state pair was not read safely"
sudo chmod 0660 "$driver_deploy_root/last-release"
assert_release_driver_rejected unsafe-state-mode read-state
sudo chmod 0640 "$driver_deploy_root/last-release"
sudo rm -f -- "$driver_deploy_root/previous-release"
sudo ln -s -- last-release "$driver_deploy_root/previous-release"
assert_release_driver_rejected state-symlink read-state
sudo rm -f -- "$driver_deploy_root/previous-release"
printf '%s\n' 'rollback-2e7f874bc034' | sudo tee "$driver_deploy_root/previous-release" >/dev/null
sudo chown root:root "$driver_deploy_root/previous-release"
sudo chmod 0640 "$driver_deploy_root/previous-release"
printf '%s\n' '2e7f874bc034871f03b5738f48d7d05685b36ea9' \
    | sudo tee "$driver_deploy_root/legacy-current-migrated" >/dev/null
sudo chown root:root "$driver_deploy_root/legacy-current-migrated"
sudo chmod 0640 "$driver_deploy_root/legacy-current-migrated"
[[ "$(run_release_driver read-state)" == \
    '1|git-2e7f874bc034|1|rollback-2e7f874bc034|1|2e7f874bc034871f03b5738f48d7d05685b36ea9' ]] \
    || fail "the migration marker was not read safely"
sudo rm -f -- "$driver_deploy_root/legacy-current-migrated"
run_release_driver capacity 1 1 "$test_root" >/dev/null 2>&1 \
    || fail "snapshot capacity rejected a tiny valid tree"
assert_release_driver_rejected insufficient-snapshot-bytes capacity 1000000000000000 1 "$test_root"
assert_release_driver_rejected insufficient-snapshot-inodes capacity 1 1000000000 "$test_root"

assert_private_release || fail "immutable private release failed the installed manager assertion"
sudo chmod 0600 "$validation_access_root/release/.deployed-commit"
assert_private_release_rejected "mode 0600 release metadata"
sudo chmod 0666 "$validation_access_root/release/.deployed-commit"
assert_private_release_rejected "mode 0666 release metadata"
sudo chmod 0644 "$validation_access_root/release/.deployed-commit"
sudo chmod 0777 "$validation_access_root/release"
assert_private_release_rejected "mode 0777 release root"
sudo chmod 0755 "$validation_access_root/release"
sudo chown zzzcalc:zzzcalc "$validation_access_root/release/backend/server.js"
assert_private_release_rejected "non-root-owned release file"
sudo chown root:root "$validation_access_root/release/backend/server.js"
sudo ln -s -- .deployed-commit "$validation_access_root/release/unsafe-link"
assert_private_release_rejected "symbolic link"
sudo rm -f -- "$validation_access_root/release/unsafe-link"
sudo ln -- "$validation_access_root/release/.deployed-commit" "$validation_access_root/release/unsafe-hardlink"
assert_private_release_rejected "hard-linked file"
sudo rm -f -- "$validation_access_root/release/unsafe-hardlink"
assert_private_release || fail "restored immutable private release failed its assertion"
sudo chmod 0755 "$validation_access_root"
assert_private_release_rejected "world-traversable validation parent"
sudo chmod 0750 "$validation_access_root"
assert_private_release || fail "restored private validation scope failed its assertion"

# The production scope separately proves that the application can reach a
# future release through its real ancestors; the tree-internal check alone
# must not hide a broken /opt-style parent path.
sudo install -d -o root -g root -m 0755 -- "$production_access_root"
sudo cp -a -- "$validation_access_root/release" "$production_access_root/release"
sudo chown -R root:root "$production_access_root/release"
run_release_driver production "$production_access_root/release" \
    >/dev/null 2>&1 || fail "production release failed its absolute application access assertion"
sudo chmod 0700 "$production_access_root"
if run_release_driver production "$production_access_root/release" \
    >/dev/null 2>&1; then
    fail "production release assertion accepted an application-inaccessible parent"
fi
sudo chmod 0755 "$production_access_root"
sudo chown root:zzzcalc "$production_access_root"
sudo chmod 0750 "$production_access_root"
if run_release_driver production "$production_access_root/release" \
    >/dev/null 2>&1; then
    fail "production release assertion accepted a validator-inaccessible parent"
fi
sudo chown root:root "$production_access_root"
sudo chmod 0755 "$production_access_root"
managed_release="${production_access_root}/git-abcdef0"
managed_previous="${production_access_root}/rollback-abcdef0"
sudo cp -a -- "$production_access_root/release" "$managed_release"
sudo cp -a -- "$production_access_root/release" "$managed_previous"
[[ "$(run_release_driver classify-managed "$managed_release" "$(basename -- "$managed_previous")" 2>/dev/null)" == "managed-immutable" ]] \
    || fail "manager state did not require the strict immutable current contract"

# The exact hand-deployed production baseline is intentionally zzzcalc-owned
# 0755/0644. It may be read and sealed without changing its live metadata, but
# the same tree must never satisfy a future production-release assertion.
legacy_release="${legacy_access_root}/git-2e7f874bc034"
legacy_snapshot="${legacy_snapshot_root}/sources/current"
sudo install -d -o root -g root -m 0755 -- "$legacy_access_root"
sudo install -d -o zzzcalc -g zzzcalc -m 0755 -- \
    "$legacy_release" "$legacy_release/backend" "$legacy_release/dist" "$legacy_release/dist/pages" "$legacy_release/data"
printf '%s\n' '2e7f874bc034871f03b5738f48d7d05685b36ea9' \
    | sudo tee "$legacy_release/.deployed-commit" >/dev/null
printf 'console.log("legacy current fixture")\n' \
    | sudo tee "$legacy_release/backend/server.js" >/dev/null
printf '<!doctype html><title>legacy current fixture</title>\n' \
    | sudo tee "$legacy_release/dist/pages/index.html" >/dev/null
printf '{"fixture":true}\n' | sudo tee "$legacy_release/data/agents.json" >/dev/null
sudo cp -- "$REPO_ROOT/data/user_drive_discs.example.json" \
    "$legacy_release/data/user_drive_discs.example.json"
sudo chown -R zzzcalc:zzzcalc "$legacy_release"
sudo find "$legacy_release" -type d -exec chmod 0755 {} +
sudo find "$legacy_release" -type f -exec chmod 0644 {} +
run_release_driver legacy "$legacy_release" \
    >/dev/null 2>&1 || fail "exact legacy current contract was rejected"
[[ "$(run_release_driver classify-legacy "$legacy_release" 2>/dev/null)" == "legacy-writable" ]] \
    || fail "the audited legacy state tuple was not classified explicitly"
assert_release_driver_rejected_with_error legacy-observed-hash \
    'legacy current release content does not match the audited baseline' \
    classify-observed "$legacy_release"
assert_release_driver_rejected legacy-missing-last classify-legacy "$legacy_release" 0 \
    git-2e7f874bc034 1 rollback-2e7f874bc034 0
assert_release_driver_rejected legacy-wrong-last classify-legacy "$legacy_release" 1 \
    git-deadbee 1 rollback-2e7f874bc034 0
assert_release_driver_rejected legacy-wrong-previous classify-legacy "$legacy_release" 1 \
    git-2e7f874bc034 1 rollback-deadbee 0
assert_release_driver_rejected legacy-marker-present classify-legacy "$legacy_release" 1 \
    git-2e7f874bc034 1 rollback-2e7f874bc034 1
legacy_rollback_basename="$(basename -- "$managed_previous")"
legacy_rollback_result="$(run_release_driver rollback-state legacy-writable \
    rollback-2e7f874bc034 "$legacy_release" "${production_access_root}/git-candidate1" \
    "$managed_previous")"
[[ "$legacy_rollback_result" == \
    "rolled-back|${managed_previous}|${legacy_rollback_basename}|${legacy_rollback_basename}|2e7f874bc034871f03b5738f48d7d05685b36ea9" ]] \
    || fail "legacy automatic rollback did not self-anchor the strict compatibility release"
managed_rollback_basename="$(basename -- "$managed_release")"
managed_previous_basename="$(basename -- "$managed_previous")"
managed_rollback_result="$(run_release_driver rollback-state managed-immutable \
    "$managed_previous_basename" "$managed_previous" "${production_access_root}/git-candidate2" \
    "$managed_release")"
[[ "$managed_rollback_result" == \
    "rolled-back|${managed_release}|${managed_previous_basename}|${managed_rollback_basename}|2e7f874bc034871f03b5738f48d7d05685b36ea9" ]] \
    || fail "managed automatic rollback did not preserve the prior previous release"
printf '%s\n' "$managed_previous_basename" | sudo tee "$driver_deploy_root/previous-release" >/dev/null
printf '%s\n' "$managed_rollback_basename" | sudo tee "$driver_deploy_root/last-release" >/dev/null
sudo chown root:root "$driver_deploy_root/previous-release" "$driver_deploy_root/last-release"
sudo chmod 0640 "$driver_deploy_root/previous-release" "$driver_deploy_root/last-release"
managed_original_result="$(run_release_driver rollback-state managed-immutable \
    "$managed_previous_basename" "$managed_release" "${production_access_root}/git-candidate3" \
    "$managed_release")"
[[ "$managed_original_result" == \
    "rolled-back|${managed_release}|${managed_previous_basename}|${managed_rollback_basename}|2e7f874bc034871f03b5738f48d7d05685b36ea9" ]] \
    || fail "rollback to the original target did not restore the prior state tuple"
armed_original_result="$(run_release_driver rollback-armed managed-immutable \
    "$managed_previous_basename" "$managed_release" "${production_access_root}/git-candidate4" \
    "$managed_release" "$managed_release")"
[[ "$armed_original_result" == "0|not-switched|${managed_release}" ]] \
    || fail "armed rollback did not recognize the untouched original target"
armed_unknown_result="$(run_release_driver rollback-armed managed-immutable \
    "$managed_previous_basename" "$managed_release" "${production_access_root}/git-candidate5" \
    "$managed_release" "${production_access_root}/git-unknown0")"
[[ "$armed_unknown_result" == "1|armed|${production_access_root}/git-unknown0" ]] \
    || fail "armed rollback accepted an unknown current target"
restart_failures="${test_root}/restart-failures"
automatic_retry_result="$(sudo env TEST_DEPLOY_ROOT="$driver_deploy_root" \
    TEST_RELEASE_ROOT="$driver_release_root" TEST_PROCESSING_DIR="$driver_processing_root" \
    TEST_CURRENT_STATE_FILE="$driver_current_state_file" FAIL_RESTART_COUNT_FILE="$restart_failures" \
    /bin/bash --noprofile --norc "$release_assert_driver" automatic-rollback managed-immutable \
    "$managed_previous_basename" "$managed_previous" "${production_access_root}/git-candidate6" \
    "$managed_release" 1)"
[[ "$automatic_retry_result" == "0|rolled-back|${managed_release}|0||" ]] \
    || fail "automatic rollback did not recover after a transient restart failure"
automatic_failure_result="$(sudo env TEST_DEPLOY_ROOT="$driver_deploy_root" \
    TEST_RELEASE_ROOT="$driver_release_root" TEST_PROCESSING_DIR="$driver_processing_root" \
    TEST_CURRENT_STATE_FILE="$driver_current_state_file" FAIL_RESTART_COUNT_FILE="$restart_failures" \
    /bin/bash --noprofile --norc "$release_assert_driver" automatic-rollback managed-immutable \
    "$managed_previous_basename" "$managed_previous" "${production_access_root}/git-candidate7" \
    "$managed_release" 3 2>/dev/null)"
[[ "$automatic_failure_result" == \
    "1|switched|${managed_release}|1||automatic rollback attempts exhausted during fixture; switchState=switched; actualCurrent=${managed_release}; rollbackTarget=${managed_release}" ]] \
    || fail "exhausted automatic rollback retries were not reported as CRITICAL"
atomic_root="${test_root}/atomic"
atomic_current="${atomic_root}/current"
atomic_original="${atomic_root}/git-original0"
atomic_candidate="${atomic_root}/git-candidate0"
mkdir -p "$atomic_original" "$atomic_candidate"
ln -s -- "$atomic_original" "$atomic_current"
atomic_failed_result="$(TEST_CURRENT_LINK="$atomic_current" FAIL_ATOMIC_MV=1 \
    /bin/bash --noprofile --norc "$atomic_switch_driver" "$atomic_candidate")"
[[ "$atomic_failed_result" == "1|${atomic_original}|${atomic_current}.next."* ]] \
    || fail "atomic switch reported success after its rename failed"
rm -f -- "${atomic_current}.next."*
atomic_success_result="$(TEST_CURRENT_LINK="$atomic_current" \
    /bin/bash --noprofile --norc "$atomic_switch_driver" "$atomic_candidate")"
[[ "$atomic_success_result" == "0|${atomic_candidate}|" ]] \
    || fail "atomic switch did not verify the resolved target after rename"
assert_release_driver_rejected legacy-as-production production "$legacy_release"
legacy_unknown="${legacy_access_root}/git-2e7f874bc035"
sudo cp -a -- "$legacy_release" "$legacy_unknown"
assert_release_driver_rejected unknown-legacy-current classify-legacy "$legacy_unknown"

legacy_digest_before="$(run_release_driver digest "$legacy_release")"
legacy_tree_before="$(tree_digest "$legacy_release")"
sudo install -d -o root -g root -m 0700 -- "$legacy_snapshot_root"
run_release_driver seal "$legacy_release" "$legacy_snapshot" \
    >/dev/null 2>&1 || fail "legacy current could not be sealed into a private immutable snapshot"
[[ "$(tree_digest "$legacy_release")" == "$legacy_tree_before" ]] \
    || fail "sealing changed the legacy source tree"
[[ "$(run_release_driver digest "$legacy_release")" == "$legacy_digest_before" ]] \
    || fail "sealing changed legacy source content or metadata"
run_release_driver root-private "$legacy_snapshot" \
    >/dev/null 2>&1 || fail "sealed legacy snapshot is not root-only and immutable"
for principal in zzzcalc zzzvalidate; do
    if sudo -u "$principal" test -r "$legacy_snapshot/.deployed-commit"; then
        fail "${principal} can read the root-only sealed current snapshot"
    fi
done
legacy_content_before="${legacy_digest_before%% *}"
snapshot_digest="$(run_release_driver digest "$legacy_snapshot")"
[[ "${snapshot_digest%% *}" == "$legacy_content_before" ]] \
    || fail "sealed legacy snapshot content differs from its source"

sanitized_source="${legacy_snapshot_root}/sanitized-source"
sanitized_destination="${validation_access_root}/sanitized-release"
sudo cp -a -- "$legacy_snapshot" "$sanitized_source"
for catalog_name in agents.json agent_skills.json anomaly_effects.json bosses.json \
    combat_buffs.json drive_disc_sets.json stat_rules.json w_engines.json; do
    sudo install -o root -g root -m 0644 -- "$REPO_ROOT/data/$catalog_name" \
        "$sanitized_source/data/$catalog_name"
done
printf '{"private":true}\n' | sudo tee "$sanitized_source/data/user_drive_discs.json" >/dev/null
sudo install -d -o root -g root -m 0755 -- "$sanitized_source/data/scan-telemetry"
printf 'private telemetry\n' | sudo tee "$sanitized_source/data/scan-telemetry/sentinel" >/dev/null
printf 'unknown private data\n' | sudo tee "$sanitized_source/data/private-sentinel" >/dev/null
sudo chown -R root:root "$sanitized_source"
sudo find "$sanitized_source" -type d -exec chmod 0755 {} +
sudo find "$sanitized_source" -type f -exec chmod 0644 {} +
run_release_driver sanitize "$sanitized_source" "$sanitized_destination" \
    >/dev/null 2>&1 || fail "sanitized validation copy could not be created"
sudo -u zzzvalidate test -r "$sanitized_destination/data/agents.json" \
    || fail "validator cannot read sanitized catalog data"
if sudo -u zzzcalc test -r "$sanitized_destination/data/agents.json"; then
    fail "application account can read the private sanitized validation copy"
fi
for private_path in user_drive_discs.json scan-telemetry private-sentinel; do
    if [[ "$private_path" == user_drive_discs.json ]]; then
        sudo cmp -s -- "$sanitized_destination/data/user_drive_discs.example.json" \
            "$sanitized_destination/data/user_drive_discs.json" \
            || fail "sanitized inventory is not the empty example"
    elif sudo test -e "$sanitized_destination/data/$private_path" \
        || sudo test -L "$sanitized_destination/data/$private_path"; then
        fail "private data path ${private_path} leaked into validation"
    fi
done

portable_fixture="${legacy_access_root}/portable-fixture"
sudo cp -a -- "$legacy_release" "$portable_fixture"
read -r portable_content_base portable_full_base portable_static_base portable_metadata_base \
    <<<"$(run_release_driver digest "$portable_fixture")"
printf '{"private":true}\n' | sudo tee "$portable_fixture/data/user_drive_discs.json" >/dev/null
sudo chown zzzcalc:zzzcalc "$portable_fixture/data/user_drive_discs.json"
sudo chmod 0644 "$portable_fixture/data/user_drive_discs.json"
read -r portable_content_inventory portable_full_inventory portable_static_inventory _ \
    <<<"$(run_release_driver digest "$portable_fixture")"
[[ "$portable_content_inventory" != "$portable_content_base" \
    && "$portable_full_inventory" != "$portable_full_base" \
    && "$portable_static_inventory" == "$portable_static_base" ]] \
    || fail "static digest did not exclude only the server inventory path"
sudo rm -f -- "$portable_fixture/data/user_drive_discs.json"
sudo install -d -o zzzcalc -g zzzcalc -m 0755 -- "$portable_fixture/data/scan-telemetry"
printf 'private\n' | sudo tee "$portable_fixture/data/scan-telemetry/sentinel" >/dev/null
sudo chown zzzcalc:zzzcalc "$portable_fixture/data/scan-telemetry/sentinel"
sudo chmod 0644 "$portable_fixture/data/scan-telemetry/sentinel"
read -r _ portable_full_telemetry portable_static_telemetry _ \
    <<<"$(run_release_driver digest "$portable_fixture")"
[[ "$portable_full_telemetry" != "$portable_full_base" \
    && "$portable_static_telemetry" == "$portable_static_base" ]] \
    || fail "static digest did not exclude only the scan telemetry tree"
sudo rm -rf --one-file-system -- "$portable_fixture/data/scan-telemetry"
printf 'changed\n' | sudo tee -a "$portable_fixture/backend/server.js" >/dev/null
read -r _ _ portable_static_code _ <<<"$(run_release_driver digest "$portable_fixture")"
[[ "$portable_static_code" != "$portable_static_base" ]] \
    || fail "static digest ignored a code change"

read -r legacy_content_before legacy_portable_before legacy_static_before legacy_metadata_before <<<"$legacy_digest_before"
printf 'changed\n' | sudo tee -a "$legacy_release/backend/server.js" >/dev/null
assert_release_driver_rejected_with_error legacy-content-drift \
    'current release content changed at fixture' check "$legacy_release" \
    '2e7f874bc034871f03b5738f48d7d05685b36ea9' "$legacy_content_before" \
    "$legacy_portable_before" "$legacy_static_before" "$legacy_metadata_before"
sudo sed -i '$d' "$legacy_release/backend/server.js"
sudo chown zzzcalc:zzzcalc "$legacy_release/backend/server.js"
sudo chmod 0644 "$legacy_release/backend/server.js"
legacy_digest_before="$(run_release_driver digest "$legacy_release")"
read -r legacy_content_before legacy_portable_before legacy_static_before legacy_metadata_before <<<"$legacy_digest_before"
sudo touch -m -d '2001-02-03 04:05:06 UTC' "$legacy_release/backend/server.js"
assert_release_driver_rejected_with_error legacy-metadata-drift \
    'current release metadata changed at fixture' check "$legacy_release" \
    '2e7f874bc034871f03b5738f48d7d05685b36ea9' "$legacy_content_before" \
    "$legacy_portable_before" "$legacy_static_before" "$legacy_metadata_before"
sudo touch -m -d "@$(sudo stat -c '%Y' "$legacy_snapshot/backend/server.js")" "$legacy_release/backend/server.js"

legacy_mutating="${legacy_access_root}/git-2e7f874bc034-mutating"
legacy_mutating_snapshot="${legacy_snapshot_root}/sources/mutating"
sudo cp -a -- "$legacy_release" "$legacy_mutating"
sudo chown -R zzzcalc:zzzcalc "$legacy_mutating"
if sudo env TEST_DEPLOY_ROOT="$driver_deploy_root" TEST_RELEASE_ROOT="$driver_release_root" \
    TEST_PROCESSING_DIR="$driver_processing_root" TEST_CURRENT_STATE_FILE="$driver_current_state_file" \
    MUTATE_CURRENT_AFTER_COPY=1 /bin/bash --noprofile --norc \
    "$release_assert_driver" seal "$legacy_mutating" "$legacy_mutating_snapshot" \
    >"${test_root}/legacy-mutating.stdout" 2>"${test_root}/legacy-mutating.stderr"; then
    fail "current sealing accepted a source mutation after copy"
fi
grep -F 'current release content changed at after sealing the current release' \
    "${test_root}/legacy-mutating.stderr" >/dev/null \
    || fail "current sealing did not report its post-copy source drift gate"

sudo ln -s -- .deployed-commit "$legacy_release/unsafe-link"
assert_release_driver_rejected legacy-symlink legacy "$legacy_release"
sudo rm -f -- "$legacy_release/unsafe-link"
sudo mkfifo "$legacy_release/unsafe-fifo"
assert_release_driver_rejected legacy-fifo legacy "$legacy_release"
sudo rm -f -- "$legacy_release/unsafe-fifo"
sudo chown root:root "$legacy_release/backend/server.js"
assert_release_driver_rejected legacy-mixed-owner legacy "$legacy_release"
sudo chown zzzcalc:zzzcalc "$legacy_release/backend/server.js"
sudo chmod 0777 "$legacy_release"
assert_release_driver_rejected legacy-world-writable legacy "$legacy_release"
sudo chmod 0755 "$legacy_release"
run_release_driver legacy "$legacy_release" \
    >/dev/null 2>&1 || fail "restored legacy current contract was rejected"

release_tree="${test_root}/release"
mkdir -p "$release_tree/backend" "$release_tree/dist/pages"
printf '%s\n' "$COMMIT" >"$release_tree/.deployed-commit"
printf 'console.log("rejection-only fixture")\n' >"$release_tree/backend/server.js"
printf '<!doctype html><title>fixture</title>\n' >"$release_tree/dist/pages/index.html"

archive_path="${test_root}/${ARCHIVE_NAME}"
evidence_path="${test_root}/${EVIDENCE_NAME}"
tar -C "$release_tree" -czf "$archive_path" .
artifact_sha="$(sha256sum -- "$archive_path" | awk '{print $1}')"
artifact_size="$(stat -c '%s' -- "$archive_path")"
printf '{"commit":"%s","artifact":{"path":"%s","size":%s,"sha256":"%s"}}\n' \
    "$COMMIT" "$ARCHIVE_NAME" "$artifact_size" "$artifact_sha" >"$evidence_path"
chmod 0644 "$archive_path" "$evidence_path"

sudo test ! -e "$remote_archive" || fail "incoming artifact fixture already exists"
sudo test ! -e "$remote_evidence" || fail "incoming evidence fixture already exists"
sudo -u zzzdeploy cp -- "$archive_path" "$remote_archive"
sudo -u zzzdeploy cp -- "$evidence_path" "$remote_evidence"

history_list >"${test_root}/history.before"
history_start_count="$(history_count)"
incoming_before="$(tree_digest "$INCOMING_DIR")"
processing_before="$(tree_digest "$PROCESSING_DIR")"
validation_before="$(tree_digest "$VALIDATION_DIR")"
releases_before="$(tree_digest "$RELEASE_ROOT")"
archive_before="$(path_fingerprint "$remote_archive")"
evidence_before="$(path_fingerprint "$remote_evidence")"
previous_before="$(path_fingerprint "$DEPLOY_ROOT/previous-release")"
last_before="$(path_fingerprint "$DEPLOY_ROOT/last-release")"
helper_before="$(path_fingerprint "$HELPER_MANIFEST")"
scanner_before="$(path_fingerprint "$SCANNER_MANIFEST")"
service_before="$(service_snapshot)"

# Sudo permits dry-run/deploy argument forwarding, so the manager itself must
# reject malformed values before production preflight or upload claiming.
run_manager_failure unknown-option 'unsupported option: --unknown' \
    dry-run --unknown
run_manager_failure artifact-traversal 'invalid artifact basename' \
    dry-run --artifact "${INCOMING_DIR}/../etc/passwd"
run_manager_failure invalid-sha 'expected SHA-256 must be 64 lowercase hexadecimal characters' \
    deploy --artifact "$remote_archive" --expected-sha not-a-sha --expected-commit "$COMMIT"
run_manager_failure missing-commit 'deploy requires --expected-commit' \
    deploy --artifact "$remote_archive" --expected-sha "$artifact_sha"

# Fully valid inputs must still remain untouched when the strict production
# baseline cannot be established on the isolated CI runner.
run_manager_failure dry-run-preflight 'current release cannot be resolved inside the fixed release root' \
    dry-run --artifact "$remote_archive" --evidence "$remote_evidence" \
    --expected-sha "$artifact_sha" --expected-commit "$COMMIT"
run_manager_failure deploy-preflight 'current release cannot be resolved inside the fixed release root' \
    deploy --artifact "$remote_archive" --evidence "$remote_evidence" \
    --expected-sha "$artifact_sha" --expected-commit "$COMMIT"
run_manager_failure rollback-preflight 'current release cannot be resolved inside the fixed release root' \
    rollback --previous
run_manager_failure audit-preflight 'current release cannot be resolved inside the fixed release root' \
    audit

# The sudo policy must reject arbitrary rollback targets before the manager is
# entered, and therefore must not create an evidence record.
history_before_denied="$(history_count)"
if sudo -u zzzdeploy sudo -n "$MANAGER" rollback --release arbitrary-release \
    >"${test_root}/rollback-denied.stdout" 2>"${test_root}/rollback-denied.stderr"; then
    fail "restricted sudo accepted an arbitrary rollback target"
fi
[[ "$(history_count)" == "$history_before_denied" ]] \
    || fail "sudo-denied rollback unexpectedly created deployment evidence"

# Hold the real deployment lock without starting a second manager. A manager
# invocation must fail immediately and report that no switch was attempted.
lock_ready="${test_root}/lock.ready"
sudo /bin/bash -c '
    exec 9>"$1"
    flock 9
    printf "%s\n" "$$" >"$2"
    exec sleep 30
' -- "$LOCK_FILE" "$lock_ready" &
lock_launcher_pid="$!"
for _ in $(seq 1 100); do
    [[ -s "$lock_ready" ]] && break
    sleep 0.05
done
[[ -s "$lock_ready" ]] || fail "lock holder did not become ready"
lock_holder_pid="$(<"$lock_ready")"
run_manager_failure concurrent-lock 'another deployment operation is running' audit
sudo kill "$lock_holder_pid" >/dev/null 2>&1 || true
wait "$lock_launcher_pid" >/dev/null 2>&1 || true
lock_holder_pid=""
lock_launcher_pid=""

history_list >"${test_root}/history.after"
new_evidence_count="$(comm -13 "${test_root}/history.before" "${test_root}/history.after" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
[[ "$new_evidence_count" -eq "$expected_evidence_count" ]] \
    || fail "unexpected deployment evidence count"
[[ "$(history_count)" -eq $((history_start_count + expected_evidence_count)) ]] \
    || fail "history contains an unexplained file change"

while IFS= read -r evidence_basename; do
    [[ -n "$evidence_basename" ]] || continue
    evidence_file="${HISTORY_DIR}/${evidence_basename}"
    [[ "$(sudo stat -c '%U:%G:%a' -- "$evidence_file")" == "root:root:640" ]] \
        || fail "failed evidence has unsafe ownership or mode"
    sudo jq -e '.status == "failed" and .switchState == "not-switched"' "$evidence_file" >/dev/null \
        || fail "persisted rejection evidence is invalid"
done < <(comm -13 "${test_root}/history.before" "${test_root}/history.after")

[[ "$(tree_digest "$INCOMING_DIR")" == "$incoming_before" ]] || fail "incoming uploads changed on a rejected operation"
[[ "$(tree_digest "$PROCESSING_DIR")" == "$processing_before" ]] || fail "processing data changed on a rejected operation"
[[ "$(tree_digest "$VALIDATION_DIR")" == "$validation_before" ]] || fail "validation data changed on a rejected operation"
[[ "$(tree_digest "$RELEASE_ROOT")" == "$releases_before" ]] || fail "release tree changed on a rejected operation"
[[ "$(path_fingerprint "$remote_archive")" == "$archive_before" ]] || fail "incoming artifact was claimed or replaced"
[[ "$(path_fingerprint "$remote_evidence")" == "$evidence_before" ]] || fail "incoming evidence was claimed or replaced"
[[ "$(path_fingerprint "$DEPLOY_ROOT/previous-release")" == "$previous_before" ]] || fail "previous-release state changed"
[[ "$(path_fingerprint "$DEPLOY_ROOT/last-release")" == "$last_before" ]] || fail "last-release state changed"
[[ "$(path_fingerprint "$HELPER_MANIFEST")" == "$helper_before" ]] || fail "Helper manifest changed"
[[ "$(path_fingerprint "$SCANNER_MANIFEST")" == "$scanner_before" ]] || fail "Scanner manifest changed"
[[ "$(service_snapshot)" == "$service_before" ]] || fail "production service state changed"
[[ ! -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]] || fail "a rejected operation created current"

printf 'production deploy manager rejection integration tests passed\n'
