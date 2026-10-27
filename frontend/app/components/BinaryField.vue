<script setup>
/**
 * 四角静态 0/1 装饰（无滚动动画，中心用 mask 淡出）
 */
const COLS = 8
const ROWS = 28

function columnDigits(seed) {
  const out = []
  let x = seed
  for (let i = 0; i < ROWS; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    out.push(x & 1)
  }
  return out
}

const corners = [
  {
    key: 'tl',
    box: 'left-0 top-0 h-[46vh] w-[min(260px,34vw)]',
    mask: '[mask-image:linear-gradient(to_bottom_right,black_20%,transparent_75%)]'
  },
  {
    key: 'tr',
    box: 'right-0 top-0 h-[46vh] w-[min(260px,34vw)]',
    mask: '[mask-image:linear-gradient(to_bottom_left,black_20%,transparent_75%)]'
  },
  {
    key: 'bl',
    box: 'bottom-0 left-0 h-[42vh] w-[min(240px,32vw)]',
    mask: '[mask-image:linear-gradient(to_top_right,black_15%,transparent_75%)]'
  },
  {
    key: 'br',
    box: 'bottom-0 right-0 h-[42vh] w-[min(240px,32vw)]',
    mask: '[mask-image:linear-gradient(to_top_left,black_15%,transparent_75%)]'
  }
]

const streams = corners.map((c, ci) => ({
  ...c,
  cols: Array.from({ length: COLS }, (_, i) => ({
    digits: columnDigits(ci * 97 + i * 13 + 7),
    opacity: 0.22 + ((i * 17 + ci * 9) % 45) / 100
  }))
}))
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
    <div class="absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-white/10 blur-[130px]" />
    <div class="absolute -bottom-40 -right-16 h-[520px] w-[520px] rounded-full bg-white/[0.06] blur-[150px]" />
    <div class="absolute left-1/2 top-[28%] h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[110px]" />

    <div
      class="absolute inset-0 opacity-[0.035]"
      style="background-image: linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px); background-size: 48px 48px"
    />

    <div
      v-for="corner in streams"
      :key="corner.key"
      class="absolute flex gap-2.5 overflow-hidden p-3 text-[11px] leading-[1.15rem] tracking-[0.2em] sm:text-xs sm:leading-5"
      :class="[corner.box, corner.mask]"
    >
      <div
        v-for="(col, i) in corner.cols"
        :key="i"
        class="flex flex-col"
        :style="{ opacity: col.opacity }"
      >
        <span
          v-for="(d, j) in col.digits"
          :key="j"
          class="select-none"
          :class="d ? 'text-white/80' : 'text-white/25'"
        >{{ d }}</span>
      </div>
    </div>
  </div>
</template>
