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

export function normalizeDefaultCalculationPotentialLevel(value, fallback = 0) {
    const level = Number(value)
    if (Number.isInteger(level)) {
        return Math.min(6, Math.max(0, level))
    }
    const fallbackLevel = Number(fallback)
    return Number.isInteger(fallbackLevel)
        ? Math.min(6, Math.max(0, fallbackLevel))
        : 0
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
    const { variants: rawVariants, potentialVariants: _potentialVariants, ...baseConfig } = config
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
            const {
                variants: _nestedVariants,
                potentialVariants: _nestedPotentialVariants,
                ...variantConfig
            } = variant
            entries.push({
                ...cloneJson(variantConfig),
                cinemaLevel: normalizeDefaultCalculationCinemaLevel(variantConfig.cinemaLevel, 0),
            })
        })
    }
    return entries.sort((left, right) => left.cinemaLevel - right.cinemaLevel)
}

function potentialVariantRange(variant = {}) {
    const min = normalizeDefaultCalculationPotentialLevel(
        variant.minPotentialLevel ?? variant.potentialLevel,
        0,
    )
    const rawMax = variant.maxPotentialLevel
    const max = rawMax === undefined || rawMax === null || rawMax === ""
        ? 6
        : normalizeDefaultCalculationPotentialLevel(rawMax, min)
    return { min, max: Math.max(min, max) }
}

function resolvePotentialCalculationConfig(config = null, potentialLevel = 0) {
    if (!isPlainObject(config)) {
        return null
    }

    const targetLevel = normalizeDefaultCalculationPotentialLevel(potentialLevel, 0)
    const potentialVariants = Array.isArray(config.potentialVariants)
        ? config.potentialVariants.filter(isPlainObject)
        : []
    const selectedVariant = potentialVariants
        .map((variant, index) => ({ variant, index, ...potentialVariantRange(variant) }))
        .filter(entry => entry.min <= targetLevel && targetLevel <= entry.max)
        .sort((left, right) => right.min - left.min || left.max - right.max || left.index - right.index)[0]

    if (selectedVariant) {
        const { minPotentialLevel, maxPotentialLevel, potentialLevel: _level, ...variant } = selectedVariant.variant
        return cloneJson(variant)
    }

    const { potentialVariants: _potentialVariants, ...baseConfig } = config
    return cloneJson(baseConfig)
}

export function resolveDefaultCalculationConfig(config = null, cinemaLevel = 0, potentialLevel = 0) {
    const targetLevel = normalizeDefaultCalculationCinemaLevel(cinemaLevel, 0)
    const potentialConfig = resolvePotentialCalculationConfig(config, potentialLevel)
    const selected = defaultCalculationConfigEntries(potentialConfig)
        .filter(entry => entry.cinemaLevel <= targetLevel)
        .sort((left, right) => right.cinemaLevel - left.cinemaLevel)[0]
    return selected ? withDefaultCalculationVariantName(selected) : null
}
