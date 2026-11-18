# 角色文档索引

**优先级低：只有当前改动涉及某个角色时才读对应文件。** 通用规则在[建模说明](../modeling.md)和[回归契约](../regression-contract.md)，不要先通读本目录。

文件名使用 `data/agents.json` 中的角色 ID。新增或修订角色的流程见[角色制作指南](../character-authoring-guide.md)，文件格式见[模板](_template.md)。表中的游戏 ID、可见性以 `data/agents.json` 和 `data/enka_zzz_mapping.json` 为准，核对基线为 `9d51640c23697a849bdd3674b7f645a30c9f76b0`。

## 角色清单（`data/agents.json`，共 20 个）

| 角色 ID | 名称 | 游戏 ID | 首页与优化器 | 专属文档 | 测试入口 |
| --- | --- | --- | --- | --- | --- |
| `alice_thymefield` | 爱丽丝 | 1401 | 可见 | [alice_thymefield.md](alice_thymefield.md) | `test:alice-damage` |
| `anby_demara` | 安比 | 1011 | **隐藏** | 无专属规则，以数据为准 | — |
| `aria` | 爱芮 | 1501 | 可见 | [aria.md](aria.md) | `test:aria-damage` |
| `asaba_harumasa` | 浅羽悠真 | 1201 | **隐藏** | [asaba_harumasa.md](asaba_harumasa.md) | `test:pr81-characters` |
| `claret` | 克拉蕾·弗林特 | 1611 | 可见 | [claret.md](claret.md)（含锐化伤害域） | `test:sharp-damage`、`test:teammate-team-effects` |
| `ellen_joe` | 艾莲 | 1191 | 可见 | [ellen_joe.md](ellen_joe.md) | `test:ellen-integration` |
| `evelyn_chevalier` | 伊芙琳 | 1321 | 可见 | [evelyn_chevalier.md](evelyn_chevalier.md) | `test:pr81-characters` |
| `fioni` | 菲欧妮 | 1641 | 可见 | [fioni.md](fioni.md) | `test:fioni-damage`、`test:teammate-team-effects` |
| `hoshimi_miyabi` | 星见雅 | 1091 | 可见 | 无专属规则，以数据为准 | — |
| `jane_doe` | 简·杜 | 1261 | 可见 | [jane_doe.md](jane_doe.md) | `test:jane-damage` |
| `nangongyu` | 南宫羽 | 1511 | 可见 | [nangongyu.md](nangongyu.md) | `test:nangongyu-damage` |
| `nekomata` | 猫又 | 1021 | **隐藏** | [nekomata.md](nekomata.md) | `test:pr81-characters` |
| `pyrois` | 佩洛伊斯 | 1551 | 可见 | [pyrois.md](pyrois.md) | `test:pyrois-damage` |
| `remielle_dan` | 蕾米埃尔·丹 | 1581 | 可见 | [remielle_dan.md](remielle_dan.md)（队伍异常评分） | `test:luminescence`、`test:remielle-teammate-buffs` |
| `sigrid` | 希格莉德·德拉叙尔 | 1591 | 可见 | [sigrid.md](sigrid.md) | `test:sigrid-damage` |
| `soldier_11` | 11号 | 1041 | 可见 | [soldier_11.md](soldier_11.md) | `test:soldier-11-damage` |
| `velina` | 维琳娜·艾嘉德 | 1561 | 可见 | [velina.md](velina.md)（含风属性异常结算） | `test:velina-damage`、`test:velina-c6-damage`、`test:velina-optimizer`、`test:turbulence-damage` |
| `vivian` | 薇薇安·班希 | 1331 | 可见 | [vivian.md](vivian.md) | `test:vivian-damage`、`test:teammate-team-effects` |
| `ye_shunguang` | 叶瞬光 | 1431 | 可见 | [ye_shunguang.md](ye_shunguang.md) | 无专属测试 |
| `yixuan` | 仪玄 | 1371 | 可见 | 无专属规则，以数据为准 | — |

## 仅作为队友的角色

`data/combat_buffs.json` 的 `teammates` 另有 25 个不在 `agents.json` 中的角色（洛克茜、橘福福、耀嘉音等）。其中有专属验收边界的只有橘福福和洛克茜，见 [teammates.md](teammates.md)；其余以数据和维护页为准。

## 维护约定

- 角色专属规则只写在对应文件里，不写进回归契约或建模说明；跨角色的通用规则才进通用文档。
- 默认计算配置、技能组等由维护页保存，以 `data/agents.json` 为准。角色文件只写设计意图和验收边界，不逐条复写数据。
- 隐藏状态以数据为准，修改时同步更新上表和对应角色文件头部。
