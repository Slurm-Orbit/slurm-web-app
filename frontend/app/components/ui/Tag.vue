<script setup>
const props = defineProps({
  tone: { type: String, default: 'warn' }
})

const tones = {
  default: 'border-orbit-line text-orbit-muted',
  warn: 'border-orbit-warn/30 text-orbit-warn',
  ok: 'border-orbit-ok/30 text-orbit-ok',
  danger: 'border-orbit-danger/30 text-orbit-danger'
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] leading-none"
    :class="tones[props.tone] || tones.default"
  >
    <slot />
  </span>
</template>
