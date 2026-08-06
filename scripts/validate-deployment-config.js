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
}

const assertions = [
    [files.ci.includes("name: verify"), "CI must expose the required verify job."],
    [files.ci.includes("timeout-minutes: 25"), "CI must have a bounded timeout."],
    [files.ci.includes("cancel-in-progress: true"), "CI must cancel superseded runs."],
    [files.ci.includes("actions/upload-artifact@v4"), "CI must upload immutable artifacts."],
    [files.ci.includes("retention-days: 14"), "CI artifacts must have an explicit retention period."],
    [files.deploy.includes("workflow_run:"), "CD must be driven by workflow_run."],
    [files.deploy.includes("environment:"), "CD must use a protected environment."],
    [files.deploy.includes("StrictHostKeyChecking=yes"), "CD must pin host key checking."],
    [files.deploy.includes("PRODUCTION_CD_ENABLED"), "CD must have an explicit feature gate."],
    [files.deploy.includes("CANDIDATE_MODE"), "CD must distinguish audit, dry-run, and CI deploy."],
    [files.rollback.includes("--previous"), "Rollback must use the server-recorded previous release."],
    [files.deployScript.includes("flock"), "Server deploy must serialize callers with flock."],
    [files.deployScript.includes('PROCESSING_DIR="${DEPLOY_ROOT}/processing"'), "Server deploy must isolate claimed uploads."],
    [files.deployScript.includes("claim_incoming_inputs"), "Server deploy must claim uploads before validation."],
    [files.deployScript.includes(".part"), "Server deploy must receive atomically named uploads."],
    [files.deployScript.includes(".deployed-commit"), "Server deploy must verify the committed artifact."],
    [files.deployScript.includes('FINALIZE_UPLOAD="1"'), "Only deploy may finalize a .part upload."],
    [files.bootstrap.includes("no-port-forwarding"), "Bootstrap must restrict port forwarding."],
    [files.bootstrap.includes('chown root:"$DEPLOY_USER" "$authorized_keys_tmp"'), "Bootstrap must keep SSH authorization root-owned."],
    [files.bootstrap.includes('ssh-keygen -l -f "$key_validation_tmp"'), "Bootstrap must validate the real OpenSSH public key."],
    [files.bootstrap.includes('mv -Tf -- "$authorized_keys_tmp" "$authorized_keys"'), "Bootstrap must replace legacy SSH authorization atomically."],
    [files.bootstrap.includes("zzzdeploy"), "Bootstrap must create the dedicated deployment user."],
]

for (const [condition, message] of assertions) {
    if (message && !condition) {
        throw new Error(message)
    }
}

const forbidden = [
    "StrictHostKeyChecking=no",
    "localStorage.clear(",
    "indexedDB.deleteDatabase(",
]
for (const [name, contents] of Object.entries(files)) {
    for (const token of forbidden) {
        if (contents.includes(token)) {
            throw new Error(`${name} contains forbidden deployment token: ${token}`)
        }
    }
}

console.log("Deployment configuration checks passed.")
