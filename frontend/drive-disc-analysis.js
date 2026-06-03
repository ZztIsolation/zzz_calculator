const CHART_COLORS = [
    "#2f80ed",
    "#16a085",
    "#d35400",
    "#8e44ad",
    "#c0392b",
    "#2c3e50",
    "#27ae60",
    "#f39c12",
    "#7f8c8d",
    "#00a8ff",
]

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function numberText(value, digits = 3) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }
    return String(Number(number.toFixed(digits)))
}

function percentText(value, digits = 2) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return "-"
    }
    return `${Number((number * 100).toFixed(digits))}%`
}

async function api(path, payload) {
    const response = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })
    const json = await response.json()
    if (!response.ok || json.ok === false) {
        throw new Error(json.error || response.statusText)
    }
    return json.data
}

function createModal() {
    const layer = document.createElement("div")
    layer.id = "driveDiscAnalysisModal"
    layer.className = "modal-layer"
    layer.hidden = true
    layer.innerHTML = `
      <div class="modal-scrim" data-close-drive-disc-analysis></div>
      <section class="disc-modal drive-disc-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="driveDiscAnalysisTitle">
        <button type="button" class="modal-close" data-close-drive-disc-analysis aria-label="关闭">×</button>
        <header class="modal-head">
          <div>
            <h2 id="driveDiscAnalysisTitle">驱动盘分析</h2>
            <p id="driveDiscAnalysisSubtitle">按当前角色、音擎、局内 Buff 与伤害目标计算</p>
          </div>
        </header>
        <div id="driveDiscAnalysisStatus" class="analysis-status">等待分析</div>
        <div id="driveDiscAnalysisContent" class="drive-disc-analysis-content"></div>
      </section>
    `
    document.body.appendChild(layer)
    layer.addEventListener("click", event => {
        if (event.target.closest("[data-close-drive-disc-analysis]")) {
            layer.hidden = true
            return
        }
        const gainModeButton = event.target.closest("[data-gain-display-mode]")
        if (gainModeButton) {
            activeGainDisplayMode = gainModeButton.dataset.gainDisplayMode === "marginal" ? "marginal" : "cumulative"
            renderLastGainData()
        }
    })
    return {
        layer,
        title: layer.querySelector("#driveDiscAnalysisTitle"),
        subtitle: layer.querySelector("#driveDiscAnalysisSubtitle"),
        status: layer.querySelector("#driveDiscAnalysisStatus"),
        content: layer.querySelector("#driveDiscAnalysisContent"),
    }
}

let modal = null
let activeGainDisplayMode = "cumulative"
let lastGainData = null
let lastGainOptions = null

function ensureModal() {
    if (!modal) {
        modal = createModal()
    }
    return modal
}

function setModalState(title, subtitle, status, content = "") {
    const current = ensureModal()
    current.title.textContent = title
    current.subtitle.textContent = subtitle
    current.status.textContent = status
    current.content.innerHTML = content
    current.layer.hidden = false
}

function renderLastGainData() {
    if (!modal || !lastGainData || !lastGainOptions) {
        return
    }
    modal.content.innerHTML = statGainsHtml(lastGainData, lastGainOptions, activeGainDisplayMode)
}

function payloadDriveDiscCount(payload) {
    return Array.isArray(payload?.driveDiscs) ? payload.driveDiscs.length : 0
}

async function resolvePayload(options) {
    const payload = await options.getPayload?.()
    if (!payload) {
        throw new Error(options.emptyMessage ?? "暂无可分析的驱动盘。")
    }
    if (options.requireDriveDiscs && payloadDriveDiscCount(payload) === 0) {
        throw new Error(options.emptyMessage ?? "请先选择或计算一套驱动盘。")
    }
    return payload
}

function statName(options, stat) {
    return options.statLabel?.(stat) ?? stat
}

function storedValue(options, stat, value, mode) {
    return options.formatStoredValue?.(stat, Number(value), mode) ?? numberText(value)
}

function substatDistributionHtml(data, options) {
    const stats = data.stats ?? []
    if (!stats.length) {
        return `<div class="analysis-empty">当前驱动盘没有可统计的副词条。</div>`
    }
    const total = Math.max(0.000001, Number(data.totalEffectiveRolls ?? 0))
    return `
      <div class="analysis-summary-grid">
        <div><span>驱动盘数量</span><strong>${escapeHtml(data.driveDiscCount ?? 0)}</strong></div>
        <div><span>总有效词条</span><strong>${escapeHtml(numberText(data.totalEffectiveRolls, 3))}</strong></div>
        <div><span>统计口径</span><strong>副词条</strong></div>
      </div>
      <div class="analysis-distribution">
        ${stats.map((item, index) => {
            const width = Math.max(2, Math.min(100, (Number(item.effectiveRolls ?? 0) / total) * 100))
            return `
              <div class="analysis-bar-row">
                <span>${escapeHtml(statName(options, item.stat))}</span>
                <div class="analysis-bar-track">
                  <div class="analysis-bar-fill" style="width:${width}%;background:${CHART_COLORS[index % CHART_COLORS.length]}"></div>
                </div>
                <strong>${escapeHtml(numberText(item.effectiveRolls, 2))}</strong>
              </div>
            `
        }).join("")}
      </div>
      <table class="analysis-table">
        <thead>
          <tr>
            <th>词条</th>
            <th>当前值</th>
            <th>单词条值</th>
            <th>有效词条</th>
            <th>出现次数</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(item => `
            <tr>
              <td>${escapeHtml(statName(options, item.stat))}</td>
              <td>${escapeHtml(storedValue(options, item.stat, item.value, item.mode))}</td>
              <td>${escapeHtml(storedValue(options, item.stat, item.step, item.mode))}</td>
              <td>${escapeHtml(numberText(item.effectiveRolls, 3))}</td>
              <td>${escapeHtml(item.occurrenceCount ?? 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
}

function gainModeLabel(mode = "cumulative") {
    return mode === "marginal" ? "边际收益" : "累计提升"
}

function gainModeDescription(mode = "cumulative") {
    return mode === "marginal"
        ? "第 n 条词条相对第 n-1 条后的伤害提升"
        : "新增 n 条词条后相对当前基准伤害的总提升"
}

function gainPointValue(point = {}, mode = "cumulative") {
    return Number(mode === "marginal" ? point.marginalRelativeGain : point.relativeGain) || 0
}

function pointsWithMarginalGains(points = [], baselineFinalDamage = 0) {
    let previousDamage = Number(baselineFinalDamage) || 0
    return points.map(point => {
        const finalDamage = Number(point.finalDamage ?? 0)
        const marginalAbsoluteGain = finalDamage - previousDamage
        const marginalRelativeGain = previousDamage > 0 ? marginalAbsoluteGain / previousDamage : 0
        previousDamage = finalDamage
        return {
            ...point,
            marginalAbsoluteGain: Number.isFinite(marginalAbsoluteGain) ? Number(marginalAbsoluteGain.toFixed(6)) : 0,
            marginalRelativeGain: Number.isFinite(marginalRelativeGain) ? Number(marginalRelativeGain.toFixed(10)) : 0,
        }
    })
}

function gainSeries(data = {}, mode = "cumulative") {
    const baselineFinalDamage = Number(data.baseline?.finalDamage ?? 0)
    return (data.stats ?? [])
        .map((item, index) => {
            const points = pointsWithMarginalGains(item.points ?? [], baselineFinalDamage)
            return {
                ...item,
                points,
                color: CHART_COLORS[index % CHART_COLORS.length],
                maxGain: Math.max(0, ...points.map(point => gainPointValue(point, mode))),
                oneRoll: points[0] ?? null,
            }
        })
        .filter(item => item.maxGain > 0)
        .sort((left, right) => gainPointValue(right.oneRoll, mode) - gainPointValue(left.oneRoll, mode))
}

function gainModeToggleHtml(mode = "cumulative") {
    return `
      <div class="analysis-mode-bar">
        <div class="segmented-control analysis-mode-toggle" role="group" aria-label="词条收益显示模式">
          <button type="button" class="${mode === "cumulative" ? "active" : ""}" data-gain-display-mode="cumulative">累计提升</button>
          <button type="button" class="${mode === "marginal" ? "active" : ""}" data-gain-display-mode="marginal">边际收益</button>
        </div>
        <span>${escapeHtml(gainModeDescription(mode))}</span>
      </div>
    `
}

function lineChartHtml(series, options, mode = "cumulative") {
    if (!series.length) {
        return `<div class="analysis-empty">当前配置下没有可见的副词条收益。</div>`
    }
    const width = 760
    const height = 280
    const padding = { left: 48, right: 24, top: 24, bottom: 42 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const maxRoll = Math.max(1, ...series.flatMap(item => (item.points ?? []).map(point => Number(point.rolls ?? 1))))
    const maxY = Math.max(0.000001, ...series.flatMap(item => (item.points ?? []).map(point => gainPointValue(point, mode))))
    const x = rolls => padding.left + ((Number(rolls) - 1) / Math.max(1, maxRoll - 1)) * plotWidth
    const y = value => padding.top + plotHeight - (Number(value) / maxY) * plotHeight
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(rate => {
        const yy = padding.top + plotHeight - rate * plotHeight
        return `
          <line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" class="analysis-grid-line"></line>
          <text x="8" y="${yy + 4}" class="analysis-axis-label">${escapeHtml(percentText(maxY * rate, 1))}</text>
        `
    }).join("")
    return `
      <div class="analysis-line-chart-wrap">
        <svg class="analysis-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="词条收益曲线">
          ${gridLines}
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="analysis-axis-line"></line>
          <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="analysis-axis-line"></line>
          ${Array.from({ length: maxRoll }, (_, index) => {
              const roll = index + 1
              const xx = x(roll)
              return `
                <line x1="${xx}" y1="${height - padding.bottom}" x2="${xx}" y2="${height - padding.bottom + 5}" class="analysis-axis-line"></line>
                <text x="${xx}" y="${height - 15}" class="analysis-axis-label analysis-axis-label-x">${roll}</text>
              `
          }).join("")}
          ${series.map(item => `
            <polyline
              points="${(item.points ?? []).map(point => `${x(point.rolls)},${y(gainPointValue(point, mode))}`).join(" ")}"
              fill="none"
              stroke="${item.color}"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></polyline>
          `).join("")}
        </svg>
      </div>
      <div class="analysis-legend">
        ${series.map(item => `
          <span><i style="background:${item.color}"></i>${escapeHtml(statName(options, item.stat))}</span>
        `).join("")}
      </div>
    `
}

function oneRollHtml(series, options, mode = "cumulative") {
    if (!series.length) {
        return ""
    }
    const total = series.reduce((sum, item) => sum + Math.max(0, gainPointValue(item.oneRoll, mode)), 0)
    return `
      <div class="analysis-one-roll">
        <h3>下一条${escapeHtml(gainModeLabel(mode))}</h3>
        ${series.map(item => {
            const gain = Math.max(0, gainPointValue(item.oneRoll, mode))
            const width = total > 0 ? Math.max(2, (gain / total) * 100) : 0
            return `
              <div class="analysis-bar-row">
                <span>${escapeHtml(statName(options, item.stat))}</span>
                <div class="analysis-bar-track">
                  <div class="analysis-bar-fill" style="width:${width}%;background:${item.color}"></div>
                </div>
                <strong>${escapeHtml(percentText(gain, 3))}</strong>
              </div>
            `
        }).join("")}
      </div>
    `
}

function gainTableHtml(series, options, mode = "cumulative") {
    if (!series.length) {
        return ""
    }
    const lastRoll = Math.max(1, ...series.flatMap(item => (item.points ?? []).map(point => Number(point.rolls ?? 1))))
    const firstColumn = mode === "marginal" ? "第1条边际收益" : "1 词条提升"
    const lastColumn = mode === "marginal" ? `第${lastRoll}条边际收益` : `${lastRoll} 词条提升`
    return `
      <table class="analysis-table">
        <thead>
          <tr>
            <th>词条</th>
            <th>单词条值</th>
            <th>${escapeHtml(firstColumn)}</th>
            <th>${escapeHtml(lastColumn)}</th>
            <th>1 词条伤害</th>
          </tr>
        </thead>
        <tbody>
          ${series.map(item => {
              const first = item.points?.[0] ?? {}
              const last = item.points?.at(-1) ?? {}
              return `
                <tr>
                  <td>${escapeHtml(statName(options, item.stat))}</td>
                  <td>${escapeHtml(storedValue(options, item.stat, item.step, item.mode))}</td>
                  <td>${escapeHtml(percentText(gainPointValue(first, mode), 3))}</td>
                  <td>${escapeHtml(percentText(gainPointValue(last, mode), 3))}</td>
                  <td>${escapeHtml(numberText(first.finalDamage ?? 0, 3))}</td>
                </tr>
              `
          }).join("")}
        </tbody>
      </table>
    `
}

function statGainsHtml(data, options, mode = "cumulative") {
    const series = gainSeries(data, mode)
    return `
      <div class="analysis-summary-grid">
        <div><span>基准伤害</span><strong>${escapeHtml(numberText(data.baseline?.finalDamage, 3))}</strong></div>
        <div><span>最大新增</span><strong>${escapeHtml(data.maxRolls ?? 10)} 词条</strong></div>
        <div><span>显示模式</span><strong>${escapeHtml(gainModeLabel(mode))}</strong></div>
      </div>
      ${gainModeToggleHtml(mode)}
      ${lineChartHtml(series, options, mode)}
      ${oneRollHtml(series, options, mode)}
      ${gainTableHtml(series, options, mode)}
    `
}

async function openSubstatAnalysis(options) {
    setModalState("词条分析", "统计当前六件驱动盘副词条的有效词条数", "分析中...")
    const payload = await resolvePayload(options)
    const data = await api("/api/analysis/drive-disc-substats", payload)
    setModalState(
        "词条分析",
        "统计当前六件驱动盘副词条的有效词条数；主词条不计入",
        "分析完成",
        substatDistributionHtml(data, options),
    )
}

async function openStatGainAnalysis(options) {
    setModalState("词条收益曲线", "新增词条会先进入局外驱动盘面板，再重新计算局内 Buff 与伤害", "分析中...")
    const payload = await resolvePayload(options)
    const data = await api("/api/analysis/drive-disc-stat-gains", {
        ...payload,
        maxRolls: options.maxRolls ?? 10,
    })
    activeGainDisplayMode = "cumulative"
    lastGainData = data
    lastGainOptions = options
    setModalState(
        "词条收益曲线",
        "新增词条会先进入局外驱动盘面板，再重新计算局内 Buff 与伤害",
        "分析完成",
        statGainsHtml(data, options, activeGainDisplayMode),
    )
}

function bindButton(button, handler, options) {
    if (!button) {
        return
    }
    button.addEventListener("click", async () => {
        try {
            await handler(options)
            options.setStatus?.("分析完成", "success")
        } catch (error) {
            setModalState("驱动盘分析", "按当前角色、音擎、局内 Buff 与伤害目标计算", error.message)
            options.setStatus?.(error.message, "error")
        }
    })
}

export function initDriveDiscAnalysis(options = {}) {
    bindButton(options.substatButton, openSubstatAnalysis, options)
    bindButton(options.gainButton, openStatGainAnalysis, options)
}
