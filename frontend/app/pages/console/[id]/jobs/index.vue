<script setup>
import {
  columnFilteringFeature,
  createFilteredRowModel,
  filterFn_includesString,
  tableFeatures,
  useTable
} from '@tanstack/vue-table'

definePageMeta({ middleware: 'console-auth', layout: 'console', title: '作业' })

const route = useRoute()
const { slurm } = useSocket()

const backendId = route.params.id
const tab = ref(route.query.tab === 'history' ? 'history' : 'queue')
const rows = ref([])
const loading = ref(false)
const error = ref('')
const updatedAt = ref(null)
const notice = ref('')
const acting = ref('')

// TanStack Table v9 负责数据管线（行模型 + 状态筛选），模板仍按原样渲染
const features = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString }
})

const columnFilters = ref([])

const table = useTable({
  features,
  columns: [{ id: 'status', accessorFn: (j) => jobStatus(j.status), filterFn: 'includesString' }],
  data: rows,
  state: computed(() => ({ columnFilters: columnFilters.value })),
  onColumnFiltersChange: (updater) => {
    columnFilters.value = typeof updater === 'function' ? updater(columnFilters.value) : updater
  }
})

const tableRows = computed(() => table.getRowModel().rows.map((r) => r.original))

const statusFilter = computed({
  get: () => columnFilters.value.find((f) => f.id === 'status')?.value ?? '',
  set: (v) => {
    columnFilters.value = v ? [{ id: 'status', value: v }] : []
  }
})

const statusCounts = computed(() => {
  const counts = new Map()
  for (const j of rows.value) {
    const s = jobStatus(j.status)
    counts.set(s, (counts.get(s) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

// sacct 会把作业步骤（batch/extern 等）作为独立记录返回且 jobId 相同，去重保留首条主记录
function dedupeByJobId(list) {
  const seen = new Set()
  return list.filter((j) => {
    const key = String(j.jobId)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function openJob(row) {
  const query = tab.value === 'history' ? '?tab=history' : ''
  return navigateTo(`/console/${backendId}/jobs/${row.jobId}${query}`)
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const data = tab.value === 'queue'
      ? await slurm.listQueue()
      : await slurm.listHistory()
    rows.value = dedupeByJobId(data)
    updatedAt.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  rows.value = []
  notice.value = ''
  columnFilters.value = []
  refresh()
}

async function runAction(key, call, okMsg) {
  if (acting.value) return
  acting.value = key
  error.value = ''
  notice.value = ''
  try {
    await call()
    notice.value = okMsg
    await refresh()
  } catch (e) {
    error.value = e.message
  } finally {
    acting.value = ''
  }
}

function holdJob(row) {
  return runAction(`hold:${row.jobId}`, () => slurm.holdJob(row.jobId), `已挂起作业 #${row.jobId}`)
}

function releaseJob(row) {
  return runAction(`release:${row.jobId}`, () => slurm.releaseJob(row.jobId), `已释放作业 #${row.jobId}`)
}

function cancelJob(row) {
  if (!window.confirm(`确定取消作业 #${row.jobId}（${row.name || '未命名'}）？`)) return
  return runAction(`cancel:${row.jobId}`, () => slurm.cancelJob(row.jobId), `已取消作业 #${row.jobId}`)
}

onMounted(refresh)
</script>

<template>
  <div class="mt-6">
    <UiToolbar :loading="loading" :updated-at="updatedAt" @refresh="refresh">
      <div class="orbit-card flex rounded-xl p-1">
        <button
          v-for="item in [{ id: 'queue', label: '队列' }, { id: 'history', label: '历史' }]"
          :key="item.id"
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm transition"
          :class="tab === item.id ? 'bg-white/10 text-white' : 'text-orbit-muted hover:text-white'"
          @click="switchTab(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </UiToolbar>

    <!-- 状态筛选标签 -->
    <div v-if="statusCounts.length" class="orbit-card mb-4 flex flex-wrap gap-1 rounded-xl p-1">
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-xs transition"
        :class="!statusFilter ? 'bg-white/10 text-white' : 'text-orbit-muted hover:text-white'"
        @click="statusFilter = ''"
      >
        全部 {{ rows.length }}
      </button>
      <button
        v-for="[s, count] in statusCounts"
        :key="s"
        type="button"
        class="rounded-lg px-3 py-1.5 text-xs transition"
        :class="statusFilter === s ? 'bg-white/10' : 'hover:bg-white/5'"
        @click="statusFilter = statusFilter === s ? '' : s"
      >
        <span :class="jobStateClass(s)">{{ s }}</span>
        <span class="ml-1" :class="statusFilter === s ? 'text-white' : 'text-orbit-muted'">{{ count }}</span>
      </button>
    </div>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <!-- 队列表格 -->
    <div v-if="tab === 'queue'" class="orbit-card overflow-x-auto">
      <table class="w-full min-w-[600px] table-fixed text-left text-sm">
        <thead>
          <tr class="border-b border-orbit-line text-[11px] uppercase tracking-wider text-orbit-muted">
            <th class="w-16 px-3 py-3 font-medium">ID</th>
            <th class="w-[15%] px-3 py-3 font-medium">名称</th>
            <th class="hidden w-20 px-3 py-3 font-medium xl:table-cell">用户</th>
            <th class="hidden w-24 px-3 py-3 font-medium 2xl:table-cell">账户</th>
            <th class="w-24 px-3 py-3 font-medium">分区</th>
            <th class="w-24 px-3 py-3 font-medium">状态</th>
            <th class="hidden w-16 px-3 py-3 font-medium 2xl:table-cell">CPU</th>
            <th class="hidden w-20 px-3 py-3 font-medium 2xl:table-cell">内存/节点</th>
            <th class="hidden w-28 px-3 py-3 font-medium 2xl:table-cell">GRES</th>
            <th class="hidden w-20 px-3 py-3 font-medium 2xl:table-cell">时限</th>
            <th class="w-20 px-3 py-3 font-medium">已运行</th>
            <th class="w-44 px-3 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in tableRows"
            :key="i"
            class="cursor-pointer border-b border-orbit-line/50 last:border-0 hover:bg-white/5"
            @click="openJob(row)"
          >
            <td class="truncate px-3 py-3 font-medium text-white">{{ fmt(row.jobId) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted" :title="fmt(row.name)">{{ fmt(row.name) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted xl:table-cell">{{ fmt(row.user) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmt(row.account) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted">{{ fmt(row.partition) }}</td>
            <td class="truncate px-3 py-3" :class="jobStateClass(row.status)">{{ fmt(jobStatus(row.status)) }}</td>
            <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmt(row.cpus) }}</td>
            <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtSize(row.memory) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted 2xl:table-cell" :title="fmt(row.gres)">
              {{ fmt(row.gres) }}
            </td>
            <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtLimit(row.timeLimit) }}</td>
            <td class="px-3 py-3 text-orbit-muted">{{ jobElapsed(row) }}</td>
            <td class="px-3 py-3">
              <JobActions
                :job="row"
                :acting="acting"
                @hold="holdJob"
                @release="releaseJob"
                @cancel="cancelJob"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <UiEmpty v-if="!tableRows.length && !loading" class="px-4">
        {{ rows.length ? '没有匹配该状态的作业' : '队列中没有作业' }}
      </UiEmpty>
    </div>

    <!-- 历史表格 -->
    <div v-else class="orbit-card overflow-x-auto">
      <table class="w-full min-w-[560px] table-fixed text-left text-sm">
        <thead>
          <tr class="border-b border-orbit-line text-[11px] uppercase tracking-wider text-orbit-muted">
            <th class="w-16 px-3 py-3 font-medium">ID</th>
            <th class="w-[15%] px-3 py-3 font-medium">名称</th>
            <th class="hidden w-20 px-3 py-3 font-medium xl:table-cell">用户</th>
            <th class="hidden w-24 px-3 py-3 font-medium 2xl:table-cell">账户</th>
            <th class="w-24 px-3 py-3 font-medium">分区</th>
            <th class="w-24 px-3 py-3 font-medium">状态</th>
            <th class="w-20 px-3 py-3 font-medium">退出码</th>
            <th class="w-20 px-3 py-3 font-medium">已运行</th>
            <th class="hidden w-36 px-3 py-3 font-medium xl:table-cell">提交时间</th>
            <th class="hidden w-36 px-3 py-3 font-medium 2xl:table-cell">开始时间</th>
            <th class="hidden w-36 px-3 py-3 font-medium 2xl:table-cell">结束时间</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in tableRows"
            :key="i"
            class="cursor-pointer border-b border-orbit-line/50 last:border-0 hover:bg-white/5"
            @click="openJob(row)"
          >
            <td class="truncate px-3 py-3 font-medium text-white">{{ fmt(row.jobId) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted" :title="fmt(row.name)">{{ fmt(row.name) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted xl:table-cell">{{ fmt(row.user) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmt(row.account) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted">{{ fmt(row.partition) }}</td>
            <td class="truncate px-3 py-3" :class="jobStateClass(row.status)">{{ fmt(jobStatus(row.status)) }}</td>
            <td class="px-3 py-3 text-orbit-muted">{{ fmt(row.exitCode) }}</td>
            <td class="px-3 py-3 text-orbit-muted">{{ jobElapsed(row) }}</td>
            <td class="hidden px-3 py-3 text-orbit-muted xl:table-cell">{{ fmtDate(row.submitTime) }}</td>
            <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtDate(row.startTime) }}</td>
            <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtDate(row.endTime) }}</td>
          </tr>
        </tbody>
      </table>
      <UiEmpty v-if="!tableRows.length && !loading" class="px-4">
        {{ rows.length ? '没有匹配该状态的作业' : '暂无历史作业' }}
      </UiEmpty>
    </div>
  </div>
</template>
