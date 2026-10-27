<script setup>
const props = defineProps({
  type: { type: String, default: 'error' }
})

const typeClass = {
  error: 'orbit-alert-error',
  ok: 'orbit-alert-ok',
  warn: 'orbit-alert-warn'
}
</script>

<template>
  <p class="orbit-alert" :class="typeClass[props.type] || typeClass.error"><slot /></p>
</template>
