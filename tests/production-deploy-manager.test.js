import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const productionDir = path.join(root, "deploy", "production")
const managerPath = path.join(productionDir, "zzz-calculator-deploy")
const bootstrapPath = path.join(productionDir, "bootstrap-zzz-calculator-deploy.sh")
const sudoersPath = path.join(productionDir, "zzz-calculator-deploy.sudoers")
const readmePath = path.join(productionDir, "README.md")

for (const filePath of [managerPath, bootstrapPath, sudoersPath, readmePath]) {
    await access(filePath, constants.F_OK)
}

const manager = await readFile(managerPath, "utf8")
const bootstrap = await readFile(bootstrapPath, "utf8")
const sudoers = await readFile(sudoersPath, "utf8")

assert.match(manager, /^#!\/usr\/bin\/env bash/m)
for (const action of ["audit", "dry-run", "deploy", "rollback"]) {
    assert.match(manager, new RegExp(`case \\"\\$ACTION\\" in[\\s\\S]*${action}`))
}
assert.match(manager, /DEPLOY_ROOT="\/var\/lib\/zzz-calculator-deploy"/)
assert.match(manager, /INCOMING_DIR="\$\{DEPLOY_ROOT\}\/incoming"/)
assert.match(manager, /PROCESSING_DIR="\$\{DEPLOY_ROOT\}\/processing"/)
assert.match(manager, /HISTORY_DIR="\$\{DEPLOY_ROOT\}\/history"/)
assert.match(manager, /VALIDATION_DIR="\$\{DEPLOY_ROOT\}\/validation"/)
assert.match(manager, /RELEASE_ROOT="\/opt\/zzz_calculator\/releases"/)
assert.match(manager, /CURRENT_LINK="\/opt\/zzz_calculator\/current"/)
assert.match(manager, /LOCK_FILE="\/run\/lock\/zzz-calculator-deploy\.lock"/)
for (const contract of [
    "validate_archive_listing",
    "claim_incoming_inputs",
    "artifactSizeBytes",
    "--expected-sha",
    "--expected-commit",
    "same_release_tree",
    "merge_compatible_resources",
    "merge_existing_release_resources",
    "atomic_switch",
    "health_gate",
    "write_state_file",
]) {
    assert.match(manager, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
assert.doesNotMatch(manager, /localStorage\.clear|indexedDB\.deleteDatabase/i)
assert.match(bootstrap, /zzzdeploy/)
assert.match(bootstrap, /no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty/)
assert.match(bootstrap, /PROCESSING_DIR="\$\{DEPLOY_ROOT\}\/processing"/)
assert.match(bootstrap, /ssh-keygen -l -f "\$key_validation_tmp"/)
assert.match(bootstrap, /set ZZZDEPLOY_PUBLIC_KEY for every bootstrap run/)
assert.match(bootstrap, /mv -Tf -- "\$authorized_keys_tmp" "\$authorized_keys"/)
assert.match(bootstrap, /chown root:"\$DEPLOY_USER" "\$authorized_keys_tmp"/)
assert.doesNotMatch(bootstrap, /chown "\$DEPLOY_USER:\$DEPLOY_USER" "\$DEPLOY_ROOT\/\.ssh"/)
assert.match(bootstrap, /groupadd --system "\$DEPLOY_USER"/)
assert.match(bootstrap, /failed to lock the deployment account password/)
assert.match(bootstrap, /mktemp "\$\{SUDOERS_PATH\}\.backup\.XXXXXXXX"/)
assert.match(bootstrap, /new sudoers policy conflicts with the aggregate configuration; previous policy restored/)
assert.ok(
    bootstrap.indexOf('visudo --check --file "$SUDOERS_SOURCE"') < bootstrap.indexOf('if id "$DEPLOY_USER"'),
    "sudoers and key policy must be validated before the deployment account is changed",
)
assert.match(manager, /mv -T -- "\$source" "\$untrusted"/)
assert.match(manager, /stat -c '%h' -- "\$untrusted"/)
assert.match(manager, /incoming and processing must share a filesystem/)
assert.match(manager, /cp --reflink=never -- "\$untrusted" "\$sealed_tmp"/)
assert.match(manager, /validate and extract only that sealed copy/)
assert.match(manager, /failed to remove root-only processing data/)
assert.match(manager, /run_dry_run\(\)[\s\S]*parse_artifact_options "\$@"[\s\S]*claim_incoming_inputs[\s\S]*extract_and_validate/)
assert.match(manager, /run_deploy\(\)[\s\S]*parse_artifact_options "\$@"[\s\S]*claim_incoming_inputs[\s\S]*extract_and_validate/)
assert.match(manager, /failed to clean claimed uploads before production preflight/)
assert.match(sudoers, /zzzdeploy ALL=\(root\) NOPASSWD: ZZZ_CALCULATOR_DEPLOY/)
assert.doesNotMatch(sudoers, /systemctl|nginx|rm\s+-rf/i)

console.log("production deployment manager contract tests passed")
