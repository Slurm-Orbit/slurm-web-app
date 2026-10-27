<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '详情' })

const route = useRoute()
const { slurm, backendMeta } = useSocket()

const loading = ref(false)
const error = ref('')
const cluster = ref(null)
const version = ref(null)
const updatedAt = ref(null)

const backend = computed(() => backendMeta(route.params.id))

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
  for (const p of parts) {
    const state = String(p.state ?? '').toLowerCase()
    for (const n of p.nodes || []) nodeState.set(n, state)
  }
  const nodes = { total: nodeState.size, idle: 0, alloc: 0, down: 0 }
  for (const st of nodeState.values()) {
    if (/down|drain|fail/.test(st)) nodes.down++
    else if (st.includes('idle')) nodes.idle++
    else if (/alloc|mix/.test(st)) nodes.alloc++
  }
  const count = (s) => jobs.filter((j) => jobStatus(j.status).toUpperCase().includes(s)).length
  return {
    partitions: parts.length,
    nodes,
    jobs: { total: jobs.length, running: count('RUNNING'), pending: count('PENDING') }
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
      <UiCard class="px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ version || '—' }}</p>
        <UiLabel class="mt-1">Slurm 版本</UiLabel>
      </UiCard>
      <UiCard class="px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.partitions }}</p>
        <UiLabel class="mt-1">分区</UiLabel>
      </UiCard>
      <UiCard class="px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.nodes.total }}</p>
        <UiLabel class="mt-1">节点</UiLabel>
        <p class="mt-1.5 text-xs">
          <span class="text-orbit-ok">{{ cluster.nodes.idle }} 空闲</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-warn">{{ cluster.nodes.alloc }} 分配</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-danger">{{ cluster.nodes.down }} 故障</span>
        </p>
      </UiCard>
      <UiCard class="px-5 py-4">
        <p class="text-2xl font-semibold tracking-tight text-white">{{ cluster.jobs.total }}</p>
        <UiLabel class="mt-1">作业</UiLabel>
        <p class="mt-1.5 text-xs">
          <span class="text-orbit-ok">{{ cluster.jobs.running }} 运行中</span>
          <span class="text-orbit-muted"> · </span>
          <span class="text-orbit-warn">{{ cluster.jobs.pending }} 排队</span>
        </p>
      </UiCard>
    </div>

    <template v-if="backendCards.length">
      <UiLabel as="h3" class="mb-3 mt-6">后端</UiLabel>
      <UiFieldGrid :fields="backendCards" cols="sm:grid-cols-2 lg:grid-cols-4" />
    </template>
  </div>
</template>
