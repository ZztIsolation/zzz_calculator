import assert from "node:assert/strict"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const requireForScript = createRequire(import.meta.url)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const candidateSha = "a".repeat(40)
const deploySha = "b".repeat(40)
const advancedMainSha = "c".repeat(40)
const changedDeploySha = "d".repeat(40)
const repository = "ZztIsolation/zzz_calculator"
const owner = "ZztIsolation"

async function readGithubScript(stepName) {
    const contents = (await readFile(
        path.join(rootDir, ".github/workflows/promote-deploy.yml"),
        "utf8",
    )).replaceAll("\r\n", "\n")
    const stepMarker = "      - name: " + stepName + "\n"
    const stepStart = contents.indexOf(stepMarker)
    assert.notEqual(stepStart, -1, "Missing workflow step: " + stepName)
    const scriptMarker = "          script: |\n"
    const scriptStart = contents.indexOf(scriptMarker, stepStart)
    assert.notEqual(scriptStart, -1, "Missing github-script body: " + stepName)
    const bodyStart = scriptStart + scriptMarker.length
    const remaining = contents.slice(bodyStart)
    const nextJobMatch = remaining.match(/\n  [a-zA-Z0-9_-]+:\n/)
    const nextJob = nextJobMatch ? bodyStart + nextJobMatch.index : -1
    const boundaries = [
        contents.indexOf("\n      - name:", bodyStart),
        nextJob,
    ].filter(index => index !== -1)
    const bodyEnd = boundaries.length ? Math.min(...boundaries) : contents.length
    const body = contents.slice(bodyStart, bodyEnd)
    return body.split("\n")
        .map(line => line.startsWith("            ") ? line.slice(12) : line)
        .join("\n")
}

const workflow = await readFile(
    path.join(rootDir, ".github/workflows/promote-deploy.yml"),
    "utf8",
)
const eligibilityScript = await readGithubScript("Validate explicit promotion candidate")
const promotionScript = await readGithubScript("Validate explicit request and fast-forward deploy")

assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/)
assert.match(workflow, /candidate_sha:[\s\S]*required: true[\s\S]*type: string/)
assert.match(workflow, /confirm_production:[\s\S]*required: true[\s\S]*type: boolean/)
assert.doesNotMatch(workflow, /\bworkflow_run:|\bpull_request(?:_review)?:/)
assert.doesNotMatch(workflow, /promotion_pr_number|github\.rest\.pulls|github\.rest\.issues/)
assert.doesNotMatch(workflow, /pull-requests:\s*(?:read|write)/)
assert.match(workflow, /github\.actor == github\.repository_owner/)
assert.match(workflow, /github\.triggering_actor == github\.repository_owner/)
assert.match(workflow, /actions\/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349/)
assert.match(workflow, /permission-actions:\s*read/)
assert.match(workflow, /permission-contents:\s*write/)
assert.match(workflow, /steps\.app-token\.outputs\.installation-id/)
assert.match(workflow, /steps\.app-token\.outputs\.app-slug/)
assert.match(workflow, /github-token: \$\{\{ steps\.app-token\.outputs\.token \}\}/)
assert.match(workflow, /github\.rest\.git\.updateRef/)
assert.match(workflow, /force:\s*false/)
assert.doesNotMatch(workflow, /force:\s*true|deleteRef|pulls\.merge/)
assert.match(workflow, /promotion_run_id: \$\{\{ needs\.promote\.outputs\.promotion_run_id \}\}/)
assert.match(workflow, /authorization:[\s\S]*type: "workflow_dispatch"/)
await assert.rejects(
    access(path.join(rootDir, ".github/workflows/prepare-deploy.yml")),
    error => error?.code === "ENOENT",
)
await assert.rejects(
    access(path.join(rootDir, ".github/workflows/deploy-eligibility.yml")),
    error => error?.code === "ENOENT",
)

function successfulRun(sha = candidateSha) {
    return {
        id: 701,
        name: "CI",
        path: ".github/workflows/ci.yml",
        event: "push",
        head_branch: "main",
        head_sha: sha,
        conclusion: "success",
        head_repository: { full_name: repository },
        html_url: "https://example.invalid/actions/runs/701",
    }
}

function validArtifact(sha = candidateSha) {
    return {
        id: 801,
        name: "server-release-" + sha,
        expired: false,
        size_in_bytes: 1024,
    }
}

function valueAt(values, index) {
    return values[Math.min(index, values.length - 1)]
}

function createCore() {
    const failures = []
    const outputs = new Map()
    const summary = {
        addHeading() { return this },
        addRaw() { return this },
        async write() {},
    }
    return {
        failures,
        outputs,
        core: {
            summary,
            setFailed(message) { failures.push(message) },
            setOutput(name, value) { outputs.set(name, String(value)) },
            info() {},
            warning() {},
        },
    }
}

async function withEnvironment(values, callback) {
    const saved = Object.fromEntries(
        Object.keys(values).map(name => [name, process.env[name]]),
    )
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = String(value)
    }
    try {
        return await callback()
    } finally {
        for (const [name, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[name]
            else process.env[name] = value
        }
    }
}

async function executeEligibility(overrides = {}) {
    const state = {
        mainShas: overrides.mainShas ?? [candidateSha],
        deployShas: overrides.deployShas ?? [deploySha],
        protectedBranches: overrides.protectedBranches ?? true,
        comparisons: overrides.comparisons ?? [],
        runs: overrides.runs ?? [successfulRun()],
        artifactBatches: overrides.artifactBatches ?? [[validArtifact()]],
    }
    const branchReads = { main: 0, deploy: 0 }
    let comparisonRead = 0
    let artifactRead = 0
    const rest = {
        repos: {
            getBranch: async ({ branch }) => {
                const values = branch === "main" ? state.mainShas : state.deployShas
                const index = branchReads[branch]++
                return {
                    data: {
                        protected: state.protectedBranches,
                        commit: { sha: valueAt(values, index) },
                    },
                }
            },
            compareCommits: async () => ({
                data: valueAt(
                    state.comparisons.length ? state.comparisons : [{ status: "ahead", ahead_by: 1 }],
                    comparisonRead++,
                ),
            }),
        },
        actions: {
            listWorkflowRuns: async () => ({ data: { workflow_runs: state.runs } }),
            listWorkflowRunArtifacts: async () => ({
                data: { artifacts: valueAt(state.artifactBatches, artifactRead++) },
            }),
        },
    }
    const github = {
        rest,
        paginate: async (endpoint, input) => {
            const response = await endpoint(input)
            return response.data.artifacts
        },
    }
    const { core, failures, outputs } = createCore()
    const context = {
        actor: owner,
        eventName: "workflow_dispatch",
        ref: "refs/heads/main",
        repo: { owner, repo: "zzz_calculator" },
        runId: 601,
        sha: candidateSha,
        ...overrides.contextOverrides,
    }
    await withEnvironment({
        REQUESTED_CANDIDATE_SHA: overrides.requestedCandidateSha ?? candidateSha,
        CONFIRM_PRODUCTION: overrides.confirmProduction ?? "true",
        REQUESTED_BY: overrides.requestedBy ?? owner,
        TRIGGERING_ACTOR: overrides.triggeringActor ?? owner,
        PRODUCTION_CD_ENABLED: overrides.productionEnabled ?? "true",
    }, async () => {
        const run = new AsyncFunction("github", "context", "core", eligibilityScript)
        await run(github, context, core)
    })
    return { failures, outputs }
}

async function executePromotion(overrides = {}) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-promotion-test-"))
    const state = {
        mainShas: overrides.mainShas ?? [candidateSha],
        deployShas: overrides.deployShas ?? [deploySha],
        protectedBranches: overrides.protectedBranches ?? true,
        comparisons: overrides.comparisons ?? [],
        run: overrides.run ?? successfulRun(),
        artifactBatches: overrides.artifactBatches ?? [[validArtifact()]],
        updateErrorStatus: overrides.updateErrorStatus,
        liveDeployAfterUpdate: overrides.liveDeployAfterUpdate ?? candidateSha,
        updated: false,
    }
    const branchReads = { main: 0, deploy: 0 }
    let comparisonRead = 0
    let artifactRead = 0
    const updateCalls = []
    const rest = {
        repos: {
            getBranch: async ({ branch }) => {
                if (branch === "deploy" && state.updated) {
                    return {
                        data: {
                            protected: state.protectedBranches,
                            commit: { sha: state.liveDeployAfterUpdate },
                        },
                    }
                }
                const values = branch === "main" ? state.mainShas : state.deployShas
                const index = branchReads[branch]++
                return {
                    data: {
                        protected: state.protectedBranches,
                        commit: { sha: valueAt(values, index) },
                    },
                }
            },
            compareCommits: async () => ({
                data: valueAt(
                    state.comparisons.length ? state.comparisons : [{ status: "ahead", ahead_by: 1 }],
                    comparisonRead++,
                ),
            }),
        },
        actions: {
            getWorkflowRun: async () => ({ data: state.run }),
            listWorkflowRunArtifacts: async () => ({
                data: { artifacts: valueAt(state.artifactBatches, artifactRead++) },
            }),
        },
        git: {
            updateRef: async input => {
                updateCalls.push(input)
                if (state.updateErrorStatus) {
                    const error = new Error("update rejected")
                    error.status = state.updateErrorStatus
                    throw error
                }
                state.updated = true
                return { data: { object: { sha: input.sha } } }
            },
        },
    }
    const github = {
        rest,
        paginate: async (endpoint, input) => {
            const response = await endpoint(input)
            return response.data.artifacts
        },
    }
    const { core, failures, outputs } = createCore()
    const context = {
        actor: owner,
        eventName: "workflow_dispatch",
        ref: "refs/heads/main",
        repo: { owner, repo: "zzz_calculator" },
        runId: 601,
        sha: candidateSha,
        ...overrides.contextOverrides,
    }
    const environment = {
        PREFLIGHT_CANDIDATE_SHA: overrides.preflightCandidateSha ?? candidateSha,
        PREFLIGHT_DEPLOY_SHA: overrides.preflightDeploySha ?? deploySha,
        PREFLIGHT_CI_RUN_ID: overrides.preflightCiRunId ?? "701",
        PREFLIGHT_ARTIFACT_NAME: overrides.preflightArtifactName ?? "server-release-" + candidateSha,
        PREFLIGHT_REQUESTED_BY: overrides.preflightRequestedBy ?? owner,
        PREFLIGHT_PROMOTION_RUN_ID: overrides.preflightPromotionRunId ?? "601",
        CONFIRM_PRODUCTION: overrides.confirmProduction ?? "true",
        REQUESTED_BY: overrides.requestedBy ?? owner,
        TRIGGERING_ACTOR: overrides.triggeringActor ?? owner,
        RUN_ATTEMPT: "1",
        WORKFLOW_REF: repository + "/.github/workflows/promote-deploy.yml@refs/heads/main",
        PROMOTER_INSTALLATION_ID: overrides.promoterInstallationId ?? "9001",
        PROMOTER_APP_SLUG: overrides.promoterAppSlug ?? "deploy-promoter",
        PRODUCTION_CD_ENABLED: overrides.productionEnabled ?? "true",
        RUNNER_TEMP: tempDir,
    }
    try {
        await withEnvironment(environment, async () => {
            const run = new AsyncFunction(
                "github",
                "context",
                "core",
                "require",
                promotionScript,
            )
            await run(github, context, core, requireForScript)
        })
        let evidence = null
        try {
            evidence = JSON.parse(
                await readFile(path.join(tempDir, "promotion-evidence.json"), "utf8"),
            )
        } catch (error) {
            if (error.code !== "ENOENT") throw error
        }
        return { evidence, failures, outputs, updateCalls }
    } finally {
        await rm(tempDir, { recursive: true, force: true })
    }
}

const eligibilitySuccess = await executeEligibility()
assert.deepEqual(eligibilitySuccess.failures, [])
assert.equal(eligibilitySuccess.outputs.get("candidate_sha"), candidateSha)
assert.equal(eligibilitySuccess.outputs.get("deploy_sha"), deploySha)
assert.equal(eligibilitySuccess.outputs.get("ci_run_id"), "701")
assert.equal(eligibilitySuccess.outputs.get("artifact_name"), "server-release-" + candidateSha)
assert.equal(eligibilitySuccess.outputs.get("requested_by"), owner)
assert.equal(eligibilitySuccess.outputs.get("promotion_run_id"), "601")

const eligibilityWithAdvancedMain = await executeEligibility({
    mainShas: [advancedMainSha],
})
assert.deepEqual(eligibilityWithAdvancedMain.failures, [])

const eligibilityFailures = [
    ["non-owner requester", { requestedBy: "collaborator" }, /repository owner/i],
    ["non-owner rerunner", { triggeringActor: "collaborator" }, /repository owner/i],
    ["missing confirmation", { confirmProduction: "false" }, /confirm_production/i],
    ["wrong dispatch ref", { contextOverrides: { ref: "refs/heads/feature" } }, /dispatched from main/i],
    ["malformed candidate", { requestedCandidateSha: "abc" }, /40-character/i],
    ["dispatch SHA mismatch", { contextOverrides: { sha: advancedMainSha } }, /dispatched main SHA/i],
    ["disabled production gate", { productionEnabled: "false" }, /must be true/i],
    ["unprotected branch", { protectedBranches: false }, /must be protected/i],
    ["candidate removed from main", {
        mainShas: [advancedMainSha],
        comparisons: [{ status: "diverged", ahead_by: 0 }],
    }, /no longer an ancestor/i],
    ["deploy already current", { deployShas: [candidateSha] }, /already points/i],
    ["non-fast-forward candidate", {
        comparisons: [{ status: "diverged", ahead_by: 0 }],
    }, /not a non-forced fast-forward/i],
    ["wrong CI", {
        runs: [{ ...successfulRun(), head_branch: "feature" }],
    }, /No successful main CI run/i],
    ["missing artifact", { artifactBatches: [[]] }, /missing, empty, or expired/i],
    ["deploy race", {
        deployShas: [deploySha, changedDeploySha],
    }, /frozen base changed/i],
    ["artifact disappears", {
        artifactBatches: [[validArtifact()], []],
    }, /disappeared during eligibility/i],
]

for (const [name, overrides, expectedFailure] of eligibilityFailures) {
    const result = await executeEligibility(overrides)
    assert.ok(
        result.failures.some(message => expectedFailure.test(message)),
        name + " did not fail closed: " + result.failures.join("; "),
    )
    assert.equal(result.outputs.has("candidate_sha"), false, name + " exposed an eligible candidate")
}

const success = await executePromotion()
assert.deepEqual(success.failures, [])
assert.equal(success.updateCalls.length, 1)
assert.equal(success.updateCalls[0].ref, "heads/deploy")
assert.equal(success.updateCalls[0].sha, candidateSha)
assert.equal(success.updateCalls[0].force, false)
assert.equal(success.outputs.get("candidate_sha"), candidateSha)
assert.equal(success.outputs.get("previous_deploy_sha"), deploySha)
assert.equal(success.outputs.get("ci_run_id"), "701")
assert.equal(success.outputs.get("artifact_name"), "server-release-" + candidateSha)
assert.equal(success.outputs.get("promotion_run_id"), "601")
assert.equal(success.evidence.schemaVersion, 2)
assert.equal(success.evidence.authorization.type, "workflow_dispatch")
assert.equal(success.evidence.authorization.requestedBy, owner)
assert.equal(success.evidence.authorization.triggeringActor, owner)
assert.equal(success.evidence.authorization.workflowRunId, 601)
assert.equal(success.evidence.authorization.requestedCandidateSha, candidateSha)
assert.equal(success.evidence.candidateSha, candidateSha)
assert.equal(success.evidence.previousDeploySha, deploySha)
assert.equal(success.evidence.resultingDeploySha, candidateSha)
assert.equal(success.evidence.promoter.appSlug, "deploy-promoter")
assert.equal(success.evidence.promoter.installationId, 9001)
assert.equal(success.evidence.force, false)
assert.equal("promotionPrNumber" in success.evidence, false)
assert.equal("effectiveReviews" in success.evidence, false)

const successAfterMainAdvanced = await executePromotion({
    mainShas: [advancedMainSha],
})
assert.deepEqual(successAfterMainAdvanced.failures, [])
assert.equal(successAfterMainAdvanced.updateCalls.length, 1)
assert.equal(successAfterMainAdvanced.evidence.mainAdvancedBeyondCandidate, true)

const promotionFailures = [
    ["non-owner requester", { requestedBy: "collaborator" }, /repository owner/i],
    ["non-owner rerunner", { triggeringActor: "collaborator" }, /repository owner/i],
    ["missing confirmation", { confirmProduction: "false" }, /confirm_production/i],
    ["wrong dispatch ref", { contextOverrides: { ref: "refs/heads/feature" } }, /dispatched from main/i],
    ["stale preflight candidate", {
        preflightCandidateSha: advancedMainSha,
        preflightArtifactName: "server-release-" + advancedMainSha,
    }, /outputs are missing, stale, or invalid/i],
    ["tampered preflight deploy", {
        preflightDeploySha: changedDeploySha,
    }, /deploy advanced/i],
    ["tampered CI run", {
        preflightCiRunId: "999",
    }, /not the frozen successful main run/i],
    ["tampered artifact name", {
        preflightArtifactName: "server-release-" + advancedMainSha,
    }, /outputs are missing, stale, or invalid/i],
    ["tampered promotion run", {
        preflightPromotionRunId: "999",
    }, /outputs are missing, stale, or invalid/i],
    ["missing promoter installation identity", {
        promoterInstallationId: "",
    }, /outputs are missing, stale, or invalid/i],
    ["missing promoter app identity", {
        promoterAppSlug: "",
    }, /outputs are missing, stale, or invalid/i],
    ["unprotected branch", { protectedBranches: false }, /must remain protected/i],
    ["candidate removed from main", {
        mainShas: [advancedMainSha],
        comparisons: [{ status: "diverged", ahead_by: 0 }],
    }, /no longer an ancestor/i],
    ["non-fast-forward candidate", {
        comparisons: [{ status: "diverged", ahead_by: 0 }],
    }, /cannot be promoted with a non-forced fast-forward/i],
    ["wrong CI repository", {
        run: { ...successfulRun(), head_repository: { full_name: "other/repository" } },
    }, /not the frozen successful main run/i],
    ["missing artifact", { artifactBatches: [[]] }, /missing, empty, or expired/i],
    ["expired artifact", {
        artifactBatches: [[{ ...validArtifact(), expired: true }]],
    }, /missing, empty, or expired/i],
    ["empty artifact", {
        artifactBatches: [[{ ...validArtifact(), size_in_bytes: 0 }]],
    }, /missing, empty, or expired/i],
    ["deploy changes during validation", {
        deployShas: [deploySha, changedDeploySha],
    }, /frozen deploy base changed/i],
    ["artifact disappears before update", {
        artifactBatches: [[validArtifact()], []],
    }, /disappeared before promotion/i],
    ["ruleset rejects update", {
        updateErrorStatus: 422,
    }, /rejected the non-forced update/i],
]

for (const [name, overrides, expectedFailure] of promotionFailures) {
    const result = await executePromotion(overrides)
    assert.ok(
        result.failures.some(message => expectedFailure.test(message)),
        name + " did not fail closed: " + result.failures.join("; "),
    )
    const expectedUpdates = overrides.updateErrorStatus ? 1 : 0
    assert.equal(result.updateCalls.length, expectedUpdates, name + " unexpectedly changed deploy")
    assert.equal(result.evidence, null, name + " wrote successful promotion evidence")
}

const unsettledDeploy = await executePromotion({
    liveDeployAfterUpdate: changedDeploySha,
})
assert.equal(unsettledDeploy.updateCalls.length, 1)
assert.ok(unsettledDeploy.failures.some(message => /did not settle/i.test(message)))
assert.equal(unsettledDeploy.evidence, null)

console.log(
    "Explicit deploy promotion behavior checks passed (2 success paths, "
    + eligibilityFailures.length + " eligibility failures, "
    + promotionFailures.length + " pre-update failures, 1 post-update verification failure).",
)
