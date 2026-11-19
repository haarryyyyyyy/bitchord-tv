// In-app log, shown on Settings > Diagnostics so TV errors can be read without devtools.
export interface LogLine { at: number; level: 'info' | 'warn' | 'error'; text: string }

const lines: LogLine[] = []
const listeners = new Set<() => void>()

function push(level: LogLine['level'], text: string) {
  lines.push({ at: Date.now(), level, text })
  if (lines.length > 200) lines.shift()
  listeners.forEach((l) => l())
  ;(level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)('[bitchord]', text)
}

export const log = {
  info: (t: string) => push('info', t),
  warn: (t: string) => push('warn', t),
  error: (t: string) => push('error', t),
  lines: () => lines,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
