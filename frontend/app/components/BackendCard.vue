<script setup>
defineProps({
  backendId: { type: String, required: true },
  error: { type: String, default: '' }
})

const emit = defineEmits(['enter'])

const password = ref('')

function submit() {
  if (!password.value) return
  emit('enter', password.value)
}
</script>

<template>
  <UiCard
    class="relative flex w-full flex-col overflow-hidden p-5 text-left transition-shadow duration-200
           hover:shadow-[0_0_0_1px_rgba(220,220,230,0.35),0_12px_40px_rgba(200,205,220,0.22)]"
  >
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <UiLabel>Agent</UiLabel>
        <h3 class="mt-1 text-lg font-semibold tracking-tight text-white">{{ backendId }}</h3>
      </div>
    </div>

    <UiLabel as="label" class="mb-1" :for="`pw-${backendId}`">Access key</UiLabel>
    <UiInput
      :id="`pw-${backendId}`"
      v-model="password"
      type="password"
      autocomplete="off"
      placeholder="••••••••"
      class="mb-3 w-full"
      @keydown.enter.prevent="submit"
    />

    <p v-if="error" class="mb-3 text-xs text-orbit-danger">{{ error }}</p>

    <button
      type="button"
      class="mt-auto flex w-full items-center justify-between border-t border-orbit-line pt-4
             text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!password"
      @click="submit"
    >
      <span class="text-orbit-accent">Enter</span>
      <span class="text-orbit-muted">→</span>
    </button>
  </UiCard>
</template>
