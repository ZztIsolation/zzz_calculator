import { createHash } from "node:crypto"
import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

import { loadCalculatorContext } from "../backend/calculator.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const outDir = path.join(rootDir, "dist", "pages")

const scannerReleaseTag = "scanner-1.0.36"
const scannerReleaseBase = `https://github.com/ZztIsolation/zzz_calculator/releases/download/${scannerReleaseTag}`
const scannerVersion = "1.0.36"
const scannerZipName = "ZZZ-Scanner.Next-win-x64.zip"
const scannerGitHubPackageUrl = `${scannerReleaseBase}/${scannerZipName}`
const scannerPagesPackageUrl = `./${scannerVersion}/${scannerZipName}`
const scannerPackageSha256 = "d885c0aef6da61cfcbf994ad2b4e712a31efe8bd87631260fe4f87ea8711c63d"
const scannerPackageSize = 47231570

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
        await cp(localPackagePath, pagesPackagePath)
    } else {
        await downloadFile(scannerGitHubPackageUrl, pagesPackagePath)
    }

    await verifyScannerPackage(pagesPackagePath)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(path.join(rootDir, "frontend"), outDir, { recursive: true })

const catalog = await loadCalculatorContext(rootDir)
await writeJson(path.join(outDir, "static", "catalog.json"), catalog)
await writeJson(path.join(outDir, "static", "app-config.json"), {
    maintenanceEnabled: false,
})
await ensurePagesScannerPackage()

await writeJson(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), {
    schemaVersion: 1,
    launcherMinVersion: "1.0.0",
    scannerVersion,
    packageUrl: scannerPagesPackageUrl,
    packageUrls: [
        scannerPagesPackageUrl,
        scannerGitHubPackageUrl,
    ],
    sha256: scannerPackageSha256,
    size: scannerPackageSize,
    entry: "ZZZ-Scanner.Next.exe",
})

await writeFile(path.join(outDir, "CNAME"), "zzzcaculator.top\n", "utf8")
await writeFile(path.join(outDir, "calculate.html"), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=/">
  <title>正在跳转</title>
  <script>location.replace("/")</script>
</head>
<body>
  <a href="/">返回首页</a>
</body>
</html>
`, "utf8")

console.log(`GitHub Pages artifact written to ${outDir}`)
