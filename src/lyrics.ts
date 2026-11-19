// Synced lyrics from LRCLIB (BitChord's first provider), with a plain-text fallback.
import { getJson, qs } from './lib/net'
import type { Track } from './sources/types'

export interface Line {
  t: number
  text: string
}
export interface Lyrics {
  synced: boolean
  lines: Line[]
}

const TAG = /\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(lrc: string): Line[] {
  const out: Line[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps: number[] = []
    let m: RegExpExecArray | null
    TAG.lastIndex = 0
    let last = 0
    while ((m = TAG.exec(raw))) {
      const frac = m[3] ? Number(m[3]) / Math.pow(10, m[3].length) : 0
      stamps.push(Number(m[1]) * 60 + Number(m[2]) + frac)
      last = TAG.lastIndex
    }
    if (!stamps.length) continue
    const text = raw.slice(last).trim()
    stamps.forEach((t) => out.push({ t, text }))
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Index of the line being sung at [time], or -1 before the first. */
export function lineAt(lines: Line[], time: number): number {
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].t <= time) (ans = mid), (lo = mid + 1)
    else hi = mid - 1
  }
  return ans
}

const clean = (s: string) => s.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').trim()

interface LrcRow {
  syncedLyrics?: string | null
  plainLyrics?: string | null
  duration?: number
  instrumental?: boolean
}

function toLyrics(r: LrcRow | null | undefined): Lyrics | null {
  if (!r) return null
  if (r.syncedLyrics) {
    const lines = parseLrc(r.syncedLyrics)
    if (lines.length) return { synced: true, lines }
  }
  if (r.plainLyrics) return { synced: false, lines: r.plainLyrics.split(/\r?\n/).map((text) => ({ t: 0, text })) }
  return null
}

const cache = new Map<string, Lyrics | null>()

export async function fetchLyrics(t: Track): Promise<Lyrics | null> {
  if (cache.has(t.id)) return cache.get(t.id)!
  const artist = (t.artists && t.artists[0] && t.artists[0].name) || t.artist.split(/,|&/)[0].trim()
  const title = clean(t.title)
  let found: Lyrics | null = null
  try {
    const params: Record<string, string | number> = { track_name: title, artist_name: artist }
    if (t.durationSec) params.duration = t.durationSec
    found = toLyrics(await getJson<LrcRow>('https://lrclib.net/api/get?' + qs(params), 7000))
  } catch {}
  if (!found) {
    try {
      const rows = await getJson<LrcRow[]>('https://lrclib.net/api/search?' + qs({ q: `${title} ${artist}` }), 7000)
      const near = rows.filter((r) => !t.durationSec || !r.duration || Math.abs(r.duration - t.durationSec) <= 4)
      found = toLyrics(near.filter((r) => r.syncedLyrics)[0] || near[0])
    } catch {}
  }
  cache.set(t.id, found)
  return found
}
