// Turns a queued track into a playable stream. BitChord's SourceResolver, reduced to the two
// sources the TV keeps: a YouTube track is swapped for JioSaavn's 320 kbps AAC copy when the
// same recording is found there (title, artist and length agree); otherwise YouTube plays it.
import { errText, log } from '../lib/log'
import * as saavn from './jiosaavn'
import { hasConflictingAlbums, queries, ranked, sharesArtist, uniquelyMostCreditedCloseMatch, withinSeconds, type MatchTarget } from './match'
import type { Stream, Track } from './types'
import * as ytm from './ytm'

export interface ResolveOptions {
  preferSaavn: boolean
  preferOpus: boolean
}

/** JioSaavn has to answer quickly or YouTube plays; the swap is a bonus, never a wait. */
const SWAP_BUDGET_MS = 2500
/** Same-recording bar for a swap: lengths within this many seconds. */
const SWAP_DRIFT_SEC = 3
/** Only worth swapping when clearly better than YouTube's ~130-160 kbps. */
const SWAP_MIN_KBPS = 256

const targetOf = (t: Track): MatchTarget => ({ title: t.title, artist: t.artist, durationSec: t.durationSec || null, album: t.album || null, isExplicit: t.explicit, isVideo: t.isVideo })

const candidateOf = (t: Track) => ({ title: t.title, artist: t.artist, durationSec: t.durationSec || null, album: t.album || null, explicit: t.explicit, track: t })

/** The row in [rows] that is the same recording as [target], under BitChord's rules, or null. */
export function pickSameRecording(rows: Track[], target: MatchTarget): Track | null {
  let matches = ranked(rows.map(candidateOf), target).filter((c) => sharesArtist(target.artist || '', c.artist))
  if (target.durationSec) matches = matches.filter((c) => withinSeconds(c, target, SWAP_DRIFT_SEC))
  // JioSaavn files different recordings under one title and artist; with no album to tell
  // them apart, BitChord takes the uniquely fullest credit or refuses to guess.
  if (hasConflictingAlbums(matches, target)) {
    const one = uniquelyMostCreditedCloseMatch(matches, target)
    return one ? one.track : null
  }
  return matches.length ? matches[0].track : null
}

async function saavnCopy(t: Track): Promise<Stream | null> {
  const target = targetOf(t)
  for (const q of queries(target).slice(0, 2)) {
    const hit = pickSameRecording(await saavn.search(q), target)
    if (!hit) continue
    const s = await saavn.stream(hit.id)
    if (s && (s.kbps || 0) >= SWAP_MIN_KBPS) return s
    return null
  }
  return null
}

/** The YouTube copy of a JioSaavn track, when JioSaavn's own stream fails. */
export async function youtubeCopy(t: Track): Promise<Track | null> {
  const target = targetOf(t)
  for (const q of queries(target).slice(0, 2)) {
    const hit = pickSameRecording(await ytm.searchSongs(q), { ...target, album: null })
    if (hit) return hit
  }
  return null
}

const within = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      () => (clearTimeout(timer), resolve(null)),
    )
  })

export async function resolveStream(t: Track, o: ResolveOptions): Promise<Stream> {
  if (t.source === 'saavn') {
    const own = await saavn.stream(t.id).catch((e) => (log.warn(`JioSaavn stream failed: ${errText(e)}`), null))
    if (own) return own
    const yt = await youtubeCopy(t)
    if (!yt) throw new Error('JioSaavn could not play this track and YouTube Music has no matching copy')
    log.info(`"${t.title}": JioSaavn failed, playing YouTube Music's copy`)
    return ytm.stream(yt.id, o.preferOpus)
  }
  if (o.preferSaavn && !t.isVideo) {
    const swap = await within(saavnCopy(t), SWAP_BUDGET_MS)
    if (swap) {
      log.info(`"${t.title}": JioSaavn ${swap.kbps} kbps copy found, playing it over YouTube`)
      return swap
    }
  }
  return ytm.stream(t.id, o.preferOpus)
}
