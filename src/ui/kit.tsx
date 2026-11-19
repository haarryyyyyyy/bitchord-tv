// The TV kit, after BitChord's TvKit.kt: lockups that lift on focus, white-platter rows and
// buttons, edge-to-edge shelves. Only transform and opacity animate.
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { errText } from '../lib/log'
import { openDetail, openMenu } from '../nav'
import { player, playTracks } from '../player'
import type { Item, Shelf, Track } from '../sources/types'
import { art } from '../sources/ytm'
import { useStore } from '../store'
import { Icon } from './icons'
import { LazyImg } from './lazyimg'

export const fmt = (s: number) => (s > 0 ? Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2) : '')

/** Sized artwork for both catalogues. */
export function img(url: string, size: number) {
  if (!url) return ''
  if (/saavncdn/.test(url)) return url.replace(/\d+x\d+(?=\.\w+$)/, size > 160 ? '500x500' : '150x150')
  return art(url, size)
}

/** Preact passes unknown `on…` props as custom DOM events; this one comes from focus.ts. */
export const longPress = (fn: (() => void) | null) => (fn ? ({ onlongpress: fn } as Record<string, unknown>) : {})

export interface Async<T> {
  data: T | null
  error: string | null
  loading: boolean
  retry: () => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [n, setN] = useState(0)
  const [s, setS] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    setS((p) => ({ data: p.data, error: null, loading: true }))
    fn().then(
      (data) => live && setS({ data, error: null, loading: false }),
      (e) => live && setS({ data: null, error: errText(e), loading: false }),
    )
    return () => {
      live = false
    }
  }, deps.concat([n]))
  return { ...s, retry: () => setN(n + 1) }
}

/** Plays a song (with its shelf as the queue) or opens an album, playlist or artist. */
export function openItem(item: Item, siblings?: Item[]) {
  if (item.track) {
    const tracks = (siblings || [item]).filter((i) => i.track).map((i) => i.track!)
    playTracks(tracks, Math.max(0, tracks.indexOf(item.track)))
  } else if (item.kind === 'artist') openDetail({ name: 'artist', id: item.id })
  else openDetail({ name: 'album', id: item.id })
}

/** The id of the track playing now, for marking it in lists. */
export function useNowId(): { id: string | null; playing: boolean } {
  const s = useStore(player)
  const t = s.queue[s.index]
  return { id: t ? t.id : null, playing: s.playing }
}

export const Explicit = () => (
  <span class="explicit" aria-label="Explicit">
    E
  </span>
)

/** BitChord's mini equaliser for the playing row. */
export const Bars = ({ on }: { on: boolean }) => (
  <span class={'bars' + (on ? ' on' : '')} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
)

export function Art({ src, size, round, class: cls = '' }: { src: string; size: number; round?: boolean; class?: string }) {
  return (
    <span class={'art ' + cls + (round ? ' round' : '')} style={{ width: size, height: size }}>
      <LazyImg src={img(src, size)} size={size} />
    </span>
  )
}

/** The tvOS lockup: artwork that lifts, caption that steps down out of its way. */
export function Lockup({ item, siblings, width = 262, circle, big }: { item: Item; siblings?: Item[]; width?: number; circle?: boolean; big?: boolean }) {
  const round = circle || item.kind === 'artist'
  return (
    <button
      data-f
      data-key={item.kind + ':' + item.id}
      class={'lockup' + (round ? ' circle' : '') + (big ? ' big' : '')}
      style={{ width }}
      onClick={() => openItem(item, siblings)}
      aria-label={item.title + (item.subtitle ? ', ' + item.subtitle : '')}
      {...longPress(item.track ? () => openMenu(item.track!) : null)}
    >
      <Art src={item.image} size={width} round={round} />
      <span class="cap">
        <b>
          {item.title}
          {item.track && item.track.explicit ? <Explicit /> : null}
        </b>
        {item.subtitle && !round ? <i>{item.subtitle}</i> : null}
      </span>
    </button>
  )
}

export function ShelfTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header class="shelf-title">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  )
}

/** A titled shelf that runs edge to edge; the row moves by transform. */
export function ShelfRow({ shelf, big }: { shelf: Shelf; big?: boolean }) {
  const artists = shelf.items.length > 0 && shelf.items.filter((i) => i.kind === 'artist').length * 2 > shelf.items.length
  const width = big ? 326 : artists ? 240 : 262
  return (
    <section class="shelf" data-sec>
      {shelf.title ? <ShelfTitle title={shelf.title} /> : null}
      <div class="row">
        <div class="row-track" data-row>
          {shelf.items.map((item) => (
            <Lockup item={item} siblings={shelf.items} width={width} circle={artists} big={big} />
          ))}
        </div>
      </div>
    </section>
  )
}

/** A track in a list: number or artwork, title and artist, length. Hold OK for its actions. */
export function SongRow({ t, i, list, numbered, now }: { t: Track; i: number; list: Track[]; numbered?: boolean; now: { id: string | null; playing: boolean } }) {
  const cur = now.id === t.id
  return (
    <button
      data-f
      data-key={'s' + i + ':' + t.id}
      class={'song' + (cur ? ' current' : '') + (numbered ? ' numbered' : '')}
      onClick={() => playTracks(list, i)}
      {...longPress(() => openMenu(t))}
    >
      {numbered ? <span class="song-n">{cur ? <Bars on={now.playing} /> : i + 1}</span> : <Art src={t.image} size={68} class="song-art" />}
      <span class="song-text">
        <b>
          {t.title}
          {t.explicit ? <Explicit /> : null}
        </b>
        <i>{t.artist}</i>
      </span>
      {!numbered && cur ? <Bars on={now.playing} /> : null}
      <span class="song-time">{fmt(t.durationSec)}</span>
    </button>
  )
}

export function SongGrid({ tracks, numbered, cols = 3 }: { tracks: Track[]; numbered?: boolean; cols?: number }) {
  const now = useNowId()
  return (
    <div class={'songs cols-' + cols}>
      {tracks.map((t, i) => (
        <SongRow t={t} i={i} list={tracks} numbered={numbered} now={now} />
      ))}
    </div>
  )
}

export function Button({ icon, label, primary, onClick, k, autofocus, iconOnly }: { icon?: string; label: string; primary?: boolean; onClick: () => void; k: string; autofocus?: boolean; iconOnly?: boolean }) {
  return (
    <button data-f data-key={k} data-autofocus={autofocus ? '' : undefined} class={'btn' + (primary ? ' primary' : '') + (iconOnly ? ' icon-only' : '')} onClick={onClick} aria-label={iconOnly ? label : undefined}>
      {icon ? icon === 'play' ? <PlayIcon /> : <Icon name={icon} size={30} stroke={2.4} /> : null}
      {iconOnly ? null : <span>{label}</span>}
    </button>
  )
}

const PlayIcon = () => (
  <svg class="icon" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z" fill="currentColor" />
  </svg>
)

/** The tvOS list row (Settings, menus): white platter on focus. */
export function ListRow({ title, subtitle, value, icon, onClick, k, destructive, autofocus }: { title: string; subtitle?: string; value?: ComponentChildren; icon?: string; onClick: () => void; k: string; destructive?: boolean; autofocus?: boolean }) {
  return (
    <button data-f data-key={k} data-autofocus={autofocus ? '' : undefined} class={'lrow' + (destructive ? ' destructive' : '')} onClick={onClick}>
      {icon ? <Icon name={icon} size={34} /> : null}
      <span class="lrow-text">
        <b>{title}</b>
        {subtitle ? <i>{subtitle}</i> : null}
      </span>
      {value != null ? <span class="lrow-value">{value}</span> : null}
    </button>
  )
}

export const Spinner = () => <span class="spinner" role="status" aria-label="Loading" />

export function ShelfPlaceholder({ count = 6, width = 262 }: { count?: number; width?: number }) {
  const cards = []
  for (let i = 0; i < count; i++)
    cards.push(
      <span class="lockup" style={{ width }}>
        <span class="art ph" style={{ width, height: width }} />
        <span class="ph ph-line" />
        <span class="ph ph-line short" />
      </span>,
    )
  return (
    <section class="shelf" aria-hidden="true">
      <div class="shelf-title">
        <span class="ph ph-title" />
      </div>
      <div class="row">
        <div class="row-track">{cards}</div>
      </div>
    </section>
  )
}

export function Loading({ shelves = 2 }: { shelves?: number }) {
  const out = []
  for (let i = 0; i < shelves; i++) out.push(<ShelfPlaceholder width={i === 0 ? 326 : 262} count={i === 0 ? 5 : 6} />)
  return <div class="loading">{out}</div>
}

export function Message({ icon = 'alert', title, text, action, onAction }: { icon?: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <div class="message" data-sec>
      <Icon name={icon} size={64} stroke={1.6} />
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
      {action && onAction ? <Button k="message-action" label={action} onClick={onAction} primary autofocus /> : null}
    </div>
  )
}

/** A page: the focus zone, and the track that scrolls by transform. */
export function Page({ children, class: cls = '', hidden }: { children: ComponentChildren; class?: string; hidden?: boolean }) {
  return (
    <main class={'page ' + cls} data-zone="page" style={hidden ? { display: 'none' } : undefined}>
      <div class="track" data-track>
        {children}
      </div>
    </main>
  )
}
