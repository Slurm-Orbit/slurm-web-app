<script setup>
const props = defineProps({
  job: { type: Object, required: true },
  acting: { type: String, default: '' }
})
const emit = defineEmits(['hold', 'release', 'cancel'])

const pending = computed(() => jobStatus(props.job.status).toLowerCase().includes('pending'))
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <template v-if="pending">
      <UiChip tone="warn" :disabled="!!acting" @click.stop="emit('hold', job)">挂起</UiChip>
      <UiChip tone="ok" :disabled="!!acting" @click.stop="emit('release', job)">释放</UiChip>
    </template>
    <UiChip tone="danger" :disabled="!!acting" @click.stop="emit('cancel', job)">取消</UiChip>
  </div>
</template>
