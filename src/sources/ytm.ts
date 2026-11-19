// YouTube Music over raw InnerTube, without YouTube.js (too heavy for a TV).
// Browse/search/next use WEB_REMIX; playback uses VISIONOS, the client BitChord's
// web player leads with (web/app/src/playback/youtube/resolver.ts): it answers with
// direct audio URLs that need no signature/n deciphering and no PO token.
// Both endpoints answer `Origin: null` (a Tizen file:// app) with CORS allowed.
import { postJson } from '../lib/net'
import type { ArtistPage, Collection, Item, ItemKind, Ref, SearchResults, Shelf, Stream, Track } from './types'

const MUSIC = 'https://music.youtube.com/youtubei/v1/'
const PLAYER = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const WEB_REMIX = { clientName: 'WEB_REMIX', clientVersion: '1.20260707.12.00' }
const VISIONOS = { clientName: 'VISIONOS', clientVersion: '1.02', deviceMake: 'Apple', deviceModel: 'RealityDevice14,1', osName: 'visionOS', osVersion: '1.3.21O771' }

// ytmusicapi's filter params: songs, albums, artists, community playlists.
export const SEARCH_PARAMS = {
  songs: 'EgWKAQIIAWoMEA4QChADEAQQCRAF',
  albums: 'EgWKAQIYAWoMEA4QChADEAQQCRAF',
  artists: 'EgWKAQIgAWoMEA4QChADEAQQCRAF',
  playlists: 'EgeKAQQoAEABagoQBBAJEAMQBRAK',
}

const region = (() => {
  try {
    const m = /-([A-Z]{2})/.exec(navigator.language || '')
    return m ? m[1] : 'US'
  } catch {
    return 'US'
  }
})()

let visitorData = ''
try {
  visitorData = localStorage.getItem('bc.visitor') || ''
} catch {}

function context(client: object) {
  return { client: { ...client, hl: 'en', gl: region, ...(visitorData ? { visitorData } : {}) } }
}

async function music(endpoint: string, body: object, query = ''): Promise<any> {
  const j = await postJson(MUSIC + endpoint + '?prettyPrint=false' + query, { context: context(WEB_REMIX), ...body })
  const v = j && j.responseContext && j.responseContext.visitorData
  if (v && v !== visitorData) {
    visitorData = v
    try {
      localStorage.setItem('bc.visitor', v)
    } catch {}
  }
  return j
}

// ---- JSON helpers --------------------------------------------------------------

type Raw = any

export function find(root: Raw, key: string, out: Raw[] = []): Raw[] {
  if (Array.isArray(root)) for (let i = 0; i < root.length; i++) find(root[i], key, out)
  else if (root && typeof root === 'object')
    for (const k in root) {
      if (k === key) out.push(root[k])
      else find(root[k], key, out)
    }
  return out
}

export const text = (t: Raw): string => (t ? (t.runs ? t.runs.map((r: Raw) => r.text).join('') : t.simpleText || '') : '')

const pageTypeOf = (ep: Raw): string => (ep && ep.browseEndpoint && ep.browseEndpoint.browseEndpointContextSupportedConfigs && ep.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType) || ''

const thumbsOf = (r: Raw): Raw[] => (r && ((r.musicThumbnailRenderer && r.musicThumbnailRenderer.thumbnail.thumbnails) || r.thumbnails)) || []

const bestThumb = (list: Raw[]): string => (list.length ? list[list.length - 1].url : '')

const DURATION = /^(\d+:)?\d{1,2}:\d{2}$/
export const toSeconds = (s: string) => s.split(':').reduce((a, b) => a * 60 + Number(b), 0)

const KIND: Record<string, ItemKind> = {
  MUSIC_PAGE_TYPE_ALBUM: 'album',
  MUSIC_PAGE_TYPE_ARTIST: 'artist',
  MUSIC_PAGE_TYPE_USER_CHANNEL: 'artist',
  MUSIC_PAGE_TYPE_PLAYLIST: 'playlist',
}

/** Resizes a YouTube artwork URL; googleusercontent URLs take any square size. */
export function art(url: string, size: number): string {
  if (!url) return ''
  if (/googleusercontent\.com/.test(url)) return url.replace(/=w\d+-h\d+[^&?#]*$/, '') .replace(/=s\d+[^&?#]*$/, '') + `=w${size}-h${size}-l90-rj`
  return url
}

/** Splits a "byline" (artists • album • year/duration) into its parts. */
function byline(runs: Raw[]): { artists: Ref[]; album?: Ref; durationSec: number; plain: string[] } {
  const artists: Ref[] = []
  let album: Ref | undefined
  let durationSec = 0
  const plain: string[] = []
  for (const run of runs || []) {
    const t = pageTypeOf(run.navigationEndpoint)
    const id = run.navigationEndpoint && run.navigationEndpoint.browseEndpoint && run.navigationEndpoint.browseEndpoint.browseId
    if (KIND[t] === 'artist') artists.push({ name: run.text, id })
    else if (t === 'MUSIC_PAGE_TYPE_ALBUM') album = { name: run.text, id }
    else if (DURATION.test(run.text.trim())) durationSec = toSeconds(run.text.trim())
    else if (run.text.trim() && run.text !== ' • ') plain.push(run.text)
  }
  return { artists, album, durationSec, plain }
}

const NOT_ARTIST = /^(song|video|album|single|ep|playlist|artist|episode|podcast)$/i

function artistLine(artists: Ref[], plain: string[], runs: Raw[]): string {
  if (artists.length) {
    // Keep the joiners YouTube wrote ("A, B & C").
    const whole = (runs || []).map((r: Raw) => r.text).join('').split(' • ')
    const seg = whole.find((s: string) => s.indexOf(artists[0].name) >= 0)
    return seg || artists.map((a) => a.name).join(', ')
  }
  const first = plain.find((p) => !NOT_ARTIST.test(p.trim()) && !/^\d{4}$/.test(p.trim()) && !/plays|views|subscribers|audience/i.test(p))
  return (first || '').trim()
}

function watchOf(ep: Raw) {
  const w = ep && ep.watchEndpoint
  if (!w || !w.videoId) return null
  const cfg = w.watchEndpointMusicSupportedConfigs && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig
  return { videoId: w.videoId as string, isVideo: !!(cfg && cfg.musicVideoType && cfg.musicVideoType !== 'MUSIC_VIDEO_TYPE_ATV') }
}

const isExplicit = (r: Raw) => JSON.stringify(r.badges || r.subtitleBadges || []).indexOf('MUSIC_EXPLICIT_BADGE') >= 0

function makeTrack(id: string, title: string, b: ReturnType<typeof byline>, runs: Raw[], image: string, explicit: boolean, isVideo: boolean): Track {
  return {
    source: 'ytm',
    id,
    title,
    artist: artistLine(b.artists, b.plain, runs) || 'Unknown Artist',
    artists: b.artists,
    album: b.album && b.album.name,
    albumId: b.album && b.album.id,
    image,
    durationSec: b.durationSec,
    explicit,
    isVideo,
  }
}

export function fromListItem(r: Raw): Item | null {
  const cols: Raw[][] = (r.flexColumns || []).map((c: Raw) => (c.musicResponsiveListItemFlexColumnRenderer && c.musicResponsiveListItemFlexColumnRenderer.text.runs) || [])
  const titleRuns = cols[0] || []
  const title = titleRuns.map((x: Raw) => x.text).join('')
  if (!title) return null
  const subRuns = cols[1] || []
  const b = byline(subRuns)
  if (!b.durationSec && r.fixedColumns) {
    const fixed = text(r.fixedColumns[0].musicResponsiveListItemFixedColumnRenderer.text)
    if (DURATION.test(fixed)) b.durationSec = toSeconds(fixed)
  }
  const image = bestThumb(thumbsOf(r.thumbnail))
  const subtitle = subRuns.map((x: Raw) => x.text).join('')
  const watch = watchOf(titleRuns[0] && titleRuns[0].navigationEndpoint)
  const videoId = (r.playlistItemData && r.playlistItemData.videoId) || (watch && watch.videoId)
  if (videoId) {
    const isVideo = !!(watch && watch.isVideo)
    const track = makeTrack(videoId, title, b, subRuns, image, isExplicit(r), isVideo)
    return { kind: isVideo ? 'video' : 'song', id: videoId, title, subtitle: track.artist, image, track }
  }
  const nav = r.navigationEndpoint
  const kind = KIND[pageTypeOf(nav)]
  if (!kind) return null
  return { kind: kind === 'album' && /^Single/.test(subtitle) ? 'single' : kind, id: nav.browseEndpoint.browseId, title, subtitle, image }
}

export function fromTwoRow(r: Raw): Item | null {
  const title = text(r.title)
  const nav = r.navigationEndpoint || (r.title && r.title.runs && r.title.runs[0].navigationEndpoint)
  const image = bestThumb(thumbsOf(r.thumbnailRenderer))
  const subRuns = (r.subtitle && r.subtitle.runs) || []
  const subtitle = text(r.subtitle)
  const watch = watchOf(nav)
  if (watch) {
    const b = byline(subRuns)
    const track = makeTrack(watch.videoId, title, b, subRuns, image, isExplicit(r), watch.isVideo)
    return { kind: watch.isVideo ? 'video' : 'song', id: watch.videoId, title, subtitle: track.artist, image, track }
  }
  const kind = KIND[pageTypeOf(nav)]
  if (!kind || !title) return null
  return { kind: kind === 'album' && /^Single/.test(subtitle) ? 'single' : kind, id: nav.browseEndpoint.browseId, title, subtitle, image }
}

function itemOf(c: Raw): Item | null {
  if (c.musicTwoRowItemRenderer) return fromTwoRow(c.musicTwoRowItemRenderer)
  if (c.musicResponsiveListItemRenderer) return fromListItem(c.musicResponsiveListItemRenderer)
  return null
}

const nonNull = <T,>(x: T | null): x is T => x !== null

export function shelvesOf(root: Raw): Shelf[] {
  const out: Shelf[] = []
  for (const s of find(root, 'musicCarouselShelfRenderer')) {
    const h = s.header && (s.header.musicCarouselShelfBasicHeaderRenderer || s.header.musicCarouselShelfHeaderRenderer)
    const items = (s.contents || []).map(itemOf).filter(nonNull)
    if (items.length) out.push({ title: h ? text(h.title) : '', items })
  }
  for (const s of find(root, 'musicShelfRenderer')) {
    const items = (s.contents || []).map(itemOf).filter(nonNull)
    if (items.length) out.push({ title: text(s.title), items })
  }
  for (const g of find(root, 'gridRenderer')) {
    const items = (g.items || []).map(itemOf).filter(nonNull)
    const h = g.header && g.header.gridHeaderRenderer
    if (items.length) out.push({ title: h ? text(h.title) : '', items })
  }
  return out
}

// ---- Explore, moods & genres --------------------------------------------------------------

export interface Mood {
  title: string
  /** The sleeve's stripe colour, as YouTube Music paints it. */
  color: string
  browseId: string
  params: string
}

const argb = (n: number) => {
  const u = n >>> 0
  return `rgb(${(u >>> 16) & 255}, ${(u >>> 8) & 255}, ${u & 255})`
}

function moodOf(b: Raw): Mood | null {
  const ep = b.clickCommand && b.clickCommand.browseEndpoint
  if (!ep) return null
  return { title: text(b.buttonText), color: argb((b.solid && b.solid.leftStripeColor) || 0xff444444), browseId: ep.browseId, params: ep.params || '' }
}

export function parseMoodGroups(j: Raw): { title: string; items: Mood[] }[] {
  return find(j, 'gridRenderer')
    .map((g) => ({
      title: text(g.header && g.header.gridHeaderRenderer && g.header.gridHeaderRenderer.title),
      items: (g.items || []).map((i: Raw) => i.musicNavigationButtonRenderer && moodOf(i.musicNavigationButtonRenderer)).filter(Boolean) as Mood[],
    }))
    .filter((g) => g.items.length)
}

export function parseExplore(j: Raw): { shelves: Shelf[]; moods: Mood[] } {
  return {
    shelves: shelvesOf(j.contents).filter((s) => !/episode|podcast/i.test(s.title)),
    // Only the mood sleeves; the page's top buttons (New releases, Charts) are other pages.
    moods: find(j, 'musicNavigationButtonRenderer')
      .map(moodOf)
      .filter((m): m is Mood => !!m && m.browseId === 'FEmusic_moods_and_genres_category'),
  }
}

export const explore = async () => parseExplore(await music('browse', { browseId: 'FEmusic_explore' }))
export const moodGroups = async () => parseMoodGroups(await music('browse', { browseId: 'FEmusic_moods_and_genres' }))
/** A mood or genre page: its playlists, as shelves. */
export const browseShelves = async (browseId: string, params: string) => shelvesOf((await music('browse', { browseId, params })).contents)

// ---- Endpoints -------------------------------------------------------------------

export async function home(): Promise<Shelf[]> {
  const first = await music('browse', { browseId: 'FEmusic_home' })
  let shelves = shelvesOf(first.contents)
  let token = (find(first.contents, 'nextContinuationData')[0] || {}).continuation
  // Anonymous home is short; two more pages give it some depth.
  for (let i = 0; i < 2 && token; i++) {
    const more = await music('browse', {}, `&ctoken=${token}&continuation=${token}&type=next`).catch(() => null)
    if (!more || !more.continuationContents) break
    shelves = shelves.concat(shelvesOf(more.continuationContents))
    token = (find(more.continuationContents, 'nextContinuationData')[0] || {}).continuation
  }
  return shelves.filter((s) => !/podcast|episode/i.test(s.title))
}

export function parseSearch(j: Raw): Item[] {
  return find(j.contents, 'musicResponsiveListItemRenderer').map(fromListItem).filter(nonNull)
}

export async function search(query: string): Promise<Omit<SearchResults, 'saavn'>> {
  const run = (p: string) => music('search', { query, params: p }).then(parseSearch).catch(() => [] as Item[])
  const [songs, albums, artists, playlists] = await Promise.all([run(SEARCH_PARAMS.songs), run(SEARCH_PARAMS.albums), run(SEARCH_PARAMS.artists), run(SEARCH_PARAMS.playlists)])
  return {
    songs: songs.map((i) => i.track).filter((t): t is Track => !!t),
    albums: albums.filter((i) => i.kind === 'album' || i.kind === 'single'),
    artists: artists.filter((i) => i.kind === 'artist'),
    playlists: playlists.filter((i) => i.kind === 'playlist'),
  }
}

/** YouTube Music's songs for a query, for matching a JioSaavn track to a YouTube id. */
export const searchSongs = (query: string) => music('search', { query, params: SEARCH_PARAMS.songs }).then((j) => parseSearch(j).map((i) => i.track).filter((t): t is Track => !!t))

export async function suggestions(input: string): Promise<string[]> {
  const j = await music('music/get_search_suggestions', { input })
  return find(j, 'searchSuggestionRenderer').map((s) => text(s.suggestion)).slice(0, 6)
}

export function parseCollection(id: string, j: Raw): Collection {
  const h = find(j, 'musicResponsiveHeaderRenderer')[0] || find(j, 'musicDetailHeaderRenderer')[0] || {}
  const strap = (h.straplineTextOne && h.straplineTextOne.runs) || []
  const artistRun = strap.find((r: Raw) => KIND[pageTypeOf(r.navigationEndpoint)] === 'artist')
  const image = bestThumb(thumbsOf(h.thumbnail))
  const title = text(h.title)
  const artist = text(h.straplineTextOne)
  const isPlaylist = /^VL|^PL|^RD/.test(id)
  const shelf = find(j, 'musicPlaylistShelfRenderer')[0] || find(j, 'musicShelfRenderer')[0] || { contents: [] }
  const tracks = (shelf.contents || [])
    .map((c: Raw) => c.musicResponsiveListItemRenderer && fromListItem(c.musicResponsiveListItemRenderer))
    .filter((i: Item | null) => i && i.track)
    .map((i: Item) => {
      const t = i.track!
      // Album rows omit what the header already says.
      if (!isPlaylist) {
        if (!t.album) (t.album = title), (t.albumId = id)
        if (!t.image) t.image = image
        if (t.artist === 'Unknown Artist' && artist) (t.artist = artist), (t.artists = artistRun ? [{ name: artistRun.text, id: artistRun.navigationEndpoint.browseEndpoint.browseId }] : [])
      }
      return t
    })
  const desc = find(j, 'musicDescriptionShelfRenderer')[0]
  return {
    kind: isPlaylist ? 'playlist' : 'album',
    id,
    title,
    subtitle: [text(h.subtitle), text(h.secondSubtitle)].filter(Boolean).join(' · '),
    artist,
    artistId: artistRun && artistRun.navigationEndpoint.browseEndpoint.browseId,
    image,
    description: desc ? text(desc.description) : text(h.description && h.description.musicDescriptionShelfRenderer && h.description.musicDescriptionShelfRenderer.description),
    tracks,
  }
}

export const collection = async (id: string) => parseCollection(id, await music('browse', { browseId: /^(PL|RD|OLAK)/.test(id) ? 'VL' + id : id }))

export function parseArtist(id: string, j: Raw): ArtistPage {
  const h = find(j, 'musicImmersiveHeaderRenderer')[0] || find(j, 'musicVisualHeaderRenderer')[0] || find(j, 'musicResponsiveHeaderRenderer')[0] || {}
  const songsShelf = find(j.contents, 'musicShelfRenderer')[0]
  const topSongs: Track[] = songsShelf ? songsShelf.contents.map(itemOf).filter(nonNull).map((i: Item) => i.track).filter(Boolean) : []
  const name = text(h.title)
  topSongs.forEach((t) => {
    if (t.artist === 'Unknown Artist') (t.artist = name), (t.artists = [{ name, id }])
  })
  const shelves = shelvesOf(j.contents).filter((s) => s.title && !/^top songs$/i.test(s.title))
  return { id, name, image: bestThumb(thumbsOf(h.thumbnail || h.foregroundThumbnail)), description: text(h.description).split('\n')[0], topSongs, shelves }
}

export const artist = async (id: string) => parseArtist(id, await music('browse', { browseId: id }))

export function parseRadio(j: Raw): Track[] {
  const out: Track[] = []
  for (const p of find(j, 'playlistPanelVideoRenderer')) {
    if (!p.videoId) continue
    const runs = (p.longBylineText && p.longBylineText.runs) || (p.shortBylineText && p.shortBylineText.runs) || []
    const b = byline(runs)
    b.durationSec = p.lengthText ? toSeconds(text(p.lengthText)) : 0
    const w = watchOf(p.navigationEndpoint)
    out.push(makeTrack(p.videoId, text(p.title), b, runs, bestThumb(thumbsOf(p.thumbnail)), isExplicit(p), !!(w && w.isVideo)))
  }
  return out
}

/** YouTube Music's radio ("RDAMVM") after a track: what AutoPlay and recommendations use. */
export const radio = async (videoId: string) =>
  parseRadio(await music('next', { videoId, playlistId: 'RDAMVM' + videoId, isAudioOnly: true, enablePersistentPlaylistPanel: true, tunerSettingValue: 'AUTOMIX_SETTING_NORMAL' })).filter((t) => t.id !== videoId)

// ---- Playback ----------------------------------------------------------------------

export interface Format {
  itag: number
  url?: string
  mimeType: string
  bitrate: number
  audioQuality?: string
}

/** Opus/WebM when the TV can decode it (higher quality), else AAC/MP4 (every Tizen TV). */
export function pickFormat(formats: Format[], canOpus: boolean, preferOpus: boolean): Format | null {
  const audio = formats.filter((f) => f.url && f.mimeType.indexOf('audio/') === 0)
  const aac = audio.filter((f) => /mp4a/.test(f.mimeType)).sort((a, b) => b.bitrate - a.bitrate)
  const opus = audio.filter((f) => /opus/.test(f.mimeType)).sort((a, b) => b.bitrate - a.bitrate)
  return (preferOpus && canOpus && opus[0]) || aac[0] || (canOpus && opus[0]) || null
}

let opusSupport: boolean | null = null
function canPlayOpus() {
  if (opusSupport === null) {
    try {
      opusSupport = !!document.createElement('audio').canPlayType('audio/webm; codecs="opus"')
    } catch {
      opusSupport = false
    }
  }
  return opusSupport
}

export async function stream(videoId: string, preferOpus = false): Promise<Stream> {
  if (!visitorData) await music('browse', { browseId: 'FEmusic_home' }).catch(() => null)
  const j = await postJson(PLAYER, { context: context(VISIONOS), videoId, contentCheckOk: true, racyCheckOk: true })
  const status = j.playabilityStatus || {}
  if (status.status !== 'OK') {
    if (/not a bot/i.test(status.reason || '')) {
      // Visitor id went stale; the next try starts a fresh one.
      visitorData = ''
      try {
        localStorage.removeItem('bc.visitor')
      } catch {}
    }
    throw new Error(status.reason || `YouTube refused this track (${status.status || 'no status'})`)
  }
  const f = pickFormat((j.streamingData && j.streamingData.adaptiveFormats) || [], canPlayOpus(), preferOpus)
  if (!f) throw new Error('YouTube sent no playable audio for this track')
  return { url: f.url!, kbps: Math.round(f.bitrate / 1000), codec: /opus/.test(f.mimeType) ? 'Opus' : 'AAC', from: 'ytm' }
}
