<script setup>
defineProps({
  as: { type: String, default: 'span' }
})
</script>

<template>
  <component :is="as" class="block text-[11px] uppercase tracking-wider text-orbit-muted">
    <slot />
  </component>
</template>
