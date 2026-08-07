#!/bin/bash

set -Eeuo pipefail

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly GATEWAY="${ROOT}/deploy/production/zzz-calculator-ssh-gateway"
readonly PREFIX="0123456789ab"
readonly COMMIT="0123456789abcdef0123456789abcdef01234567"
readonly SHA256="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
readonly ARCHIVE="zzz-calculator-server-${PREFIX}.tar.gz.part"
readonly EVIDENCE="zzz-calculator-server-${PREFIX}.evidence.json.part"
readonly INCOMING="/var/lib/zzz-calculator-deploy/incoming"

fail() {
    printf 'gateway integration test error: %s\n' "$*" >&2
    exit 1
}

classify() {
    /bin/bash "$GATEWAY" --classify "$1"
}

assert_allowed() {
    local command="$1"
    local expected_prefix="$2"
    local output
    output="$(classify "$command")" || fail "expected command to be allowed: ${command}"
    [[ "$output" == "$expected_prefix"* ]] \
        || fail "unexpected classification for allowed command: ${output}"
}

assert_rejected() {
    local command="$1"
    local output status
    set +e
    output="$(classify "$command" 2>&1)"
    status="$?"
    set -e
    [[ "$status" -eq 126 ]] \
        || fail "rejected command returned ${status}, expected 126: ${command}"
    [[ "$output" == *"ssh gateway error: command rejected"* ]] \
        || fail "rejected command did not use the fail-closed error: ${command}"
}

[[ -f "$GATEWAY" && ! -L "$GATEWAY" ]] || fail "gateway source is missing or linked"
/bin/bash -n "$GATEWAY"

assert_allowed \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy audit" \
    $'manager\taudit\taudit'
assert_allowed \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy rollback --previous" \
    $'manager\trollback\trollback\t--previous'
for action in dry-run deploy; do
    assert_allowed \
        "sudo -n /usr/local/sbin/zzz-calculator-deploy ${action} --artifact ${ARCHIVE} --evidence ${EVIDENCE} --expected-sha ${SHA256} --expected-commit ${COMMIT}" \
        $'manager\t'"${action}"$'\t'"${action}"
done
assert_allowed \
    "scp -t ${INCOMING}/${ARCHIVE}" \
    $'upload\tarchive\t'"${INCOMING}/${ARCHIVE}"$'\t268435456'
assert_allowed \
    "scp -t ${INCOMING}/${EVIDENCE}" \
    $'upload\tevidence\t'"${INCOMING}/${EVIDENCE}"$'\t1048576'

# Interactive access, arbitrary programs, option drift, shell metacharacters,
# traversal, mismatched candidate identities, and malformed hashes all fail.
for command in \
    "" \
    "bash" \
    "sh -c id" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy audit --verbose" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy rollback git-deadbeef" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy rollback --previous; id" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy audit && id" \
    'sudo -n /usr/local/sbin/zzz-calculator-deploy audit $(id)' \
    'sudo -n /usr/local/sbin/zzz-calculator-deploy audit `id`' \
    "scp -f ${INCOMING}/${ARCHIVE}" \
    "scp -t -- ${INCOMING}/${ARCHIVE}" \
    "scp -d -t ${INCOMING}/${ARCHIVE}" \
    "scp -t ${INCOMING}/../history/${ARCHIVE}" \
    "scp -t ${INCOMING}/zzz-calculator-server-${PREFIX}.tar.gz" \
    "scp -t ${INCOMING}/zzz-calculator-server-${PREFIX}.tar.gz.part/extra" \
    "scp -t ${INCOMING}/zzz-calculator-server-${PREFIX^^}.tar.gz.part" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy dry-run --artifact ../${ARCHIVE} --evidence ${EVIDENCE} --expected-sha ${SHA256} --expected-commit ${COMMIT}" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy deploy --artifact ${ARCHIVE} --evidence zzz-calculator-server-deadbeefdead.evidence.json.part --expected-sha ${SHA256} --expected-commit ${COMMIT}" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy deploy --artifact ${ARCHIVE} --evidence ${EVIDENCE} --expected-sha ${SHA256%a} --expected-commit ${COMMIT}" \
    "sudo -n /usr/local/sbin/zzz-calculator-deploy deploy --artifact ${ARCHIVE} --evidence ${EVIDENCE} --expected-sha ${SHA256} --expected-commit deadbeefdead${COMMIT:12}" \
    $'sudo -n /usr/local/sbin/zzz-calculator-deploy audit\nid' \
    $'sudo -n /usr/local/sbin/zzz-calculator-deploy audit\rid' \
    $'sudo -n /usr/local/sbin/zzz-calculator-deploy\taudit'; do
    assert_rejected "$command"
done

set +e
interactive_output="$(env -u SSH_ORIGINAL_COMMAND /bin/bash "$GATEWAY" 2>&1)"
interactive_status="$?"
set -e
[[ "$interactive_status" -eq 126 ]] || fail "empty SSH command did not return 126"
[[ "$interactive_output" == *"interactive sessions are disabled"* ]] \
    || fail "empty SSH command did not report disabled interactive access"

printf 'production SSH gateway integration tests passed\n'
