// Port of BitChord's JioSaavnService.kt (GPLv3, github.com/kushagrasinghx/BitChord).
// Same endpoint, same params, same DES decrypt and 320 rewrite rules.
import CryptoJS from 'crypto-js/core'
import 'crypto-js/enc-base64'
import 'crypto-js/mode-ecb'
import 'crypto-js/pad-pkcs7'
import 'crypto-js/tripledes'
import { getJson, qs } from '../lib/net'
import type { Stream, Track } from './types'

const BASE = 'https://www.jiosaavn.com/api.php'
const DES_KEY = '38346591'

export function decryptUrl(encrypted: string): string {
  if (!encrypted) return ''
  try {
    const out = CryptoJS.DES.decrypt(encrypted, CryptoJS.enc.Utf8.parse(DES_KEY), {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    })
    return out.toString(CryptoJS.enc.Utf8).trim()
  } catch {
    return ''
  }
}

// The encrypted URL names the 96 kbps file; the 320 object only exists when the catalogue says so.
export function selectBestStream(url: string, supports320: boolean): { url: string; kbps: number | null } | null {
  if (!url) return null
  const m = /_(48|96|160|320)\.(mp4|aac|mp3)(?=[?#]|$)/i.exec(url)
  if (!m) return { url, kbps: null }
  const offered = Number(m[1])
  if (!supports320) return { url, kbps: offered }
  const start = m.index
  return { url: url.slice(0, start) + '_320.' + m[2] + url.slice(start + m[0].length), kbps: 320 }
}

interface RawSong {
  id?: string
  title?: string
  image?: string
  explicit_content?: string
  more_info?: {
    album?: string
    album_id?: string
    duration?: string
    encrypted_media_url?: string
    '320kbps'?: string
    artistMap?: { primary_artists?: { name?: string; id?: string }[] }
  }
}

const MIN_USABLE_KBPS = 96 // BitChord refuses anything at or below this
const COMMON = { _format: 'json', _marker: '0', api_version: '4', ctx: 'android' }
const call = (params: Record<string, string>) => getJson(BASE + '?' + qs({ ...COMMON, ...params }), 6000)

// JioSaavn titles arrive HTML-escaped ("Kesariya &quot;Brahmastra&quot;").
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export function toTrack(raw: RawSong): Track {
  const mi = raw.more_info || {}
  const primary = (mi.artistMap && mi.artistMap.primary_artists) || []
  const artists = primary.filter((a) => a.name).map((a) => ({ name: unescape(a.name!), id: a.id }))
  return {
    source: 'saavn',
    id: raw.id || '',
    title: unescape(raw.title || ''),
    artist: artists.map((a) => a.name).join(', ') || 'Unknown Artist',
    artists,
    album: mi.album ? unescape(mi.album) : undefined,
    albumId: mi.album_id,
    image: (raw.image || '').replace(/150x150|50x50/, '500x500').replace(/^http:\/\//, 'https://'),
    durationSec: parseInt(mi.duration || '0', 10) || 0,
    explicit: raw.explicit_content === '1' || raw.explicit_content === 'true',
  }
}

export async function search(query: string): Promise<Track[]> {
  const body = (await call({ __call: 'search.getResults', q: query, p: '1', n: '20' })) as { results?: RawSong[] }
  // Uncensored rows first, like BitChord's prioritizeExplicit (stable: catalogue order kept otherwise).
  return (body.results || [])
    .map(toTrack)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(b.t.explicit) - Number(a.t.explicit) || a.i - b.i)
    .map((x) => x.t)
}

export async function stream(id: string): Promise<Stream | null> {
  const body = (await call({ __call: 'song.getDetails', pids: id })) as Record<string, unknown>
  // Answer is either {"songs":[...]} or a map keyed by the requested id.
  const songs = body.songs as RawSong[] | undefined
  const raw = (songs && songs[0]) || (Object.keys(body).map((k) => body[k]).filter((v) => v && typeof v === 'object')[0] as RawSong | undefined)
  if (!raw) return null
  const mi = raw.more_info || {}
  const best = selectBestStream(decryptUrl(mi.encrypted_media_url || ''), String(mi['320kbps']).toLowerCase() === 'true')
  if (!best) return null
  if (best.kbps !== null && best.kbps <= MIN_USABLE_KBPS) return null
  return { url: best.url.replace(/^http:\/\//, 'https://'), kbps: best.kbps, codec: 'AAC', from: 'saavn' }
}
