function cloneJson(value) {
    if (value === undefined) {
        return undefined
    }
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value)
        } catch (_error) {
            // Vue reactive proxies are not structured-cloneable, but these configs are JSON data.
        }
    }
    return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
}

function hasLocalizedName(value) {
    if (typeof value === "string") {
        return value.trim().length > 0
    }
    if (!isPlainObject(value)) {
        return false
    }
    return Object.values(value).some(item => String(item ?? "").trim())
}

export function isDefaultCalculationCinemaLevel(value) {
    const level = Number(value)
    return Number.isInteger(level) && level >= 0 && level <= 6
}

export function normalizeDefaultCalculationCinemaLevel(value, fallback = 0) {
    if (isDefaultCalculationCinemaLevel(value)) {
        return Number(value)
    }
    return isDefaultCalculationCinemaLevel(fallback) ? Number(fallback) : 0
}

export function defaultCalculationVariantName(cinemaLevel = 0) {
    const level = normalizeDefaultCalculationCinemaLevel(cinemaLevel)
    return { zhCN: `默认循环（${level}影）` }
}

export function withDefaultCalculationVariantName(config = {}) {
    const level = normalizeDefaultCalculationCinemaLevel(config?.cinemaLevel)
    return {
        ...cloneJson(config ?? {}),
        name: hasLocalizedName(config?.name) ? cloneJson(config.name) : defaultCalculationVariantName(level),
    }
}

export function defaultCalculationConfigEntries(config = null) {
    if (!isPlainObject(config)) {
        return []
    }
    const { variants: rawVariants, ...baseConfig } = config
    const entries = [
        {
            ...cloneJson(baseConfig),
            cinemaLevel: normalizeDefaultCalculationCinemaLevel(baseConfig.cinemaLevel, 0),
        },
    ]
    if (Array.isArray(rawVariants)) {
        rawVariants.forEach(variant => {
            if (!isPlainObject(variant)) {
                return
            }
            const { variants: _nestedVariants, ...variantConfig } = variant
            entries.push({
                ...cloneJson(variantConfig),
                cinemaLevel: normalizeDefaultCalculationCinemaLevel(variantConfig.cinemaLevel, 0),
            })
        })
    }
    return entries.sort((left, right) => left.cinemaLevel - right.cinemaLevel)
}

export function resolveDefaultCalculationConfig(config = null, cinemaLevel = 0) {
    const targetLevel = normalizeDefaultCalculationCinemaLevel(cinemaLevel, 0)
    const selected = defaultCalculationConfigEntries(config)
        .filter(entry => entry.cinemaLevel <= targetLevel)
        .sort((left, right) => right.cinemaLevel - left.cinemaLevel)[0]
    return selected ? withDefaultCalculationVariantName(selected) : null
}
