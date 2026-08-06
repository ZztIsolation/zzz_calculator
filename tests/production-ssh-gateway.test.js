import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const gatewayPath = path.join(root, "deploy", "production", "zzz-calculator-ssh-gateway")
const deployWorkflowPath = path.join(root, ".github", "workflows", "deploy-production.yml")
const rollbackWorkflowPath = path.join(root, ".github", "workflows", "rollback-production.yml")

for (const filePath of [gatewayPath, deployWorkflowPath, rollbackWorkflowPath]) {
    await access(filePath, constants.F_OK)
}

const gateway = await readFile(gatewayPath, "utf8")
const deployWorkflow = await readFile(deployWorkflowPath, "utf8")
const rollbackWorkflow = await readFile(rollbackWorkflowPath, "utf8")

function includes(contents, token, message = `Missing SSH gateway contract: ${token}`) {
    assert.ok(contents.includes(token), message)
}

assert.match(gateway, /^#!\/bin\/bash\r?$/m)
includes(gateway, "set -Eeuo pipefail")
includes(gateway, "unset BASH_ENV ENV CDPATH GLOBIGNORE NODE_OPTIONS NODE_PATH NPM_CONFIG_PREFIX")
includes(gateway, 'readonly MANAGER_PATH="/usr/local/sbin/zzz-calculator-deploy"')
includes(gateway, 'readonly INCOMING_DIR="/var/lib/zzz-calculator-deploy/incoming"')
includes(gateway, 'readonly MAX_ARCHIVE_BYTES="$((256 * 1024 * 1024))"')
includes(gateway, 'readonly MAX_EVIDENCE_BYTES="$((1024 * 1024))"')
includes(gateway, 'readonly MAX_INCOMING_BYTES="$((320 * 1024 * 1024))"')
includes(gateway, "control_character_regex=$'[\\x01-\\x1f\\x7f]'")
includes(gateway, '[[ ! "$original_command" =~ $control_character_regex ]] || return 1')
includes(gateway, '[[ -n "$original_command" ]] || reject "interactive sessions are disabled"')
includes(gateway, 'classify_command "$original_command" || reject "command rejected"')
includes(gateway, '/usr/bin/sudo -n "$MANAGER_PATH" "${MANAGER_ARGS[@]}"')
assert.doesNotMatch(
    gateway,
    /run_manager\(\)[\s\S]*?exec \/usr\/bin\/sudo/,
    "Gateway must retain the incoming-directory lock while the manager runs",
)
includes(gateway, '/usr/bin/scp -t "$UPLOAD_PATH"')
includes(gateway, '/usr/bin/flock -n 9')
includes(gateway, '(( current_size + UPLOAD_MAX_BYTES <= MAX_INCOMING_BYTES ))')
includes(gateway, 'ulimit -f "$limit_blocks"')
includes(gateway, '/usr/bin/rm -f -- "$cleanup_target"')
includes(gateway, '[[ ! -e "$UPLOAD_PATH" && ! -L "$UPLOAD_PATH" ]]')
includes(gateway, '[[ "$file_links" == "1" ]]')
assert.doesNotMatch(gateway, /\beval\b/)
assert.doesNotMatch(gateway, /(?:^|\s)(?:sh|bash)\s+-c\b/)
assert.doesNotMatch(gateway, /scp\s+-[a-su-zA-SU-Z]/, "Gateway must expose only the legacy SCP sink mode")

const managerPattern = gateway.match(/manager_regex='([^']+)'/)?.[1] ?? ""
includes(managerPattern, "(dry-run|deploy)")
includes(managerPattern, "[0-9a-f]{12}")
includes(managerPattern, "[0-9a-f]{64}")
includes(managerPattern, "[0-9a-f]{40}")
assert.ok(managerPattern.startsWith("^") && managerPattern.endsWith("$"), "Manager grammar must match the complete command")
includes(gateway, '[[ "$artifact_prefix" == "$evidence_prefix" ]]')
includes(gateway, '[[ "${expected_commit:0:12}" == "$artifact_prefix" ]]')

const scpCalls = [...deployWorkflow.matchAll(/^\s*scp\s+([^\r\n]+)$/gm)].map(match => match[1])
assert.equal(scpCalls.length, 2, "Production CD must upload exactly the archive and evidence")
for (const call of scpCalls) {
    assert.match(call, /^-O\s+"\$\{ssh_opts\[@\]\}"/, "Production uploads must force predictable legacy SCP mode")
    assert.match(call, /:\$remote_(?:archive|evidence)"$/)
}
includes(deployWorkflow, '--artifact "$remote_archive_name" --evidence "$remote_evidence_name"')
assert.doesNotMatch(deployWorkflow, /--artifact "\$remote_archive"|--evidence "\$remote_evidence"/)
includes(deployWorkflow, "sudo -n /usr/local/sbin/zzz-calculator-deploy audit")
includes(deployWorkflow, "sudo -n /usr/local/sbin/zzz-calculator-deploy rollback --previous")
includes(rollbackWorkflow, "sudo -n /usr/local/sbin/zzz-calculator-deploy rollback --previous")
for (const contents of [deployWorkflow, rollbackWorkflow]) {
    for (const token of [
        ["StrictHostKeyChecking", "no"].join("="),
        ["ssh", "pass"].join(""),
        ["RequestTTY", "yes"].join("="),
    ]) {
        assert.ok(!contents.includes(token), `gateway contains forbidden SSH token: ${token}`)
    }
}

console.log("production SSH gateway contract tests passed")
