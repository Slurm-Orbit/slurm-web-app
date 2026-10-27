import { Server as Engine } from 'engine.io'
import { Server } from 'socket.io'
import { defineEventHandler } from 'h3'
import { randomUUID } from 'node:crypto'

/**
 * Orbital 网关：跑在前端 Nuxt/Nitro 进程内。
 * - role=backend：集群上的 agent（CLI），向网关注册自己
 * - role=browser：浏览器用户，订阅已上线的 backend 列表并选择进入
 *
 * backend:select 会把访问密钥转发给 agent 校验，通过后签发 sessionToken。
 */
export default defineNitroPlugin((nitroApp) => {
  const backends = new Map()
  const sessions = new Map()

  // 浏览器可转发的 slurmjs 信号
  const slurmEvents = [
    'slurm:version',
    'slurm:list_queue',
    'slurm:list_history',
    'slurm:list_cluster',
    'slurm:list_nodes',
    'slurm:list_accounts',
    'slurm:job_stat',
    'slurm:job_output',
    'slurm:submit_job',
    'slurm:cancel_job',
    'slurm:hold_job',
    'slurm:release_job',
    'slurm:update_node',
    'slurm:add_account',
    'slurm:modify_account',
    'slurm:delete_account'
  ]

  const engine = new Engine()
  const io = new Server()
  io.bind(engine)
  nitroApp.__orbitalIo = io

  const listBackends = () =>
    [...backends.values()].map(({ meta }) => ({ ...meta }))

  const broadcastBackends = () => {
    io.to('browsers').emit('backends:update', { backends: listBackends() })
  }

  // 浏览器事件 → 其会话绑定的 agent 的中继
  const relayToAgent = async (socket, event, payload, ack) => {
    const session = sessions.get(socket.id)
    if (!session) {
      ack?.({ ok: false, error: 'no active session' })
      return
    }
    const entry = backends.get(session.backendId)
    const agent = entry && io.sockets.sockets.get(entry.socketId)
    if (!agent) {
      ack?.({ ok: false, error: 'backend unreachable' })
      return
    }
    try {
      ack?.(await agent.timeout(10000).emitWithAck(event, payload))
    } catch {
      ack?.({ ok: false, error: 'agent timeout' })
    }
  }

  io.on('connection', (socket) => {
    const role = socket.handshake.auth?.role || socket.handshake.query?.role || 'browser'
    socket.data.role = role

    if (role === 'backend') {
      console.log(`[gateway] backend socket ${socket.id} connected`)

      socket.on('backend:register', (meta, ack) => {
        if (!meta?.id || typeof meta.id !== 'string') {
          ack?.({ ok: false, error: 'missing backend id' })
          return
        }

        for (const [id, entry] of backends) {
          if (id === meta.id && entry.socketId !== socket.id) {
            io.sockets.sockets.get(entry.socketId)?.disconnect(true)
            backends.delete(id)
          }
        }

        const str = (v) => (typeof v === 'string' ? v : '')
        const normalized = {
          id: meta.id,
          slurmInstalled: !!meta.slurmInstalled,
          isRoot: !!meta.isRoot,
          hostname: str(meta.hostname),
          username: str(meta.username),
          version: str(meta.version),
          node: str(meta.node)
        }
        socket.data.backendId = normalized.id
        backends.set(normalized.id, { socketId: socket.id, meta: normalized })
        console.log(`[gateway] backend registered: ${normalized.id}`)
        ack?.({ ok: true })
        broadcastBackends()
      })

      socket.on('disconnect', () => {
        const id = socket.data.backendId
        if (id && backends.get(id)?.socketId === socket.id) {
          backends.delete(id)
          console.log(`[gateway] backend offline: ${id}`)
          broadcastBackends()
        }
      })
      return
    }

    socket.join('browsers')
    console.log(`[gateway] browser ${socket.id} connected`)

    socket.emit('gateway:ready', {
      socketId: socket.id,
      backends: listBackends()
    })

    socket.on('backend:select', async (payload, ack) => {
      const backendId = typeof payload === 'string' ? payload : payload?.id
      const password = typeof payload === 'string' ? undefined : payload?.password

      if (!backendId || typeof backendId !== 'string') {
        ack?.({ ok: false, error: 'missing backend id' })
        return
      }
      if (!password || typeof password !== 'string') {
        ack?.({ ok: false, error: 'access key required' })
        return
      }

      const entry = backends.get(backendId)
      if (!entry) {
        ack?.({ ok: false, error: `unknown backend: ${backendId}` })
        return
      }

      const agent = io.sockets.sockets.get(entry.socketId)
      if (!agent) {
        backends.delete(backendId)
        broadcastBackends()
        ack?.({ ok: false, error: 'backend unreachable' })
        return
      }

      try {
        // 中间层：把密钥转给 agent，由 agent 校验后再放行
        const res = await agent.timeout(5000).emitWithAck('session:enter', {
          browserId: socket.id,
          backendId,
          password
        })
        if (!res?.ok) {
          ack?.({ ok: false, error: res?.error || 'agent rejected session' })
          return
        }

        const token = randomUUID()
        sessions.set(socket.id, { backendId, token })
        ack?.({ ok: true, backend: entry.meta, token })
      } catch {
        ack?.({ ok: false, error: 'agent timeout' })
      }
    })

    // 浏览器 → agent 的 slurmjs 调用中继（要求已建立会话）
    for (const event of slurmEvents) {
      socket.on(event, (payload, ack) => relayToAgent(socket, event, payload, ack))
    }

    socket.on('disconnect', () => {
      sessions.delete(socket.id)
      console.log(`[gateway] browser ${socket.id} disconnected`)
    })
  })

  nitroApp.router.use(
    '/socket.io/',
    defineEventHandler({
      handler(event) {
        engine.handleRequest(event.node.req, event.node.res)
        event._handled = true
      },
      websocket: {
        open(peer) {
          const nodeReq = peer._internal?.nodeReq || peer.ctx?.node?.req
          const nodeSocket = nodeReq?.socket
          if (!nodeReq || !nodeSocket) {
            console.warn('[gateway] websocket open missing node context')
            return
          }
          engine.prepare(nodeReq)
          engine.onWebSocket(nodeReq, nodeSocket, peer.websocket)
        }
      }
    })
  )

  console.log('[gateway] socket.io bound via nitro router')
})
