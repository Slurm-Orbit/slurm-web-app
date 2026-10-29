<script setup>
import { isVNode } from 'vue'

defineProps({
  // Plain text, or a JSX element when the cell contains elements.
  cells: { type: Array, required: true }
})

const widths = inject('uiTableWidths', () => computed(() => []), true)
const compact = inject('uiTableCompact', () => computed(() => false), true)

const Cell = defineComponent({
  props: { value: { required: true } },
  setup(props) {
    return () => props.value
  }
})
</script>

<template>
  <tr
    class="border-b border-orbit-line/50 last:border-0 hover:bg-white/5"
    :class="compact && 'h-12'"
  >
    <td
      v-for="(cell, index) in cells"
      :key="index"
      class="px-3 align-middle text-orbit-muted"
      :class="[widths[index], compact ? '' : 'py-3', isVNode(cell) ? '' : 'truncate']"
      :title="isVNode(cell) || cell == null || cell === '' ? undefined : String(cell)"
    >
      <Cell v-if="isVNode(cell)" :value="cell" />
      <template v-else>{{ cell }}</template>
    </td>
  </tr>
</template>
