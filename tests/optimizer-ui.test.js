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
assert.match(indexHtml, /id="damageTargetStunned"[^>]*checked/, "Boss stun multiplier should be enabled by default.")
assert.match(indexHtml, /BOSS初始失衡倍率%/, "Boss stun multiplier label should name the initial multiplier.")

const workbenchIndex = indexHtml.indexOf('id="driveDiscSchemeTabs"')
const resultTabsIndex = indexHtml.indexOf('id="optimizerResultTabs"')
const schemeListIndex = indexHtml.indexOf('id="driveDiscSchemeList"')
assert.ok(workbenchIndex >= 0 && resultTabsIndex > workbenchIndex, "Optimized candidates should be nested in unified scheme tabs.")
assert.ok(schemeListIndex > resultTabsIndex, "Only one active scheme list should render below unified tabs.")

assert.match(calculateJs, /function optimizedSchemes\(\) \{\s*return optimizationResults\.map\(optimizedScheme\)/s)
assert.match(calculateJs, /function schemeTabs\(\) \{\s*return \[\s*manualScheme\(\),\s*loadoutScheme\(\),\s*\.\.\.optimizedSchemes\(\),\s*\]/s)
assert.match(calculateJs, /return Number\.isFinite\(activeMultiplier\) \? activeMultiplier !== 1 : true/, "Missing stored stun state should default to enabled.")
assert.match(calculateJs, /manuallyUncheckedDefaultBuffIds/, "Default combat Buff exclusions should be persisted separately from active ids.")
assert.match(calculateJs, /function optimizerStorePayload\(/, "Optimizer worker payload should be trimmed before structured cloning.")
assert.match(calculateJs, /rawIndex: disc\.source\.rawIndex/, "Optimizer worker payload should keep only lightweight source metadata.")
assert.match(calculateJs, /store: optimizerStore/, "Worker should receive the trimmed optimizer store.")
assert.doesNotMatch(calculateJs, /settings: collectOptimizationSettings\(\),\s*store,/s, "Worker input should not duplicate the full browser store.")
assert.match(calculateJs, /OPTIMIZER_WORKER_STALL_TIMEOUT_MS/, "Optimizer worker should have a no-progress watchdog.")
assert.doesNotMatch(calculateJs, /function allSchemes\(\)/, "Mixed manual/loadout/result scheme tabs should not be reintroduced.")
assert.doesNotMatch(calculateJs, /renderDiscPicker|selectedDiscIdsFromPicker/, "Old select-based manual picker should stay removed.")
