export function toCalculatorDriveDisc(inventoryDisc = {}) {
    return {
        id: inventoryDisc.id,
        setId: inventoryDisc.setId,
        partition: inventoryDisc.partition,
        rarity: inventoryDisc.rarity,
        level: inventoryDisc.level,
        mainStat: {
            stat: inventoryDisc.mainStat?.stat,
            value: inventoryDisc.mainStat?.value,
        },
        subStats: (inventoryDisc.subStats ?? []).map(item => ({
            stat: item.stat,
            value: item.value,
        })),
    }
}
