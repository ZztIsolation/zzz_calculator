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
    grep -F -- "$expected_error" "$stderr_path" >/dev/null \
        || fail "${label} did not report the expected rejection"
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
for dependency in jq sudo tar sha256sum stat find flock systemctl; do
    command -v "$dependency" >/dev/null || fail "${dependency} is required"
done
getent passwd zzzdeploy >/dev/null || fail "bootstrap integration test did not create zzzdeploy"
[[ -x "$MANAGER" ]] || fail "deployment manager is not installed"
[[ -d "$INCOMING_DIR" && -d "$PROCESSING_DIR" && -d "$HISTORY_DIR" && -d "$VALIDATION_DIR" ]] \
    || fail "deployment control directories are not initialized"
[[ -d "$RELEASE_ROOT" && ! -L "$RELEASE_ROOT" ]] || fail "release root is not initialized"

# This test is deliberately a rejection-only test. Refuse to run where a real
# production target exists so that no test case can reach validation or switch
# logic, even if a future preflight becomes less strict.
[[ ! -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]] \
    || fail "refusing to run rejection tests when a current release exists"

test_root="$(mktemp -d)"
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
    if [[ -n "$test_root" && "$test_root" == /tmp/* ]]; then
        rm -rf -- "$test_root"
    fi
}
trap cleanup EXIT

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
