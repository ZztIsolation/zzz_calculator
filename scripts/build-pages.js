import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

import { loadCalculatorContext } from "../backend/calculator.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const webappDir = path.join(rootDir, "webapp")
const outDir = path.join(rootDir, "dist", "pages")

const scannerManifestSource = JSON.parse(await readFile(
    path.join(rootDir, "config", "scanner-manifest.json"),
    "utf8",
))
const helperManifestSource = JSON.parse(await readFile(
    path.join(rootDir, "config", "helper-manifest.json"),
    "utf8",
))
const scannerVersion = String(scannerManifestSource.scannerVersion)
const scannerPackages = (scannerManifestSource.packages ?? []).map(packageInfo => {
    const packageUrls = Array.isArray(packageInfo.packageUrls) ? packageInfo.packageUrls : []
    const pagesUrl = packageUrls.find(url => String(url).startsWith("./"))
    const cdnUrl = packageUrls.find(url => String(url).startsWith("https://download.zzzcaculator.top/"))
    const githubUrl = packageUrls.find(url => /^https:\/\/github\.com\//i.test(url))
    if (!pagesUrl || !cdnUrl || !githubUrl) {
        throw new Error(`Scanner package ${packageInfo.id} must define Pages, CDN, and GitHub package URLs.`)
    }
    return {
        ...packageInfo,
        id: String(packageInfo.id),
        pagesUrl: String(pagesUrl),
        cdnUrl: String(cdnUrl),
        githubUrl: String(githubUrl),
        zipName: path.posix.basename(new URL(githubUrl).pathname),
        sha256: String(packageInfo.sha256),
        size: Number(packageInfo.size),
    }
})
if (scannerManifestSource.schemaVersion !== 3 || scannerPackages.length !== 2) {
    throw new Error("Scanner manifest must use schema 3 and contain exactly two packages.")
}
for (const packageInfo of scannerPackages) {
    if (!Array.isArray(packageInfo.files) || packageInfo.files.length === 0) {
        throw new Error(`Scanner package ${packageInfo.id} must contain a file manifest.`)
    }
    const fileBytes = packageInfo.files.reduce((sum, file) => sum + Number(file.size), 0)
    if (fileBytes !== Number(packageInfo.expandedSize)) {
        throw new Error(`Scanner package ${packageInfo.id} file manifest size mismatch.`)
    }
}
if (helperManifestSource.schemaVersion !== 1 || helperManifestSource.version !== "1.2.1") {
    throw new Error("Helper manifest must use schema 1 and publish Helper 1.2.1.")
}

function run(command, args, cwd, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            env: {
                ...process.env,
                ...extraEnv,
            },
            stdio: "inherit",
            shell: process.platform === "win32",
        })
        child.on("exit", code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`))
        })
        child.on("error", reject)
    })
}

async function writeJson(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function sha256File(filePath) {
    return await new Promise((resolve, reject) => {
        const hash = createHash("sha256")
        createReadStream(filePath)
            .on("data", chunk => hash.update(chunk))
            .on("error", reject)
            .on("end", () => resolve(hash.digest("hex")))
    })
}

async function downloadFile(url, destination) {
    await mkdir(path.dirname(destination), { recursive: true })
    const response = await fetch(url, { redirect: "follow" })
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

async function verifyScannerPackage(filePath, packageInfo) {
    const packageStat = await stat(filePath)
    if (packageStat.size !== packageInfo.size) {
        throw new Error(`Scanner package ${packageInfo.id} size mismatch. Expected ${packageInfo.size}, got ${packageStat.size}.`)
    }

    const actualHash = await sha256File(filePath)
    if (actualHash !== packageInfo.sha256) {
        throw new Error(`Scanner package ${packageInfo.id} sha256 mismatch. Expected ${packageInfo.sha256}, got ${actualHash}.`)
    }
}

async function ensurePagesScannerPackages() {
    for (const packageInfo of scannerPackages) {
        const localPackagePath = path.join(rootDir, "downloads", "zzz-scanner", scannerVersion, packageInfo.zipName)
        const pagesPackagePath = path.join(outDir, "downloads", "zzz-scanner", scannerVersion, packageInfo.zipName)
        await mkdir(path.dirname(pagesPackagePath), { recursive: true })

        if (existsSync(localPackagePath)) {
            await copyFile(localPackagePath, pagesPackagePath)
        } else {
            await downloadFile(packageInfo.githubUrl, pagesPackagePath)
        }

        await verifyScannerPackage(pagesPackagePath, packageInfo)
    }
}

function assertArtifact(condition, message) {
    if (!condition) {
        throw new Error(`Pages artifact verification failed: ${message}`)
    }
}

async function artifactFiles(directory, base = directory) {
    const result = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            result.push(...await artifactFiles(absolutePath, base))
        } else if (entry.isFile()) {
            result.push({
                absolutePath,
                relativePath: path.relative(base, absolutePath).replace(/\\/g, "/"),
                size: (await stat(absolutePath)).size,
            })
        }
    }
    return result
}

async function verifyPagesArtifact(maintenanceEnabled) {
    const files = (await artifactFiles(outDir)).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    const paths = new Set(files.map(file => file.relativePath))
    for (const requiredPath of [
        "index.html",
        "404.html",
        "calculate.html",
        "drive-discs.html",
        "accounts.html",
        "static/catalog.json",
        "static/app-config.json",
        "downloads/zzz-scanner/manifest.json",
        "downloads/zzz-scanner/helper-manifest.json",
    ]) {
        assertArtifact(paths.has(requiredPath), `missing ${requiredPath}`)
    }
    for (const packageInfo of scannerPackages) {
        assertArtifact(
            paths.has(`downloads/zzz-scanner/${scannerVersion}/${packageInfo.zipName}`),
            `missing scanner package ${packageInfo.id}`,
        )
    }

    const appConfig = JSON.parse(await readFile(path.join(outDir, "static", "app-config.json"), "utf8"))
    const manifest = JSON.parse(await readFile(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), "utf8"))
    assertArtifact(appConfig.maintenanceEnabled === maintenanceEnabled, "app-config maintenance flag mismatch")
    assertArtifact(appConfig.scanTelemetryEnabled === false, "Pages must keep scan telemetry disabled")
    assertArtifact(appConfig.scanTelemetryRetentionDays === 30, "Pages telemetry retention metadata mismatch")
    assertArtifact(manifest.schemaVersion === 3, "scanner manifest schema mismatch")
    assertArtifact(manifest.scannerVersion === scannerVersion, "scanner version mismatch")
    assertArtifact(Array.isArray(manifest.packages) && manifest.packages.length === scannerPackages.length, "scanner package count mismatch")
    for (const packageInfo of scannerPackages) {
        const emitted = manifest.packages.find(candidate => candidate.id === packageInfo.id)
        assertArtifact(Boolean(emitted), `scanner package ${packageInfo.id} missing from manifest`)
        assertArtifact(emitted.sha256 === packageInfo.sha256, `scanner package ${packageInfo.id} SHA-256 mismatch`)
        assertArtifact(emitted.size === packageInfo.size, `scanner package ${packageInfo.id} size mismatch`)
        assertArtifact(Array.isArray(emitted.files) && emitted.files.length === packageInfo.files.length, `scanner package ${packageInfo.id} file manifest mismatch`)
        await verifyScannerPackage(
            path.join(outDir, "downloads", "zzz-scanner", scannerVersion, packageInfo.zipName),
            packageInfo,
        )
    }
    const helperManifest = JSON.parse(await readFile(path.join(outDir, "downloads", "zzz-scanner", "helper-manifest.json"), "utf8"))
    assertArtifact(helperManifest.version === helperManifestSource.version, "Helper manifest version mismatch")
    assertArtifact(helperManifest.sha256 === helperManifestSource.sha256, "Helper manifest SHA-256 mismatch")
    assertArtifact(!paths.has("settings.html"), "settings.html would intercept the /settings SPA route")

    for (const [fileName, target] of [
        ["calculate.html", "/"],
        ["drive-discs.html", "/discs"],
        ["accounts.html", "/accounts"],
    ]) {
        assertArtifact((await readFile(path.join(outDir, fileName), "utf8")).includes(`url=${target}`), `${fileName} redirect mismatch`)
    }

    if (maintenanceEnabled) {
        assertArtifact(paths.has("maintenance.html"), "maintenance redirect missing when enabled")
    } else {
        assertArtifact(!paths.has("maintenance.html"), "maintenance redirect must be absent by default")
        assertArtifact(!files.some(file => /(^|\/)MaintenanceView-|maintenance(?:Stats|Validation)?\.js$/i.test(file.relativePath)), "maintenance code leaked into the default Pages artifact")
    }

    const artifactHash = createHash("sha256")
    for (const file of files) {
        artifactHash.update(file.relativePath)
        artifactHash.update(await readFile(file.absolutePath))
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    console.log(`Pages artifact verified: ${files.length} files, ${totalSize} bytes, SHA-256 ${artifactHash.digest("hex")}`)
}

function legacyRedirect(title, target) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${target}">
  <title>${title}</title>
  <script>location.replace(${JSON.stringify(target)})</script>
</head>
<body>
  <a href="${target}">${title}</a>
</body>
</html>
`
}

function envFlag(name) {
    const value = process.env[name]
    if (value === undefined) {
        return null
    }
    if (["1", "true", "yes", "on"].includes(String(value).toLowerCase())) {
        return true
    }
    if (["0", "false", "no", "off"].includes(String(value).toLowerCase())) {
        return false
    }
    return null
}

const maintenanceEnabled = envFlag("MAINTENANCE_ENABLED") === true
const skipWebappBuild = envFlag("SKIP_WEBAPP_BUILD") === true
if (!skipWebappBuild) {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
    await run(npmCommand, ["run", "build"], webappDir, {
        VITE_INCLUDE_MAINTENANCE: String(maintenanceEnabled),
    })
}

const catalog = await loadCalculatorContext(rootDir)
await writeJson(path.join(outDir, "static", "catalog.json"), catalog)
await writeJson(path.join(outDir, "static", "app-config.json"), {
    maintenanceEnabled,
    scanTelemetryEnabled: false,
    scanTelemetryRetentionDays: 30,
})
await ensurePagesScannerPackages()

await writeJson(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), scannerManifestSource)
await writeJson(path.join(outDir, "downloads", "zzz-scanner", "helper-manifest.json"), helperManifestSource)

await rm(path.join(outDir, "CNAME"), { force: true })
await copyFile(path.join(outDir, "index.html"), path.join(outDir, "404.html"))
await writeFile(path.join(outDir, "calculate.html"), legacyRedirect("返回计算工作台", "/"), "utf8")
await writeFile(path.join(outDir, "drive-discs.html"), legacyRedirect("前往驱动盘仓库", "/discs"), "utf8")
await writeFile(path.join(outDir, "accounts.html"), legacyRedirect("前往账号页", "/accounts"), "utf8")
await rm(path.join(outDir, "settings.html"), { force: true })

if (maintenanceEnabled) {
    await writeFile(path.join(outDir, "maintenance.html"), legacyRedirect("前往维护页", "/maintenance"), "utf8")
}

await verifyPagesArtifact(maintenanceEnabled)
console.log(`GitHub Pages artifact written to ${outDir}`)
