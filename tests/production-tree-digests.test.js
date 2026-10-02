import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, writeFile, chmod, symlink, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const windows = process.platform === "win32"
const bash = process.env.TEST_BASH || (windows
    ? path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "../../..", "bin/bash.exe")
    : "/bin/bash")
const temp = await mkdtemp(path.join(os.tmpdir(), "zzz-tree-digests-"))
const source = (await readFile(path.join(root, "deploy/production/zzz-calculator-deploy"), "utf8")).replaceAll("\r\n", "\n")
const legacy = (await readFile(path.join(root, "tests/fixtures/production-tree-digests-legacy.sh"), "utf8")).replaceAll("\r\n", "\n")
// The embedded JS contains column-zero braces: delimit at the next Bash
// function, not the first brace, so the real production implementation runs.
let current = source.slice(source.indexOf("digest_release_tree() {"), source.indexOf("tree_metadata_sha256() {"))
if (windows) current = current.replace("/usr/bin/node ", `"${process.execPath.replaceAll("\\", "/")}" `)
const shellPath = value => value.replaceAll("\\", "/").replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`)
async function driver(name, body) {
    const file = path.join(temp, name)
    await writeFile(file, `#!/bin/bash\nset -Eeuo pipefail\n${body}\nif [[ "$2" == content ]]; then tree_sha256 "$1"; else portable_tree_sha256 "$1" "$2"; fi\n`)
    return shellPath(file)
}
function digest(driverPath, directory, mode) {
    const start = performance.now()
    const result = spawnSync(bash, [driverPath, shellPath(directory), mode], { encoding: "utf8", timeout: 120000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout.trim(), /^[0-9a-f]{64}$/)
    return { hash: result.stdout.trim(), ms: Math.round(performance.now() - start) }
}
try {
    const oldDriver = await driver("legacy.sh", legacy)
    const newDriver = await driver("current.sh", current)
    const tree = path.join(temp, "tree")
    await mkdir(path.join(tree, "empty"), { recursive: true })
    await mkdir(path.join(tree, "data/scan-telemetry"), { recursive: true })
    for (const name of ["-first", ".dot", "a space", "z-last", "中文", "é-byte-order", "data/catalog.json", "data/user_drive_discs.json", "data/scan-telemetry/log"]) {
        await writeFile(path.join(tree, name), `${name}\n`)
    }
    await writeFile(path.join(tree, "binary"), Buffer.alloc(2 * 1024 * 1024 + 7, 0xa7))
    if (!windows) {
        for (const name of ["line\nbreak", "back\\slash", "carriage\rreturn"]) await writeFile(path.join(tree, name), name)
        await symlink("/unreadable-outside-fixture", path.join(tree, "ignored-link"))
        await chmod(path.join(tree, "empty"), 0o711)
        await chmod(path.join(tree, "binary"), 0o640)
    }
    // Windows Node and MSYS expose different Unix mode bits. Content parity
    // runs everywhere; all portable permission cases run on the Linux CI host.
    const modes = windows ? ["content"] : ["content", "full", "static"]
    const before = {}
    for (const mode of modes) {
        const oldResult = digest(oldDriver, tree, mode)
        const newResult = digest(newDriver, tree, mode)
        assert.equal(newResult.hash, oldResult.hash, `${mode} must preserve deployed digest format`)
        before[mode] = newResult.hash
        console.log(`digest parity ${mode}: legacy=${oldResult.ms}ms batched=${newResult.ms}ms`)
    }
    await writeFile(path.join(tree, "data/user_drive_discs.json"), "changed inventory\n")
    await writeFile(path.join(tree, "data/scan-telemetry/log"), "changed telemetry\n")
    for (const mode of modes) {
        const observed = digest(newDriver, tree, mode).hash
        assert.equal(observed, digest(oldDriver, tree, mode).hash)
        if (mode === "static") assert.equal(observed, before[mode])
        else assert.notEqual(observed, before[mode], "Content changes must be detected")
    }
    if (!windows) {
        const portableBefore = digest(newDriver, tree, "full").hash
        await chmod(path.join(tree, "binary"), 0o644)
        const portableAfter = digest(newDriver, tree, "full").hash
        assert.notEqual(portableAfter, portableBefore, "Permission changes must still change the portable digest")
        assert.equal(portableAfter, digest(oldDriver, tree, "full").hash)
        const many = path.join(temp, "many-files")
        await mkdir(many)
        for (let i = 0; i < 1200; i++) await writeFile(path.join(many, `asset-${String(i).padStart(4, "0")}`), Buffer.alloc(64 * 1024, i % 256))
        const oldLarge = digest(oldDriver, many, "content")
        const newLarge = digest(newDriver, many, "content")
        assert.equal(newLarge.hash, oldLarge.hash)
        console.log(`1200-file digest parity: legacy=${oldLarge.ms}ms batched=${newLarge.ms}ms`)
    }
    console.log("deployment tree digest compatibility passed")
} finally {
    await rm(temp, { recursive: true, force: true })
}
