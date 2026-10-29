/**
 * Registers the page loader with the console layout, which owns the refresh button,
 * the pending state and the timestamp. Returns refresh so the page can load on mount
 * and reload after mutations through the same path.
 */
export function usePageRefresh(load) {
  const page = inject('pageRefresh')

  // The incoming page registers before the outgoing page unmounts, so the timestamp
  // belongs to the previous page until this one finishes its first load
  page.load = load
  page.updatedAt = null

  onUnmounted(() => {
    if (page.load !== load) return
    page.load = null
  })

  return page.refresh
}
