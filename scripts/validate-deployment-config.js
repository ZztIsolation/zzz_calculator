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
    baseline: await read(".github/workflows/audit-deploy-baseline.yml"),
    deploy: await read(".github/workflows/deploy-production.yml"),
    eligibility: await read(".github/workflows/deploy-eligibility.yml"),
    prepare: await read(".github/workflows/prepare-deploy.yml"),
    promote: await read(".github/workflows/promote-deploy.yml"),
    resume: await read(".github/workflows/resume-deploy.yml"),
    rollback: await read(".github/workflows/rollback-production.yml"),
    packageJson: await read("package.json"),
    promotionWorkflowTest: await read("tests/deploy-promotion-workflows.test.js"),
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
    baseline: files.baseline,
    deploy: files.deploy,
    eligibility: files.eligibility,
    prepare: files.prepare,
    promote: files.promote,
    resume: files.resume,
    rollback: files.rollback,
}

const expectedActionRefs = new Set([
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
    "actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b",
    "actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349",
])
const observedActionRefs = new Set()
const observedLocalWorkflowRefs = []
const expectedLocalWorkflowRef = "./.github/workflows/deploy-production.yml"

for (const [workflowName, workflow] of Object.entries(workflows)) {
    const refs = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)].map(match => match[1])
    assert.ok(refs.length > 0, `${workflowName} workflow must use at least one audited action`)
    for (const ref of refs) {
        if (ref.startsWith("./")) {
            assert.equal(ref, expectedLocalWorkflowRef, `${workflowName} contains an unreviewed local workflow ref: ${ref}`)
            assert.ok(
                workflowName === "baseline" || workflowName === "promote" || workflowName === "resume",
                `${workflowName} must not call the production deployment workflow`,
            )
            observedLocalWorkflowRefs.push(`${workflowName}:${ref}`)
            continue
        }
        assert.match(ref, /^[^@\s]+@[0-9a-f]{40}$/, `${workflowName} contains a non-immutable action ref: ${ref}`)
        assert.ok(expectedActionRefs.has(ref), `${workflowName} contains an unreviewed action ref: ${ref}`)
        observedActionRefs.add(ref)
    }
}
assert.deepEqual(observedActionRefs, expectedActionRefs, "Pinned action allowlist and workflow usage differ")
assert.deepEqual(
    observedLocalWorkflowRefs.sort(),
    [
        `baseline:${expectedLocalWorkflowRef}`,
        `promote:${expectedLocalWorkflowRef}`,
        `resume:${expectedLocalWorkflowRef}`,
    ],
    "Only baseline audit, promotion, and resume may call the reviewed local production workflow",
)

requireText(files.ci, "name: CI", "CI workflow name must remain stable.")
requireText(files.ci, "name: verify", "CI must expose the required CI / verify check.")
requireText(files.ci, "pull_request:", "CI must validate pull requests.")
requireText(files.ci, "push:", "CI must validate main pushes.")
requireText(files.ci, "workflow_dispatch:", "CI must support an explicit manual run.")
const ciTriggers = section(files.ci, "on:", "\npermissions:")
const ciPullRequestTrigger = section(ciTriggers, "  pull_request:", "\n  push:")
const ciPushTrigger = section(ciTriggers, "  push:", "\n  workflow_dispatch:")
for (const [triggerName, trigger] of [["pull request", ciPullRequestTrigger], ["push", ciPushTrigger]]) {
    assert.match(trigger, /^\s*- main\s*$/m, `CI ${triggerName} must target main.`)
    assert.doesNotMatch(trigger, /^\s*- deploy\s*$/m, `CI ${triggerName} must not target the production deploy branch.`)
}
requireText(files.ci, "timeout-minutes: 25", "CI must have a bounded timeout.")
requireText(files.ci, "cancel-in-progress: true", "CI must cancel superseded runs.")
requireText(files.packageJson, '"test:deployment-workflows": "node tests/deploy-promotion-workflows.test.js"', "npm test must expose executable promotion behavior checks.")
requireText(files.packageJson, "npm run test:deployment-workflows", "The full npm test chain must run promotion behavior checks.")
for (const token of [
    '"unapproved PR"',
    '"stale main SHA"',
    '"missing artifact"',
    '"non-main CI"',
    '"non-fast-forward update"',
    "assert.equal(result.updateCalls.length, 0",
]) {
    requireText(files.promotionWorkflowTest, token, `Executable promotion behavior coverage is missing: ${token}`)
}
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

const deployTriggers = section(files.deploy, "on:", "\npermissions:")
const deployPermissions = section(files.deploy, "permissions:", "\nconcurrency:")
const deployPushTrigger = section(deployTriggers, "  push:", "\n  workflow_call:")
const reusableDeploy = section(deployTriggers, "  workflow_call:", "\n  workflow_dispatch:")
assert.match(deployPushTrigger, /^\s*- deploy\s*$/m, "Production CD push events must come from deploy.")
assert.doesNotMatch(deployPushTrigger, /^\s*- main\s*$/m, "A main push must never trigger production CD.")
assert.doesNotMatch(deployTriggers, /workflow_run:/, "The retired main workflow_run trigger must remain disabled.")
requireText(deployPermissions, "pull-requests: read", "Direct deploy push validation must be able to read its approval record.")

const reusableCandidateInput = section(reusableDeploy, "      candidate_sha:", "\n      ci_run_id:")
const reusableRunInput = section(reusableDeploy, "      ci_run_id:", "\n      promotion_pr_number:")
const reusablePromotionInput = section(reusableDeploy, "      promotion_pr_number:", "\n    outputs:")
const reusableOperationInput = section(reusableDeploy, "      operation_mode:", "\n    outputs:")
for (const [inputName, input] of [["candidate_sha", reusableCandidateInput], ["ci_run_id", reusableRunInput]]) {
    requireText(input, "required: true", `Reusable deployment input ${inputName} must be required.`)
    requireText(input, "type: string", `Reusable deployment input ${inputName} must be a string.`)
}
requireText(reusablePromotionInput, "required: false", "The promotion PR number must remain optional for direct deploy recovery.")
requireText(reusablePromotionInput, "type: string", "The reusable promotion PR number must be a string.")
requireText(reusableOperationInput, "required: false", "The internal operation mode must remain optional for normal promotion.")
requireText(reusableOperationInput, "default: deploy", "Normal reusable calls must default to deploy mode.")
requireText(reusableOperationInput, "type: string", "The internal operation mode must be a string.")
requireText(
    reusableDeploy,
    "value: ${{ jobs.remote.outputs.deployment_status }}",
    "Reusable deployment must report the remote completion status to its caller.",
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
    /github\.event_name == 'push'[\s\S]*github\.ref == 'refs\/heads\/deploy'[\s\S]*!endsWith\(github\.actor, '\[bot\]'\)[\s\S]*vars\.PRODUCTION_CD_ENABLED == 'true'/,
    "Direct production push handling must require deploy, a non-bot actor, and the production feature gate.",
)
assert.match(
    preflight,
    /inputs\.candidate_sha != '' && inputs\.ci_run_id != ''/,
    "Reusable production calls must supply both the frozen candidate and successful main CI run.",
)
assert.match(
    preflight,
    /\(github\.event_name == 'workflow_dispatch' &&\s*github\.ref == 'refs\/heads\/deploy'\)/,
    "Manual audit and dry-run must run from deploy.",
)
assert.doesNotMatch(preflight, /secrets\./, "The preflight job must not read production secrets")
assert.doesNotMatch(validation, /\benvironment:/, "Candidate validation must not enter the production environment")
assert.doesNotMatch(validation, /secrets\./, "Candidate validation must not read production secrets")
assert.doesNotMatch(remote, /production-storage-roundtrip|\bnpm\s/, "The secret-bearing runner must never execute candidate code")
requireText(preflight, 'if (!["audit", "dry-run"].includes(mode))', "Manual mode must be restricted to audit and dry-run.")
requireText(preflight, 'let mode = "deploy"', "Only automated deploy entry points may retain deploy mode.")
for (const token of [
    '["Promote deploy", { file: "promote-deploy.yml", ref: "main", modes: ["deploy"] }]',
    '["Resume deploy", { file: "resume-deploy.yml", ref: "deploy", modes: ["deploy"] }]',
    '["Audit deploy baseline", { file: "audit-deploy-baseline.yml", ref: "main", modes: ["audit", "dry-run"] }]',
    "process.env.CALLER_WORKFLOW_REF !== expectedRef",
    "@refs/heads/${caller.ref}",
    '/^[0-9a-f]{40}$/.test(candidateSha)',
    '/^\\d+$/.test(runId)',
    'process.env.PRODUCTION_CD_ENABLED !== "false"',
    'process.env.PRODUCTION_CD_ENABLED !== "true"',
]) {
    requireText(preflight, token, `Reusable deployment caller validation is missing: ${token}`)
}
requireText(preflight, 'context.ref !== "refs/heads/deploy"', "Direct and manual CD entry points must reject other refs.")
requireText(preflight, 'context.actor.endsWith("[bot]")', "Bot pushes must not duplicate a reusable promotion deployment.")
for (const token of [
    "context.payload.deleted",
    "context.payload.forced",
    'base: context.payload.before',
    "head: context.sha",
    'pushComparison.status !== "ahead" || pushComparison.ahead_by < 1',
    "github.rest.pulls.list",
    'state: "all"',
    'base: "deploy"',
    'head: `${context.repo.owner}:main`',
    "pullRequest.head?.sha === candidateSha",
    'pullRequest.head?.ref === "main"',
    'pullRequest.base?.ref === "deploy"',
    "github.rest.pulls.listReviews",
    ".filter(review => review.commit_id === candidateSha)",
    'review.state === "CHANGES_REQUESTED"',
    'review.state === "APPROVED"',
    "if (!approvedPull)",
]) {
    requireText(preflight, token, `Direct deploy push fast-forward gate is missing: ${token}`)
}
requireText(preflight, 'branch: "deploy"', "Production preflight must resolve the frozen deploy branch.")
requireText(preflight, "if (!branch.protected)", "Production preflight must reject an unprotected deploy branch.")
requireText(preflight, "candidateSha && candidateSha !== branch.commit.sha", "CD must reject candidates that differ from deploy.")
requireText(preflight, "branch.commit.sha !== run.head_sha", "Every non-audit operation must match deploy to its successful main CI SHA.")

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
    "head_sha: branch.commit.sha",
    'status: "success"',
    "per_page: 100",
]) {
    requireText(successfulRunLookup, token, `Official listWorkflowRuns lookup is missing: ${token}`)
}
assert.doesNotMatch(
    successfulRunLookup,
    /(?:github\.request|fetch|curl)\s*\(/,
    "CI run discovery must use the typed GitHub Actions listWorkflowRuns endpoint.",
)

assert.doesNotMatch(files.deploy, /workflow_run:/, "A main CI completion must not directly trigger production CD.")
requireText(preflight, 'run.name !== "CI"', "CD must bind supplied run IDs to Calculator CI.")
requireText(preflight, 'run.path !== ".github/workflows/ci.yml"', "CD must bind supplied run IDs to ci.yml.")
requireText(preflight, 'run.head_branch !== "main"', "CD must require a successful main CI run.")
requireText(preflight, "run.head_repository?.full_name !== repository", "CD must reject CI runs from another repository.")
assert.equal(
    [...files.deploy.matchAll(/Calculator server artifact contains separately managed download payloads\./g)].length,
    2,
    "CD must reject bundled download payloads during validation and again before production access.",
)
requireText(files.deploy, "environment:", "CD must use the protected production environment.")
requireText(files.deploy, "run-id: ${{ needs.preflight.outputs.run_id }}", "CD must download the triggering CI run's artifact.")
requireText(files.deploy, "github-token: ${{ github.token }}", "Cross-run artifact download must use the scoped workflow token.")
assert.doesNotMatch(files.deploy, /npm run (?:build|package)/, "CD must consume the CI artifact without rebuilding it")
requireText(files.deploy, "source_branch=main", "Deployment evidence must identify main as the verified source branch.")
requireText(files.deploy, "release_branch=deploy", "Deployment evidence must identify deploy as the frozen release branch.")
requireText(remote, "deployment_status: ${{ steps.completion.outputs.status }}", "The remote job must expose its completion status.")
requireText(remote, "printf 'status=success\\n' >> \"$GITHUB_OUTPUT\"", "Only a completed remote operation may report success.")
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
requireText(files.deploy, 'assert_deploy_current "before first SSH/SCP"', "CD must reject stale deploy before connecting to production.")
requireText(files.deploy, 'assert_deploy_current "immediately before deploy invocation"', "CD must re-check deploy immediately before deployment.")
requireText(files.deploy, 'assert_deploy_current "immediately after deploy invocation"', "CD must roll back if deploy moves during the server transaction.")
requireText(files.deploy, 'assert_deploy_current "after public verification"', "CD must keep deploy frozen through public verification.")
requireText(remote, ".protected == true", "Production access must repeatedly require deploy branch protection.")
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

const baselineTriggers = section(files.baseline, "on:", "\npermissions:")
requireText(baselineTriggers, "workflow_dispatch:", "Baseline audit must be explicitly dispatched.")
assert.match(baselineTriggers, /^\s*- audit\s*$/m, "Baseline workflow must support audit.")
assert.match(baselineTriggers, /^\s*- dry-run\s*$/m, "Baseline workflow must support dry-run.")
assert.doesNotMatch(baselineTriggers, /^\s*- deploy\s*$/m, "Baseline workflow must never expose deploy mode.")
assert.doesNotMatch(files.baseline, /\benvironment:|secrets\.|contents:\s*write|git\.updateRef/, "Baseline audit must not write branches or read production secrets directly.")
const baselineValidation = section(files.baseline, "  validate:", "\n  production:")
const baselineCall = section(files.baseline, "  production:")
for (const token of [
    'context.ref !== "refs/heads/main"',
    'process.env.PRODUCTION_CD_ENABLED !== "false"',
    'getBranch("main")',
    'getBranch("deploy")',
    "context.sha !== main.commit.sha",
    "base: deploy.commit.sha",
    "head: main.commit.sha",
    '["ahead", "identical"].includes(comparison.status)',
    'workflow_id: "ci.yml"',
    'branch: "main"',
    "head_sha: deploy.commit.sha",
    'candidate.path === ".github/workflows/ci.yml"',
    "candidate.head_sha === deploy.commit.sha",
    "github.rest.actions.listWorkflowRunArtifacts",
    "artifact.name === artifactName",
    "!artifact.expired",
    "artifact.size_in_bytes > 0",
    "finalMain.commit.sha !== main.commit.sha",
    "finalDeploy.commit.sha !== deploy.commit.sha",
    "!finalMain.protected",
    "!finalDeploy.protected",
]) {
    requireText(baselineValidation, token, `Baseline deploy audit contract is missing: ${token}`)
}
for (const token of [
    `uses: ${expectedLocalWorkflowRef}`,
    "candidate_sha: ${{ needs.validate.outputs.candidate_sha }}",
    "ci_run_id: ${{ needs.validate.outputs.ci_run_id }}",
    "operation_mode: ${{ needs.validate.outputs.operation_mode }}",
    "secrets: inherit",
]) {
    requireText(baselineCall, token, `Baseline reusable deployment call is missing: ${token}`)
}

const prepareTriggers = section(files.prepare, "on:", "\npermissions:")
requireText(prepareTriggers, "workflow_dispatch:", "Prepare deploy must be an explicit manual operation.")
assert.doesNotMatch(prepareTriggers, /\b(?:push|pull_request|workflow_call|workflow_run):/, "Prepare deploy must not run automatically.")
assert.doesNotMatch(files.prepare, /\benvironment:|secrets\./, "Preparing an approval record must not access production.")
assert.doesNotMatch(files.prepare, /git\.updateRef|pulls\.merge/, "Prepare deploy must not move or merge a branch.")
for (const token of [
    'context.ref !== "refs/heads/main"',
    'getBranch("main")',
    'getBranch("deploy")',
    "deploy.commit.sha === main.commit.sha",
    "base: deploy.commit.sha",
    "head: main.commit.sha",
    'comparison.status !== "ahead" || comparison.ahead_by < 1',
    'workflow_id: "ci.yml"',
    'branch: "main"',
    "head_sha: main.commit.sha",
    'status: "success"',
    'candidate.path === ".github/workflows/ci.yml"',
    "candidate.head_sha === main.commit.sha",
    "candidate.head_repository?.full_name === repository",
    "github.rest.actions.listWorkflowRunArtifacts",
    "candidate.name === artifactName",
    "!candidate.expired",
    "candidate.size_in_bytes > 0",
    "latestMain.commit.sha !== main.commit.sha",
    "latestDeploy.commit.sha !== deploy.commit.sha",
    "!latestMain.protected",
    "!latestDeploy.protected",
    "github.rest.pulls.list",
    'state: "open"',
    'base: "deploy"',
    'head: `${context.repo.owner}:main`',
    "existing.length > 1",
    "github.rest.pulls.update",
    "github.rest.pulls.create",
    'head: "main"',
    'base: "deploy"',
    "maintainer_can_modify: false",
    "Do not merge this PR in the GitHub UI.",
]) {
    requireText(files.prepare, token, `Prepare-deploy approval contract is missing: ${token}`)
}

const newPromotionArchitecture = files.promote.includes("actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349")
    && files.eligibility.includes("name: Deploy eligibility")
if (newPromotionArchitecture) {
    const eligibilityWorkflow = files.eligibility
    const promoteTriggers = section(files.promote, "on:", "\npermissions:")
    const promotionPreflight = section(files.promote, "  promotion_preflight:", "\n  promote:")
    const promotion = section(files.promote, "  promote:", "\n  production:")
    const successfulPromotionReport = section(files.promote, "  report-success:", "\n  report-failure:")
    requireText(eligibilityWorkflow, "pull_request_review:", "Eligibility must run on promotion reviews.")
    requireText(eligibilityWorkflow, "name: eligibility", "Eligibility must expose the stable required check name.")
    requireText(eligibilityWorkflow, "github.rest.pulls.listReviews", "Eligibility must verify human review state.")
    requireText(eligibilityWorkflow, "github.rest.actions.listWorkflowRuns", "Eligibility must bind to main CI.")
    requireText(eligibilityWorkflow, "github.rest.actions.listWorkflowRunArtifacts", "Eligibility must bind to the exact artifact.")
    assert.doesNotMatch(eligibilityWorkflow, /contents:\s*write|secrets\.|git\.updateRef/, "Eligibility must remain read-only.")
    requireText(promoteTriggers, "workflow_run:", "Promotion must consume the eligibility workflow result.")
    requireText(promoteTriggers, "Deploy eligibility", "Promotion must be tied to the named eligibility workflow.")
    requireText(promoteTriggers, "workflow_dispatch:", "Promotion must retain an explicit retry entry point.")
    requireText(files.promote, "context.payload.workflow_run?.head_sha", "Promotion must bind workflow_run to its candidate SHA.")
    requireText(files.promote, "context.payload.workflow_run?.pull_requests?.[0]?.number", "Promotion must resolve the promotion PR from workflow_run.")
    requireText(files.promote, "actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349", "Promotion must mint a pinned GitHub App token.")
    requireText(files.promote, "secrets.DEPLOY_PROMOTER_APP_ID", "Promotion App ID secret is missing.")
    requireText(files.promote, "secrets.DEPLOY_PROMOTER_PRIVATE_KEY", "Promotion App private-key secret is missing.")
    requireText(files.promote, "github-token: ${{ steps.app-token.outputs.token }}", "Branch writes must use the App token.")
    requireText(files.promote, "github.rest.git.updateRef", "Promotion must update deploy through the GitHub API.")
    requireText(files.promote, "force: false", "Promotion must never force-update deploy.")
    assert.doesNotMatch(files.promote, /force:\s*true|pulls\.merge/, "Promotion must not force-update or merge the PR.")
    requireText(files.promote, "cancel-in-progress: false", "A running production promotion must not be cancelled.")
    for (const [output, expression] of [
        ["candidate_sha", 'core.setOutput("candidate_sha", main.commit.sha)'],
        ["deploy_sha", 'core.setOutput("deploy_sha", deploy.commit.sha)'],
        ["ci_run_id", 'core.setOutput("ci_run_id", String(run.id))'],
        ["artifact_name", 'core.setOutput("artifact_name", artifactName)'],
        ["promotion_pr_number", 'core.setOutput("promotion_pr_number", String(pullNumber))'],
    ]) {
        requireText(
            promotionPreflight,
            `${output}: ` + "${{ steps.validate.outputs." + output + " }}",
            `Promotion preflight must expose ${output}.`,
        )
        requireText(promotionPreflight, expression, `Promotion preflight must set ${output}.`)
        requireText(
            promotion,
            "needs.promotion_preflight.outputs." + output,
            `Promotion must consume validated ${output}.`,
        )
    }
    requireText(promotion, "workflowRunSha !== expectedCandidateSha", "Automatic promotion must bind the eligibility SHA to preflight.")
    requireText(promotion, "main.commit.sha !== expectedCandidateSha", "Promotion must re-check the preflight main SHA.")
    requireText(promotion, "deploy.commit.sha !== expectedDeploySha", "Promotion must re-check the preflight deploy SHA.")
    requireText(promotion, "String(candidate.id) === expectedCiRunId", "Promotion must use the preflight CI run.")
    requireText(promotion, "artifactName !== expectedArtifactName", "Promotion must use the preflight artifact name.")
    assert.doesNotMatch(
        promotion,
        /REQUESTED_PR_NUMBER:\s*\$\{\{\s*inputs\.pr_number/,
        "Promotion must not read the manual-only PR input after preflight.",
    )
    assert.doesNotMatch(
        promotion,
        /github\.rest\.(?:pulls\.update|issues\.createComment)/,
        "The least-privilege App token must not perform PR writes.",
    )
    requireText(successfulPromotionReport, "github.rest.pulls.update", "The workflow token must close a still-open promotion record after success.")
    requireText(files.promote, "promotion-evidence.json", "Promotion evidence must be retained.")
    requireText(files.promote, "secrets: inherit", "Production reusable workflow must inherit its protected secrets.")
} else {
const promoteTriggers = section(files.promote, "on:", "\npermissions:")
const promotionEvents = section(promoteTriggers, "  pull_request:", "\n  workflow_dispatch:")
for (const token of ["pull_request:", "pull_request_review:", "opened", "synchronize", "reopened", "ready_for_review", "submitted", "dismissed", "- deploy"]) {
    requireText(promotionEvents, token, `Promotion eligibility trigger is missing: ${token}`)
}
const promoteDispatch = section(promoteTriggers, "  workflow_dispatch:")
for (const token of ["pr_number:", "required: true", "type: number"]) {
    requireText(promoteDispatch, token, `Promotion dispatch contract is missing: ${token}`)
}
const promotePermissions = section(files.promote, "permissions:", "\njobs:")
requireText(promotePermissions, "contents: read", "Promotion must default to read-only repository access.")
assert.doesNotMatch(promotePermissions, /contents:\s*write/, "Only the explicit promotion job may write deploy.")

const eligibility = section(files.promote, "  eligibility:", "\n  promote:")
const promotion = section(files.promote, "  promote:", "\n  production:")
const promotedDeployment = section(files.promote, "  production:", "\n  report-success:")
const successfulPromotionReport = section(files.promote, "  report-success:", "\n  report-failure:")
const reportPromotionFailure = section(files.promote, "  report-failure:")
requireText(
    eligibility,
    "'ignored non-deploy review' || 'eligibility'",
    "Skipped reviews for unrelated PRs must not create a passing eligibility check context.",
)
assert.match(
    eligibility,
    /github\.event_name == 'pull_request'[\s\S]*\|\|[\s\S]*github\.event_name == 'pull_request_review'/,
    "PR and review events must perform eligibility checks only.",
)
assert.doesNotMatch(eligibility, /contents:\s*write|git\.updateRef|uses:\s*\.\//, "Eligibility checks must remain read-only.")
requireText(eligibility, "github.event_name == 'workflow_dispatch'", "Manual promotion dispatch must run the real eligibility job.")
requireText(promotion, "needs: eligibility", "The write job must depend on the successful eligibility check.")
requireText(promotion, "needs.eligibility.result == 'success'", "Only successful eligibility may advance deploy.")
requireText(promotion, "contents: write", "The promotion job needs narrowly scoped branch-write permission.")
assert.doesNotMatch(files.promote, /force:\s*true|pulls\.merge/, "Promotion must never force-update or merge the approval PR.")
assert.doesNotMatch(files.promote, /\benvironment:|secrets\./, "Promotion and eligibility must not access production secrets.")
requireText(files.promote, "github.event_name == 'workflow_dispatch' && 'deploy-promotion-write'", "Promotion dispatch must hold the workflow-wide write lock.")
requireText(files.promote, "cancel-in-progress: false", "A running production promotion must not be cancelled.")

for (const [label, contents] of [["eligibility", eligibility], ["promotion", promotion]]) {
    for (const token of [
        "github.rest.pulls.get",
        'pullRequest.state !== "open"',
        "pullRequest.draft",
        'pullRequest.base?.ref !== "deploy"',
        'pullRequest.head?.ref !== "main"',
        "pullRequest.head?.repo?.full_name !== repository",
        "github.rest.pulls.listReviews",
        ".filter(review => review.commit_id ===",
        'review.user?.type !== "User"',
        "review.user?.login === pullRequest.user?.login",
        '["OWNER", "MEMBER", "COLLABORATOR"].includes(review.author_association)',
        'review.state === "CHANGES_REQUESTED"',
        'review.state === "APPROVED"',
        'getBranch("main")',
        'getBranch("deploy")',
        "!main.protected || !deploy.protected",
        "pullRequest.head.sha !== main.commit.sha",
        "pullRequest.base.sha !== deploy.commit.sha",
        "base: deploy.commit.sha",
        "head: main.commit.sha",
        'comparison.status !== "ahead" || comparison.ahead_by < 1',
        "github.rest.actions.listWorkflowRuns",
        'workflow_id: "ci.yml"',
        'branch: "main"',
        "head_sha: main.commit.sha",
        'status: "success"',
        'candidate.path === ".github/workflows/ci.yml"',
        "candidate.head_sha === main.commit.sha",
        "candidate.head_repository?.full_name === repository",
        "github.rest.actions.listWorkflowRunArtifacts",
        "artifact.name === artifactName",
        "!artifact.expired",
        "artifact.size_in_bytes > 0",
    ]) {
        requireText(contents, token, `Promote-deploy ${label} contract is missing: ${token}`)
    }
}
for (const token of [
    'context.ref !== "refs/heads/main"',
    'process.env.PRODUCTION_CD_ENABLED !== "true"',
    "finalPullRequest.head.sha !== main.commit.sha",
    "finalPullRequest.base.sha !== deploy.commit.sha",
    "finalMain.commit.sha !== main.commit.sha",
    "finalDeploy.commit.sha !== deploy.commit.sha",
    "!finalMain.protected",
    "!finalDeploy.protected",
    "getArtifacts()",
    "github.rest.git.updateRef",
    'ref: "heads/deploy"',
    "sha: main.commit.sha",
    "force: false",
    "liveDeploy.commit.sha !== main.commit.sha",
    'core.setOutput("candidate_sha", main.commit.sha)',
    'core.setOutput("ci_run_id", String(run.id))',
    'core.setOutput("pr_number", String(pullNumber))',
    'path.join(process.env.RUNNER_TEMP, "promotion-evidence.json")',
    'updateMode: "fast-forward"',
    "force: false",
    "github.rest.pulls.update",
    'state: "closed"',
    "indirectlyMerged: Boolean(promotionRecord.merged_at)",
    "effectiveReviews: finalReviews.map",
    "reviewer: review.user.login",
    "reviewId: review.id",
    "commitSha: review.commit_id",
    "submittedAt: review.submitted_at",
    "authorAssociation: review.author_association",
]) {
    requireText(promotion, token, `Promotion write contract is missing: ${token}`)
}
const promotionEvidenceUpload = section(promotion, "      - name: Upload promotion evidence")
for (const token of [
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    "promotion-evidence.json",
    "if-no-files-found: error",
    "retention-days: 14",
]) {
    requireText(promotionEvidenceUpload, token, `Promotion evidence upload is missing: ${token}`)
}
for (const [label, contents, shaExpression] of [
    ["eligibility", eligibility, "pullRequest.head.sha"],
    ["promotion", promotion, "headSha"],
    ["resume", files.resume, "candidateSha"],
]) {
    const latestReviewIndex = contents.indexOf("effectiveByReviewer.set")
    const shaFilterIndex = contents.indexOf(`.filter(review => review.commit_id === ${shaExpression})`)
    assert.ok(latestReviewIndex >= 0, `${label} must select each human reviewer's latest state.`)
    assert.ok(
        shaFilterIndex > latestReviewIndex,
        `${label} must select the latest reviewer state before binding it to the candidate SHA.`,
    )
}
for (const token of [
    "needs.promote.result == 'success'",
    `uses: ${expectedLocalWorkflowRef}`,
    "candidate_sha: ${{ needs.promote.outputs.candidate_sha }}",
    "ci_run_id: ${{ needs.promote.outputs.ci_run_id }}",
    "promotion_pr_number: ${{ needs.promote.outputs.pr_number }}",
    "secrets: inherit",
]) {
    requireText(promotedDeployment, token, `Promoted deployment call is missing: ${token}`)
}
for (const token of [
    "needs.production.result == 'success'",
    "needs.production.outputs.deployment_status == 'success'",
    "github.rest.issues.createComment",
    "The promotion record is complete.",
]) {
    requireText(successfulPromotionReport, token, `Successful promotion reporting contract is missing: ${token}`)
}
for (const token of [
    "needs.production.result != 'success'",
    "needs.production.outputs.deployment_status != 'success'",
    "deploy remains frozen; use Resume deploy",
]) {
    requireText(reportPromotionFailure, token, `Failed promotion reporting contract is missing: ${token}`)
}

}

const resumeTriggers = section(files.resume, "on:", "\npermissions:")
requireText(resumeTriggers, "workflow_dispatch:", "Resume deploy must be manually dispatched.")
assert.doesNotMatch(resumeTriggers, /\b(?:push|pull_request|workflow_call|workflow_run):/, "Resume deploy must not run automatically.")
const resumeCandidateInput = section(resumeTriggers, "      candidate_sha:", "\n      ci_run_id:")
const resumeRunInput = section(resumeTriggers, "      ci_run_id:", "\n      promotion_pr_number:")
const resumePromotionInput = section(resumeTriggers, "      promotion_pr_number:")
for (const [inputName, input, type] of [
    ["candidate_sha", resumeCandidateInput, "string"],
    ["ci_run_id", resumeRunInput, "string"],
    ["promotion_pr_number", resumePromotionInput, "number"],
]) {
    requireText(input, "required: true", `Resume input ${inputName} must be required.`)
    requireText(input, `type: ${type}`, `Resume input ${inputName} must use type ${type}.`)
}
assert.doesNotMatch(files.resume, /\benvironment:|secrets\.|git\.updateRef|contents:\s*write/, "Resume must validate and call CD without direct production or branch-write access.")
requireText(files.resume, "group: deploy-promotion-write", "Resume must hold the promotion lock for its entire deployment call.")
requireText(files.resume, "cancel-in-progress: false", "A running frozen-candidate resume must not be cancelled.")
const resumeValidation = section(files.resume, "  validate:", "\n  production:")
const resumedDeployment = section(files.resume, "  production:", "\n  report:")
const resumeReport = section(files.resume, "  report:")
for (const token of [
    'context.ref !== "refs/heads/deploy"',
    'process.env.PRODUCTION_CD_ENABLED !== "true"',
    '/^[0-9a-f]{40}$/.test(candidateSha || "")',
    '/^\\d+$/.test(runId || "")',
    "Number.isSafeInteger(pullNumber)",
    'getBranch("deploy")',
    "context.sha !== deploy.commit.sha",
    "deploy.commit.sha !== candidateSha",
    "if (!deploy.protected)",
    "github.rest.pulls.get",
    'pullRequest.base?.ref !== "deploy"',
    'pullRequest.head?.ref !== "main"',
    "pullRequest.head?.repo?.full_name !== repository",
    "github.rest.pulls.listReviews",
    ".filter(review => review.commit_id === candidateSha)",
    'review.user?.type !== "User"',
    "review.user?.login === pullRequest.user?.login",
    '["OWNER", "MEMBER", "COLLABORATOR"].includes(review.author_association)',
    'review.state === "CHANGES_REQUESTED"',
    'review.state === "APPROVED"',
    "github.rest.actions.getWorkflowRun",
    'run.path !== ".github/workflows/ci.yml"',
    'run.head_branch !== "main"',
    "run.head_sha !== candidateSha",
    "run.head_repository?.full_name !== repository",
    "github.rest.actions.listWorkflowRunArtifacts",
    "artifact.name === artifactName",
    "!artifact.expired",
    "artifact.size_in_bytes > 0",
    "finalDeploy.commit.sha !== candidateSha || !finalDeploy.protected",
    'core.setOutput("candidate_sha", candidateSha)',
    'core.setOutput("ci_run_id", String(run.id))',
    'core.setOutput("promotion_pr_number", String(pullNumber))',
]) {
    requireText(resumeValidation, token, `Resume-deploy frozen candidate contract is missing: ${token}`)
}
for (const token of [
    "needs.validate.result == 'success'",
    `uses: ${expectedLocalWorkflowRef}`,
    "candidate_sha: ${{ needs.validate.outputs.candidate_sha }}",
    "ci_run_id: ${{ needs.validate.outputs.ci_run_id }}",
    "promotion_pr_number: ${{ needs.validate.outputs.promotion_pr_number }}",
    "secrets: inherit",
]) {
    requireText(resumedDeployment, token, `Resumed deployment call is missing: ${token}`)
}
requireText(resumeReport, "if: always() && needs.validate.result == 'success'", "Resume outcomes must always be recorded after validation.")
requireText(resumeReport, "needs.production.outputs.deployment_status", "Resume reporting must consume the reusable deployment status.")

requireText(files.rollback, "inputs.confirm == true", "Manual rollback must require explicit confirmation.")
const rollbackTriggers = section(files.rollback, "on:", "\npermissions:")
requireText(rollbackTriggers, "workflow_dispatch:", "Rollback must be manually dispatched.")
assert.doesNotMatch(rollbackTriggers, /\b(?:push|pull_request|workflow_call|workflow_run):/, "Rollback must not run automatically.")
requireText(files.rollback, "github.ref == 'refs/heads/deploy'", "Rollback must run from protected deploy.")
requireText(files.rollback, "environment:", "Rollback must use the protected production environment.")
requireText(files.rollback, "StrictHostKeyChecking=yes", "Rollback must pin host key checking.")
requireText(files.rollback, "EXPECTED_DEPLOY_SHA: ${{ github.sha }}", "Rollback must bind itself to the dispatched deploy SHA.")
requireText(files.rollback, 'branches/deploy', "Rollback must re-read deploy through the GitHub API.")
requireText(files.rollback, "assert_deploy_current", "Rollback must reject a stale deploy branch before using production access.")
requireText(files.rollback, ".protected == true", "Rollback must reject removed deploy branch protection.")
requireText(files.rollback, "if ! verify_rollback_public || ! assert_deploy_current; then", "Rollback must restore the original release if deploy moves during verification.")
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
