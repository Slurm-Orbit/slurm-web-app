<script setup>
// useState 在服务端生成并随 payload 序列化，客户端直接复用，无需等到挂载
const corners = useState('backdrop:binary-field', () =>
  Array.from({ length: 4 }, (_, i) => ({
    cls: `${i % 2 ? 'right-0' : 'left-0'} ${i < 2 ? 'top-0 items-start' : 'bottom-0 items-end'}`,
    mask: `linear-gradient(to ${i < 2 ? 'bottom' : 'top'} ${i % 2 ? 'left' : 'right'}, black, transparent 75%)`,
    cols: Array.from({ length: 8 }, () =>
      Array.from({ length: 28 }, () => ({
        d: (Math.random() * 2) | 0,
        opacity: 0.4 + Math.random() * 0.22
      }))
    )
  }))
)
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <div
      v-for="(corner, ci) in corners"
      :key="ci"
      class="absolute flex h-[44vh] gap-2.5 text-[11px] leading-[1.15rem] tracking-[0.2em] sm:text-xs sm:leading-5"
      :class="corner.cls"
      :style="{ maskImage: corner.mask }"
    >
      <div
        v-for="(col, i) in corner.cols"
        :key="i"
        class="flex flex-col"
      >
        <span
          v-for="(item, j) in col"
          :key="j"
          class="select-none text-white"
          :style="{ opacity: item.opacity * (item.d ? 1 : 0.5) }"
        >{{ item.d }}</span>
      </div>
    </div>
  </div>
</template>
