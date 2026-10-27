<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '账户' })

const { slurm, selected } = useSocket()

const loading = ref(false)
const error = ref('')
const notice = ref('')
const rows = ref([])
const updatedAt = ref(null)

const admin = computed(() => !!selected.value?.isRoot)
const showAdd = ref(false)
const form = ref({ name: '', parent: '', description: '' })
const submitting = ref(false)
const editing = ref(null)
const acting = ref('')

const tree = computed(() => {
  const map = new Map(rows.value.map((account) => [account.name, { ...account, children: [] }]))
  const roots = []
  for (const account of map.values()) {
    const parent = account.parent && account.parent !== account.name ? map.get(account.parent) : null
    if (parent) parent.children.push(account)
    else roots.push(account)
  }
  const byName = (a, b) => a.name.localeCompare(b.name)
  roots.sort(byName)
  for (const account of map.values()) account.children.sort(byName)
  return roots
})

async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    rows.value = await slurm.listAccounts()
    updatedAt.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function addAccount() {
  const name = form.value.name.trim()
  if (!name || submitting.value) return
  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    await slurm.addAccount(name, form.value.parent.trim(), form.value.description.trim())
    notice.value = `已创建账户 ${name}`
    showAdd.value = false
    form.value = { name: '', parent: '', description: '' }
    await refresh()
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

function startEdit(row) {
  editing.value = { name: row.name, set: row.description || '' }
  notice.value = ''
  error.value = ''
}

async function saveEdit() {
  if (!editing.value || acting.value) return
  acting.value = editing.value.name
  error.value = ''
  notice.value = ''
  try {
    await slurm.modifyAccount(editing.value.name, editing.value.set)
    notice.value = `已更新账户 ${editing.value.name}`
    editing.value = null
    await refresh()
  } catch (e) {
    error.value = e.message
  } finally {
    acting.value = ''
  }
}

async function removeAccount(row) {
  if (acting.value || row.name === 'root') return
  if (!window.confirm(`确定删除账户 ${row.name}？该操作不可恢复。`)) return
  acting.value = row.name
  error.value = ''
  notice.value = ''
  try {
    await slurm.deleteAccount(row.name)
    notice.value = `已删除账户 ${row.name}`
    await refresh()
  } catch (e) {
    error.value = e.message
  } finally {
    acting.value = ''
  }
}

onMounted(refresh)
</script>

<template>
  <div class="mt-6">
    <UiToolbar :loading="loading" :updated-at="updatedAt" @refresh="refresh">
      <button
        v-if="admin"
        type="button"
        class="orbit-btn orbit-btn-accent"
        @click="showAdd = !showAdd"
      >
        {{ showAdd ? '收起新增' : '新增账户' }}
      </button>
      <span class="text-xs text-orbit-muted">{{ rows.length }} 个账户</span>
    </UiToolbar>

    <!-- 新增账户 -->
    <div v-if="showAdd && admin" class="orbit-card mb-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <span class="orbit-label">账户名</span>
          <input
            v-model="form.name"
            type="text"
            placeholder="如 project_a"
            class="orbit-input w-48"
            :disabled="submitting"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="orbit-label">父账户</span>
          <input
            v-model="form.parent"
            type="text"
            placeholder="如 root"
            class="orbit-input w-40"
            :disabled="submitting"
          />
        </label>
        <label class="flex flex-1 flex-col gap-1">
          <span class="orbit-label">描述</span>
          <input
            v-model="form.description"
            type="text"
            placeholder="账户描述"
            class="orbit-input min-w-[200px]"
            :disabled="submitting"
            @keydown.enter.prevent="addAccount"
          />
        </label>
        <button
          type="button"
          class="orbit-btn orbit-btn-accent"
          :disabled="submitting || !form.name.trim()"
          @click="addAccount"
        >
          {{ submitting ? '创建中…' : '创建' }}
        </button>
      </div>
    </div>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <section>
      <div v-if="tree.length" class="space-y-3 py-2">
        <AccountTreeItem
          v-for="account in tree"
          :key="account.name"
          :account="account"
          :admin="admin"
          :editing="editing"
          :acting="acting"
          @edit="startEdit"
          @save="saveEdit"
          @cancel="editing = null"
          @remove="removeAccount"
        />
      </div>

      <UiEmpty v-else-if="!loading" class="px-5 py-10">暂无账户</UiEmpty>
    </section>
  </div>
</template>
