import assert from "node:assert/strict"
import { storedBuffStat } from "../frontend/maintenanceStats.js"

assert.equal(
    storedBuffStat("enemyDefIgnore"),
    "enemyDefIgnore",
    "Maintenance form serialization should preserve defense ignore as distinct from defense reduction",
)
assert.equal(storedBuffStat("enemyDefReduction"), "enemyDefReduction")

console.log("maintenance stat tests passed")
