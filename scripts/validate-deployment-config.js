import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function read(relativePath) {
    return await readFile(path.join(rootDir, relativePath), "utf8")
}

const files = {
    ci: await read(".github/workflows/ci.yml"),
    deploy: await read(".github/workflows/deploy-production.yml"),
    rollback: await read(".github/workflows/rollback-production.yml"),
    deployScript: await read("deploy/production/zzz-calculator-deploy"),
    bootstrap: await read("deploy/production/bootstrap-zzz-calculator-deploy.sh"),
    sshGateway: await read("deploy/production/zzz-calculator-ssh-gateway"),
    validationWorker: await read("deploy/production/zzz-calculator-validation-worker"),
    systemd239Sandbox: await read("tests/production-systemd239-sandbox.integration.sh"),
    systemd239Dockerfile: await read("tests/systemd239-sandbox.Dockerfile"),
    sshGatewayTest: await read("tests/production-ssh-gateway.test.js"),
    sshGatewayIntegration: await read("tests/production-ssh-gateway.integration.sh"),
    sudoers: await read("deploy/production/zzz-calculator-deploy.sudoers"),
    storageRoundtrip: await read("scripts/production-storage-roundtrip.mjs"),
    serverPackager: await read("scripts/package-server-release.js"),
    systemdService: await read("deploy/systemd/zzz-calculator.service"),
    productionRuntimeConfig: await read("backend/production-runtime-config.json"),
    server: await read("backend/server.js"),
    enkaMappingLoader: await read("backend/enkaMapping.js"),
}

function requireText(contents, token, message) {
    assert.ok(contents.includes(token), message)
}

function section(contents, startToken, endToken) {
    const start = contents.indexOf(startToken)
    assert.notEqual(start, -1, `Missing section start: ${startToken}`)
    const end = endToken ? contents.indexOf(endToken, start + startToken.length) : contents.length
    assert.notEqual(end, -1, `Missing section end: ${endToken}`)
    return contents.slice(start, end)
}

const workflows = {
    ci: files.ci,
    deploy: files.deploy,
    rollback: files.rollback,
}

const expectedActionRefs = new Set([
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
    "actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b",
])
const observedActionRefs = new Set()

for (const [workflowName, workflow] of Object.entries(workflows)) {
    const refs = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)].map(match => match[1])
    assert.ok(refs.length > 0, `${workflowName} workflow must use at least one audited action`)
    for (const ref of refs) {
        assert.match(ref, /^[^@\s]+@[0-9a-f]{40}$/, `${workflowName} contains a non-immutable action ref: ${ref}`)
        assert.ok(expectedActionRefs.has(ref), `${workflowName} contains an unreviewed action ref: ${ref}`)
        observedActionRefs.add(ref)
    }
}
assert.deepEqual(observedActionRefs, expectedActionRefs, "Pinned action allowlist and workflow usage differ")

requireText(files.ci, "name: CI", "CI workflow name must remain stable.")
requireText(files.ci, "name: verify", "CI must expose the required CI / verify check.")
requireText(files.ci, "pull_request:", "CI must validate pull requests.")
requireText(files.ci, "push:", "CI must validate main pushes.")
requireText(files.ci, "workflow_dispatch:", "CI must support an explicit manual run.")
requireText(files.ci, "timeout-minutes: 25", "CI must have a bounded timeout.")
requireText(files.ci, "cancel-in-progress: true", "CI must cancel superseded runs.")
for (const command of ["npm test", "npm run build:webapp", "npm run test:layout", "npm run build:server", "npm run build:pages"]) {
    requireText(files.ci, command, `CI is missing required command: ${command}`)
}
requireText(
    files.ci,
    "bash -n deploy/production/zzz-calculator-ssh-gateway",
    "CI must syntax-check the forced-command SSH gateway.",
)
requireText(
    files.ci,
    "bash -n deploy/production/zzz-calculator-validation-worker",
    "CI must syntax-check the installed validation worker.",
)
requireText(files.ci, "node tests/production-ssh-gateway.test.js", "CI must run SSH gateway contract tests.")
requireText(files.ci, "bash tests/production-ssh-gateway.integration.sh", "CI must run SSH gateway integration tests.")
requireText(
    files.ci,
    "bash -n tests/production-systemd239-sandbox.integration.sh",
    "CI must syntax-check the systemd 239 sandbox fixture before building it.",
)
requireText(
    files.ci,
    "name: Run the validation sandbox on systemd 239",
    "CI must exercise the production validation sandbox against systemd 239.",
)
requireText(
    files.ci,
    "tests/systemd239-sandbox.Dockerfile",
    "CI must build the pinned systemd 239 compatibility fixture.",
)
requireText(files.ci, "--privileged --cgroupns=host", "The systemd 239 fixture must boot a real PID 1 and cgroup hierarchy.")
requireText(files.ci, 'context="$(mktemp -d "$RUNNER_TEMP/zzz-systemd239-context.XXXXXX")"', "CI must use a bounded minimal Docker context.")
requireText(files.ci, '"$context/deploy/production/"', "CI must copy only the reviewed manager and worker into the Docker context.")
assert.doesNotMatch(files.ci, /docker build[^\n]*\s\.\s*$/m, "The systemd fixture must not send the whole checkout to Docker.")
requireText(
    files.ci,
    "/usr/local/bin/production-systemd239-sandbox.integration.sh",
    "CI must execute the systemd 239 sandbox integration test.",
)
requireText(files.ci, "output/zzz-calculator-server-*.evidence.json", "CI must upload release evidence with the artifact.")
requireText(files.ci, "name: Verify Calculator-only server release boundary", "CI must verify that server artifacts exclude download payloads.")
requireText(files.ci, "Calculator server artifact contains separately managed download payloads.", "CI must reject bundled download payloads.")
requireText(files.ci, "if-no-files-found: error", "Missing release artifacts must fail CI.")
requireText(files.ci, "retention-days: 14", "CI artifacts must have an explicit retention period.")
requireText(files.serverPackager, 'new Set(["downloads"])', "The server packager must exclude the separately managed downloads tree.")
requireText(files.serverPackager, "Calculator server releases must not contain separately managed download payloads.", "The server packager must fail closed if downloads enter the release tree.")
assert.deepEqual(
    JSON.parse(files.productionRuntimeConfig),
    { version: 1, enkaImportEnabled: true },
    "The versioned production runtime configuration must explicitly enable showcase import.",
)
requireText(files.systemdService, "Environment=ENKA_IMPORT_ENABLED=true", "The production systemd template must explicitly enable showcase import.")
requireText(files.deployScript, "ENKA_IMPORT_ENABLED=true", "Candidate validation must exercise showcase import in production mode.")
requireText(files.validationWorker, ".enkaImportEnabled == true", "Candidate validation must require showcase import to be enabled.")
requireText(files.deploy, ".enkaImportEnabled == true", "Public deployment verification must require showcase import to be enabled.")
assert.match(
    files.ci,
    /\(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\) &&\s*github\.ref == 'refs\/heads\/main'/,
    "Immutable release artifacts must only be uploaded for main runs.",
)

const manualDispatch = section(files.deploy, "  workflow_dispatch:", "\npermissions:")
assert.match(manualDispatch, /^\s*- audit\s*$/m)
assert.match(manualDispatch, /^\s*- dry-run\s*$/m)
assert.doesNotMatch(manualDispatch, /^\s*- deploy\s*$/m, "Manual dispatch must never expose production deploy mode")

const preflight = section(files.deploy, "  preflight:", "\n  validation:")
const validation = section(files.deploy, "  validation:", "\n  remote:")
const remote = section(files.deploy, "  remote:")
requireText(
    preflight,
    "production_url: ${{ steps.candidate.outputs.production_url }}",
    "The repository-level production URL must be exported through the secretless preflight job.",
)
requireText(preflight, "PROD_URL: ${{ vars.PROD_URL }}", "Preflight must read PROD_URL from a repository variable.")
requireText(
    preflight,
    'core.setOutput("production_url", productionUrl.replace(/\\\/$/, ""));',
    "Preflight must expose a normalized production URL output.",
)
assert.equal(
    [...files.deploy.matchAll(/\$\{\{\s*vars\.PROD_URL\s*\}\}/g)].length,
    1,
    "Only the secretless preflight job may read the repository PROD_URL variable directly.",
)
requireText(
    validation,
    "PROD_URL: ${{ needs.preflight.outputs.production_url }}",
    "Artifact validation must consume the pinned preflight production URL output.",
)
requireText(
    remote,
    "PROD_URL: ${{ needs.preflight.outputs.production_url }}",
    "Remote verification must consume the pinned preflight production URL output.",
)
assert.match(
    preflight,
    /github\.event_name == 'workflow_run'[\s\S]*github\.event\.workflow_run\.conclusion == 'success'[\s\S]*github\.event\.workflow_run\.head_branch == 'main'[\s\S]*vars\.PRODUCTION_CD_ENABLED == 'true'/,
    "Automatic deploy must require successful main CI and the production feature gate.",
)
assert.match(
    preflight,
    /\(github\.event_name == 'workflow_dispatch' &&\s*github\.ref == 'refs\/heads\/main'\)/,
    "Manual audit and dry-run must remain available from main while automatic CD is disabled.",
)
assert.doesNotMatch(preflight, /secrets\./, "The preflight job must not read production secrets")
assert.doesNotMatch(validation, /\benvironment:/, "Candidate validation must not enter the production environment")
assert.doesNotMatch(validation, /secrets\./, "Candidate validation must not read production secrets")
assert.doesNotMatch(remote, /production-storage-roundtrip|\bnpm\s/, "The secret-bearing runner must never execute candidate code")
requireText(preflight, 'if (!["audit", "dry-run"].includes(mode))', "Manual mode must be restricted to audit and dry-run.")
requireText(preflight, 'mode = "deploy"', "Only workflow_run may select deploy mode.")
requireText(preflight, 'mode === "deploy" && branch.commit.sha !== run.head_sha', "Deploy must reject a stale main SHA.")

const successfulRunLookup = section(
    preflight,
    "const runs = await github.rest.actions.listWorkflowRuns({",
    "const run = (await github.rest.actions.getWorkflowRun({",
)
for (const token of [
    "owner: context.repo.owner",
    "repo: context.repo.repo",
    'workflow_id: "ci.yml"',
    'branch: "main"',
    'status: "success"',
    "per_page: 1",
]) {
    requireText(successfulRunLookup, token, `Official listWorkflowRuns lookup is missing: ${token}`)
}
assert.doesNotMatch(
    successfulRunLookup,
    /(?:github\.request|fetch|curl)\s*\(/,
    "CI run discovery must use the typed GitHub Actions listWorkflowRuns endpoint.",
)

requireText(files.deploy, "workflow_run:", "CD must be driven by the completed CI workflow.")
assert.equal(
    [...files.deploy.matchAll(/Calculator server artifact contains separately managed download payloads\./g)].length,
    2,
    "CD must reject bundled download payloads during validation and again before production access.",
)
requireText(files.deploy, "environment:", "CD must use the protected production environment.")
requireText(files.deploy, "run-id: ${{ needs.preflight.outputs.run_id }}", "CD must download the triggering CI run's artifact.")
requireText(files.deploy, "github-token: ${{ github.token }}", "Cross-run artifact download must use the scoped workflow token.")
assert.doesNotMatch(files.deploy, /npm run (?:build|package)/, "CD must consume the CI artifact without rebuilding it")
requireText(validation, "needs.preflight.outputs.mode != 'audit'", "Audit must bypass retained artifacts and browser validation.")
requireText(validation, "production-storage-roundtrip.mjs", "CD must run the isolated browser storage roundtrip.")
requireText(validation, '--current-url "$PROD_URL"', "Storage roundtrip must exercise the live origin through its switching proxy.")
requireText(validation, '--expected-commit "$CANDIDATE_SHA"', "Storage roundtrip must bind the candidate to the approved commit.")
requireText(files.storageRoundtrip, "candidateHealthBody.enkaImport", "Storage roundtrip must validate enabled Enka health metrics.")
requireText(files.storageRoundtrip, "candidateConfig.enkaImportEnabled, true", "Storage roundtrip must require showcase import to be enabled.")
requireText(files.storageRoundtrip, "result.health?.ok, true", "Current production health must require an explicit healthy state.")
requireText(files.storageRoundtrip, 'result.health?.service, "zzz_calculator"', "Current production health must require the Calculator service identity.")
requireText(
    files.storageRoundtrip,
    '.optimizer-progress-card[data-status="done"]',
    "Storage roundtrip must wait for the optimizer's semantic completion state.",
)
assert.doesNotMatch(
    files.storageRoundtrip,
    /assert\.deepEqual\((?:await candidateHealth\.json\(\)|result\.health)/,
    "Storage roundtrip must allow additive health response fields.",
)
assert.doesNotMatch(
    files.storageRoundtrip,
    /getByText\(["']已完成["']/,
    "Storage roundtrip must not bind optimizer completion to retired display copy.",
)
assert.match(
    remote,
    /needs:\s*[\s\S]*?-\s+preflight\s*[\s\S]*?-\s+validation\s*[\s\S]*?needs\.validation\.result\s*==\s*'success'/,
    "Every non-audit remote operation must require the isolated browser validation job to succeed.",
)
requireText(files.deploy, 'if [[ "$CANDIDATE_MODE" == "audit" ]]', "Audit must invoke only the read-only server action.")
requireText(files.deploy, "zzz-calculator-deploy audit", "Audit mode must call the restricted deployment manager.")
requireText(files.deploy, 'if [[ "$CANDIDATE_MODE" == "dry-run" ]]', "Dry-run must have a non-deploying server path.")
requireText(files.deploy, "zzz-calculator-deploy dry-run", "Dry-run mode must call the isolated server validation action.")
requireText(files.deploy, 'assert_main_current "before first SSH/SCP"', "CD must reject stale main before connecting to production.")
requireText(files.deploy, 'assert_main_current "immediately before deploy invocation"', "CD must re-check main immediately before deployment.")
requireText(remote, "StrictHostKeyChecking=yes", "CD must pin host key checking.")
requireText(remote, "BatchMode=yes", "CD SSH must never fall back to password prompts.")
requireText(remote, "ClearAllForwardings=yes", "CD SSH must not retain implicit forwarding.")
requireText(remote, 'scp -O "${ssh_opts[@]}"', "CD uploads must use the forced gateway's legacy SCP protocol.")
requireText(remote, "zzz-calculator-deploy rollback --previous", "Failed public verification must use the recorded rollback release.")
requireText(remote, "Automatic rollback restored the pre-deploy public release.", "A failed public verification must report restored production state.")

const validationEvidenceUpload = section(validation, "      - name: Upload validation evidence")
requireText(validationEvidenceUpload, "if: always()", "Validation evidence upload must run after failures.")
requireText(validationEvidenceUpload, "if-no-files-found: error", "Missing validation evidence must fail closed.")
for (const evidenceFile of ["validation-output.txt", "storage-roundtrip.json", "storage-roundtrip.png", "storage-roundtrip-trace.zip"]) {
    requireText(validationEvidenceUpload, evidenceFile, `Validation evidence is missing ${evidenceFile}.`)
}

const deployEvidenceUpload = section(remote, "      - name: Upload deployment evidence")
requireText(deployEvidenceUpload, "if: always()", "Deployment evidence upload must run after failures.")
requireText(deployEvidenceUpload, "if-no-files-found: error", "Missing deployment evidence must fail closed.")
requireText(deployEvidenceUpload, "deploy-output.txt", "Remote deployment evidence is missing deploy-output.txt.")
for (const candidateEvidenceFile of ["storage-roundtrip.json", "storage-roundtrip.png", "storage-roundtrip-trace.zip"]) {
    assert.ok(!deployEvidenceUpload.includes(candidateEvidenceFile), `Secret-bearing runner must not expect ${candidateEvidenceFile}.`)
}

requireText(files.rollback, "inputs.confirm == true", "Manual rollback must require explicit confirmation.")
requireText(files.rollback, "github.ref == 'refs/heads/main'", "Rollback must run from protected main.")
requireText(files.rollback, "environment:", "Rollback must use the protected production environment.")
requireText(files.rollback, "StrictHostKeyChecking=yes", "Rollback must pin host key checking.")
const rollbackInvocations = [...files.rollback.matchAll(/zzz-calculator-deploy rollback[^\r\n]*/g)].map(match => match[0])
assert.ok(rollbackInvocations.length >= 1, "Rollback workflow must invoke the deployment manager")
for (const invocation of rollbackInvocations) {
    assert.match(invocation, /rollback --previous(?:[;\s]|$)/, `Rollback accepts an arbitrary target: ${invocation}`)
}
const rollbackEvidenceUpload = section(files.rollback, "      - name: Upload rollback evidence")
requireText(rollbackEvidenceUpload, "if: always()", "Rollback evidence upload must run after failures.")
requireText(rollbackEvidenceUpload, "if-no-files-found: error", "Missing rollback evidence must fail closed.")

requireText(files.sudoers, "/usr/local/sbin/zzz-calculator-deploy rollback --previous", "Sudo must permit only recorded rollback.")
assert.doesNotMatch(files.sudoers, /zzz-calculator-deploy rollback \*/, "Sudo must not permit arbitrary rollback arguments")
assert.doesNotMatch(files.sudoers, /systemctl|nginx|\/bin\/(?:ba)?sh(?:\s|,|$)/, "Sudo must not grant shell or service-manager access")

for (const token of [
    'readonly SSH_GATEWAY_PATH="${VALIDATION_WORKER_DIR}/zzz-calculator-ssh-gateway"',
    'readonly SSH_GATEWAY_SOURCE="${source_dir}/zzz-calculator-ssh-gateway"',
    'command="/usr/local/libexec/zzz-calculator-ssh-gateway",restrict,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc',
    'replace_managed_file "$gateway_snapshot" "$SSH_GATEWAY_PATH" 555',
]) {
    requireText(files.bootstrap, token, `Bootstrap forced-command gateway contract is missing: ${token}`)
}
for (const token of [
    'readonly MANAGER_PATH="/usr/local/sbin/zzz-calculator-deploy"',
    'readonly INCOMING_DIR="/var/lib/zzz-calculator-deploy/incoming"',
    'original_command="${SSH_ORIGINAL_COMMAND:-}"',
    '[[ -n "$original_command" ]] || reject "interactive sessions are disabled"',
    'classify_command "$original_command" || reject "command rejected"',
    '/usr/bin/scp -t "$UPLOAD_PATH"',
    '/usr/bin/sudo -n "$MANAGER_PATH" "${MANAGER_ARGS[@]}"',
]) {
    requireText(files.sshGateway, token, `Forced-command SSH gateway is missing: ${token}`)
}
assert.doesNotMatch(files.sshGateway, /eval|bash\s+-c|sh\s+-c/, "SSH gateway must not evaluate caller-controlled shell text.")
for (const contents of [files.sshGatewayTest, files.sshGatewayIntegration]) {
    requireText(contents, "command rejected", "SSH gateway tests must cover rejected commands.")
}

for (const token of [
    'copy_release_for_validation current "$current_release" "$current_copy"',
    'copy_release_for_validation candidate "$candidate_release" "$candidate_copy"',
    'copy_release_for_validation rollback "$rollback_release" "$rollback_copy"',
    "TemporaryFileSystem=/zzz-validation:rw,nosuid,nodev,noexec,size=${VALIDATION_TMPFS_BYTES}",
    "/run:rw,nosuid,nodev,noexec,size=${VALIDATION_RUN_TMPFS_BYTES}",
    "/var/lib/zzz-calculator-deploy:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000",
    "/tmp:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000",
    "/var/tmp:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000",
    "/dev/shm:ro,nosuid,nodev,noexec,size=4k,nr_inodes=16,mode=000",
    'BindReadOnlyPaths=$release_dir:/zzz-validation/app',
    "RestrictAddressFamilies=AF_INET AF_INET6",
    "StandardOutput=null",
    "StandardError=null",
    'readonly MIN_SYSTEMD_VERSION="239"',
    'readonly RESTRICT_SUID_SGID_SYSTEMD_VERSION="242"',
    'readonly PRIVATE_IPC_SYSTEMD_VERSION="248"',
    "/usr/bin/systemd-run --version",
    "/usr/bin/systemctl show --property=Version --value",
    "SystemCallFilter=~${denied_syscalls}",
    "SystemCallArchitectures=native",
    "SystemCallErrorNumber=EPERM",
    "RemoveIPC=yes",
    "-/proc/sysvipc -/dev/mqueue",
    "run_validation_sandbox_capability_probe",
    "finish_validation_probe_if_gone",
]) {
    requireText(files.deployScript, token, `Deployment sandbox is missing: ${token}`)
}
assert.doesNotMatch(files.deployScript, /SystemCallFilter=~@ipc/, "The broad systemd @ipc group would also block pipe syscalls.")
assert.doesNotMatch(files.deployScript, /\beval\b/, "Validation systemd properties must be passed as a quoted array.")
const dryRunBody = section(files.deployScript, "run_dry_run() {", "\nrun_deploy() {")
const deployBody = section(files.deployScript, "run_deploy() {", "\nrun_rollback() {")
for (const [name, body] of [["dry-run", dryRunBody], ["deploy", deployBody]]) {
    const probeIndex = body.indexOf("run_validation_sandbox_capability_probe")
    assert.ok(probeIndex >= 0, `${name} must run the inert sandbox capability probe.`)
    for (const laterOperation of ["prepare_processing_job", "seal_current_release", "claim_incoming_inputs"]) {
        const operationIndex = body.indexOf(laterOperation)
        assert.ok(operationIndex > probeIndex, `${name} must run the inert sandbox probe before ${laterOperation}.`)
    }
}
for (const token of [
    "--capability-probe",
    "NoNewPrivs",
    "Seccomp",
    "CapBnd",
    "/proc/self/mountinfo",
    "/proc/net/dev",
    "while IFS=: read -r interface counters",
    "/usr/bin/ipcmk",
    "/usr/bin/ipcrm",
    "Operation not permitted",
    "/usr/bin/setarch",
    "/usr/bin/uname",
    "assert_personality_denied",
    "capability bind source sentinel is missing or invalid",
    'readonly MAX_VALIDATION_RESPONSE_BYTES="$((4 * 1024 * 1024))"',
    "assert_endpoint_response_file",
    '--max-filesize "$MAX_VALIDATION_RESPONSE_BYTES"',
    "HOST_SYSVIPC_DIR",
    "HOST_MQUEUE_DIR",
]) {
    requireText(files.validationWorker, token, `Validation worker sandbox self-check is missing: ${token}`)
}
requireText(
    files.deployScript,
    '--property "LimitFSIZE=${MAX_VALIDATION_RESPONSE_BYTES}"',
    "The transient validation file-size limit must match the bounded endpoint response contract.",
)
assert.doesNotMatch(files.deployScript, /LimitFSIZE=1M/, "The validation worker must accept the current catalog response.")
for (const token of [
    "systemd 239",
    "assert_profile 239 239 systemd-v239-seccomp 0 0",
    "assert_profile 242 247 systemd-v239-seccomp+restrict-suidsgid 1 0",
    "assert_profile 248 252 systemd-v239-seccomp+restrict-suidsgid+private-ipc 1 1",
    "run_validation_sandbox_capability_probe",
    "assert_transient_property_parser_support",
    "systemd-run --no-block --quiet",
    "/usr/bin/sleep 30",
    "UnitNameMembers=",
    "Unknown assignment:",
    "ZzzFirstUnsupported",
    "ZzzSecondUnsupported",
    "ZzzDefinitelyUnsupported=yes",
    "large-catalog-source",
    'fs.existsSync(path.resolve(__dirname, "..", ".oversize-response"))',
    'run_validation_transient_unit large-catalog "$large_catalog_release" release',
    "oversized chunked catalog bypassed the 4 MiB response limit",
    "cleanup_oversize_validation",
    "cleanup_transient_trees",
    "oversized catalog failure retained a transient unit",
]) {
    requireText(files.systemd239Sandbox, token, `The systemd 239 integration fixture is missing: ${token}`)
}
requireText(
    files.systemd239Dockerfile,
    "FROM rockylinux/rockylinux:8.10@sha256:e8a49c5403b687db05d4d67333fa45808fbe74f36e683cec7abb1f7d0f2338c6",
    "The systemd 239 fixture must pin the reviewed Rocky Linux image index.",
)
requireText(files.systemd239Dockerfile, 'CMD ["/sbin/init"]', "The compatibility fixture must boot systemd as PID 1.")
requireText(files.systemd239Dockerfile, "test -x /usr/bin/jq", "The release-mode sandbox fixture requires jq.")
requireText(files.systemd239Dockerfile, "test -x /usr/bin/node", "The release-mode sandbox fixture requires Node.js.")
assert.doesNotMatch(
    files.deployScript,
    /validationLogTailBase64|VALIDATION_LOG_TAIL_BASE64|server\.log/,
    "Candidate-controlled logs must not be returned in deployment evidence.",
)
requireText(
    files.validationWorker,
    '/usr/bin/node "$release_dir/backend/server.js" >/dev/null 2>&1 &',
    "Validation worker must discard candidate stdout and stderr.",
)
requireText(
    files.serverPackager,
    'path.join(stagingDir, "backend", ENKA_RUNTIME_MAPPING_FILE)',
    "Server releases must bundle immutable Enka metadata outside the sanitized data directory.",
)
requireText(
    files.server,
    "await loadEnkaMappingSnapshot(__dirname, dataDir)",
    "Enabled production startup must use the packaged Enka metadata loader.",
)
requireText(
    files.enkaMappingLoader,
    'path.join(backendDir, ENKA_RUNTIME_MAPPING_FILE)',
    "The Enka metadata loader must prefer the immutable release bundle.",
)
for (const catalog of [
    "agents.json",
    "agent_skills.json",
    "anomaly_effects.json",
    "bosses.json",
    "combat_buffs.json",
    "drive_disc_sets.json",
    "enka_zzz_mapping.json",
    "stat_rules.json",
    "w_engines.json",
]) {
    requireText(files.deployScript, catalog, `Sanitized validation catalog allowlist is missing ${catalog}.`)
    requireText(files.validationWorker, catalog, `Validation worker catalog allowlist is missing ${catalog}.`)
}
requireText(files.deployScript, "--exclude='./data'", "Private validation copies must exclude the source data tree.")
requireText(
    files.deployScript,
    '"$destination/data/user_drive_discs.json"',
    "Private validation copies must synthesize an isolated inventory.",
)
requireText(
    files.validationWorker,
    '/usr/bin/cp -- "$release_dir/data/user_drive_discs.example.json"',
    "Validation worker must seed inventory only from the empty example.",
)

for (const token of [
    "settlementType",
    "teammateAttack",
    "luminescenceDamageSharePct",
    "zzz_wiki_2116",
    "zzz_wiki_2121",
    "assertOnlySetIdentityChanged",
]) {
    requireText(files.storageRoundtrip, token, `Storage roundtrip is missing compatibility assertion: ${token}`)
}
assert.match(
    files.storageRoundtrip,
    /candidate-first[\s\S]*current-rollback[\s\S]*candidate-second[\s\S]*localStorage-fallback/,
    "Storage roundtrip must exercise candidate, rollback, second candidate, and fallback in order.",
)

const forbidden = [
    "StrictHostKeyChecking=no",
    "localStorage.clear(",
    "indexedDB.deleteDatabase(",
    "sshpass",
]
for (const [name, contents] of Object.entries(files)) {
    for (const token of forbidden) {
        assert.ok(!contents.includes(token), `${name} contains forbidden deployment token: ${token}`)
    }
}

console.log("Deployment configuration checks passed.")
