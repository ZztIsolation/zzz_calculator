<script setup lang="ts">
import { ref } from "vue"
import { NAlert, NButton, NCheckbox, NModal } from "naive-ui"
import { createPersonalBackup, downloadData, previewPersonalRestore, restorePersonalBackup } from "@runtime/personal-backup"
const busy = ref(false)
const restoreInput = ref<HTMLInputElement | null>(null)
const error = ref("")
const plan = ref<any>(null)
const backedUp = ref(false)
const confirmed = ref(false)
async function exportBackup() {
  if (busy.value) return
  busy.value = true; error.value = ""
  try { downloadData(await createPersonalBackup(), `绝区零计算器-完整备份-${new Date().toISOString().slice(0, 10)}.json`) }
  catch (failure) { error.value = (failure as Error).message }
  finally { busy.value = false }
}
async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || busy.value) return
  busy.value = true; error.value = ""; plan.value = null; backedUp.value = false; confirmed.value = false
  try { plan.value = await previewPersonalRestore(JSON.parse(await file.text())) }
  catch (failure) { error.value = (failure as Error).message }
  finally { busy.value = false; input.value = "" }
}
function downloadBefore() {
  if (!plan.value) return
  downloadData({ format: plan.value.before.unreadableFallback === undefined ? "zzz-calculator-personal-backup" : "zzz-calculator-recovery-copy",
    version: 1, createdAt: new Date().toISOString(), data: plan.value.before }, "绝区零计算器-恢复前副本.json")
  backedUp.value = true
}
async function restore() {
  if (busy.value || !backedUp.value || !confirmed.value) return
  busy.value = true; error.value = ""
  try { await restorePersonalBackup(plan.value); window.location.reload() }
  catch (failure) { error.value = (failure as Error).message; busy.value = false }
}
</script>

<template>
  <section class="panel" data-layout-surface="personal-backup">
    <div class="panel-header"><h2 class="panel-title">完整个人备份</h2></div>
    <div class="panel-body section-band">
      <p>保存全部账号、驱动盘、套装预设、计算条件和绑定信息。请在同一浏览器地址使用；项目里的角色目录与游戏文件不在此备份中。</p>
      <NAlert v-if="error && !plan" type="error">{{ error }}</NAlert>
      <div class="toolbar">
        <NButton :loading="busy" :disabled="busy" @click="exportBackup">导出完整备份</NButton>
        <!-- 用统一样式的按钮代替浏览器原生文件框；文件框保留给读屏和测试，只是视觉上隐藏 -->
        <NButton :disabled="busy" data-testid="choose-backup-file" @click="restoreInput?.click()">从备份恢复…</NButton>
        <input
          ref="restoreInput"
          class="visually-hidden-file"
          type="file"
          accept=".json,application/json"
          :disabled="busy"
          aria-label="选择完整备份恢复"
          tabindex="-1"
          @change="selectFile"
        >
      </div>
    </div>
  </section>
  <NModal :show="Boolean(plan)" preset="card" title="确认完整恢复范围" style="width: min(680px, calc(100vw - 24px))" :mask-closable="!busy" :closable="!busy" :close-on-esc="!busy" @update:show="value => { if (!value && !busy) plan = null }">
    <div v-if="plan" class="section-band" data-layout-surface="personal-restore">
      <p>将用备份整份替换当前个人数据。请先关闭其他计算器标签页，下载恢复前副本并确认文件已保存。</p>
      <p>当前：{{ plan.current.accounts }} 个账号、{{ plan.current.discs }} 张盘、{{ plan.current.loadouts }} 个套装、{{ plan.current.documents }} 份设置。</p>
      <p>恢复后：{{ plan.incoming.accounts }} 个账号、{{ plan.incoming.discs }} 张盘、{{ plan.incoming.loadouts }} 个套装、{{ plan.incoming.documents }} 份设置。</p>
      <p>备份账号：{{ plan.incoming.labels.join('、') }}</p>
      <NAlert v-if="plan.current.unreadable" type="warning">当前库存无法解析，恢复前副本会保留原始内容，供人工修复。</NAlert>
      <NAlert v-if="error" type="error">{{ error }}</NAlert>
      <NButton :disabled="busy" @click="downloadBefore">下载恢复前副本</NButton>
      <NCheckbox v-model:checked="confirmed" :disabled="busy">我已保存副本，并确认替换以上全部个人数据</NCheckbox>
    </div>
    <template #footer><div class="toolbar">
      <NButton :disabled="busy" @click="plan = null">取消</NButton>
      <NButton type="warning" :disabled="!backedUp || !confirmed || busy" :loading="busy" @click="restore">确认完整恢复</NButton>
    </div></template>
  </NModal>
</template>

<style scoped>
.visually-hidden-file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
