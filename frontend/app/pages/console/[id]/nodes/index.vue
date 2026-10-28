<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: '节点' })

const route = useRoute()

const backendId = route.params.id
const error = ref('')
const nodes = ref([])

const groups = computed(() => {
  const map = new Map()
  for (const node of nodes.value) {
    // scontrol 的 partitions 可能是数组或逗号分隔字符串，统一按逗号拆分
    const parts = String(node.partitions || '').split(',').map((part) => part.trim()).filter(Boolean)
    for (const part of parts.length ? parts : ['未分区']) {
      if (!map.has(part)) map.set(part, [])
      map.get(part).push(node)
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({
      name,
      nodes: [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }))
})

function openNode(node) {
  return navigateTo(`/console/${backendId}/nodes/${encodeURIComponent(node.name)}`)
}

async function load() {
  error.value = ''
  try {
    nodes.value = await request('slurm:list_nodes')
  } catch (e) {
    error.value = e.message
  }
}

const refresh = usePageRefresh(load)

onMounted(refresh)
</script>

<template>
  <div class="max-w-5xl">
    <UiAlert v-if="error" class="mb-4">查询失败：{{ error }}</UiAlert>

    <div v-else class="space-y-5">
      <section v-for="group in groups" :key="group.name">
        <div class="mb-2 flex items-baseline gap-2">
          <h3 class="text-sm font-medium text-white">{{ group.name }}</h3>
          <span class="text-xs text-orbit-muted">{{ group.nodes.length }} 个节点</span>
        </div>
        <UiCard class="overflow-x-auto">
          <table class="w-full min-w-[520px] table-fixed text-left text-sm">
            <thead>
              <tr class="border-b border-orbit-line text-[11px] uppercase tracking-wider text-orbit-muted">
                <th class="px-3 py-3 font-medium">节点</th>
                <th class="w-24 px-3 py-3 font-medium">状态</th>
                <th class="w-20 px-3 py-3 font-medium">CPU</th>
                <th class="w-20 px-3 py-3 font-medium">负载</th>
                <th class="w-32 px-3 py-3 font-medium">内存</th>
                <th class="hidden w-20 px-3 py-3 font-medium xl:table-cell">磁盘</th>
                <th class="hidden w-32 px-3 py-3 font-medium xl:table-cell">GRES</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="node in group.nodes"
                :key="node.name"
                class="cursor-pointer border-b border-orbit-line/50 last:border-0 hover:bg-white/5"
                @click="openNode(node)"
              >
                <td class="truncate px-3 py-3 font-medium text-white" :title="node.name">{{ node.name }}</td>
                <td class="truncate px-3 py-3" :class="stateClass(node.state)">{{ fmt(node.state) }}</td>
                <td class="px-3 py-3 text-orbit-muted" :title="`空闲 ${node.idleCpus}`">{{ node.allocCpus }}/{{ node.cpus }}</td>
                <td class="px-3 py-3 text-orbit-muted">{{ fmtLoad(node.cpuLoad) }}</td>
                <td class="truncate px-3 py-3 text-orbit-muted">{{ fmtSize(node.freeMem) }} / {{ fmtSize(node.realMemory) }}</td>
                <td class="hidden px-3 py-3 text-orbit-muted xl:table-cell">{{ fmtSize(node.disk) }}</td>
                <td class="hidden truncate px-3 py-3 text-orbit-muted xl:table-cell" :title="fmt(node.gres)">
                  {{ fmt(node.gres) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UiCard>
      </section>
      <UiEmpty v-if="!groups.length">暂无节点信息</UiEmpty>
    </div>
  </div>
</template>
