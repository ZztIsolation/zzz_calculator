import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const assetsDir = path.join(rootDir, "webapp", "public", "assets")

function collectAssetPaths(value, output) {
    if (typeof value === "string" && value.startsWith("/assets/")) {
        output.add(value)
        return
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectAssetPaths(item, output))
        return
    }
    if (value && typeof value === "object") {
        Object.values(value).forEach(item => collectAssetPaths(item, output))
    }
}

const trackedFiles = execFileSync("git", ["ls-files"], {
    cwd: rootDir,
    encoding: "utf8",
}).split(/\r?\n/).filter(Boolean)

const referencedAssets = new Set()
for (const trackedPath of trackedFiles.filter(fileName => /^data\/[^/]+\.json$/.test(fileName))) {
    const value = JSON.parse(await readFile(path.join(rootDir, trackedPath), "utf8"))
    collectAssetPaths(value, referencedAssets)
}

assert.ok(referencedAssets.size > 0, "catalog data should reference local assets")
for (const assetPath of referencedAssets) {
    const relativePath = assetPath.slice("/assets/".length)
    assert.ok(existsSync(path.join(assetsDir, relativePath)), `missing catalog asset: ${assetPath}`)
}

assert.equal(existsSync(path.join(rootDir, "frontend")), false, "legacy frontend directory must not exist")
assert.equal(existsSync(path.join(rootDir, "小光简易伤害计算器v01.html")), false, "retired standalone calculator must not exist")

for (const prefix of ["frontend/", "dist/", "output/", "downloads/", ".claude/"]) {
    assert.equal(trackedFiles.some(fileName => fileName.startsWith(prefix)), false, `${prefix} must not be tracked`)
}

const webappPackage = JSON.parse(await readFile(path.join(rootDir, "webapp", "package.json"), "utf8"))
const scannerManifest = JSON.parse(await readFile(path.join(rootDir, "config", "scanner-manifest.json"), "utf8"))
const directDependencies = {
    ...webappPackage.dependencies,
    ...webappPackage.devDependencies,
}
assert.equal("tailwindcss" in directDependencies, false)
assert.equal("katex" in directDependencies, false)
assert.equal(scannerManifest.scannerVersion, "1.0.36")
assert.equal(scannerManifest.packageUrls.some(url => /^https:\/\//.test(url)), true)
assert.match(scannerManifest.sha256, /^[a-f0-9]{64}$/)
assert.equal(scannerManifest.size, 47231570)

console.log(`repository integrity: ok (${referencedAssets.size} catalog assets verified)`)
