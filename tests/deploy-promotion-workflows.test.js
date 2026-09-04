import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const requireForScript = createRequire(import.meta.url)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const mainSha = "a".repeat(40)
const deploySha = "b".repeat(40)
const repository = "ZztIsolation/zzz_calculator"

async function readGithubScript(relativePath, stepName) {
    const contents = (await readFile(path.join(rootDir, relativePath), "utf8")).replaceAll("\r\n", "\n")
    const stepMarker = `      - name: ${stepName}\n`
    const stepStart = contents.indexOf(stepMarker)
    assert.notEqual(stepStart, -1, `Missing workflow step: ${stepName}`)
    const scriptMarker = "          script: |\n"
    const scriptStart = contents.indexOf(scriptMarker, stepStart)
    assert.notEqual(scriptStart, -1, `Missing github-script body: ${stepName}`)
    const bodyStart = scriptStart + scriptMarker.length
    const nextStep = contents.indexOf("\n      - name:", bodyStart)
    const body = contents.slice(bodyStart, nextStep === -1 ? contents.length : nextStep)
    return body.split("\n").map(line => line.startsWith("            ") ? line.slice(12) : line).join("\n")
}

const promotionScript = await readGithubScript(
    ".github/workflows/promote-deploy.yml",
    "Validate approved PR and fast-forward deploy",
)

function successfulReview() {
    return {
        id: 901,
        state: "APPROVED",
        commit_id: mainSha,
        submitted_at: "2026-09-04T00:00:00Z",
        author_association: "OWNER",
        user: { login: "reviewer", type: "User" },
    }
}

async function executePromotion(overrides = {}) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-promotion-test-"))
    const state = {
        mainSha,
        deploySha,
        protectedBranches: true,
        comparison: { status: "ahead", ahead_by: 1 },
        reviews: [successfulReview()],
        artifacts: [{
            id: 801,
            name: `server-release-${mainSha}`,
            expired: false,
            size_in_bytes: 1024,
        }],
        run: {
            id: 701,
            name: "CI",
            path: ".github/workflows/ci.yml",
            event: "push",
            head_branch: "main",
            head_sha: mainSha,
            conclusion: "success",
            head_repository: { full_name: repository },
            html_url: "https://example.invalid/actions/runs/701",
        },
        ...overrides,
    }
    const pullRequest = {
        number: 42,
        state: "open",
        merged_at: null,
        draft: false,
        user: { login: "github-actions[bot]" },
        base: { ref: "deploy", sha: deploySha },
        head: {
            ref: "main",
            sha: overrides.pullHeadSha ?? mainSha,
            repo: { full_name: repository },
        },
    }
    const updateCalls = []
    const comments = []
    const outputs = new Map()
    const failures = []

    const rest = {
        pulls: {
            get: async () => ({ data: { ...pullRequest, base: { ...pullRequest.base }, head: { ...pullRequest.head } } }),
            listReviews: async () => ({ data: state.reviews }),
            update: async ({ state: nextState }) => {
                pullRequest.state = nextState
                return { data: { ...pullRequest } }
            },
        },
        repos: {
            getBranch: async ({ branch }) => ({
                data: {
                    protected: state.protectedBranches,
                    commit: { sha: branch === "main" ? state.mainSha : state.deploySha },
                },
            }),
            compareCommits: async () => ({ data: state.comparison }),
        },
        actions: {
            listWorkflowRuns: async () => ({ data: { workflow_runs: [state.run] } }),
            listWorkflowRunArtifacts: async () => ({ data: { artifacts: state.artifacts } }),
        },
        git: {
            updateRef: async input => {
                updateCalls.push(input)
                state.deploySha = input.sha
                pullRequest.state = "closed"
                pullRequest.merged_at = "2026-09-04T00:01:00Z"
                return { data: { object: { sha: input.sha } } }
            },
        },
        issues: {
            createComment: async input => {
                comments.push(input)
                return { data: {} }
            },
        },
    }
    const github = {
        rest,
        paginate: async (endpoint, input) => {
            const response = await endpoint(input)
            return Array.isArray(response.data) ? response.data : response.data.artifacts
        },
    }
    const summary = {
        addHeading() { return this },
        addRaw() { return this },
        async write() {},
    }
    const core = {
        summary,
        setFailed(message) { failures.push(message) },
        setOutput(name, value) { outputs.set(name, String(value)) },
        warning() {},
    }
    const context = {
        actor: "reviewer",
        eventName: "workflow_dispatch",
        ref: "refs/heads/main",
        repo: { owner: "ZztIsolation", repo: "zzz_calculator" },
        runId: 601,
        sha: state.mainSha,
    }
    const savedEnvironment = {
        REQUESTED_PR_NUMBER: process.env.REQUESTED_PR_NUMBER,
        PRODUCTION_CD_ENABLED: process.env.PRODUCTION_CD_ENABLED,
        RUNNER_TEMP: process.env.RUNNER_TEMP,
    }
    process.env.REQUESTED_PR_NUMBER = "42"
    process.env.PRODUCTION_CD_ENABLED = "true"
    process.env.RUNNER_TEMP = tempDir

    try {
        const run = new AsyncFunction("github", "context", "core", "require", promotionScript)
        await run(github, context, core, requireForScript)
        let evidence = null
        try {
            evidence = JSON.parse(await readFile(path.join(tempDir, "promotion-evidence.json"), "utf8"))
        } catch (error) {
            if (error.code !== "ENOENT") throw error
        }
        return { comments, evidence, failures, outputs, updateCalls }
    } finally {
        for (const [name, value] of Object.entries(savedEnvironment)) {
            if (value === undefined) delete process.env[name]
            else process.env[name] = value
        }
        await rm(tempDir, { recursive: true, force: true })
    }
}

const success = await executePromotion()
assert.deepEqual(success.failures, [])
assert.equal(success.updateCalls.length, 1)
assert.equal(success.updateCalls[0].ref, "heads/deploy")
assert.equal(success.updateCalls[0].sha, mainSha)
assert.equal(success.updateCalls[0].force, false)
assert.equal(success.outputs.get("candidate_sha"), mainSha)
assert.equal(success.outputs.get("ci_run_id"), "701")
assert.equal(success.evidence.candidateSha, mainSha)
assert.equal(success.evidence.effectiveReviews[0].reviewId, 901)
assert.equal(success.evidence.effectiveReviews[0].commitSha, mainSha)

const negativeCases = [
    ["unapproved PR", { reviews: [] }, /no effective human approval/i],
    ["stale main SHA", { mainSha: "c".repeat(40) }, /refresh and reapprove/i],
    ["missing artifact", { artifacts: [] }, /artifact .* missing, empty, or expired/i],
    ["non-main CI", { run: { ...successRun("d".repeat(40)), head_branch: "feature" } }, /No successful main CI run/i],
    ["non-fast-forward update", { comparison: { status: "diverged", ahead_by: 1 } }, /cannot be promoted with a non-forced fast-forward/i],
    ["unprotected branches", { protectedBranches: false }, /must be protected/i],
]

for (const [name, overrides, expectedFailure] of negativeCases) {
    const result = await executePromotion(overrides)
    assert.equal(result.updateCalls.length, 0, `${name} changed deploy`)
    assert.ok(result.failures.some(message => expectedFailure.test(message)), `${name} did not fail closed: ${result.failures}`)
}

function successRun(sha) {
    return {
        id: 702,
        name: "CI",
        path: ".github/workflows/ci.yml",
        event: "push",
        head_branch: "main",
        head_sha: sha,
        conclusion: "success",
        head_repository: { full_name: repository },
        html_url: "https://example.invalid/actions/runs/702",
    }
}

console.log("Deploy promotion workflow behavior checks passed (7 cases).")
