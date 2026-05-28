# Goal

This file tracks future planning for `zzz_calculator`. Each goal must carry a
status so it is clear whether it is done, still being iterated, or only planned.

## Status Legend

- `Done`: implemented and verified for the current scope.
- `Iterating`: implemented partially, but known follow-up work is required.
- `Planned`: agreed direction, not implemented yet.
- `Blocked`: cannot continue without new data, a user decision, or an external
  dependency.

## Goals

| Status | Goal | Notes |
| --- | --- | --- |
| Done | Keep all ZZZ work under `zzz_calculator`. | Independent maintenance boundary is established. |
| Done | Model level 60 agents and W-Engines. | Anby, Ye Shunguang, Demara Battery Mark II, and Cloudcleave Radiance are present. |
| Done | Implement out-of-combat panel calculation. | Handles base stats, W-Engine Base ATK, W-Engine advanced stat, Drive Disc stats, and unconditional out-of-combat effects. |
| Done | Add a Chinese ZZZ-style calculator UI. | Current page has sidebar navigation, hero strip, config cards, panel cards, and Chinese stat labels. |
| Done | Add Ye Shunguang and Cloudcleave Radiance. | Ye Shunguang uses `attribute: "honed_edge"` and `damageElement: "physical"`. |
| Done | Add Core Skill level modeling for out-of-combat panel stats. | Ye Shunguang Core Skill A-F now contributes Base ATK and CRIT Rate, with frontend level selection defaulting to max. |
| Done | Reset Core Skill level to each agent's modeled default on agent switch. | Switching from an unmodeled Core Skill agent to Ye Shunguang now selects `强化F` instead of inheriting `未强化`. |
| Done | Add physical resistance ignore stat. | `physicalResIgnore` exists for future damage formula work. |
| Done | Add grouped teammate Buff data model. | `data/combat_buffs.json` now supports teammate-owned Buff lists with source, literal description, and structured calculation stats. |
| Done | Add 千夏 teammate Buffs to the in-combat panel. | 千夏 has Core Passive ATK +1050 and EX Special ATK +50, both selectable on the homepage and applied to the in-combat panel. |
| Done | Polish the Buff selection modal and simplify custom Buff input. | The modal is now narrower and card-like; custom Buff creation only allows one stat effect per saved custom Buff. |
| Done | Add user Drive Disc inventory storage. | `data/user_drive_discs.json` records imported scanner discs for owner `default`. |
| Done | Add ZZZ Scanner import adapter. | The provided 2026-05-26 export imports 200 discs with no warnings. |
| Iterating | Expand canonical Drive Disc set catalog. | Imported sets currently use generated scanner set ids until their 2-piece/4-piece effects are modeled. |
| Iterating | Add Core Skill data for every agent. | Ye Shunguang is modeled. Anby and future agents still need accurate A-F Core Skill stat data. |
| Iterating | Improve panel formulas for non-ATK scalar stats. | Impact, Energy Regen, and Anomaly Mastery percentage handling should be screenshot-verified and made explicit. |
| Done | Add a dedicated Drive Disc inventory page. | `/drive-discs.html` displays imported discs with filtering, sorting, details, import, create, update, delete, lock, and equip state fields. |
| Done | Add frontend import workflow. | Users can paste JSON, choose a JSON file, or ask the backend to read a local source path through `POST /api/user-drive-discs/import/zzz-scanner`. |
| Done | Add Drive Disc CRUD UI. | The inventory page now uses backend endpoints for create/update/delete. |
| Planned | Allow calculator to select Drive Discs from inventory. | Current calculator uses JSON input. Future UI should select six discs from `user_drive_discs.json`. |
| Planned | Add build/save/load support. | A build should capture agent, W-Engine, six selected discs, assumptions, and target function. |
| Iterating | Add in-combat panel layer. | Current layer combines out-of-combat panel with selected self, teammate, W-Engine, Drive Disc 4-piece, field, boss, and manual Buffs; damage and timing semantics still need iteration. |
| Planned | Add enemy model. | Needed for defense, resistance, weakness, stun multiplier, and physical resistance ignore. |
| Planned | Add Ye Shunguang damage calculation. | Start with Cloudcleave Radiance phase 1 buffs and a simple physical damage target before full rotation modeling. |
| Planned | Add optimizer. | Search imported inventory for best six-disc combinations once set effects and target functions are reliable. |
| Planned | Add validation tests. | Turn examples into automated snapshot tests for Anby, Ye Shunguang, and scanner import. |

## Current Next Best Steps

1. Expand `data/drive_disc_sets.json` for the eight set names found in the
   imported scanner export.
2. Add Core Skill A-F data for Anby and any newly added agents.
3. Let the calculator load six selected inventory discs instead of requiring
   manual JSON editing.
4. Add a first in-combat/damage preview path for Ye Shunguang + Cloudcleave
   Radiance.
