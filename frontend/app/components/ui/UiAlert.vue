<script setup>
const props = defineProps({
  type: { type: String, default: 'error' }
})

const types = {
  error: 'border-orbit-danger/30 bg-orbit-danger/10 text-orbit-danger',
  ok: 'border-orbit-ok/30 bg-orbit-ok/10 text-orbit-ok',
  warn: 'border-orbit-warn/30 bg-orbit-warn/10 text-orbit-warn'
}
</script>

<template>
  <p class="rounded-xl border px-4 py-3 text-sm" :class="types[props.type] || types.error">
    <slot />
  </p>
</template>
