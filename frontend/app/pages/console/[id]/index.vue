<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '详情' })

const route = useRoute()
const { slurm, backends, selected } = useSocket()

const loading = ref(false)
const error = ref('')
const cluster = ref(null)
const version = ref(null)
const updatedAt = ref(null)

// 与布局一致：优先网关推送的最新 meta，离线时退回会话快照
const backend = computed(
  () => backends.value.find((b) => b.id === route.params.id) || selected.value
)

const backendCards = computed(() => {
  const b = backend.value
  if (!b) return []
  return [
    { label: '主机名', value: fmt(b.hostname) },
    { label: '运行用户', value: fmt(b.username), sub: b.isRoot ? 'root 权限' : '普通用户' },
    { label: '后端版本', value: fmt(b.version) },
    { label: 'Node 版本', value: fmt(b.node) }
  ]
})

function summarize(parts, jobs) {
  const nodeState = new Map()
  for (const p of parts || []) {
    const st = String(p.state ?? '').toLowerCase()
    for (const n of p.nodes || []) nodeState.set(n, st)
  }
  const nodes = { total: nodeState.size, idle: 0, alloc: 0, down: 0 }
  for (const st of nodeState.values()) {
    if (st.includes('down') || st.includes('drain') || st.includes('fail')) nodes.down++
    else if (st.includes('idle')) nodes.idle++
    else if (st.includes('alloc') || st.includes('mix')) nodes.alloc++
  }
  const list = jobs || []
  const has = (j, s) => jobStatus(j.status).toUpperCase().includes(s)
  return {
    partitions: (parts || []).length,
    nodes,
    jobs: {
      total: list.length,
      running: list.filter((j) => has(j, 'RUNNING')).length,
      pending: list.filter((j) => has(j, 'PENDING')).length
    }
  }
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const [parts, jobs, ver] = await Promise.all([
      slurm.listCluster(),
      slurm.listQueue(),
      slurm.version().catch(() => null)
    ])
    cluster.value = summarize(parts, jobs)
    version.value = ver
    updatedAt.value = new Date()
  } catch (e) {
    error.value = e.message
    cluster.value = null
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <div class="mt-6 max-w-6xl">
    <UiToolbar :loading="loading" :updated-at="updatedAt" @refresh="refresh" />

    <UiAlert v-if="error">查询失败：{{ error }}</UiAlert>

    <div v-else-if="cluster" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="orbit-card px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ version || '—' }}</p>
        <p class="orbit-label mt-1">Slurm 版本</p>
      </div>
      <div class="orbit-card px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.partitions }}</p>
        <p class="orbit-label mt-1">分区</p>
      </div>
      <div class="orbit-card px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.nodes.total }}</p>
        <p class="orbit-label mt-1">节点</p>
        <p class="mt-1.5 text-xs">
          <span class="text-orbit-ok">{{ cluster.nodes.idle }} 空闲</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-warn">{{ cluster.nodes.alloc }} 分配</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-danger">{{ cluster.nodes.down }} 故障</span>
        </p>
      </div>
      <div class="orbit-card px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.jobs.total }}</p>
        <p class="orbit-label mt-1">作业</p>
        <p class="mt-1.5 text-xs">
          <span class="text-orbit-ok">{{ cluster.jobs.running }} 运行中</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-warn">{{ cluster.jobs.pending }} 排队</span>
        </p>
      </div>
    </div>

    <template v-if="backendCards.length">
      <h3 class="orbit-label mb-3 mt-6">后端</h3>
      <UiFieldGrid :fields="backendCards" cols="sm:grid-cols-2 lg:grid-cols-4" />
    </template>
  </div>
</template>
