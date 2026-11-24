import { formatDamageNumber, formatDamagePercent } from "./damageWhiteBox.js"

// Each deposit is a fraction of an already mitigated hit. The same plan drives
// the visible settlements and the linear weights used in the optimizer.
export function planEmberSettlement(events, profile, cinemaLevel) {
    if (!profile) return null
    let spearSeen = false
    let firstReleaseReady = false
    let lastRelease = -1
    const steps = events.map((event, index) => {
        const source = event.skillSource
        if (event.kind !== "sharp" || !source || event.count <= 0) {
            return { deposit: 0, echo: 0, releases: false }
        }
        const move = source.moveId
        const releases = profile.releaseMoves.includes(move)
        if (move === profile.spearMove && !spearSeen) {
            spearSeen = true
            firstReleaseReady = cinemaLevel >= 4
        }
        const basePct = source.rowId === profile.maimRow ? profile.maimPct
            : profile.primaryMoves.includes(move) ? profile.primaryPct
            : cinemaLevel >= 2 ? profile.cinema2OtherPct : 0
        let bonusPct = cinemaLevel >= 2 ? profile.cinema2BuildupBonusPct : 0
        if (releases) {
            lastRelease = index
            if (firstReleaseReady) {
                // Only the first cast in a repeated event can consume the opening bonus.
                bonusPct += profile.cinema4FirstReleaseBonusPct / Math.max(1, event.count)
                firstReleaseReady = false
            }
        }
        const deposit = basePct / 100 * (1 + bonusPct / 100)
        const echo = cinemaLevel >= 6 && move === profile.ultimateReleaseMove
            ? deposit * profile.cinema6UltimateRepeatPct / 100 : 0
        return { deposit, echo, releases }
    })
    return { steps, lastRelease }
}

export function emberScoreRequest(request, plan) {
    if (!plan || plan.lastRelease < 0) return request
    const events = request.events.map((event, index) => {
        if (index > plan.lastRelease) return event
        const { deposit, echo } = plan.steps[index]
        return { ...event, damageScale: event.damageScale * (1 + deposit + echo) }
    })
    return { ...request, events }
}

function settlementEvent(source, suffix, label, value, formula) {
    return {
        id: source.id + suffix, label, kind: "emberSettlement", count: 1,
        finalDamage: value, singleDamage: value,
        whiteBoxRows: [{ label, formula, value, displayValue: formatDamageNumber(value) }],
    }
}

export function settleEmberResults(hits, plan) {
    if (!plan) return { events: hits }
    const events = []
    let pendingDamage = 0
    let settledDamage = 0
    let directDamage = 0
    hits.forEach((hit, index) => {
        const { deposit, echo, releases } = plan.steps[index]
        const stored = hit.finalDamage * deposit
        directDamage += hit.finalDamage
        const previous = pendingDamage
        pendingDamage += stored
        if (stored && hit.whiteBoxRows?.length) {
            hit.whiteBoxRows.push({
                label: "本次积攒烬痕", value: stored, displayValue: formatDamageNumber(stored),
                formula: `实际伤害 ${formatDamageNumber(hit.finalDamage)} × ${formatDamagePercent(deposit, 2)}`,
            })
        }
        events.push(hit)
        if (!releases) return
        if (pendingDamage > 0) {
            events.push(settlementEvent(hit, "::ember", "烬灭", pendingDamage,
                `此前烬痕 ${formatDamageNumber(previous)} + 本次积攒 ${formatDamageNumber(stored)}`))
            settledDamage += pendingDamage
            pendingDamage = 0
        }
        if (echo > 0 && stored > 0) {
            const echoDamage = hit.finalDamage * echo
            events.push(settlementEvent(hit, "::echo", "六影追加烬灭", echoDamage,
                `本次此愿积攒 ${formatDamageNumber(stored)} × ${formatDamagePercent(echo / deposit)}`))
            settledDamage += echoDamage
        }
    })
    return { events, ember: { directDamage, settledDamage, pendingDamage } }
}
