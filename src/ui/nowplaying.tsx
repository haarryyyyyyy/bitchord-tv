// Now Playing, as BitChord TV has it (TvNowPlayingScreen.kt):
// the artwork's colours fill the screen; the cover sits centred, and glides left when
// lyrics arrive; the transport (title, buttons, scrubber) rises on any press and steps
// away after 5 idle seconds. With it away, Left/Right change track and OK brings it back.
// On the scrubber, Left/Right scrub and OK plays or pauses; Down opens Up Next.
// Back closes Up Next, then the transport, then the player.
import { useEffect, useRef, useState } from 'preact/hooks'
import { drawMesh } from '../lib/artcolor'
import { fetchLyrics, lineAt, type Lyrics } from '../lyrics'
import { openMenu, openNowPlaying } from '../nav'
import { jumpTo, next, player, position, prev, seekTo, toggle } from '../player'
import type { Stream, Track } from '../sources/types'
import { isLiked, liked, settings, toggleLike, useStore } from '../store'
import { Icon, PauseGlyph, PlayGlyph } from './icons'
import { Art, Bars, Explicit, fmt, img } from './kit'

const IDLE_MS = 5000
const SCRUB_STEP = 10
const SCRUB_COMMIT_MS = 700

/** The handler App gives first refusal on every key while Now Playing is open. */
export let nowPlayingKeys: ((e: KeyboardEvent) => boolean) | null = null

const quality = (s: Stream | null) => (s ? [s.from === 'saavn' ? 'JioSaavn' : 'YouTube Music', s.codec + (s.kbps ? ` ${s.kbps} kbps` : '')] : null)

function Mesh({ src }: { src: string }) {
  const a = useRef<HTMLCanvasElement>(null)
  const b = useRef<HTMLCanvasElement>(null)
  const [top, setTop] = useState<'a' | 'b'>('a')
  useEffect(() => {
    const target = top === 'a' ? b.current : a.current
    if (!target || !src) return
    let live = true
    drawMesh(target, img(src, 120)).then(
      () => live && setTop(top === 'a' ? 'b' : 'a'),
      () => {},
    )
    return () => {
      live = false
    }
  }, [src])
  return (
    <div class="mesh" aria-hidden="true">
      <canvas ref={a} width="8" height="6" class={top === 'a' ? 'on' : ''} />
      <canvas ref={b} width="8" height="6" class={top === 'b' ? 'on' : ''} />
    </div>
  )
}

function Scrubber({ target }: { target: number | null }) {
  const fill = useRef<HTMLSpanElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  const now = useRef<HTMLSpanElement>(null)
  const left = useRef<HTMLSpanElement>(null)
  // Written straight to the DOM: four ticks a second re-render nothing.
  useEffect(() => {
    const paint = (p: { time: number; duration: number }) => {
      const t = target != null ? target : p.time
      const r = p.duration ? Math.min(1, t / p.duration) : 0
      if (fill.current) fill.current.style.transform = `scaleX(${r})`
      if (knob.current) knob.current.style.transform = `translateX(${r * 1748}px)`
      if (now.current) now.current.textContent = fmt(t) || '0:00'
      if (left.current) left.current.textContent = p.duration ? '−' + (fmt(Math.max(0, p.duration - t)) || '0:00') : ''
    }
    paint(position.get())
    return position.subscribe(paint)
  }, [target])
  return (
    <div class="scrub">
      <button data-f data-key="np-scrub" data-autofocus class={'scrub-bar' + (target != null ? ' scrubbing' : '')} aria-label="Playback position. Left and right move 10 seconds, OK plays or pauses, Down shows Up Next.">
        <span class="scrub-fill" ref={fill} />
        <span class="scrub-knob" ref={knob} />
      </button>
      <div class="scrub-times">
        <span ref={now} />
        <span ref={left} />
      </div>
    </div>
  )
}

function LyricsView({ lyrics }: { lyrics: Lyrics }) {
  const list = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(-1)
  useEffect(() => {
    if (!lyrics.synced) return
    const on = (p: { time: number }) => {
      const i = lineAt(lyrics.lines, p.time + 0.3)
      setIdx((prevIdx) => (prevIdx === i ? prevIdx : i))
    }
    on(position.get())
    return position.subscribe(on)
  }, [lyrics])
  useEffect(() => {
    const box = list.current
    if (!box) return
    if (lyrics.synced) {
      const el = box.children[Math.max(0, idx)] as HTMLElement | undefined
      if (el) box.style.transform = `translateY(${-(el.offsetTop - 300)}px)`
    }
  }, [idx, lyrics])
  // Unsynced lyrics drift with the song so the words are roughly in view.
  useEffect(() => {
    if (lyrics.synced) return
    return position.subscribe((p) => {
      const box = list.current
      if (!box || !p.duration) return
      const over = Math.max(0, box.scrollHeight - 700)
      box.style.transform = `translateY(${-(over * p.time) / p.duration}px)`
    })
  }, [lyrics])
  return (
    <div class={'lyrics' + (lyrics.synced ? '' : ' plain')}>
      <div class="lyrics-list" ref={list}>
        {lyrics.lines.map((l, i) => (
          <p class={i === idx ? 'on' : i < idx ? 'past' : ''}>{l.text || '♪'}</p>
        ))}
      </div>
    </div>
  )
}

function UpNext() {
  const s = useStore(player)
  const items = s.queue.slice(s.index + 1, s.index + 21)
  if (!items.length) return <p class="upnext-empty">{settings.get().autoplay ? 'AutoPlay adds similar songs when this one ends.' : 'Nothing is queued after this song.'}</p>
  return (
    <div class="row upnext">
      <div class="row-track" data-row>
        {items.map((t, i) => (
          <button data-f data-key={'up:' + t.id} class="lockup" style={{ width: 200 }} onClick={() => jumpTo(s.index + 1 + i)} aria-label={`${t.title}, ${t.artist}`}>
            <Art src={t.image} size={200} />
            <span class="cap">
              <b>{t.title}</b>
              <i>{t.artist}</i>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TransportButton({ k, icon, label, onClick, active, disabled }: { k: string; icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button data-f={disabled ? undefined : ''} data-key={k} class={'tbtn' + (active ? ' active' : '') + (disabled ? ' off' : '')} aria-label={label} aria-pressed={active} onClick={disabled ? undefined : onClick}>
      <Icon name={icon} size={36} fill={icon === 'star' && active} stroke={2.2} />
    </button>
  )
}

export function NowPlaying() {
  const s = useStore(player)
  const set = useStore(settings)
  useStore(liked)
  const t: Track | undefined = s.queue[s.index]
  const [controls, setControls] = useState(true)
  const [upNext, setUpNext] = useState(false)
  const [lyricsOff, setLyricsOff] = useState(!set.showLyrics)
  const [lyrics, setLyrics] = useState<Lyrics | null>(null)
  const [scrubTarget, setScrubTarget] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ glyph: string; n: number } | null>(null)
  const [input, setInput] = useState(0)
  const scrubTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Lyrics wait for a known length, so the match can check it.
  const dur = Math.round(position.get().duration || (t ? t.durationSec : 0))
  useEffect(() => {
    setLyrics(null)
    if (!t) return
    let live = true
    const go = (d: number) => fetchLyrics(t, d).then((l) => live && setLyrics(l), () => {})
    if (dur) go(dur)
    else {
      const off = position.subscribe((p) => {
        if (p.duration) off(), go(p.duration)
      })
      return () => ((live = false), off())
    }
    return () => {
      live = false
    }
  }, [t && t.id])

  useEffect(() => {
    if (!controls || upNext || !s.playing || scrubTarget != null) return
    const timer = setTimeout(() => setControls(false), IDLE_MS)
    return () => clearTimeout(timer)
  }, [controls, upNext, s.playing, scrubTarget, input])

  // Focus follows what's on screen: the scrubber when the transport rises, the stage when it goes.
  useEffect(() => {
    const el = root.current && root.current.querySelector<HTMLElement>(controls ? '[data-key=np-scrub]' : '[data-key=np-stage]')
    if (el) el.focus()
  }, [controls])
  useEffect(() => {
    if (!upNext || !root.current) return
    const first = root.current.querySelector<HTMLElement>('.upnext [data-f]')
    if (first) first.focus()
  }, [upNext])

  const showFlash = (glyph: string) => setFlash({ glyph, n: Date.now() })
  const commit = (to: number | null) => {
    if (scrubTimer.current) clearTimeout(scrubTimer.current)
    if (to != null) seekTo(to)
    setScrubTarget(null)
  }
  const scrub = (delta: number) => {
    const p = position.get()
    const from = scrubTarget != null ? scrubTarget : p.time
    const to = Math.max(0, Math.min(Math.max(0, p.duration - 1), from + delta))
    setScrubTarget(to)
    if (scrubTimer.current) clearTimeout(scrubTimer.current)
    scrubTimer.current = setTimeout(() => commit(to), SCRUB_COMMIT_MS)
  }

  nowPlayingKeys = (e: KeyboardEvent) => {
    const k = e.keyCode
    setInput((n) => n + 1)
    const isBack = k === 10009 || k === 27 || k === 8
    if (isBack) {
      if (upNext) setUpNext(false)
      else if (controls) setControls(false)
      else openNowPlaying(false)
      return true
    }
    if (!controls) {
      if (k === 37) return prev(), showFlash('prev'), true
      if (k === 39) return next(), showFlash('next'), true
      if (k === 13 || k === 38 || k === 40) return setControls(true), true
      return false
    }
    const active = document.activeElement as HTMLElement | null
    if (active && active.dataset.key === 'np-scrub') {
      if (k === 37 || k === 39) return scrub(k === 39 ? SCRUB_STEP : -SCRUB_STEP), true
      if (k === 13) {
        if (!e.repeat) scrubTarget != null ? commit(scrubTarget) : toggle()
        return true
      }
      if (k === 40) return setUpNext(true), true
    }
    if (upNext && k === 38 && active && active.closest('.upnext')) {
      setUpNext(false)
      const bar = root.current && root.current.querySelector<HTMLElement>('[data-key=np-scrub]')
      if (bar) bar.focus()
      return true
    }
    return false
  }
  useEffect(() => () => void (nowPlayingKeys = null), [])

  if (!t)
    return (
      <div class="np empty" data-layer role="dialog" aria-label="Now Playing">
        <div class="np-nothing">
          <Icon name="music" size={96} stroke={1.5} />
          <h2>Nothing Playing</h2>
          <p>Choose a song from Home, Explore or Search.</p>
          <button data-f data-autofocus data-key="np-browse" class="btn primary" onClick={() => openNowPlaying(false)}>
            <span>Browse Music</span>
          </button>
        </div>
      </div>
    )

  const showLyrics = !!lyrics && lyrics.lines.length > 0 && !lyricsOff
  const q = quality(s.stream)
  const fav = isLiked(t.id)
  return (
    <div ref={root} class={'np' + (showLyrics ? ' with-lyrics' : '') + (controls ? ' controls' : '') + (upNext ? ' upnext-open' : '')} data-layer role="dialog" aria-label="Now Playing">
      <Mesh src={t.image} />
      <div class="np-scrim" />
      <button data-f data-key="np-stage" class="np-stage" aria-label="Show controls" onClick={() => setControls(true)} />
      <div class="np-cover">
        <img src={img(t.image, 720)} width="640" height="640" alt="" />
      </div>
      <div class="np-caption" aria-hidden={controls}>
        <b>{t.title}</b>
        <i>{t.artist}</i>
      </div>
      {showLyrics ? <LyricsView lyrics={lyrics!} /> : null}
      <section class="transport" aria-hidden={!controls}>
        <div class="transport-top">
          <div class="transport-id">
            <h1>
              {t.title}
              {t.explicit ? <Explicit /> : null}
            </h1>
            <p>{[t.artist, t.album].filter(Boolean).join(' — ')}</p>
            <div class="quality">
              {s.loading ? <Bars on /> : null}
              {s.error ? <span class="err">{s.error}</span> : q ? (
                <>
                  <span class="chip">{q[0]}</span>
                  <span>{q[1]}</span>
                </>
              ) : (
                <span>Loading…</span>
              )}
            </div>
          </div>
          <div class="tbtns">
            <TransportButton k="np-fav" icon="star" label={fav ? 'Remove from Favourites' : 'Add to Favourites'} active={fav} onClick={() => toggleLike(t)} />
            <TransportButton k="np-lyrics" icon="lyrics" label={showLyrics ? 'Hide Lyrics' : 'Show Lyrics'} active={showLyrics} disabled={!lyrics} onClick={() => setLyricsOff(!lyricsOff)} />
            <TransportButton k="np-queue" icon="queue" label="Up Next" active={upNext} onClick={() => setUpNext(!upNext)} />
            <TransportButton k="np-more" icon="more" label="More" onClick={() => openMenu(t)} />
          </div>
        </div>
        <Scrubber target={scrubTarget} />
        {upNext ? <UpNext /> : null}
      </section>
      {flash ? (
        <div key={flash.n} class="flash" aria-hidden="true">
          {flash.glyph === 'play' ? <PlayGlyph size={80} /> : flash.glyph === 'pause' ? <PauseGlyph size={80} /> : <Icon name={flash.glyph} size={80} fill />}
        </div>
      ) : null}
    </div>
  )
}
