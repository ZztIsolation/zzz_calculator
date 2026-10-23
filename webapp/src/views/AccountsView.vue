<script setup lang="ts">
import { computed, ref } from "vue"
import { NAlert, NButton, NInput, NModal, NTag } from "naive-ui"
import { Check, Pencil, Plus, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { useAccountStore } from "@/stores/account"

const accountStore = useAccountStore()
const showEditor = ref(false)
const editingId = ref("")
const labelDraft = ref("")
const deleteId = ref("")

const deleteTarget = computed(() => accountStore.owners.find((owner: any) => owner.id === deleteId.value))
const accountUnavailable = computed(() => accountStore.loadState !== "ready" || Boolean(accountStore.operation))

async function retryAccountLoad() {
  try {
    await accountStore.ensureLoaded()
  } catch {
    // The shared store exposes the error to this view.
  }
}

function createAccount() {
  accountStore.operationError = ""
  editingId.value = ""
  labelDraft.value = "新账号"
  showEditor.value = true
}

function renameAccount(owner: any) {
  accountStore.operationError = ""
  editingId.value = owner.id
  labelDraft.value = owner.label || owner.name || "账号"
  showEditor.value = true
}

async function saveEditor() {
  if (accountStore.operation) return
  const label = labelDraft.value.trim() || "新账号"
  try {
    if (editingId.value) {
      await accountStore.rename(editingId.value, label)
    } else {
      await accountStore.create(label)
    }
    showEditor.value = false
  } catch { /* Keep the draft and expose the shared operation error. */ }
}

async function confirmDelete() {
  if (accountStore.operation) return
  try {
    await accountStore.remove(deleteId.value)
    deleteId.value = ""
  } catch { /* Keep the confirmation open on failure. */ }
}

async function switchAccount(id: string) {
  if (accountStore.operation) return
  try { await accountStore.switchTo(id) } catch { /* Render the shared error. */ }
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h1 class="panel-title">账号</h1>
      <NButton type="primary" :disabled="accountUnavailable" @click="createAccount">
        <template #icon><Plus :size="16" /></template>
        新建账号
      </NButton>
    </div>
    <div class="panel-body">
      <NAlert v-if="accountStore.operationError" type="error" title="账号操作失败">{{ accountStore.operationError }}</NAlert>
      <NAlert v-if="accountStore.loadState === 'error'" type="error" title="账号信息加载失败">
        {{ accountStore.error }}
        <NButton secondary size="small" @click="retryAccountLoad">重试</NButton>
      </NAlert>
      <div v-else-if="accountStore.loadState === 'loading' || accountStore.loadState === 'idle'" class="empty-state">
        正在加载账号…
      </div>
      <div v-else-if="accountStore.owners.length" class="entity-grid">
        <article v-for="owner in accountStore.owners" :key="owner.id" class="panel">
          <div class="panel-header">
            <h2 class="panel-title">{{ owner.label }}</h2>
            <NTag v-if="owner.id === accountStore.currentOwnerId" type="success" round>
              当前
            </NTag>
          </div>
          <div class="panel-body section-band">
            <dl class="metric-grid">
              <div class="metric">
                <dt>驱动盘</dt>
                <dd class="num">{{ owner.driveDiscCount ?? 0 }}</dd>
              </div>
              <div class="metric">
                <dt>套装预设</dt>
                <dd class="num">{{ owner.loadoutCount ?? 0 }}</dd>
              </div>
              <div class="metric">
                <dt>导入记录</dt>
                <dd class="num">{{ owner.importCount ?? 0 }}</dd>
              </div>
              <div class="metric">
                <dt>游戏 UID</dt>
                <dd>{{ owner.enkaUid || "未绑定" }}</dd>
              </div>
            </dl>
            <div class="toolbar">
              <NButton :loading="accountStore.operation === 'switch'" :disabled="accountUnavailable || owner.id === accountStore.currentOwnerId" @click="switchAccount(owner.id)">
                <template #icon><Check :size="16" /></template>
                切换
              </NButton>
              <NButton :disabled="accountUnavailable" @click="renameAccount(owner)">
                <template #icon><Pencil :size="16" /></template>
                改名
              </NButton>
              <NButton type="error" :disabled="accountUnavailable || owner.id === accountStore.currentOwnerId" @click="deleteId = owner.id">
                <template #icon><Trash2 :size="16" /></template>
                删除
              </NButton>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">暂无账号</div>
    </div>
  </section>

  <NModal v-model:show="showEditor" :closable="!accountStore.operation" :mask-closable="!accountStore.operation" :close-on-esc="!accountStore.operation" preset="dialog" :title="editingId ? '重命名账号' : '新建账号'">
    <NAlert v-if="accountStore.operationError" type="error">{{ accountStore.operationError }}</NAlert>
    <NInput v-model:value="labelDraft" :disabled="Boolean(accountStore.operation)" placeholder="账号名称" />
    <template #action>
      <NButton :disabled="Boolean(accountStore.operation)" @click="showEditor = false">取消</NButton>
      <NButton type="primary" :loading="Boolean(accountStore.operation)" @click="saveEditor">保存</NButton>
    </template>
  </NModal>

  <ConfirmDialog
    :show="Boolean(deleteId)"
    danger
    title="删除账号"
    :message="`将删除「${deleteTarget?.label || ''}」下的 ${deleteTarget?.driveDiscCount ?? 0} 个驱动盘、${deleteTarget?.loadoutCount ?? 0} 个套装预设和 ${deleteTarget?.importCount ?? 0} 条导入记录。`"
    confirm-text="删除账号"
    :busy="accountStore.operation === 'remove'"
    :error="accountStore.operationError"
    @update:show="value => { if (!value && !accountStore.operation) deleteId = '' }"
    @confirm="confirmDelete"
  />
</template>
