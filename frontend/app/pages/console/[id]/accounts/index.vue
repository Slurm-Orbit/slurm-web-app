<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '账户' })

const route = useRoute()
const { slurm, backendMeta } = useSocket()
const { error, notice, acting, run } = useAction(refresh)

const loading = ref(false)
const rows = ref([])
const updatedAt = ref(null)
const admin = computed(() => !!backendMeta(route.params.id)?.isRoot)
const showAdd = ref(false)
const form = ref({ name: '', parent: '', description: '' })
const editing = ref(null)

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
  if (!name) return
  const ok = await run('add', () => slurm.addAccount(name, form.value.parent.trim(), form.value.description.trim()), `已创建账户 ${name}`)
  if (!ok) return
  showAdd.value = false
  form.value = { name: '', parent: '', description: '' }
}

function startEdit(row) {
  editing.value = { name: row.name, set: row.description || '' }
}

async function saveEdit() {
  const { name, set } = editing.value
  if (await run(name, () => slurm.modifyAccount(name, set), `已更新账户 ${name}`)) {
    editing.value = null
  }
}

async function removeAccount(row) {
  if (row.name === 'root') return
  if (!window.confirm(`确定删除账户 ${row.name}？该操作不可恢复。`)) return
  await run(row.name, () => slurm.deleteAccount(row.name), `已删除账户 ${row.name}`)
}

onMounted(refresh)
</script>

<template>
  <div class="mt-6">
    <UiToolbar :loading="loading" :updated-at="updatedAt" @refresh="refresh">
      <UiButton v-if="admin" variant="accent" @click="showAdd = !showAdd">
        {{ showAdd ? '收起新增' : '新增账户' }}
      </UiButton>
      <span class="text-xs text-orbit-muted">{{ rows.length }} 个账户</span>
    </UiToolbar>

    <!-- 新增账户 -->
    <UiCard v-if="showAdd && admin" class="mb-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <UiLabel>账户名</UiLabel>
          <UiInput v-model="form.name" placeholder="如 project_a" class="w-48" :disabled="!!acting" />
        </label>
        <label class="flex flex-col gap-1">
          <UiLabel>父账户</UiLabel>
          <UiInput v-model="form.parent" placeholder="如 root" class="w-40" :disabled="!!acting" />
        </label>
        <label class="flex flex-1 flex-col gap-1">
          <UiLabel>描述</UiLabel>
          <UiInput
            v-model="form.description"
            placeholder="账户描述"
            class="w-full min-w-[200px]"
            :disabled="!!acting"
            @keydown.enter.prevent="addAccount"
          />
        </label>
        <UiButton variant="accent" :disabled="!!acting || !form.name.trim()" @click="addAccount">
          {{ acting === 'add' ? '创建中…' : '创建' }}
        </UiButton>
      </div>
    </UiCard>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <div v-if="tree.length" class="space-y-3 py-2">
      <AccountTreeItem
        v-for="account in tree"
        :key="account.name"
        v-model:editing="editing"
        :account="account"
        :admin="admin"
        :acting="acting"
        @edit="startEdit"
        @save="saveEdit"
        @cancel="editing = null"
        @remove="removeAccount"
      />
    </div>

    <UiEmpty v-else-if="!loading" class="px-5 py-10">暂无账户</UiEmpty>
  </div>
</template>
