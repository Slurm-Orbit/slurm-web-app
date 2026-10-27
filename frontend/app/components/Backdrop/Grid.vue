<template>
  <div class="absolute inset-0 overflow-hidden text-white/90 opacity-[0.035]" aria-hidden="true">
    <div class="flex h-full flex-col gap-[47px]">
      <div v-for="i in 80" :key="i" class="h-px shrink-0 bg-current" />
    </div>
    <div class="absolute inset-0 flex gap-[47px]">
      <div v-for="i in 80" :key="i" class="w-px shrink-0 bg-current" />
    </div>
  </div>
</template>
