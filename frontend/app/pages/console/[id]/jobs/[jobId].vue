<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'Job' })

const route = useRoute()

// sstat in Slurm 25 has no CPUTime field, so AveCPU (avg CPU time per task) is used to derive utilization.
// MaxRSS is kept because the peak memory card compares it against the requested memory.
const STAT_FIELDS = [
  'AveCPU', 'NTasks', 'AveRSS', 'MaxRSS', 'MaxVMSize', 'MaxDiskRead',
  'MaxDiskWrite', 'ConsumedEnergy', 'MaxPages', 'AveCPUFreq'
]
const HOLLOW = 'border-2 border-white/25 bg-transparent'

const job = ref(null)
const fromHistory = ref(false)
const stats = ref(null)
const statsError = ref('')
const outputs = ref({})

const ts = (value) => (value ? new Date(value).getTime() : NaN)
const running = computed(() => jobStatus(job.value?.status).toLowerCase().includes('running'))

// Lifecycle stepper: reached steps are filled, upcoming ones are hollow
const timeline = computed(() => {
  const j = job.value
  const submit = ts(j?.submitTime)
  if (!Number.isFinite(submit)) return { items: [], span: 0 }

  const start = ts(j.startTime)
  const end = ts(j.endTime)
  const hasStart = Number.isFinite(start)
  const hasEnd = Number.isFinite(end)
  const now = Date.now()

  const step = (label, at, dotClass) => ({ type: 'step', label, at: at ? fmtDate(at) : '', dotClass })
  const link = (label, value) => ({ type: 'link', label, value })

  const items = [step('Submitted', j.submitTime, 'bg-orbit-ok')]
  items.push(link(hasStart ? 'Queued' : 'Queueing', (hasStart ? start : now) - submit))
  items.push(step('Started', hasStart ? j.startTime : null, hasStart ? 'bg-orbit-ok' : HOLLOW))
  if (hasEnd) {
    const failed = /fail|cancel|timeout|oom/.test(jobStatus(j.status).toLowerCase())
    items.push(link('Ran', end - start))
    items.push(step('Ended', j.endTime, failed ? 'bg-orbit-danger' : 'bg-orbit-ok'))
  } else {
    items.push(hasStart ? link('Running', now - start) : link('', null))
    items.push(step('Ended', null, HOLLOW))
  }
  return { items, span: (hasEnd ? end : now) - submit }
})

// CPU utilization ≈ avg CPU time × tasks ÷ elapsed ÷ allocated cores
function cpuPctOf(s) {
  const ave = parseSlurmTime(s?.AveCPU)
  const start = ts(job.value?.startTime)
  const tasks = Number(s?.NTasks) || 1
  const cpus = Number(job.value?.cpus) || tasks
  if (ave == null || !Number.isFinite(start)) return null
  const elapsed = (Date.now() - start) / 1000
  if (elapsed <= 0) return null
  return Math.min(100, Math.round(((ave * tasks) / (elapsed * cpus)) * 1000) / 10)
}

const statsCpuPct = computed(() => (stats.value ? cpuPctOf(stats.value) : null))

// Total CPU time consumed = average CPU time per task × task count.
// Zero is a real reading (idle jobs use no CPU), so it is shown as 0s rather than a dash.
const statsCpuTime = computed(() => {
  const ave = parseSlurmTime(stats.value?.AveCPU)
  if (ave == null) return null
  const ms = ave * (Number(stats.value?.NTasks) || 1) * 1000
  return ms > 0 ? fmtDuration(ms) : '0s'
})

// Peak memory ratio = peak RSS ÷ requested memory per node
const statsMemPct = computed(() => {
  const peak = parseSlurmSize(stats.value?.MaxRSS)
  const limit = Number(job.value?.memory)
  if (peak == null || !limit) return null
  return Math.min(100, Math.round((peak / limit) * 1000) / 10)
})

// Allocation summary shown under the CPU bar: "1 task · 2 cores"
const allocation = computed(() => {
  const s = stats.value
  if (!s) return ''
  return `${fmt(s.NTasks)} task${Number(s.NTasks) === 1 ? '' : 's'} · ${fmt(job.value?.cpus)} cores`
})

const statCards = computed(() => {
  const s = stats.value
  if (!s) return []
  const energy = Number(s.ConsumedEnergy)
  return [
    { label: 'CPU time', value: statsCpuTime.value ?? '—' },
    { label: 'Avg RSS', value: fmtSlurmSize(s.AveRSS) },
    { label: 'Peak VM size', value: fmtSlurmSize(s.MaxVMSize) },
    { label: 'Disk read', value: fmtBytes(s.MaxDiskRead) },
    { label: 'Disk write', value: fmtBytes(s.MaxDiskWrite) },
    { label: 'Energy', value: energy > 0 ? `${energy} J` : '—' },
    { label: 'Max pages', value: fmt(s.MaxPages) },
    { label: 'Avg CPU freq', value: fmtCpuFreq(s.AveCPUFreq) }
  ]
})

const fieldGroups = computed(() => {
  const j = job.value
  if (!j) return []
  const base = {
    title: 'Basic info',
    fields: [
      { label: 'User', value: fmt(j.user) },
      { label: 'Account', value: fmt(j.account) },
      { label: 'Cluster', value: fmt(j.cluster) },
      { label: 'Partition', value: fmt(j.partition) },
      { label: 'Nodes', value: fmt(j.nodes) }
    ]
  }
  if (fromHistory.value) {
    return [base, {
      title: 'Result',
      fields: [
        { label: 'Exit code', value: fmt(j.exitCode) },
        { label: 'Work dir', value: fmt(j.workDir) },
        { label: 'CPU', value: fmt(j.cpus) },
        { label: 'Mem/node', value: fmtSize(j.memory) },
        { label: 'Time limit', value: fmtLimit(j.timeLimit) }
      ]
    }]
  }
  return [base, {
    title: 'Resources',
    fields: [
      { label: 'CPU', value: fmt(j.cpus) },
      { label: 'Mem/node', value: fmtSize(j.memory) },
      { label: 'GRES', value: fmt(j.gres) },
      { label: 'Time limit', value: fmtLimit(j.timeLimit) }
    ]
  }]
})

const statCellClass = (i) => [
  'px-5 py-3.5',
  i > 0 && 'border-t border-orbit-line/60',
  i % 2 === 1 && 'sm:border-l',
  i % 4 === 1 && 'lg:border-l',
  i < 2 && 'sm:border-t-0',
  i < 4 && 'lg:border-t-0'
]

// Output viewer: job.stdout/stderr are already resolved paths from sacct, sent to the agent to read
const outputItems = computed(() => {
  const j = job.value
  if (!j) return []
  return [
    { kind: 'stdout', label: 'stdout', path: j.stdout },
    { kind: 'stderr', label: 'stderr', path: j.stderr }
  ].filter((item) => item.path)
})

async function viewOutput(item) {
  const kind = item.kind
  outputs.value[kind] = { loading: true }
  try {
    outputs.value[kind] = await request('slurm:job_output', { path: item.path })
  } catch (e) {
    outputs.value[kind] = { error: e.message }
  }
}

async function loadStats() {
  if (!running.value) return
  try {
    stats.value = await request('slurm:job_stat', { jobId: job.value.jobId, target: STAT_FIELDS })
    statsError.value = ''
  } catch (e) {
    statsError.value = e.message
  }
}

async function load() {
  error.value = ''
  try {
    await fetchJob()
    await loadStats()
  } catch (e) {
    error.value = e.message
  }
}

async function fetchJob() {
  const jobId = String(route.params.jobId)
  let found = (await request('slurm:list_queue')).find((j) => String(j.jobId) === jobId)
  fromHistory.value = !found
  if (!found) found = (await request('slurm:list_history')).find((j) => String(j.jobId) === jobId)
  if (!found) throw new Error(`Job #${jobId} not found`)
  job.value = found
}

const refresh = usePageRefresh(load)
const { error, notice, acting, run } = useAction(refresh)

function holdJob(j) {
  return run(`hold:${j.jobId}`, () => request('slurm:hold_job', { jobId: j.jobId }), `Job #${j.jobId} held`)
}

function releaseJob(j) {
  return run(`release:${j.jobId}`, () => request('slurm:release_job', { jobId: j.jobId }), `Job #${j.jobId} released`)
}

function cancelJob(j) {
  if (!window.confirm(`Cancel job #${j.jobId} (${j.name || 'unnamed'})?`)) return
  return run(`cancel:${j.jobId}`, () => request('slurm:cancel_job', { jobId: j.jobId }), `Job #${j.jobId} cancelled`)
}

function back() {
  return navigateTo(`/console/${route.params.id}/jobs${fromHistory.value ? '?tab=history' : ''}`)
}

onMounted(refresh)
</script>

<template>
  <p v-if="!job && !error" class="text-sm text-orbit-muted">Loading…</p>
  <UiAlert v-else-if="!job" class="max-w-3xl">Query failed: {{ error }}</UiAlert>

  <div v-else>
    <UiAlert v-if="notice" type="ok" class="mb-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mb-4">{{ error }}</UiAlert>

    <UiCard class="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <UiButton class="shrink-0" @click="back">← Back to jobs</UiButton>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 class="text-sm font-medium text-white">Job #{{ job.jobId }}</h3>
          <span class="inline-flex items-center gap-1.5 text-xs" :class="stateClass(job.status)">
            <span class="h-1.5 w-1.5 rounded-full bg-current" />
            {{ jobStateLabel(job) }}
          </span>
        </div>
        <p class="mt-0.5 truncate text-xs text-orbit-muted">
          {{ fmt(job.name) }} · {{ fmt(job.user) }}<template v-if="job.partition"> · {{ job.partition }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <template v-if="isJobPending(job)">
          <UiChip v-if="!isJobHeld(job)" tone="warn" :disabled="!!acting" @click="holdJob(job)">Hold</UiChip>
          <UiChip v-else tone="ok" :disabled="!!acting" @click="releaseJob(job)">Release</UiChip>
        </template>
        <UiChip tone="danger" :disabled="!!acting" @click="cancelJob(job)">Cancel</UiChip>
      </div>
    </UiCard>

    <UiCard v-if="timeline.items.length" class="mt-3">
      <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
        <h3 class="text-sm font-medium text-white">Lifecycle</h3>
        <p class="text-xs text-orbit-muted">
          Total <span class="font-medium text-white tabular-nums">{{ fmtDuration(timeline.span) }}</span>
        </p>
      </div>
      <div class="overflow-x-auto px-5 py-6">
        <div class="flex min-w-[430px] items-start px-2 pb-1 pt-5">
          <template v-for="(item, i) in timeline.items" :key="i">
            <div v-if="item.type === 'step'" class="flex w-24 shrink-0 flex-col items-center text-center">
              <span class="h-2.5 w-2.5 rounded-full" :class="item.dotClass" />
              <p class="mt-2 text-xs font-medium text-white">{{ item.label }}</p>
              <p v-if="item.at" class="mt-0.5 text-[11px] leading-tight text-orbit-muted">{{ item.at }}</p>
            </div>
            <div v-else class="relative mx-2 mt-[4px] min-w-14 flex-1">
              <div class="h-0.5 rounded-full bg-white/15" />
              <p v-if="item.label" class="absolute inset-x-0 -top-5 whitespace-nowrap text-center text-[11px]">
                <span class="text-orbit-muted">{{ item.label }}</span>
                <span class="ml-1 text-orbit-text tabular-nums">{{ fmtDuration(item.value) }}</span>
              </p>
            </div>
          </template>
        </div>
      </div>
    </UiCard>

    <template v-if="running">
      <UiCard class="mt-3">
        <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
          <h3 class="text-sm font-medium text-white">Live usage</h3>
          <UiLabel>Monitoring</UiLabel>
        </div>

        <UiAlert v-if="statsError">{{ statsError }}</UiAlert>

        <template v-else-if="stats">
          <div class="grid grid-cols-1 sm:grid-cols-2">
            <div class="px-5 py-4">
              <UiLabel>CPU utilization</UiLabel>
              <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
                {{ statsCpuPct == null ? '—' : statsCpuPct }}<span v-if="statsCpuPct != null" class="text-base font-normal text-orbit-muted">%</span>
              </p>
              <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <span class="block h-full bg-white/80" :style="{ width: `${statsCpuPct ?? 0}%` }" />
              </div>
              <p class="mt-2.5 text-xs text-orbit-muted tabular-nums">
                {{ allocation }}
              </p>
            </div>

            <div class="border-t border-orbit-line/60 px-5 py-4 sm:border-l sm:border-t-0">
              <UiLabel>Peak memory</UiLabel>
              <p class="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
                {{ statsMemPct == null ? '—' : statsMemPct }}<span v-if="statsMemPct != null" class="text-base font-normal text-orbit-muted">%</span>
              </p>
              <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <span class="block h-full bg-white/80" :style="{ width: `${statsMemPct ?? 0}%` }" />
              </div>
              <p class="mt-2.5 text-xs text-orbit-muted tabular-nums">
                peak {{ fmtSlurmSize(stats.MaxRSS) }} / requested {{ fmtSize(job.memory) }} per node
              </p>
            </div>
          </div>

          <dl class="grid grid-cols-1 border-t border-orbit-line/60 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="(field, i) in statCards" :key="field.label" :class="statCellClass(i)">
              <UiLabel as="dt">{{ field.label }}</UiLabel>
              <dd class="mt-1 break-all text-sm text-white tabular-nums">{{ field.value }}</dd>
            </div>
          </dl>
        </template>
      </UiCard>
    </template>

    <div class="mt-6 grid gap-3 lg:grid-cols-2">
      <UiCard v-for="group in fieldGroups" :key="group.title">
        <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
          <h3 class="text-sm font-medium text-white">{{ group.title }}</h3>
        </div>
        <dl>
          <div
            v-for="(field, i) in group.fields"
            :key="field.label"
            class="flex items-baseline justify-between gap-4 px-5 py-2.5"
            :class="i > 0 && 'border-t border-orbit-line/40'"
          >
            <UiLabel as="dt" class="shrink-0">{{ field.label }}</UiLabel>
            <dd class="min-w-0 break-all text-right text-sm text-white">{{ field.value }}</dd>
          </div>
        </dl>
      </UiCard>
    </div>

    <section v-if="outputItems.length" class="mt-6">
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h3 class="text-sm font-medium text-white">Output</h3>
        <UiLabel>Files</UiLabel>
      </div>

      <div class="space-y-3">
        <UiCard v-for="item in outputItems" :key="item.kind">
          <div class="flex flex-wrap items-center gap-3 px-5 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white">{{ item.label }}</p>
              <p class="mt-0.5 truncate text-xs text-orbit-muted" :title="item.path">{{ item.path }}</p>
            </div>
            <UiChip
              tone="accent"
              class="shrink-0"
              :disabled="!!outputs[item.kind]?.loading"
              @click="viewOutput(item)"
            >
              {{ outputs[item.kind]?.loading ? 'Reading…' : outputs[item.kind] ? 'Refresh' : 'View' }}
            </UiChip>
          </div>

          <template v-if="outputs[item.kind]">
            <div class="max-h-96 overflow-auto border-t border-orbit-line/60 bg-black/30 px-5 py-4">
              <p v-if="outputs[item.kind].error" class="text-xs text-orbit-danger">{{ outputs[item.kind].error }}</p>
              <pre v-else-if="outputs[item.kind].content" class="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-orbit-text">{{ outputs[item.kind].content }}</pre>
              <p v-else-if="outputs[item.kind].loading" class="text-xs text-orbit-muted">Reading…</p>
              <p v-else class="text-xs text-orbit-muted">(empty file)</p>
            </div>
            <p v-if="outputs[item.kind].truncated" class="border-t border-orbit-line/60 px-5 py-2 text-[11px] text-orbit-warn">
              File is {{ fmtBytes(outputs[item.kind].size) }}, showing the last 256 KB only
            </p>
          </template>
        </UiCard>
      </div>
    </section>
  </div>
</template>
