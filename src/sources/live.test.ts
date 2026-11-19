// Hits the real services. Run with: LIVE=1 npx vitest run live
import { describe, expect, it } from 'vitest'
import * as saavn from './jiosaavn'
import { resolveStream } from './resolve'
import * as ytm from './ytm'

const head = async (url: string) => {
  const r = await fetch(url, { headers: { Range: 'bytes=0-1023' } })
  return `${r.status} ${r.headers.get('content-type')}`
}

describe.skipIf(!(globalThis as any).process?.env?.LIVE)('live services', () => {
  it('JioSaavn: search, decrypt, stream', async () => {
    const tracks = await saavn.search('Kesariya')
    expect(tracks.length).toBeGreaterThan(0)
    const s = await saavn.stream(tracks[0].id)
    console.log('saavn', tracks[0].title, s, await head(s!.url))
    expect(s!.kbps).toBe(320)
  }, 30000)

  it('YouTube Music: search, album, artist, radio, stream', async () => {
    const r = await ytm.search('kesariya arijit')
    expect(r.songs.length).toBeGreaterThan(3)
    const song = r.songs[0]
    const s = await ytm.stream(song.id)
    console.log('ytm', song.title, '-', song.artist, s.codec, s.kbps, await head(s.url))
    expect(await head(s.url)).toMatch(/^20[06]/)
    const radio = await ytm.radio(song.id)
    expect(radio.length).toBeGreaterThan(10)
    if (r.albums[0]) expect((await ytm.collection(r.albums[0].id)).tracks.length).toBeGreaterThan(0)
    if (r.artists[0]) expect((await ytm.artist(r.artists[0].id)).name).toBeTruthy()
    const home = await ytm.home()
    console.log('home shelves:', home.map((h) => h.title).join(' | '))
    expect(home.length).toBeGreaterThan(0)
  }, 60000)

  it('swaps a YouTube track for the JioSaavn 320 copy', async () => {
    const song = (await ytm.search('kesariya brahmastra arijit')).songs[0]
    const s = await resolveStream(song, { preferSaavn: true, preferOpus: false })
    console.log('resolved', song.title, '->', s.from, s.kbps)
    expect(s.url).toMatch(/^https:/)
  }, 30000)
})
