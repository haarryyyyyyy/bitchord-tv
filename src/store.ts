// Tiny observable store + what the TV remembers (localStorage): settings, play history, likes.
import { useEffect, useState } from 'preact/hooks'
import type { Track } from './sources/types'

export interface Store<T> {
  get(): T
  set(next: T | ((prev: T) => T)): void
  subscribe(fn: (v: T) => void): () => void
}

export function createStore<T>(initial: T, persistKey?: string): Store<T> {
  let value = initial
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey)
      if (raw) value = typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...JSON.parse(raw) } : JSON.parse(raw)
    } catch {}
  }
  const listeners = new Set<(v: T) => void>()
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next
      if (persistKey)
        try {
          localStorage.setItem(persistKey, JSON.stringify(value))
        } catch {}
      listeners.forEach((l) => l(value))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  const [v, setV] = useState(store.get())
  useEffect(() => {
    setV(store.get())
    return store.subscribe(setV)
  }, [store])
  return v
}

export interface Settings {
  /** Play JioSaavn's 320 kbps copy of a YouTube track when it is the same recording. */
  preferSaavn: boolean
  /** Opus (WebM) from YouTube when the TV can decode it; AAC otherwise. */
  preferOpus: boolean
  /** Keep playing YouTube Music radio when the queue runs out. */
  autoplay: boolean
  /** Lyrics open with Now Playing. */
  showLyrics: boolean
}

export const settings = createStore<Settings>({ preferSaavn: true, preferOpus: false, autoplay: true, showLyrics: true }, 'bc.settings')

export interface Play {
  t: Track
  /** When it was played (ms). */
  at: number
  /** How much of it was heard, 0..1. */
  done: number
}

export const history = createStore<Play[]>([], 'bc.history')
export const liked = createStore<Track[]>([], 'bc.liked')

export const MAX_HISTORY = 400

export function recordPlay(t: Track, done: number) {
  // Images and links are kept; long fields trimmed so localStorage stays small.
  const slim: Track = { ...t, artists: (t.artists || []).slice(0, 3) }
  history.set((h) => [{ t: slim, at: Date.now(), done: Math.round(done * 100) / 100 }, ...h].slice(0, MAX_HISTORY))
}

export const isLiked = (id: string) => liked.get().some((t) => t.id === id)

export function toggleLike(t: Track) {
  liked.set((l) => (l.some((x) => x.id === t.id) ? l.filter((x) => x.id !== t.id) : [t, ...l]))
}
