import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
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
const scannerVersion = String(scannerManifestSource.scannerVersion)
const scannerPagesPackageUrl = String(scannerManifestSource.packageUrl)
const scannerGitHubPackageUrl = scannerManifestSource.packageUrls.find(url => /^https:\/\//i.test(url))
const scannerZipName = path.posix.basename(new URL(scannerGitHubPackageUrl).pathname)
const scannerPackageSha256 = String(scannerManifestSource.sha256)
const scannerPackageSize = Number(scannerManifestSource.size)

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

async function verifyScannerPackage(filePath) {
    const packageStat = await stat(filePath)
    if (packageStat.size !== scannerPackageSize) {
        throw new Error(`Scanner package size mismatch. Expected ${scannerPackageSize}, got ${packageStat.size}.`)
    }

    const actualHash = await sha256File(filePath)
    if (actualHash !== scannerPackageSha256) {
        throw new Error(`Scanner package sha256 mismatch. Expected ${scannerPackageSha256}, got ${actualHash}.`)
    }
}

async function ensurePagesScannerPackage() {
    const localPackagePath = path.join(rootDir, "downloads", "zzz-scanner", scannerVersion, scannerZipName)
    const pagesPackagePath = path.join(outDir, "downloads", "zzz-scanner", scannerVersion, scannerZipName)
    await mkdir(path.dirname(pagesPackagePath), { recursive: true })

    if (existsSync(localPackagePath)) {
        await copyFile(localPackagePath, pagesPackagePath)
    } else {
        await downloadFile(scannerGitHubPackageUrl, pagesPackagePath)
    }

    await verifyScannerPackage(pagesPackagePath)
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
        `downloads/zzz-scanner/${scannerVersion}/${scannerZipName}`,
        "downloads/zzz-scanner/manifest.json",
    ]) {
        assertArtifact(paths.has(requiredPath), `missing ${requiredPath}`)
    }

    const appConfig = JSON.parse(await readFile(path.join(outDir, "static", "app-config.json"), "utf8"))
    const manifest = JSON.parse(await readFile(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), "utf8"))
    assertArtifact(appConfig.maintenanceEnabled === maintenanceEnabled, "app-config maintenance flag mismatch")
    assertArtifact(manifest.scannerVersion === scannerVersion, "scanner version mismatch")
    assertArtifact(manifest.sha256 === scannerPackageSha256, "scanner manifest SHA-256 mismatch")
    assertArtifact(manifest.size === scannerPackageSize, "scanner manifest size mismatch")
    await verifyScannerPackage(path.join(outDir, "downloads", "zzz-scanner", scannerVersion, scannerZipName))

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
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
await run(npmCommand, ["run", "build"], webappDir, {
    VITE_INCLUDE_MAINTENANCE: String(maintenanceEnabled),
})

const catalog = await loadCalculatorContext(rootDir)
await writeJson(path.join(outDir, "static", "catalog.json"), catalog)
await writeJson(path.join(outDir, "static", "app-config.json"), {
    maintenanceEnabled,
})
await ensurePagesScannerPackage()

await writeJson(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), scannerManifestSource)

await writeFile(path.join(outDir, "CNAME"), "zzzcaculator.top\n", "utf8")
await copyFile(path.join(outDir, "index.html"), path.join(outDir, "404.html"))
await writeFile(path.join(outDir, "calculate.html"), legacyRedirect("返回计算工作台", "/"), "utf8")
await writeFile(path.join(outDir, "drive-discs.html"), legacyRedirect("前往驱动盘仓库", "/discs"), "utf8")
await writeFile(path.join(outDir, "accounts.html"), legacyRedirect("前往账号页", "/accounts"), "utf8")

if (maintenanceEnabled) {
    await writeFile(path.join(outDir, "maintenance.html"), legacyRedirect("前往维护页", "/maintenance"), "utf8")
}

await verifyPagesArtifact(maintenanceEnabled)
console.log(`GitHub Pages artifact written to ${outDir}`)
