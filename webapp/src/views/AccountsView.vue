<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { NButton, NInput, NModal, NTag } from "naive-ui"
import { Check, Pencil, Plus, Trash2 } from "lucide-vue-next"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { useAccountStore } from "@/stores/account"

const accountStore = useAccountStore()
const showEditor = ref(false)
const editingId = ref("")
const labelDraft = ref("")
const deleteId = ref("")

onMounted(() => {
  void accountStore.load()
})

const deleteTarget = computed(() => accountStore.owners.find((owner: any) => owner.id === deleteId.value))

function createAccount() {
  editingId.value = ""
  labelDraft.value = "新账号"
  showEditor.value = true
}

function renameAccount(owner: any) {
  editingId.value = owner.id
  labelDraft.value = owner.label || owner.name || owner.id
  showEditor.value = true
}

async function saveEditor() {
  const label = labelDraft.value.trim() || "新账号"
  if (editingId.value) {
    await accountStore.rename(editingId.value, label)
  } else {
    await accountStore.create(label)
  }
  showEditor.value = false
}

async function confirmDelete() {
  await accountStore.remove(deleteId.value)
  deleteId.value = ""
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h1 class="panel-title">账号</h1>
      <NButton type="primary" @click="createAccount">
        <template #icon><Plus :size="16" /></template>
        新建账号
      </NButton>
    </div>
    <div class="panel-body">
      <div v-if="accountStore.owners.length" class="entity-grid">
        <article v-for="owner in accountStore.owners" :key="owner.id" class="panel">
          <div class="panel-header">
            <h2 class="panel-title">{{ owner.label || owner.name || owner.id }}</h2>
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
            </dl>
            <div class="toolbar">
              <NButton :disabled="owner.id === accountStore.currentOwnerId" @click="accountStore.switchTo(owner.id)">
                <template #icon><Check :size="16" /></template>
                切换
              </NButton>
              <NButton @click="renameAccount(owner)">
                <template #icon><Pencil :size="16" /></template>
                改名
              </NButton>
              <NButton type="error" :disabled="owner.id === accountStore.currentOwnerId" @click="deleteId = owner.id">
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

  <NModal v-model:show="showEditor" preset="dialog" :title="editingId ? '重命名账号' : '新建账号'">
    <NInput v-model:value="labelDraft" placeholder="账号名称" />
    <template #action>
      <NButton @click="showEditor = false">取消</NButton>
      <NButton type="primary" @click="saveEditor">保存</NButton>
    </template>
  </NModal>

  <ConfirmDialog
    :show="Boolean(deleteId)"
    danger
    title="删除账号"
    :message="`将删除「${deleteTarget?.label || deleteTarget?.id || ''}」下的 ${deleteTarget?.driveDiscCount ?? 0} 个驱动盘、${deleteTarget?.loadoutCount ?? 0} 个套装预设和 ${deleteTarget?.importCount ?? 0} 条导入记录。`"
    confirm-text="删除账号"
    @update:show="value => { if (!value) deleteId = '' }"
    @confirm="confirmDelete"
  />
</template>
