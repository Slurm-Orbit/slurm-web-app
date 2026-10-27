<script setup>
defineProps({
  fields: { type: Array, required: true },
  cols: { type: String, default: 'sm:grid-cols-2 lg:grid-cols-3' }
})
</script>

<template>
  <dl class="grid gap-3" :class="cols">
    <div v-for="field in fields" :key="field.label" class="orbit-card px-5 py-4">
      <dt class="orbit-label">{{ field.label }}</dt>
      <dd class="mt-1 break-all text-sm text-white">{{ field.value }}</dd>
      <p v-if="field.sub" class="mt-1 truncate text-xs text-orbit-muted" :title="field.sub">
        {{ field.sub }}
      </p>
    </div>
  </dl>
</template>
