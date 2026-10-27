<script setup>
const props = defineProps({
  variant: { type: String, default: 'default' }
})

const variants = {
  default: 'border-orbit-line text-orbit-text hover:border-orbit-accent/40',
  accent: 'border-orbit-accent/30 text-orbit-accent hover:border-orbit-accent/60'
}
</script>

<template>
  <button
    type="button"
    class="rounded-xl border bg-orbit-card px-4 py-2 text-sm transition disabled:opacity-50"
    :class="variants[props.variant] || variants.default"
  >
    <slot />
  </button>
</template>
