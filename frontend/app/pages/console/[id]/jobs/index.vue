<script setup>
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
          class="rounded-lg px-4 py-1.5 text-sm transition"
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
        class="rounded-lg px-3 py-1.5 text-xs transition"
        :class="!statusFilter ? 'bg-white/10 text-white' : 'text-orbit-muted hover:text-white'"
        @click="statusFilter = ''"
      >
        All {{ rows.length }}
      </button>
      <button
        v-for="[s, count] in statusCounts"
        :key="s"
        type="button"
        class="rounded-lg px-3 py-1.5 text-xs transition"
        :class="statusFilter === s ? 'bg-white/10' : 'hover:bg-white/5'"
        @click="statusFilter = statusFilter === s ? '' : s"
      >
        <span :class="stateClass(s)">{{ s }}</span>
        <span class="ml-1" :class="statusFilter === s ? 'text-white' : 'text-orbit-muted'">{{ count }}</span>
      </button>
    </UiCard>

    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <!-- Queue / history table -->
    <UiCard class="overflow-x-auto">
      <table class="w-full min-w-[600px] table-fixed text-left text-sm">
        <thead>
          <tr class="border-b border-orbit-line text-[11px] uppercase tracking-wider text-orbit-muted">
            <th class="w-16 px-3 py-3 font-medium">ID</th>
            <th class="w-[15%] px-3 py-3 font-medium">Name</th>
            <th class="hidden w-20 px-3 py-3 font-medium xl:table-cell">User</th>
            <th class="hidden w-24 px-3 py-3 font-medium 2xl:table-cell">Account</th>
            <th class="w-24 px-3 py-3 font-medium">Partition</th>
            <th class="w-24 px-3 py-3 font-medium">State</th>
            <template v-if="tab === 'history'">
              <th class="w-20 px-3 py-3 font-medium">Exit code</th>
              <th class="w-20 px-3 py-3 font-medium">Elapsed</th>
              <th class="hidden w-36 px-3 py-3 font-medium xl:table-cell">Submitted</th>
              <th class="hidden w-36 px-3 py-3 font-medium 2xl:table-cell">Started</th>
              <th class="hidden w-36 px-3 py-3 font-medium 2xl:table-cell">Ended</th>
            </template>
            <template v-else>
              <th class="hidden w-16 px-3 py-3 font-medium 2xl:table-cell">CPU</th>
              <th class="hidden w-20 px-3 py-3 font-medium 2xl:table-cell">Mem/node</th>
              <th class="hidden w-28 px-3 py-3 font-medium 2xl:table-cell">GRES</th>
              <th class="hidden w-20 px-3 py-3 font-medium 2xl:table-cell">Time limit</th>
              <th class="w-20 px-3 py-3 font-medium">Elapsed</th>
              <th class="w-44 px-3 py-3 font-medium">Actions</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredRows"
            :key="row.jobId"
            class="cursor-pointer border-b border-orbit-line/50 last:border-0 hover:bg-white/5"
            @click="openJob(row)"
          >
            <td class="truncate px-3 py-3 font-medium text-white">{{ fmt(row.jobId) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted" :title="fmt(row.name)">{{ fmt(row.name) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted xl:table-cell">{{ fmt(row.user) }}</td>
            <td class="hidden truncate px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmt(row.account) }}</td>
            <td class="truncate px-3 py-3 text-orbit-muted">{{ fmt(row.partition) }}</td>
            <td class="truncate px-3 py-3" :class="stateClass(row.status)">{{ jobStateLabel(row) }}</td>
            <template v-if="tab === 'history'">
              <td class="px-3 py-3 text-orbit-muted">{{ fmt(row.exitCode) }}</td>
              <td class="px-3 py-3 text-orbit-muted">{{ jobElapsed(row) }}</td>
              <td class="hidden px-3 py-3 text-orbit-muted xl:table-cell">{{ fmtDate(row.submitTime) }}</td>
              <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtDate(row.startTime) }}</td>
              <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtDate(row.endTime) }}</td>
            </template>
            <template v-else>
              <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmt(row.cpus) }}</td>
              <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtSize(row.memory) }}</td>
              <td class="hidden truncate px-3 py-3 text-orbit-muted 2xl:table-cell" :title="fmt(row.gres)">
                {{ fmt(row.gres) }}
              </td>
              <td class="hidden px-3 py-3 text-orbit-muted 2xl:table-cell">{{ fmtLimit(row.timeLimit) }}</td>
              <td class="px-3 py-3 text-orbit-muted">{{ jobElapsed(row) }}</td>
              <td class="px-3 py-3">
                <div class="flex flex-wrap items-center gap-1.5">
                  <template v-if="isJobPending(row)">
                    <UiChip v-if="!isJobHeld(row)" tone="warn" :disabled="!!acting" @click.stop="holdJob(row)">Hold</UiChip>
                    <UiChip v-else tone="ok" :disabled="!!acting" @click.stop="releaseJob(row)">Release</UiChip>
                  </template>
                  <UiChip tone="danger" :disabled="!!acting" @click.stop="cancelJob(row)">Cancel</UiChip>
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
      <p v-if="!filteredRows.length" class="px-4 py-8 text-center text-sm text-orbit-muted">
        {{ rows.length ? 'No jobs match this state' : tab === 'queue' ? 'Queue is empty' : 'No job history' }}
      </p>
    </UiCard>
  </div>
</template>
