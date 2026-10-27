import byteSize from 'bytes'
import prettyMs from 'pretty-ms'

const DASH = '—'
const MB = 1048576

function num(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function fmtBytes(value) {
  const n = num(value)
  return n === null || n < 0 ? DASH : byteSize.format(n, { unitSeparator: ' ', decimalPlaces: 1 })
}

export function fmt(value) {
  if (Array.isArray(value)) value = value.filter(Boolean).join(', ')
  return value == null || value === '' ? DASH : String(value)
}

/** scontrol/sacct 的 status 可能是字符串或数组，统一成一行文本 */
export function jobStatus(status) {
  return [].concat(status ?? []).filter(Boolean).join(' ')
}

/** 内存（MB）→ 人类可读容量 */
export function fmtSize(mb) {
  const n = num(mb)
  return n === null || n <= 0 ? DASH : fmtBytes(n * MB)
}

export function fmtLoad(value) {
  const n = num(value)
  return n === null ? DASH : n.toFixed(2)
}

/** sstat/sacct 时间："01-02:03:04"（天-时:分:秒）或 "02:03"（分:秒）→ 秒；uint64 垃圾值归一为 null */
export function parseSlurmTime(value) {
  const m = /^(?:(\d+)-)?(\d+):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim())
  if (!m) return null
  const [, d = 0, a, b, c] = m
  if (Number(d) > 100000) return null
  const sec = (Number(a) * 60 + Number(b)) * (c === undefined ? 1 : 60) + Number(c || 0)
  return Number(d) * 86400 + sec
}

export function fmtSlurmTime(value) {
  return parseSlurmTime(value) === null ? DASH : String(value)
}

/** sstat 容量格式："1.5G" / "200M" / "64K" / "512" → MB（纯数字按 MB，bytes 需要 B 后缀） */
export function parseSlurmSize(value) {
  const s = String(value ?? '').trim()
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  const bytes = byteSize.parse(/[KMGT]$/i.test(s) ? `${s}B` : s)
  return bytes === null ? null : bytes / MB
}

export function fmtLimit(minutes) {
  const n = num(minutes)
  if (n === null || n <= 0) return DASH
  return n >= 525600 ? '∞' : `${n} min`
}

export function fmtDate(value) {
  const d = new Date(value ?? NaN)
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : DASH
}

export function fmtDuration(ms) {
  const n = num(ms)
  return n === null || n <= 0 ? DASH : prettyMs(n, { unitCount: 2, secondsDecimalDigits: 0 })
}

/** 作业/节点状态 → 语义色 */
export function stateClass(state) {
  const s = jobStatus(state).toLowerCase()
  if (/cancel|fail|timeout|oom|down|drain/.test(s)) return 'text-orbit-danger'
  if (/idle|running/.test(s)) return 'text-orbit-ok'
  if (/pending|suspend|alloc|mix/.test(s)) return 'text-orbit-warn'
  return 'text-orbit-muted'
}

export function jobElapsed(job) {
  const start = new Date(job.startTime ?? NaN).getTime()
  if (!Number.isFinite(start)) return DASH
  return fmtDuration(new Date(job.endTime ?? Date.now()).getTime() - start)
}
