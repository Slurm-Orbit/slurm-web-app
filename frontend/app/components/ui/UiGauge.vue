<script setup>
const props = defineProps({
  percent: { type: Number, default: null },
  label: { type: String, default: '' },
  sub: { type: String, default: '' }
})

const C = 2 * Math.PI * 42

const offset = computed(() => {
  const p = Math.min(100, Math.max(0, props.percent ?? 0))
  return C * (1 - p / 100)
})

const color = computed(() => {
  const p = props.percent
  if (p == null) return '#8d9aab'
  if (p >= 90) return '#ff3b5c'
  if (p >= 70) return '#ffb020'
  return '#3cbe7a'
})
</script>

<template>
  <UiCard class="flex flex-col items-center justify-center p-5">
    <div class="relative">
      <svg width="112" height="112" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          :stroke="color"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="C"
          :stroke-dashoffset="offset"
          transform="rotate(-90 50 50)"
          style="transition: stroke-dashoffset 0.7s ease, stroke 0.7s ease"
        />
      </svg>
      <div class="absolute inset-0 flex items-baseline justify-center pt-9">
        <span class="text-2xl font-semibold tracking-tight text-white">
          {{ percent == null ? '—' : Math.round(percent) }}
        </span>
        <span v-if="percent != null" class="text-sm text-orbit-muted">%</span>
      </div>
    </div>
    <p class="mt-2 text-sm font-medium text-white">{{ label }}</p>
    <p v-if="sub" class="mt-0.5 max-w-full truncate text-xs text-orbit-muted" :title="sub">{{ sub }}</p>
  </UiCard>
</template>
