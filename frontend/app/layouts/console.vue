<script setup>
const route = useRoute()

const backendId = computed(() => route.params.id)
const backend = ref(null)
const isRoot = computed(() => backend.value?.username === 'root')

onMounted(async () => {
  backend.value = await request('backend:info').catch(() => null)
})

const sections = [
  { id: 'info', label: '详情', path: '' },
  { id: 'jobs', label: '作业', path: 'jobs' },
  { id: 'nodes', label: '节点', path: 'nodes' },
  { id: 'accounts', label: '账户', path: 'accounts' }
]


const section = computed(() => route.path.match(/^\/console\/[^/]+\/([^/]+)/)?.[1] ?? 'info')
provide('consoleBackend', backend)
provide('consoleAuth', { isRoot })
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
          {{ backend?.hostname || backendId }}
        </h1>
        <UiLabel class="hidden lg:mt-1 lg:block">Console</UiLabel>
        <UiTag v-if="isRoot" class="lg:mt-3">root</UiTag>
      </div>

      <nav class="flex flex-wrap gap-1 px-3 py-3 lg:flex-1 lg:flex-col lg:flex-nowrap lg:py-4">
        <NuxtLink
          v-for="item in sections"
          :key="item.id"
          :to="`/console/${backendId}/${item.path}`"
          class="whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm text-orbit-muted transition"
          :class="section === item.id
            ? 'bg-white/10'
            : 'hover:bg-white/5 hover:text-white'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <h2 class="text-2xl font-semibold tracking-tight text-white">{{ route.meta.title }}</h2>
      <slot />
    </main>
  </div>
</template>
