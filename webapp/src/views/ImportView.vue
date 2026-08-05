<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NAlert, NButton, NCard, NInput, NList, NListItem, NTag, useMessage } from "naive-ui"
import { Download, RefreshCw } from "lucide-vue-next"
import { useCatalogStore } from "@/stores/catalog"
import { useBuildStore } from "@/stores/build"
import { buildConfigForAgent, importEnkaShowcase } from "@/utils/enkaImport"

const catalogStore = useCatalogStore()
const buildStore = useBuildStore()
const message = useMessage()

const uid = ref("")
const loading = ref(false)
const applyingId = ref("")
const error = ref("")
const ttlSeconds = ref(0)
const mappedAgents = ref<any[]>([])
const skippedAgents = ref<any[]>([])
const warnings = ref<string[]>([])

const hasResult = computed(() => mappedAgents.value.length > 0 || skippedAgents.value.length > 0)

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
  ttlSeconds.value = 0
  try {
    await catalogStore.load()
    const result = await importEnkaShowcase(value, catalogStore.catalog)
    mappedAgents.value = result.mappedAgents
    skippedAgents.value = result.skippedAgents
    warnings.value = result.warnings
    ttlSeconds.value = result.ttlSeconds
    if (!result.mappedAgents.length && !result.skippedAgents.length) {
      error.value = "Enka 没有返回公开展柜角色，请确认已开启角色详情展示。"
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function applyAgent(agent: any) {
  applyingId.value = agent.agentId
  try {
    await catalogStore.load()
    buildStore.applyAgentConfig(agent.agentId, catalogStore.meta, buildConfigForAgent(agent))
    buildStore.persist()
    message.success(`已导入 ${agent.agentName}（角色 + 音擎）`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e))
  } finally {
    applyingId.value = ""
  }
}

onMounted(() => {
  catalogStore.load()
})
</script>

<template>
  <div class="import-view">
    <NCard title="从 Enka 展柜导入" size="small">
      <p class="hint">
        输入游戏 UID 读取公开展柜，把角色等级 / 影画 / 核心技 / 技能与已装备音擎写入当前账号对应角色的配置。
        不会改动 Buff、伤害事件、敌人配置与驱动盘。
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

    <NCard v-if="hasResult" title="展柜角色" size="small" class="block">
      <NList bordered>
        <NListItem v-for="agent in mappedAgents" :key="agent.agentId">
          <div class="agent-row">
            <div>
              <strong>{{ agent.agentName }}</strong>
              <span class="meta">
                Lv.{{ agent.agentLevel ?? "?" }} / 影画 {{ agent.cinemaLevel ?? "?" }} / 核心技 {{ agent.coreSkillLevel ?? "?" }}
                <template v-if="agent.wEngine"> / {{ agent.wEngine.name }} Lv.{{ agent.wEngine.level }} P{{ agent.wEngine.modificationLevel }}</template>
              </span>
            </div>
            <NButton
              size="small"
              type="primary"
              secondary
              :loading="applyingId === agent.agentId"
              @click="applyAgent(agent)"
            >
              <template #icon><Download :size="14" /></template>
              导入
            </NButton>
          </div>
        </NListItem>
        <NListItem v-for="item in skippedAgents" :key="item.enkaId">
          <div class="agent-row">
            <div>
              <strong>{{ item.name }}</strong>
              <span class="meta">{{ item.reason }}</span>
            </div>
            <NTag size="small" type="default">已跳过</NTag>
          </div>
        </NListItem>
      </NList>
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
.agent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.meta {
  margin-left: 8px;
  color: var(--n-text-color-3, #888);
  font-size: 12px;
}
</style>
