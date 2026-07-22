import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputDir = path.join(rootDir, "output")
const releaseStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: rootDir,
    encoding: "utf8",
}).trim()
if (releaseStatus) {
    throw new Error("The worktree contains modified or unignored untracked files. Commit or ignore the intended release inputs before packaging.")
}
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
}).trim()
const shortCommit = commit.slice(0, 12)
const stagingDir = path.join(outputDir, `server-release-${shortCommit}`)
const artifactPath = path.join(outputDir, `zzz-calculator-server-${shortCommit}.tar.gz`)
const evidencePath = path.join(outputDir, `zzz-calculator-server-${shortCommit}.evidence.json`)

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
await rm(evidencePath, { force: true })
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
    const entries = await readdir(sourceDir, { withFileTypes: true })
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

async function summarizeTree(root) {
    const files = []
    async function visit(directory, prefix = "") {
        const entries = await readdir(directory, { withFileTypes: true })
        entries.sort((left, right) => left.name.localeCompare(right.name, "en"))
        for (const entry of entries) {
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
            const absolutePath = path.join(directory, entry.name)
            if (entry.isDirectory()) {
                await visit(absolutePath, relativePath)
            } else if (entry.isFile()) {
                const contents = await readFile(absolutePath)
                files.push({
                    path: relativePath,
                    size: contents.length,
                    sha256: createHash("sha256").update(contents).digest("hex"),
                })
            }
        }
    }
    await visit(root)
    const treeHash = createHash("sha256")
    for (const file of files) {
        treeHash.update(`${file.path}\0${file.size}\0${file.sha256}\n`)
    }
    return {
        fileCount: files.length,
        totalBytes: files.reduce((total, file) => total + file.size, 0),
        sha256: treeHash.digest("hex"),
    }
}

await copyTree(pagesDir, path.join(stagingDir, "dist", "pages"))
await writeFile(path.join(stagingDir, ".deployed-commit"), `${commit}\n`, "utf8")

execFileSync("tar", ["-czf", artifactPath, "-C", stagingDir, "."], {
    cwd: rootDir,
    stdio: "inherit",
})

const artifactStat = await stat(artifactPath)
const artifactSha256 = createHash("sha256").update(await readFile(artifactPath)).digest("hex")
const deployedCommit = (await readFile(path.join(stagingDir, ".deployed-commit"), "utf8")).trim()
if (deployedCommit !== commit || artifactStat.size <= 0) {
    throw new Error("Server release verification failed.")
}

const pagesSummary = await summarizeTree(path.join(stagingDir, "dist", "pages"))
const releaseSummary = await summarizeTree(stagingDir)
const evidence = {
    commit,
    deployedCommit,
    artifact: {
        path: path.relative(rootDir, artifactPath).replaceAll(path.sep, "/"),
        size: artifactStat.size,
        sha256: artifactSha256,
    },
    releaseTree: releaseSummary,
    pagesTree: pagesSummary,
}
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")

console.log(`Server release artifact: ${artifactPath}`)
console.log(`Commit: ${commit}`)
console.log(`Size: ${artifactStat.size} bytes`)
console.log(`SHA-256: ${artifactSha256}`)
console.log(`Release tree: ${releaseSummary.fileCount} files, ${releaseSummary.totalBytes} bytes, SHA-256 ${releaseSummary.sha256}`)
console.log(`Pages tree: ${pagesSummary.fileCount} files, ${pagesSummary.totalBytes} bytes, SHA-256 ${pagesSummary.sha256}`)
console.log(`Evidence: ${evidencePath}`)
