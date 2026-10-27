<script setup>
const props = defineProps({
  data: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  max: { type: Number, default: 100 },
  unit: { type: String, default: '%' },
  color: { type: String, default: '#3cbe7a' }
})

const W = 300
const H = 72
const gid = `lg-${Math.random().toString(36).slice(2, 8)}`

const toX = (i, len) => (len > 1 ? (i / (len - 1)) * W : W)
const toY = (v) => H - (Math.min(props.max, Math.max(0, v)) / props.max) * H

// null 采样点沿用上一个有效值，避免折线中断
const points = computed(() => {
  let last = 0
  return props.data.map((v, i) => {
    last = v ?? last
    return [toX(i, props.data.length), toY(last)]
  })
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
)

const areaPath = computed(() => {
  const pts = points.value
  if (!pts.length) return ''
  const first = pts[0][0]
  return `${linePath.value} L${pts[pts.length - 1][0]},${H} L${first},${H} Z`
})

const current = computed(() => [...props.data].reverse().find((v) => v != null) ?? null)
</script>

<template>
  <UiCard class="p-4">
    <div class="mb-2 flex items-baseline justify-between gap-2">
      <UiLabel>{{ label }}</UiLabel>
      <p class="text-sm font-medium text-white">
        {{ current == null ? '—' : `${current.toFixed(1)}${unit}` }}
      </p>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="h-20 w-full">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path :d="areaPath" :fill="`url(#${gid})`" />
      <path :d="linePath" fill="none" :stroke="color" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  </UiCard>
</template>
