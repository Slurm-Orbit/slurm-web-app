<script setup>
definePageMeta({ middleware: 'console-auth', layout: 'console', title: 'New job' })

const route = useRoute()

const fileName = ref('')
const content = ref('')
const editorHost = ref(null)
const submitting = ref(false)
const error = ref('')

let editor = null
let resizeObserver = null

const canSubmit = computed(() => !!fileName.value.trim() && !submitting.value)

const MONACO_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#030610',
    'editorGutter.background': '#030610',
    'editorLineNumber.foreground': '#4a5262',
    'editorLineNumber.activeForeground': '#9a9ea6',
    'editor.lineHighlightBackground': '#ffffff0a'
  }
}

// Monaco only runs in the browser, so it is loaded on mount rather than bundled into SSR
async function mountEditor() {
  const [{ default: EditorWorker }, monaco, shell] = await Promise.all([
    import('monaco-editor/editor/editor.worker.js?worker'),
    import('monaco-editor/editor/editor.api.js'),
    import('monaco-editor/languages/definitions/shell/shell.js')
  ])

  self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
  monaco.editor.defineTheme('orbit', MONACO_THEME)
  monaco.languages.register({ id: 'shell' })
  monaco.languages.setLanguageConfiguration('shell', shell.conf)
  monaco.languages.setMonarchTokensProvider('shell', shell.language)

  editor = monaco.editor.create(editorHost.value, {
    value: content.value,
    language: 'shell',
    theme: 'orbit',
    minimap: { enabled: false },
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    overviewRulerLanes: 0,
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    tabSize: 2,
    automaticLayout: false
  })

  editor.onDidChangeModelContent(() => {
    content.value = editor.getValue()
  })

  resizeObserver = new ResizeObserver(() => editor?.layout())
  resizeObserver.observe(editorHost.value)
}

function back() {
  return navigateTo(`/console/${route.params.id}/jobs`)
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    await request('slurm:submit_job', {
      fileName: fileName.value.trim(),
      content: content.value
    })
    await back()
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

onMounted(mountEditor)

onUnmounted(() => {
  resizeObserver?.disconnect()
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UiCard class="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <UiButton class="shrink-0" @click="back">← Back to jobs</UiButton>
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-medium text-white">New job</h3>
        <p class="mt-0.5 truncate text-xs text-orbit-muted">
          The script is written to the given path, then submitted with sbatch
        </p>
      </div>
    </UiCard>

    <UiAlert v-if="error" class="mt-3">{{ error }}</UiAlert>

    <UiCard class="mt-3 flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-3 border-b border-orbit-line/60 px-5 py-3.5">
        <h3 class="text-sm font-medium text-white">Script</h3>
        <UiLabel>Job</UiLabel>
      </div>

      <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
        <UiLabel as="label" class="mb-1" for="job-file">File path</UiLabel>
        <UiInput
          id="job-file"
          v-model="fileName"
          placeholder="/home/me/job.slurm"
          autocomplete="off"
          class="w-full shrink-0"
          :disabled="submitting"
        />

        <UiLabel as="label" class="mb-1 mt-4">Content</UiLabel>
        <div
          ref="editorHost"
          class="min-h-64 flex-1 overflow-hidden rounded-xl border border-orbit-line transition focus-within:border-orbit-accent/50"
        />
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-orbit-line/60 px-5 py-3.5">
        <UiButton :disabled="submitting" @click="back">Discard</UiButton>
        <UiButton variant="accent" :disabled="!canSubmit" @click="submit">
          {{ submitting ? 'Submitting…' : 'Submit' }}
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>
