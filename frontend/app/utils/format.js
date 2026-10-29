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

/** scontrol/sacct may return status as a string or array; normalize to one line */
export function jobStatus(status) {
  return [].concat(status ?? []).filter(Boolean).join(' ')
}

/** Hold/Release only apply while the job waits in the queue */
export function isJobPending(job) {
  return jobStatus(job?.status).toLowerCase().includes('pending')
}

/** squeue reports a held job as PENDING + hold=true; sacct history rows omit the field */
export function isJobHeld(job) {
  return !!job?.hold
}

/** Status label with the hold reason, e.g. "PENDING (held)" */
export function jobStateLabel(job) {
  const status = jobStatus(job?.status)
  return isJobHeld(job) ? `${status} (held)` : status
}

/** Memory in MB → human readable size */
export function fmtSize(mb) {
  const n = num(mb)
  return n === null || n <= 0 ? DASH : fmtBytes(n * MB)
}

export function fmtLoad(value) {
  const n = num(value)
  return n === null ? DASH : n.toFixed(2)
}

/** sstat/sacct time "01-02:03:04" (d-h:m:s) or "02:03" (m:s) → seconds; garbage uint64 becomes null */
export function parseSlurmTime(value) {
  const m = /^(?:(\d+)-)?(\d+):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim())
  if (!m) return null
  const [, d = 0, a, b, c] = m
  if (Number(d) > 100000) return null
  const sec = (Number(a) * 60 + Number(b)) * (c === undefined ? 1 : 60) + Number(c || 0)
  return Number(d) * 86400 + sec
}

export function fmtSlurmTime(value) {
  const sec = parseSlurmTime(value)
  return sec === null ? DASH : fmtDuration(sec * 1000)
}

/** sstat size "1.5G" / "200M" / "64K" / "512" → human readable size */
export function fmtSlurmSize(value) {
  const mb = parseSlurmSize(value)
  return mb === null ? DASH : fmtSize(mb)
}

/** sstat frequency "2.70M" / "3100M" / "0" → MHz integer, null when not reported */
export function fmtCpuFreq(value) {
  const s = String(value ?? '').trim()
  if (!s) return DASH
  const m = /^(\d+(?:\.\d+)?)([KMGT]?)$/i.exec(s)
  if (!m) return DASH
  const scale = { '': 1, K: 1e-3, M: 1, G: 1e3, T: 1e6 }[m[2].toUpperCase()] ?? 1
  const mhz = Number(m[1]) * scale
  return mhz > 0 ? `${Math.round(mhz)} MHz` : DASH
}

/** sstat size "1.5G" / "200M" / "64K" / "512" → MB (bare numbers are MB, bytes need a B suffix) */
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

/** Job/node state → semantic color */
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

export function fmtPercent(value, total) {
  return total ? `${(value / total) * 100}%` : '0%'
}