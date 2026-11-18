# 仅作为队友的角色

只出现在队友 Buff 目录（`data/combat_buffs.json` 的 `teammates`）、不在 `data/agents.json` 中的角色，没有独立的角色文件。本文件只记录其中有专属验收边界的角色；其余角色的目录内容以数据和维护页为准，通用队友规则见[回归契约](../regression-contract.md)。

既是主控又是队友的角色（简、南宫羽、蕾米埃尔·丹、维琳娜）的队友 Buff 写在各自的角色文件中。

## 橘福福（`juhufu`）

- 核心被动的全队暴击伤害由 `clamp(20 + floor((x - 2800) / 2) / 10, 20, 50)%` 换算，其中 `x` 为“橘福福初始攻击力”，运行时保存在 `combatBuffs.runtimeInputs["juhufu.core_tiger_roar_crit_dmg"].effects["juhufu_core_tiger_roar_crit_dmg"].sourceValue`。
- 输入最小值为 0、加减按钮步长为 50，不设置输入上限，仍允许手动填写 2851 等任意有效数值。
- 缺失运行时输入时必须回退默认值 `3400`，从而兼容旧方案的 `+50%`。
- 独立算例：2799/2800 得到 20%；2850/2851 得到 22.5%；2852 得到 22.6%；3399 得到 49.9%；3400/3401 得到 50%。
- 额外爆伤必须向下截断到小数点后一位，不得四舍五入。
- 核心被动内连携技伤害 `+20%`、终结技伤害 `+40%` 及各效果覆盖率语义保持不变；影画二继续作为独立规则提供额外暴击伤害 `+22%`。
- 历史修正：PR #51 `fix: scale Juhufu crit damage from initial attack`，改为按初始攻击力换算。

## 洛克茜（`roxy`）

验收见 `npm run test:roxy-teammate-buffs`。
