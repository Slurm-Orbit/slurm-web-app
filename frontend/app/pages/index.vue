<script setup>
const gateway = useGateway()

function enter(entry, id) {
  if (!entry.password) return
  entry.error = ''
  navigateTo(`/console/${id}`)
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden">
    <div class="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <BackdropAmbientLight class="absolute -left-24 -top-32 h-[420px] w-[420px] bg-white/10 blur-[130px]" />
      <BackdropAmbientLight class="absolute -right-16 -bottom-40 h-[520px] w-[520px] bg-white/[0.06] blur-[150px]" />
      <BackdropAmbientLight class="absolute left-1/2 top-[28%] h-[260px] w-[520px] -translate-x-1/2 bg-white/[0.04] blur-[110px]" />
      <BackdropGrid />
      <BackdropBinaryField />
    </div>

    <div class="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img src="/icon.svg" alt="" class="h-8 w-8 brightness-0 invert opacity-90">
          <div>
            <p class="text-sm font-semibold tracking-tight text-white">Slurm Orbital</p>
            <p class="text-xs text-orbit-muted">Distributed compute gateway</p>
          </div>
        </div>
        <StatusIndicator :count="Object.keys(gateway).length" />
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
        <UiCard v-if="!Object.keys(gateway).length" glow class="max-w-lg p-7">
          <div class="flex items-start gap-4">
            <UiSpinner class="mt-0.5" />
            <div>
              <h2 class="text-lg font-semibold text-white">Waiting for agents</h2>
              <p class="mt-2 text-sm leading-relaxed text-orbit-muted">
                On your Slurm host, run:
                <code class="mt-2 block rounded-lg border border-orbit-line bg-black/30 px-3 py-2 text-xs text-orbit-accent">
                  server start &lt;this-url&gt;
                </code>
              </p>
            </div>
          </div>
        </UiCard>

        <!-- Backends -->
        <section v-else>
          <div class="mb-4 flex items-end justify-between gap-3">
            <h2 class="text-sm font-medium text-orbit-muted">Available backends</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiCard
              v-for="(entry, id) in gateway"
              :key="id"
              class="relative flex w-full flex-col overflow-hidden p-5 text-left transition-shadow duration-200
                     hover:shadow-[0_0_0_1px_rgba(220,220,230,0.35),0_12px_40px_rgba(200,205,220,0.22)]"
            >
              <div class="mb-4 flex items-start justify-between gap-3">
                <div>
                  <UiLabel>Agent</UiLabel>
                  <h3 class="mt-1 text-lg font-semibold tracking-tight text-white">{{ id }}</h3>
                </div>
              </div>

              <UiLabel as="label" class="mb-1" :for="`pw-${id}`">Access key</UiLabel>
              <UiInput
                :id="`pw-${id}`"
                v-model="entry.password"
                type="password"
                autocomplete="off"
                placeholder="••••••••"
                class="mb-3 w-full"
                @keydown.enter.prevent="enter(entry, id)"
              />

              <p v-if="entry.error" class="mb-3 text-xs text-orbit-danger">{{ entry.error }}</p>

              <button
                type="button"
                class="mt-auto flex w-full items-center justify-between border-t border-orbit-line pt-4
                       text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!entry.password"
                @click="enter(entry, id)"
              >
                <span class="text-orbit-accent">Enter</span>
                <span class="text-orbit-muted">→</span>
              </button>
            </UiCard>
          </div>
        </section>
      </main>

    </div>
  </div>
</template>
