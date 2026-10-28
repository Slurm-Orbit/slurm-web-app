<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '详情' })

const error = ref('')
const loaded = ref(false)
const partitions = ref([])
const queue = ref([])

// 同一份后端详情由 console 布局拉取后注入
const backend = inject('consoleBackend')
const { isRoot } = inject('consoleAuth')

// 同一节点可能出现在多个分区里，按名字去重后取最后一次的状态
const nodes = computed(() => {
  const status = {}
  for (const partition of partitions.value) {
    const s = String(partition.state ?? '').toLowerCase()
    let kind = 'other'
    if (/down|drain|fail|error/.test(s)) kind = 'down'
    else if (s.includes('idle')) kind = 'idle'
    else if (/alloc|mix/.test(s)) kind = 'alloc'
    for (const name of partition.nodes ?? []) status[name] = kind
  }

  const counts = { total: Object.keys(status).length, idle: 0, alloc: 0, down: 0 }
  for (const kind of Object.values(status)) {
    if (kind !== 'other') counts[kind]++
  }
  return counts
})

const jobs = computed(() => {
  const counts = { total: queue.value.length, running: 0, pending: 0 }
  for (const job of queue.value) {
    const s = jobStatus(job.status).toUpperCase()
    if (s.includes('RUNNING')) counts.running++
    else if (s.includes('PENDING')) counts.pending++
  }
  return counts
})

async function load() {
  error.value = ''
  try {
    partitions.value = await request('slurm:list_cluster')
    queue.value = await request('slurm:list_queue')
    loaded.value = true
  } catch (e) {
    error.value = e.message
  }
}

const refresh = usePageRefresh(load)

onMounted(refresh)
</script>

<template>
  <div class="max-w-6xl">
    <UiAlert v-if="error" class="mb-4">查询失败：{{ error }}</UiAlert>

    <UiCard v-if="loaded">
      <div class="flex items-center justify-between gap-3 px-5 py-3.5">
        <div class="flex items-baseline gap-2">
          <h3 class="text-sm font-medium text-white">集群概览</h3>
          <span v-if="backend?.slurmVersion" class="text-xs text-orbit-muted">
            Slurm {{ backend.slurmVersion }}
          </span>
        </div>
        <UiLabel>Cluster</UiLabel>
      </div>

      <div class="grid grid-cols-1 border-t border-orbit-line/60 sm:grid-cols-3">
        <div class="px-5 py-4">
          <UiLabel>分区</UiLabel>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
            {{ partitions.length }}
          </p>
        </div>

        <div class="border-t border-orbit-line/60 px-5 py-4 sm:border-l sm:border-t-0">
          <UiLabel>节点</UiLabel>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
            {{ nodes.total }}
          </p>
          <div v-if="nodes.total" class="mt-3 flex h-1 overflow-hidden rounded-full bg-white/10">
            <span class="bg-white/80" :style="{ width: fmtPercent(nodes.idle, nodes.total) }" />
            <span class="bg-white/30" :style="{ width: fmtPercent(nodes.alloc, nodes.total) }" />
            <span class="bg-orbit-danger/70" :style="{ width: fmtPercent(nodes.down, nodes.total) }" />
          </div>
          <div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orbit-muted">
            <span class="inline-flex items-center gap-1.5">
              <i class="h-1.5 w-1.5 rounded-full bg-white/80" />
              <b class="font-medium text-white tabular-nums">{{ nodes.idle }}</b>空闲
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i class="h-1.5 w-1.5 rounded-full bg-white/30" />
              <b class="font-medium text-white tabular-nums">{{ nodes.alloc }}</b>分配
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i class="h-1.5 w-1.5 rounded-full bg-orbit-danger/70" />
              <b class="font-medium text-white tabular-nums">{{ nodes.down }}</b>故障
            </span>
          </div>
        </div>

        <div class="border-t border-orbit-line/60 px-5 py-4 sm:border-l sm:border-t-0">
          <UiLabel>作业</UiLabel>
          <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
            {{ jobs.total }}
          </p>
          <div v-if="jobs.total" class="mt-3 flex h-1 overflow-hidden rounded-full bg-white/10">
            <span class="bg-white/80" :style="{ width: fmtPercent(jobs.running, jobs.total) }" />
            <span class="bg-white/30" :style="{ width: fmtPercent(jobs.pending, jobs.total) }" />
          </div>
          <div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orbit-muted">
            <span class="inline-flex items-center gap-1.5">
              <i class="h-1.5 w-1.5 rounded-full bg-white/80" />
              <b class="font-medium text-white tabular-nums">{{ jobs.running }}</b>运行中
            </span>
            <span class="inline-flex items-center gap-1.5">
              <i class="h-1.5 w-1.5 rounded-full bg-white/30" />
              <b class="font-medium text-white tabular-nums">{{ jobs.pending }}</b>排队
            </span>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard v-if="backend" class="mt-3">
      <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
        <h3 class="text-sm font-medium text-white">后端</h3>
        <UiTag v-if="isRoot" tone="default">root</UiTag>
      </div>
      <dl class="grid grid-cols-1 sm:grid-cols-2">
        <div class="px-5 py-3.5">
          <UiLabel as="dt">主机名</UiLabel>
          <dd class="mt-1 break-all text-sm text-white">{{ fmt(backend.hostname) }}</dd>
        </div>
        <div class="border-t border-orbit-line/60 px-5 py-3.5 sm:border-l sm:border-t-0">
          <UiLabel as="dt">运行用户</UiLabel>
          <dd class="mt-1 break-all text-sm text-white">
            {{ fmt(backend.username) }}
            <span class="ml-1.5 text-xs text-orbit-muted">{{ isRoot ? 'root 权限' : '普通用户' }}</span>
          </dd>
        </div>
        <div class="border-t border-orbit-line/60 px-5 py-3.5">
          <UiLabel as="dt">后端版本</UiLabel>
          <dd class="mt-1 text-sm text-white tabular-nums">{{ fmt(backend.version) }}</dd>
        </div>
        <div class="border-t border-orbit-line/60 px-5 py-3.5 sm:border-l">
          <UiLabel as="dt">Node 版本</UiLabel>
          <dd class="mt-1 text-sm text-white tabular-nums">{{ fmt(backend.node) }}</dd>
        </div>
      </dl>
    </UiCard>
  </div>
</template>
