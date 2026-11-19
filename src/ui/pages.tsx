import { useEffect, useState } from 'preact/hooks'
import { cached } from '../lib/cache'
import { log } from '../lib/log'
import { openDetail } from '../nav'
import { player, playTracks, shuffleList, sleepIn } from '../player'
import { asItem, personalShelves } from '../recommend'
import type { Item, Shelf } from '../sources/types'
import * as ytm from '../sources/ytm'
import { history, liked, saved, settings, toggleSaved, useStore, type Settings, type Theme } from '../store'
import { Art, Button, ListRow, Loading, Message, Page, ShelfRow, ShelfTitle, SongGrid, useAsync } from './kit'

// ---- Home ---------------------------------------------------------------------------------

export function Home({ hidden }: { hidden?: boolean }) {
  const h = useStore(history)
  // Recomputed every few plays, not on each one, so Home doesn't reshuffle under the remote.
  const bucket = Math.floor(h.length / 4)
  const personal = useAsync(() => personalShelves(h), [bucket])
  const feed = useAsync(() => cached('home', ytm.home), [])
  const shelves: Shelf[] = (personal.data || []).concat(feed.data || [])
  return (
    <Page hidden={hidden}>
      {shelves.map((s, i) => (
        <ShelfRow shelf={s} big={i === 0} />
      ))}
      {!shelves.length && (feed.loading || personal.loading) ? <Loading shelves={3} /> : null}
      {feed.error && !shelves.length ? <Message title="Couldn't load Home" text={`YouTube Music didn't answer (${feed.error}). Check the TV's internet connection, then try again.`} action="Try Again" onAction={feed.retry} /> : null}
    </Page>
  )
}

// ---- Explore ------------------------------------------------------------------------------

function MoodCard({ m }: { m: ytm.Mood }) {
  return (
    <button data-f data-key={'mood:' + m.params} class="mood" onClick={() => openDetail({ name: 'mood', id: m.browseId, params: m.params, title: m.title })}>
      <span class="mood-stripe" style={{ background: m.color }} />
      <b>{m.title}</b>
    </button>
  )
}

export function Explore({ hidden }: { hidden?: boolean }) {
  const e = useAsync(() => cached('explore', ytm.explore), [])
  const groups = useAsync(() => cached('moods', ytm.moodGroups), [])
  if (e.error && !e.data) return <Page hidden={hidden}><Message title="Couldn't load Explore" text={e.error} action="Try Again" onAction={e.retry} /></Page>
  return (
    <Page hidden={hidden}>
      {e.data ? e.data.shelves.map((s, i) => <ShelfRow shelf={s} big={i === 0} />) : <Loading shelves={2} />}
      {(groups.data || []).map((g) => (
        <section class="shelf" data-sec>
          <ShelfTitle title={g.title} />
          <div class="moods">
            {g.items.map((m) => (
              <MoodCard m={m} />
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}

export function MoodPage({ id, params, title, hidden }: { id: string; params: string; title: string; hidden?: boolean }) {
  const s = useAsync(() => cached('mood:' + params, () => ytm.browseShelves(id, params)), [params])
  return (
    <Page hidden={hidden}>
      <header class="page-head" data-sec>
        <h1>{title}</h1>
      </header>
      {s.data ? s.data.map((sh) => <ShelfRow shelf={sh} />) : s.error ? <Message title={`Couldn't load ${title}`} text={s.error} action="Try Again" onAction={s.retry} /> : <Loading shelves={2} />}
    </Page>
  )
}

// ---- Library ---------------------------------------------------------------------------------

export function Library({ hidden }: { hidden?: boolean }) {
  const likes = useStore(liked)
  const keep = useStore(saved)
  const h = useStore(history)
  const recent: Item[] = []
  const seen = new Set<string>()
  for (const p of h) if (!seen.has(p.t.id) && recent.length < 24) seen.add(p.t.id), recent.push(asItem(p.t))
  if (!likes.length && !keep.length && !recent.length)
    return (
      <Page hidden={hidden}>
        <Message icon="music" title="Your library is empty" text="Songs you favourite, albums and playlists you save, and what you play on this TV all appear here." />
      </Page>
    )
  return (
    <Page hidden={hidden}>
      {likes.length ? (
        <section class="shelf" data-sec>
          <ShelfTitle title="Favourite Songs" subtitle={likes.length === 1 ? '1 song' : `${likes.length} songs`} />
          <div class="actions pad">
            <Button k="lib-play" icon="play" label="Play" primary onClick={() => playTracks(likes, 0)} />
            <Button k="lib-shuffle" icon="shuffle" label="Shuffle" onClick={() => playTracks(shuffleList(likes), 0)} />
          </div>
          <div class="pad">
            <SongGrid tracks={likes.slice(0, 60)} />
          </div>
        </section>
      ) : null}
      {keep.length ? <ShelfRow shelf={{ title: 'Albums & Playlists', items: keep }} /> : null}
      {recent.length ? <ShelfRow shelf={{ title: 'Recently Played', items: recent }} /> : null}
    </Page>
  )
}

// ---- Album / playlist ------------------------------------------------------------------------

export function Collection({ id, hidden }: { id: string; hidden?: boolean }) {
  const c = useAsync(() => cached('c:' + id, () => ytm.collection(id)), [id])
  const keep = useStore(saved)
  if (c.error) return <Page hidden={hidden}><Message title="Couldn't open this" text={c.error} action="Try Again" onAction={c.retry} /></Page>
  if (!c.data) return <Page hidden={hidden}><Loading shelves={1} /></Page>
  const a = c.data
  const isSaved = keep.some((x) => x.id === a.id)
  const total = a.tracks.reduce((s, t) => s + t.durationSec, 0)
  const meta = [a.subtitle, total && !/minute|hour/.test(a.subtitle) ? `${Math.round(total / 60)} min` : ''].filter(Boolean).join(' · ')
  return (
    <main class="page detail" data-zone="page" style={hidden ? { display: 'none' } : undefined}>
      <aside class="detail-side">
        <Art src={a.image} size={480} class="detail-art" />
        <h1>{a.title}</h1>
        {a.artistId ? (
          <button data-f data-key="artist-link" class="link" onClick={() => openDetail({ name: 'artist', id: a.artistId! })}>
            {a.artist}
          </button>
        ) : (
          <p class="by">{a.artist}</p>
        )}
        <p class="meta">{meta}</p>
        <div class="actions">
          <Button k="c-play" icon="play" label="Play" primary autofocus onClick={() => playTracks(a.tracks, 0)} />
          <Button k="c-shuffle" icon="shuffle" label="Shuffle" onClick={() => playTracks(shuffleList(a.tracks), 0)} />
          <Button
            k="c-save"
            icon={isSaved ? 'check' : 'plus'}
            label={isSaved ? 'Remove from Library' : 'Add to Library'}
            iconOnly
            onClick={() => toggleSaved({ kind: a.kind, id: a.id, title: a.title, subtitle: a.artist, image: a.image })}
          />
        </div>
      </aside>
      <div class="detail-list">
        <div class="track" data-track>
          {a.tracks.length ? <SongGrid tracks={a.tracks} numbered={a.kind === 'album'} cols={1} /> : <p class="note">This list has no songs.</p>}
        </div>
      </div>
    </main>
  )
}

// ---- Artist -------------------------------------------------------------------------------------

export function Artist({ id, hidden }: { id: string; hidden?: boolean }) {
  const p = useAsync(() => cached('a:' + id, () => ytm.artist(id)), [id])
  if (p.error) return <Page hidden={hidden}><Message title="Couldn't open this artist" text={p.error} action="Try Again" onAction={p.retry} /></Page>
  if (!p.data) return <Page hidden={hidden}><Loading shelves={2} /></Page>
  const a = p.data
  return (
    <Page hidden={hidden} class="artist">
      <header class="artist-head" data-sec>
        <Art src={a.image} size={300} round />
        <div class="artist-id">
          <h1>{a.name}</h1>
          {a.description ? <p>{a.description}</p> : null}
          <div class="actions">
            <Button k="a-play" icon="play" label="Play" primary autofocus onClick={() => playTracks(a.topSongs, 0)} />
            <Button k="a-shuffle" icon="shuffle" label="Shuffle" onClick={() => playTracks(shuffleList(a.topSongs), 0)} />
          </div>
        </div>
      </header>
      {a.topSongs.length ? (
        <section class="shelf" data-sec>
          <ShelfTitle title="Top Songs" />
          <div class="pad">
            <SongGrid tracks={a.topSongs.slice(0, 10)} cols={2} />
          </div>
        </section>
      ) : null}
      {a.shelves.map((s) => (
        <ShelfRow shelf={s} />
      ))}
    </Page>
  )
}

// ---- Settings ---------------------------------------------------------------------------------

const THEMES: { id: Theme; label: string }[] = [
  { id: 'dynamic', label: 'Dynamic Artwork' },
  { id: 'oled', label: 'Pure Black' },
  { id: 'midnight', label: 'Midnight' },
]

function Toggle({ k, title, subtitle }: { k: keyof Settings; title: string; subtitle: string }) {
  const s = useStore(settings)
  return <ListRow k={'set-' + k} title={title} subtitle={subtitle} value={s[k] ? 'On' : 'Off'} onClick={() => settings.set((x) => ({ ...x, [k]: !x[k] }))} />
}

function deviceInfo(): string[] {
  const w = window as any
  const out = [navigator.userAgent]
  out.push(`Screen ${screen.width}×${screen.height}, page ${innerWidth}×${innerHeight}`)
  try {
    const p = w.webapis && w.webapis.productinfo
    out.push(p ? `Model ${p.getRealModel ? p.getRealModel() : p.getModel()}, firmware ${p.getFirmware ? p.getFirmware() : 'unknown'}` : 'Not running on a Samsung TV (no webapis)')
  } catch (e) {
    out.push('webapis error: ' + String(e))
  }
  try {
    out.push('Opus support: ' + (document.createElement('audio').canPlayType('audio/webm; codecs="opus"') || 'no'))
  } catch {}
  return out
}

export function SettingsPage({ hidden }: { hidden?: boolean }) {
  const s = useStore(settings)
  const p = useStore(player)
  const h = useStore(history)
  const [confirmClear, setConfirmClear] = useState(false)
  const [diag, setDiag] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => log.subscribe(() => diag && tick((n) => n + 1)), [diag])
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(t)
  }, [confirmClear])
  const sleepLeft = p.sleepAt ? Math.max(1, Math.round((p.sleepAt - Date.now()) / 60000)) : 0
  const theme = THEMES.filter((t) => t.id === s.theme)[0] || THEMES[0]
  return (
    <Page hidden={hidden} class="settings">
      <header class="page-head" data-sec>
        <h1>Settings</h1>
      </header>
      <section class="group" data-sec>
        <h3>Playback</h3>
        <Toggle k="preferSaavn" title="JioSaavn 320 kbps" subtitle="Plays JioSaavn's copy of a YouTube song when the title, artist and length match." />
        <Toggle k="preferOpus" title="Opus audio" subtitle="Slightly better than AAC from YouTube. Turns itself off if this TV can't play it." />
        <Toggle k="autoplay" title="AutoPlay" subtitle="Keeps playing similar songs when the queue ends." />
        <Toggle k="showLyrics" title="Lyrics" subtitle="Shows synced lyrics beside the artwork in Now Playing." />
        <ListRow k="set-sleep" title="Sleep Timer" subtitle="Pauses the music after the time you choose." value={sleepLeft ? `${sleepLeft} min left` : 'Off'} onClick={() => sleepIn([15, 30, 60, 90].filter((m) => m > sleepLeft)[0] || null)} />
      </section>
      <section class="group" data-sec>
        <h3>Appearance</h3>
        <ListRow k="set-theme" title="Theme" subtitle="The colour behind every screen." value={theme.label} onClick={() => settings.set((x) => ({ ...x, theme: THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length].id }))} />
      </section>
      <section class="group" data-sec>
        <h3>Listening History</h3>
        <ListRow
          k="set-clear"
          title={confirmClear ? 'Press OK again to clear' : 'Clear Listening History'}
          subtitle="Resets Made for You and Recently Played on this TV. Favourites stay."
          value={`${h.length} plays`}
          destructive
          onClick={() => {
            if (!confirmClear) return setConfirmClear(true)
            history.set([])
            setConfirmClear(false)
            log.info('Listening history cleared')
          }}
        />
      </section>
      <section class="group" data-sec>
        <h3>About</h3>
        <ListRow k="set-diag" title="Diagnostics" subtitle="Device details and the error log, for reporting problems." value={diag ? 'Hide' : 'Show'} onClick={() => setDiag(!diag)} />
        {diag ? (
          <pre class="diag">
            {deviceInfo().join('\n') +
              '\n\n' +
              (log
                .lines()
                .slice(-30)
                .reverse()
                .map((l) => `${new Date(l.at).toTimeString().slice(0, 8)}  ${l.level.toUpperCase()}  ${l.text}`)
                .join('\n') || 'Nothing logged yet.')}
          </pre>
        ) : null}
        <p class="note">BitChord TV 0.2 · an unofficial port of BitChord (GPL-3.0). Not affiliated with Google, YouTube or JioSaavn.</p>
      </section>
    </Page>
  )
}
