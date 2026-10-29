<script setup lang="jsx">
import Chip from '~/components/ui/Chip.vue'
definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'Jobs' })

const route = useRoute()

const backendId = route.params.id
const tab = ref(route.query.tab === 'history' ? 'history' : 'queue')
const queueRows = ref([])
const historyRows = ref([])
const statusFilter = ref('')

const rows = computed(() => (tab.value === 'queue' ? queueRows.value : historyRows.value))

const filteredRows = computed(() => {
  if (!statusFilter.value) return rows.value
  return rows.value.filter((j) => jobStatus(j.status) === statusFilter.value)
})

const statusCounts = computed(() =>
  Object.entries(Object.groupBy(rows.value, (j) => jobStatus(j.status)))
    .map(([status, list]) => [status, list.length])
    .sort(([a], [b]) => a.localeCompare(b))
)

// Name has no width so it alone absorbs the leftover space. Every other column keeps a fixed
// px width shared by both tabs, and both tabs add up to the same fixed total at each breakpoint
// (496 at base, 576 at xl, 1104 at 2xl), so the table keeps one geometry and switching tabs
// never resizes it or shifts a column.
const sharedHeaders = ['ID', 'Name', 'User', 'Account', 'Partition', 'State']
const sharedWidths = ['w-16', '', 'hidden w-20 xl:table-cell', 'hidden w-24 2xl:table-cell', 'w-24', 'w-24']
const headers = computed(() => sharedHeaders.concat(tab.value === 'history'
  ? ['Exit code', 'Elapsed', 'Submitted', 'Started', 'Ended']
  : ['CPU', 'Mem/node', 'GRES', 'Time limit', 'Elapsed', 'Actions']))
const widths = computed(() => sharedWidths.concat(tab.value === 'history'
  ? ['w-40', 'w-20', 'hidden w-36 2xl:table-cell', 'hidden w-36 2xl:table-cell', 'hidden w-36 2xl:table-cell']
  : ['hidden w-16 2xl:table-cell', 'hidden w-24 2xl:table-cell', 'hidden w-36 2xl:table-cell', 'hidden w-32 2xl:table-cell', 'w-20', 'w-40']))

// sacct returns job steps (batch/extern/...) as separate rows sharing the jobId; keep the first
const dedupeByJobId = (list) => {
  const seen = new Set()
  return list.filter(({ jobId }) => !seen.has(String(jobId)) && seen.add(String(jobId)))
}

function openJob(row) {
  return navigateTo(`/console/${backendId}/jobs/${row.jobId}${tab.value === 'history' ? '?tab=history' : ''}`)
}

async function load() {
  error.value = ''
  try {
    const [queue, history] = await Promise.all([
      request('slurm:list_queue'),
      request('slurm:list_history')
    ])
    queueRows.value = dedupeByJobId(queue)
    historyRows.value = dedupeByJobId(history)
  } catch (e) {
    error.value = e.message
  }
}

const refresh = usePageRefresh(load)
const { error, notice, acting, run } = useAction(refresh)

function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  statusFilter.value = ''
  notice.value = ''
}

function holdJob(row) {
  return run(`hold:${row.jobId}`, () => request('slurm:hold_job', { jobId: row.jobId }), `Job #${row.jobId} held`)
}

function releaseJob(row) {
  return run(`release:${row.jobId}`, () => request('slurm:release_job', { jobId: row.jobId }), `Job #${row.jobId} released`)
}

function cancelJob(row) {
  if (!window.confirm(`Cancel job #${row.jobId} (${row.name || 'unnamed'})?`)) return
  return run(`cancel:${row.jobId}`, () => request('slurm:cancel_job', { jobId: row.jobId }), `Job #${row.jobId} cancelled`)
}

function jobCells(row) {
  const disabled = !!acting.value
  const pending = isJobPending(row)
  const cells = [
    <span class="block max-w-full truncate font-medium text-white">{fmt(row.jobId)}</span>,
    fmt(row.name),
    fmt(row.user),
    fmt(row.account),
    fmt(row.partition),
    <span class={['block max-w-full truncate', stateClass(row.status)]}>{jobStateLabel(row)}</span>
  ]
  if (tab.value === 'history') {
    cells.push(fmt(row.exitCode), jobElapsed(row), fmtDate(row.submitTime), fmtDate(row.startTime), fmtDate(row.endTime))
    return cells
  }
  cells.push(
    fmt(row.cpus),
    fmtSize(row.memory),
    fmt(row.gres),
    fmtLimit(row.timeLimit),
    jobElapsed(row),
    <div class="flex flex-wrap items-center gap-1.5">
      {pending && !row.hold && <Chip tone="warn" disabled={disabled} onClick={withModifiers(() => holdJob(row), ['stop'])}>Hold</Chip>}
      {pending && row.hold && <Chip tone="ok" disabled={disabled} onClick={withModifiers(() => releaseJob(row), ['stop'])}>Release</Chip>}
      <Chip tone="danger" disabled={disabled} onClick={withModifiers(() => cancelJob(row), ['stop'])}>Cancel</Chip>
    </div>
  )
  return cells
}

onMounted(refresh)
</script>
<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <UiCard rounded="xl" class="flex p-1">
        <button
          v-for="item in [{ id: 'queue', label: 'Queue' }, { id: 'history', label: 'History' }]"
          :key="item.id"
          type="button"
          class="cursor-pointer rounded-lg px-4 py-1.5 text-sm transition"
          :class="tab === item.id ? 'bg-white/10 text-white' : 'text-orbit-muted hover:text-white'"
          @click="switchTab(item.id)"
        >
          {{ item.label }}
        </button>
      </UiCard>
      <UiButton variant="accent" @click="navigateTo(`/console/${backendId}/jobs/new`)">
        New job
      </UiButton>
    </div>

    <!-- State filter -->
    <UiCard v-if="statusCounts.length" rounded="xl" class="mb-4 flex flex-wrap gap-1 p-1">
      <button
        type="button"
        class="cursor-pointer rounded-lg px-3 py-1.5 text-xs transition"
        :class="!statusFilter ? 'bg-white/10 text-white' : 'text-orbit-muted hover:text-white'"
        @click="statusFilter = ''"
      >
        All {{ rows.length }}
      </button>
      <button
        v-for="[s, count] in statusCounts"
        :key="s"
        type="button"
        class="cursor-pointer rounded-lg px-3 py-1.5 text-xs transition"
        :class="statusFilter === s ? 'bg-white/10' : 'hover:bg-white/5'"
        @click="statusFilter = statusFilter === s ? '' : s"
      >
        <span :class="stateClass(s)">{{ s }}</span>
        <span class="ml-1" :class="statusFilter === s ? 'text-white' : 'text-orbit-muted'">{{ count }}</span>
      </button>
    </UiCard>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <UiCard class="overflow-x-auto">
      <UiTable compact class="min-w-[672px]" :widths="widths" :headers="headers">
        <UiTableRow
          v-for="row in filteredRows"
          :key="row.jobId"
          class="cursor-pointer"
          :cells="jobCells(row)"
          @click="openJob(row)"
        />
      </UiTable>
      <p v-if="!filteredRows.length" class="px-4 py-8 text-center text-sm text-orbit-muted">
        {{ rows.length ? 'No jobs match this state' : tab === 'queue' ? 'Queue is empty' : 'No job history' }}
      </p>
    </UiCard>
  </div>
</template>
