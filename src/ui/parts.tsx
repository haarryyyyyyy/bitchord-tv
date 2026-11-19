import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { errText } from '../lib/log'
import { go } from '../nav'
import { current, player, playTracks } from '../player'
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

export function open(item: Item, siblings?: Item[]) {
  if (item.track) {
    const tracks = (siblings || [item]).filter((i) => i.track).map((i) => i.track!)
    playTracks(tracks, Math.max(0, tracks.indexOf(item.track)))
  } else if (item.kind === 'artist') go({ name: 'artist', id: item.id })
  else go({ name: 'album', id: item.id })
}

export const Explicit = () => (
  <span class="explicit" aria-label="Explicit">
    E
  </span>
)

/** Bars that move while a track plays; static when paused. */
export function NowBars({ on }: { on: boolean }) {
  return (
    <span class={'bars' + (on ? ' on' : '')} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function Card({ item, siblings, size = 'm' }: { item: Item; siblings?: Item[]; size?: 's' | 'm' | 'l' }) {
  const round = item.kind === 'artist'
  const px = size === 'l' ? 340 : size === 's' ? 220 : 260
  return (
    <button data-f data-key={item.kind + item.id} class={`card card-${size}${round ? ' round' : ''}`} onClick={() => open(item, siblings)}>
      <span class="art" style={{ width: px, height: px }}>
        <LazyImg src={img(item.image, px)} size={px} />
      </span>
      <b>
        {item.title}
        {item.track && item.track.explicit ? <Explicit /> : null}
      </b>
      <i>{item.subtitle}</i>
    </button>
  )
}

export function ShelfRow({ shelf, size }: { shelf: Shelf; size?: 's' | 'm' | 'l' }) {
  return (
    <section class="shelf">
      {shelf.title ? <h2>{shelf.title}</h2> : null}
      <div class="row" data-row>
        {shelf.items.map((item) => (
          <Card item={item} siblings={shelf.items} size={size} />
        ))}
      </div>
    </section>
  )
}

export function TrackRow({ t, i, list, showArt = true, index }: { t: Track; i: number; list: Track[]; showArt?: boolean; index?: number }) {
  const s = useStore(player)
  const cur = s.queue[s.index]
  const isCur = !!cur && cur.id === t.id
  return (
    <button data-f data-key={'t' + i + t.id} class={'trow' + (isCur ? ' current' : '')} onClick={() => playTracks(list, i)}>
      {showArt ? <LazyImg class="trow-art" src={img(t.image, 120)} size={72} /> :<span class="trow-n">{isCur ? <NowBars on={s.playing} /> : index != null ? index : i + 1}</span>}
      <span class="trow-text">
        <b>
          {t.title}
          {t.explicit ? <Explicit /> : null}
        </b>
        <i>{t.artist + (t.album && showArt ? ' · ' + t.album : '')}</i>
      </span>
      {showArt && isCur ? <NowBars on={s.playing} /> : null}
      <span class="trow-time">{fmt(t.durationSec)}</span>
    </button>
  )
}

export function Skeleton({ rows = 2 }: { rows?: number }) {
  const shelves = []
  for (let r = 0; r < rows; r++)
    shelves.push(
      <section class="shelf" aria-hidden="true">
        <div class="sk sk-title" />
        <div class="row">
          {[0, 1, 2, 3, 4, 5].map(() => (
            <span class="card card-m">
              <span class="art sk" style={{ width: 260, height: 260 }} />
              <span class="sk sk-line" />
              <span class="sk sk-line short" />
            </span>
          ))}
        </div>
      </section>,
    )
  return <div class="skeleton">{shelves}</div>
}

export function ErrorState({ title, error, retry }: { title: string; error: string; retry?: () => void }) {
  return (
    <div class="state">
      <Icon name="alert" size={56} />
      <h2>{title}</h2>
      <p>{error}</p>
      {retry ? (
        <button data-f data-autofocus class="pill" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function Page({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return (
    <main class={'page ' + cls} data-scroll>
      {children}
    </main>
  )
}

/** Blurred, upscaled artwork behind a screen: BitChord's artwork theming, cheap enough for a TV GPU. */
export function Ambient({ image }: { image?: string }) {
  const s = useStore(player)
  const src = image || (s.queue[s.index] && s.queue[s.index].image) || ''
  const [layers, setLayers] = useState<{ a: string; b: string; top: 'a' | 'b' }>({ a: src, b: '', top: 'a' })
  useEffect(() => {
    setLayers((l) => {
      const shown = l.top === 'a' ? l.a : l.b
      if (shown === src) return l
      return l.top === 'a' ? { a: l.a, b: src, top: 'b' } : { a: src, b: l.b, top: 'a' }
    })
  }, [src])
  return (
    <div class="ambient" aria-hidden="true">
      {(['a', 'b'] as const).map((k) =>
        layers[k] ? <img class={'amb' + (layers.top === k ? ' on' : '')} src={img(layers[k], 60)} alt="" /> : null,
      )}
      <div class="amb-scrim" />
    </div>
  )
}
