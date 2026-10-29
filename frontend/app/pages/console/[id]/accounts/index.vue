<script setup>
import { TreeItem, TreeRoot } from 'reka-ui'

definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'Accounts' })

const rows = ref([])
// Permission is derived from the backend environment by the console layout
const { isRoot: admin } = inject('consoleAuth')

const showAdd = ref(false)
const form = ref({ name: '', parent: '', description: '' })
const editing = ref(null)
// Expansion is tracked as collapsed names so new accounts show up expanded by default
const collapsed = ref(new Set())

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

function branchNames(nodes, names = []) {
  for (const node of nodes) {
    if (!node.children?.length) continue
    names.push(node.name)
    branchNames(node.children, names)
  }
  return names
}

const expanded = computed({
  get() {
    return branchNames(tree.value).filter((name) => !collapsed.value.has(name))
  },
  set(keys) {
    const open = new Set(keys)
    collapsed.value = new Set(branchNames(tree.value).filter((name) => !open.has(name)))
  }
})

const accountKey = (account) => account.name
const accountChildren = (account) => account.children?.length ? account.children : undefined

async function load() {
  error.value = ''
  try {
    rows.value = await request('slurm:list_accounts')
  } catch (e) {
    error.value = e.message
  }
}

const refresh = usePageRefresh(load)
const { error, notice, acting, run } = useAction(refresh)

async function addAccount() {
  const name = form.value.name.trim()
  if (!name) return
  const ok = await run('add', () => request('slurm:add_account', {
    name,
    parent: form.value.parent.trim(),
    description: form.value.description.trim()
  }), `Account ${name} created`)
  if (!ok) return
  showAdd.value = false
  form.value = { name: '', parent: '', description: '' }
}

function startEdit(row) {
  editing.value = { name: row.name, set: row.description || '' }
}

async function saveEdit() {
  const { name, set } = editing.value
  if (await run(name, () => request('slurm:modify_account', { where: name, set }), `Account ${name} updated`)) {
    editing.value = null
  }
}

async function removeAccount(row) {
  if (row.name === 'root') return
  if (!window.confirm(`Delete account ${row.name}? This cannot be undone.`)) return
  await run(row.name, () => request('slurm:delete_account', { name: row.name }), `Account ${row.name} deleted`)
}

onMounted(refresh)
</script>

<template>
  <div>
    <div class="mb-4 flex items-center gap-3">
      <UiButton v-if="admin" variant="accent" @click="showAdd = !showAdd">
        {{ showAdd ? 'Hide form' : 'New account' }}
      </UiButton>
      <span class="text-xs text-orbit-muted">{{ rows.length }} accounts</span>
    </div>

    <UiCard v-if="showAdd && admin" class="mb-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Name</span>
          <UiInput v-model="form.name" placeholder="e.g. project_a" class="w-48" :disabled="!!acting" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Parent</span>
          <UiInput v-model="form.parent" placeholder="e.g. root" class="w-40" :disabled="!!acting" />
        </label>
        <label class="flex flex-1 flex-col gap-1">
          <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Description</span>
          <UiInput
            v-model="form.description"
            placeholder="Account description"
            class="w-full min-w-[200px]"
            :disabled="!!acting"
            @keydown.enter.prevent="addAccount"
          />
        </label>
        <UiButton variant="accent" :disabled="!!acting || !form.name.trim()" @click="addAccount">
          {{ acting === 'add' ? 'Creating…' : 'Create' }}
        </UiButton>
      </div>
    </UiCard>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <TreeRoot
      v-if="rows.length"
      v-slot="{ flattenItems }"
      v-model:expanded="expanded"
      :items="tree"
      :get-key="accountKey"
      :get-children="accountChildren"
      class="m-0 list-none space-y-3 px-0 py-2"
    >
      <TreeItem
        v-for="item in flattenItems"
        :key="item._id"
        v-bind="item.bind"
        class="list-none outline-none"
        :style="{ marginLeft: `${(item.level - 1) * 20}px` }"
        @select="(event) => event.preventDefault()"
      >
        <template #default="{ isExpanded, handleToggle }">
          <UiCard class="flex items-center gap-3 px-4 py-3 transition hover:border-orbit-accent/25">
            <button
              v-if="item.hasChildren"
              type="button"
              class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg
                     text-orbit-muted transition hover:bg-white/5 hover:text-white"
              :aria-expanded="isExpanded"
              title="Expand/collapse"
              @click.stop="handleToggle"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="h-4 w-4 transition-transform"
                :class="isExpanded ? '' : '-rotate-90'"
              >
                <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <span v-else class="h-6 w-6 shrink-0" aria-hidden="true" />

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <p class="truncate text-sm font-medium text-white">{{ item.value.name }}</p>
                <span
                  v-for="flag in item.value.flags || []"
                  :key="flag"
                  class="rounded-full border border-orbit-warn/30 px-2 py-0.5 text-[10px] leading-none text-orbit-warn"
                >
                  {{ flag }}
                </span>
              </div>

              <div v-if="editing?.name === item.value.name" class="mt-1.5 flex items-center gap-1.5" @click.stop>
                <UiInput
                  v-model="editing.set"
                  size="sm"
                  class="min-w-0 flex-1"
                  :disabled="!!acting"
                  @keydown.enter.prevent="saveEdit"
                />
                <UiChip tone="ok" class="shrink-0" :disabled="!!acting" @click="saveEdit">Save</UiChip>
                <UiChip tone="accent" class="shrink-0" :disabled="!!acting" @click="editing = null">Cancel</UiChip>
              </div>
              <p v-else class="mt-1 truncate text-xs text-orbit-muted" :title="item.value.description">
                {{ item.value.description || '—' }}
              </p>
            </div>

            <div v-if="admin && editing?.name !== item.value.name" class="flex shrink-0 items-center gap-1.5" @click.stop>
              <UiChip tone="accent" :disabled="!!acting" @click="startEdit(item.value)">Edit</UiChip>
              <UiChip
                v-if="item.value.name !== 'root'"
                tone="danger"
                :disabled="!!acting"
                @click="removeAccount(item.value)"
              >
                Delete
              </UiChip>
            </div>
          </UiCard>
        </template>
      </TreeItem>
    </TreeRoot>

    <p v-else class="px-5 py-8 text-center text-sm text-orbit-muted">No accounts</p>
  </div>
</template>
