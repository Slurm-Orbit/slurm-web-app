import { Server as Engine } from 'engine.io'
import { Server } from 'socket.io'
import { defineEventHandler } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  const engine = new Engine()
  const io = new Server()
  io.bind(engine)

  const allSockets = () => io.sockets.sockets.values()
  const onlineBackends = () => [...allSockets()].map((s) => s.data.backend).filter(Boolean)
  const agentOf = (id) => id && [...allSockets()].find((s) => s.data.backend?.id === id)

  const broadcast = () => {
    io.to('browsers').emit('backends:update', { backends: onlineBackends() })
  }

  io.on('connection', (socket) => {
    if (socket.handshake.auth?.role === 'backend') {
      socket.on('backend:register', (meta, ack) => {
        socket.data.backend = meta
        ack?.({ ok: true })
        broadcast()
      })

      socket.on('disconnect', () => {
        const backend = socket.data.backend
        if (!backend) return
        socket.data.backend = null
        for (const other of allSockets()) {
          if (other.data.session === backend.id) other.data.session = null
        }
        broadcast()
      })
    } else {
      socket.join('browsers')
      socket.emit('backends:snapshot', { backends: onlineBackends() })

      socket.on('session:open', async ({ id, password }, ack) => {
        const agent = agentOf(id)
        if (!agent) {
          return ack?.({ ok: false, error: `unknown backend: ${id}` })
        }

        const res = await agent.emitWithAck('session:enter', {
          browserId: socket.id, backendId: id, password
        })
        if (!res?.ok) {
          return ack?.(res)
        }

        socket.data.session = id
        ack?.({ ok: true, backend: agent.data.backend })
      })

      socket.onAny(async (event, payload, ack) => {
        if (!event.startsWith('slurm:')) return

        const agent = agentOf(socket.data.session)
        if (!agent) return ack?.({ ok: false, error: 'no active session' })

        ack?.(await agent.emitWithAck(event, payload))
      })
    }
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
          const { nodeReq, ws } = peer._internal
          engine.prepare(nodeReq)
          engine.onWebSocket(nodeReq, nodeReq.socket, ws)
        }
      }
    })
  )
})