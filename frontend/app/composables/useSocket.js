import { io } from 'socket.io-client'

let socket = null

/**
 * 浏览器 ↔ 前端网关状态：
 * idle → connecting → ready
 * backends[] 由已上线的 agent（后端 CLI）实时推送；空数组 = 没有 agent。
 * socket 断开后服务端会话即失效（按 socket.id 索引），因此清空会话并退回网关页。
 */
export function useSocket() {
  const status = useState('socket.status', () => 'idle')
  const backends = useState('socket.backends', () => [])
  const selected = useState('socket.selected', () => null)
  const router = useRouter()

  function connect() {
    if (!import.meta.client) return
    if (socket) {
      socket.connect()
      return
    }

    status.value = 'connecting'

    socket = io({
      path: '/socket.io/',
      auth: { role: 'browser' },
      timeout: 8000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    })

    // 连上后先取一次全量快照，之后靠 backends:update 增量推送
    socket.on('backends:snapshot', (payload) => {
      status.value = 'ready'
      backends.value = payload?.backends ?? []
    })

    socket.on('backends:update', (payload) => {
      backends.value = payload?.backends ?? []
    })

    socket.on('disconnect', (reason) => {
      const hadSession = !!selected.value
      backends.value = []
      selected.value = null
      // 网关主动断开：当成没有 agent，不再进入离线
      status.value = reason === 'io server disconnect' ? 'ready' : 'connecting'
      if (hadSession) router.push('/')
    })
  }

  /** 经网关发请求，返回完整 ack（{ ok, data | error }） */
  function request(event, payload, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (status.value !== 'ready') {
        reject(new Error('gateway not ready'))
        return
      }
      socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
        if (err) return reject(new Error('gateway timeout'))
        if (!res?.ok) return reject(new Error(res?.error || 'request failed'))
        resolve(res)
      })
    })
  }

  /** 携带访问密钥请求进入指定后端（网关转发 agent 校验后建立会话） */
  async function openSession(id, password) {
    const res = await request('session:open', { id, password }, 8000)
    selected.value = res.backend
    return res.backend
  }

  /** 网关推送的最新 meta，离线时退回选择时的会话快照 */
  function backendMeta(id) {
    return backends.value.find((b) => b.id === id) || selected.value
  }

  /** 供路由中间件确认当前页会话仍有效 */
  function hasSession(backendId) {
    return selected.value?.id === backendId
  }

  /** 经网关向当前会话的 agent 发请求并取回 data */
  async function agentRequest(event, payload) {
    return (await request(event, payload)).data
  }

  /** slurmjs 调用，每个信号独立 */
  const slurm = {
    version: () => agentRequest('slurm:version'),
    listQueue: () => agentRequest('slurm:list_queue'),
    listHistory: () => agentRequest('slurm:list_history'),
    listCluster: () => agentRequest('slurm:list_cluster'),
    listNodes: () => agentRequest('slurm:list_nodes'),
    listAccounts: () => agentRequest('slurm:list_accounts'),
    jobStat: (jobId, target) => agentRequest('slurm:job_stat', { jobId, target }),
    jobOutput: (path) => agentRequest('slurm:job_output', { path }),
    cancelJob: (jobId) => agentRequest('slurm:cancel_job', { jobId }),
    holdJob: (jobId) => agentRequest('slurm:hold_job', { jobId }),
    releaseJob: (jobId) => agentRequest('slurm:release_job', { jobId }),
    updateNode: (nodeName, state) => agentRequest('slurm:update_node', { nodeName, state }),
    addAccount: (name, parent, description) =>
      agentRequest('slurm:add_account', { name, parent, description }),
    modifyAccount: (where, set) => agentRequest('slurm:modify_account', { where, set }),
    deleteAccount: (name) => agentRequest('slurm:delete_account', { name })
  }

  return {
    status,
    backends,
    connect,
    openSession,
    hasSession,
    backendMeta,
    slurm
  }
}
