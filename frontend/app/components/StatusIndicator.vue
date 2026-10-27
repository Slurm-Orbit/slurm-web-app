<script setup>
const props = defineProps({
  count: { default: 0 }
})

const online = computed(() => props.count > 0)
</script>

<template>
  <span
    class="inline-flex items-center gap-2 rounded-full border border-orbit-line bg-orbit-card px-3 py-1.5
           text-xs text-orbit-muted backdrop-blur-md"
  >
    <i
      class="inline-block h-1.5 w-1.5 rounded-full"
      :class="online
        ? 'bg-orbit-ok shadow-[0_0_8px_2px_rgba(60,190,122,0.85)]'
        : 'bg-[#8d9aab]'"
    />
    {{ online ? `${count} online` : 'Waiting for connection' }}
  </span>
</template>
