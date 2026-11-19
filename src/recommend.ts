// Recommendations from the TV's own listening history (no account).
// Seeds = tracks heard most fully and most recently (14-day half-life), one per artist.
// Their YouTube Music radios are interleaved into a mix, minus anything heard in the last day.
import { errText, log } from './lib/log'
import { youtubeCopy } from './sources/resolve'
import type { Item, Ref, Shelf, Track } from './sources/types'
import * as ytm from './sources/ytm'
import type { Play } from './store'

const DAY = 86400000
const HALF_LIFE_DAYS = 14

const keyOf = (t: Track) => (t.title + '|' + t.artist).toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^\w|]+/g, '')

export function scoreTracks(history: Play[], now: number): { t: Track; score: number }[] {
  const by = new Map<string, { t: Track; score: number }>()
  for (const p of history) {
    const w = p.done * Math.pow(0.5, (now - p.at) / DAY / HALF_LIFE_DAYS)
    const k = keyOf(p.t)
    const e = by.get(k)
    if (e) e.score += w
    else by.set(k, { t: p.t, score: w })
  }
  return Array.from(by.values()).sort((a, b) => b.score - a.score)
}

/** Best-loved tracks, at most one per lead artist so the mix doesn't collapse onto one singer. */
export function seeds(history: Play[], now: number, n = 3): Track[] {
  const out: Track[] = []
  const artists = new Set<string>()
  for (const { t, score } of scoreTracks(history, now)) {
    if (score < 0.2) break
    const lead = (t.artist.split(/,|&/)[0] || '').trim().toLowerCase()
    if (artists.has(lead)) continue
    artists.add(lead)
    out.push(t)
    if (out.length >= n) break
  }
  return out
}

export function heardWithin(history: Play[], now: number, ms = DAY): Set<string> {
  const s = new Set<string>()
  for (const p of history) if (now - p.at < ms) s.add(keyOf(p.t))
  return s
}

/** Round-robin through the radios, skipping repeats and recent plays. */
export function interleave(lists: Track[][], exclude: Set<string>, max = 30): Track[] {
  const out: Track[] = []
  const seen = new Set(exclude)
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++)
    for (const l of lists) {
      const t = l[i]
      if (!t || t.isVideo) continue
      const k = keyOf(t)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
      if (out.length >= max) break
    }
  return out
}

export function recentTracks(history: Play[], max = 20): Track[] {
  const seen = new Set<string>()
  const out: Track[] = []
  for (const p of history) {
    const k = keyOf(p.t)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p.t)
    if (out.length >= max) break
  }
  return out
}

export function topArtists(history: Play[], now: number, max = 12): { ref: Ref; image: string }[] {
  const by = new Map<string, { ref: Ref; image: string; score: number }>()
  for (const p of history) {
    const a = (p.t.artists || []).filter((x) => x.id && /^UC/.test(x.id))[0]
    if (!a) continue
    const w = p.done * Math.pow(0.5, (now - p.at) / DAY / HALF_LIFE_DAYS)
    const e = by.get(a.id!)
    if (e) e.score += w
    else by.set(a.id!, { ref: a, image: p.t.image, score: w })
  }
  return Array.from(by.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}

export const asItem = (t: Track): Item => ({ kind: t.isVideo ? 'video' : 'song', id: t.id, title: t.title, subtitle: t.artist, image: t.image, track: t })

let cache: { key: string; shelves: Shelf[] } | null = null

/** The personal shelves for Home. Empty when there is no history yet. */
export async function personalShelves(history: Play[]): Promise<Shelf[]> {
  if (!history.length) return []
  const now = Date.now()
  const picks = seeds(history, now)
  const key = picks.map((t) => t.id).join(',') + '|' + history.length
  if (cache && cache.key === key) return cache.shelves

  const radios = await Promise.all(
    picks.map(async (t) => {
      try {
        const yt = t.source === 'ytm' ? t : await youtubeCopy(t)
        return yt ? await ytm.radio(yt.id) : []
      } catch (e) {
        log.warn(`Radio for "${t.title}" failed: ${errText(e)}`)
        return []
      }
    }),
  )
  const recent = heardWithin(history, now)
  const shelves: Shelf[] = []
  const mix = interleave(radios, recent)
  if (mix.length) shelves.push({ title: 'Made for You', items: mix.map(asItem) })
  shelves.push({ title: 'Recently Played', items: recentTracks(history).map(asItem) })
  picks.forEach((t, i) => {
    const r = radios[i].filter((x) => !x.isVideo && !recent.has(keyOf(x))).slice(0, 15)
    if (r.length) shelves.push({ title: `Because you played ${t.title.replace(/\s*\(.*?\)/g, '')}`, items: r.map(asItem) })
  })
  const artists = topArtists(history, now)
  if (artists.length >= 2) shelves.push({ title: 'Your Top Artists', items: artists.map((a) => ({ kind: 'artist', id: a.ref.id!, title: a.ref.name, subtitle: 'Artist', image: a.image })) })
  cache = { key, shelves }
  return shelves
}
