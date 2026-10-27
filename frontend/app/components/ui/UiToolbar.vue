<script setup>
defineProps({
  loading: { type: Boolean, default: false },
  updatedAt: { type: Date, default: null }
})
const emit = defineEmits(['refresh'])
</script>

<template>
  <div class="mb-5 flex flex-wrap items-center gap-3">
    <slot />
    <UiButton :disabled="loading" @click="emit('refresh')">
      {{ loading ? '加载中…' : '刷新' }}
    </UiButton>
    <span v-if="updatedAt" class="text-xs text-orbit-muted">
      更新于 {{ updatedAt.toLocaleTimeString() }}
    </span>
  </div>
</template>
