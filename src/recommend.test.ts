import { describe, expect, it } from 'vitest'
import { heardWithin, interleave, recentTracks, scoreTracks, seeds, topArtists } from './recommend'
import type { Track } from './sources/types'
import type { Play } from './store'

const DAY = 86400000
const now = 100 * DAY
const t = (id: string, artist: string, title = id): Track => ({ source: 'ytm', id, title, artist, artists: [{ name: artist, id: 'UC' + artist }], image: '', durationSec: 200, explicit: false })
const play = (track: Track, daysAgo: number, done = 1): Play => ({ t: track, at: now - daysAgo * DAY, done })

describe('recommendations from history', () => {
  it('scores full, recent plays above skipped or old ones', () => {
    const h = [play(t('a', 'A'), 1), play(t('a', 'A'), 2), play(t('b', 'B'), 1, 0.2), play(t('c', 'C'), 60)]
    expect(scoreTracks(h, now).map((s) => s.t.id)).toEqual(['a', 'b', 'c'])
  })

  it('takes one seed per artist and ignores weak signals', () => {
    const h = [play(t('a1', 'A'), 1), play(t('a2', 'A'), 1), play(t('b', 'B'), 1), play(t('old', 'Z'), 300)]
    expect(seeds(h, now).map((x) => x.id)).toEqual(['a1', 'b'])
  })

  it('interleaves radios without repeats or recent plays', () => {
    const r1 = [t('x', 'X'), t('y', 'Y')]
    const r2 = [t('x', 'X'), t('z', 'Z'), t('w', 'W')]
    const recent = heardWithin([play(t('z', 'Z'), 0.1)], now)
    expect(interleave([r1, r2], recent).map((x) => x.id)).toEqual(['x', 'y', 'w'])
  })

  it('lists recent tracks once each, newest first', () => {
    expect(recentTracks([play(t('a', 'A'), 0), play(t('b', 'B'), 1), play(t('a', 'A'), 2)]).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('ranks top artists', () => {
    const h = [play(t('a', 'A'), 1), play(t('b', 'A'), 1), play(t('c', 'B'), 1)]
    expect(topArtists(h, now).map((a) => a.ref.name)).toEqual(['A', 'B'])
  })
})
