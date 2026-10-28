export default defineNuxtRouteMiddleware(async (to) => {
  const gateway = useGateway()
  const backendId = to.params.id
  const entry = gateway.value[backendId]

  if (!entry) return navigateTo('/')
  if (!entry.password) return navigateTo('/')

  entry.error = ''
  try {
    await request('session:open', { id: backendId, password: entry.password }, 8000)
  } catch (e) {
    entry.error = e.message
    return navigateTo('/')
  }
})
