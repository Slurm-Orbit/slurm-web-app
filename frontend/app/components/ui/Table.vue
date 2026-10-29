<script setup>
const props = defineProps({
  widths: { type: Array, default: () => [] },
  headers: { type: Array, required: true },
  // Fixed row height, no vertical cell padding. Queue rows hold chips that are taller than a
  // line of text and would otherwise stretch the row.
  compact: { type: Boolean, default: false }
})

provide('uiTableWidths', computed(() => props.widths))
provide('uiTableCompact', computed(() => props.compact))
</script>

<template>
  <table class="w-full table-fixed text-left text-sm">
    <thead>
      <tr class="border-b border-orbit-line text-[11px] uppercase tracking-wider text-orbit-muted">
        <th
          v-for="(header, index) in headers"
          :key="index"
          class="px-3 py-3 font-medium"
          :class="widths[index]"
          scope="col"
        >
          {{ header }}
        </th>
      </tr>
    </thead>
    <tbody>
      <slot />
    </tbody>
  </table>
</template>
