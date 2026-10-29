<script setup>
const props = defineProps({
  tone: { type: String, default: 'default' }
})

const tones = {
  default: 'border-orbit-line text-orbit-muted',
  accent: 'border-orbit-line text-orbit-muted hover:border-orbit-accent/50 hover:text-white',
  ok: 'border-orbit-ok/40 text-orbit-ok hover:border-orbit-ok/70',
  warn: 'border-orbit-line text-orbit-muted hover:border-orbit-warn/50 hover:text-orbit-warn',
  danger: 'border-orbit-line text-orbit-muted hover:border-orbit-danger/50 hover:text-orbit-danger'
}
</script>

<template>
  <button
    type="button"
    class="cursor-pointer rounded-lg border px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="tones[props.tone] || tones.default"
  >
    <slot />
  </button>
</template>
