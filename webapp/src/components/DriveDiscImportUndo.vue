<script setup lang="ts">
import { computed, ref } from "vue"
import { NAlert, NButton, useMessage } from "naive-ui"
import ConfirmDialog from "./ConfirmDialog.vue"
import { useInventoryStore } from "@/stores/inventory"
import { useAccountStore } from "@/stores/account"
import { commitDriveDiscImportPlan, previewLastDriveDiscImportUndo } from "@runtime/drive-disc-import-transaction"
const inventory = useInventoryStore()
const accounts = useAccountStore()
const message = useMessage()
const busy = ref(false)
const error = ref("")
const plan = ref<any>(null)
const available = computed(() => inventory.store?.driveDiscImportState?.byOwner?.[accounts.currentOwnerId ?? ""]?.undoJournal?.status === "committed")
async function preview() {
  if (busy.value) return
  busy.value = true
  error.value = ""
  try { plan.value = await previewLastDriveDiscImportUndo(accounts.currentOwnerId!) }
  catch (failure) { error.value = String((failure as Error).message) }
  finally { busy.value = false }
}
async function confirm() {
  if (busy.value || !plan.value) return
  busy.value = true
  try {
    await commitDriveDiscImportPlan(plan.value)
    await inventory.load()
    await accounts.load()
    plan.value = null
    message.success("已撤销上一次成功导入")
  } catch (failure) { error.value = String((failure as Error).message) }
  finally { busy.value = false }
}
</script>

<template>
  <NButton :disabled="!available || busy" :loading="busy" @click="preview">撤销上次导入</NButton>
  <NAlert v-if="error && !plan" type="error">{{ error }}</NAlert>
  <ConfirmDialog :show="Boolean(plan)" title="撤销上一次成功导入" :busy="busy" :error="error" danger
    :message="`将恢复本次导入前的 ${plan?.affected?.driveDiscIds?.length ?? 0} 张相关驱动盘、${plan?.affected?.loadoutIds?.length ?? 0} 个相关套装及配置。只可撤销最近一次 JSON／扫描导入；相关数据变化时会停止。`"
    confirm-text="确认撤销" @confirm="confirm" @update:show="value => { if (!value && !busy) plan = null }" />
</template>
