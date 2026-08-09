import assert from "node:assert/strict"
import { createHash } from "node:crypto"
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
const gitAttributesPath = path.join(root, ".gitattributes")
const fallbackSourcePath = path.join(root, "webapp", "src", "utils", "assets.ts")

for (const filePath of [managerPath, bootstrapPath, validationWorkerPath, sudoersPath, readmePath]) {
    await access(filePath, constants.F_OK)
}

const manager = await readFile(managerPath, "utf8")
const bootstrap = await readFile(bootstrapPath, "utf8")
const validationWorker = await readFile(validationWorkerPath, "utf8")
const sudoers = await readFile(sudoersPath, "utf8")
const gitAttributes = await readFile(gitAttributesPath, "utf8")
const fallbackSource = await readFile(fallbackSourcePath, "utf8")

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
    'readonly LEGACY_CURRENT_BASENAME="git-2e7f874bc034"',
    'readonly LEGACY_CURRENT_COMMIT="2e7f874bc034871f03b5738f48d7d05685b36ea9"',
    'readonly LEGACY_CURRENT_TREE_SHA256="d5d9e7a43f20a899c3638e0a675a774e80930ca0f878d5fd188f04e85fc16f8e"',
    'readonly LEGACY_CURRENT_PORTABLE_SHA256="c77a6bfed6417cf8c27a90c0515f70e26127d08a6edff447e89e1c9bbc37cb51"',
    'readonly LEGACY_CURRENT_STATIC_SHA256="c77a6bfed6417cf8c27a90c0515f70e26127d08a6edff447e89e1c9bbc37cb51"',
    'readonly LEGACY_STATE_LAST="git-2e7f874bc034"',
    'readonly LEGACY_STATE_PREVIOUS="rollback-2e7f874bc034"',
    'readonly LEGACY_MIGRATION_MARKER="${DEPLOY_ROOT}/legacy-current-migrated"',
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
    'readonly MIN_DISK_HEADROOM_INODES="32768"',
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
includes(manager, 'DISK_REQUIRED_INODES="$((4 * ARCHIVE_ENTRY_COUNT + 6 * CURRENT_TREE_ENTRY_COUNT + MIN_DISK_HEADROOM_INODES))"')
includes(manager, 'DISK_AVAILABLE_INODES="$(df -Pi -- "$destination" | awk')
includes(manager, "archive contains duplicate paths")
includes(manager, "archive contains a link or special entry")
includes(manager, "artifact expanded size is invalid or exceeds 1 GiB")
assert.match(
    manager,
    /extract_and_validate\(\)[\s\S]*validate_archive_listing[\s\S]*check_disk_headroom[\s\S]*tar --no-same-owner --no-same-permissions --no-acls --no-xattrs/,
)
includes(manager, '[[ "$(tree_size_bytes "$destination")" -le "$MAX_EXPANDED_BYTES" ]]')

// Evidence is coupled to the exact archive and must be persisted atomically.
includes(manager, 'local separator="${3-,}"')
assert.doesNotMatch(manager, /local separator="\$\{3:-,\}"/)
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
includes(manager, '["not-run", "clean", "failed"] | index($cleanup)')
assert.doesNotMatch(manager, /\["not-run", "pending", "clean", "failed"\]/)
includes(manager, 'and (all(.[]; type == "string"))')
for (const evidenceField of [
    "currentReleasePolicy",
    "currentTreeSha256Before",
    "currentTreeSha256After",
    "currentPortableSha256Before",
    "currentPortableSha256After",
    "currentStaticSha256Before",
    "currentStaticSha256After",
    "currentTreeMetadataSha256Before",
    "currentTreeMetadataSha256After",
    "currentTreeEntryCount",
    "currentTreeFileCount",
    "currentTreeBytes",
    "statePreviousExistedBefore",
    "statePreviousBefore",
    "statePreviousExistedAfter",
    "statePreviousAfter",
    "stateLastExistedBefore",
    "stateLastBefore",
    "stateLastExistedAfter",
    "stateLastAfter",
    "migrationMarkerExistedBefore",
    "migrationMarkerValueBefore",
    "migrationMarkerExistedAfter",
    "migrationMarkerValueAfter",
    "artifactSizeBytes",
    "archiveEntryCount",
    "archiveExpandedBytes",
    "diskRequiredBytes",
    "diskAvailableBytes",
    "nRestartsBefore",
    "nRestartsAfter",
    "diskRequiredInodes",
    "diskAvailableInodes",
]) {
    includes(manager, evidenceField)
}
includes(manager, "def state_snapshot_unchanged:")
includes(manager, "def artifact_metadata_complete:")
includes(manager, "def validation_complete:")
includes(manager, "def managed_state_after:")
includes(manager, 'if .status == "success" and .action == "audit"')
includes(manager, 'if .status == "success" and .action == "dry-run"')
includes(manager, 'if .status == "success" and .action == "deploy"')
includes(manager, 'if .status == "success" and .action == "rollback"')
includes(manager, 'capture_state_after_for_evidence')
assert.match(
    manager,
    /write_evidence\(\)[\s\S]*capture_state_after_for_evidence[\s\S]*emit_evidence_json/,
    "Evidence must capture the final state tuple immediately before rendering",
)
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
    /if write_evidence; then[\s\S]*else[\s\S]*ERROR_MESSAGE="\$\{ERROR_MESSAGE\}; \$\{evidence_failure_detail\}"[\s\S]*STATUS="failed"[\s\S]*exit_code=1/,
    "Evidence persistence failure must turn a nominal deployment into a failure",
)
assert.match(
    manager,
    /if \[\[ "\$evidence_ok" != "1" \]\]; then[\s\S]*attempt_automatic_rollback "evidence persistence failure"/,
    "A switched deployment with missing evidence must be rolled back",
)
includes(manager, 'attempt_automatic_rollback "post-cleanup failure"')
includes(manager, 'attempt_automatic_rollback "final invariant failure"')
includes(manager, 'attempt_automatic_rollback "evidence persistence failure"')
includes(manager, "automatic rollback attempts exhausted")
includes(manager, "CRITICAL operation ended with an uncommitted production switch")
assert.doesNotMatch(manager, /rollback_uncommitted_switch\s*\|\|\s*true/)
assert.doesNotMatch(manager, /attempt_automatic_rollback[^\r\n]*\|\|\s*true/)
assert.match(
    manager,
    /rollback_uncommitted_switch\(\)[\s\S]*actual_current="\$\(current_target\)"[\s\S]*\[\[ "\$actual_current" == "\$SWITCH_TARGET" \]\] \|\| return 1[\s\S]*atomic_switch "\$SWITCH_ROLLBACK_TARGET" \|\| return 1/,
    "Automatic rollback must not overwrite an unrelated current target",
)
assert.match(
    manager,
    /rollback_uncommitted_switch\(\)[\s\S]*health_gate \|\| return 1[\s\S]*verify_rollback_runtime "\$SWITCH_ROLLBACK_TARGET" \|\| return 1[\s\S]*record_managed_current/,
    "Automatic rollback must verify the exact running rollback release before recording state",
)
assert.match(
    manager,
    /verify_rollback_runtime\(\) \([\s\S]*current_target[\s\S]*assert_production_release[\s\S]*assert_effective_runtime_environment[\s\S]*assert_runtime_endpoints[\s\S]*nginx -t[\s\S]*manifest_sha256/,
    "Recovered runtime verification must bind current, process, endpoints, Nginx, and manifests",
)
assert.match(
    manager,
    /rollback_uncommitted_switch\(\)[\s\S]*SWITCH_ROLLBACK_TARGET.*SWITCH_ORIGINAL_TARGET[\s\S]*record_managed_current "\$rollback_previous" "\$rollback_basename"/,
    "Automatic compatibility rollback must record the actual restored immutable release",
)

// Production trees are readable but not writable by both runtime principals.
// Private validation trees remain unreadable to the production application
// account while retaining the same root-owned immutable tree contract.
includes(manager, 'chown -R root:root "$root"')
includes(manager, 'find "$root" -xdev -type d -exec chmod 0755 {} +')
includes(manager, 'find "$root" -xdev -type f -exec chmod 0644 {} +')
includes(manager, "release contains a non-root-owned path")
includes(manager, "release contains a symbolic link")
includes(manager, "release contains a special path")
includes(manager, "release contains a hard-linked file")
includes(manager, '"root:root:755" ]] || die "deployment root must be root-owned mode 0755"')
includes(manager, '"root:zzzdeploy:770" ]] || die "incoming directory must be root:zzzdeploy mode 0770"')
includes(manager, '"root:root:750" ]] || die "history directory must be root-owned mode 0750"')
includes(manager, 'assert_release_tree_access_for_user "$root" "$APP_USER"')
includes(manager, 'assert_release_tree_access_for_user "$root" "$VALIDATION_USER"')
const releaseAccess = manager.match(/assert_release_tree_access_for_user\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(releaseAccess, 'cd -- "$root"')
includes(releaseAccess, 'runuser -u "$runtime_user" -- test -r "./$key_file"')
includes(releaseAccess, 'runuser -u "$runtime_user" -- test ! -w .')
includes(releaseAccess, 'runuser -u "$runtime_user" -- test ! -w ./.deployed-commit')
assert.doesNotMatch(releaseAccess, /test -[rw] "\$root\//)
const releasePathAccess = manager.match(/assert_release_path_access_for_user\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(releasePathAccess, 'assert_release_path_readable_for_user "$root" "$runtime_user"')
includes(releasePathAccess, 'assert_release_path_not_writable_for_user "$root" "$runtime_user"')
const releasePathReadable = manager.match(/assert_release_path_readable_for_user\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(releasePathReadable, 'runuser -u "$runtime_user" -- test -r "$root/$key_file"')
const releasePathNotWritable = manager.match(/assert_release_path_not_writable_for_user\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(releasePathNotWritable, 'runuser -u "$runtime_user" -- test ! -w "$root"')
includes(releasePathNotWritable, 'runuser -u "$runtime_user" -- test ! -w "$root/.deployed-commit"')
const currentCompatibility = manager.match(/assert_current_release_compatible\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(currentCompatibility, 'CURRENT_RELEASE_POLICY="managed-immutable"')
includes(currentCompatibility, 'CURRENT_RELEASE_POLICY="legacy-writable"')
includes(currentCompatibility, 'assert_legacy_current_release "$CURRENT_BEFORE"')
includes(currentCompatibility, 'assert_exact_legacy_state_tuple')
includes(currentCompatibility, 'assert_managed_state_tuple "$current_basename"')
const exactLegacyState = manager.match(/assert_exact_legacy_state_tuple\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(exactLegacyState, 'STATE_LAST_BEFORE" == "$LEGACY_STATE_LAST')
includes(exactLegacyState, 'STATE_PREVIOUS_BEFORE" == "$LEGACY_STATE_PREVIOUS')
includes(exactLegacyState, 'LEGACY_MIGRATION_MARKER_EXISTED" == "0')
const stateReader = manager.match(/read_state_file_snapshot\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(stateReader, 'root:root:640:1')
includes(stateReader, 'must contain exactly one newline-terminated basename')
assert.doesNotMatch(stateReader, /\[\[ -f "\$path"[^\n]*\]\] \|\| return 0/)
const legacyCurrent = manager.match(/assert_legacy_current_release\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(legacyCurrent, 'release_matches_exact_contract "$root" "$APP_USER" "$APP_GROUP" 755 644')
includes(legacyCurrent, 'assert_release_path_not_writable_for_user "$root" "$VALIDATION_USER"')
includes(legacyCurrent, 'CURRENT_TREE_SHA256_BEFORE')
includes(legacyCurrent, 'CURRENT_STATIC_SHA256_BEFORE')
includes(legacyCurrent, 'server-side inventory data')
assert.doesNotMatch(legacyCurrent, /chown|chmod|prepare_/)
assert.doesNotMatch(manager, /assert_release_path_access_for_user "\$CURRENT_BEFORE"/)
includes(manager, 'prepare_immutable_release "$candidate_dir"')
includes(manager, 'prepare_immutable_release "$rollback_dir"')
includes(manager, 'assert_root_private_release_access "$destination"')
includes(manager, 'prepare_production_release "$CANDIDATE_STAGING"')
includes(manager, 'prepare_production_release "$ROLLBACK_STAGING"')
includes(manager, 'assert_production_release "$candidate_target"')
includes(manager, 'assert_production_release "$rollback_target"')
assert.match(
    manager,
    /atomic_switch\(\)[\s\S]*ln -s -- "\$target" "\$next_link" \|\| return 1[\s\S]*mv -Tf -- "\$next_link" "\$CURRENT_LINK" \|\| return 1[\s\S]*\[\[ "\$\(current_target\)" == "\$target" \]\]/,
    "Atomic switch must check every filesystem mutation and verify the resolved target",
)
includes(manager, 'assert_live_current_matches_baseline "immediately before the atomic switch"')
const privateValidationAccess = manager.match(/assert_private_validation_release_access\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(privateValidationAccess, 'assert_release_path_access_for_user "$root" "$VALIDATION_USER"')
includes(privateValidationAccess, 'runuser -u "$APP_USER" -- test ! "$denied_mode" "$root"')
includes(privateValidationAccess, 'runuser -u "$APP_USER" -- test ! -r "$root/$key_file"')
for (const productionFunction of ["prepare_production_release", "assert_production_release"]) {
    const body = manager.match(new RegExp(`${productionFunction}\\(\\)[\\s\\S]*?^}`, "m"))?.[0] ?? ""
    includes(body, 'assert_release_path_access_for_user "$root" "$APP_USER"')
    includes(body, 'assert_release_path_access_for_user "$root" "$VALIDATION_USER"')
}
assert.equal((releaseAccess.match(/\|\| die /g) ?? []).length, 3)
assert.doesNotMatch(releaseAccess, /\(cd[^)]*\bdie\b/)
const validationJob = manager.match(/prepare_validation_job\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(validationJob, "local denied_mode")
includes(validationJob, 'chown root:"$VALIDATION_GROUP" "$VALIDATION_DIR" "$VALIDATION_JOB_DIR"')
includes(validationJob, 'chmod 0750 "$VALIDATION_DIR" "$VALIDATION_JOB_DIR"')
includes(validationJob, 'runuser -u "$VALIDATION_USER" -- test -x "$VALIDATION_JOB_DIR"')
includes(validationJob, 'runuser -u "$APP_USER" -- test ! "$denied_mode" "$VALIDATION_JOB_DIR"')
assert.doesNotMatch(validationJob, /chmod 0755|chown[^\n]*APP_(?:USER|GROUP)/)

const currentSealing = manager.match(/seal_current_release\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(currentSealing, 'assert_live_current_matches_baseline "before sealing the current release"')
includes(currentSealing, 'tar --one-file-system --no-acls --no-xattrs -cf - .')
includes(currentSealing, 'assert_live_current_matches_baseline "after sealing the current release"')
includes(currentSealing, 'prepare_immutable_release "$destination"')
includes(currentSealing, 'assert_root_private_release_access "$destination"')
includes(currentSealing, 'assert_snapshot_capacity "$PROCESSING_JOB_DIR"')
includes(currentSealing, '"$destination" == "$PROCESSING_JOB_DIR/"*')
assert.doesNotMatch(currentSealing, /VALIDATION_JOB_DIR|prepare_private_validation_release/)
const processingJob = manager.match(/prepare_processing_job\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(processingJob, 'mktemp -d "${PROCESSING_DIR}/job.XXXXXXXX"')
includes(processingJob, 'chmod 0700 "$PROCESSING_JOB_DIR"')
const managedStateCommit = manager.match(/record_managed_current\(\)[\s\S]*?^}/m)?.[0] ?? ""
ordered(
    managedStateCommit,
    'write_state_file previous-release "$previous"',
    'write_state_file last-release "$last"',
    "previous-release must be committed before last-release",
)
ordered(
    managedStateCommit,
    'write_state_file last-release "$last"',
    'write_migration_marker',
    "The monotonic migration marker must be written last",
)
const dryRun = manager.match(/run_dry_run\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(dryRun, 'seal_current_release "$CURRENT_BEFORE" "$current_snapshot"')
includes(dryRun, 'current_snapshot="${PROCESSING_JOB_DIR}/sources/current"')
includes(dryRun, 'cp -a --reflink=never -- "$current_snapshot/." "$rollback_dir/"')
includes(dryRun, 'merge_compatible_resources "$current_snapshot" "$candidate_dir" "$rollback_dir"')
includes(dryRun, 'run_four_stage_validation "$current_snapshot" "$candidate_dir" "$rollback_dir"')
assert.doesNotMatch(dryRun, /cp -a[^\n]*CURRENT_BEFORE|merge_compatible_resources "\$CURRENT_BEFORE"|run_four_stage_validation "\$CURRENT_BEFORE"/)
const deploy = manager.match(/run_deploy\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(deploy, 'seal_current_release "$CURRENT_BEFORE" "$current_snapshot"')
includes(deploy, 'current_snapshot="${PROCESSING_JOB_DIR}/sources/current"')
includes(deploy, 'cp -a --reflink=never -- "$current_snapshot/." "$ROLLBACK_STAGING/"')
includes(deploy, 'merge_compatible_resources "$current_snapshot" "$CANDIDATE_STAGING" "$ROLLBACK_STAGING"')
includes(deploy, 'run_four_stage_validation "$current_snapshot" "$CANDIDATE_STAGING" "$ROLLBACK_STAGING"')
assert.doesNotMatch(deploy, /cp -a[^\n]*CURRENT_BEFORE|merge_compatible_resources "\$CURRENT_BEFORE"|run_four_stage_validation "\$CURRENT_BEFORE"/)
includes(manager, 'CURRENT_TREE_SHA256_BEFORE="$(tree_sha256 "$CURRENT_BEFORE")"')
includes(manager, 'CURRENT_PORTABLE_SHA256_BEFORE="$(portable_tree_sha256 "$CURRENT_BEFORE" full)"')
includes(manager, 'CURRENT_STATIC_SHA256_BEFORE="$(portable_tree_sha256 "$CURRENT_BEFORE" static)"')
includes(manager, 'CURRENT_TREE_METADATA_SHA256_BEFORE="$(tree_metadata_sha256 "$CURRENT_BEFORE")"')
includes(manager, 'current release content changed during isolated validation')
includes(manager, 'current release metadata changed during isolated validation')
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
for (const contents of [bootstrap, manager]) {
    includes(contents, "password_status_is_locked()")
    includes(contents, "L|LK) return 0")
    includes(contents, "*) return 1")
}
assert.doesNotMatch(bootstrap, /\[\[ "\$lock_status" == "L" \]\]/)
assert.doesNotMatch(manager, /\[\[ "\$password_status" == "L" \]\]/)
includes(bootstrap, '[[ ! -e "$VALIDATION_HOME" && ! -L "$VALIDATION_HOME" ]]')
includes(bootstrap, 'replace_managed_file "$worker_snapshot" "$VALIDATION_WORKER_PATH" 555')
for (const dependency of ["base64", "ipcmk", "ipcrm", "journalctl", "sudo", "systemctl", "systemd-run", "timeout"]) {
    assert.match(bootstrap, new RegExp(`(?:^|\\s)${dependency}(?:\\s|\\\\$)`), `Bootstrap does not preflight ${dependency}`)
}
for (const absoluteDependency of ["base64", "ipcmk", "ipcrm", "journalctl", "sudo", "systemctl", "systemd-run", "timeout"]) {
    includes(bootstrap, `/usr/bin/${absoluteDependency}`)
}
for (const absoluteExecutable of [
    "/bin/bash",
    "/usr/bin/base64",
    "/usr/bin/cmp",
    "/usr/bin/cp",
    "/usr/bin/df",
    "/usr/bin/env",
    "/usr/bin/ipcmk",
    "/usr/bin/ipcrm",
    "/usr/bin/journalctl",
    "/usr/bin/mkdir",
    "/usr/bin/node",
    "/usr/bin/stat",
    "/usr/bin/systemctl",
    "/usr/bin/systemd-run",
    "/usr/bin/tail",
    "/usr/bin/timeout",
    "/usr/bin/tr",
]) {
    includes(manager, absoluteExecutable)
}
assert.doesNotMatch(bootstrap, /install -d[^\n]*"?\$LOCK_DIR"?/, "Bootstrap must not normalize the shared lock directory")
includes(bootstrap, 'create_exact_directory "$RELEASE_ROOT" root root 755')
includes(bootstrap, 'readonly APP_USER="zzzcalc"')
includes(bootstrap, 'readonly APP_GROUP="zzzcalc"')
includes(bootstrap, 'root:root:755|"${APP_USER}:${APP_GROUP}:755"')
includes(bootstrap, 'prepare_release_parent')
includes(bootstrap, 'chown --no-dereference root:root -- "$RELEASE_PARENT"')
includes(bootstrap, 'rollback_release_parent_metadata')
includes(bootstrap, 'require_exact_directory_if_present "$RELEASE_PARENT" root root 755')
for (const startupFile of [".bashrc", ".bash_profile", ".bash_login", ".profile", ".bash_logout"]) {
    includes(bootstrap, `"\${DEPLOY_ROOT}/${startupFile}"`)
}
includes(bootstrap, 'install -o root -g root -m 0600 /dev/null "$empty_shell_startup_snapshot"')
includes(bootstrap, 'replace_managed_file "$empty_shell_startup_snapshot" "$shell_startup_path" 644')
includes(bootstrap, 'file_matches_contract "$empty_shell_startup_snapshot" "$shell_startup_path" 644')
assert.match(
    bootstrap,
    /replace_managed_file "\$empty_shell_startup_snapshot" "\$shell_startup_path" 644[\s\S]*replace_managed_file "\$gateway_snapshot" "\$SSH_GATEWAY_PATH" 555[\s\S]*install_ssh_directory "\$expected_authorized_key"/,
    "Account startup files and the forced gateway must be secured before the restricted SSH key is activated",
)
assert.match(
    bootstrap,
    /on_exit\(\)[\s\S]*rollback_ssh_directory[\s\S]*rollback_managed_files/,
    "Rollback must restore the previous SSH directory before account startup files",
)
assert.equal(
    (bootstrap.match(/^require_exact_directory_if_present "\$RELEASE_PARENT" root root 755\r?$/gm) ?? []).length,
    1,
    "The release parent should require its final root-owned contract exactly once",
)
assert.equal(
    (bootstrap.match(/^[ \t]*create_exact_directory "\$RELEASE_PARENT" root root 755\r?$/gm) ?? []).length,
    1,
    "Only the dedicated release-parent helper may create a missing parent",
)
assert.match(
    bootstrap,
    /require_release_parent_if_present\r?\nrequire_exact_directory_if_present "\$RELEASE_ROOT" root root 755/,
    "Legacy release-parent compatibility must be checked before the transaction",
)
assert.match(
    bootstrap,
    /prepare_release_parent\r?\ncreate_exact_directory "\$RELEASE_ROOT" root root 755/,
    "The transaction must harden the release parent before managing the release root",
)
assert.match(
    bootstrap,
    /create_exact_directory\(\)[\s\S]*if path_exists "\$path"[\s\S]*return 0[\s\S]*install -d/,
    "Existing managed directories must be verified without metadata normalization",
)

// Non-hashed public assets must use content-versioned URLs. This allows old
// and new releases to retain both byte variants without weakening conflict
// detection for a shared URL.
const mergeMissingFiles = manager.match(/merge_missing_files\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(mergeMissingFiles, 'cmp -s -- "$source" "$destination"')
includes(mergeMissingFiles, "static resource content conflict")
includes(manager, 'local -a resource_trees=("dist/pages/static/app" "dist/pages/assets")')
includes(gitAttributes, "webapp/public/assets/drive-discs/*.svg text eol=lf")
const fallbackMatch = fallbackSource.match(/fallbackIcon = "([^"]+)"/)
assert.ok(fallbackMatch, "The shared fallback icon URL must be explicit")
const fallbackUrl = fallbackMatch[1]
assert.match(fallbackUrl, /^\/assets\/drive-discs\/empty-[0-9a-f]{8}\.svg$/)
const fallbackAssetPath = path.join(root, "webapp", "public", ...fallbackUrl.slice(1).split("/"))
const fallbackAsset = await readFile(fallbackAssetPath)
assert.equal(fallbackAsset.includes(0x0d), false, "The versioned fallback SVG must use LF line endings")
const fallbackSha = createHash("sha256").update(fallbackAsset).digest("hex")
assert.equal(path.basename(fallbackAssetPath), `empty-${fallbackSha.slice(0, 8)}.svg`)
await assert.rejects(
    access(path.join(root, "webapp", "public", "assets", "drive-discs", "empty.svg"), constants.F_OK),
    (error) => error?.code === "ENOENT",
    "The conflicting unversioned fallback URL must not remain in the candidate source tree",
)

// Server-side persistence remains disabled until a separately approved data
// migration exists; validation uses only its isolated temporary data path.
includes(manager, 'data_dir="$(process_environment_value "$pid" ZZZ_CALCULATOR_DATA_DIR || true)"')
includes(manager, '[[ -z "$data_dir" ]] || die "effective production process has ZZZ_CALCULATOR_DATA_DIR configured"')
includes(manager, 'telemetry_dir="$(process_environment_value "$pid" SCAN_TELEMETRY_DIR || true)"')
includes(manager, '[[ -z "$telemetry_dir" ]] || die "effective production process has SCAN_TELEMETRY_DIR configured"')
includes(manager, '.maintenanceEnabled == false and .scanTelemetryEnabled == false')
includes(manager, '"http://127.0.0.1:8787/api/user-drive-discs"')
includes(manager, '[[ "$retired_inventory_status" == "410" ]]')
const validationProfile = manager.match(/select_validation_systemd_profile\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationProperties = manager.match(/build_validation_systemd_properties\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationTransientUnit = manager.match(/run_validation_transient_unit\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationCapabilityProbe = manager.match(/run_validation_sandbox_capability_probe\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationProbe = manager.match(/run_validation_probe\(\)[\s\S]*?^}/m)?.[0] ?? ""
includes(manager, 'readonly MIN_SYSTEMD_VERSION="239"')
includes(manager, 'readonly RESTRICT_SUID_SGID_SYSTEMD_VERSION="242"')
includes(manager, 'readonly PRIVATE_IPC_SYSTEMD_VERSION="248"')
includes(manager, '/usr/bin/systemd-run --version')
includes(manager, '/usr/bin/systemctl show --property=Version --value')
includes(validationProfile, 'effective_version >= RESTRICT_SUID_SGID_SYSTEMD_VERSION')
includes(validationProfile, 'effective_version >= PRIVATE_IPC_SYSTEMD_VERSION')
includes(validationProperties, '--property "User=$VALIDATION_USER"')
includes(validationProperties, "--property SupplementaryGroups=")
includes(validationProperties, "--property PrivateNetwork=yes")
includes(validationProperties, "--property PrivateMounts=yes")
includes(validationProperties, "--property PrivateTmp=no")
includes(validationProperties, "--property ProtectSystem=strict")
includes(validationProperties, "--property RemoveIPC=yes")
includes(validationProperties, "--property SystemCallErrorNumber=EPERM")
includes(validationProperties, '--property "SystemCallFilter=~${denied_ipc_syscalls}"')
includes(validationProperties, "--property SystemCallArchitectures=native")
assert.doesNotMatch(validationProperties, /SystemCallFilter=~@ipc/)
for (const deniedIpcSyscall of [
    "ipc", "mq_getsetattr", "mq_notify", "mq_open", "mq_timedreceive", "mq_timedsend", "mq_unlink",
    "msgctl", "msgget", "msgrcv", "msgsnd", "semctl", "semget", "semop", "semtimedop",
    "shmat", "shmctl", "shmdt", "shmget",
]) {
    includes(manager, `    ${deniedIpcSyscall}`)
}
includes(
    validationProperties,
    '--property "InaccessiblePaths=-/opt/zzz_calculator -/var/lib/zzz-calculator -/srv/zzz-download-origin -/proc/sysvipc -/dev/mqueue"',
)
includes(validationProperties, '--property "BindReadOnlyPaths=$release_dir:/zzz-validation/app"')
includes(validationProperties, "TemporaryFileSystem=/zzz-validation:rw,nosuid,nodev,noexec,size=${VALIDATION_TMPFS_BYTES}")
includes(validationProperties, "/run:rw,nosuid,nodev,noexec,size=${VALIDATION_RUN_TMPFS_BYTES}")
includes(validationProperties, "/var/lib/zzz-calculator-deploy:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000")
for (const hiddenWritablePath of ["/tmp", "/var/tmp", "/dev/shm"]) {
    includes(validationProperties, `${hiddenWritablePath}:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000`)
}
includes(validationProperties, '--property "RestrictAddressFamilies=AF_INET AF_INET6"')
includes(validationProperties, "--property StandardOutput=null")
includes(validationProperties, "--property StandardError=null")
includes(validationProperties, "--property KillMode=control-group")
includes(validationProperties, "--property MemoryLimit=768M")
includes(validationProperties, "--property CPUQuota=200%")
includes(validationProperties, "--property TasksMax=64")
includes(validationProperties, "--property LimitFSIZE=1M")
includes(validationProperties, "VALIDATION_SYSTEMD_PROPERTIES+=(--property RestrictSUIDSGID=yes)")
includes(validationProperties, "VALIDATION_SYSTEMD_PROPERTIES+=(--property PrivateIPC=yes)")
includes(validationTransientUnit, '/usr/bin/systemd-run --quiet --unit "$unit_base"')
includes(validationTransientUnit, '"${VALIDATION_SYSTEMD_PROPERTIES[@]}"')
includes(validationTransientUnit, "HOME=/zzz-validation/home")
includes(validationTransientUnit, "ZZZ_CALCULATOR_DATA_DIR=/zzz-validation/data")
includes(validationTransientUnit, '/bin/bash "$VALIDATION_WORKER" "${worker_args[@]}"')
assert.doesNotMatch(validationTransientUnit, /\beval\b/)
includes(validationCapabilityProbe, "run_validation_transient_unit sandbox-capability")
includes(validationCapabilityProbe, 'VALIDATION_SANDBOX_PROBE_RESULT" == "active/exited/success/0')
for (const limitCheck of [
    "seed_size <= MAX_VALIDATION_SEED_BYTES",
    "seed_entries <= MAX_VALIDATION_SEED_ENTRIES",
    "largest_seed_file <= MAX_VALIDATION_SEED_FILE_BYTES",
]) {
    includes(validationProbe, limitCheck)
}
assert.doesNotMatch(validationProbe, /runuser -u "\$APP_USER"/, "Candidate code must not run as the production account")
assert.doesNotMatch(validationTransientUnit, /journalctl|server\.log/, "Candidate-controlled output must not be returned from validation")
for (const actionName of ["run_dry_run", "run_deploy"]) {
    const actionBody = manager.match(new RegExp(`${actionName}\\(\\) \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? ""
    ordered(
        actionBody,
        "prepare_validation_job",
        "run_validation_sandbox_capability_probe",
        "prepare_processing_job",
        `${actionName} must pass the inert sandbox probe before preparing or claiming candidate inputs`,
    )
    ordered(
        actionBody,
        "run_validation_sandbox_capability_probe",
        "claim_incoming_inputs",
        `${actionName} must not claim uploaded inputs before the sandbox capability gate`,
    )
}
assert.match(
    manager,
    /stop_validation_probe\(\)[\s\S]*LoadState[\s\S]*== "not-found"[\s\S]*validation_unit_name_has_members[\s\S]*== "loaded"[\s\S]*ControlGroup[\s\S]*systemctl stop[\s\S]*cgroup\.procs[\s\S]*validation_cgroup_has_members[\s\S]*reset-failed[\s\S]*== "not-found"/,
    "Transient validation must stop and verify its complete cgroup",
)
const validationStop = manager.match(/stop_validation_probe\(\)[\s\S]*?^}/m)?.[0] ?? ""
assert.doesNotMatch(
    validationStop,
    /LoadState --value 2>\/dev\/null \|\| true/,
    "A failed systemd LoadState query must never be treated as an unloaded validation unit",
)
includes(validationStop, 'VALIDATION_UNIT=""')
assert.match(
    manager,
    /copy_release_for_validation\(\)[\s\S]*source_tree_before[\s\S]*--exclude='\.\/data'[\s\S]*user_drive_discs\.example\.json[\s\S]*source_tree_after[\s\S]*prepare_private_validation_release "\$destination"[\s\S]*assert_sanitized_validation_data/,
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
    'readonly PRODUCTION_DOWNLOAD_ROOT="/srv/zzz-download-origin"',
    '[[ "$(/usr/bin/stat -f -c %T -- "$probe_root")" == "tmpfs" ]]',
    '[[ "$(/usr/bin/stat -f -c %T -- "$HOST_RUNTIME_DIR")" == "tmpfs" ]]',
    '[[ ! -r "$PRODUCTION_RELEASE_ROOT" && ! -w "$PRODUCTION_RELEASE_ROOT" && ! -x "$PRODUCTION_RELEASE_ROOT" ]]',
    '[[ ! -r "$PRODUCTION_DEPLOY_ROOT" && ! -w "$PRODUCTION_DEPLOY_ROOT" && ! -x "$PRODUCTION_DEPLOY_ROOT" ]]',
    '[[ ! -r "$PRODUCTION_CURRENT_DATA" && ! -w "$PRODUCTION_CURRENT_DATA" && ! -x "$PRODUCTION_CURRENT_DATA" ]]',
    '[[ ! -r "$PRODUCTION_DOWNLOAD_ROOT" && ! -w "$PRODUCTION_DOWNLOAD_ROOT" && ! -x "$PRODUCTION_DOWNLOAD_ROOT" ]]',
    '[[ "$(readlink /proc/self/ns/net)" != "$(readlink /proc/1/ns/net)" ]]',
    '[[ "${#interfaces[@]}" -eq 1 && "${interfaces[0]##*/}" == "lo" ]]',
]) {
    includes(validationWorker, token)
}
for (const hiddenWritablePath of ["HOST_TMP_DIR", "HOST_VAR_TMP_DIR", "HOST_SHM_DIR"]) {
    includes(validationWorker, hiddenWritablePath)
}
const validationWorkerSandbox = validationWorker.match(/assert_sandbox_contract\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationWorkerTmpfs = validationWorker.match(/assert_tmpfs_mount_contract\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationWorkerIpc = validationWorker.match(/assert_sysv_ipc_denied\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationWorkerMountSelection = validationWorker.match(/select_effective_mount_record\(\)[\s\S]*?^}/m)?.[0] ?? ""
const validationWorkerMain = validationWorker.slice(validationWorker.indexOf('[[ "$(id -un)"'))
includes(validationWorker, 'readonly CAPABILITY_PROBE_MODE="--capability-probe"')
for (const processContract of ["NoNewPrivs", "Seccomp", "CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"]) {
    includes(validationWorkerSandbox, processContract)
}
includes(validationWorkerSandbox, '[[ "$status_value" == "1" ]]')
includes(validationWorkerSandbox, '[[ "$status_value" == "2" ]]')
includes(validationWorkerSandbox, '[[ "$status_value" =~ ^0+$ ]]')
for (const isolatedIpcPath of [
    'readonly HOST_SYSVIPC_DIR="/proc/sysvipc"',
    'readonly HOST_MQUEUE_DIR="/dev/mqueue"',
]) {
    includes(validationWorker, isolatedIpcPath)
}
includes(validationWorkerSandbox, '[[ ! -r "$hidden_ipc_path" && ! -w "$hidden_ipc_path" && ! -x "$hidden_ipc_path" ]]')
includes(validationWorkerTmpfs, "select_effective_mount_record")
includes(validationWorkerMountSelection, "hidden_by_child")
includes(validationWorkerMountSelection, '[[ "$top_count" == "1" ]]')
assert.doesNotMatch(validationWorkerMountSelection, /mount_id > selected_mount_id/)
includes(validationWorkerTmpfs, "for required_option in rw nosuid nodev noexec")
includes(validationWorkerTmpfs, "/usr/bin/df --output=size -B1")
includes(validationWorkerTmpfs, "/usr/bin/df --output=itotal")
includes(validationWorker, 'readonly VALIDATION_TMPFS_INODES="16384"')
includes(validationWorker, 'readonly VALIDATION_RUN_TMPFS_INODES="1024"')
includes(validationWorkerSandbox, '[[ -x /usr/bin/ipcmk && -x /usr/bin/ipcrm ]]')
for (const ipcProbe of ["queue", "semaphore", "shared-memory"]) {
    includes(validationWorkerSandbox, `assert_sysv_ipc_denied ${ipcProbe}`)
}
for (const ipcFlag of ['create_flag="-Q"', 'create_flag="-S"', 'create_flag="-M"']) {
    includes(validationWorkerIpc, ipcFlag)
}
includes(validationWorkerIpc, "Operation not permitted")
includes(validationWorkerIpc, '/usr/bin/ipcrm "$remove_flag" "$ipc_id"')
ordered(
    validationWorkerIpc,
    '/usr/bin/ipcrm "$remove_flag" "$ipc_id"',
    'fail_worker "$EXIT_IPC_SYSCALL_ALLOWED"',
    "An unexpectedly created SysV IPC object must be removed before the worker fails",
)
for (const workerExit of [
    "EXIT_PROCESS_STATUS_CONTRACT=60",
    "EXIT_NO_NEW_PRIVILEGES_CONTRACT=61",
    "EXIT_SECCOMP_CONTRACT=62",
    "EXIT_CAPABILITY_CONTRACT=63",
    "EXIT_TMPFS_MOUNT_OPTIONS=64",
    "EXIT_TMPFS_INODE_LIMIT=65",
    "EXIT_IPC_PATH_EXPOSED=66",
    "EXIT_IPC_DEPENDENCY_MISSING=67",
    "EXIT_IPC_DENIAL_UNPROVEN=68",
    "EXIT_IPC_SYSCALL_ALLOWED=69",
    "EXIT_IPC_CLEANUP_FAILED=70",
    "EXIT_PRODUCTION_DOWNLOAD_EXPOSED=71",
]) {
    includes(validationWorker, workerExit)
}
assert.match(
    validationWorkerMain,
    /assert_sandbox_contract\r?\nif \[\[ "\$worker_mode" == "capability-probe" \]\]; then\r?\n\s+exit 0\r?\nfi\r?\n\r?\n\[\[ -d "\$release_dir"[^\n]*backend\/server\.js/,
    "The fixed capability probe must exit before reading or executing candidate files",
)
ordered(
    validationWorkerMain,
    "assert_sandbox_contract",
    '/usr/bin/node "$release_dir/backend/server.js"',
    "Normal validation must prove its sandbox before candidate Node starts",
)
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

// Deployment and rollback allow at most 15 seconds for the first healthy
// response, then require 15 stable seconds with one PID before committing.
includes(manager, 'readonly HEALTH_STARTUP_GRACE_SECONDS="15"')
includes(manager, 'readonly HEALTH_STABILITY_SECONDS="15"')
assert.match(
    manager,
    /healthy_runtime_pid\(\)[\s\S]*systemctl is-active[\s\S]*service_property MainPID[\s\S]*curl[\s\S]*jq/,
)
assert.match(
    manager,
    /health_gate\(\)[\s\S]*HEALTH_GATE_PID=""[\s\S]*startup_deadline="\$\(\(SECONDS \+ HEALTH_STARTUP_GRACE_SECONDS\)\)"[\s\S]*while \(\(SECONDS < startup_deadline\)\)[\s\S]*current_pid="\$\(healthy_runtime_pid\)"[\s\S]*attempt <= HEALTH_STABILITY_SECONDS[\s\S]*"\$current_pid" == "\$observed_pid"[\s\S]*HEALTH_GATE_PID="\$observed_pid"/,
)
includes(manager, "candidate failed the 15-consecutive-second stable health gate")
includes(manager, "rollback target failed the 15-consecutive-second stable health gate")
includes(manager, "candidate PID changed after the stable health gate")
includes(manager, "rollback target PID changed after the stable health gate")
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
includes(manager, 'requested="$STATE_PREVIOUS_BEFORE"')
includes(manager, 'manual rollback is disabled until the legacy current has completed its first managed deployment')
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
includes(bootstrap, "declare -a replaced_phases=()")
for (const replacementPhase of [
    '"registered"',
    '"original-move-armed"',
    '"original-moved"',
    '"install-armed"',
    '"candidate-installed"',
    '"verified"',
]) {
    includes(bootstrap, replacementPhase)
}
assert.match(
    bootstrap,
    /if \[\[ "\$had_original" == "1" \]\]; then[\s\S]*?registered\)[\s\S]*?! -e "\$backup"[\s\S]*?-f "\$target"[\s\S]*?original-move-armed\|/,
    "A missing managed-file backup may be treated as untouched only before replacement was armed",
)
includes(bootstrap, 'previous file backup is missing for ${target} at phase ${phase}')
includes(bootstrap, "candidate sudoers policy conflicts with the aggregate configuration")
includes(bootstrap, "rollback_managed_files")
includes(bootstrap, "rollback_ssh_directory")
assert.match(
    bootstrap,
    /rollback_ssh_directory\(\)[\s\S]*if \[\[ "\$restore_failed" == "0"[\s\S]*ssh_replacement_started="0"[\s\S]*\[\[ "\$restore_failed" == "0" \]\]/,
    "SSH rollback may discard its recovery marker only after a successful restore",
)
assert.match(
    bootstrap,
    /if \[\[ "\$rollback_failed" == "0" && -n "\$transaction_root" \]\]; then[\s\S]*remove_temporary_tree "\$transaction_root"/,
    "Failed bootstrap rollback must retain its transaction recovery directory",
)
assert.doesNotMatch(
    bootstrap,
    /if \[\[ "\$ssh_replacement_started" == "0" && -n "\$ssh_backup_root" \]\]; then[\s\S]*remove_temporary_tree "\$ssh_backup_root"/,
)
assert.doesNotMatch(bootstrap, /rollback_(?:ssh_directory|managed_files)\s*\|\|\s*true/)
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
