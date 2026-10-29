<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  size: { type: String, default: 'md' }
})

defineEmits(['update:modelValue'])

const sizes = {
  md: 'rounded-xl bg-black/30 px-3 py-2.5 text-sm placeholder:text-orbit-muted/50 focus:shadow-[0_0_0_3px_rgba(220,220,230,0.18)]',
  sm: 'rounded-lg bg-black/30 px-2 py-1 text-xs'
}
</script>

<template>
  <input
    :value="modelValue"
    class="border border-orbit-line text-orbit-text outline-none transition focus:border-orbit-accent/50 disabled:opacity-50"
    :class="sizes[props.size] || sizes.md"
    @input="$emit('update:modelValue', $event.target.value)"
  >
</template>
