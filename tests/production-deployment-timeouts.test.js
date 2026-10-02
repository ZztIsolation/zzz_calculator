import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bash = process.env.TEST_BASH || (process.platform === "win32"
    ? path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "../../..", "bin/bash.exe")
    : "/bin/bash")
const temporary = await mkdtemp(path.join(os.tmpdir(), "zzz-deployment-timeouts-"))
const shellPath = value => value.replaceAll("\\", "/").replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`)
const fixtureRoot = shellPath(temporary)
const manager = (await readFile(path.join(root, "deploy/production/zzz-calculator-deploy"), "utf8")).replaceAll("\r\n", "\n")
const read = async name => (await readFile(path.join(root, name), "utf8")).replaceAll("\r\n", "\n")
function extract(source, name) {
    const match = source.match(new RegExp(`^([ ]*)${name}\\(\\) \\{\\n[\\s\\S]*?^\\1\\}`, "m"))
    assert.ok(match, `Missing executable function ${name}`)
    return match[0].split("\n").map(line => line.slice(match[1].length)).join("\n")
}
async function script(name, body) {
    const target = path.join(temporary, name)
    await writeFile(target, `#!/bin/bash\nset -Eeuo pipefail\n${body}\n`)
    await chmod(target, 0o700)
    return shellPath(target)
}
function execute(target, args = [], env = {}) {
    const start = performance.now()
    const result = spawnSync(bash, [target, ...args], {
        encoding: "utf8", timeout: 12000,
        env: { ...process.env, ...env, MSYS_NO_PATHCONV: "1" },
    })
    assert.ifError(result.error)
    assert.ok(performance.now() - start < 10000, "Fixture exceeded its bounded deadline")
    return result
}
const log = extract(manager, "log")
try {
    execFileSync(bash, ["-c", "command -v timeout >/dev/null"], { stdio: "pipe" })
    const deploy = await read(".github/workflows/deploy-production.yml")
    const rollback = await read(".github/workflows/rollback-production.yml")
    const phase = extract(deploy, "run_bounded_phase")
    assert.equal(phase, extract(rollback, "run_bounded_phase"))
    // The budget includes the 5-second kill grace: audit cannot exceed 60s.
    assert.match(deploy, /run_bounded_phase audit 55 ssh/)
    assert.match(deploy, /run_bounded_phase control-plane-audit 55 ssh/)
    assert.ok(deploy.indexOf("grep -Fq 'supervisor=bounded-v1 action=audit'") < deploy.indexOf("run_bounded_phase upload-archive"))

    const hanging = await script("hang.sh", 'sleep 30')
    const disconnected = await script("disconnect.sh", 'exit 255')
    const transport = await script("transport.sh", `${phase}\nrun_bounded_phase "$1" 1 /bin/bash "$2" secret-sentinel\nprintf changed > "$3"`)
    const current = path.join(temporary, "current")
    for (const [name, command, expected] of [["upload-archive", hanging, 124], ["ssh", disconnected, 255]]) {
        await writeFile(current, "old-release")
        const result = execute(transport, [name, command, shellPath(current)])
        assert.equal(result.status, expected, result.stderr)
        assert.equal(await readFile(current, "utf8"), "old-release", "Failed transport must never reach the switch")
        assert.match(result.stdout, new RegExp(`phase=${name} event=complete.*exit=${expected}`))
        assert.ok(!result.stdout.includes("secret-sentinel"))
    }

    // Exercise the actual server-side supervisor with a blocked child. Its
    // TERM handler must complete evidence/cleanup during the grace period.
    const supervised = extract(manager, "supervise_operation")
        .replace(/limit=\d+/g, "limit=1").replace(/grace=\d+/g, "grace=3")
    const supervisor = await script("supervisor.sh", `${log}\n${supervised}
if [[ "$1" == --bounded-operation ]]; then
    trap 'printf cleaned > "$TEST_CLEANUP"; printf old-release > "$TEST_CURRENT"' EXIT
    trap 'exit 128' TERM HUP INT
    if [[ "$TEST_SWITCHED" == 1 ]]; then printf candidate > "$TEST_CURRENT"; fi
    sleep 30
else
    ACTION=deploy
    supervise_operation "$@"
fi`)
    const cleanup = path.join(temporary, "cleanup")
    for (const switched of ["0", "1"]) {
        await writeFile(current, "old-release")
        await writeFile(cleanup, "pending")
        const result = execute(supervisor, ["deploy"], { TEST_CURRENT: shellPath(current), TEST_CLEANUP: shellPath(cleanup), TEST_SWITCHED: switched })
        assert.equal(result.status, 124, result.stderr)
        assert.equal(await readFile(cleanup, "utf8"), "cleaned", "TERM must reach server cleanup")
        assert.equal(await readFile(current, "utf8"), "old-release")
    }

    const mockSystemctl = await script("systemctl.sh", `
if [[ "$1" == stop ]]; then sleep 30; fi
case "$*" in
    *LoadState*) printf loaded ;;
    *ControlGroup*) printf '' ;;
    *ActiveState*) printf activating ;;
    *SubState*) printf start ;;
    *Result*) printf success ;;
    *ExecMainStatus*) printf 0 ;;
esac`)
    const boundedControl = extract(manager, "bounded_systemctl").replace('/usr/bin/systemctl "$@"', '"$TEST_SYSTEMCTL" "$@"')
    const stop = await script("stop.sh", `${log}\n${boundedControl}\n${extract(manager, "stop_validation_probe")}
SYSTEMD_QUERY_TIMEOUT_SECONDS=1
SYSTEMD_STOP_TIMEOUT_SECONDS=1
VALIDATION_UNIT=zzz-calculator-validation-999999-1.service
validation_unit_name_has_members() { return 1; }
finish_validation_probe_if_gone() { return 1; }
status=0
stop_validation_probe || status="$?"
[[ "$status" == 1 && -n "$VALIDATION_UNIT" ]]
printf 'retained-unclean-unit'`)
    const stopped = execute(stop, [], { TEST_SYSTEMCTL: mockSystemctl })
    assert.equal(stopped.status, 0, stopped.stderr)
    assert.equal(stopped.stdout, "retained-unclean-unit", "A timed-out stop must not clear ownership of the unit")

    const launching = extract(manager, "run_validation_transient_unit")
        .replace('/usr/bin/systemd-run --no-block --quiet', '"$TEST_SYSTEMD_RUN" --no-block --quiet')
    const start = await script("start.sh", `${log}\n${boundedControl}\n${launching}
SYSTEMD_QUERY_TIMEOUT_SECONDS=1
SYSTEMD_START_TIMEOUT_SECONDS=1
VALIDATION_UNIT_PREFIX=zzz-calculator-validation
VALIDATION_PROBE_INDEX=1
VALIDATION_PORT=8788
VALIDATION_WORKER=/unused
VALIDATION_SYSTEMD_PROPERTIES=()
SYSTEMD_EFFECTIVE_VERSION=239
VALIDATION_SANDBOX_PROFILE=systemd-v239-seccomp
prepare_validation_probe_root() { :; }
build_validation_systemd_properties() { :; }
stop_validation_probe() { printf stopped > "$TEST_CLEANUP"; }
record_validation_unit_result() { :; }
die() { printf '%s\\n' "$*" >&2; exit 1; }
run_validation_transient_unit candidate "$1" release
printf changed > "$TEST_CURRENT"`)
    await writeFile(current, "old-release")
    await writeFile(cleanup, "pending")
    const started = execute(start, [fixtureRoot], { TEST_SYSTEMD_RUN: hanging, TEST_SYSTEMCTL: mockSystemctl, TEST_CURRENT: shellPath(current), TEST_CLEANUP: shellPath(cleanup) })
    assert.equal(started.status, 1, started.stderr)
    assert.match(started.stderr, /transient unit did not start successfully/)
    assert.equal(await readFile(cleanup, "utf8"), "stopped")
    assert.equal(await readFile(current, "utf8"), "old-release")

    // Stage logging must retain Bash errexit: a failed nested command cannot
    // turn into success because the wrapper tested a function in an if.
    const failing = await script("phase.sh", `${log}\n${extract(manager, "run_phase")}\nfail_nested() { false; printf changed > "$1"; }\nrun_phase preflight fail_nested "$1"`)
    assert.equal(execute(failing, [shellPath(current)]).status, 1)
    assert.equal(await readFile(current, "utf8"), "old-release")
    console.log("deployment timeouts: transport failure, server TERM cleanup, systemd start/stop bounds and errexit passed")
} finally {
    await rm(temporary, { recursive: true, force: true })
}
