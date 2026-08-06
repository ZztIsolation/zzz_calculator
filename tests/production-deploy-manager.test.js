import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const productionDir = path.join(root, "deploy", "production")
const managerPath = path.join(productionDir, "zzz-calculator-deploy")
const bootstrapPath = path.join(productionDir, "bootstrap-zzz-calculator-deploy.sh")
const validationWorkerPath = path.join(productionDir, "zzz-calculator-validation-worker")
const sudoersPath = path.join(productionDir, "zzz-calculator-deploy.sudoers")
const readmePath = path.join(productionDir, "README.md")

for (const filePath of [managerPath, bootstrapPath, validationWorkerPath, sudoersPath, readmePath]) {
    await access(filePath, constants.F_OK)
}

const manager = await readFile(managerPath, "utf8")
const bootstrap = await readFile(bootstrapPath, "utf8")
const validationWorker = await readFile(validationWorkerPath, "utf8")
const sudoers = await readFile(sudoersPath, "utf8")

function includes(contents, token, message = `Missing deployment contract: ${token}`) {
    assert.ok(contents.includes(token), message)
}

function ordered(contents, first, second, message) {
    const firstIndex = contents.indexOf(first)
    const secondIndex = contents.indexOf(second)
    assert.notEqual(firstIndex, -1, `Missing ordered contract: ${first}`)
    assert.notEqual(secondIndex, -1, `Missing ordered contract: ${second}`)
    assert.ok(firstIndex < secondIndex, message)
}

// The sudo target must run under a deterministic interpreter and environment.
assert.match(manager, /^#!\/bin\/bash\r?$/m)
assert.match(bootstrap, /^#!\/bin\/bash\r?$/m)
assert.match(validationWorker, /^#!\/bin\/bash\r?$/m)
for (const contents of [manager, bootstrap]) {
    includes(contents, "set -Eeuo pipefail")
    includes(contents, "umask 027")
    assert.match(contents, /export PATH=['"]\/usr\/sbin:\/usr\/bin:\/sbin:\/bin['"]/)
    includes(contents, "unset BASH_ENV ENV CDPATH GLOBIGNORE NODE_OPTIONS NODE_PATH NPM_CONFIG_PREFIX")
    includes(contents, "IFS=$' \\t\\n'")
}
includes(manager, "LD_PRELOAD LD_LIBRARY_PATH TAR_OPTIONS GZIP BZIP BZIP2 XZ_OPT")
includes(manager, 'unset -f "$inherited_function"')
includes(manager, "unalias -a")
includes(validationWorker, "set -Eeuo pipefail")
includes(validationWorker, "umask 077")
includes(validationWorker, 'readonly VALIDATION_USER="zzzvalidate"')

for (const action of ["audit", "dry-run", "deploy", "rollback"]) {
    assert.match(manager, new RegExp(`case \\"\\$ACTION\\" in[\\s\\S]*${action}`))
}
for (const contract of [
    'readonly DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"',
    'readonly PROCESSING_DIR="${DEPLOY_ROOT}/processing"',
    'readonly HISTORY_DIR="${DEPLOY_ROOT}/history"',
    'readonly VALIDATION_DIR="${DEPLOY_ROOT}/validation"',
    'readonly RELEASE_ROOT="/opt/zzz_calculator/releases"',
    'readonly CURRENT_LINK="/opt/zzz_calculator/current"',
    'readonly LOCK_FILE="/run/lock/zzz-calculator-deploy.lock"',
    'readonly VALIDATION_PORT="8788"',
    'readonly VALIDATION_USER="zzzvalidate"',
    'readonly VALIDATION_WORKER="/usr/local/libexec/zzz-calculator-validation-worker"',
    'readonly VALIDATION_TMPFS_BYTES="$((128 * 1024 * 1024))"',
    'readonly VALIDATION_TMPFS_INODES="16384"',
    'readonly VALIDATION_RUN_TMPFS_BYTES="$((4 * 1024 * 1024))"',
    'readonly MAX_VALIDATION_SEED_BYTES="$((64 * 1024 * 1024))"',
    'readonly MAX_VALIDATION_SEED_ENTRIES="8192"',
    'readonly MAX_VALIDATION_SEED_FILE_BYTES="$((1024 * 1024))"',
]) {
    includes(manager, contract)
}
includes(manager, "flock -n 9", "Server operations must be serialized with a non-blocking file lock")

// Uploaded input is bounded before it is claimed, sealed to a root-only inode,
// and then checked for both archive structure and extracted size.
for (const cap of [
    'readonly MAX_COMPRESSED_BYTES="$((256 * 1024 * 1024))"',
    'readonly MAX_EXPANDED_BYTES="$((1024 * 1024 * 1024))"',
    'readonly MAX_ARCHIVE_ENTRIES="20000"',
    'readonly MAX_EVIDENCE_BYTES="$((1024 * 1024))"',
    'readonly MIN_DISK_HEADROOM_BYTES="$((512 * 1024 * 1024))"',
]) {
    includes(manager, cap)
}
includes(manager, '(( source_size <= max_bytes )) || die "uploaded file exceeds its size limit"')
ordered(
    manager,
    '(( source_size <= max_bytes )) || die "uploaded file exceeds its size limit"',
    'mv -T -- "$source" "$untrusted"',
    "The upload size cap must be checked before the incoming file is claimed",
)
includes(manager, "cp --reflink=never")
includes(manager, "ulimit -f")
includes(manager, 'chown root:root "$sealed_tmp"')
includes(manager, 'chmod 0640 "$sealed_tmp"')
includes(manager, "claimed upload must not be hard-linked")
includes(manager, "incoming and processing must share a filesystem")
includes(manager, '(( ARCHIVE_ENTRY_COUNT <= MAX_ARCHIVE_ENTRIES ))')
includes(manager, "archive contains duplicate paths")
includes(manager, "archive contains a link or special entry")
includes(manager, "artifact expanded size is invalid or exceeds 1 GiB")
assert.match(
    manager,
    /extract_and_validate\(\)[\s\S]*validate_archive_listing[\s\S]*check_disk_headroom[\s\S]*tar --no-same-owner --no-same-permissions --no-acls --no-xattrs/,
)
includes(manager, '[[ "$(tree_size_bytes "$destination")" -le "$MAX_EXPANDED_BYTES" ]]')

// Evidence is coupled to the exact archive and must be persisted atomically.
includes(manager, "evidence artifact path contains control characters")
includes(manager, '[[ "$evidence_size" == "$ARTIFACT_SIZE_BYTES" ]]')
includes(manager, '[[ "$evidence_sha" == "$ARTIFACT_SHA256" ]]')
includes(manager, '[[ "${evidence_archive##*/}" == "$ARTIFACT_BASENAME" ]]')
includes(manager, "evidence filename does not match the artifact filename")
includes(manager, '[[ ! -e "$EVIDENCE_PATH" && ! -L "$EVIDENCE_PATH" ]] || return 1')
includes(manager, 'evidence_tmp="$(mktemp "${HISTORY_DIR}/.evidence.XXXXXXXX")" || return 1')
includes(manager, 'chmod 0640 "$evidence_tmp"')
includes(manager, 'mv -T -- "$evidence_tmp" "$EVIDENCE_PATH"')
includes(manager, "validate_evidence_json")
includes(manager, "def required_keys:")
includes(manager, "and (keys == required_keys)")
includes(manager, 'and (all(.[]; type == "string"))')
includes(manager, 'preflight_evidence_storage')
assert.match(
    manager,
    /preflight_evidence_storage\(\)[\s\S]*emit_evidence_json "not-switched"[\s\S]*validate_evidence_json/,
    "Evidence rendering and its complete jq schema must be proven before an operation",
)
assert.match(
    manager,
    /main\(\)[\s\S]*acquire_lock[\s\S]*preflight_evidence_storage[\s\S]*capture_before/,
    "Evidence writability must be proven before baseline capture",
)
assert.match(
    manager,
    /if write_evidence; then[\s\S]*else[\s\S]*ERROR_MESSAGE="failed to persist deployment evidence"[\s\S]*STATUS="failed"[\s\S]*exit_code=1/,
    "Evidence persistence failure must turn a nominal deployment into a failure",
)
assert.match(
    manager,
    /if \[\[ "\$evidence_ok" != "1" && "\$SWITCH_STATE" == "switched" \]\]; then[\s\S]*rollback_uncommitted_switch/,
    "A switched deployment with missing evidence must be rolled back",
)

// Candidate and rollback trees are immutable and readable, but not writable,
// by the application account.
includes(manager, 'chown -R root:root "$root"')
includes(manager, 'find "$root" -type d -exec chmod 0755 {} +')
includes(manager, 'find "$root" -type f -exec chmod 0644 {} +')
includes(manager, "release contains a non-root-owned path")
includes(manager, 'runuser -u "$APP_USER" -- test ! -w "$root"')
includes(manager, 'runuser -u "$APP_USER" -- test ! -w "$root/.deployed-commit"')
includes(bootstrap, 'replace_managed_file "$manager_snapshot" "$INSTALL_PATH" 755')
includes(bootstrap, 'create_exact_directory "$PROCESSING_DIR" root root 700')
includes(bootstrap, 'create_exact_directory "$HISTORY_DIR" root root 750')
includes(bootstrap, 'create_exact_directory "$VALIDATION_DIR" root root 750')
includes(bootstrap, 'readonly VALIDATION_USER="zzzvalidate"')
includes(bootstrap, 'useradd --system --gid "$VALIDATION_GROUP" --home-dir "$VALIDATION_HOME"')
includes(bootstrap, '--no-create-home --shell /usr/sbin/nologin "$VALIDATION_USER"')
includes(bootstrap, 'verify_account_contract "$VALIDATION_USER" "$VALIDATION_GROUP" "$VALIDATION_HOME" /usr/sbin/nologin')
includes(bootstrap, "failed to lock the validation account password")
includes(bootstrap, '"$(id -G "$user")" == "$expected_gid"')
includes(bootstrap, "existing account has an unexpected primary or supplementary group")
includes(bootstrap, '[[ ! -e "$VALIDATION_HOME" && ! -L "$VALIDATION_HOME" ]]')
includes(bootstrap, 'replace_managed_file "$worker_snapshot" "$VALIDATION_WORKER_PATH" 555')
for (const dependency of ["base64", "journalctl", "sudo", "systemd-run", "timeout"]) {
    assert.match(bootstrap, new RegExp(`(?:^|\\s)${dependency}(?:\\s|\\\\$)`), `Bootstrap does not preflight ${dependency}`)
}
for (const absoluteDependency of ["base64", "journalctl", "sudo", "systemd-run", "timeout"]) {
    includes(bootstrap, `/usr/bin/${absoluteDependency}`)
}
for (const absoluteExecutable of [
    "/bin/bash",
    "/usr/bin/base64",
    "/usr/bin/cmp",
    "/usr/bin/cp",
    "/usr/bin/df",
    "/usr/bin/env",
    "/usr/bin/journalctl",
    "/usr/bin/mkdir",
    "/usr/bin/node",
    "/usr/bin/stat",
    "/usr/bin/systemd-run",
    "/usr/bin/tail",
    "/usr/bin/timeout",
    "/usr/bin/tr",
]) {
    includes(manager, absoluteExecutable)
}
assert.doesNotMatch(bootstrap, /install -d[^\n]*"?\$LOCK_DIR"?/, "Bootstrap must not normalize the shared lock directory")
includes(bootstrap, 'create_exact_directory "$RELEASE_ROOT" root root 755')
assert.match(
    bootstrap,
    /create_exact_directory\(\)[\s\S]*if path_exists "\$path"[\s\S]*return 0[\s\S]*install -d/,
    "Existing managed directories must be verified without metadata normalization",
)

// A persisted data directory may only resolve to current/data; validation runs
// in an empty environment and never receives a production data path.
includes(manager, 'data_dir="$(process_environment_value "$pid" ZZZ_CALCULATOR_DATA_DIR || true)"')
includes(manager, '[[ "$lexical_data" == "$CURRENT_LINK/data" ]]')
includes(manager, "ZZZ_CALCULATOR_DATA_DIR must be unset or lexically resolve to /opt/zzz_calculator/current/data")
const validationProbe = manager.match(/run_validation_probe\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(validationProbe, '/usr/bin/systemd-run --quiet --unit "$unit_base"')
includes(validationProbe, '--property "User=$VALIDATION_USER"')
includes(validationProbe, "--property SupplementaryGroups=")
includes(validationProbe, "--property PrivateNetwork=yes")
includes(validationProbe, "--property PrivateMounts=yes")
includes(validationProbe, "--property PrivateTmp=no")
includes(validationProbe, "--property PrivateIPC=yes")
includes(validationProbe, "--property ProtectSystem=strict")
includes(
    validationProbe,
    '--property "InaccessiblePaths=-/opt/zzz_calculator -/var/lib/zzz-calculator -/srv/zzz-download-origin"',
)
includes(validationProbe, '--property "BindReadOnlyPaths=$release_dir:/zzz-validation/app"')
includes(validationProbe, "TemporaryFileSystem=/zzz-validation:rw,nosuid,nodev,noexec,size=${VALIDATION_TMPFS_BYTES}")
includes(validationProbe, "/run:rw,nosuid,nodev,noexec,size=${VALIDATION_RUN_TMPFS_BYTES}")
includes(validationProbe, "/var/lib/zzz-calculator-deploy:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000")
for (const hiddenWritablePath of ["/tmp", "/var/tmp", "/dev/shm"]) {
    includes(validationProbe, `${hiddenWritablePath}:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000`)
}
includes(validationProbe, '--property "RestrictAddressFamilies=AF_INET AF_INET6"')
includes(validationProbe, "--property StandardOutput=null")
includes(validationProbe, "--property StandardError=null")
includes(validationProbe, "--property KillMode=control-group")
includes(validationProbe, "--property MemoryLimit=768M")
includes(validationProbe, "--property CPUQuota=200%")
includes(validationProbe, "--property TasksMax=64")
includes(validationProbe, "--property LimitFSIZE=1M")
includes(validationProbe, "HOME=/zzz-validation/home")
includes(validationProbe, "ZZZ_CALCULATOR_DATA_DIR=/zzz-validation/data")
includes(validationProbe, '/bin/bash "$VALIDATION_WORKER" /zzz-validation/app /zzz-validation')
for (const limitCheck of [
    "seed_size <= MAX_VALIDATION_SEED_BYTES",
    "seed_entries <= MAX_VALIDATION_SEED_ENTRIES",
    "largest_seed_file <= MAX_VALIDATION_SEED_FILE_BYTES",
]) {
    includes(validationProbe, limitCheck)
}
assert.doesNotMatch(validationProbe, /runuser -u "\$APP_USER"/, "Candidate code must not run as the production account")
assert.doesNotMatch(validationProbe, /journalctl|server\.log/, "Candidate-controlled output must not be returned from validation")
assert.match(
    manager,
    /stop_validation_probe\(\)[\s\S]*systemctl stop[\s\S]*ControlGroup[\s\S]*cgroup\.procs[\s\S]*reset-failed/,
    "Transient validation must stop and verify its complete cgroup",
)
assert.match(
    manager,
    /copy_release_for_validation\(\)[\s\S]*source_tree_before[\s\S]*--exclude='\.\/data'[\s\S]*user_drive_discs\.example\.json[\s\S]*source_tree_after[\s\S]*prepare_immutable_release "\$destination"[\s\S]*assert_sanitized_validation_data/,
    "Validation must make a hash-verified immutable private copy of every source release",
)
const privateReleaseCopy = manager.match(/copy_release_for_validation\(\)[\s\S]*?^}/m)?.[0] ?? ""
assert.doesNotMatch(privateReleaseCopy, /cp -a --reflink=never/, "Private release copy must never copy the source data tree")
includes(privateReleaseCopy, '"$destination/data/user_drive_discs.json"')
includes(privateReleaseCopy, 'cmp -- "$destination/data/user_drive_discs.example.json" "$destination/data/user_drive_discs.json"')
assert.match(
    manager,
    /run_four_stage_validation\(\)[\s\S]*copy_release_for_validation current[\s\S]*copy_release_for_validation candidate[\s\S]*copy_release_for_validation rollback[\s\S]*run_validation_probe current "\$current_copy"[\s\S]*run_validation_probe candidate "\$candidate_copy"[\s\S]*run_validation_probe rollback "\$rollback_copy"/,
    "All validation stages must execute private release copies",
)
const validationResultRecorder = manager.match(/record_validation_unit_result\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(validationResultRecorder, "VALIDATION_UNIT_RESULTS")
assert.doesNotMatch(manager, /validationLogTailBase64|VALIDATION_LOG_TAIL_BASE64|server\.log/)
for (const token of [
    'readonly VALIDATION_TMPFS_BYTES="$((128 * 1024 * 1024))"',
    'readonly VALIDATION_RUN_TMPFS_BYTES="$((4 * 1024 * 1024))"',
    'readonly PRODUCTION_RELEASE_ROOT="/opt/zzz_calculator"',
    'readonly PRODUCTION_DEPLOY_ROOT="/var/lib/zzz-calculator-deploy"',
    'readonly PRODUCTION_CURRENT_DATA="/opt/zzz_calculator/current/data"',
    '[[ "$(/usr/bin/stat -f -c %T -- "$probe_root")" == "tmpfs" ]]',
    '[[ "$(/usr/bin/stat -f -c %T -- "$HOST_RUNTIME_DIR")" == "tmpfs" ]]',
    '[[ ! -r "$PRODUCTION_RELEASE_ROOT" && ! -w "$PRODUCTION_RELEASE_ROOT" && ! -x "$PRODUCTION_RELEASE_ROOT" ]]',
    '[[ ! -r "$PRODUCTION_DEPLOY_ROOT" && ! -w "$PRODUCTION_DEPLOY_ROOT" && ! -x "$PRODUCTION_DEPLOY_ROOT" ]]',
    '[[ ! -r "$PRODUCTION_CURRENT_DATA" && ! -w "$PRODUCTION_CURRENT_DATA" && ! -x "$PRODUCTION_CURRENT_DATA" ]]',
    '[[ "$(readlink /proc/self/ns/net)" != "$(readlink /proc/1/ns/net)" ]]',
    '[[ "${#interfaces[@]}" -eq 1 && "${interfaces[0]##*/}" == "lo" ]]',
]) {
    includes(validationWorker, token)
}
for (const hiddenWritablePath of ["HOST_TMP_DIR", "HOST_VAR_TMP_DIR", "HOST_SHM_DIR"]) {
    includes(validationWorker, hiddenWritablePath)
}
const expectedValidationCatalogs = [
    "agents.json",
    "agent_skills.json",
    "anomaly_effects.json",
    "bosses.json",
    "combat_buffs.json",
    "drive_disc_sets.json",
    "stat_rules.json",
    "w_engines.json",
]
for (const catalog of expectedValidationCatalogs) {
    includes(manager, catalog)
    includes(validationWorker, catalog)
}
includes(validationWorker, "trap cleanup EXIT")
includes(validationWorker, "trap on_signal HUP INT TERM")
assert.match(validationWorker, /on_signal\(\)[\s\S]*trap '' HUP INT TERM[\s\S]*exit 128/)
assert.match(validationWorker, /cleanup\(\)[\s\S]*kill -TERM[\s\S]*kill -KILL[\s\S]*wait/)
includes(validationWorker, 'for catalog_name in "${VALIDATION_CATALOG_FILES[@]}" user_drive_discs.example.json')
includes(validationWorker, '/usr/bin/cp -- "$release_dir/data/user_drive_discs.example.json"')
includes(validationWorker, '"$probe_root/data/user_drive_discs.json"')
includes(validationWorker, '/usr/bin/cmp -- "$probe_root/data/user_drive_discs.example.json"')
assert.doesNotMatch(validationWorker, /cp -R|scan-telemetry\//)
includes(validationWorker, '/usr/bin/node "$release_dir/backend/server.js" >/dev/null 2>&1 &')
assert.doesNotMatch(validationWorker, /server\.log/)

// Deployment and rollback require 15 consecutive healthy seconds with one PID,
// then re-check runtime identity, Nginx, and both untouched download manifests.
assert.match(manager, /health_gate\(\)[\s\S]*for attempt in \$\(seq 1 15\)[\s\S]*\[\[ "\$current_pid" == "\$observed_pid" \]\][\s\S]*sleep 1/)
includes(manager, "candidate failed the 15-consecutive-second stable health gate")
includes(manager, "rollback target failed the 15-consecutive-second stable health gate")
for (const token of [
    "HELPER_MANIFEST_SHA256_BEFORE",
    "HELPER_MANIFEST_SHA256_AFTER",
    "SCANNER_MANIFEST_SHA256_BEFORE",
    "SCANNER_MANIFEST_SHA256_AFTER",
    "assert_manifest_invariants",
]) {
    includes(manager, token)
}
assert.match(manager, /run_deploy\(\)[\s\S]*health_gate[\s\S]*assert_effective_runtime_environment[\s\S]*assert_runtime_endpoints[\s\S]*nginx -t[\s\S]*assert_manifest_invariants/)
assert.match(manager, /run_rollback\(\)[\s\S]*health_gate[\s\S]*assert_effective_runtime_environment[\s\S]*assert_runtime_endpoints[\s\S]*nginx -t[\s\S]*assert_manifest_invariants/)
assert.match(
    manager,
    /on_exit\(\)[\s\S]*download manifest changed before evidence commit[\s\S]*if write_evidence/,
    "Manifest invariants must be checked again immediately before evidence commit",
)

// Rollback selection is server-recorded. Neither sudo nor the manager accepts
// a caller-controlled release path.
includes(manager, "zzz-calculator-deploy rollback --previous")
includes(manager, '[[ "$#" -eq 1 && "$1" == "--previous" ]] || die "rollback accepts only --previous"')
includes(manager, 'requested="$(<"$DEPLOY_ROOT/previous-release")"')
assert.match(sudoers, /\/usr\/local\/sbin\/zzz-calculator-deploy rollback --previous(?:\r?$|\s)/m)
assert.doesNotMatch(sudoers, /zzz-calculator-deploy rollback \*/)
assert.doesNotMatch(sudoers, /systemctl|nginx|\/bin\/(?:ba)?sh(?:\s|,|$)/i)

// Bootstrap replaces the complete root-owned SSH authorization directory,
// revokes supplementary groups, locks password login, and restores policy on
// any failed aggregate sudoers validation.
includes(bootstrap, 'command="/usr/local/libexec/zzz-calculator-ssh-gateway",restrict,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc')
includes(bootstrap, 'ssh-keygen -l -f "$key_validation_tmp"')
includes(bootstrap, "set ZZZDEPLOY_PUBLIC_KEY for every bootstrap run")
includes(bootstrap, 'verify_account_contract "$DEPLOY_USER" "$DEPLOY_GROUP" "$DEPLOY_ROOT" /bin/bash')
includes(bootstrap, "failed to lock the deployment account password")
includes(bootstrap, 'ssh_staged="$(mktemp -d "${DEPLOY_ROOT}/.ssh.bootstrap.XXXXXXXX")"')
includes(bootstrap, 'mv -T -- "$SSH_DIR" "${ssh_backup_root}/original"')
includes(bootstrap, 'mv -T -- "$ssh_staged" "$SSH_DIR"')
includes(bootstrap, 'chown root:"$DEPLOY_GROUP" "${ssh_staged}/authorized_keys"')
assert.doesNotMatch(bootstrap, /chown "\$DEPLOY_USER:\$DEPLOY_USER" "\$DEPLOY_ROOT\/\.ssh"/)
includes(bootstrap, 'backup="$(mktemp "${target}.backup.XXXXXXXX")"')
includes(bootstrap, "candidate sudoers policy conflicts with the aggregate configuration")
includes(bootstrap, "rollback_managed_files")
includes(bootstrap, "rollback_ssh_directory")
ordered(
    bootstrap,
    'visudo --check --file "$sudoers_snapshot"',
    'if ! group_is_present "$DEPLOY_GROUP"',
    "Sudoers and key policy must be validated before the deployment account is changed",
)
ordered(
    bootstrap,
    'command -v "$required_command"',
    'if ! group_is_present "$DEPLOY_GROUP"',
    "All external dependencies must be checked before account mutation",
)

assert.doesNotMatch(manager, /localStorage\.clear|indexedDB\.deleteDatabase/i)
assert.doesNotMatch(bootstrap, /localStorage\.clear|indexedDB\.deleteDatabase/i)
assert.doesNotMatch(validationWorker, /localStorage\.clear|indexedDB\.deleteDatabase/i)
assert.match(sudoers, /Defaults!ZZZ_CALCULATOR_DEPLOY env_reset, !setenv, secure_path="\/usr\/sbin:\/usr\/bin:\/sbin:\/bin"/)
assert.match(sudoers, /zzzdeploy ALL=\(root\) NOPASSWD: ZZZ_CALCULATOR_DEPLOY/)

console.log("production deployment manager contract tests passed")
