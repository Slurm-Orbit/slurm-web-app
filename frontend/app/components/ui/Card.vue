<script setup>
const props = defineProps({
  as: { type: String, default: 'div' },
  rounded: { type: String, default: '2xl' },
  glow: { type: Boolean, default: false }
})

const radius = { '2xl': 'rounded-2xl', xl: 'rounded-xl' }
</script>

<template>
  <component
    :is="as"
    class="border border-orbit-line bg-orbit-card backdrop-blur-md"
    :class="[
      radius[props.rounded] || radius['2xl'],
      glow && 'shadow-[0_0_0_1px_rgba(220,220,230,0.18),0_8px_32px_rgba(0,0,0,0.35)]'
    ]"
  >
    <slot />
  </component>
</template>
