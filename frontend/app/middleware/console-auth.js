export default defineNuxtRouteMiddleware((to) => {
  const { hasSession } = useSocket()
  const backendId = to.params.id

  if (!backendId || !hasSession(backendId)) {
    return navigateTo('/')
  }
})
