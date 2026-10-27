export function fmt(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function fmtSize(mb) {
  const n = Number(mb)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const trim = (v) => Math.round(v * 10) / 10
  return n >= 1024 ? `${trim(n / 1024)} GB` : `${trim(n)} MB`
}

/** sstat 磁盘字段（MaxDiskRead/MaxDiskWrite）是无后缀的原始字节数 */
export function fmtDiskBytes(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return fmtSize(n / 1048576)
}

export function fmtBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

export function fmtLoad(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

/** sstat 时间格式："01-02:03:04"（天-时:分:秒）或 "02:03"（分:秒）→ 秒 */
export function parseSlurmTime(value) {
  if (!value) return null
  const m = /^(?:(\d+)-)?(\d+):(\d{2})(?::(\d{2}))?$/.exec(String(value).trim())
  if (!m) return null
  const days = Number(m[1] || 0)
  // Slurm 用 uint64 最大值表示"无数据"，显示为约 2.1 亿天的垃圾值
  if (days > 100000) return null
  const a = Number(m[2])
  const b = Number(m[3])
  if (m[4] !== undefined) return ((days * 24 + a) * 60 + b) * 60 + Number(m[4])
  return days * 86400 + a * 60 + b
}

/** Slurm 时间原样展示，垃圾值归一为 — */
export function fmtSlurmTime(value) {
  return parseSlurmTime(value) == null ? '—' : String(value)
}

/** sstat 容量格式："1.5G" / "200M" / "64K" → MB */
export function parseSlurmSize(value) {
  if (value == null || value === '') return null
  const m = /^([\d.]+)\s*([KMGT]?)B?$/i.exec(String(value).trim())
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const mult = { '': 1, K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 }[m[2].toUpperCase()]
  return n * mult
}

export function fmtLimit(minutes) {
  const n = Number(minutes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n >= 525600 ? '∞' : `${n} min`
}

export function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function fmtDuration(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const s = Math.floor(n / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

export function jobStatus(status) {
  return (Array.isArray(status) ? status : [status]).filter(Boolean).join(' ')
}

export function jobStateClass(status) {
  const s = jobStatus(status).toLowerCase()
  if (s.includes('running')) return 'text-orbit-ok'
  if (s.includes('pending') || s.includes('suspend')) return 'text-orbit-warn'
  if (s.includes('cancel') || s.includes('fail') || s.includes('timeout') || s.includes('oom')) return 'text-orbit-danger'
  return 'text-orbit-muted'
}

export function jobElapsed(job) {
  const start = job.startTime ? new Date(job.startTime).getTime() : NaN
  if (!Number.isFinite(start)) return '—'
  const end = job.endTime ? new Date(job.endTime).getTime() : Date.now()
  return fmtDuration(end - start)
}

export function nodeStateClass(state) {
  const s = (Array.isArray(state) ? state.join(' ') : String(state || '')).toLowerCase()
  if (s.includes('down') || s.includes('drain') || s.includes('fail')) return 'text-orbit-danger'
  if (s.includes('idle')) return 'text-orbit-ok'
  if (s.includes('alloc') || s.includes('mix')) return 'text-orbit-warn'
  return 'text-orbit-muted'
}
