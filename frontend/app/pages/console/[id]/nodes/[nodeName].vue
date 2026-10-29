<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'Node' })

const route = useRoute()

const NODE_ACTIONS = [
  { state: 'RESUME', label: 'Resume', hint: 'Clear drain or down state and accept jobs again' },
  { state: 'DRAIN', label: 'Drain', hint: 'Stop scheduling new jobs; running jobs continue' },
  { state: 'DOWN', label: 'Down', hint: 'Take the node out of scheduling immediately, usually for failures' }
]

const nodeName = String(route.params.nodeName)
// Permission is derived from the backend environment by the console layout
const { isRoot } = inject('consoleAuth')

const error = ref('')
const info = ref(null)
const menuOpen = ref(false)
const menuRef = ref(null)
onClickOutside(menuRef, () => { menuOpen.value = false })

const clampPct = (n) => Math.min(100, Math.max(0, n))

const cpu = computed(() => {
  const n = info.value
  const total = Number(n?.effectiveCpus) || 0
  const used = Number(n?.allocCpus) || 0
  return { pct: total ? clampPct(Math.round((used / total) * 100)) : 0, used, total, idle: n?.idleCpus ?? 0 }
})

const memory = computed(() => {
  const n = info.value
  const total = Number(n?.realMemory) || 0
  const free = n?.freeMem
  if (!total || free == null) return { pct: null, used: null, free: null, total }
  return { pct: clampPct(Math.round(((total - free) / total) * 100)), used: total - free, free, total }
})

const facts = computed(() => {
  const n = info.value
  if (!n) return []
  return [
    { label: 'Architecture', value: fmt(n.architecture) },
    { label: 'OS', value: fmt(n.os) },
    { label: 'Address', value: fmt(n.address) },
    { label: 'Boot time', value: fmtDate(n.bootTime) },
    { label: 'GRES total', value: fmt(n.gres) },
    { label: 'GRES used', value: fmt(n.gresUsed) }
  ]
})

const cellClass = (i) => [
  'px-5 py-3.5',
  i > 0 && 'border-t border-orbit-line/60',
  i % 2 === 1 && 'sm:border-l',
  i < 2 && 'sm:border-t-0'
]

async function load() {
  error.value = ''
  try {
    const nodes = await request('slurm:list_nodes')
    info.value = nodes.find((n) => n.name === nodeName) || null
    if (!info.value) throw new Error(`Node not found: ${nodeName}`)
  } catch (e) {
    error.value = e.message
  }
}

const refresh = usePageRefresh(load)
const { notice: actionNotice, error: actionError, acting, run } = useAction(refresh)

function isNoop(action) {
  const current = String(info.value?.state || '').toLowerCase()
  if (action.state === 'RESUME') {
    return !/drain|down|fail/.test(current)
  }
  return current.includes(action.state.toLowerCase())
}

function applyState(action) {
  menuOpen.value = false
  if (isNoop(action) || !window.confirm(`${action.label} ${nodeName}?`)) return
  return run(action.state, () => request('slurm:update_node', { nodeName, state: action.state }), `${nodeName} state set to ${action.state}`)
}

onMounted(refresh)
</script>

<template>
  <div>
    <UiAlert v-if="error" class="mb-4">Query failed: {{ error }}</UiAlert>

    <template v-if="info">
      <UiCard class="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <UiButton class="shrink-0" @click="navigateTo(`/console/${route.params.id}/nodes`)">← Back to nodes</UiButton>
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <h3 class="truncate text-sm font-medium text-white">{{ info.name }}</h3>
          <UiTag tone="default">{{ fmt(info.partitions) }}</UiTag>
        </div>

        <div v-if="isRoot" ref="menuRef" class="relative">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-orbit-line/60
                   px-2.5 py-1 text-xs transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            :class="stateClass(info.state)"
            :disabled="!!acting"
            title="Change node state"
            @click="menuOpen = !menuOpen"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-current" />
            {{ acting ? 'Working…' : fmt(info.state) }}
            <span class="text-[10px] text-orbit-muted">▾</span>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-orbit-line
                   bg-orbit-elevated p-1 shadow-xl"
          >
            <button
              v-for="action in NODE_ACTIONS"
              :key="action.state"
              type="button"
              class="block w-full cursor-pointer rounded-lg px-3 py-2 text-left transition
                     hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!!acting || isNoop(action)"
              @click="applyState(action)"
            >
              <span class="block text-xs font-medium text-orbit-text">{{ action.label }}</span>
              <span class="mt-0.5 block text-[11px] text-orbit-muted">{{ action.hint }}</span>
            </button>
          </div>
        </div>
        <span v-else class="inline-flex items-center gap-1.5 text-xs" :class="stateClass(info.state)">
          <span class="h-1.5 w-1.5 rounded-full bg-current" />
          {{ fmt(info.state) }}
        </span>
      </UiCard>

      <UiCard class="mt-3">
        <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
          <h3 class="text-sm font-medium text-white">Resources</h3>
          <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Usage</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3">
          <div class="px-5 py-4">
            <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">CPU</span>
            <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
              {{ cpu.pct }}<span class="text-base font-normal text-orbit-muted">%</span>
            </p>
            <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <span class="block h-full bg-white/80" :style="{ width: `${cpu.pct}%` }" />
            </div>
            <p class="mt-2.5 text-xs text-orbit-muted tabular-nums">
              {{ cpu.used }} / {{ cpu.total }} cores · {{ cpu.idle }} idle · load {{ fmtLoad(info.cpuLoad) }}
            </p>
          </div>

          <div class="border-t border-orbit-line/60 px-5 py-4 sm:border-l sm:border-t-0">
            <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Memory</span>
            <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
              {{ memory.pct == null ? '—' : memory.pct }}<span v-if="memory.pct != null" class="text-base font-normal text-orbit-muted">%</span>
            </p>
            <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <span class="block h-full bg-white/80" :style="{ width: `${memory.pct ?? 0}%` }" />
            </div>
            <p class="mt-2.5 text-xs text-orbit-muted tabular-nums">
              {{ memory.used == null ? '—' : fmtSize(memory.used) }} / {{ fmtSize(memory.total) }}
              <template v-if="memory.free != null"> · {{ fmtSize(memory.free) }} free</template>
            </p>
          </div>

          <div class="border-t border-orbit-line/60 px-5 py-4 sm:border-l sm:border-t-0">
            <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Disk</span>
            <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">{{ fmtSize(info.disk) }}</p>
            <p class="mt-5 text-xs text-orbit-muted">Temporary storage per node</p>
          </div>
        </div>

        <div v-if="actionNotice || actionError" class="border-t border-orbit-line/60 px-5 py-3 text-xs">
          <span v-if="actionNotice" class="text-orbit-ok">{{ actionNotice }}</span>
          <span v-else class="text-orbit-danger">{{ actionError }}</span>
        </div>
      </UiCard>

      <UiCard class="mt-3">
        <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
          <h3 class="text-sm font-medium text-white">System</h3>
          <span class="block text-[11px] uppercase tracking-wider text-orbit-muted">Node</span>
        </div>
        <dl class="grid grid-cols-1 sm:grid-cols-2">
          <div v-for="(fact, i) in facts" :key="fact.label" :class="cellClass(i)">
            <dt class="block text-[11px] uppercase tracking-wider text-orbit-muted">{{ fact.label }}</dt>
            <dd class="mt-1 break-all text-sm text-white">{{ fact.value }}</dd>
          </div>
        </dl>
      </UiCard>
    </template>
  </div>
</template>
