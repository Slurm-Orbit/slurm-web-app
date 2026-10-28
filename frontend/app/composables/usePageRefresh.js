/**
 * 页面把加载动作交给 console 布局：刷新按钮在标题栏，由布局统一触发并维护等待状态与更新时间。
 * 返回 refresh 供首次加载和操作后重新拉取，与标题栏按钮走同一条路径。
 */
export function usePageRefresh(load) {
  const page = inject('pageRefresh')

  page.load = load
  onUnmounted(() => {
    page.load = null
  })

  return page.refresh
}
