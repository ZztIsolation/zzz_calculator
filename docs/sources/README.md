# 来源快照索引

状态：现行索引。核对日期：2026-11-19；基准提交：`9ebba2ca7c526b8f61a918de2502b124321d409f`。

本目录保存角色建模时抓取的**上游原始数据**，只用于核对录入值是否与来源一致。它们不是规范，也不是运行时输入：没有代码或测试读取这些文件，数据以 `data/` 为准。

## 读取规则

- 按角色选取所需快照。目录内 9 个 JSON 共约 1 MB，单个最大约 250 KB。
- 改动涉及某个角色时，先读[对应角色文档](../characters/README.md)的“资料来源”，需要核对具体数值再用 `grep` 或 `node -e` 取字段，例如 `node -e "const j=require('./docs/sources/<文件>');console.log(j.<字段>)"`。
- 不要为了“补全”而手工编辑快照；来源更新时新增一份带新版本号的文件，旧文件在对应角色文档不再引用后删除。
- 抓取脚本和中间产物放在被忽略的 `tmp/`，不提交。

## 命名规则

`<角色ID简名>-<来源>-<版本>.json`：

| 来源 | 写法 | 版本取值 |
| --- | --- | --- |
| Nanoka 结构化角色资料 | `<角色>-nanoka-<版本含构建号>.json` | Nanoka 的 `版本+构建号`，如 `3.3.12+19520738` |
| 官方百科角色页 | `<角色>-official-<修订号>.json` | 词条修订号 |
| 官方百科专武页 | `<角色>-official-weapon-<修订号>.json` | 词条修订号 |

较大的来源数值表（供测试逐行比对）不放在这里，放 `tests/fixtures/<角色>-source-values.json`，见[建模手册第九节](../character-modeling-handbook.md#九来源与-verification)。

## 索引

新增、改名或删除快照时必须同步本表和对应角色文档的“资料来源”。“元数据”一列说明文件自身是否记录来源 URL 与抓取时间；没有的，来源见角色文档。

| 文件 | 角色 | 来源 | 版本/修订 | 抓取日期 | 元数据 | 角色文档 |
| --- | --- | --- | --- | --- | --- | --- |
| `ellen-nanoka-3.3.4+19304006.json` | 艾莲 | Nanoka 角色 1191 | `3.3.4+19304006` | 2026-10-10 | 无 | [ellen_joe](../characters/ellen_joe.md) |
| `evelyn-nanoka-3.3.12+19520738.json` | 伊芙琳 | Nanoka 角色 1321 | `3.3.12+19520738` | 2026-10-14 | `source` 字段 | [evelyn_chevalier](../characters/evelyn_chevalier.md) |
| `harumasa-nanoka-3.3.12+19520738.json` | 浅羽悠真 | Nanoka 角色 1201 | `3.3.12+19520738` | 2026-10-13 | `source` 字段 | [asaba_harumasa](../characters/asaba_harumasa.md) |
| `nangongyu-nanoka-3.3.4+19304006.json` | 南宫羽 | Nanoka 角色 1511 | `3.3.4+19304006` | 2026-10-10 | 无 | [nangongyu](../characters/nangongyu.md) |
| `nekomata-nanoka-3.3.12+19520738.json` | 猫又 | Nanoka 角色 1021 | `3.3.12+19520738` | 2026-10-13 | `source` 字段 | [nekomata](../characters/nekomata.md) |
| `severian-nanoka-3.4.3+20291004.json` | 赛维里安·洛威尔 | Nanoka 角色 1631 | `3.4.3+20291004` | 2026-11-18 | 无 | [severian_lowell](../characters/severian_lowell.md) |
| `severian-official-1794906819.json` | 赛维里安·洛威尔 | 官方百科词条 2217 | 修订 `1794906819` | 2026-11-18 | 无（原始响应） | [severian_lowell](../characters/severian_lowell.md) |
| `severian-official-weapon-1794632419.json` | 禁罪囚笼（赛维里安专武） | 官方百科词条 2305 | 修订 `1794632419` | 2026-11-18 | 无（原始响应） | [severian_lowell](../characters/severian_lowell.md) |
| `sunbringer-nanoka-3.4.5+20713015.json` | 挽昼 | Nanoka 角色 1601 | `3.4.5+20713015` | 2026-11-22 | 无（原始响应） | [sunbringer](../characters/sunbringer.md) |

其余角色（简、佩洛伊斯等）没有保存快照；它们的来源见各自角色文档。
