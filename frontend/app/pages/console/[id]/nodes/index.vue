<script setup lang="jsx">
definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'Nodes' })

const route = useRoute()

const backendId = route.params.id
const error = ref('')
const nodes = ref([])

const groups = computed(() => {
  const map = new Map()
  for (const node of nodes.value) {
    // scontrol may report partitions as an array or a comma-separated string
    const parts = String(node.partitions || '').split(',').map((part) => part.trim()).filter(Boolean)
    for (const part of parts.length ? parts : ['unpartitioned']) {
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

const nodeHeaders = ['Node', 'State', 'CPU', 'Load', 'Memory', 'Disk', 'GRES']
const nodeWidths = ['', 'w-24', 'w-20', 'w-20', 'w-32', 'hidden w-20 xl:table-cell', 'hidden w-32 xl:table-cell']

function openNode(node) {
  return navigateTo(`/console/${backendId}/nodes/${encodeURIComponent(node.name)}`)
}

function nodeCells(node) {
  return [
    <span class="block max-w-full truncate font-medium text-white" title={node.name}>{node.name}</span>,
    <span class={['block max-w-full truncate', stateClass(node.state)]}>{fmt(node.state)}</span>,
    <span title={`${node.idleCpus} idle`}>{node.allocCpus}/{node.cpus}</span>,
    fmtLoad(node.cpuLoad),
    `${fmtSize(node.freeMem)} / ${fmtSize(node.realMemory)}`,
    fmtSize(node.disk),
    fmt(node.gres)
  ]
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
  <div>
    <UiAlert v-if="error" class="mb-4">Query failed: {{ error }}</UiAlert>

    <div v-else class="space-y-5">
      <section v-for="group in groups" :key="group.name">
        <div class="mb-2 flex items-baseline gap-2">
          <h3 class="text-sm font-medium text-white">{{ group.name }}</h3>
          <span class="text-xs text-orbit-muted">{{ group.nodes.length }} nodes</span>
        </div>
        <UiCard class="overflow-x-auto">
          <UiTable class="min-w-[520px]" :widths="nodeWidths" :headers="nodeHeaders">
            <UiTableRow
              v-for="node in group.nodes"
              :key="node.name"
              class="cursor-pointer"
              :cells="nodeCells(node)"
              @click="openNode(node)"
            />
          </UiTable>
        </UiCard>
      </section>
      <p v-if="!groups.length" class="py-8 text-center text-sm text-orbit-muted">No nodes</p>
    </div>
  </div>
</template>
