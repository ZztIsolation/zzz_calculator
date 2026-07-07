import { spawn } from "node:child_process"
import { copyFile, cp, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadCalculatorContext } from "../backend/calculator.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const webappDir = path.join(rootDir, "webapp")
const outDir = path.join(rootDir, "dist", "pages")

const scannerReleaseTag = "scanner-1.0.35"
const scannerReleaseBase = `https://github.com/ZztIsolation/zzz_calculator/releases/download/${scannerReleaseTag}`
const scannerVersion = "1.0.35"
const scannerZipName = "ZZZ-Scanner.Next-win-x64.zip"

function run(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
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
await run(npmCommand, ["ci"], webappDir)
await run(npmCommand, ["run", "build"], webappDir)

const catalog = await loadCalculatorContext(rootDir)
await writeJson(path.join(outDir, "static", "catalog.json"), catalog)
await writeJson(path.join(outDir, "static", "app-config.json"), {
    maintenanceEnabled,
})

await cp(path.join(rootDir, "frontend", "assets"), path.join(outDir, "assets"), { recursive: true })
await copyFile(path.join(rootDir, "frontend", "zzz-mark.svg"), path.join(outDir, "zzz-mark.svg"))

await writeJson(path.join(outDir, "downloads", "zzz-scanner", "manifest.json"), {
    schemaVersion: 1,
    launcherMinVersion: "1.0.0",
    scannerVersion,
    packageUrl: `${scannerReleaseBase}/${scannerZipName}`,
    packageUrls: [
        `${scannerReleaseBase}/${scannerZipName}`,
    ],
    sha256: "2a10aa3dc92e50c7ea930d75eda82fef741eff16e8c39f2839240b6fc36b0255",
    size: 47228425,
    entry: "ZZZ-Scanner.Next.exe",
})

await writeFile(path.join(outDir, "CNAME"), "zzzcaculator.top\n", "utf8")
await copyFile(path.join(outDir, "index.html"), path.join(outDir, "404.html"))
await writeFile(path.join(outDir, "calculate.html"), legacyRedirect("返回计算工作台", "/"), "utf8")
await writeFile(path.join(outDir, "drive-discs.html"), legacyRedirect("前往驱动盘仓库", "/discs"), "utf8")
await writeFile(path.join(outDir, "accounts.html"), legacyRedirect("前往账号页", "/accounts"), "utf8")

if (maintenanceEnabled) {
    for (const fileName of [
        "maintenance.html",
        "maintenance.js",
        "maintenanceValidation.js",
        "maintenanceStats.js",
        "accounts.js",
        "local-store.js",
        "shared-combat.js",
        "calculationSkillGroups.js",
        "skillMultiplierCandidates.js",
        "formulaEvaluator.js",
        "feedback.js",
        "styles.css",
    ]) {
        await copyFile(path.join(rootDir, "frontend", fileName), path.join(outDir, fileName))
    }
}

console.log(`GitHub Pages artifact written to ${outDir}`)
