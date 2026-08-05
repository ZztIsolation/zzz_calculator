<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NAlert, NButton, NCard, NCheckbox, NInput, NTag, useMessage } from "naive-ui"
import { Download, RefreshCw } from "lucide-vue-next"
import { useCatalogStore } from "@/stores/catalog"
import { useBuildStore } from "@/stores/build"
import { useInventoryStore } from "@/stores/inventory"
import { buildConfigForAgent, importEnkaShowcase, planDriveDiscImport } from "@/utils/enkaImport"

const catalogStore = useCatalogStore()
const buildStore = useBuildStore()
const inventoryStore = useInventoryStore()
const message = useMessage()

const uid = ref("")
const loading = ref(false)
const applying = ref(false)
const error = ref("")
const ttlSeconds = ref(0)
const mappedAgents = ref<any[]>([])
const skippedAgents = ref<any[]>([])
const warnings = ref<string[]>([])
const selectedIds = ref<string[]>([])

const hasResult = computed(() => mappedAgents.value.length > 0 || skippedAgents.value.length > 0)
const selectedAgents = computed(() => mappedAgents.value.filter(a => selectedIds.value.includes(a.agentId)))

async function loadShowcase() {
  const value = uid.value.trim()
  if (!/^\d{8,12}$/.test(value)) {
    error.value = "UID 必须是 8–12 位数字。"
    return
  }
  loading.value = true
  error.value = ""
  mappedAgents.value = []
  skippedAgents.value = []
  warnings.value = []
  selectedIds.value = []
  ttlSeconds.value = 0
  try {
    await catalogStore.load()
    const result = await importEnkaShowcase(value, catalogStore.catalog)
    mappedAgents.value = result.mappedAgents
    skippedAgents.value = result.skippedAgents
    warnings.value = result.warnings
    ttlSeconds.value = result.ttlSeconds
    selectedIds.value = result.mappedAgents.map((a: any) => a.agentId)
    if (!result.mappedAgents.length && !result.skippedAgents.length) {
      error.value = "Enka 没有返回公开展柜角色，请确认已开启角色详情展示。"
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function agentSummary(agent: any): string {
  const parts = [
    `Lv.${agent.agentLevel ?? "?"}`,
    `影画 ${agent.cinemaLevel ?? "?"}`,
    `核心技 ${agent.coreSkillLevel ?? "?"}`,
  ]
  if (agent.wEngine) parts.push(`${agent.wEngine.name} Lv.${agent.wEngine.level} P${agent.wEngine.modificationLevel}`)
  const discs = agent.driveDiscPreset?.driveDiscs?.length ?? 0
  parts.push(discs ? `驱动盘 ${discs}/6` : "无驱动盘数据")
  return parts.join(" / ")
}

async function applySelected() {
  if (!selectedAgents.value.length) return
  applying.value = true
  try {
    await catalogStore.load()
    // 1) drive discs: one atomic planned write into the inventory store
    const withDiscs = selectedAgents.value.filter(a => a.driveDiscPreset?.driveDiscs?.length)
    let discNote = ""
    if (withDiscs.length) {
      const { store, ownerId } = await inventoryStore.fullStoreWithOwner()
      const plan = planDriveDiscImport(withDiscs, store, ownerId)
      if (plan.changed) {
        await inventoryStore.applyPlannedStore(plan.nextStore)
        discNote = `，驱动盘新增 ${plan.addedDiscs} 张/更新 ${plan.updatedDiscs} 张，预设 ${plan.presetCount} 套`
      }
      for (const w of plan.warnings ?? []) message.warning(w)
    }
    // 2) per-agent build config
    for (const agent of selectedAgents.value) {
      const config = buildConfigForAgent(agent)
      const loadoutId = `enka-showcase-${agent.agentId}`
      if (inventoryStore.loadouts.some((l: any) => l.id === loadoutId)) {
        config.discMode = "loadout"
        config.selectedLoadoutId = loadoutId
      }
      buildStore.applyAgentConfig(agent.agentId, catalogStore.meta, config)
    }
    buildStore.persist()
    message.success(`已导入 ${selectedAgents.value.length} 个角色（角色 + 音擎${discNote ? " + 驱动盘" : ""}）${discNote}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    applying.value = false
  }
}

onMounted(() => {
  catalogStore.load()
  inventoryStore.load()
})
</script>

<template>
  <div class="import-view">
    <NCard title="从 Enka 展柜导入" size="small">
      <p class="hint">
        输入游戏 UID 读取公开展柜，把角色的等级 / 影画 / 核心技 / 技能、已装备音擎与已装备驱动盘写入当前账号。
        驱动盘会写入库存并按角色生成稳定预设（enka-showcase-角色id），装备变化时更新时间。不会改动 Buff、伤害事件、敌人配置与手动库存。
      </p>
      <div class="uid-row">
        <NInput
          v-model:value="uid"
          placeholder="游戏 UID（8–12 位数字）"
          :disabled="loading"
          style="max-width: 280px"
          @keyup.enter="loadShowcase"
        />
        <NButton type="primary" :loading="loading" :disabled="!uid.trim()" @click="loadShowcase">
          <template #icon><RefreshCw :size="16" /></template>
          读取展柜
        </NButton>
      </div>
      <NAlert v-if="error" type="error" :title="error" class="block" />
      <NAlert v-if="ttlSeconds > 0" type="info" class="block" :title="`Enka 缓存约 ${ttlSeconds} 秒内有效`" />
      <NAlert v-for="(w, i) in warnings" :key="i" type="warning" :title="w" class="block" />
    </NCard>

    <NCard v-if="hasResult" size="small" class="block">
      <template #header>
        <div class="list-header">
          <span>展柜角色（勾选要导入的）</span>
          <NButton
            size="small"
            type="primary"
            :loading="applying"
            :disabled="!selectedIds.length"
            @click="applySelected"
          >
            <template #icon><Download :size="14" /></template>
            导入选中（{{ selectedIds.length }}）
          </NButton>
        </div>
      </template>
      <div class="agent-list">
        <div v-for="agent in mappedAgents" :key="agent.agentId" class="agent-row">
          <NCheckbox :checked="selectedIds.includes(agent.agentId)" @update:checked="(c:boolean) => {
            selectedIds = c ? [...selectedIds, agent.agentId] : selectedIds.filter(id => id !== agent.agentId)
          }" />
          <div class="agent-info">
            <strong>{{ agent.agentName }}</strong>
            <span class="meta">{{ agentSummary(agent) }}</span>
          </div>
        </div>
        <div v-for="item in skippedAgents" :key="item.enkaId" class="agent-row skipped">
          <span class="checkbox-spacer" />
          <div class="agent-info">
            <strong>{{ item.name }}</strong>
            <span class="meta">{{ item.reason }}</span>
          </div>
          <NTag size="small" type="default">已跳过</NTag>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hint {
  margin: 0 0 12px;
  color: var(--n-text-color-3, #888);
  font-size: 13px;
}
.uid-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.block {
  margin-top: 12px;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.agent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
}
.agent-row.skipped {
  opacity: 0.7;
}
.checkbox-spacer {
  width: 16px;
}
.agent-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.meta {
  color: var(--n-text-color-3, #888);
  font-size: 12px;
}
</style>
