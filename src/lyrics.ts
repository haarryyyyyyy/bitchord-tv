// Synced lyrics from LRCLIB (BitChord's first provider), with a plain-text fallback.
// A result is used only when BitChord's TrackMatcher says it is the same recording:
// same title (takes such as "Lofi Flip" or "Remix" must agree), a shared artist, and
// a length within 4 seconds. Taking LRCLIB's first search hit is what showed another
// song's lyrics before.
import { getJson, qs } from './lib/net'
import { ranked, withinSeconds, type MatchCandidate } from './sources/match'
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

export interface LrcRow {
  trackName?: string
  artistName?: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

const DRIFT_SEC = 4

/** The LRCLIB row that is this recording, synced lyrics preferred, or null. */
export function pickLyricsRow(rows: LrcRow[], t: { title: string; artist: string; durationSec: number }): LrcRow | null {
  const target = { title: t.title, artist: t.artist, durationSec: t.durationSec || null }
  const cands = rows
    .filter((r) => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
    .map((r) => ({ title: r.trackName || '', artist: r.artistName || '', durationSec: r.duration || null, album: r.albumName || null, row: r }) as MatchCandidate & { row: LrcRow })
  // Without a known length a title-and-artist match is all there is to go on.
  const same = ranked(cands, target).filter((c) => !target.durationSec || withinSeconds(c, target, DRIFT_SEC))
  return (same.filter((c) => c.row.syncedLyrics)[0] || same[0] || { row: null }).row
}

function toLyrics(r: LrcRow | null): Lyrics | null {
  if (!r) return null
  if (r.syncedLyrics) {
    const lines = parseLrc(r.syncedLyrics)
    if (lines.length) return { synced: true, lines }
  }
  if (r.plainLyrics) return { synced: false, lines: r.plainLyrics.split(/\r?\n/).map((text) => ({ t: 0, text })) }
  return null
}

const clean = (s: string) => s.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').trim()
const cache = new Map<string, Lyrics | null>()

/** [durationSec] should be the player's real length when the catalogue didn't give one. */
export async function fetchLyrics(t: Track, durationSec: number): Promise<Lyrics | null> {
  if (cache.has(t.id)) return cache.get(t.id)!
  const target = { title: t.title, artist: t.artist, durationSec: Math.round(durationSec || t.durationSec || 0) }
  const lead = ((t.artists && t.artists[0] && t.artists[0].name) || t.artist.split(/,|&/)[0]).trim()
  let rows: LrcRow[] = []
  try {
    // LRCLIB's exact lookup first: it already matches title, artist and length (±2 s).
    if (target.durationSec) {
      const exact = await getJson<LrcRow>('https://lrclib.net/api/get?' + qs({ track_name: clean(t.title), artist_name: lead, duration: target.durationSec }), 7000).catch(() => null)
      if (exact) rows.push(exact)
    }
    if (!pickLyricsRow(rows, target)) {
      rows = rows.concat(await getJson<LrcRow[]>('https://lrclib.net/api/search?' + qs({ track_name: clean(t.title), artist_name: lead }), 7000).catch(() => []))
    }
    if (!pickLyricsRow(rows, target)) rows = rows.concat(await getJson<LrcRow[]>('https://lrclib.net/api/search?' + qs({ q: clean(t.title) + ' ' + lead }), 7000).catch(() => []))
  } catch {}
  const found = toLyrics(pickLyricsRow(rows, target))
  cache.set(t.id, found)
  return found
}
