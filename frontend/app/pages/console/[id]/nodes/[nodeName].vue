<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '节点详情' })

const route = useRoute()

const NODE_ACTIONS = [
  { state: 'RESUME', label: '恢复', hint: '清除排空或下线状态，重新接受作业' },
  { state: 'DRAIN', label: '排空', hint: '不再分配新作业，正在运行的作业继续执行' },
  { state: 'DOWN', label: '下线', hint: '立即停止调度该节点，通常用于节点故障' }
]

const nodeName = String(route.params.nodeName)
// 同一份后端详情由 console 布局拉取后注入
const backend = inject('consoleBackend')
const admin = computed(() => !!backend?.value?.isRoot)

const loading = ref(false)
const error = ref('')
const info = ref(null)
const updatedAt = ref(null)

const { notice: actionNotice, error: actionError, acting, run } = useAction(refresh)
const menuOpen = ref(false)
const menuRef = ref(null)

const clampPct = (n) => Math.min(100, Math.max(0, n))

const cpuPct = computed(() => {
  const n = info.value
  return n?.effectiveCpus ? clampPct(Math.round((n.allocCpus / n.effectiveCpus) * 100)) : 0
})

const memPct = computed(() => {
  const n = info.value
  if (!n?.realMemory || n.freeMem == null) return null
  return clampPct(Math.round(((n.realMemory - n.freeMem) / n.realMemory) * 100))
})

const memUsed = computed(() => {
  const n = info.value
  return n?.freeMem == null ? '—' : fmtSize(n.realMemory - n.freeMem)
})

const cards = computed(() => {
  const n = info.value
  if (!n) return []
  return [
    { label: '临时磁盘', value: fmtSize(n.disk) },
    { label: 'GRES 总量', value: fmt(n.gres) },
    { label: 'GRES 已用', value: fmt(n.gresUsed) },
    { label: '架构', value: fmt(n.architecture) },
    { label: '操作系统', value: fmt(n.os) },
    { label: '启动时间', value: fmtDate(n.bootTime) },
    { label: '地址', value: fmt(n.address) }
  ]
})

async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const nodes = await request('slurm:list_nodes')
    info.value = nodes.find((n) => n.name === nodeName) || null
    if (!info.value) error.value = `未找到节点 ${nodeName}`
    updatedAt.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function isNoop(action) {
  const current = String(info.value?.state || '').toLowerCase()
  if (action.state === 'RESUME') {
    return !/drain|down|fail/.test(current)
  }
  return current.includes(action.state.toLowerCase())
}

function applyState(action) {
  menuOpen.value = false
  if (isNoop(action) || !window.confirm(`确定要${action.label} ${nodeName}？`)) return
  return run(action.state, () => request('slurm:update_node', { nodeName, state: action.state }), `已${action.label} ${nodeName}`)
}

function closeMenu(event) {
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(event.target)) menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
  refresh()
})

onBeforeUnmount(() => document.removeEventListener('click', closeMenu))
</script>

<template>
  <div class="mt-6 max-w-6xl">
    <UiToolbar :loading="loading" :updated-at="updatedAt" @refresh="refresh">
      <UiButton @click="navigateTo(`/console/${route.params.id}/nodes`)">← 返回节点</UiButton>
    </UiToolbar>

    <UiAlert v-if="error">查询失败：{{ error }}</UiAlert>

    <template v-if="info">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="min-w-0 truncate text-lg font-semibold text-white">{{ info.name }}</h3>

        <div v-if="admin" ref="menuRef" class="relative">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-orbit-line/60 px-2.5 py-0.5
                   text-xs transition hover:bg-white/5 disabled:opacity-60"
            :class="stateClass(info.state)"
            :disabled="!!acting"
            title="更改节点状态"
            @click="menuOpen = !menuOpen"
          >
            {{ acting ? '处理中…' : fmt(info.state) }}
            <span class="text-[10px] text-orbit-muted">▾</span>
          </button>
          <div
            v-if="menuOpen"
            class="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-orbit-line
                   bg-orbit-elevated p-1 shadow-xl"
          >
            <button
              v-for="action in NODE_ACTIONS"
              :key="action.state"
              type="button"
              class="block w-full rounded-lg px-3 py-2 text-left transition
                     hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!!acting || isNoop(action)"
              @click="applyState(action)"
            >
              <span class="block text-xs font-medium text-orbit-text">{{ action.label }}</span>
              <span class="mt-0.5 block text-[11px] text-orbit-muted">{{ action.hint }}</span>
            </button>
          </div>
        </div>
        <span v-else class="text-xs" :class="stateClass(info.state)">{{ fmt(info.state) }}</span>

        <span class="rounded-full border border-orbit-line px-2 py-0.5 text-[10px] text-orbit-muted">
          {{ fmt(info.partitions) }}
        </span>
      </div>

      <p v-if="actionNotice" class="mt-2 text-xs text-orbit-ok">{{ actionNotice }}</p>
      <p v-if="actionError" class="mt-2 text-xs text-orbit-danger">{{ actionError }}</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <UiGauge
          :percent="cpuPct"
          label="CPU"
          :sub="`${info.allocCpus} / ${info.effectiveCpus} 已分配 · 空闲 ${info.idleCpus} · 负载 ${fmtLoad(info.cpuLoad)}`"
        />
        <UiGauge
          :percent="memPct"
          label="内存"
          :sub="`${memUsed} / ${fmtSize(info.realMemory)} · 空闲 ${fmtSize(info.freeMem)}`"
        />
      </div>

      <UiFieldGrid class="mt-4" :fields="cards" />
    </template>
  </div>
</template>
