<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '作业详情' })

const route = useRoute()

// Slurm 25 的 sstat 没有 CPUTime 字段，用 AveCPU（每任务平均 CPU 时间）代替
const STAT_FIELDS = ['AveCPU', 'NTasks', 'MaxRSS', 'MaxDiskRead', 'MaxDiskWrite']
const MAX_POINTS = 60
const HOLLOW = 'border-2 border-white/25 bg-transparent'

const job = ref(null)
const fromHistory = ref(false)
const stats = ref(null)
const statsError = ref('')
const cpuHistory = ref([])
const outputs = ref({})
const nowTs = ref(Date.now())
let timer = null

const ts = (value) => (value ? new Date(value).getTime() : NaN)
const running = computed(() => jobStatus(job.value?.status).toLowerCase().includes('running'))

// 生命周期步进条：已到达的节点绿色实心，未到达灰色空圈
const timeline = computed(() => {
  const j = job.value
  const submit = ts(j?.submitTime)
  if (!Number.isFinite(submit)) return { items: [], span: 0 }

  const start = ts(j.startTime)
  const end = ts(j.endTime)
  const hasStart = Number.isFinite(start)
  const hasEnd = Number.isFinite(end)
  const now = nowTs.value

  const step = (label, at, dotClass) => ({ type: 'step', label, at: at ? fmtDate(at) : '', dotClass })
  const link = (label, value) => ({ type: 'link', label, value })

  const items = [step('提交', j.submitTime, 'bg-orbit-ok')]
  items.push(link(hasStart ? '排队' : '已排队', (hasStart ? start : now) - submit))
  items.push(step('开始', hasStart ? j.startTime : null, hasStart ? 'bg-orbit-ok' : HOLLOW))
  if (hasEnd) {
    const failed = /fail|cancel|timeout|oom/.test(jobStatus(j.status).toLowerCase())
    items.push(link('运行', end - start))
    items.push(step('结束', j.endTime, failed ? 'bg-orbit-danger' : 'bg-orbit-ok'))
  } else {
    items.push(hasStart ? link('已运行', now - start) : link('', null))
    items.push(step('结束', null, HOLLOW))
  }
  return { items, span: (hasEnd ? end : now) - submit }
})

// CPU 利用率 ≈ 平均 CPU 时间 × 任务数 ÷ 已运行时长 ÷ 分配核数
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

// 内存峰值占比 = 峰值 RSS ÷ 申请内存（每节点）
const statsMemPct = computed(() => {
  const peak = parseSlurmSize(stats.value?.MaxRSS)
  const limit = Number(job.value?.memory)
  if (peak == null || !limit) return null
  return Math.min(100, Math.round((peak / limit) * 1000) / 10)
})

const statCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: '任务数', value: fmt(s.NTasks) },
    { label: '平均 CPU 时间', value: fmtSlurmTime(s.AveCPU) },
    { label: '磁盘读取', value: fmtBytes(s.MaxDiskRead) },
    { label: '磁盘写入', value: fmtBytes(s.MaxDiskWrite) }
  ]
})

const fieldGroups = computed(() => {
  const j = job.value
  if (!j) return []
  const base = {
    title: '基本信息',
    fields: [
      { label: '用户', value: fmt(j.user) },
      { label: '账户', value: fmt(j.account) },
      { label: '集群', value: fmt(j.cluster) },
      { label: '分区', value: fmt(j.partition) }
    ]
  }
  if (fromHistory.value) {
    return [base, {
      title: '结果',
      fields: [
        { label: '退出码', value: fmt(j.exitCode) },
        { label: '工作目录', value: fmt(j.workDir) }
      ]
    }]
  }
  return [base, {
    title: '资源',
    fields: [
      { label: '节点', value: fmt(j.nodes) },
      { label: 'CPU', value: fmt(j.cpus) },
      { label: '内存/节点', value: fmtSize(j.memory) },
      { label: 'GRES', value: fmt(j.gres) },
      { label: '时限', value: fmtLimit(j.timeLimit) }
    ]
  }]
})

// 输出文件查看：job.stdout/stderr 是 sacct 返回的展开路径，直接发给后端读取
const outputItems = computed(() => {
  const j = job.value
  if (!j) return []
  return [
    { kind: 'stdout', label: '标准输出', path: j.stdout },
    { kind: 'stderr', label: '标准错误', path: j.stderr }
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

async function pollStats() {
  if (!running.value) return
  try {
    const s = await request('slurm:job_stat', { jobId: job.value.jobId, target: STAT_FIELDS })
    stats.value = s
    statsError.value = ''
    cpuHistory.value = [...cpuHistory.value.slice(1 - MAX_POINTS), cpuPctOf(s)]
  } catch (e) {
    statsError.value = e.message
  }
}

async function load() {
  error.value = ''
  try {
    await fetchJob()
  } catch (e) {
    error.value = e.message
  }
}

async function fetchJob() {
  const jobId = String(route.params.jobId)
  let found = (await request('slurm:list_queue')).find((j) => String(j.jobId) === jobId)
  fromHistory.value = !found
  if (!found) found = (await request('slurm:list_history')).find((j) => String(j.jobId) === jobId)
  if (!found) throw new Error(`未找到作业 #${jobId}`)
  job.value = found
  await pollStats()
}

const refresh = usePageRefresh(load)
const { error, notice, acting, run } = useAction(refresh)

function holdJob(j) {
  return run(`hold:${j.jobId}`, () => request('slurm:hold_job', { jobId: j.jobId }), `已挂起作业 #${j.jobId}`)
}

function releaseJob(j) {
  return run(`release:${j.jobId}`, () => request('slurm:release_job', { jobId: j.jobId }), `已释放作业 #${j.jobId}`)
}

function cancelJob(j) {
  if (!window.confirm(`确定取消作业 #${j.jobId}（${j.name || '未命名'}）？`)) return
  return run(`cancel:${j.jobId}`, () => request('slurm:cancel_job', { jobId: j.jobId }), `已取消作业 #${j.jobId}`)
}

function back() {
  return navigateTo(`/console/${route.params.id}/jobs${fromHistory.value ? '?tab=history' : ''}`)
}

onMounted(async () => {
  await refresh()
  timer = setInterval(() => {
    nowTs.value = Date.now()
    pollStats()
  }, 5000)
})

onUnmounted(() => clearInterval(timer))

</script>

<template>
  <p v-if="!job && !error" class="text-sm text-orbit-muted">加载中…</p>
  <UiAlert v-else-if="!job" class="max-w-3xl">查询失败：{{ error }}</UiAlert>

  <div v-else class="max-w-6xl">
    <!-- 头部：标识 + 操作 -->
    <UiCard class="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <UiButton class="shrink-0" @click="back">← 返回</UiButton>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2.5">
          <h3 class="text-lg font-semibold tracking-tight text-white">作业 #{{ job.jobId }}</h3>
          <span class="shrink-0 text-xs" :class="stateClass(job.status)">{{ jobStatus(job.status) }}</span>
        </div>
        <p class="mt-0.5 truncate text-xs text-orbit-muted">
          {{ fmt(job.name) }} · {{ fmt(job.user) }}<template v-if="job.partition"> · {{ job.partition }} 分区</template>
        </p>
      </div>
      <JobActions
        :job="job"
        :acting="acting"
        @hold="holdJob"
        @release="releaseJob"
        @cancel="cancelJob"
      />
    </UiCard>

    <UiAlert v-if="notice" type="ok" class="mt-4">{{ notice }}</UiAlert>
    <UiAlert v-if="error" class="mt-4">{{ error }}</UiAlert>

    <!-- 生命周期 -->
    <UiCard v-if="timeline.items.length" as="section" class="mt-4 overflow-x-auto p-5">
      <div class="mb-7 flex items-baseline justify-between gap-4">
        <UiLabel as="h3">生命周期</UiLabel>
        <p class="text-xs text-orbit-muted">总时长 <span class="font-medium text-white">{{ fmtDuration(timeline.span) }}</span></p>
      </div>
      <div class="flex min-w-[430px] items-start px-2 pb-1">
        <template v-for="(item, i) in timeline.items" :key="i">
          <div v-if="item.type === 'step'" class="flex w-24 shrink-0 flex-col items-center text-center">
            <span class="h-3.5 w-3.5 rounded-full" :class="item.dotClass" />
            <p class="mt-2 text-xs font-medium text-white">{{ item.label }}</p>
            <p v-if="item.at" class="mt-0.5 text-[11px] leading-tight text-orbit-muted">{{ item.at }}</p>
          </div>
          <div v-else class="relative mx-2 mt-[6px] min-w-14 flex-1">
            <div class="h-0.5 rounded-full bg-white/15" />
            <p v-if="item.label" class="absolute inset-x-0 -top-5 whitespace-nowrap text-center text-[11px]">
              <span class="text-orbit-muted">{{ item.label }}</span>
              <span class="ml-1 text-orbit-text">{{ fmtDuration(item.value) }}</span>
            </p>
          </div>
        </template>
      </div>
    </UiCard>

    <!-- 运行中资源监控 -->
    <template v-if="running">
      <UiLabel as="h3" class="mb-3 mt-6">资源监控</UiLabel>
      <UiAlert v-if="statsError">{{ statsError }}</UiAlert>
      <template v-else-if="stats">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiGauge
            :percent="statsCpuPct"
            label="CPU 利用率"
            :sub="`已分配 ${fmt(job.cpus)} 核 · 平均 ${fmtSlurmTime(stats.AveCPU)}/任务`"
          />
          <UiGauge
            :percent="statsMemPct"
            label="内存峰值"
            :sub="`峰值 ${fmtSize(parseSlurmSize(stats.MaxRSS))} / 申请 ${fmtSize(job.memory)}/节点`"
          />
        </div>
        <LiveChart class="mt-3" label="CPU 利用率（近 5 分钟）" :data="cpuHistory" color="#22d3ee" />
        <UiFieldGrid class="mt-3" :fields="statCards" cols="sm:grid-cols-2 lg:grid-cols-4" />
      </template>
    </template>

    <!-- 信息分组 -->
    <div class="mt-6 grid gap-x-6 gap-y-6 lg:grid-cols-2">
      <section v-for="group in fieldGroups" :key="group.title">
        <UiLabel as="h3" class="mb-3">{{ group.title }}</UiLabel>
        <UiFieldGrid :fields="group.fields" cols="sm:grid-cols-2" />
      </section>
    </div>

    <!-- 输出 -->
    <section v-if="outputItems.length" class="mt-6">
      <UiLabel as="h3" class="mb-3">输出</UiLabel>
      <div class="space-y-3">
        <UiCard v-for="item in outputItems" :key="item.kind" class="p-4">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white">{{ item.label }}</p>
              <p class="mt-0.5 truncate text-xs text-orbit-muted" :title="item.path">
                {{ item.path }}
              </p>
            </div>
            <UiChip
              tone="accent"
              class="shrink-0"
              :disabled="!!outputs[item.kind]?.loading"
              @click="viewOutput(item)"
            >
              {{ outputs[item.kind]?.loading ? '读取中…' : outputs[item.kind] ? '刷新' : '查看' }}
            </UiChip>
          </div>
          <template v-if="outputs[item.kind]">
            <div class="mt-3 max-h-96 overflow-auto rounded-xl border border-orbit-line bg-black/40 p-4">
              <p v-if="outputs[item.kind].error" class="text-xs text-orbit-danger">{{ outputs[item.kind].error }}</p>
              <pre v-else-if="outputs[item.kind].content" class="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-orbit-text">{{ outputs[item.kind].content }}</pre>
              <p v-else-if="outputs[item.kind].loading" class="text-xs text-orbit-muted">读取中…</p>
              <p v-else class="text-xs text-orbit-muted">（空文件）</p>
            </div>
            <p v-if="outputs[item.kind].truncated" class="mt-2 text-[11px] text-orbit-warn">
              文件共 {{ fmtBytes(outputs[item.kind].size) }}，仅显示最后 256 KB
            </p>
          </template>
        </UiCard>
      </div>
    </section>
  </div>
</template>
