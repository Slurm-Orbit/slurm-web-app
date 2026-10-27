<script setup>
defineOptions({ name: 'AccountTreeItem' })

const props = defineProps({
  account: { type: Object, required: true },
  admin: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  acting: { type: String, default: '' }
})

const emit = defineEmits(['edit', 'save', 'cancel', 'remove', 'update:editing'])

const expanded = ref(true)
const editingModel = computed({
  get: () => props.editing,
  set: (value) => emit('update:editing', value)
})
</script>

<template>
  <div>
    <UiCard class="flex items-center gap-3 px-4 py-3 transition hover:border-orbit-accent/25">
      <button
        v-if="account.children.length"
        type="button"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-orbit-muted
               transition hover:bg-white/5 hover:text-white"
        :aria-expanded="expanded"
        title="展开/收起"
        @click="expanded = !expanded"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="h-4 w-4 transition-transform"
          :class="expanded ? '' : '-rotate-90'"
        >
          <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span v-else class="h-6 w-6 shrink-0" aria-hidden="true" />

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <p class="truncate text-sm font-medium text-white">{{ account.name }}</p>
          <span
            v-for="flag in account.flags || []"
            :key="flag"
            class="rounded-full border border-orbit-warn/30 px-2 py-0.5 text-[10px] leading-none text-orbit-warn"
          >
            {{ flag }}
          </span>
        </div>

        <div v-if="editing?.name === account.name" class="mt-1.5 flex items-center gap-1.5">
          <UiInput
            :model-value="editing.set"
            size="sm"
            class="min-w-0 flex-1"
            :disabled="!!acting"
            @update:model-value="emit('update:editing', { ...editing, set: $event })"
            @keydown.enter.prevent="emit('save')"
          />
          <UiChip tone="ok" class="shrink-0" :disabled="!!acting" @click="emit('save')">保存</UiChip>
          <UiChip tone="accent" class="shrink-0" :disabled="!!acting" @click="emit('cancel')">取消</UiChip>
        </div>
        <p v-else class="mt-1 truncate text-xs text-orbit-muted" :title="account.description">
          {{ account.description || '—' }}
        </p>
      </div>

      <div v-if="admin && editing?.name !== account.name" class="flex shrink-0 items-center gap-1.5">
        <UiChip tone="accent" :disabled="!!acting" @click="emit('edit', account)">修改</UiChip>
        <UiChip
          v-if="account.name !== 'root'"
          tone="danger"
          :disabled="!!acting"
          @click="emit('remove', account)"
        >
          删除
        </UiChip>
      </div>
    </UiCard>

    <div v-if="expanded && account.children.length">
      <div
        v-for="(child, index) in account.children"
        :key="child.name"
        class="relative pl-12 pt-3"
      >
        <span
          class="absolute left-4 top-0 w-px -translate-x-1/2 bg-orbit-line"
          :class="index === account.children.length - 1 ? 'h-10' : 'h-full'"
          aria-hidden="true"
        />
        <span
          class="absolute left-4 top-11 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit-muted"
          aria-hidden="true"
        />
        <span class="absolute left-5 top-11 h-px w-7 -translate-y-1/2 bg-orbit-line" aria-hidden="true" />
        <AccountTreeItem
          v-model:editing="editingModel"
          :account="child"
          :admin="admin"
          :acting="acting"
          @edit="emit('edit', $event)"
          @save="emit('save')"
          @cancel="emit('cancel')"
          @remove="emit('remove', $event)"
        />
      </div>
    </div>
  </div>
</template>
