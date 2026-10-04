import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const webappDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const assetsDir = path.join(webappDir, "public", "assets")
const manifestPath = path.join(webappDir, "src", "generated", "thumbnail-manifest.json")
const statePath = path.join(webappDir, "scripts", "thumbnail-state.json")
const checkOnly = process.argv.includes("--check")
const categories = ["agents", "w-engines", "drive-discs"]
const recipe = { sharp: sharp.versions.sharp, format: "webp", quality: 72, agents: { width: 192 }, icons: { width: 96, height: 96, fit: "contain" } }
const manifest = {}
const state = { recipe, sources: {} }
const failures = []
let sourceBytes = 0
let thumbnailBytes = 0

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"))
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    failures.push(`Missing generated file: ${path.relative(webappDir, filePath)}`)
    return {}
  }
}

const storedManifest = checkOnly ? await readJson(manifestPath) : {}
const storedState = checkOnly ? await readJson(statePath) : {}
if (checkOnly && JSON.stringify(storedState.recipe) !== JSON.stringify(recipe)) failures.push("Thumbnail generation settings changed")

for (const category of categories) {
  const sourceDir = path.join(assetsDir, category)
  const entries = (await readdir(sourceDir, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
  for (const entry of entries) {
    // The shared SVG placeholder is already tiny and retains its original URL.
    if (entry.name.endsWith(".svg")) continue
    if (!/\.(?:png|jpe?g|webp|avif)$/i.test(entry.name)) {
      throw new Error(`Unsupported thumbnail source: ${category}/${entry.name}`)
    }
    const source = await readFile(path.join(sourceDir, entry.name))
    const sourceUrl = `/assets/${category}/${entry.name}`
    const sourceHash = createHash("sha256").update(source).digest("hex")
    sourceBytes += source.length

    if (checkOnly) {
      const recorded = storedState.sources?.[sourceUrl]
      if (!recorded || recorded.sourceHash !== sourceHash) {
        failures.push(`Missing or outdated thumbnail source: ${sourceUrl}`)
        continue
      }
      manifest[sourceUrl] = recorded.thumbnailUrl
      state.sources[sourceUrl] = recorded
      if (storedManifest[sourceUrl] !== recorded.thumbnailUrl) failures.push(`Thumbnail mapping differs: ${sourceUrl}`)
      const prefix = `/assets/thumbs/${category}/`
      if (!recorded.thumbnailUrl.startsWith(prefix) || recorded.thumbnailUrl.slice(prefix.length).includes("/")) {
        failures.push(`Invalid thumbnail path: ${sourceUrl}`)
        continue
      }
      const thumbnailPath = path.join(assetsDir, recorded.thumbnailUrl.slice("/assets/".length))
      try {
        const existing = await readFile(thumbnailPath)
        const hash = createHash("sha256").update(existing).digest("hex").slice(0, 16)
        const expectedName = `${path.parse(entry.name).name}.${hash}.webp`
        if (path.basename(thumbnailPath) !== expectedName) failures.push(`Thumbnail content hash differs: ${sourceUrl}`)
        const metadata = await sharp(existing).metadata()
        const sourceMetadata = await sharp(source).metadata()
        const width = category === "agents" ? 192 : 96
        const height = category === "agents" ? Math.round(sourceMetadata.height * width / sourceMetadata.width) : 96
        if (metadata.format !== "webp" || metadata.width !== width || metadata.height !== height) {
          failures.push(`Thumbnail format or dimensions differ: ${sourceUrl}`)
        }
        thumbnailBytes += existing.length
      } catch (error) {
        if (error.code !== "ENOENT") throw error
        failures.push(`Missing thumbnail: ${recorded.thumbnailUrl}`)
      }
    } else {
      // Preserve portrait framing in both existing contain and cover consumers.
      const resize = category === "agents"
        ? recipe.agents
        : { ...recipe.icons, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      const thumbnail = await sharp(source).resize(resize).webp({ quality: recipe.quality }).toBuffer()
      const hash = createHash("sha256").update(thumbnail).digest("hex").slice(0, 16)
      const thumbnailName = `${path.parse(entry.name).name}.${hash}.webp`
      const thumbnailDir = path.join(assetsDir, "thumbs", category)
      manifest[sourceUrl] = `/assets/thumbs/${category}/${thumbnailName}`
      state.sources[sourceUrl] = { sourceHash, thumbnailUrl: manifest[sourceUrl] }
      await mkdir(thumbnailDir, { recursive: true })
      await writeFile(path.join(thumbnailDir, thumbnailName), thumbnail)
      thumbnailBytes += thumbnail.length
    }
  }
}

if (checkOnly) {
  if (JSON.stringify(Object.keys(storedManifest).sort()) !== JSON.stringify(Object.keys(manifest).sort())) failures.push("Thumbnail manifest source list is outdated")
  if (JSON.stringify(Object.keys(storedState.sources ?? {}).sort()) !== JSON.stringify(Object.keys(state.sources).sort())) failures.push("Thumbnail build state source list is outdated")
  if (failures.length) {
    throw new Error(`${failures.join("\n")}\nRun npm --prefix webapp run assets:thumbnails and commit the generated assets and manifest.`)
  }
} else {
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

console.log(`Thumbnails ${checkOnly ? "verified" : "generated"}: ${Object.keys(manifest).length}; ${sourceBytes} source bytes -> ${thumbnailBytes} thumbnail bytes`)
