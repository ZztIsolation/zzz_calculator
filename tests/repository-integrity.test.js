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

function containsObjectKey(value, targetKey) {
    if (Array.isArray(value)) return value.some(item => containsObjectKey(item, targetKey))
    if (!value || typeof value !== "object") return false
    if (Object.hasOwn(value, targetKey)) return true
    return Object.values(value).some(item => containsObjectKey(item, targetKey))
}

const trackedFiles = execFileSync("git", ["ls-files"], {
    cwd: rootDir,
    encoding: "utf8",
}).split(/\r?\n/).filter(Boolean)

const referencedAssets = new Set()
for (const trackedPath of trackedFiles.filter(fileName => /^data\/[^/]+\.json$/.test(fileName))) {
    const value = JSON.parse(await readFile(path.join(rootDir, trackedPath), "utf8"))
    collectAssetPaths(value, referencedAssets)
    assert.equal(containsObjectKey(value, "appliesTo"), false, `${trackedPath} must not persist legacy appliesTo filters`)
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
const helperManifest = JSON.parse(await readFile(path.join(rootDir, "config", "helper-manifest.json"), "utf8"))
const nginxConfig = await readFile(path.join(rootDir, "deploy", "nginx", "zzz-calculator.conf"), "utf8")
const pagesWorkflow = await readFile(path.join(rootDir, ".github", "workflows", "pages.yml"), "utf8")
const directDependencies = {
    ...webappPackage.dependencies,
    ...webappPackage.devDependencies,
}
assert.equal("tailwindcss" in directDependencies, false)
assert.equal("katex" in directDependencies, false)
assert.equal(scannerManifest.schemaVersion, 3)
assert.equal(scannerManifest.launcherMinVersion, "1.2.1")
assert.equal(scannerManifest.scannerVersion, "1.0.39")
assert.equal(helperManifest.schemaVersion, 1)
assert.equal(helperManifest.version, "1.2.1")
assert.equal(helperManifest.packageUrls[0], "https://download.zzzcaculator.top/downloads/zzz-scanner/helper/1.2.1/ZZZ-Scanner-Helper.exe")
assert.ok(helperManifest.packageUrls.some(url => url.startsWith("https://zzzcaculator.top/downloads/")))
assert.ok(helperManifest.packageUrls.some(url => url.startsWith("https://github.com/")))
assert.match(helperManifest.sha256, /^[a-f0-9]{64}$/)
assert.ok(helperManifest.size > 0)
assert.equal(scannerManifest.support.minWindowsBuild, 17763)
assert.deepEqual(scannerManifest.support.architectures, ["x64"])
assert.deepEqual(scannerManifest.packages.map(packageInfo => packageInfo.id), ["win-x64-fdd", "win-x64-self-contained"])
for (const packageInfo of scannerManifest.packages) {
    assert.match(packageInfo.packageUrls[0], /^https:\/\/download\.zzzcaculator\.top\/downloads\/zzz-scanner\/1\.0\.39\//)
    assert.equal(packageInfo.packageUrls.some(url => /^https:\/\//.test(url)), true)
    assert.match(packageInfo.sha256, /^[a-f0-9]{64}$/)
    assert.ok(packageInfo.size > 0)
    assert.ok(packageInfo.expandedSize >= packageInfo.size)
    assert.ok(Array.isArray(packageInfo.files) && packageInfo.files.length > 0)
    assert.equal(packageInfo.files.reduce((sum, file) => sum + file.size, 0), packageInfo.expandedSize)
}
assert.ok(scannerManifest.packages[0].size <= 25 * 1024 * 1024)
assert.ok(scannerManifest.packages[1].size <= 90 * 1024 * 1024)
assert.match(nginxConfig, /root \/srv\/zzz-download-origin;/)
assert.match(nginxConfig, /location \^~ \/downloads\//)
assert.match(nginxConfig, /root \/opt\/zzz_calculator\/current\/dist\/pages;/)
assert.match(pagesWorkflow, /workflow_dispatch:/)
assert.doesNotMatch(pagesWorkflow, /\bpush:/)

console.log(`repository integrity: ok (${referencedAssets.size} catalog assets verified)`)
