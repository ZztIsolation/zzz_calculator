import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptPath = fileURLToPath(import.meta.url)
const defaultRootDir = path.resolve(path.dirname(scriptPath), "..")
const unsupportedObjectHasOwnPattern = /\bObject\s*\.\s*hasOwn\s*\(/g
const runtimeSourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue"])

function isRuntimeSource(filePath) {
    const baseName = path.basename(filePath)
    return runtimeSourceExtensions.has(path.extname(filePath))
        && !baseName.includes(".test.")
        && !baseName.includes(".spec.")
}

function collectFiles(directory, accept) {
    const files = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            files.push(...collectFiles(absolutePath, accept))
        } else if (entry.isFile() && accept(absolutePath)) {
            files.push(absolutePath)
        }
    }
    return files
}

function findUnsupportedObjectHasOwn(text, fileName) {
    const matches = []
    unsupportedObjectHasOwnPattern.lastIndex = 0
    for (let match = unsupportedObjectHasOwnPattern.exec(text); match; match = unsupportedObjectHasOwnPattern.exec(text)) {
        const prefix = text.slice(0, match.index)
        const line = prefix.split("\n").length
        const column = match.index - prefix.lastIndexOf("\n")
        matches.push(`${fileName}:${line}:${column}`)
    }
    return matches
}

function assertNoUnsupportedObjectHasOwn(entries, label) {
    const matches = entries.flatMap(({ fileName, text }) => findUnsupportedObjectHasOwn(text, fileName))
    if (matches.length) {
        throw new Error(
            `${label} contains unsupported Object.hasOwn() calls. Use Object.prototype.hasOwnProperty.call() instead:\n${matches.join("\n")}`,
        )
    }
}

export function assertBrowserCompatibilitySources(rootDir = defaultRootDir) {
    const sourceRoots = [path.join(rootDir, "core"), path.join(rootDir, "webapp", "src")]
    const files = sourceRoots.flatMap(directory => collectFiles(directory, isRuntimeSource))
    assertNoUnsupportedObjectHasOwn(
        files.map(filePath => ({
            fileName: path.relative(rootDir, filePath).replace(/\\/g, "/"),
            text: readFileSync(filePath, "utf8"),
        })),
        "Browser runtime source",
    )
    return files.length
}

export function assertBrowserCompatibilityBundle(bundle) {
    const chunks = Object.values(bundle)
        .filter(output => output && output.type === "chunk" && typeof output.code === "string")
        .map(output => ({ fileName: output.fileName, text: output.code }))
    assertNoUnsupportedObjectHasOwn(chunks, "Emitted browser bundle")
    return chunks.length
}

export function assertBrowserCompatibilityOutputDirectory(outputDir = path.join(defaultRootDir, "dist", "pages", "static", "app")) {
    const files = collectFiles(outputDir, filePath => [".js", ".mjs"].includes(path.extname(filePath)))
    assertNoUnsupportedObjectHasOwn(
        files.map(filePath => ({
            fileName: path.relative(outputDir, filePath).replace(/\\/g, "/"),
            text: readFileSync(filePath, "utf8"),
        })),
        "Emitted browser output",
    )
    return files.length
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    if (process.argv.includes("--output")) {
        const checkedFiles = assertBrowserCompatibilityOutputDirectory()
        console.log(`Browser compatibility output guard passed: ${checkedFiles} emitted files checked.`)
    } else {
        const checkedFiles = assertBrowserCompatibilitySources()
        console.log(`Browser compatibility source guard passed: ${checkedFiles} runtime files checked.`)
    }
}
