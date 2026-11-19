import { useEffect, useRef, useState } from 'preact/hooks'
import { errText, log } from '../lib/log'
import { go } from '../nav'
import { playTracks, shuffleList, sleepIn, player } from '../player'
import { personalShelves } from '../recommend'
import * as saavn from '../sources/jiosaavn'
import type { Item, SearchResults, Shelf, Track } from '../sources/types'
import * as ytm from '../sources/ytm'
import { history, liked, settings, useStore, type Settings } from '../store'
import { Icon, PlayGlyph } from './icons'
import { Ambient, ErrorState, img, Page, ShelfRow, Skeleton, TrackRow, useAsync } from './parts'

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// ---- Home -----------------------------------------------------------------------------

export function Home() {
  const h = useStore(history)
  const personal = useAsync(() => personalShelves(h), [h.length > 0 ? h[0].at : 0])
  const feed = useAsync(() => ytm.home(), [])
  const shelves: Shelf[] = (personal.data || []).concat(feed.data || [])
  return (
    <Page class="home">
      <Ambient />
      <header class="hero">
        <p class="eyebrow-free">{greeting()}</p>
        <h1>Listen Now</h1>
      </header>
      {!h.length ? (
        <p class="lede">Play a few songs and this page learns what you like. Your mixes are built from what you listen to on this TV.</p>
      ) : null}
      {shelves.map((s, i) => (
        <ShelfRow shelf={s} size={i === 0 ? 'l' : s.items[0] && s.items[0].kind === 'artist' ? 's' : 'm'} />
      ))}
      {(personal.loading && h.length) || feed.loading ? <Skeleton rows={shelves.length ? 1 : 3} /> : null}
      {feed.error && !shelves.length ? <ErrorState title="YouTube Music didn't answer" error={feed.error} retry={feed.retry} /> : null}
    </Page>
  )
}

// ---- Search -----------------------------------------------------------------------------

const asItems = (tracks: Track[]): Item[] => tracks.map((t) => ({ kind: 'song', id: t.id, title: t.title, subtitle: t.artist, image: t.image, track: t }))

async function searchAll(q: string): Promise<SearchResults> {
  const [yt, sv] = await Promise.all([
    ytm.search(q),
    saavn.search(q).catch((e) => {
      log.warn(`JioSaavn search failed: ${errText(e)}`)
      return [] as Track[]
    }),
  ])
  return { ...yt, saavn: sv }
}

export function Search() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [sugg, setSugg] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)
  const res = useAsync(() => (query ? searchAll(query) : Promise.resolve(null)), [query])

  useEffect(() => {
    if (!q.trim() || q === query) return setSugg([])
    let live = true
    const timer = setTimeout(() => ytm.suggestions(q).then((s) => live && setSugg(s), () => setSugg([])), 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q])

  const run = (text: string) => {
    setQ(text)
    setQuery(text.trim())
    setSugg([])
    input.current && input.current.blur()
  }
  const r = res.data
  return (
    <Page class="search">
      <header class="hero">
        <h1>Search</h1>
      </header>
      <div class="searchbar">
        <Icon name="search" size={36} />
        <input
          ref={input}
          data-f
          data-autofocus={!query ? '' : undefined}
          data-key="search-input"
          value={q}
          placeholder="Artists, songs, albums"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.keyCode === 13 && run(q)}
        />
      </div>
      {sugg.length ? (
        <div class="chips" data-row>
          {sugg.map((s) => (
            <button data-f class="chip" onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {!query ? <p class="lede">Press OK on the search field to type with the remote, or speak into it with the TV's voice button.</p> : null}
      {res.loading && query ? <Skeleton rows={2} /> : null}
      {res.error ? <ErrorState title="Search failed" error={res.error} retry={res.retry} /> : null}
      {r ? (
        <>
          {r.songs.length ? (
            <section class="shelf">
              <h2>Songs</h2>
              <div class="tgrid">
                {r.songs.slice(0, 12).map((t, i) => (
                  <TrackRow t={t} i={i} list={r.songs} />
                ))}
              </div>
            </section>
          ) : null}
          {r.artists.length ? <ShelfRow shelf={{ title: 'Artists', items: r.artists }} size="s" /> : null}
          {r.albums.length ? <ShelfRow shelf={{ title: 'Albums', items: r.albums }} /> : null}
          {r.saavn.length ? <ShelfRow shelf={{ title: 'From JioSaavn', items: asItems(r.saavn) }} /> : null}
          {r.playlists.length ? <ShelfRow shelf={{ title: 'Playlists', items: r.playlists }} /> : null}
          {!r.songs.length && !r.albums.length && !r.artists.length && !r.saavn.length ? <ErrorState title={`Nothing found for "${query}"`} error="Check the spelling or try fewer words." /> : null}
        </>
      ) : null}
    </Page>
  )
}

// ---- Album / playlist ---------------------------------------------------------------------

function PlayButtons({ tracks, keyPrefix }: { tracks: Track[]; keyPrefix: string }) {
  return (
    <div class="actions">
      <button data-f data-autofocus data-key={keyPrefix + 'play'} class="pill primary" onClick={() => playTracks(tracks, 0)}>
        <PlayGlyph size={30} /> Play
      </button>
      <button data-f data-key={keyPrefix + 'shuffle'} class="pill" onClick={() => playTracks(shuffleList(tracks), 0)}>
        <Icon name="shuffle" size={30} /> Shuffle
      </button>
    </div>
  )
}

export function Collection({ id }: { id: string }) {
  const c = useAsync(() => ytm.collection(id), [id])
  if (c.error) return <Page><ErrorState title="Couldn't open this" error={c.error} retry={c.retry} /></Page>
  if (!c.data) return <Page><Skeleton rows={2} /></Page>
  const a = c.data
  const total = a.tracks.reduce((s, t) => s + t.durationSec, 0)
  return (
    <Page class="detail">
      <Ambient image={a.image} />
      <aside class="detail-side">
        <div class="detail-art">
          <img src={img(a.image, 544)} width="520" height="520" alt="" />
        </div>
        <h1>{a.title}</h1>
        {a.artistId ? (
          <button data-f data-key="artist-link" class="link" onClick={() => go({ name: 'artist', id: a.artistId! })}>
            {a.artist}
          </button>
        ) : (
          <p class="by">{a.artist}</p>
        )}
        <p class="meta">{[a.subtitle, total && !/minute|hour/.test(a.subtitle) ? Math.round(total / 60) + ' min' : ''].filter(Boolean).join(' · ')}</p>
        <PlayButtons tracks={a.tracks} keyPrefix="c" />
      </aside>
      <section class="detail-list">
        {a.tracks.map((t, i) => (
          <TrackRow t={t} i={i} list={a.tracks} showArt={a.kind === 'playlist'} />
        ))}
        {!a.tracks.length ? <p class="lede">This list is empty.</p> : null}
      </section>
    </Page>
  )
}

// ---- Artist ------------------------------------------------------------------------------------

export function Artist({ id }: { id: string }) {
  const p = useAsync(() => ytm.artist(id), [id])
  if (p.error) return <Page><ErrorState title="Couldn't open this artist" error={p.error} retry={p.retry} /></Page>
  if (!p.data) return <Page><Skeleton rows={2} /></Page>
  const a = p.data
  return (
    <Page class="artist">
      <header class="artist-hero">
        <img src={img(a.image, 1280)} alt="" />
        <div class="artist-scrim" />
        <div class="artist-head">
          <h1>{a.name}</h1>
          {a.description ? <p>{a.description}</p> : null}
          <PlayButtons tracks={a.topSongs} keyPrefix="a" />
        </div>
      </header>
      {a.topSongs.length ? (
        <section class="shelf">
          <h2>Top Songs</h2>
          <div class="tgrid">
            {a.topSongs.map((t, i) => (
              <TrackRow t={t} i={i} list={a.topSongs} />
            ))}
          </div>
        </section>
      ) : null}
      {a.shelves.map((s) => (
        <ShelfRow shelf={s} size={s.items[0] && s.items[0].kind === 'artist' ? 's' : 'm'} />
      ))}
    </Page>
  )
}

// ---- Library ---------------------------------------------------------------------------------

export function Library() {
  const likes = useStore(liked)
  const h = useStore(history)
  const recent: Track[] = []
  const seen = new Set<string>()
  for (const x of h) if (!seen.has(x.t.id) && recent.length < 60) seen.add(x.t.id), recent.push(x.t)
  return (
    <Page class="library">
      <header class="hero">
        <h1>Library</h1>
      </header>
      <section class="shelf">
        <h2>Liked Songs</h2>
        {likes.length ? (
          <>
            <PlayButtons tracks={likes} keyPrefix="l" />
            <div class="tgrid">
              {likes.map((t, i) => (
                <TrackRow t={t} i={i} list={likes} />
              ))}
            </div>
          </>
        ) : (
          <p class="lede">Press the heart on Now Playing to keep a song here.</p>
        )}
      </section>
      <section class="shelf">
        <h2>Recently Played</h2>
        {recent.length ? (
          <div class="tgrid">
            {recent.map((t, i) => (
              <TrackRow t={t} i={i} list={recent} />
            ))}
          </div>
        ) : (
          <p class="lede">Songs you play on this TV appear here.</p>
        )}
      </section>
    </Page>
  )
}

// ---- Settings ------------------------------------------------------------------------------------

function Toggle({ k, label, note }: { k: keyof Settings; label: string; note: string }) {
  const s = useStore(settings)
  return (
    <button data-f data-key={'set-' + k} class="setting" role="switch" aria-checked={s[k]} onClick={() => settings.set((x) => ({ ...x, [k]: !x[k] }))}>
      <span>
        <b>{label}</b>
        <i>{note}</i>
      </span>
      <span class={'switch' + (s[k] ? ' on' : '')} />
    </button>
  )
}

function deviceInfo(): string[] {
  const w = window as any
  const out = [navigator.userAgent]
  out.push(`Screen ${screen.width}×${screen.height}, page ${innerWidth}×${innerHeight}`)
  try {
    const p = w.webapis && w.webapis.productinfo
    out.push(p ? `Model ${p.getRealModel ? p.getRealModel() : p.getModel()}, firmware ${p.getFirmware ? p.getFirmware() : '?'}` : 'Not running on a Samsung TV (no webapis)')
  } catch (e) {
    out.push('webapis error: ' + errText(e))
  }
  try {
    out.push('Opus support: ' + (document.createElement('audio').canPlayType('audio/webm; codecs="opus"') || 'no'))
  } catch {}
  return out
}

export function SettingsScreen() {
  const s = useStore(player)
  const [, setTick] = useState(0)
  useEffect(() => log.subscribe(() => setTick((n) => n + 1)), [])
  const sleepLeft = s.sleepAt ? Math.max(1, Math.round((s.sleepAt - Date.now()) / 60000)) : 0
  // Off → 15 → 30 → 60 → 90 → Off
  const cycleSleep = () => sleepIn([15, 30, 60, 90].filter((m) => m > sleepLeft)[0] || null)
  return (
    <Page class="settings">
      <header class="hero">
        <h1>Settings</h1>
      </header>
      <section class="setlist">
        <Toggle k="preferSaavn" label="JioSaavn 320 kbps when it matches" note="Plays JioSaavn's copy of a YouTube song when title, artist and length agree." />
        <Toggle k="preferOpus" label="Opus audio from YouTube" note="Slightly better than AAC. Turns itself off if this TV can't decode it." />
        <Toggle k="autoplay" label="AutoPlay" note="Keeps playing similar songs when the queue ends." />
        <Toggle k="showLyrics" label="Lyrics on Now Playing" note="Synced lyrics from LRCLIB when available." />
        <button data-f data-key="set-sleep" class="setting" onClick={cycleSleep}>
          <span>
            <b>Sleep timer</b>
            <i>Pauses the music after a while. Press OK to change.</i>
          </span>
          <span class="value">{sleepLeft ? `${sleepLeft} min left` : 'Off'}</span>
        </button>
        <button
          data-f
          data-key="set-clear"
          class="setting"
          onClick={() => {
            history.set([])
            log.info('Listening history cleared')
          }}
        >
          <span>
            <b>Clear listening history</b>
            <i>Resets recommendations on this TV. Liked songs stay.</i>
          </span>
          <span class="value">{history.get().length} plays</span>
        </button>
      </section>
      <section class="shelf diag">
        <h2>Diagnostics</h2>
        <pre>{deviceInfo().join('\n')}</pre>
        <h3>Log</h3>
        <pre class="log" data-f data-key="log" tabIndex={0}>
          {log
            .lines()
            .slice(-40)
            .reverse()
            .map((l) => `${new Date(l.at).toTimeString().slice(0, 8)} ${l.level.toUpperCase()} ${l.text}`)
            .join('\n') || 'Nothing logged yet.'}
        </pre>
      </section>
    </Page>
  )
}
