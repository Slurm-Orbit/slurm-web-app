<script setup>
const { status, backends, connect, selectBackend } = useSocket()

const enteringId = ref(null)
const cardErrors = ref({})

const waitingForAgent = computed(
  () => status.value === 'connecting' || (status.value === 'ready' && backends.value.length === 0)
)

onMounted(() => connect())

async function enter({ backend, password }) {
  if (enteringId.value) return
  enteringId.value = backend.id
  cardErrors.value = { ...cardErrors.value, [backend.id]: '' }
  try {
    await selectBackend(backend.id, password)
    await navigateTo(`/console/${backend.id}`)
  } catch (e) {
    cardErrors.value = { ...cardErrors.value, [backend.id]: e.message }
  } finally {
    enteringId.value = null
  }
}
</script>

<template>
  <div class="relative isolate min-h-screen">
    <BinaryField />

    <div class="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img src="/icon.svg" alt="" class="h-8 w-8 brightness-0 invert opacity-90" />
          <div>
            <p class="text-sm font-semibold tracking-tight text-white">Slurm Orbital</p>
            <p class="text-xs text-orbit-muted">Distributed compute gateway</p>
          </div>
        </div>
        <StatusIndicator :count="backends.length" />
      </header>

      <main class="flex flex-1 flex-col justify-center py-12">
        <div class="mb-10 max-w-xl">
          <p class="mb-3 text-xs uppercase tracking-[0.2em] text-orbit-accent">Gateway</p>
          <h1 class="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Connect to your cluster
          </h1>
          <p class="mt-4 text-base leading-relaxed text-orbit-muted">
            Agents register here from your servers. Pick a backend to open its console.
          </p>
        </div>

        <!-- Waiting -->
        <section
          v-if="waitingForAgent"
          class="max-w-lg rounded-2xl border border-orbit-line bg-orbit-card p-7 shadow-glow backdrop-blur-md"
        >
          <div class="flex items-start gap-4">
            <UiSpinner class="mt-0.5" />
            <div>
              <h2 class="text-lg font-semibold text-white">
                {{ status === 'connecting' ? 'Linking to gateway' : 'Waiting for agents' }}
              </h2>
              <p class="mt-2 text-sm leading-relaxed text-orbit-muted">
                <template v-if="status === 'connecting'">Opening a realtime channel…</template>
                <template v-else>
                  On your Slurm host, run:
                  <code class="mt-2 block rounded-lg border border-orbit-line bg-black/30 px-3 py-2 text-xs text-orbit-accent">
                    server start &lt;this-url&gt;
                  </code>
                </template>
              </p>
            </div>
          </div>
        </section>

        <!-- Backends -->
        <section v-else>
          <div class="mb-4 flex items-end justify-between gap-3">
            <h2 class="text-sm font-medium text-orbit-muted">Available backends</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <BackendCard
              v-for="b in backends"
              :key="b.id"
              :backend="b"
              :entering="enteringId === b.id"
              :error="cardErrors[b.id] || ''"
              @enter="enter"
            />
          </div>
        </section>
      </main>

    </div>
  </div>
</template>
