#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"
readonly INCOMING_DIR="${DEPLOY_ROOT}/incoming"
readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"
readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"
readonly MANAGER="/usr/local/sbin/zzz-calculator-deploy"
readonly COMMIT="0123456789abcdef0123456789abcdef01234567"
readonly ARCHIVE_NAME="zzz-calculator-server-${COMMIT:0:12}.tar.gz"
readonly EVIDENCE_NAME="zzz-calculator-server-${COMMIT:0:12}.evidence.json"

fail() {
    printf 'deploy manager integration failure: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -ne 0 ]] || fail "run this integration test as the regular CI user"
command -v jq >/dev/null || fail "jq is required"
getent passwd zzzdeploy >/dev/null || fail "bootstrap integration test did not create zzzdeploy"
[[ -x "$MANAGER" ]] || fail "deployment manager is not installed"

test_root="$(mktemp -d)"
sync_dir="$(mktemp -d)"
writer_pid=""
cleanup() {
    if [[ -n "$writer_pid" ]]; then
        sudo kill "$writer_pid" >/dev/null 2>&1 || true
        wait "$writer_pid" >/dev/null 2>&1 || true
    fi
    rm -rf -- "$test_root" "$sync_dir"
}
trap cleanup EXIT
chmod 0755 "$test_root"
chmod 0777 "$sync_dir"

release_tree="${test_root}/release"
mkdir -p "$release_tree/backend" "$release_tree/dist/pages"
printf '%s\n' "$COMMIT" >"$release_tree/.deployed-commit"
printf 'console.log("integration fixture")\n' >"$release_tree/backend/server.js"
printf '<!doctype html><title>fixture</title>\n' >"$release_tree/dist/pages/index.html"

archive_path="${test_root}/${ARCHIVE_NAME}"
evidence_path="${test_root}/${EVIDENCE_NAME}"
tar -C "$release_tree" -czf "$archive_path" .
artifact_sha="$(sha256sum -- "$archive_path" | awk '{print $1}')"
artifact_size="$(stat -c '%s' -- "$archive_path")"
printf '{"commit":"%s","artifact":{"path":"%s","size":%s,"sha256":"%s"}}\n' \
    "$COMMIT" "$ARCHIVE_NAME" "$artifact_size" "$artifact_sha" >"$evidence_path"
chmod 0644 "$archive_path" "$evidence_path"

remote_archive="${INCOMING_DIR}/${ARCHIVE_NAME}.part"
remote_evidence="${INCOMING_DIR}/${EVIDENCE_NAME}.part"
sudo -u zzzdeploy cp -- "$archive_path" "$remote_archive"
sudo -u zzzdeploy cp -- "$evidence_path" "$remote_evidence"

ready_file="${sync_dir}/ready"
sudo -u zzzdeploy bash -c '
    exec 3>>"$1"
    : >"$2"
    while [[ -e "$1" ]]; do sleep 0.02; done
    sleep 0.5
    printf "writer-held-old-inode\n" >&3
' -- "$remote_archive" "$ready_file" &
writer_pid="$!"
for _ in $(seq 1 100); do
    [[ -e "$ready_file" ]] && break
    sleep 0.05
done
[[ -e "$ready_file" ]] || fail "writer did not open the incoming artifact"

manager_output="$(
    sudo -u zzzdeploy sudo -n "$MANAGER" dry-run \
        --artifact "$remote_archive" \
        --evidence "$remote_evidence" \
        --expected-sha "$artifact_sha" \
        --expected-commit "$COMMIT"
)"
wait "$writer_pid"
writer_pid=""

printf '%s\n' "$manager_output" | jq -e \
    --arg commit "$COMMIT" \
    '.status == "success" and .action == "dry-run" and .deployedCommit == $commit and .artifactSha256 != ""' \
    >/dev/null || fail "dry-run evidence did not report success"
[[ ! -e "$remote_archive" && ! -L "$remote_archive" ]] || fail "claimed archive remained in incoming"
[[ ! -e "$remote_evidence" && ! -L "$remote_evidence" ]] || fail "claimed evidence remained in incoming"
if sudo find "$PROCESSING_DIR" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    fail "root-only processing data was not cleaned"
fi
sudo find "$VALIDATION_DIR" -mindepth 1 -maxdepth 1 -type d -name 'release.*' -print -quit | grep -q . \
    || fail "dry-run did not retain its validation tree"

printf 'production deploy manager integration tests passed\n'
