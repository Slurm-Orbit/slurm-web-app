<script setup>
const route = useRoute()
const gateway = useGateway()

const backendId = computed(() => route.params.id)
// The gateway drops an id from the dictionary when its agent disconnects
const online = computed(() => !!gateway.value[backendId.value])

const backend = ref(null)
const isRoot = computed(() => backend.value?.username === 'root')

onMounted(async () => {
  backend.value = await request('backend:info').catch(() => null)
})

// Warn on the online → offline transition only: the dictionary is empty until the first
// snapshot arrives, so a plain "not in dictionary" check would flash on every page load.
const offline = ref(false)
const countdown = ref(0)
let countdownTimer = null

function stopOfflineWarn() {
  clearInterval(countdownTimer)
  countdownTimer = null
  offline.value = false
}

function startOfflineWarn() {
  if (offline.value) return
  offline.value = true
  countdown.value = 3
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value > 0) return
    stopOfflineWarn()
    navigateTo('/')
  }, 1000)
}

watch(online, (now, before) => {
  if (now) stopOfflineWarn()
  else if (before) startOfflineWarn()
})

onBeforeUnmount(stopOfflineWarn)

const sections = [
  { id: 'info', label: 'Overview', path: '' },
  { id: 'jobs', label: 'Jobs', path: 'jobs' },
  { id: 'nodes', label: 'Nodes', path: 'nodes' },
  { id: 'accounts', label: 'Accounts', path: 'accounts' }
]


const section = computed(() => route.path.match(/^\/console\/[^/]+\/([^/]+)/)?.[1] ?? 'info')
provide('consoleBackend', backend)
provide('consoleAuth', { isRoot })

// Pages register their loader via usePageRefresh; the layout owns refresh state and the timestamp.
// The refresh button is disabled while refreshing, so concurrent runs only come from pages
// (e.g. a tab switch) and must not be dropped.
const pageRefresh = reactive({ load: null, refreshing: false, updatedAt: null })

pageRefresh.refresh = async () => {
  if (!pageRefresh.load) return
  pageRefresh.refreshing = true
  try {
    await pageRefresh.load()
    pageRefresh.updatedAt = new Date()
  } finally {
    pageRefresh.refreshing = false
  }
}

provide('pageRefresh', pageRefresh)
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- In-flow banner: pushes the body down instead of covering the header on narrow screens -->
    <div
      v-if="offline"
      class="shrink-0 border-b border-orbit-warn/30 bg-orbit-warn/10 px-4 py-2.5 text-center text-sm text-orbit-warn"
    >
      Backend offline — returning to the gateway in {{ countdown }}s…
    </div>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside class="flex w-full shrink-0 flex-col border-b border-orbit-line bg-orbit-elevated lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div class="flex items-center gap-3 border-b border-orbit-line px-4 py-3 sm:px-5 lg:block lg:py-5">
          <button
            type="button"
            class="shrink-0 cursor-pointer text-sm text-orbit-muted transition hover:text-orbit-accent"
            @click="navigateTo('/')"
          >
            ← Back to gateway
          </button>
          <h1 class="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-white lg:mt-4 lg:text-lg">
            {{ backend?.hostname || backendId }}
          </h1>
          <span class="hidden text-[11px] uppercase tracking-wider text-orbit-muted lg:mt-1 lg:block">Console</span>
          <UiTag v-if="isRoot" tone="default" class="shrink-0 lg:mt-3">root</UiTag>
        </div>

        <!-- One scrollable row on mobile, a vertical list on desktop -->
        <nav class="flex gap-1 overflow-x-auto px-3 py-2 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:py-4">
          <NuxtLink
            v-for="item in sections"
            :key="item.id"
            :to="`/console/${backendId}/${item.path}`"
            class="shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm text-orbit-muted transition"
            :class="section === item.id
              ? 'bg-white/10'
              : 'hover:bg-white/5 hover:text-white'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </aside>

      <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-semibold tracking-tight text-white sm:text-2xl">{{ route.meta.title }}</h2>
          <div v-if="pageRefresh.load" class="flex items-center gap-3">
            <span v-if="pageRefresh.updatedAt" class="text-xs text-orbit-muted">
              Updated {{ pageRefresh.updatedAt.toLocaleTimeString() }}
            </span>
            <UiButton :disabled="pageRefresh.refreshing" @click="pageRefresh.refresh()">
              {{ pageRefresh.refreshing ? 'Refreshing…' : 'Refresh' }}
            </UiButton>
          </div>
        </div>

        <div class="mt-5 flex min-h-0 min-w-0 flex-1 flex-col sm:mt-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
