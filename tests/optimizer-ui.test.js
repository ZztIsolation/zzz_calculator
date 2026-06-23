import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const indexHtml = await readFile(path.join(rootDir, "frontend", "index.html"), "utf8")
const calculateJs = await readFile(path.join(rootDir, "frontend", "calculate.js"), "utf8")

assert.match(indexHtml, /id="driveDiscSchemeList"/, "Drive-disc workbench should expose one active scheme list.")
assert.match(indexHtml, /id="driveDiscSchemeTabs"/, "Drive-disc workbench should expose unified scheme tabs.")
assert.match(indexHtml, /id="optimizerResultTabs"/, "Optimizer result tabs should still exist as candidate tab items.")
assert.doesNotMatch(indexHtml, /id="discPicker"/, "Manual drive-disc selection should no longer use the old six-select picker.")
assert.doesNotMatch(indexHtml, /id="currentPlanList"/, "Current plan should not render as a separate list.")
assert.doesNotMatch(indexHtml, /id="optimizerResultList"/, "Optimizer results should not render as a separate list.")

const workbenchIndex = indexHtml.indexOf('id="driveDiscSchemeTabs"')
const resultTabsIndex = indexHtml.indexOf('id="optimizerResultTabs"')
const schemeListIndex = indexHtml.indexOf('id="driveDiscSchemeList"')
assert.ok(workbenchIndex >= 0 && resultTabsIndex > workbenchIndex, "Optimized candidates should be nested in unified scheme tabs.")
assert.ok(schemeListIndex > resultTabsIndex, "Only one active scheme list should render below unified tabs.")

assert.match(calculateJs, /function optimizedSchemes\(\) \{\s*return optimizationResults\.map\(optimizedScheme\)/s)
assert.match(calculateJs, /function schemeTabs\(\) \{\s*return \[\s*manualScheme\(\),\s*loadoutScheme\(\),\s*\.\.\.optimizedSchemes\(\),\s*\]/s)
assert.doesNotMatch(calculateJs, /function allSchemes\(\)/, "Mixed manual/loadout/result scheme tabs should not be reintroduced.")
assert.doesNotMatch(calculateJs, /renderDiscPicker|selectedDiscIdsFromPicker/, "Old select-based manual picker should stay removed.")
