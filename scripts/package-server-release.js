import { execFileSync } from "node:child_process"
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputDir = path.join(rootDir, "output")
const trackedStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: rootDir,
    encoding: "utf8",
}).trim()
if (trackedStatus) {
    throw new Error("Tracked files are modified. Commit the intended release before packaging the server artifact.")
}
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
}).trim()
const shortCommit = commit.slice(0, 12)
const stagingDir = path.join(outputDir, `server-release-${shortCommit}`)
const artifactPath = path.join(outputDir, `zzz-calculator-server-${shortCommit}.tar.gz`)

if (!stagingDir.startsWith(`${outputDir}${path.sep}`)) {
    throw new Error(`Unsafe server release staging path: ${stagingDir}`)
}

const pagesDir = path.join(rootDir, "dist", "pages")
const pagesStat = await stat(pagesDir).catch(() => null)
if (!pagesStat?.isDirectory()) {
    throw new Error("Vue production output is missing. Run npm run build:webapp first.")
}

await mkdir(outputDir, { recursive: true })
await rm(stagingDir, { recursive: true, force: true })
await rm(artifactPath, { force: true })
await mkdir(stagingDir, { recursive: true })

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
}).split("\0").filter(Boolean)

for (const relativePath of trackedFiles) {
    const sourcePath = path.join(rootDir, relativePath)
    const targetPath = path.join(stagingDir, relativePath)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
}

async function copyTree(sourceDir, targetDir) {
    const entries = await import("node:fs/promises").then(module => module.readdir(sourceDir, { withFileTypes: true }))
    await mkdir(targetDir, { recursive: true })
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name)
        const targetPath = path.join(targetDir, entry.name)
        if (entry.isDirectory()) {
            await copyTree(sourcePath, targetPath)
        } else if (entry.isFile()) {
            await copyFile(sourcePath, targetPath)
        }
    }
}

await copyTree(pagesDir, path.join(stagingDir, "dist", "pages"))
await writeFile(path.join(stagingDir, ".deployed-commit"), `${commit}\n`, "utf8")

execFileSync("tar", ["-czf", artifactPath, "-C", stagingDir, "."], {
    cwd: rootDir,
    stdio: "inherit",
})

const artifactStat = await stat(artifactPath)
const deployedCommit = (await readFile(path.join(stagingDir, ".deployed-commit"), "utf8")).trim()
if (deployedCommit !== commit || artifactStat.size <= 0) {
    throw new Error("Server release verification failed.")
}

console.log(`Server release artifact: ${artifactPath}`)
console.log(`Commit: ${commit}`)
console.log(`Size: ${artifactStat.size} bytes`)
