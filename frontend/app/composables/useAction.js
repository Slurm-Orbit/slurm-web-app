export function useAction(after) {
  const error = ref('')
  const notice = ref('')
  const acting = ref('')

  async function run(key, call, okMsg) {
    if (acting.value) return false
    acting.value = key
    error.value = ''
    notice.value = ''
    try {
      await call()
      await after?.()
      notice.value = okMsg
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      acting.value = ''
    }
  }

  return { error, notice, acting, run }
}
