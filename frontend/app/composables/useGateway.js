import { io } from 'socket.io-client'

let socket = null

export function useGateway() {
  const gateway = useState('gateway', () => ({}))

  /** Sync the dictionary with the id list from the gateway, reusing existing entries */
  function sync(ids) {
    const next = {}
    for (const id of ids) {
      next[id] = gateway.value[id] ?? { password: '', error: '' }
    }
    gateway.value = next
  }

  if (import.meta.client && !socket) {
    socket = io({
      path: '/socket.io/',
      auth: { role: 'browser' },
      timeout: 8000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    })
    socket.on('backends:snapshot', (payload) => sync(payload?.backends ?? []))
    socket.on('backends:update', (payload) => sync(payload?.backends ?? []))
    socket.on('disconnect', () => sync([]))
  }

  return gateway
}

/** Send a request through the gateway (event is the name the agent listens on) */
export function request(event, payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('gateway not ready'))
      return
    }
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('gateway timeout'))
      if (!res?.ok) return reject(new Error(res?.error || 'request failed'))
      resolve(res.data)
    })
  })
}
