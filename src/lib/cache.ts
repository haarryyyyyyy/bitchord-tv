// Responses are kept for a while so switching tabs and going Back never refetches.
const entries = new Map<string, { at: number; p: Promise<unknown> }>()

export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = 10 * 60000): Promise<T> {
  const e = entries.get(key)
  if (e && Date.now() - e.at < ttlMs) return e.p as Promise<T>
  const p = fn()
  entries.set(key, { at: Date.now(), p })
  p.catch(() => entries.delete(key))
  if (entries.size > 80) entries.delete(entries.keys().next().value as string)
  return p
}
