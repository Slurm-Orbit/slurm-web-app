<script setup>
const route = useRoute()
const { status, backends, selected, connect } = useSocket()

const backendId = route.params.id

// 优先用网关推送的最新 meta，agent 离线时退回会话内快照
const backend = computed(
  () => backends.value.find((b) => b.id === backendId) || selected.value
)

// loading: 等待后端环境信息；console: 已安装；install: 未安装但 root（管理/安装界面）；error: 未安装且非 root
const viewState = computed(() => {
  const b = backend.value
  if (!b || typeof b.slurmInstalled !== 'boolean') return 'loading'
  if (b.slurmInstalled) return 'console'
  return b.isRoot ? 'install' : 'error'
})

const sections = computed(() => {
  if (viewState.value !== 'console') return []
  const base = `/console/${backendId}`
  const list = [
    { id: 'info', label: '详情', to: base },
    { id: 'jobs', label: '作业', to: `${base}/jobs` },
    { id: 'nodes', label: '节点', to: `${base}/nodes` },
    { id: 'accounts', label: '账户', to: `${base}/accounts` }
  ]
  if (backend.value?.isRoot) list.push({ id: 'admin', label: '管理', to: `${base}/admin` })
  return list
})

function isActive(item) {
  if (item.id === 'info') return route.path === item.to
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

onMounted(() => {
  if (status.value === 'idle') connect()
})
</script>

<template>
  <div class="flex min-h-screen flex-col lg:flex-row">
    <aside class="flex w-full shrink-0 flex-col border-b border-orbit-line bg-orbit-elevated lg:w-60 lg:border-b-0 lg:border-r">
      <div class="flex items-center gap-3 border-b border-orbit-line px-4 py-3 sm:px-5 lg:block lg:py-5">
        <button
          type="button"
          class="shrink-0 text-sm text-orbit-muted transition hover:text-orbit-accent"
          @click="navigateTo('/')"
        >
          ← 返回网关
        </button>
        <h1 class="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-white lg:mt-4 lg:text-lg">
          {{ backend?.id || backendId }}
        </h1>
        <p class="hidden text-[11px] uppercase tracking-wider text-orbit-muted lg:mt-1 lg:block">Console</p>
        <div v-if="backend" class="flex shrink-0 gap-1.5 lg:mt-3 lg:flex-wrap">
          <span
            v-if="!backend.slurmInstalled"
            class="rounded-full border border-orbit-danger/30 px-2 py-0.5 text-[10px] text-orbit-danger"
          >
            Slurm 未安装
          </span>
          <span
            v-if="backend.isRoot"
            class="rounded-full border border-orbit-warn/30 px-2 py-0.5 text-[10px] text-orbit-warn"
          >
            root
          </span>
        </div>
      </div>

      <nav v-if="sections.length" class="flex flex-wrap gap-1 px-3 py-3 lg:flex-1 lg:flex-col lg:flex-nowrap lg:py-4">
        <NuxtLink
          v-for="item in sections"
          :key="item.id"
          :to="item.to"
          class="whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm text-orbit-muted transition"
          :class="isActive(item)
            ? 'bg-white/10'
            : 'hover:bg-white/5 hover:text-white'"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <!-- 等待后端环境信息 -->
      <div v-if="viewState === 'loading'" class="flex flex-1 items-center justify-center">
        <div class="flex items-center gap-3 text-sm text-orbit-muted">
          <UiSpinner />
          正在获取后端环境信息…
        </div>
      </div>

      <!-- 未安装且非 root：错误界面 -->
      <div v-else-if="viewState === 'error'" class="flex flex-1 items-center justify-center">
        <div class="orbit-card max-w-md p-8 text-center shadow-glow">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-orbit-danger/40 bg-orbit-danger/10 text-xl text-orbit-danger">
            ✕
          </div>
          <h2 class="text-xl font-semibold tracking-tight text-white">Slurm 未安装</h2>
          <p class="mt-3 text-sm leading-relaxed text-orbit-muted">
            该后端主机未检测到 Slurm 环境，控制台暂不可用。请联系管理员在主机上完成安装后重试。
          </p>
        </div>
      </div>

      <!-- 未安装但 root：安装界面 -->
      <template v-else-if="viewState === 'install'">
        <UiAlert type="warn" class="mb-6 max-w-xl">
          该主机未检测到 Slurm。可在管理界面进行安装（功能即将上线）。
        </UiAlert>
        <h2 class="text-2xl font-semibold tracking-tight text-white">管理</h2>
        <p class="mt-3 max-w-xl text-sm leading-relaxed text-orbit-muted">
          Slurm 安装与管理功能即将上线。
        </p>
      </template>

      <template v-else>
        <h2 class="text-2xl font-semibold tracking-tight text-white">{{ route.meta.title }}</h2>
        <slot />
      </template>
    </main>
  </div>
</template>
