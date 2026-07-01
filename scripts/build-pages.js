import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadCalculatorContext } from "../backend/calculator.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const outDir = path.join(rootDir, "dist", "pages")

const scannerReleaseTag = "scanner-1.0.28"
const scannerReleaseBase = `https://github.com/ZztIsolation/zzz_calculator/releases/download/${scannerReleaseTag}`
const scannerVersion = "1.0.28"
const scannerZipName = "ZZZ-Scanner.Next-win-x64.zip"
const scannerMirrorBase = `http://121.199.21.10/downloads/zzz-scanner/${scannerVersion}`

async function writeJson(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(path.join(rootDir, "frontend"), outDir, { recursive: true })

const catalog = await loadCalculatorContext(rootDir)
await writeJson(path.join(outDir, "static", "catalog.json"), catalog)
await writeJson(path.join(outDir, "static", "app-config.json"), {
    maintenanceEnabled: false,
})

await writeJson(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), {
    schemaVersion: 1,
    launcherMinVersion: "1.0.0",
    scannerVersion,
    packageUrl: `${scannerReleaseBase}/${scannerZipName}`,
    packageUrls: [
        `${scannerMirrorBase}/${scannerZipName}`,
        `${scannerReleaseBase}/${scannerZipName}`,
    ],
    sha256: "27bbe95181c33068cc833c913add7635065a9a238bb40d52ca6231b80fee5d08",
    size: 115188606,
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
