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
    <button
      v-if="pending"
      type="button"
      class="orbit-chip hover:border-orbit-warn/50 hover:text-orbit-warn"
      :disabled="!!acting"
      @click.stop="emit('hold', job)"
    >
      挂起
    </button>
    <button
      v-if="pending"
      type="button"
      class="orbit-chip hover:border-orbit-ok/50 hover:text-orbit-ok"
      :disabled="!!acting"
      @click.stop="emit('release', job)"
    >
      释放
    </button>
    <button
      type="button"
      class="orbit-chip hover:border-orbit-danger/50 hover:text-orbit-danger"
      :disabled="!!acting"
      @click.stop="emit('cancel', job)"
    >
      取消
    </button>
  </div>
</template>
