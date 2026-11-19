import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { art, parseArtist, parseCollection, parseExplore, parseMoodGroups, parseRadio, parseSearch, pickFormat, shelvesOf, toSeconds } from './ytm'

const fx = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8'))

describe('YouTube Music parsers (captured responses)', () => {
  it('reads song search rows with artist, album and duration', () => {
    const items = parseSearch(fx('search-songs'))
    expect(items.length).toBeGreaterThan(10)
    const t = items[0].track!
    expect(t.id).toMatch(/^[\w-]{11}$/)
    expect(t.title).toBeTruthy()
    expect(t.artist).toMatch(/Arijit/)
    expect(t.durationSec).toBeGreaterThan(60)
    expect(t.album).toBeTruthy()
    expect(t.image).toMatch(/^https:/)
  })

  it('reads album, artist and playlist search rows as links', () => {
    expect(parseSearch(fx('search-albums'))[0]).toMatchObject({ kind: expect.stringMatching(/album|single/), id: expect.stringMatching(/^MPREb_/) })
    expect(parseSearch(fx('search-artists'))[0]).toMatchObject({ kind: 'artist', id: expect.stringMatching(/^UC/) })
    expect(parseSearch(fx('search-playlists'))[0]).toMatchObject({ kind: 'playlist', id: expect.stringMatching(/^VL/) })
  })

  it('reads home shelves', () => {
    const shelves = shelvesOf(fx('home').contents)
    expect(shelves.length).toBeGreaterThan(0)
    expect(shelves[0].title).toBeTruthy()
    expect(shelves[0].items[0].title).toBeTruthy()
  })

  it('reads an album with its tracks filled from the header', () => {
    const a = parseCollection('MPREb_x', fx('album'))
    expect(a.kind).toBe('album')
    expect(a.title).toMatch(/Kesariya/)
    expect(a.artist).toBe('Arijit Singh')
    expect(a.tracks.length).toBeGreaterThan(0)
    expect(a.tracks[0]).toMatchObject({ artist: 'Arijit Singh', durationSec: 269, album: a.title })
  })

  it('reads a playlist', () => {
    const p = parseCollection('VLRDCLAK5uy_x', fx('playlist'))
    expect(p.kind).toBe('playlist')
    expect(p.tracks.length).toBeGreaterThan(20)
    expect(p.tracks[0].artist).not.toBe('Unknown Artist')
  })

  it('reads an artist page', () => {
    const a = parseArtist('UCx', fx('artist'))
    expect(a.name).toBe('Arijit Singh')
    expect(a.topSongs.length).toBeGreaterThan(0)
    expect(a.shelves.map((s) => s.title)).toContain('Albums')
    expect(a.image).toMatch(/^https:/)
  })

  it('reads Explore with its moods, and the moods page', () => {
    const e = parseExplore(fx('explore'))
    expect(e.shelves.map((s) => s.title)).toContain('New albums & singles')
    expect(e.shelves.some((s) => /episode/i.test(s.title))).toBe(false)
    expect(e.moods.length).toBeGreaterThan(10)
    expect(e.moods[0]).toMatchObject({ title: 'Chill', browseId: 'FEmusic_moods_and_genres_category', color: expect.stringMatching(/^rgb\(/) })
    const groups = parseMoodGroups(fx('moods'))
    expect(groups.map((g) => g.title)).toEqual(['Moods & moments', 'Genres'])
    expect(shelvesOf(fx('mood').contents).length).toBeGreaterThan(3)
  })

  it('reads a radio queue', () => {
    const r = parseRadio(fx('next'))
    expect(r.length).toBeGreaterThan(20)
    expect(r[1]).toMatchObject({ title: expect.any(String), durationSec: expect.any(Number) })
    expect(r[1].artist).toBeTruthy()
  })
})

describe('helpers', () => {
  it('parses durations', () => {
    expect(toSeconds('4:29')).toBe(269)
    expect(toSeconds('1:02:03')).toBe(3723)
  })
  it('resizes googleusercontent art and leaves others', () => {
    expect(art('https://yt3.googleusercontent.com/abc=w60-h60-l90-rj', 544)).toBe('https://yt3.googleusercontent.com/abc=w544-h544-l90-rj')
    expect(art('https://lh3.googleusercontent.com/abc', 120)).toBe('https://lh3.googleusercontent.com/abc=w120-h120-l90-rj')
    expect(art('https://i.ytimg.com/vi/x/hq.jpg', 120)).toBe('https://i.ytimg.com/vi/x/hq.jpg')
  })
  it('picks AAC unless Opus is wanted and playable', () => {
    const f = [
      { itag: 140, url: 'a', mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 130000 },
      { itag: 251, url: 'o', mimeType: 'audio/webm; codecs="opus"', bitrate: 150000 },
      { itag: 137, url: 'v', mimeType: 'video/mp4', bitrate: 900000 },
    ]
    expect(pickFormat(f, true, false)!.itag).toBe(140)
    expect(pickFormat(f, true, true)!.itag).toBe(251)
    expect(pickFormat(f, false, true)!.itag).toBe(140)
    expect(pickFormat([f[1]], false, false)).toBeNull()
  })
})
