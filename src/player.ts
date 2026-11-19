// The player: one <audio> element, a queue, AutoPlay radio, history logging, sleep timer.
import { errText, log } from './lib/log'
import { resolveStream } from './sources/resolve'
import type { Stream, Track } from './sources/types'
import * as ytm from './sources/ytm'
import { createStore, recordPlay, settings } from './store'

export type Repeat = 'off' | 'all' | 'one'

export interface PlayerState {
  queue: Track[]
  index: number
  playing: boolean
  loading: boolean
  stream: Stream | null
  error: string | null
  shuffle: boolean
  repeat: Repeat
  sleepAt: number | null
}

export const player = createStore<PlayerState>({ queue: [], index: -1, playing: false, loading: false, stream: null, error: null, shuffle: false, repeat: 'off', sleepAt: null })

/** Position is kept apart from the state so 4 updates a second don't re-render every screen. */
export const position = createStore({ time: 0, duration: 0 })

export const current = () => {
  const s = player.get()
  return s.queue[s.index] || null
}

const audio = typeof document !== 'undefined' ? document.createElement('audio') : (null as unknown as HTMLAudioElement)
if (audio) {
  audio.preload = 'auto'
  document.body.appendChild(audio)
}
const patch = (p: Partial<PlayerState>) => player.set((s) => ({ ...s, ...p }))

// ---- Stream resolving with look-ahead --------------------------------------------

const ahead = new Map<string, { at: number; s: Stream }>()
const FRESH_MS = 30 * 60000

async function streamFor(t: Track): Promise<Stream> {
  const hit = ahead.get(t.id)
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.s
  const s = await resolveStream(t, settings.get())
  ahead.set(t.id, { at: Date.now(), s })
  if (ahead.size > 20) ahead.delete(ahead.keys().next().value as string)
  return s
}

function prefetchNext() {
  const s = player.get()
  const n = s.queue[s.index + 1]
  if (n && !ahead.has(n.id)) streamFor(n).catch(() => {})
}

// ---- Listening log --------------------------------------------------------------

let heard = 0
let lastTick = 0
let logged = false

function logListen() {
  const t = current()
  if (!t || logged) return
  const dur = position.get().duration || t.durationSec
  // Counts as a play after 30s or half the track, like scrobblers do.
  if (heard >= 30 || (dur && heard >= dur / 2)) {
    recordPlay(t, dur ? Math.min(1, heard / dur) : 1)
    logged = true
  }
}

// ---- Playback ------------------------------------------------------------------------

let token = 0
let failures = 0

async function load(i: number) {
  const s = player.get()
  const t = s.queue[i]
  if (!t) return
  logListen()
  heard = 0
  lastTick = 0
  logged = false
  const my = ++token
  patch({ index: i, loading: true, error: null, stream: null })
  position.set({ time: 0, duration: t.durationSec })
  try {
    const st = await streamFor(t)
    if (my !== token) return
    patch({ stream: st })
    audio.src = st.url
    await audio.play()
    failures = 0
  } catch (e) {
    if (my !== token) return
    ahead.delete(t.id)
    const msg = errText(e)
    // Autoplay policy: a TV app may refuse play() before the first key press.
    if (/play\(\)|user didn't interact|NotAllowedError/i.test(msg)) {
      log.warn('The TV blocked autoplay; waiting for Play')
      patch({ loading: false, playing: false, error: 'Press Play to start' })
      return
    }
    log.error(`Could not play "${t.title}": ${msg}`)
    patch({ loading: false, error: msg })
    if (++failures < 4) setTimeout(() => my === token && next(true), 2500)
  }
}

export function playTracks(tracks: Track[], start = 0) {
  if (!tracks.length) return
  const s = player.get()
  let queue = tracks.slice()
  let index = start
  if (s.shuffle) {
    const first = queue.splice(start, 1)[0]
    queue = [first].concat(shuffleList(queue))
    index = 0
  }
  player.set({ ...s, queue, index })
  load(index)
}

export function playNext(t: Track) {
  const s = player.get()
  if (s.index < 0) return playTracks([t])
  const queue = s.queue.slice()
  queue.splice(s.index + 1, 0, t)
  patch({ queue })
}

export function addToQueue(t: Track) {
  const s = player.get()
  if (s.index < 0) return playTracks([t])
  patch({ queue: s.queue.concat([t]) })
}

export function jumpTo(i: number) {
  load(i)
}

export async function next(auto = false) {
  const s = player.get()
  if (auto && s.repeat === 'one') return load(s.index)
  if (s.index < s.queue.length - 1) return load(s.index + 1)
  if (s.repeat === 'all' && s.queue.length) return load(0)
  if (settings.get().autoplay && current()) {
    const seed = current()!
    try {
      const yt = seed.source === 'ytm' ? seed : null
      const more = yt ? await ytm.radio(yt.id) : await ytm.searchSongs(seed.artist).catch(() => [] as Track[])
      const known = new Set(s.queue.map((t) => t.id))
      const fresh = more.filter((t) => !known.has(t.id) && !t.isVideo).slice(0, 25)
      if (fresh.length) {
        log.info(`AutoPlay: added ${fresh.length} tracks after "${seed.title}"`)
        patch({ queue: player.get().queue.concat(fresh) })
        return load(s.index + 1)
      }
    } catch (e) {
      log.warn(`AutoPlay failed: ${errText(e)}`)
    }
  }
  patch({ playing: false })
}

export function prev() {
  const s = player.get()
  if (audio.currentTime > 3 || s.index <= 0) {
    audio.currentTime = 0
    return
  }
  load(s.index - 1)
}

export function toggle() {
  if (!current()) return
  if (audio.paused) {
    if (!audio.src) return load(player.get().index)
    audio.play().catch((e) => log.warn(errText(e)))
  } else audio.pause()
}

export const pause = () => audio.pause()

export function seekTo(sec: number) {
  if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.5, sec))
}

export function seekBy(sec: number) {
  if (!audio.duration) return
  audio.currentTime = Math.max(0, Math.min(audio.duration - 1, audio.currentTime + sec))
}

export function toggleShuffle() {
  const s = player.get()
  if (!s.shuffle && s.index >= 0) {
    const rest = shuffleList(s.queue.slice(s.index + 1))
    patch({ shuffle: true, queue: s.queue.slice(0, s.index + 1).concat(rest) })
  } else patch({ shuffle: !s.shuffle })
}

export function cycleRepeat() {
  const order: Repeat[] = ['off', 'all', 'one']
  patch({ repeat: order[(order.indexOf(player.get().repeat) + 1) % 3] })
}

let sleepTimer: ReturnType<typeof setTimeout> | null = null
export function sleepIn(minutes: number | null) {
  if (sleepTimer) clearTimeout(sleepTimer)
  sleepTimer = null
  if (!minutes) return patch({ sleepAt: null })
  sleepTimer = setTimeout(() => (audio.pause(), patch({ sleepAt: null })), minutes * 60000)
  patch({ sleepAt: Date.now() + minutes * 60000 })
}

export function shuffleList<T>(list: T[]): T[] {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const x = a[i]
    a[i] = a[j]
    a[j] = x
  }
  return a
}

// ---- Audio element events -----------------------------------------------------------

if (audio) {
  audio.addEventListener('playing', () => patch({ playing: true, loading: false }))
  audio.addEventListener('pause', () => patch({ playing: false }))
  audio.addEventListener('waiting', () => patch({ loading: true }))
  audio.addEventListener('timeupdate', () => {
    const now = audio.currentTime
    const d = now - lastTick
    if (d > 0 && d < 2) heard += d
    lastTick = now
    position.set({ time: now, duration: audio.duration || current()?.durationSec || 0 })
    if (audio.duration && audio.duration - now < 25) prefetchNext()
  })
  audio.addEventListener('ended', () => {
    logListen()
    next(true)
  })
  audio.addEventListener('error', () => {
    const t = current()
    const code = audio.error ? audio.error.code : 0
    if (!t || !audio.src) return
    const s = player.get().stream
    log.error(`Audio error ${code} on "${t.title}" (${s ? s.from + ' ' + s.codec : '?'})`)
    ahead.delete(t.id)
    // Opus not decodable after all: retry once as AAC.
    if (code === 4 && s && s.codec === 'Opus' && settings.get().preferOpus) {
      settings.set((x) => ({ ...x, preferOpus: false }))
      log.warn('This TV could not decode Opus; switched to AAC')
      return load(player.get().index)
    }
    patch({ loading: false, error: `Playback failed (media error ${code})` })
    setTimeout(() => next(true), 2000)
  })
  // Leaving the app (Home key) pauses, so music never plays over other apps.
  document.addEventListener('visibilitychange', () => document.hidden && audio.pause())
}
