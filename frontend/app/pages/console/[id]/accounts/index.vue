<script setup>
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

const RAIL = 28 // px of indent per level
const GAP = 12 // px between rows (space-y-3); rails overhang by this much to stay continuous

// Vertical rails for a row at `depth`. Ancestor levels keep a full-height rail while their branch
// still has siblings below; the innermost level stops at the row centre to form the corner.
function railsFor(depth, guides) {
  const rails = []
  for (let level = 0; level < depth; level++) {
    const branch = level === depth - 1
    if (!branch && !guides[level]) continue
    const through = branch ? guides[level] : true
    rails.push({
      left: level * RAIL + RAIL / 2,
      top: -GAP,
      height: through ? `calc(100% + ${GAP}px)` : `calc(50% + ${GAP}px)`
    })
  }
  return rails
}

// Flattening keeps the markup flat: depth drives the indent, collapsed subtrees are skipped
const rowsWithDepth = computed(() => {
  const out = []
  const walk = (nodes, depth, guides) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1
      out.push({ ...node, depth, rails: railsFor(depth, guides) })
      if (!collapsed.value.has(node.name)) walk(node.children, depth + 1, [...guides, !isLast])
    })
  }
  walk(tree.value, 0, [])
  return out
})

function toggle(name) {
  const next = new Set(collapsed.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  collapsed.value = next
}

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

    <!-- New account -->
    <UiCard v-if="showAdd && admin" class="mb-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <UiLabel>Name</UiLabel>
          <UiInput v-model="form.name" placeholder="e.g. project_a" class="w-48" :disabled="!!acting" />
        </label>
        <label class="flex flex-col gap-1">
          <UiLabel>Parent</UiLabel>
          <UiInput v-model="form.parent" placeholder="e.g. root" class="w-40" :disabled="!!acting" />
        </label>
        <label class="flex flex-1 flex-col gap-1">
          <UiLabel>Description</UiLabel>
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

    <div v-if="rowsWithDepth.length" class="space-y-3 py-2">
      <div
        v-for="account in rowsWithDepth"
        :key="account.name"
        class="relative"
        :style="{ paddingLeft: `${account.depth * RAIL}px` }"
      >
        <span
          v-for="(rail, i) in account.rails"
          :key="`rail-${i}`"
          class="absolute w-px bg-orbit-line"
          :style="{ left: `${rail.left}px`, top: `${rail.top}px`, height: rail.height }"
          aria-hidden="true"
        />
        <span
          v-if="account.depth"
          class="absolute top-1/2 h-px bg-orbit-line"
          :style="{ left: `${(account.depth - 1) * RAIL + RAIL / 2}px`, width: `${RAIL / 2}px` }"
          aria-hidden="true"
        />
        <span
          v-if="account.depth"
          class="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit-muted"
          :style="{ left: `${(account.depth - 1) * RAIL + RAIL / 2}px` }"
          aria-hidden="true"
        />

        <UiCard class="flex items-center gap-3 px-4 py-3 transition hover:border-orbit-accent/25">
          <button
            v-if="account.children.length"
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-orbit-muted
                   transition hover:bg-white/5 hover:text-white"
            :aria-expanded="!collapsed.has(account.name)"
            title="Expand/collapse"
            @click="toggle(account.name)"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="h-4 w-4 transition-transform"
              :class="collapsed.has(account.name) ? '-rotate-90' : ''"
            >
              <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span v-else class="h-6 w-6 shrink-0" aria-hidden="true" />

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class="truncate text-sm font-medium text-white">{{ account.name }}</p>
              <span
                v-for="flag in account.flags || []"
                :key="flag"
                class="rounded-full border border-orbit-warn/30 px-2 py-0.5 text-[10px] leading-none text-orbit-warn"
              >
                {{ flag }}
              </span>
            </div>

            <div v-if="editing?.name === account.name" class="mt-1.5 flex items-center gap-1.5">
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
            <p v-else class="mt-1 truncate text-xs text-orbit-muted" :title="account.description">
              {{ account.description || '—' }}
            </p>
          </div>

          <div v-if="admin && editing?.name !== account.name" class="flex shrink-0 items-center gap-1.5">
            <UiChip tone="accent" :disabled="!!acting" @click="startEdit(account)">Edit</UiChip>
            <UiChip
              v-if="account.name !== 'root'"
              tone="danger"
              :disabled="!!acting"
              @click="removeAccount(account)"
            >
              Delete
            </UiChip>
          </div>
        </UiCard>
      </div>
    </div>

    <p v-else class="px-5 py-8 text-center text-sm text-orbit-muted">No accounts</p>
  </div>
</template>
